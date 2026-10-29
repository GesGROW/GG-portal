import assert from 'node:assert/strict'
import test from 'node:test'
import { crearPortal } from '../src/application/crearPortal.js'
import { impresionTickets } from '../src/infrastructure/impresionTickets.js'
import { crearCosechaAdapter } from '../src/infrastructure/supabase/cosechaAdapter.js'
import { fakePorts } from './support/fakePorts.js'
import { fakeHarvestAdmin } from './support/fakeHarvestAdmin.js'
import { documentoEtiquetas } from './support/etiquetasTickets.js'

async function montar() {
  const ports = fakePorts({ autenticado: true, permisos: { A: ['harvest.manage'] } })
  fakeHarvestAdmin(ports)
  const d = documentoEtiquetas(),
    { filas, total, ...r } = d
  const propuesta = {
    ...r,
    lotes: r.lotes.map(({ id, ...l }) => l),
    previsualizacion: true
  }
  const solicitud = {
    operacionId: r.operacionId,
    campaniaId: r.campaniaId,
    cantidadTickets: r.cantidadTickets,
    tamanioLote: r.tamanioLote
  }
  const calls = []
  ports.harvestAdmin.previsualizar = async (t, s) => {
    calls.push(['preview', t, s])
    return structuredClone(propuesta)
  }
  ports.harvestAdmin.confirmarImpresion = async (t, s, p) => {
    calls.push(['confirmar', t, s, p])
    return structuredClone(r)
  }
  ports.harvestAdmin.generacion = async () => r
  ports.harvestAdmin.documentoImpresion = async (t, op, offset) => ({
    ...r,
    total,
    filas: filas.slice(offset, offset + 500)
  })
  const vistas = []
  ports.impresionTickets = {
    abrir() {
      calls.push(['abrir'])
      return { cerrar() {} }
    },
    async previsualizar(datos, opciones, autorizar) {
      await autorizar()
      const v = {
        url: 'blob:preview',
        cerrar() {
          v.cerrada = true
        }
      }
      vistas.push(v)
      calls.push(['pdf', datos])
      return v
    },
    async imprimir(d, datos, autorizar) {
      await autorizar()
      calls.push(['imprimir', datos])
      return { dialogoAbierto: true }
    }
  }
  const app = crearPortal(ports)
  await app.restaurar()
  return { app, ports, calls, solicitud, propuesta, r, vistas }
}

test('vista previa produce PDF local sin invocar generación, confirmación ni abrir ventanas', async () => {
  const { app, calls, solicitud } = await montar()
  const p = await app.cosecha.previsualizarGeneracion(solicitud, {})
  assert.equal(p.vista.url, 'blob:preview')
  assert.deepEqual(
    calls.map((c) => c[0]),
    ['preview', 'pdf']
  )
  assert.equal(calls[1][1].filas[7].codigo, 'C01061308')
  assert.equal(calls[1][1].filas[10].numeroLote, 2)
  assert.equal(calls[1][1].total, 20)
})

test('resolver impresión revalida el permiso y solo acepta respuestas de la misma operación y empresa', async () => {
  const { app, ports, solicitud, r } = await montar()
  const calls = []
  ports.harvestAdmin.resolverImpresion = async (...args) => {
    calls.push(args)
    return { ...r, estadoImpresion: 'IMPRESA' }
  }
  await assert.rejects(app.cosecha.resolverImpresion(r.operacionId, true), /recupera/)
  await app.cosecha.previsualizarGeneracion(solicitud, {})
  await app.cosecha.confirmarGeneracion(solicitud)
  assert.equal(
    (await app.cosecha.resolverImpresion(r.operacionId, true)).estadoImpresion,
    'IMPRESA'
  )
  assert.deepEqual(calls, [['A', r.operacionId, true]])
  ports.harvestAdmin.resolverImpresion = async () => ({
    ...r,
    tenantId: 'B',
    estadoImpresion: 'IMPRESA'
  })
  await assert.rejects(app.cosecha.resolverImpresion(r.operacionId, true), /verificar/)
  ports.harvestAdmin.resolverImpresion = async () => ({ ...r, cancelada: true })
  assert.equal(
    (await app.cosecha.resolverImpresion(r.operacionId, false)).cancelada,
    true
  )
  await assert.rejects(app.cosecha.resolverImpresion(r.operacionId, true), /recupera/)
})

