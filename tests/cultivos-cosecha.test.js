import assert from 'node:assert/strict'
import test from 'node:test'
import { crearPortal } from '../src/application/crearPortal.js'
import { hoyLima } from '../src/application/cultivosCosecha.js'
import { crearCosechaAdapter } from '../src/infrastructure/supabase/cosechaAdapter.js'
import { fakePorts } from './support/fakePorts.js'
import { fakeHarvestAdmin } from './support/fakeHarvestAdmin.js'

async function preparar(options = {}) {
  const ports = fakePorts({
    autenticado: true,
    permisos: { A: ['harvest.manage'], B: ['harvest.manage'] },
    ...options
  })
  fakeHarvestAdmin(ports)
  for (const m of [
    'catalogoCultivos',
    'crearCultivo',
    'crearCampania',
    'solicitarUnion',
    'resolverUnion'
  ])
    ports.harvestAdmin[m] = async (...args) => {
      ports.calls.push([m, ...args])
      return { cultivoId: 'crop', campaniaId: 'campaign' }
    }
  const app = crearPortal(ports)
  await app.restaurar()
  if (options.empresas?.length > 1) await app.seleccionarEmpresa('A')
  return { app, ports }
}
const datos = () => ({
  nombre: ' Arándanos ',
  color: '#3B64EC',
  variedades: ['Ventura', 'Biloxi', ''],
  lotes: [
    { nombre: 'Norte', variedades: ['Ventura', 'Biloxi'] },
    { nombre: '', variedades: [] }
  ],
  campania: { nombre: 'Campaña nueva', fechaInicio: hoyLima(), fechaFin: '2099-12-31' }
})

test('creación usa Tenant autorizado, limpia entradas y conserva UUID tras un fallo de red', async () => {
  const { app, ports } = await preparar()
  let intento = 0
  ports.harvestAdmin.crearCultivo = async (...args) => {
    ports.calls.push(['crearCultivo', ...args])
    if (!intento++) throw new Error('Red')
    return { campaniaId: 'new' }
  }
  await assert.rejects(
    app.cultivosCosecha.crearCultivo({ ...datos(), tenantId: 'B', actor: 'intruso' }),
    /Red/
  )
  assert.deepEqual(await app.cultivosCosecha.crearCultivo(datos()), {
    campaniaId: 'new'
  })
  const calls = ports.calls.filter((c) => c[0] === 'crearCultivo')
  assert.equal(calls[0][1], 'A')
  assert.equal(calls[0][2], calls[1][2])
  assert.deepEqual(calls[0][3], {
    ...datos(),
    nombre: 'Arándanos',
    variedades: ['Ventura', 'Biloxi'],
    lotes: [{ nombre: 'Norte', variedades: ['Ventura', 'Biloxi'] }]
  })
})
test('cultivo inválido, lote sin variedad y fechas inválidas no llegan al puerto', async () => {
  const { app, ports } = await preparar()
  for (const d of [
    { ...datos(), color: '#ffffff' },
    { ...datos(), variedades: [] },
    { ...datos(), variedades: ['Uno', 'uno'] },
    { ...datos(), lotes: [{ nombre: 'Norte', variedades: [] }] },
    { ...datos(), lotes: [{ nombre: 'Norte', variedades: ['Ajena'] }] },
    { ...datos(), campania: { ...datos().campania, fechaInicio: '2020-01-01' } },
    { ...datos(), campania: { ...datos().campania, fechaFin: '2099-02-30' } }
  ])
    assert.throws(() => app.cultivosCosecha.crearCultivo(d))
  assert.equal(
    ports.calls.some((c) => c[0] === 'crearCultivo'),
    false
  )
})
test('crear campañas y solicitar/aprobar unión sólo transmiten intenciones autorizadas', async () => {
  const { app, ports } = await preparar()
  await app.cultivosCosecha.crearCampania('crop-A', datos().campania)
  await app.cultivosCosecha.solicitarUnion('crop-other')
  await app.cultivosCosecha.resolverUnion('request-A', true)
  assert.deepEqual(ports.calls.find((c) => c[0] === 'crearCampania').slice(3), [
    'crop-A',
    datos().campania
  ])
  assert.deepEqual(
    ports.calls.find((c) => c[0] === 'solicitarUnion'),
    ['solicitarUnion', 'A', 'crop-other']
  )
  assert.deepEqual(
    ports.calls.find((c) => c[0] === 'resolverUnion'),
    ['resolverUnion', 'A', 'request-A', true]
  )
  assert.equal(await app.abrirRuta('/cosecha/configurar'), true)
})
test('owner sin rol operativo, lector y módulo deshabilitado no acceden al catálogo ni al configurador', async () => {
  for (const options of [
    { permisos: { A: ['company.manage', 'reports.view'] } },
    { permisos: { A: ['harvest.view'] } },
    { modulos: { A: [] } }
  ]) {
    const { app, ports } = await preparar(options)
    assert.equal(await app.abrirRuta('/cosecha/configurar'), false)
    await assert.rejects(app.cultivosCosecha.catalogoCultivos())
    assert.equal(
      ports.calls.some((c) => c[0] === 'catalogoCultivos'),
      false
    )
  }
})
test('el cambio de empresa descarta consultas y asigna UUID distinto a la misma intención', async () => {
  const { app, ports } = await preparar({ empresas: ['A', 'B'] })
  let liberar, inicio
  const comenzada = new Promise((r) => {
    inicio = r
  })
  ports.harvestAdmin.catalogoCultivos = async () => {
    inicio()
    await new Promise((r) => {
      liberar = r
    })
    return { propios: [] }
  }
  const consulta = app.cultivosCosecha.catalogoCultivos()
  const rechazada = assert.rejects(consulta, { name: 'SolicitudObsoleta' })
  await comenzada
  await app.cultivosCosecha.crearCultivo(datos())
  await app.seleccionarEmpresa('B')
  liberar()
  await rechazada
  await app.cultivosCosecha.crearCultivo(datos())
  const calls = ports.calls.filter((c) => c[0] === 'crearCultivo')
  assert.notEqual(calls[0][2], calls[1][2])
  assert.deepEqual(
    calls.map((c) => c[1]),
    ['A', 'B']
  )
})
test('adaptador expone únicamente las RPC y parámetros del contrato', async () => {
  const calls = []
  const a = crearCosechaAdapter(async (n, p) => calls.push([n, p]))
  await a.catalogoCultivos('A')
  await a.crearCultivo('A', 'op', datos())
  await a.crearCampania('A', 'op2', 'crop', datos().campania)
  await a.solicitarUnion('A', 'crop')
  await a.resolverUnion('A', 'req', false)
  assert.deepEqual(
    calls.map((c) => c[0]),
    [
      'harvest_cultivos_catalogo',
      'harvest_cultivos_crear',
      'harvest_cultivos_campania',
      'harvest_cultivos_solicitar',
      'harvest_cultivos_resolver'
    ]
  )
  assert.deepEqual(calls[2][1], {
    p_tenant_id: 'A',
    p_operacion_id: 'op2',
    p_cultivo_id: 'crop',
    p_datos: datos().campania
  })
  assert.deepEqual(calls[4][1], {
    p_tenant_id: 'A',
    p_solicitud_id: 'req',
    p_aceptar: false
  })
})
