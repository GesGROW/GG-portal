import assert from 'node:assert/strict'
import test from 'node:test'
import { crearPortal } from '../src/application/crearPortal.js'
import { crearCosechaAdapter } from '../src/infrastructure/supabase/cosechaAdapter.js'
import { fakePorts } from './support/fakePorts.js'
import { fakeHarvestAdmin } from './support/fakeHarvestAdmin.js'
const solicitud = {
  operacionId: 'op-1',
  campaniaId: 'A-camp',
  cantidadTickets: 43,
  tamanioLote: 10
}
async function crear(options = {}) {
  const ports = fakePorts({
      autenticado: true,
      permisos: { A: ['harvest.view', 'harvest.manage'] },
      ...options
    }),
    datos = fakeHarvestAdmin(ports),
    app = crearPortal(ports)
  await app.restaurar()
  if (options.empresas?.length > 1) await app.seleccionarEmpresa('A')
  return { app, ports, datos }
}

test('panel de tickets usa solo la consulta ligera y rechaza otro lote', async () => {
  const { app, ports } = await crear()
  const r = {
    tenantId: 'A',
    campaniaId: 'A-camp',
    loteId: 'l1',
    total: 1,
    filas: [{ codigo: 'C00000101', estado: 'DISPONIBLE' }]
  }
  const calls = []
  ports.harvestAdmin.ticketsLote = async (...args) => {
    calls.push(args)
    return r
  }
  assert.deepEqual(await app.cosecha.ticketsLote('A-camp', 'l1'), r)
  assert.deepEqual(calls, [['A', 'A-camp', 'l1', 0]])
  ports.harvestAdmin.ticketsLote = async () => ({ ...r, loteId: 'ajeno' })
  await assert.rejects(app.cosecha.ticketsLote('A-camp', 'l1'), /no corresponden/)
  await assert.rejects(app.cosecha.ticketsLote('A-camp', 'l1', -1), /inválida/)
  const adapter = crearCosechaAdapter(async (...args) => calls.push(args))
  await adapter.ticketsLote('A', 'A-camp', 'l1', 50)
  assert.deepEqual(calls.at(-1), [
    'harvest_admin_tickets_lote',
    { p_tenant_id: 'A', p_campania_id: 'A-camp', p_lote_id: 'l1', p_offset: 50 }
  ])
})

test('la lectura del panel y la comprobación del módulo corren en paralelo, sin entregar datos si el módulo falla', async () => {
  const { app, ports } = await crear()
  const r = {
    id: 't1',
    tenantId: 'A',
    campaniaId: 'A-camp',
    rol: 'JABERO',
    participacionId: 'r1'
  }
  let resolverModulo,
    lecturaIniciada = false,
    terminada = false
  const comprobarModulo = ports.entitlements.puedeUsarModulo
  let primera = true
  ports.entitlements.puedeUsarModulo = (...args) => {
    if (!primera) return comprobarModulo(...args)
    primera = false
    return new Promise((resolve) => {
      resolverModulo = resolve
    })
  }
  ports.harvestAdmin.trabajadorCampania = async () => {
    lecturaIniciada = true
    return r
  }
  const tarea = app.cosecha.trabajadorCampania('A-camp', 'JABERO', 'r1').finally(() => {
    terminada = true
  })
  while (!resolverModulo) await new Promise((resolve) => setTimeout(resolve, 0))
  assert.equal(lecturaIniciada, true)
  assert.equal(terminada, false)
  ports.modulos.A = []
  resolverModulo(false)
  await assert.rejects(tarea, /módulo|habilitado/i)
})

