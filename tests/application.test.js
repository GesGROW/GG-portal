import assert from 'node:assert/strict'
import test from 'node:test'
import { crearPortal } from '../src/application/crearPortal.js'
import { ServicioNoDisponible } from '../src/ports/errores.js'
import { fakePorts } from './support/fakePorts.js'

const credenciales = { email: 'ana@example.test', password: 'clave' }
const diferido = () => {
  let resolver
  const promise = new Promise((r) => {
    resolver = r
  })
  return { promise, resolver }
}

test('login y restauración verifican sesión y seleccionan una membresía sin DNI', async () => {
  const ports = fakePorts(),
    app = crearPortal(ports)
  await app.iniciar()
  assert.equal(app.estadoActual().fase, 'login')
  assert.equal(await app.login({ ...credenciales, password: 'errónea' }), false)
  assert.equal(app.estadoActual().fase, 'login')
  assert.match(app.estadoActual().mensaje, /contraseña/)
  assert.equal(await app.login(credenciales), true)
  assert.equal(app.estadoActual().contexto.tenantId, 'A')
  assert.equal(app.estadoActual().usuario.nombre, 'Ana Gestión')
  const nuevo = crearPortal(ports)
  await nuevo.restaurar()
  assert.equal(nuevo.estadoActual().contexto.tenantId, 'A')
  assert.equal(ports.calls.filter(([name]) => name === 'login').length, 2)
  assert.equal(nuevo.estadoActual().usuario.dni, undefined)
  app.detener()
})

test('sin membresías no hay contexto ni rutas', async () => {
  const app = crearPortal(fakePorts({ empresas: [], autenticado: true }))
  await app.restaurar()
  assert.equal(app.estadoActual().fase, 'sin-empresas')
  assert.equal(app.estadoActual().contexto, null)
  assert.deepEqual(app.estadoActual().navegacion, [])
  assert.equal(await app.abrirRuta('/'), false)
})

test('varias empresas requieren elección y una elección falsa es rechazada en servidor', async () => {
  const ports = fakePorts({ empresas: ['A', 'B'], autenticado: true }),
    app = crearPortal(ports)
  await app.restaurar()
  assert.equal(app.estadoActual().fase, 'seleccion')
  assert.equal(await app.seleccionarEmpresa('INVENTADA'), false)
  assert.equal(app.estadoActual().contexto, null)
  assert.equal(app.estadoActual().fase, 'seleccion')
  assert.ok(ports.calls.some(([tipo, id]) => tipo === 'resolver' && id === 'INVENTADA'))
  await app.seleccionarEmpresa('B')
  assert.equal(app.estadoActual().contexto.tenantId, 'B')
})

test('rutas requieren permiso y módulo; ocultar navegación no sustituye protección lógica', async () => {
  const ports = fakePorts({ autenticado: true }),
    app = crearPortal(ports)
  await app.restaurar()
  assert.equal(await app.abrirRuta('/cosecha/registros'), true)
  ports.permisos.A = ['company.manage']
  assert.equal(await app.abrirRuta('/cosecha/registros'), false)
  assert.match(app.estadoActual().ruta.mensaje, /permiso/)
  assert.ok(!app.estadoActual().navegacion.some((r) => r.path === '/cosecha'))
  ports.permisos.A = ['harvest.view']
  ports.modulos.A = []
  assert.equal(await app.abrirRuta('/cosecha/registros'), false)
  assert.match(app.estadoActual().ruta.mensaje, /módulo/)
  ports.modulos.A.push('HARVEST')
  assert.equal(await app.abrirRuta('/cosecha/registros'), true)
  assert.equal(await app.abrirRuta('/no-existe'), false)
  assert.equal(app.estadoActual().ruta.estado, 'no-encontrada')
})

test('empresa sin módulos conserva Inicio, Módulos y Configuración como capacidades base', async () => {
  const app = crearPortal(fakePorts({ autenticado: true, modulos: { A: [] } }))
  await app.restaurar()
  assert.deepEqual(
    app.estadoActual().navegacion.map((r) => r.path),
    ['/', '/modulos', '/configuracion']
  )
  assert.equal(await app.abrirRuta('/configuracion'), true)
  assert.equal(await app.abrirRuta('/cosecha'), false)
})

