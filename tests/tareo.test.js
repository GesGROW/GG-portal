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
test('bonos jueves a miercoles, total exacto, dias vacios y rechazo de duplicados', () => {
  const r = { ...fila, semanaInicio: '2026-11-05', periodo: '202611-45',
    dias: [{ fecha: '2026-11-05', bono: 14 }, { fecha: '2026-11-06', bono: 0.3 }, { fecha: '2026-11-11', bono: 5.5 }], totalSemanal: 19.8 }
  const tabla = tablaTareo({ filas: [r], totalBono: 19.8 })
  assert.equal(tabla[0].length, 17)
  assert.deepEqual(tabla[1].slice(9), [14, 0.3, 0, 0, 0, 0, 5.5, 19.8])
  assert.equal(tabla[1][1], '000123')
  assert.equal(tabla[1][2], fila.nombre.toLocaleUpperCase('es-PE'))
  const zip = unzipSync(crearTareoXlsx(tabla)), sheet = strFromU8(zip['xl/worksheets/sheet1.xml'])
  assert.match(sheet, /A1:Q2/)
  assert.match(sheet, /<c r="Q2" s="2"><v>19.8<\/v>/)
  assert.doesNotMatch(sheet, /<f>/)
  assert.throws(() => tablaTareo({filas:[r,r],totalBono:39.6}), /duplicada/)
  assert.throws(() => tablaTareo({filas:[{...r,totalSemanal:20}],totalBono:20}), /total semanal/)
  assert.throws(() => tablaTareo({filas:[r],totalBono:20}), /total del reporte/)
  assert.throws(() => tablaTareo({filas:[{...r,dias:[{fecha:'2026-11-12',bono:19.8}]}],totalBono:19.8}), /diario/)
  const siguiente={...r,semanaInicio:'2026-11-12',periodo:'202611-46',dias:[{fecha:'2026-11-12',bono:2}],totalSemanal:2}
  assert.equal(tablaTareo({filas:[r,siguiente],totalBono:21.8}).length,3)
})
test('exporta sólo snapshots de tareo propios y vuelve a comprobar autorización', async () => {
  const ports = fakePorts({ autenticado: true })
  fakeHarvestAdmin(ports); fakeCultivosCosecha(ports, { propio: true }); fakeReportes(ports)
  ports.reportesHarvest.tareoRango = async (t, f) => ({ tenantId: t, campaniaId: f.campaniaId, tipo: 'TAREO', datos: { desde: f.desde, hasta: f.hasta, totalBono:14, filas: [{ ...fila, periodo: '202611-45', semanaInicio:'2026-11-05', dias:[{fecha:'2026-11-06',bono:14}], totalSemanal:14 }] } })
  const original = ports.reportesHarvest.tareoRango
  let consulta
  ports.reportesHarvest.tareoRango = async (t, f) => { consulta = f; return original(t, f) }
  let archivo
  ports.exportacion.serializarTareo = async tabla => tabla
  ports.exportacion.guardar = async d => { archivo = d }
  const app = crearPortal(ports); await app.restaurar()
  await app.reportes.descargarTareo({ campaniaId: 'A-camp', desde: '2026-11-05', hasta: '2026-11-06' })
  assert.equal(consulta.desde, '2026-11-05')
  assert.equal(consulta.hasta, '2026-11-11')
  assert.equal(archivo.nombre, 'bonos-semanales-2026-11-05-2026-11-11.xlsx')
  assert.deepEqual(archivo.contenido[1].slice(9), [0,14,0,0,0,0,0,14])
  assert.equal(archivo.contenido[1][1], '000123')
  ports.reportesHarvest.tareoRango = async () => ({ tenantId: 'B' })
  await assert.rejects(app.reportes.descargarTareo({ campaniaId: 'A-camp', desde: '2026-11-05', hasta: '2026-11-06' }), /inválida/)
  ports.permisos.A = []
  await assert.rejects(app.reportes.descargarTareo({ campaniaId: 'A-camp', desde: '2026-11-05', hasta: '2026-11-06' }))
})
