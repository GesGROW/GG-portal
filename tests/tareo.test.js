import test from 'node:test'
import assert from 'node:assert/strict'
import { unzipSync, strFromU8 } from 'fflate'
import { semanaTareo, tablaTareo, columnasTareo } from '../src/application/tareo.js'
import { crearTareoXlsx } from '../src/infrastructure/tareoXlsx.js'
import { crearPortal } from '../src/application/crearPortal.js'
import { fakePorts } from './support/fakePorts.js'
import { fakeHarvestAdmin } from './support/fakeHarvestAdmin.js'
import { fakeCultivosCosecha } from './support/fakeCultivosCosecha.js'
import { fakeReportes } from './support/fakeReportes.js'

const fila = { trabajadorId: 'p1', codigoTrabajador: '000123', nombre: 'Pérez & Díaz Ana', actividad: '004',
  labor: '004041', consumidor: 'TR0110006', loteId: 'l1', variedadId: 'v1' }
test('semana jueves–miércoles, días límite y período sugerido editable', () => {
  assert.deepEqual(semanaTareo('2026-11-06'), { desde: '2026-11-05', hasta: '2026-11-11', periodo: '202611-45' })
  assert.equal(semanaTareo('2026-11-11').desde, '2026-11-05')
  assert.equal(semanaTareo('2026-11-11').periodo, '202611-45')
  assert.equal(semanaTareo('2026-11-12').desde, '2026-11-12')
  assert.equal(semanaTareo('2027-01-01').desde, '2026-12-31')
  assert.throws(() => semanaTareo('2026-02-30'))
})
test('xlsx real conserva códigos, 16 columnas, asistencia N y siete ceros numéricos sin bonos', () => {
  const tabla = tablaTareo({ filas: [fila] }, '202611-45')
  assert.deepEqual(tabla[0], columnasTareo)
  assert.deepEqual(tabla[1].slice(8), ['N', 0, 0, 0, 0, 0, 0, 0])
  assert.equal(tabla[1][1], '000123')
  assert.equal(tablaTareo({ filas: [fila, { ...fila, loteId: 'l2' }] }, '202611-45').length, 2)
  const zip = unzipSync(crearTareoXlsx(tabla)), sheet = strFromU8(zip['xl/worksheets/sheet1.xml'])
  assert.match(sheet, /<c r="B2" t="inlineStr"><is><t xml:space="preserve">000123/)
  assert.match(sheet, /Pérez &amp; Díaz Ana/)
  assert.equal((sheet.match(/<v>0<\/v>/g) ?? []).length, 7)
  assert.doesNotMatch(sheet, /<f>|bono/i)
  assert.throws(() => tablaTareo({ filas: [{ ...fila, consumidor: '' }] }, '202611-45'), /Completa/)
  assert.throws(() => tablaTareo({ filas: [] }, '202611-45'), /No hay/)
  assert.throws(() => tablaTareo({ filas: [fila] }, '202613-45'), /período/)
})
test('exporta sólo snapshots de tareo propios y vuelve a comprobar autorización', async () => {
  const ports = fakePorts({ autenticado: true })
  fakeHarvestAdmin(ports); fakeCultivosCosecha(ports, { propio: true }); fakeReportes(ports)
  ports.reportesHarvest.tareo = async (t, f) => ({ tenantId: t, campaniaId: f.campaniaId, tipo: 'TAREO', datos: { desde: f.desde, filas: [fila] } })
  let archivo
  ports.exportacion.serializarTareo = async tabla => tabla
  ports.exportacion.guardar = async d => { archivo = d }
  const app = crearPortal(ports); await app.restaurar()
  const r = await app.reportes.tareo({ campaniaId: 'A-camp', fecha: '2026-11-06' })
  await app.reportes.exportarTareo(r, '202611-45')
  assert.equal(archivo.contenido[1][1], '000123')
  await assert.rejects(app.reportes.exportarTareo(structuredClone(r), '202611-45'))
  ports.permisos.A = []
  await assert.rejects(app.reportes.exportarTareo(r, '202611-45'))
})