test('cambio de Tenant limpia todo estado y no acepta respuestas tardías de la empresa anterior', async () => {
  const ports = fakePorts({ empresas: ['A', 'B'], autenticado: true }),
    app = crearPortal(ports)
  await app.restaurar()
  await app.seleccionarEmpresa('A')
  await app.abrirRuta('/cosecha/registros')
  const scope = app.estadoActual().scope,
    gate = diferido()
  ports.setEntitlements((tenant) => (tenant === 'A' ? gate.promise : undefined))
  const antigua = app.revalidar()
  const nueva = app.seleccionarEmpresa('B')
  assert.equal(app.estadoActual().contexto, null)
  assert.equal(app.estadoActual().ruta, null)
  assert.deepEqual(app.estadoActual().modulos, [])
  await nueva
  gate.resolver()
  await antigua
  assert.equal(app.estadoActual().contexto.tenantId, 'B')
  assert.ok(app.estadoActual().scope > scope)
  assert.deepEqual(
    app.estadoActual().navegacion.map((r) => r.path),
    ['/'] // harvest.operate por sí solo no habilita consultas del Portal F7.4.
  )
  assert.equal(await app.abrirRuta('/cosecha/registros'), false)
})

test('TOKEN_REFRESHED revalida en background sin activar loading global ni perder contexto', async () => {
  const ports = fakePorts({ autenticado: true }),
    app = crearPortal(ports)
  await app.iniciar()
  await app.abrirRuta('/cosecha/registros')
  const contexto = app.estadoActual().contexto,
    gate = diferido()
  ports.setEntitlements(() => gate.promise)
  ports.notificar('actualizada', 'TOKEN_REFRESHED')
  const pendiente = app.revalidar()
  assert.equal(app.estadoActual().fase, 'listo')
  assert.equal(app.estadoActual().contexto, contexto)
  assert.equal(app.estadoActual().cargando, false)
  assert.equal(app.estadoActual().initializingSession, false)
  assert.equal(app.estadoActual().backgroundRevalidation, true)
  gate.resolver()
  await pendiente
  assert.equal(app.estadoActual().fase, 'listo')
  assert.equal(app.estadoActual().backgroundRevalidation, false)
  app.detener()
})

test('revocación de membresía o cambio de usuario elimina el TenantContext previo', async () => {
  const ports = fakePorts({ autenticado: true }),
    app = crearPortal(ports)
  await app.restaurar()
  ports.empresas.splice(0)
  await app.revalidar()
  assert.equal(app.estadoActual().fase, 'sin-empresas')
  assert.equal(app.estadoActual().contexto, null)
  const otros = fakePorts({ autenticado: true }),
    otro = crearPortal(otros)
  await otro.restaurar()
  otros.cambiarUsuario('OTRO')
  await otro.abrirRuta('/')
  assert.equal(otro.estadoActual().fase, 'login')
  assert.equal(otro.estadoActual().usuario, null)
})

test('sesión expirada se detecta en navegación y por eventos del adapter', async () => {
  const ports = fakePorts({ autenticado: true }),
    app = crearPortal(ports)
  await app.iniciar()
  ports.expirar()
  assert.equal(await app.abrirRuta('/cosecha'), false)
  assert.equal(app.estadoActual().fase, 'login')
  assert.equal(app.estadoActual().contexto, null)
  await app.login(credenciales)
  ports.notificar()
  assert.equal(app.estadoActual().fase, 'login')
  assert.deepEqual(app.estadoActual().modulos, [])
  app.detener()
})

test('logout limpia estado incluso mientras hay consultas pendientes y serializa login/logout', async () => {
  const ports = fakePorts({ autenticado: true }),
    app = crearPortal(ports)
  await app.restaurar()
  const gate = diferido()
  ports.setResolver(() => gate.promise)
  const lectura = app.abrirRuta('/cosecha')
  await app.logout()
  gate.resolver()
  await lectura
  assert.equal(app.estadoActual().fase, 'login')
  assert.equal(app.estadoActual().usuario, null)
  assert.deepEqual(app.estadoActual().empresas, [])
  assert.deepEqual(app.estadoActual().navegacion, [])
  assert.equal(await ports.identity.obtenerSesion(), null)
})