test('ficha de campaña usa solo HARVEST; edición limita datos y exige harvest.manage', async () => {
  const { app, ports } = await crear({ modulos: { A: ['HARVEST'] } })
  const ficha = {
    id: 't1',
    tenantId: 'A',
    campaniaId: 'A-camp',
    rol: 'COSECHADOR',
    participacionId: 'r1',
    dni: '12345678',
    nombres: 'Ana',
    apellidos: 'Rojas',
    activo: true
  }
  const calls = []
  ports.harvestAdmin.trabajadorCampania = async (...args) => {
    calls.push(['leer', ...args])
    return ficha
  }
  ports.harvestAdmin.editarTrabajadorCampania = async (...args) => {
    calls.push(['editar', ...args])
    return ficha
  }
  assert.deepEqual(
    await app.cosecha.trabajadorCampania('A-camp', 'COSECHADOR', 'r1'),
    ficha
  )
  assert.deepEqual(
    await app.cosecha.editarTrabajadorCampania('A-camp', 'COSECHADOR', 'r1', {
      ...ficha,
      tenantId: 'B',
      dni: ' 12345678 ',
      activo: true
    }),
    ficha
  )
  assert.deepEqual(calls.at(-1), [
    'editar',
    'A',
    'A-camp',
    'COSECHADOR',
    'r1',
    { dni: '12345678', nombres: 'Ana', apellidos: 'Rojas', activo: true }
  ])
  await assert.rejects(
    app.cosecha.editarTrabajadorCampania('A-camp', 'COSECHADOR', 'r1', {
      ...ficha,
      dni: '123'
    }),
    /requeridos/
  )
  ports.harvestAdmin.trabajadorCampania = async () => ({ ...ficha, tenantId: 'B' })
  await assert.rejects(
    app.cosecha.trabajadorCampania('A-camp', 'COSECHADOR', 'r1'),
    /no corresponde/
  )
  ports.permisos.A = ['harvest.view']
  await assert.rejects(
    app.cosecha.editarTrabajadorCampania('A-camp', 'COSECHADOR', 'r1', ficha),
    /permiso/i
  )
})

test('la ficha descarta una respuesta después de cambiar de empresa y el adapter no serializa autoridad del formulario', async () => {
  const { app, ports } = await crear({
    empresas: ['A', 'B'],
    permisos: { A: ['harvest.manage'], B: ['harvest.manage'] }
  })
  let liberar
  ports.harvestAdmin.trabajadorCampania = () =>
    new Promise((r) => {
      liberar = r
    })
  const tarea = app.cosecha.trabajadorCampania('A-camp', 'JABERO', 'r1')
  while (!liberar) await new Promise((r) => setTimeout(r, 0))
  await app.seleccionarEmpresa('B')
  liberar({
    id: 't1',
    tenantId: 'A',
    campaniaId: 'A-camp',
    rol: 'JABERO',
    participacionId: 'r1'
  })
  await assert.rejects(tarea, { name: 'SolicitudObsoleta' })
  const calls = [],
    adapter = crearCosechaAdapter(async (...args) => calls.push(args))
  await adapter.editarTrabajadorCampania('A', 'c1', 'JABERO', 'r1', {
    tenantId: 'B',
    id: 'otro',
    dni: '12345678',
    nombres: 'Ana',
    apellidos: 'Rojas',
    activo: false,
    actor: 'falso'
  })
  assert.deepEqual(calls, [
    [
      'harvest_admin_editar_trabajador_campania',
      {
        p_tenant_id: 'A',
        p_campania_id: 'c1',
        p_rol: 'JABERO',
        p_participacion_id: 'r1',
        p_dni: '12345678',
        p_nombres: 'Ana',
        p_apellidos: 'Rojas',
        p_activo: false
      }
    ]
  ])
})

