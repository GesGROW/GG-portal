import assert from 'node:assert/strict'
import test from 'node:test'
import { crearPortal } from '../src/application/crearPortal.js'
import { crearCosechaAdapter } from '../src/infrastructure/supabase/cosechaAdapter.js'
import { fakePorts } from './support/fakePorts.js'
import { fakeHarvestAdmin } from './support/fakeHarvestAdmin.js'
import { documentoEtiquetas } from './support/etiquetasTickets.js'

async function montar() {
  const ports = fakePorts({ autenticado: true, permisos: { A: ['harvest.manage'] } })
  fakeHarvestAdmin(ports)
  const documento = documentoEtiquetas([503, 2])
  const { filas, total, ...recibo } = documento
  const llamadas = []
  ports.harvestAdmin.generar = async () => structuredClone(recibo)
  ports.harvestAdmin.generacion = async () => structuredClone(recibo)
  ports.harvestAdmin.documentoImpresion = async (t, op, offset) => {
    llamadas.push([t, op, offset])
    return { ...recibo, total, filas: filas.slice(offset, offset + 500) }
  }
  const salidas = []
  ports.impresionTickets = {
    abrir: (opciones) => ({ opciones, cerrar() {} }),
    async imprimir(destino, d, autorizar) {
      await autorizar()
      salidas.push(d)
      return { descargado: true }
    }
  }
  const app = crearPortal(ports)
  await app.restaurar()
  return { app, ports, documento, llamadas, salidas }
}

test('documento paginado conserva orden, cultivo y metadatos del recibo y devuelve salida real', async () => {
  const { app, documento, llamadas, salidas } = await montar()
  await app.cosecha.recuperarGeneracion(documento.operacionId)
  const destino = app.cosecha.abrirImpresion({ modo: 'tspl' })
  assert.equal(destino.opciones.modo, 'tspl')
  assert.deepEqual(
    await app.cosecha.imprimirGeneracion(documento.operacionId, destino),
    { descargado: true }
  )
  assert.deepEqual(
    llamadas.map((c) => c[2]),
    [0, 500]
  )
  assert.deepEqual(salidas[0].filas, documento.filas)
  assert.equal(salidas[0].fecha, '20261008')
  assert.equal(salidas[0].abreviaturaCultivo, 'MAN')
})

test('metadatos cambiados, páginas incompletas y numeración alterada bloquean impresión', async () => {
  for (const mutar of [
    (p) => ({ ...p, fecha: '20261009' }),
    (p) => ({ ...p, filas: [] }),
    (p) => ({ ...p, abreviaturaCultivo: 'ARA' }),
    (p) => ({ ...p, filas: p.filas.map((t, i) => (i ? t : { ...t, numeroLote: 2 })) })
  ]) {
    const { app, ports, documento, salidas } = await montar()
    await app.cosecha.recuperarGeneracion(documento.operacionId)
    const anterior = ports.harvestAdmin.documentoImpresion
    ports.harvestAdmin.documentoImpresion = async (...a) => mutar(await anterior(...a))
    await assert.rejects(
      app.cosecha.imprimirGeneracion(documento.operacionId, {}),
      /incompleta|incompatibles|originales/
    )
    assert.equal(salidas.length, 0)
  }
})

test('recuperar generación exige permiso de gestión y comprueba tenant', async () => {
  const { app, ports, documento } = await montar()
  ports.harvestAdmin.generacion = async () => ({ ...documento, tenantId: 'B' })
  await assert.rejects(
    app.cosecha.recuperarGeneracion(documento.operacionId),
    /empresa/
  )
  ports.permisos.A = ['harvest.view']
  await assert.rejects(
    app.cosecha.recuperarGeneracion(documento.operacionId),
    /permiso/i
  )
})

test('participación revocada mientras se prepara la salida impide entregar o enviar tickets', async () => {
  const { app, ports, documento, salidas } = await montar()
  await app.cosecha.recuperarGeneracion(documento.operacionId)
  const imprimir = ports.impresionTickets.imprimir
  ports.impresionTickets.imprimir = async (...args) => {
    ports.harvestAdmin.generacion = async () => {
      throw new Error('Participación revocada en el cultivo')
    }
    return imprimir(...args)
  }
  await assert.rejects(
    app.cosecha.imprimirGeneracion(documento.operacionId, {}),
    /Participación revocada/
  )
  assert.equal(salidas.length, 0)
})

test('adaptador usa exclusivamente RPC autorizados para recibo y documento', async () => {
  const calls = []
  const adapter = crearCosechaAdapter(async (...a) => calls.push(a))
  await adapter.generacion('tenant', 'op')
  await adapter.documentoImpresion('tenant', 'op', 500)
  assert.deepEqual(calls, [
    ['harvest_admin_generacion', { p_tenant_id: 'tenant', p_operacion_id: 'op' }],
    [
      'harvest_admin_documento_impresion',
      { p_tenant_id: 'tenant', p_operacion_id: 'op', p_offset: 500 }
    ]
  ])
})
