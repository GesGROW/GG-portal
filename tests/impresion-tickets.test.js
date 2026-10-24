import assert from 'node:assert/strict'
import test from 'node:test'
import { crearPortal } from '../src/application/crearPortal.js'
import { fakePorts } from './support/fakePorts.js'
import { fakeHarvestAdmin } from './support/fakeHarvestAdmin.js'
async function montar(options = {}) {
  const ports = fakePorts({
    autenticado: true,
    permisos: { A: ['harvest.manage'], B: ['harvest.manage'] },
    ...options
  })
  const datos = fakeHarvestAdmin(ports),
    impresiones = []
  ports.impresionTickets = {
    abrir: () => ({ cerrar() {} }),
    async imprimir(destino, d, autorizar) {
      await autorizar()
      impresiones.push(d)
    }
  }
  const app = crearPortal(ports)
  await app.restaurar()
  if (options.empresas?.length > 1) await app.seleccionarEmpresa('A')
  return { app, ports, datos, impresiones }
}
const solicitud = {
  operacionId: 'op-print',
  campaniaId: 'A-camp',
  cantidadTickets: 103,
  tamanioLote: 51
}
test('imprime exactamente los tickets persistidos de la generación, paginados y agrupados por lote', async () => {
  const { app, ports, impresiones } = await montar()
  const r = await app.cosecha.generar(solicitud)
  await app.cosecha.imprimirGeneracion(r.operacionId, app.cosecha.abrirImpresion())
  assert.deepEqual(
    impresiones[0].lotes.map((l) => l.codigos.length),
    [51, 51, 1]
  )
  assert.equal(new Set(impresiones[0].lotes.flatMap((l) => l.codigos)).size, 103)
  assert.ok(
    impresiones[0].lotes
      .flatMap((l) => l.codigos)
      .every((c) => c.startsWith('GG-op-print-'))
  )
  assert.deepEqual(
    ports.calls.filter((c) => c[0] === 'listarHarvest').map((c) => c[3].offset),
    [0, 50, 0, 50, 0]
  )
  assert.equal(impresiones[0].empresa, 'Empresa A')
})
test('recibo desconocido y respuesta de tickets incompleta o de otro lote impiden imprimir', async () => {
  const { app, ports, impresiones } = await montar()
  await assert.rejects(
    app.cosecha.imprimirGeneracion('inventada', {}),
    /Primero confirma/
  )
  await app.cosecha.generar(solicitud)
  ports.harvestAdmin.listar = async () => ({ filas: [], total: 51 })
  await assert.rejects(app.cosecha.imprimirGeneracion('op-print', {}), /incompleta/)
  ports.harvestAdmin.listar = async () => ({
    filas: [{ codigo: 'extra', lote: { id: 'otro', campaniaId: 'A-camp' } }],
    total: 51
  })
  await assert.rejects(app.cosecha.imprimirGeneracion('op-print', {}), /incompatibles/)
  assert.equal(impresiones.length, 0)
})
test('reintentar la impresión usa el mismo recibo sin crear tickets nuevos', async () => {
  const { app, ports, impresiones } = await montar()
  await app.cosecha.generar(solicitud)
  await app.cosecha.imprimirGeneracion('op-print', {})
  await app.cosecha.imprimirGeneracion('op-print', {})
  assert.deepEqual(impresiones[0], impresiones[1])
  assert.equal(ports.calls.filter((c) => c[0] === 'generarHarvest').length, 1)
})
test('cambiar empresa o revocar permisos antes de abrir impresión descarta el documento', async () => {
  const { app, ports, impresiones } = await montar({ empresas: ['A', 'B'] })
  await app.cosecha.generar(solicitud)
  let listo, liberar
  const iniciada = new Promise((r) => {
    listo = r
  })
  const anterior = ports.harvestAdmin.listar
  ports.harvestAdmin.listar = async (...args) => {
    const r = await anterior(...args)
    listo()
    await new Promise((r) => {
      liberar = r
    })
    return r
  }
  const tarea = app.cosecha.imprimirGeneracion('op-print', {})
  const rechazo = assert.rejects(tarea, { name: 'SolicitudObsoleta' })
  await iniciada
  await app.seleccionarEmpresa('B')
  liberar()
  await rechazo
  assert.equal(impresiones.length, 0)
})
test('la autorización se verifica también después de preparar los QR', async () => {
  const { app, ports, impresiones } = await montar()
  ports.impresionTickets.imprimir = async (destino, d, autorizar) => {
    ports.permisos.A = []
    await autorizar()
    impresiones.push(d)
  }
  await app.cosecha.generar(solicitud)
  await assert.rejects(app.cosecha.imprimirGeneracion('op-print', {}), /permiso/)
  assert.equal(impresiones.length, 0)
})