test('trabajadores de la campaña usa sólo HARVEST, valida filtros y revalida el contexto', async () => {
  const { app, ports, datos } = await crear({ modulos: { A: ['HARVEST'] } })
  datos.trabajadoresCampania.A.push({
    id: 'p1',
    campaniaId: 'A-camp',
    rol: 'COSECHADOR',
    nombre: 'Ana',
    activo: false
  })
  assert.equal(
    (await app.cosecha.trabajadoresCampania('A-camp', 'COSECHADOR')).total,
    1
  )
  assert.deepEqual(
    ports.calls.find((c) => c[0] === 'trabajadoresCampania'),
    ['trabajadoresCampania', 'A', 'A-camp', 'COSECHADOR', 0]
  )
  for (const args of [
    [null, 'COSECHADOR'],
    ['A-camp', 'ADMIN'],
    ['A-camp', 'JABERO', -1]
  ])
    await assert.rejects(app.cosecha.trabajadoresCampania(...args), /inválida/)
  ports.permisos.A = []
  await assert.rejects(
    app.cosecha.trabajadoresCampania('A-camp', 'COSECHADOR'),
    /permiso/i
  )
  const calls = []
  const adapter = crearCosechaAdapter(async (...args) => {
    calls.push(args)
  })
  await adapter.trabajadoresCampania('A', 'camp', 'JABERO', 50)
  assert.deepEqual(calls, [
    [
      'harvest_admin_trabajadores',
      { p_tenant_id: 'A', p_campania_id: 'camp', p_rol: 'JABERO', p_offset: 50 }
    ]
  ])
})
test('generación transmite sólo intención a la API pública Harvest; servidor devuelve partición 43/10', async () => {
  const { app, ports } = await crear()
  const r = await app.cosecha.generar({
    ...solicitud,
    tenantId: 'B',
    lotes: [{ id: 'falso' }],
    tickets: ['falso'],
    actor: 'falso'
  })
  assert.deepEqual(
    ports.calls.find((c) => c[0] === 'generarHarvest'),
    ['generarHarvest', 'A', solicitud]
  )
  assert.deepEqual(
    r.lotes.map((l) => l.cantidadTickets),
    [10, 10, 10, 10, 3]
  )
  assert.deepEqual(await app.cosecha.generar(solicitud), r)
  assert.equal((await app.cosecha.campanias())[0].modelo, 'LEGACY')
  for (const n of [0, -1, 1.5, 100001])
    await assert.rejects(
      app.cosecha.generar({ ...solicitud, cantidadTickets: n }),
      /cantidades enteras/
    )
})

