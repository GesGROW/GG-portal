import assert from 'node:assert/strict'
import test from 'node:test'
import { crearPortal } from '../src/application/crearPortal.js'
import { fakePorts } from './support/fakePorts.js'
import { fakeReportes } from './support/fakeReportes.js'
import { crearReportesAdapter } from '../src/infrastructure/supabase/reportesAdapter.js'
import { serializarCsv } from '../src/ports/exportacion.js'
async function crear(options = {}, datos = {}) {
  const ports = fakePorts({ autenticado: true, ...options }),
    extra = fakeReportes(ports, datos),
    app = crearPortal(ports)
  await app.restaurar()
  if (options.empresas?.length > 1) await app.seleccionarEmpresa('A')
  return { app, ports, ...extra }
}
const solicitud = (tipo = 'RESUMEN', otros = {}) => ({
  campaniaId: 'A-camp',
  tipo,
  ...otros
})

test('reportes de campaña usan sólo filtros autorizados, métricas coherentes y contexto seleccionado', async () => {
  const { app, ports } = await crear()
  const f = {
    campaniaId: 'A-camp',
    tipo: 'PRODUCCION',
    loteId: 'l1',
    variedadId: 'v1',
    desde: '2026-10-15',
    hasta: '2026-10-21'
  }
  const r = await app.reportes.campania({ ...f, tenantId: 'B', actor: 'falso' })
  assert.deepEqual(
    ports.calls.find((c) => c[0] === 'reporteCampania'),
    ['reporteCampania', 'A', f]
  )
  assert.ok(Object.isFrozen(r.datos.metricas))
  assert.equal(
    r.datos.evolucion.reduce((n, d) => n + d.jabas, 0),
    r.datos.metricas.totalJabas
  )
  assert.equal(
    r.datos.ranking.reduce((n, d) => n + d.jabas, 0),
    r.datos.metricas.totalJabas
  )
  for (const filtro of [
    { tipo: 'OTRO' },
    { desde: '2026-02-30' },
    { desde: '2026-10-22', hasta: '2026-10-21' }
  ])
    await assert.rejects(app.reportes.campania({ ...f, ...filtro }), /inválidos/)
  const anterior = ports.reportesHarvest.campania
  ports.reportesHarvest.campania = async (...args) => ({
    ...(await anterior(...args)),
    tenantId: 'B'
  })
  await assert.rejects(app.reportes.campania(f), /Respuesta.*inválida/)
  ports.permisos.A = []
  await assert.rejects(app.reportes.campania(f), /permiso/i)
})

test('reportes de campaña descartan respuesta tardía al cambiar de empresa y exigen reports.view en la ruta', async () => {
  const { app, ports } = await crear({
    empresas: ['A', 'B'],
    permisos: {
      A: ['reports.view', 'harvest.manage'],
      B: ['reports.view', 'harvest.manage']
    }
  })
  assert.equal(await app.abrirRuta('/cosecha/produccion'), true)
  let liberar, avisar
  const inicio = new Promise((r) => {
      avisar = r
    }),
    original = ports.reportesHarvest.campania
  ports.reportesHarvest.campania = async (...args) => {
    const r = await original(...args)
    avisar()
    await new Promise((r) => {
      liberar = r
    })
    return r
  }
  const pendiente = app.reportes.campania({ campaniaId: 'A-camp', tipo: 'RENDIMIENTO' })
  const rechazo = assert.rejects(pendiente, { name: 'SolicitudObsoleta' })
  await inicio
  await app.seleccionarEmpresa('B')
  liberar()
  await rechazo
  ports.permisos.B = ['harvest.manage']
  assert.equal(await app.abrirRuta('/cosecha/rendimiento'), false)
})