test('adapter resuelve una respuesta humana sin aceptar actor, códigos ni lote desde el cliente', async () => {
  const calls = [],
    adapter = crearCosechaAdapter(async (...args) => calls.push(args))
  await adapter.resolverImpresion('t', 'op', false)
  assert.deepEqual(calls, [
    [
      'harvest_admin_resolver_impresion',
      { p_tenant_id: 't', p_operacion_id: 'op', p_impresa: false }
    ]
  ])
})

test('confirmar requiere la propuesta revisada y conserva su intención; impresión es un paso posterior', async () => {
  const { app, calls, solicitud, propuesta, r } = await montar()
  await assert.rejects(app.cosecha.confirmarGeneracion(solicitud), /vista previa/)
  await app.cosecha.previsualizarGeneracion(solicitud, {})
  await assert.rejects(
    app.cosecha.confirmarGeneracion({ ...solicitud, cantidadTickets: 21 }),
    /vista previa/
  )
  assert.deepEqual(await app.cosecha.confirmarGeneracion(solicitud), r)
  assert.deepEqual(calls[2], ['confirmar', 'A', solicitud, propuesta])
  assert.equal(
    calls.some((c) => c[0] === 'imprimir'),
    false
  )
  await app.cosecha.imprimirGeneracion(solicitud.operacionId, {})
  assert.equal(calls.at(-1)[0], 'imprimir')
})

test('respuesta obsoleta o propuesta con otro tenant no entrega PDF ni permite confirmar', async () => {
  const { app, ports, solicitud, calls, propuesta } = await montar()
  ports.harvestAdmin.previsualizar = async () => ({ ...propuesta, tenantId: 'B' })
  await assert.rejects(app.cosecha.previsualizarGeneracion(solicitud, {}), /solicitud/)
  assert.equal(calls.length, 0)
  await assert.rejects(app.cosecha.confirmarGeneracion(solicitud), /vista previa/)
})

test('revocar acceso al cultivo durante el render impide entregar el borrador', async () => {
  const { app, ports, solicitud, calls } = await montar()
  const preparar = ports.impresionTickets.previsualizar
  ports.impresionTickets.previsualizar = async (...args) => {
    ports.harvestAdmin.filtros = async () => {
      throw new Error('Participación revocada')
    }
    return preparar(...args)
  }
  await assert.rejects(app.cosecha.previsualizarGeneracion(solicitud, {}), /revocada/)
  assert.deepEqual(
    calls.map((c) => c[0]),
    ['preview']
  )
})

test('puerto real prepara un blob PDF sin window/document y libera la URL una sola vez', async (t) => {
  let permisos = 0,
    liberadas = 0
  t.mock.method(URL, 'revokeObjectURL', () => liberadas++)
  const v = await impresionTickets.previsualizar(
    documentoEtiquetas(),
    {},
    async () => permisos++
  )
  assert.ok(v.url.startsWith('blob:'))
  assert.equal((await fetch(v.url)).headers.get('Content-Type'), 'application/pdf')
  assert.equal(v.filas, 8)
  assert.equal(permisos, 1)
  v.cerrar()
  v.cerrar()
  assert.equal(liberadas, 1)
})

test('adapter usa RPC separadas para leer propuesta y confirmar; no envía filas fabricadas ni actor', async () => {
  const calls = [],
    adapter = crearCosechaAdapter(async (...args) => calls.push(args))
  const s = {
    campaniaId: 'c',
    operacionId: 'op',
    cantidadTickets: 43,
    tamanioLote: 10,
    actor: 'ignorar'
  }
  await adapter.previsualizar('t', s)
  await adapter.confirmarImpresion('t', s, { lotes: [] })
  assert.equal(calls[0][0], 'harvest_admin_previsualizar')
  assert.equal(calls[1][0], 'harvest_admin_reservar_impresion')
  assert.equal(calls[0][1].actor, undefined)
  assert.deepEqual(calls[1][1].p_vista_previa, { lotes: [] })
})

