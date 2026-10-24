import assert from 'node:assert/strict'
import test from 'node:test'
import { crearPortal } from '../src/application/crearPortal.js'
import { fakePorts } from './support/fakePorts.js'
import { fakeAdministracion } from './support/fakeAdministracion.js'
import { SesionExpirada } from '../src/ports/errores.js'

async function crear(options = {}) {
  const ports = fakePorts({ autenticado: true, ...options }),
    datos = fakeAdministracion(ports),
    app = crearPortal(ports)
  await app.restaurar()
  if (options.empresas?.length > 1) await app.seleccionarEmpresa('A')
  return { app, ports, datos, servicio: app.configuracion }
}

test('invitar Supervisor usa el rol de Cosecha de la empresa activa e ignora privilegios enviados desde UI', async () => {
  const { servicio, ports } = await crear()
  await servicio.invitarSupervisor({
    operacionId: 'sup-1',
    nombre: ' Deysi ',
    email: ' DEYSI@example.test ',
    tenantId: 'B',
    roles: ['B-admin'],
    trabajadorId: 'B-worker'
  })
  assert.deepEqual(ports.calls.find((c) => c[0] === 'invitacion').slice(1), [
    'A',
    {
      operacionId: 'sup-1',
      nombre: 'Deysi',
      email: 'deysi@example.test',
      roles: ['A-supervisor'],
      trabajadorId: null
    }
  ])
})
test('Supervisor requiere Cosecha habilitado y un error de listado no dispara invitaciones', async () => {
  const { servicio, ports } = await crear({ modulos: { A: [] } })
  await assert.rejects(
    servicio.invitarSupervisor({
      operacionId: 'sup-1',
      nombre: 'Ana',
      email: 'ana@example.test'
    }),
    /habilitado/
  )
  assert.equal(
    ports.calls.some((c) => c[0] === 'invitacion'),
    false
  )
})

test('cambiar empresa durante la consulta de rol impide enviar una invitación de la empresa anterior', async () => {
  const { servicio, ports, app } = await crear({
    empresas: ['A', 'B'],
    permisos: { A: ['company.manage'], B: ['company.manage'] }
  })
  let resolver, inicio
  const iniciada = new Promise((r) => (inicio = r))
  const original = ports.administracion.accesosCosecha
  ports.administracion.accesosCosecha = async (t) => {
    const datos = await original(t)
    inicio()
    await new Promise((r) => (resolver = r))
    return datos
  }
  const solicitud = servicio.invitarSupervisor({
    operacionId: 'sup-1',
    nombre: 'Ana',
    email: 'ana@example.test'
  })
  const resultado = assert.rejects(solicitud, /empresa o sesión cambió/)
  await iniciada
  await app.seleccionarEmpresa('B')
  resolver()
  await resultado
  assert.equal(
    ports.calls.some((c) => c[0] === 'invitacion'),
    false
  )
})
test('configuración utiliza contexto revalidado, ignora Tenant y campos internos suministrados por UI', async () => {
  const { app, servicio, ports, datos } = await crear()
  const antes = ports.calls.filter((c) => c[0] === 'resolver').length
  await servicio.guardarMembresia({
    usuarioId: 'persona-A',
    roles: [],
    activo: false,
    trabajadorId: null,
    nombre: 'Nombre A',
    tenantId: 'B',
    cuentaActiva: false
  })
  assert.deepEqual(ports.calls.find((c) => c[0] === 'membresia')[2], {
    usuarioId: 'persona-A',
    roles: [],
    activo: false,
    trabajadorId: null,
    nombre: 'Nombre A'
  })
  assert.equal(datos.usuarios.A[0].cuentaActiva, true)
  assert.equal(ports.calls.filter((c) => c[0] === 'resolver').length, antes + 1)
  assert.equal(await app.abrirRuta('/configuracion/usuarios/persona-A'), true)
})
test('company.manage funciona sin módulos ni delegación comercial; rutas de configuración protegidas', async () => {
  const { app, servicio } = await crear({
    permisos: { A: ['company.manage'] },
    modulos: { A: [] }
  })
  assert.equal((await servicio.listarAccesos()).total, 1)
  assert.deepEqual(await servicio.modulosHabilitados(), [])
  assert.equal(await app.abrirRuta('/configuracion/usuarios'), true)
  assert.equal(servicio.cambiarPlan, undefined)
  const denegado = await crear({ permisos: { A: ['harvest.view'] } })
  assert.equal(await denegado.app.abrirRuta('/configuracion/usuarios'), false)
  await assert.rejects(denegado.servicio.listarAccesos(), /permiso/i)
  assert.equal(
    denegado.ports.calls.some((c) => c[0] === 'listar'),
    false
  )
})

test('abrir y cancelar invitaciones conserva contexto mientras revalida y descarta rutas superadas', async () => {
  const { app, ports } = await crear()
  await app.abrirRuta('/configuracion/usuarios')
  const previo = app.estadoActual()
  let resolver
  const gate = new Promise((resolve) => {
    resolver = resolve
  })
  ports.setResolver(() => gate)
  const primera = app.abrirRuta('/configuracion/invitaciones')
  assert.equal(app.estadoActual().contexto, previo.contexto)
  assert.equal(app.estadoActual().navegacion, previo.navegacion)
  assert.equal(app.estadoActual().scope, previo.scope)
  const segunda = app.abrirRuta('/configuracion/usuarios')
  assert.equal(app.estadoActual().contexto, previo.contexto)
  resolver()
  assert.equal(await primera, false)
  assert.equal(await segunda, true)
  assert.equal(app.estadoActual().ruta.path, '/configuracion/usuarios')
  ports.setResolver(null)
  ports.permisos.A = ['harvest.view']
  assert.equal(await app.abrirRuta('/configuracion/invitaciones'), false)
  assert.equal(app.estadoActual().ruta.estado, 'denegada')
  assert.match(app.estadoActual().ruta.mensaje, /No tiene permiso/)
})