test('adapter de reportes de campaña transporta lote, variedad y fechas sin aceptar autoridad del formulario', async () => {
  const calls = [],
    p = crearReportesAdapter(async (...args) => {
      calls.push(args)
    })
  await p.campania('A', {
    campaniaId: 'camp',
    tipo: 'PRODUCCION',
    loteId: 'l',
    variedadId: 'v',
    desde: '2026-10-15',
    hasta: '2026-10-22',
    tenantId: 'B',
    permisos: ['todo']
  })
  assert.deepEqual(calls, [
    [
      'harvest_reportes_campania',
      {
        p_tenant_id: 'A',
        p_campania_id: 'camp',
        p_tipo: 'PRODUCCION',
        p_lote_id: 'l',
        p_variedad_id: 'v',
        p_desde: '2026-10-15',
        p_hasta: '2026-10-22'
      }
    ]
  ])
})
test('dashboard con y sin datos usa métricas entregadas sin recalcular', async () => {
  for (const vacio of [true, false]) {
    const { app } = await crear({}, { vacio })
    const r = await app.reportes.consultar(solicitud('DASHBOARD'))
    assert.equal(r.datos.resumen.total_jabas, vacio ? 0 : 43)
    assert.equal(r.datos.hoy.total_jabas, vacio ? 0 : 23)
    assert.ok(Object.isFrozen(r.datos.resumen))
  }
})
test('campañas activas/cerradas independientes del contexto PDA y Tenant derivado de sesión', async () => {
  const { app, ports } = await crear()
  assert.deepEqual(
    (await app.reportes.campanias()).map((c) => c.estado),
    ['ACTIVA', 'CERRADA']
  )
  assert.equal(
    (
      await app.reportes.consultar(
        solicitud('RESUMEN', { campaniaId: 'A-cerrada', tenantId: 'B' })
      )
    ).tenantId,
    'A'
  )
  await assert.rejects(
    app.reportes.consultar(solicitud('RESUMEN', { campaniaId: 'B-camp' })),
    /otra empresa/
  )
  assert.equal(
    ports.calls.some((c) => c[0] === 'consultarReporte' && c[1] === 'B'),
    false
  )
})
for (const periodo of ['HOY', 'SEMANA', 'MES', 'CAMPANIA'])
  test(
    'ranking ' + periodo + ' conserva posición backend al buscar DNI/nombre',
    async () => {
      const { app } = await crear()
      const r = await app.reportes.consultar(
        solicitud('RANKING', { periodo, busqueda: '87654321' })
      )
      assert.equal(r.datos.ranking.length, 1)
      assert.equal(r.datos.ranking[0].posicion, 2)
      assert.equal(r.datos.periodo, periodo)
      assert.equal(
        (await app.reportes.consultar(solicitud('RANKING', { busqueda: 'ANA' }))).datos
          .ranking[0].cosechador,
        'Ana A'
      )
    }
  )