test('PDF confirmado solicita impresión una vez cargado y vuelve a autorizar antes del diálogo', async (t) => {
  const anterior = globalThis.window,
    nodos = []
  let impresiones = 0,
    permisos = 0
  const popup = {
    closed: false,
    focus() {},
    close() {
      this.closed = true
    },
    document: {
      documentElement: {},
      head: { replaceChildren() {}, append() {} },
      body: { replaceChildren() {}, append() {} },
      createElement(tag) {
        const n = {
          tag,
          append() {},
          contentWindow: {
            focus() {},
            print() {
              impresiones++
            }
          }
        }
        nodos.push(n)
        return n
      }
    }
  }
  globalThis.window = { open: () => popup }
  t.after(() => {
    if (anterior === undefined) delete globalThis.window
    else globalThis.window = anterior
  })
  t.mock.method(globalThis, 'setInterval', () => 0)
  const destino = impresionTickets.abrir({ modo: 'pdf', imprimirAlAbrir: true })
  const r = await impresionTickets.imprimir(
    destino,
    documentoEtiquetas(),
    async () => permisos++
  )
  assert.equal(r.impresionSolicitada, true)
  assert.equal(impresiones, 0)
  const visor = nodos.find((n) => n.tag === 'iframe')
  await visor.onload()
  assert.equal(impresiones, 1)
  assert.equal(permisos, 2)
  assert.equal(visor.onload, null)
  URL.revokeObjectURL(visor.src)
})

function navegadorIntegrado(t) {
  const nodos = [],
    estilos = []
  let impresiones = 0,
    eliminaciones = 0,
    liberadas = 0,
    ventanas = 0
  const anteriorDocumento = globalThis.document,
    anteriorVentana = globalThis.window
  globalThis.window = new EventTarget()
  globalThis.window.open = () => {
    ventanas++
    throw new Error('No debe abrir pestañas')
  }
  globalThis.document = {
    head: {
      append(nodo) {
        estilos.push(nodo)
      }
    },
    body: {
      append(nodo) {
        nodos.push(nodo)
      }
    },
    createElement(tag) {
      if (tag === 'style')
        return {
          remove() {
            estilos.splice(estilos.indexOf(this), 1)
          }
        }
      assert.equal(tag, 'iframe')
      const contenido = new EventTarget()
      contenido.focus = () => {}
      contenido.print = () => impresiones++
      return {
        style: {},
        setAttribute() {},
        contentWindow: contenido,
        remove() {
          eliminaciones++
        }
      }
    }
  }
  t.mock.method(URL, 'revokeObjectURL', () => liberadas++)
  const destino = impresionTickets.abrir({
    modo: 'pdf',
    enPagina: true,
    imprimirAlAbrir: true
  })
  t.after(() => {
    destino.cerrar()
    if (anteriorDocumento === undefined) delete globalThis.document
    else globalThis.document = anteriorDocumento
    if (anteriorVentana === undefined) delete globalThis.window
    else globalThis.window = anteriorVentana
  })
  return {
    destino,
    estilos,
    async visor() {
      for (let n = 0; n < 100 && !nodos.length; n++) await new Promise(setImmediate)
      assert.equal(nodos.length, 1)
      return nodos[0]
    },
    estado: () => ({ impresiones, eliminaciones, liberadas, ventanas })
  }
}

test('impresión vectorial integrada espera afterprint aunque print retorne y pasen varios minutos', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const navegador = navegadorIntegrado(t)
  let permisos = 0,
    terminada = false
  const tarea = impresionTickets.imprimir(
    navegador.destino,
    documentoEtiquetas(),
    async () => permisos++
  )
  tarea.then(() => {
    terminada = true
  })
  const visor = await navegador.visor()
  assert.equal(permisos, 1)
  assert.ok(visor.srcdoc.startsWith('<!doctype html>'))
  assert.ok(visor.srcdoc.includes('@page{size:100mm 20mm;margin:0!important}'))
  assert.equal(visor.src, undefined)
  assert.equal(navegador.estado().impresiones, 0)
  await visor.onload()
  assert.equal(permisos, 2)
  assert.equal(navegador.estilos.length, 1)
  assert.equal(navegador.estilos[0].media, 'print')
  assert.ok(
    navegador.estilos[0].textContent.includes(
      '@page{size:100mm 20mm;margin:0!important}'
    )
  )
  assert.ok(
    navegador.estilos[0].textContent.includes('@page:first{margin:0!important}')
  )
  t.mock.timers.tick(360000)
  await Promise.resolve()
  assert.equal(terminada, false)
  assert.deepEqual(navegador.estado(), {
    impresiones: 1,
    eliminaciones: 0,
    liberadas: 0,
    ventanas: 0
  })
  assert.equal(visor.onload, null)
  visor.contentWindow.dispatchEvent(new Event('afterprint'))
  globalThis.window.dispatchEvent(new Event('afterprint'))
  t.mock.timers.tick(0)
  const respuesta = await tarea
  assert.equal(respuesta.dialogoCerrado, true)
  assert.equal(navegador.estilos.length, 0)
  assert.equal(respuesta.impresionSolicitada, true)
  assert.deepEqual(navegador.estado(), {
    impresiones: 1,
    eliminaciones: 1,
    liberadas: 0,
    ventanas: 0
  })
  navegador.destino.cerrar()
  assert.equal(navegador.estado().liberadas, 0)
})

