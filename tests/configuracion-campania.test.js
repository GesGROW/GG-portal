import assert from 'node:assert/strict'
import test from 'node:test'
import { crearPortal } from '../src/application/crearPortal.js'
import { validarConfiguracionCampania } from '../src/application/configuracionCampania.js'
import { crearCosechaAdapter } from '../src/infrastructure/supabase/cosechaAdapter.js'
import { fakePorts } from './support/fakePorts.js'
import { fakeHarvestAdmin } from './support/fakeHarvestAdmin.js'
import { fakeCultivosCosecha } from './support/fakeCultivosCosecha.js'

async function preparar(options = {}) {
  const ports = fakePorts({ autenticado: true, permisos: { A: ['harvest.manage'] }, ...options })
  fakeHarvestAdmin(ports); fakeCultivosCosecha(ports, { propio: true })
  const app = crearPortal(ports)
  await app.restaurar()
  if (options.empresas?.length > 1) await app.seleccionarEmpresa('A')
  return { ports, app, servicio: app.cultivosCosecha }
}
test('edición limpia datos y reintenta con la misma operación sin transmitir autoridad del cliente', async () => {
  const { ports, servicio } = await preparar()
  const d = await servicio.configuracionCampania('A-camp')
  d.nombre = ' Campaña corregida '; d.actor = 'intruso'; d.tenantId = 'B'
  const guardar = ports.harvestAdmin.guardarConfiguracionCampania
  let fallo = true
  ports.harvestAdmin.guardarConfiguracionCampania = async (...args) => {
    if (fallo) { fallo = false; ports.calls.push(['fallo', ...args]); throw new Error('Red') }
    return guardar(...args)
  }
  await assert.rejects(servicio.guardarConfiguracionCampania('A-camp', d), /Red/)
  const r = await servicio.guardarConfiguracionCampania('A-camp', d)
  assert.equal(r.nombre, 'Campaña corregida')
  const intento = ports.calls.find(c => c[0] === 'fallo')
  const exitoso = ports.calls.find(c => c[0] === 'guardarConfiguracionCampania')
  assert.equal(intento[2], exitoso[2])
  assert.equal(exitoso[1], 'A')
  assert.equal(exitoso[4].tenantId, undefined)
  assert.equal(exitoso[4].actor, undefined)
  assert.equal(exitoso[4].lotes[0].protegido, undefined)
})
test('validación acepta inicio histórico y rechaza duplicados, fechas y relaciones inválidas', async () => {
  const { servicio } = await preparar()
  const d = await servicio.configuracionCampania('A-camp')
  assert.equal(validarConfiguracionCampania(d).fechaInicio, '2026-11-04')
  for (const mutar of [
    x => { x.fechaFin = '2026-02-30' }, x => { x.fechaFin = '2020-01-01' },
    x => { x.variedades[1].nombre = x.variedades[0].nombre.toUpperCase() },
    x => { x.lotes[0].variedades = ['ajena'] }, x => { x.lotes[0].activo = false },
    x => { x.lotes[0].variedades = [] }, x => { x.revision = '' }
  ]) { const x = structuredClone(d); mutar(x); assert.throws(() => validarConfiguracionCampania(x)) }
})
test('revocación o cambio de empresa descarta respuesta y no muestra datos de otra empresa', async () => {
  const { ports, app, servicio } = await preparar({ empresas: ['A', 'B'] })
  let resolver, inicio
  const iniciada = new Promise(r => { inicio = r })
  ports.harvestAdmin.configuracionCampania = async () => {
    inicio(); return new Promise(r => { resolver = r })
  }
  const pendiente = servicio.configuracionCampania('A-camp')
  const rechazo = assert.rejects(pendiente, { name: 'SolicitudObsoleta' })
  await iniciada; await app.seleccionarEmpresa('B'); resolver({ tenantId: 'A' }); await rechazo
})
test('configuración exige HARVEST y gestión antes de invocar el puerto', async () => {
  for (const opciones of [{ permisos: { A: ['harvest.view'] } }, { modulos: { A: [] } }]) {
    const { ports, servicio } = await preparar(opciones)
    await assert.rejects(servicio.configuracionCampania('A-camp'))
    assert.equal(ports.calls.some(c => c[0] === 'configuracionCampania'), false)
  }
  const { ports, servicio } = await preparar()
  ports.harvestAdmin.configuracionCampania = async () => ({ tenantId: 'B' })
  await assert.rejects(servicio.configuracionCampania('A-camp'), /empresa autorizada/)
})
test('adaptador usa las dos RPC nuevas con empresa y operación explícitas', async () => {
  const calls = [], a = crearCosechaAdapter(async (n, p) => calls.push([n, p]))
  await a.configuracionCampania('A', 'camp')
  await a.guardarConfiguracionCampania('A', 'op', 'camp', { nombre: 'Campaña' })
  assert.deepEqual(calls, [
    ['harvest_admin_configuracion_campania', { p_tenant_id: 'A', p_campania_id: 'camp' }],
    ['harvest_admin_guardar_configuracion_campania', { p_tenant_id: 'A', p_operacion_id: 'op', p_campania_id: 'camp', p_datos: { nombre: 'Campaña' } }]
  ])
})