test('accesos filtra antes de paginar e incluye miembros posteriores a los primeros 50', async () => {
  const { servicio, datos } = await crear({ modulos: { A: ['HARVEST'] } })
  const base = datos.usuarios.A[0]
  datos.usuarios.A = Array.from({ length: 103 }, (_, i) => ({
    ...base,
    usuarioId: 'usuario-' + i,
    roles: [i < 50 ? 'A-gestor' : 'A-consulta'],
    activo: i !== 102
  }))
  const pagina = await servicio.listarAccesos({
    rol: 'A-consulta',
    estado: 'ACTIVO',
    offset: 50
  })
  assert.equal(pagina.total, 52)
  assert.deepEqual(
    pagina.usuarios.map((u) => u.usuarioId),
    ['usuario-100', 'usuario-101']
  )
  assert.deepEqual(pagina.modulos, ['HARVEST'])
  assert.equal(
    (await servicio.listarAccesos({ estado: 'SUSPENDIDO' })).usuarios[0].usuarioId,
    'usuario-102'
  )
  datos.usuarios.A[102].cuentaActiva = false
  assert.equal((await servicio.listarAccesos({ estado: 'SUSPENDIDO' })).total, 0)
  assert.equal((await servicio.listarAccesos({ estado: 'INACTIVO' })).total, 1)
  assert.equal((await servicio.listarAccesos({ modulo: 'WORKFORCE' })).total, 0)
  assert.deepEqual(datos.usuarios.A[0].roles, ['A-gestor'])
})

test('accesos rechaza una página incompleta y no entrega resultados del Tenant anterior', async () => {
  const { servicio, ports, datos, app } = await crear({ empresas: ['A', 'B'] })
  const listar = ports.administracion.listarUsuarios
  ports.administracion.listarUsuarios = async (tenant, busqueda, offset) => {
    const pagina = await listar(tenant, busqueda, offset)
    return { ...pagina, total: 51 }
  }
  await assert.rejects(
    servicio.listarAccesos({ estado: 'ACTIVO' }),
    /completar el listado/
  )
  ports.administracion.listarUsuarios = async (...args) => {
    const pagina = await listar(...args)
    await app.seleccionarEmpresa('B')
    return pagina
  }
  await assert.rejects(servicio.listarAccesos(), (e) => e.name === 'SolicitudObsoleta')
  assert.equal(datos.usuarios.A[0].nombre, 'Persona A')
})
test('altas limpian payload y no aceptan actor, secretos ni módulos desde Presentation', async () => {
  const { servicio, ports } = await crear()
  const r = await servicio.invitarUsuario({
    operacionId: 'op-1',
    nombre: ' Nueva ',
    email: ' NUEVA@EXAMPLE.TEST ',
    roles: ['A-consulta'],
    tenantId: 'B',
    actor: 'falso',
    password: 'secreto',
    modulos: ['HARVEST']
  })
  assert.equal(r.tenantId, 'A')
  assert.deepEqual(ports.calls.find((c) => c[0] === 'invitacion')[2], {
    operacionId: 'op-1',
    nombre: 'Nueva',
    email: 'nueva@example.test',
    roles: ['A-consulta'],
    trabajadorId: null
  })
})
test('cambio A→B→A descarta respuesta anterior y no comparte estado ni membresías', async () => {
  const { app, ports, servicio, datos } = await crear({
    empresas: ['A', 'B'],
    permisos: { A: ['company.manage'], B: ['company.manage'] }
  })
  let resolver, inicio
  const empezada = new Promise((r) => {
    inicio = r
  })
  const original = ports.administracion.listarUsuarios
  ports.administracion.listarUsuarios = async (...args) => {
    const resultado = await original(...args)
    inicio()
    await new Promise((r) => {
      resolver = r
    })
    return resultado
  }
  const pendiente = servicio.listarAccesos()
  await empezada
  await app.seleccionarEmpresa('B')
  await app.seleccionarEmpresa('A')
  resolver()
  await assert.rejects(pendiente, { name: 'SolicitudObsoleta' })
  ports.administracion.listarUsuarios = original
  await servicio.guardarMembresia({
    usuarioId: 'persona-A',
    nombre: 'A suspendida',
    activo: false,
    roles: [],
    trabajadorId: null
  })
  await app.seleccionarEmpresa('B')
  assert.equal((await servicio.listarAccesos()).usuarios[0].nombre, 'Persona B')
  assert.equal(datos.usuarios.B[0].activo, true)
})
test('sesión revocada durante escritura limpia Portal; permiso revocado se revalida antes de actuar', async () => {
  const { app, ports, servicio } = await crear()
  ports.administracion.guardarMembresia = async () => {
    throw new SesionExpirada()
  }
  const cambio = {
    usuarioId: 'persona-A',
    roles: [],
    activo: false,
    nombre: 'Persona A'
  }
  await assert.rejects(servicio.guardarMembresia(cambio), SesionExpirada)
  assert.equal(app.estadoActual().fase, 'login')
  assert.equal(app.estadoActual().contexto, null)
  const otro = await crear()
  otro.ports.permisos.A = []
  await assert.rejects(otro.servicio.guardarMembresia(cambio), /permiso/i)
  assert.equal(
    otro.ports.calls.some((c) => c[0] === 'guardarMembresia'),
    false
  )
})
