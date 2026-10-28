import assert from 'node:assert/strict'
import test from 'node:test'
import { crearPortal } from '../src/application/crearPortal.js'
import { normalizarEnlaceApp } from '../src/application/appCosecha.js'
import { crearPdaAdapter } from '../src/infrastructure/supabase/pdaAdapter.js'
import { fakePorts } from './support/fakePorts.js'
import { fakePda } from './support/fakePda.js'
import { evaluarRuta } from '../src/application/rutas.js'

async function preparar(options = {}) {
  const ports = fakePorts({
    autenticado: true,
    permisos: { A: ['harvest.manage'], B: ['harvest.manage'] },
    ...options
  })
  const datos = fakePda(ports)
  ports.enlaceAppCosecha = options.enlaceAppCosecha
  const app = crearPortal(ports)
  await app.restaurar()
  if (options.empresas?.length > 1) await app.seleccionarEmpresa('A')
  return { ports, app, datos, servicio: app.appCosecha }
}

test('el enlace común y el QR de vinculación son diferentes; el token queda en el fragmento', async () => {
  const { servicio, ports } = await preparar()
  assert.equal(servicio.enlaceInstalacion, 'https://gg-app-m-harvest.vercel.app/')
  assert.equal((await servicio.listar()).qr, null)
  const qr = await servicio.generar()
  const url = new URL(qr.enlace)
  assert.equal(url.origin, 'https://gg-app-m-harvest.vercel.app')
  assert.equal(url.search, '')
  assert.match(url.hash, /^#vincular=[0-9a-f]{64}$/)
  assert.deepEqual((await servicio.listar()).qr, qr)
  assert.ok(ports.calls.some((c) => c[0] === 'pdaGenerar' && c[1] === 'A'))
})

test('las dos rutas requieren HARVEST; la administración no concede permisos agrícolas al owner', () => {
  const owner = { permite: (p) => p === 'company.manage' }
  const supervisor = { permite: (p) => p === 'harvest.manage' }
  assert.equal(evaluarRuta('/cosecha/app', owner, ['HARVEST']).estado, 'permitida')
  assert.equal(
    evaluarRuta('/cosecha/dispositivos', owner, ['HARVEST']).estado,
    'permitida'
  )
  assert.equal(evaluarRuta('/cosecha/generar', owner, ['HARVEST']).estado, 'denegada')
  assert.equal(evaluarRuta('/cosecha/app', owner, []).estado, 'denegada')
  assert.equal(evaluarRuta('/cosecha/app', supervisor, ['HARVEST']).estado, 'permitida')
  assert.equal(
    evaluarRuta('/cosecha/dispositivos', supervisor, ['HARVEST']).estado,
    'permitida'
  )
})

test('el cambio de empresa no expone ni reutiliza el QR de la anterior', async () => {
  const { app, servicio } = await preparar({ empresas: ['A', 'B'] })
  const qrA = await servicio.generar()
  await app.seleccionarEmpresa('B')
  assert.equal((await servicio.listar()).qr, null)
  const qrB = await servicio.generar()
  assert.notEqual(qrA.enlace, qrB.enlace)
  await app.seleccionarEmpresa('A')
  assert.equal((await servicio.listar()).qr, null)
})

test('respuestas tardías se rechazan tras un cambio de empresa y no guardan el token', async () => {
  const { app, ports, servicio } = await preparar({ empresas: ['A', 'B'] })
  let completar, iniciada
  const esperando = new Promise((r) => {
    iniciada = r
  })
  ports.pda.generar = () => {
    iniciada()
    return new Promise((r) => {
      completar = r
    })
  }
  const antiguo = servicio.generar()
  await esperando
  await app.seleccionarEmpresa('B')
  completar({
    tenantId: 'A',
    id: 'qr-A',
    token: 'a'.repeat(64),
    venceEn: '2099-10-28T22:00:00Z'
  })
  await assert.rejects(antiguo, { name: 'SolicitudObsoleta' })
  assert.equal((await servicio.listar()).qr, null)
})

test('rechaza respuestas y revocaciones que no corresponden a la empresa solicitada', async () => {
  const { servicio, ports } = await preparar()
  ports.pda.listar = async () => ({ tenantId: 'B', dispositivos: [] })
  await assert.rejects(servicio.listar(), /no corresponde/)
  ports.pda.revocar = async () => ({ id: 'd', tenantId: 'B', estado: 'REVOCADO' })
  await assert.rejects(servicio.revocar('d'), /no corresponde/)
  ports.pda.renovar = async () => ({ id: 'd', tenantId: 'B', estado: 'ACTIVO' })
  await assert.rejects(servicio.renovar('d'), /no corresponde/)
})

test('URL insegura bloquea la generación y el permiso revocado evita consultar equipos', async () => {
  for (const url of [
    'javascript:alert(1)',
    'http://ejemplo.com/',
    'https://u:p@ejemplo.com/'
  ])
    assert.equal(normalizarEnlaceApp(url), null)
  assert.equal(
    normalizarEnlaceApp('http://localhost:5173/#x'),
    'http://localhost:5173/'
  )
  const { servicio, ports } = await preparar({
    enlaceAppCosecha: 'javascript:alert(1)'
  })
  await assert.rejects(servicio.generar(), /no está disponible/)
  assert.equal(
    ports.calls.some((c) => c[0] === 'pdaGenerar'),
    false
  )
  ports.permisos.A = ['harvest.view']
  await assert.rejects(servicio.listar())
  await assert.rejects(servicio.renovar('d'))
  assert.equal(
    ports.calls.some((c) => c[0] === 'pdaListar'),
    false
  )
})

test('el adapter transmite exclusivamente el tenant y dispositivo a las RPC autorizadas', async () => {
  const calls = []
  const adapter = crearPdaAdapter(async (...args) => {
    calls.push(args)
  })
  await adapter.listar('A')
  await adapter.generar('A')
  await adapter.revocar('A', 'd')
  await adapter.renovar('A', 'd')
  assert.deepEqual(calls, [
    ['pda_administrar_dispositivos', { p_tenant_id: 'A' }],
    ['pda_generar_vinculacion', { p_tenant_id: 'A' }],
    ['pda_revocar_dispositivo', { p_tenant_id: 'A', p_dispositivo_id: 'd' }],
    ['pda_renovar_dispositivo', { p_tenant_id: 'A', p_dispositivo_id: 'd' }]
  ])
})