test('diaria intacta y lotes operativos con búsqueda/orden existentes', async () => {
  const { app } = await crear()
  assert.equal(
    (await app.reportes.consultar(solicitud('DIARIA'))).datos.produccion[0].total_jabas,
    23
  )
  assert.equal(
    (await app.reportes.consultar(solicitud('LOTES', { busqueda: 'verde' }))).datos
      .produccion[0].lote_codigo,
    'L1'
  )
  assert.deepEqual(
    (
      await app.reportes.consultar(solicitud('LOTES', { orden: 'az' }))
    ).datos.produccion.map((l) => l.lote_codigo),
    ['L1', 'L2']
  )
})
test('sin reports.view o HARVEST bloquea dashboard, reportes y acceso directo', async () => {
  for (const options of [
    { permisos: { A: ['harvest.manage', 'harvest.view'] } },
    { modulos: { A: [] } }
  ]) {
    const { app, ports } = await crear(options)
    assert.equal(await app.abrirRuta('/reportes/ranking'), false)
    await assert.rejects(app.reportes.consultar(solicitud('DASHBOARD')))
    assert.equal(
      ports.calls.some((c) => c[0] === 'consultarReporte'),
      false
    )
  }
})
test('CSV usa exactamente filtro/orden/posición mostrados y revalida servidor', async () => {
  const { app, ports, archivos } = await crear()
  const r = await app.reportes.consultar(solicitud('RANKING', { busqueda: 'Bruno' }))
  await app.reportes.exportar(r)
  assert.match(archivos[0].contenido, /Bruno A/)
  assert.doesNotMatch(archivos[0].contenido, /Ana A/)
  assert.match(archivos[0].contenido, /"2","87654321"/)
  assert.ok(ports.calls.find((c) => c[0] === 'validarReporte'))
  await assert.rejects(app.reportes.exportar({ ...r }), { name: 'SolicitudObsoleta' })
  ports.reportesHarvest.validar = async () => {
    throw new Error('Membresía revocada en servidor')
  }
  await assert.rejects(app.reportes.exportar(r), /revocada/)
  assert.equal(archivos.length, 1)
})
test('CSV diaria/lotes/resumen, escapado y fórmulas sin interpretación de hoja', async () => {
  const { app, archivos } = await crear()
  for (const tipo of ['RESUMEN', 'DIARIA', 'LOTES'])
    await app.reportes.exportar(
      await app.reportes.consultar(
        solicitud(tipo, { busqueda: tipo === 'LOTES' ? 'Norte' : '' })
      )
    )
  assert.match(archivos[0].contenido, /"43","2","2","3","2"/)
  assert.match(archivos[1].contenido, /2026-10-14/)
  assert.match(archivos[2].contenido, /Norte/)
  assert.doesNotMatch(archivos[2].contenido, /Sur/)
  assert.equal(
    serializarCsv(['Columna'], [['=1+2'], ['a,"b\nc']]),
    '\uFEFF"Columna"\r\n"\'=1+2"\r\n"a,""b\nc"\r\n'
  )
})
test('cambio de Tenant descarta respuesta tardía y exportación anterior incluso al volver A→B→A', async () => {
  const { app, ports, archivos } = await crear({
    empresas: ['A', 'B'],
    permisos: { A: ['reports.view'], B: ['reports.view'] }
  })
  const anterior = await app.reportes.consultar(solicitud())
  let resolver, inicio
  const iniciada = new Promise((r) => (inicio = r)),
    original = ports.reportesHarvest.consultar
  ports.reportesHarvest.consultar = async (...a) => {
    const r = await original(...a)
    inicio()
    await new Promise((r) => (resolver = r))
    return r
  }
  const pendiente = app.reportes.consultar(solicitud())
  await iniciada
  await app.seleccionarEmpresa('B')
  resolver()
  await assert.rejects(pendiente, { name: 'SolicitudObsoleta' })
  await assert.rejects(app.reportes.exportar(anterior), { name: 'SolicitudObsoleta' })
  ports.reportesHarvest.consultar = original
  const b = await app.reportes.consultar(solicitud('RESUMEN', { campaniaId: 'B-camp' }))
  assert.equal(b.datos.campania.nombre, 'Campaña B')
  await app.seleccionarEmpresa('A')
  await assert.rejects(app.reportes.exportar(anterior), { name: 'SolicitudObsoleta' })
  assert.equal(archivos.length, 0)
})
test('sesión expirada y permisos revocados bloquean exportación previamente autorizada', async () => {
  const { app, ports, archivos } = await crear()
  const r = await app.reportes.consultar(solicitud())
  ports.permisos.A = []
  await assert.rejects(app.reportes.exportar(r))
  assert.equal(archivos.length, 0)
  const otro = await crear()
  otro.ports.expirar()
  await assert.rejects(otro.app.reportes.campanias())
  assert.equal(otro.app.estadoActual().fase, 'login')
})
test('adapter traduce contrato neutral sin aceptar tenant, permisos o módulos de solicitud', async () => {
  const calls = [],
    p = crearReportesAdapter(async (...a) => calls.push(a))
  await p.consultar('A', { ...solicitud(), tenantId: 'B', modulos: ['HARVEST'] })
  assert.deepEqual(calls[0], [
    'harvest_reportes_obtener',
    {
      p_tenant_id: 'A',
      p_campania_id: 'A-camp',
      p_tipo: 'RESUMEN',
      p_periodo: undefined
    }
  ])
})

test('adapter distingue módulo revocado por backend y conserva errores de transporte', async () => {
  const p = crearReportesAdapter(async () => {
    throw new Error('Módulo no habilitado: HARVEST')
  })
  await assert.rejects(p.campanias('A'), { name: 'ModuloNoHabilitado' })
  const error = new Error('Conexión interrumpida')
  const otro = crearReportesAdapter(async () => {
    throw error
  })
  await assert.rejects(otro.validar('A', 'A-camp'), (e) => e === error)
})
