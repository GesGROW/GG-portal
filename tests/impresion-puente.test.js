import assert from 'node:assert/strict'
import test from 'node:test'
import { createPrintService } from '../scripts/impresion-tsc/server.mjs'
import { impresionTickets } from '../src/infrastructure/impresionTickets.js'
import { documentoEtiquetas } from './support/etiquetasTickets.js'

const opciones = { modo: 'directa', impresora: 'TSC TTP-247', token: 'x'.repeat(43) }

test('TSPL del portal llega al servicio real en modo seco; respuesta perdida conserva UUID y reimpresión confirmada lo renueva', async (t) => {
  const servidor = createPrintService({
    config: {
      port: 18191,
      origins: ['https://portal.test'],
      printer: opciones.impresora,
      token: opciones.token,
      dryRun: true
    },
    spooler: {
      print() {
        throw new Error('Una prueba seca nunca debe imprimir')
      }
    }
  })
  await new Promise((resolve) => servidor.listen(0, '127.0.0.1', resolve))
  const original = globalThis.fetch
  const solicitudes = []
  let perderRespuesta = true
  t.mock.method(globalThis, 'fetch', async (url, solicitud) => {
    assert.equal(url, 'http://127.0.0.1:18191/imprimir')
    solicitudes.push(JSON.parse(solicitud.body))
    const respuesta = await original(
      `http://127.0.0.1:${servidor.address().port}/imprimir`,
      {
        ...solicitud,
        headers: { ...solicitud.headers, Origin: 'https://portal.test' }
      }
    )
    if (perderRespuesta) {
      perderRespuesta = false
      await respuesta.text()
      throw new TypeError('Se perdió la respuesta después de aceptar el trabajo')
    }
    return respuesta
  })
  try {
    const datos = documentoEtiquetas()
    await assert.rejects(
      impresionTickets.imprimir(
        impresionTickets.abrir(opciones),
        datos,
        async () => {}
      ),
      /cola de Windows/
    )
    const resultado = await impresionTickets.imprimir(
      impresionTickets.abrir(opciones),
      datos,
      async () => {}
    )
    assert.equal(resultado.simulado, true)
    assert.equal(resultado.estado, 'simulado')
    assert.equal(resultado.filas, 7)
    assert.equal(resultado.bytesEscritos, 0)
    assert.equal(solicitudes[0].trabajoId, solicitudes[1].trabajoId)
    await impresionTickets.imprimir(
      impresionTickets.abrir(opciones),
      datos,
      async () => {}
    )
    assert.notEqual(solicitudes[1].trabajoId, solicitudes[2].trabajoId)
    assert.equal(solicitudes[0].tspl, solicitudes[2].tspl)
  } finally {
    servidor.closeAllConnections()
    await new Promise((resolve) => servidor.close(resolve))
  }
})

test('cancelar o revocar antes del envío no llega al servicio', async (t) => {
  let llamadas = 0
  t.mock.method(globalThis, 'fetch', async () => {
    llamadas++
    throw new Error('No enviar')
  })
  const destino = impresionTickets.abrir(opciones)
  await assert.rejects(
    impresionTickets.imprimir(destino, documentoEtiquetas(), async () =>
      destino.cerrar()
    ),
    /cerró/
  )
  await assert.rejects(
    impresionTickets.imprimir(
      impresionTickets.abrir(opciones),
      documentoEtiquetas(),
      async () => {
        throw new Error('Permiso revocado')
      }
    ),
    /revocado/
  )
  assert.equal(llamadas, 0)
  assert.throws(() => impresionTickets.abrir({ modo: 'directa' }), /token/)
})

test('una respuesta HTTP exitosa de otro trabajo no acredita envío', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => ({
    ok: true,
    json: async () => ({
      enviado: true,
      trabajoId: 'otro',
      impresora: opciones.impresora,
      estado: 'encolado',
      simulado: false
    })
  }))
  const datos = { ...documentoEtiquetas(), operacionId: 'op-incompatible' }
  await assert.rejects(
    impresionTickets.imprimir(impresionTickets.abrir(opciones), datos, async () => {}),
    /confirmación/
  )
})