test('filtros de tablas conserva contexto, fechas y el estado inactivo sin cambiar los RPC antiguos', async () => {
  const { app, ports } = await crear()
  const filtros = {
    busqueda: '  Lucía  ',
    estado: 'INACTIVO',
    desde: '2026-10-20',
    hasta: '2026-10-21'
  }
  await app.cosecha.trabajadoresCampania('A-camp', 'JABERO', 0, filtros)
  assert.deepEqual(
    ports.calls.find((c) => c[0] === 'trabajadoresCampania'),
    [
      'trabajadoresCampania',
      'A',
      'A-camp',
      'JABERO',
      0,
      { ...filtros, busqueda: 'Lucía' }
    ]
  )
  for (const invalido of [
    { estado: 'OTRO' },
    { busqueda: 123 },
    { desde: '2026-02-30' },
    { desde: '2026-10-22', hasta: '2026-10-20' },
    { hasta: 'infinity' }
  ])
    await assert.rejects(
      app.cosecha.trabajadoresCampania('A-camp', 'JABERO', 0, invalido),
      /inválid/
    )
  await app.cosecha.listar('lotes', {
    campaniaId: 'A-camp',
    ...filtros,
    estado: 'ASIGNADO'
  })
  assert.deepEqual(ports.calls.find((c) => c[0] === 'listarHarvest')[3], {
    campaniaId: 'A-camp',
    busqueda: 'Lucía',
    estado: 'ASIGNADO',
    desde: '2026-10-20',
    hasta: '2026-10-21',
    loteId: null,
    trabajadorId: null,
    offset: 0
  })
  const calls = []
  const adapter = crearCosechaAdapter(async (...args) => calls.push(args))
  await adapter.trabajadoresCampania('A', 'camp', 'JABERO', 0, {
    ...filtros,
    busqueda: 'Lucía'
  })
  assert.deepEqual(calls[0], [
    'harvest_admin_trabajadores_filtrados',
    {
      p_tenant_id: 'A',
      p_campania_id: 'camp',
      p_rol: 'JABERO',
      p_offset: 0,
      p_busqueda: 'Lucía',
      p_activo: false,
      p_desde: '2026-10-20',
      p_hasta: '2026-10-21'
    }
  ])
  await adapter.listar('A', 'asignaciones', {
    campaniaId: 'camp',
    busqueda: '76338971',
    estado: '',
    loteId: null,
    trabajadorId: null,
    offset: 50,
    desde: '2026-10-20',
    hasta: '2026-10-21'
  })
  assert.deepEqual(calls[1], [
    'harvest_admin_listar_filtrado',
    {
      p_tenant_id: 'A',
      p_tipo: 'asignaciones',
      p_campania_id: 'camp',
      p_busqueda: '76338971',
      p_estado: '',
      p_lote_id: null,
      p_trabajador_id: null,
      p_offset: 50,
      p_desde: '2026-10-20',
      p_hasta: '2026-10-21'
    }
  ])
})
test('harvest.view consulta pero no genera; harvest.operate no habilita administración ni consultas Portal', async () => {
  const view = await crear({ permisos: { A: ['harvest.view'] } })
  assert.equal(await view.app.abrirRuta('/cosecha/tickets'), true)
  assert.equal(await view.app.abrirRuta('/cosecha/generar'), false)
  await assert.rejects(view.app.cosecha.generar(solicitud), /permiso/)
  assert.equal(
    view.ports.calls.some((c) => c[0] === 'generarHarvest'),
    false
  )
  const campo = await crear({ permisos: { A: ['harvest.operate'] } })
  assert.equal(await campo.app.abrirRuta('/cosecha'), false)
  await assert.rejects(campo.app.cosecha.listar('tickets'), /consulta Harvest/)
  const manage = await crear({ permisos: { A: ['harvest.manage'] } })
  assert.equal(await manage.app.abrirRuta('/cosecha/generar'), true)
  assert.equal((await manage.app.cosecha.listar('tickets')).total, 2)
})
test('HARVEST deshabilitado impide generación y consultas incluso con permisos', async () => {
  const { app, ports } = await crear({ modulos: { A: [] } })
  await assert.rejects(app.cosecha.generar(solicitud), /módulo/)
  await assert.rejects(app.cosecha.listar('tickets'), /módulo/)
  assert.equal(
    ports.calls.some((c) => c[0] === 'generarHarvest' || c[0] === 'listarHarvest'),
    false
  )
})
test('consultas resuelven Ticket, lote, asignación y cosecha sin exponer comandos de campo', async () => {
  const { app } = await crear()
  const t = await app.cosecha.obtener('tickets', 'TK-A-USADO')
  assert.equal(t.lote.asignacion.trabajador.id, 'A-worker')
  assert.equal(t.registro.id, 'A-registro')
  assert.equal((await app.cosecha.obtener('tickets', 'TK-A-LIBRE')).registro, null)
  assert.equal(
    (
      await app.cosecha.listar('tickets', {
        estado: 'UTILIZADO',
        trabajadorId: 'A-worker'
      })
    ).total,
    1
  )
  for (const metodo of [
    'asignar',
    'reasignar',
    'registrarCosecha',
    'imprimir',
    'actualizarRegistro'
  ])
    assert.equal(app.cosecha[metodo], undefined)
})
test('cambiar Tenant descarta resultados anteriores y no permite consultar Ticket ajeno', async () => {
  const { app, ports } = await crear({
    empresas: ['A', 'B'],
    permisos: { A: ['harvest.view'], B: ['harvest.view'] }
  })
  let resolver, inicio
  const iniciada = new Promise((r) => (inicio = r)),
    original = ports.harvestAdmin.listar
  ports.harvestAdmin.listar = async (...a) => {
    const r = await original(...a)
    inicio()
    await new Promise((r) => (resolver = r))
    return r
  }
  const pendiente = app.cosecha.listar('tickets')
  await iniciada
  await app.seleccionarEmpresa('B')
  resolver()
  await assert.rejects(pendiente, { name: 'SolicitudObsoleta' })
  ports.harvestAdmin.listar = original
  await assert.rejects(app.cosecha.obtener('tickets', 'TK-A-USADO'), /otra empresa/)
  assert.equal((await app.cosecha.listar('tickets')).filas[0].codigo, 'TK-B-USADO')
})
test('adapter usa sólo nuevos RPC administrativos; nunca serializa lotes desde el navegador', async () => {
  const calls = [],
    p = crearCosechaAdapter(async (...args) => {
      calls.push(args)
      return {}
    })
  await p.generar('A', { ...solicitud, tenantId: 'B', lotes: ['falso'] })
  assert.deepEqual(calls[0], [
    'harvest_admin_generar',
    {
      p_tenant_id: 'A',
      p_campania_id: 'A-camp',
      p_operacion_id: 'op-1',
      p_cantidad: 43,
      p_tamanio: 10
    }
  ])
  assert.equal(p.asignarLoteDesdeTicket, undefined)
})