test('el cierre del diálogo notificado por la página también termina la espera una sola vez', async (t) => {
  const navegador = navegadorIntegrado(t)
  const tarea = impresionTickets.imprimir(
    navegador.destino,
    documentoEtiquetas(),
    async () => {}
  )
  const visor = await navegador.visor()
  await visor.onload()
  globalThis.window.dispatchEvent(new Event('afterprint'))
  assert.equal((await tarea).dialogoCerrado, true)
  globalThis.window.dispatchEvent(new Event('afterprint'))
  visor.contentWindow.dispatchEvent(new Event('afterprint'))
  assert.equal(navegador.estado().liberadas, 0)
})

test('salir con el diálogo solicitado cancela la espera y descarta un cierre tardío', async (t) => {
  const navegador = navegadorIntegrado(t)
  const tarea = impresionTickets.imprimir(
    navegador.destino,
    documentoEtiquetas(),
    async () => {}
  )
  const rechazo = assert.rejects(tarea, { name: 'AbortError' })
  const visor = await navegador.visor()
  await visor.onload()
  navegador.destino.cerrar()
  await rechazo
  assert.equal(navegador.estilos.length, 0)
  visor.contentWindow.dispatchEvent(new Event('afterprint'))
  globalThis.window.dispatchEvent(new Event('afterprint'))
  assert.deepEqual(navegador.estado(), {
    impresiones: 1,
    eliminaciones: 1,
    liberadas: 0,
    ventanas: 0
  })
})

test('revocar el permiso durante la carga de la impresión vectorial integrada evita imprimir y libera sus recursos', async (t) => {
  const navegador = navegadorIntegrado(t)
  let permisos = 0
  const tarea = impresionTickets.imprimir(
    navegador.destino,
    documentoEtiquetas(),
    async () => {
      if (++permisos === 2) throw new Error('Participación revocada')
    }
  )
  const rechazo = assert.rejects(tarea, /revocada/)
  const visor = await navegador.visor()
  await visor.onload()
  await rechazo
  assert.deepEqual(navegador.estado(), {
    impresiones: 0,
    eliminaciones: 1,
    liberadas: 0,
    ventanas: 0
  })
})

test('salir mientras carga la impresión vectorial integrada cancela la salida y no acepta un onload tardío', async (t) => {
  const navegador = navegadorIntegrado(t)
  const tarea = impresionTickets.imprimir(
    navegador.destino,
    documentoEtiquetas(),
    async () => {}
  )
  const rechazo = assert.rejects(tarea, { name: 'AbortError' })
  const visor = await navegador.visor(),
    cargar = visor.onload
  navegador.destino.cerrar()
  await rechazo
  await cargar()
  assert.deepEqual(navegador.estado(), {
    impresiones: 0,
    eliminaciones: 1,
    liberadas: 0,
    ventanas: 0
  })
})

test('el cierre síncrono del diálogo de impresión vectorial no pierde el evento afterprint', async (t) => {
  const navegador = navegadorIntegrado(t)
  const tarea = impresionTickets.imprimir(
    navegador.destino,
    documentoEtiquetas(),
    async () => {}
  )
  const visor = await navegador.visor()
  visor.contentWindow.print = () =>
    visor.contentWindow.dispatchEvent(new Event('afterprint'))
  await visor.onload()
  assert.equal((await tarea).dialogoCerrado, true)
  assert.equal(navegador.estado().eliminaciones, 1)
})
