import assert from 'node:assert/strict'
import test from 'node:test'
import { crearPortal } from '../src/application/crearPortal.js'
import { crearSuscripcionAdapter } from '../src/infrastructure/supabase/suscripcionAdapter.js'
import { crearPuertosSupabase } from '../src/infrastructure/supabase/adapters.js'
import { fakePorts } from './support/fakePorts.js'
import { fakeComercial } from './support/fakeComercial.js'
async function crear(options = {}, comercial = {}) {
  const ports = fakePorts({
      autenticado: true,
      permisos: { A: ['company.manage'], B: ['company.manage'] },
      ...options
    }),
    extra = fakeComercial(ports, comercial),
    app = crearPortal(ports)
  await app.restaurar()
  if (options.empresas?.length > 1) await app.seleccionarEmpresa('A')
  return { ports, app, ...extra }
}
const intencion = (otros = {}) => ({
  operacionId: 'op-1',
  versionBase: '1',
  motivo: 'Contrato acordado',
  planId: 'P2',
  ...otros
})
test('consulta comercial ordinaria y módulos efectivos/add-on sin exigir contratación operativa', async () => {
  const { app } = await crear({ modulos: { A: [] } }, { delegado: false })
  assert.equal(await app.abrirRuta('/configuracion/suscripcion'), true)
  const r = await app.suscripcion.consultar()
  assert.equal(r.puedeAdministrar, false)
  assert.deepEqual(r.modulosEfectivos, ['HARVEST', 'WORKFORCE'])
  assert.deepEqual(r.modulosPlan, ['HARVEST'])
  await assert.rejects(app.suscripcion.cambiarPlan(intencion()), /subscription.manage/)
})
test('intenciones usan API pública Platform y Tenant autorizado, sin propagar actor ni permisos del formulario', async () => {
  const { app, ports } = await crear()
  await app.suscripcion.cambiarPlan(
    intencion({
      tenantId: 'B',
      actor: 'FALSO',
      delegado: true,
      modulosEfectivos: ['HARVEST']
    })
  )
  const d = ports.calls.find((c) => c[0] === 'cambioComercial')[1]
  assert.equal(d.tenantId, 'A')
  assert.equal(d.actor, undefined)
  assert.equal(d.versionBase, '1')
  assert.deepEqual(d.parametros, { planId: 'P2' })
  assert.equal((await app.suscripcion.consultar()).planActual.id, 'P2')
})
test('cambio programado se conserva como intención separada del estado actual', async () => {
  const { app } = await crear()
  const r = await app.suscripcion.suspenderSuscripcion(
    intencion({ effectiveAt: '2090-01-01T00:00:00Z' })
  )
  assert.equal(r.fase, 'PROGRAMADA')
  const d = await app.suscripcion.consultar()
  assert.equal(d.estado.suscripcion.estado, 'ACTIVA')
  assert.equal(d.programados.length, 1)
})
test('versión requerida, conflicto explícito y reintento conserva recibo tras otro cambio', async () => {
  const { app } = await crear(),
    r = await app.suscripcion.cambiarPlan(intencion())
  await assert.rejects(
    app.suscripcion.suspenderSuscripcion(intencion({ operacionId: 'otra' })),
    { name: 'ConflictoVersionComercial' }
  )
  assert.deepEqual(await app.suscripcion.cambiarPlan(intencion()), r)
  await assert.rejects(
    app.suscripcion.cambiarPlan(intencion({ versionBase: undefined })),
    /Versión/
  )
  await assert.rejects(
    app.suscripcion.cambiarPlan(intencion({ versionBase: -1 })),
    /Versión/
  )
})
test('sin company.manage no accede por URL ni API; delegación revocada bloquea comando', async () => {
  const { app } = await crear({ permisos: { A: ['reports.view'] } })
  assert.equal(await app.abrirRuta('/configuracion/suscripcion'), false)
  await assert.rejects(app.suscripcion.consultar(), /permiso/)
  const otro = await crear()
  otro.delegaciones.A = false
  await assert.rejects(
    otro.app.suscripcion.cancelarSuscripcion(intencion()),
    /subscription.manage/
  )
})
test('aislamiento A→B→A y respuesta comercial tardía descartada', async () => {
  const { app, ports } = await crear({ empresas: ['A', 'B'] })
  let resolver, inicio
  const iniciada = new Promise((r) => (inicio = r)),
    original = ports.comercial.consultar
  ports.comercial.consultar = async (...a) => {
    const r = await original(...a)
    inicio()
    await new Promise((r) => (resolver = r))
    return r
  }
  const pendiente = app.suscripcion.consultar()
  await iniciada
  await app.seleccionarEmpresa('B')
  await app.seleccionarEmpresa('A')
  resolver()
  await assert.rejects(pendiente, { name: 'SolicitudObsoleta' })
  ports.comercial.consultar = original
  await app.seleccionarEmpresa('B')
  assert.equal((await app.suscripcion.consultar()).tenantId, 'B')
})
test('adapter serializa intención/versionado sin CRUD ni autoridad comercial de frontend', async () => {
  const calls = [],
    p = crearSuscripcionAdapter(async (...a) => calls.push(a))
  await p.consultar('A')
  await p.solicitarCambio({
    operacionId: 'O',
    tenantId: 'A',
    tipoEvento: 'CAMBIAR_PLAN',
    parametros: { planId: 'P2' },
    motivo: 'Cambio',
    versionBase: '7',
    effectiveAt: null,
    actor: 'FALSO'
  })
  assert.deepEqual(calls[1], [
    'platform_portal_solicitar_cambio',
    {
      p_operacion_id: 'O',
      p_tenant_id: 'A',
      p_tipo: 'CAMBIAR_PLAN',
      p_parametros: { planId: 'P2' },
      p_motivo: 'Cambio',
      p_version_base: '7',
      p_effective_at: null
    }
  ])
  const real = crearPuertosSupabase({
    rpc: async () => ({ error: { code: '40001', message: 'Conflicto de versión' } })
  })
  await assert.rejects(real.comercial.consultar('A'), {
    name: 'ConflictoVersionComercial'
  })
})