test('registros consulta todas las páginas de la campaña y rechaza respuestas incompletas', async () => {
  const { app, ports, datos } = await crear()
  const base = datos.registros.A[0]
  datos.registros.A = Array.from({ length: 61 }, (_, i) => ({ ...base, id: String(i) }))
  assert.equal((await app.cosecha.registros('A-camp')).filas.length, 61)
  assert.deepEqual(
    ports.calls.filter((c) => c[0] === 'listarHarvest').map((c) => c[3].offset),
    [0, 50]
  )
  ports.harvestAdmin.listar = async () => ({ filas: [], total: 1 })
  await assert.rejects(app.cosecha.registros('A-camp'), /incompleta/)
})

test('registros conserva el Tenant original y descarta toda la respuesta si cambia durante la paginación', async () => {
  const { app, ports, datos } = await crear({
    empresas: ['A', 'B'],
    permisos: { A: ['harvest.view'], B: ['harvest.view'] }
  })
  const base = datos.registros.A[0]
  datos.registros.A = Array.from({ length: 51 }, (_, i) => ({ ...base, id: String(i) }))
  const original = ports.harvestAdmin.listar
  let release, start
  const started = new Promise((r) => {
    start = r
  })
  ports.harvestAdmin.listar = async (...args) => {
    const page = await original(...args)
    if (args[2].offset === 0) {
      start()
      await new Promise((r) => {
        release = r
      })
    }
    return page
  }
  const result = app.cosecha.registros('A-camp')
  const rejected = assert.rejects(result, { name: 'SolicitudObsoleta' })
  await started
  await app.seleccionarEmpresa('B')
  release()
  await rejected
  assert.ok(
    ports.calls.filter((c) => c[0] === 'listarHarvest').every((c) => c[1] === 'A')
  )
})

test('navegación interna de Cosecha conserva contexto y descarta rutas superadas mientras autoriza', async () => {
  const { app, ports } = await crear()
  await app.abrirRuta('/cosecha/registros')
  const previo = app.estadoActual()
  let resolver
  const gate = new Promise((resolve) => {
    resolver = resolve
  })
  ports.setResolver(() => gate)
  const primera = app.abrirRuta('/cosecha/generar')
  assert.equal(app.estadoActual().contexto, previo.contexto)
  assert.equal(app.estadoActual().navegacion, previo.navegacion)
  assert.equal(app.estadoActual().scope, previo.scope)
  const segunda = app.abrirRuta('/cosecha/lotes')
  assert.equal(app.estadoActual().contexto, previo.contexto)
  resolver()
  assert.equal(await primera, false)
  assert.equal(await segunda, true)
  assert.equal(app.estadoActual().ruta.path, '/cosecha/lotes')
})

test('la navegación sin desmontaje sigue denegando permisos revocados', async () => {
  const { app, ports } = await crear()
  await app.abrirRuta('/cosecha/registros')
  ports.permisos.A = ['harvest.view']
  assert.equal(await app.abrirRuta('/cosecha/generar'), false)
  assert.equal(app.estadoActual().ruta.estado, 'denegada')
  assert.match(app.estadoActual().ruta.mensaje, /harvest.manage/)
})