test('fallo temporal de red en revalidación conserva la sesión válida y permite reintentar', async () => {
  const ports = fakePorts({ autenticado: true }),
    app = crearPortal(ports)
  await app.restaurar()
  await app.abrirRuta('/cosecha/registros')
  const contexto = app.estadoActual().contexto
  ports.setEntitlements(() => {
    throw new ServicioNoDisponible('Servicio temporalmente no disponible')
  })
  await app.revalidar()
  assert.equal(app.estadoActual().fase, 'listo')
  assert.equal(app.estadoActual().contexto, contexto)
  assert.equal(app.estadoActual().cargando, false)
  assert.equal(app.estadoActual().backgroundRevalidation, false)
  ports.setEntitlements(null)
  await app.revalidar()
  assert.equal(app.estadoActual().fase, 'listo')
  assert.equal(app.estadoActual().contexto.tenantId, 'A')
})

test('logout ordena el cierre después de un login en vuelo y no restaura la sesión tardía', async () => {
  const ports = fakePorts(),
    app = crearPortal(ports),
    gate = diferido(),
    iniciando = diferido()
  const signin = ports.identity.iniciarSesion
  ports.identity.iniciarSesion = async (datos) => {
    iniciando.resolver()
    await gate.promise
    await signin(datos)
  }
  const entrando = app.login(credenciales)
  await iniciando.promise
  const saliendo = app.logout()
  gate.resolver()
  await entrando
  await saliendo
  assert.equal(await ports.identity.obtenerSesion(), null)
  assert.equal(app.estadoActual().fase, 'login')
  assert.equal(app.estadoActual().usuario, null)
  assert.deepEqual(
    ports.calls.map(([tipo]) => tipo),
    ['login', 'logout']
  )
})

test('logout fallido mantiene Portal bloqueado y ofrece reintento del cierre', async () => {
  const ports = fakePorts({ autenticado: true }),
    app = crearPortal(ports)
  await app.iniciar()
  const signout = ports.identity.cerrarSesion
  ports.identity.cerrarSesion = async () => {
    throw new Error('Conexión interrumpida')
  }
  assert.equal(await app.logout(), false)
  assert.equal(app.estadoActual().fase, 'salida-fallida')
  assert.equal(app.estadoActual().contexto, null)
  ports.notificar('actualizada')
  assert.equal(app.estadoActual().fase, 'salida-fallida')
  ports.identity.cerrarSesion = signout
  assert.equal(await app.logout(), true)
  assert.equal(app.estadoActual().fase, 'login')
  app.detener()
})

test('las membresías inactivas recibidas no forman parte del selector ni autorizan un Tenant', async () => {
  const ports = fakePorts({ autenticado: true }),
    app = crearPortal(ports)
  const obtener = ports.acceso.obtenerIdentidad
  ports.acceso.obtenerIdentidad = async () => {
    const perfil = await obtener()
    perfil.membresias[0].activo = false
    return perfil
  }
  await app.restaurar()
  assert.equal(app.estadoActual().fase, 'sin-empresas')
  assert.deepEqual(app.estadoActual().empresas, [])
  assert.equal(app.estadoActual().contexto, null)
})

test('restaurar una sesión invitada sin enlace exige activación antes de consultar el perfil', async () => {
  const ports = fakePorts({ autenticado: true }),
    app = crearPortal(ports)
  ports.identity.obtenerActivacionPendiente = async () => ({
    tenantId: 'A',
    empresa: 'Empresa A',
    requiereActivacion: true
  })
  await app.iniciar()
  assert.equal(app.estadoActual().fase, 'invitacion')
  assert.equal(app.estadoActual().contexto, null)
  assert.equal(app.estadoActual().usuario, null)
  assert.equal(
    await app.completarInvitacion({ password: 'clave-segura', dni: '123' }),
    false
  )
  assert.match(app.estadoActual().mensaje, /DNI de 8/)
  assert.equal(await app.abrirRuta('/cosecha'), false)
  app.detener()
})
