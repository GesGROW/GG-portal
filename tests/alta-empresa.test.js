import assert from 'node:assert/strict'
import test from 'node:test'
import { crearPortal } from '../src/application/crearPortal.js'
import { crearPuertosSupabase } from '../src/infrastructure/supabase/adapters.js'
import { fakePorts } from './support/fakePorts.js'

const datos = () => ({
  operacionId: crypto.randomUUID(),
  nombreEmpresa: '  Fundo nuevo  ',
  nombreOwner: '  Ana Owner  '
})
async function preparar() {
  const p = fakePorts({ empresas: [], autenticado: true }),
    app = crearPortal(p)
  await app.iniciar()
  return { p, app }
}
test('cuenta sin empresa crea owner y recarga el contexto autorizado sin módulos', async () => {
  const { p, app } = await preparar(),
    d = datos()
  assert.equal(
    await app.crearEmpresa({ ...d, tenantId: 'AJENA', roles: ['ADMIN'] }),
    true
  )
  const e = app.estadoActual()
  assert.equal(e.fase, 'listo')
  assert.equal(e.contexto.empresa, 'Fundo nuevo')
  assert.equal(e.usuario.nombre, 'Ana Owner')
  assert.deepEqual(e.contexto.permisos, ['company.manage', 'reports.view'])
  assert.deepEqual(e.modulos, [])
  assert.deepEqual(p.calls.find((c) => c[0] === 'crearEmpresa')[1], {
    ...d,
    nombreEmpresa: 'Fundo nuevo',
    nombreOwner: 'Ana Owner'
  })
  assert.equal(await app.crearEmpresa(datos()), false)
})
test('fallo de red preserva el alta; el recibo se recupera con la misma intención', async () => {
  const { p, app } = await preparar(),
    d = datos(),
    crear = p.acceso.crearEmpresa
  p.acceso.crearEmpresa = async (d) => {
    await crear(d)
    throw new Error('Respuesta perdida')
  }
  assert.equal(await app.crearEmpresa(d), false)
  assert.equal(app.estadoActual().fase, 'sin-empresas')
  assert.match(app.estadoActual().mensaje, /Respuesta perdida/)
  p.acceso.crearEmpresa = crear
  assert.equal(await app.crearEmpresa(d), true)
  assert.equal(p.empresas.length, 1)
})
test('envíos simultáneos y cierre de sesión descartan respuestas tardías', async () => {
  const { p, app } = await preparar()
  let resolver, inicio
  const iniciada = new Promise((r) => {
    inicio = r
  })
  p.acceso.crearEmpresa = () => {
    inicio()
    return new Promise((r) => {
      resolver = r
    })
  }
  const pendiente = app.crearEmpresa(datos())
  await iniciada
  assert.equal(await app.crearEmpresa(datos()), false)
  const salida = app.logout()
  resolver({ tenantId: 'NUEVA', usuarioId: 'U' })
  assert.equal(await pendiente, false)
  await salida
  assert.equal(app.estadoActual().fase, 'login')
  assert.equal(app.estadoActual().contexto, null)
})
test('cambio de identidad antes o durante el alta impide publicar el nuevo contexto', async () => {
  for (const momento of ['antes', 'despues', 'perfil']) {
    const { p, app } = await preparar(),
      crear = p.acceso.crearEmpresa
    if (momento === 'antes') p.cambiarUsuario('OTRA')
    else
      p.acceso.crearEmpresa = async (d) => {
        const r = await crear(d)
        if (momento === 'despues') p.cambiarUsuario('OTRA')
        else {
          const obtener = p.acceso.obtenerIdentidad
          p.acceso.obtenerIdentidad = () => {
            p.cambiarUsuario('OTRA')
            return obtener()
          }
        }
        return r
      }
    assert.equal(await app.crearEmpresa(datos()), false)
    assert.equal(app.estadoActual().fase, 'login')
    assert.equal(app.estadoActual().usuario, null)
    if (momento === 'antes')
      assert.equal(p.calls.filter((c) => c[0] === 'crearEmpresa').length, 0)
  }
})
test('adaptador del alta envía solo operación y nombres; ignora actor, empresa destino y permisos', async () => {
  let recibido
  const p = crearPuertosSupabase({
    rpc: async (nombre, parametros) => {
      recibido = { nombre, parametros }
      return { data: {} }
    }
  })
  const d = datos()
  await p.acceso.crearEmpresa({
    ...d,
    usuarioId: 'OTRO',
    tenantId: 'AJENA',
    permisos: ['harvest.manage']
  })
  assert.deepEqual(recibido, {
    nombre: 'iam_crear_empresa_inicial',
    parametros: {
      p_operacion_id: d.operacionId,
      p_nombre_empresa: d.nombreEmpresa,
      p_nombre_owner: d.nombreOwner
    }
  })
})
