import assert from 'node:assert/strict'
import test from 'node:test'
import { crearPortal } from '../src/application/crearPortal.js'
import { evaluarRuta } from '../src/application/rutas.js'
import { fakePorts } from './support/fakePorts.js'
import { fakeHarvestAdmin } from './support/fakeHarvestAdmin.js'
import { fakeCultivosCosecha } from './support/fakeCultivosCosecha.js'
import { fakeReportes } from './support/fakeReportes.js'
import { fakeBonos } from './support/fakeBonos.js'
async function preparar() {
  const ports=fakePorts({autenticado:true})
  fakeHarvestAdmin(ports);fakeCultivosCosecha(ports,{propio:true});fakeReportes(ports)
  fakeBonos(ports);const app=crearPortal(ports);await app.restaurar()
  return {app,ports}
}
test('exporta el snapshot autorizado con detalle y evita exportar datos fabricados',async()=>{
  const {app,ports}=await preparar(), archivos=[]
  ports.exportacion.guardar=async d=>archivos.push(d)
  const r=await app.reportes.bonos({campaniaId:'A-camp',tenantId:'B',actor:'falso'})
  assert.equal(Object.isFrozen(r.datos.detalle),true)
  assert.deepEqual(ports.calls.find(c=>c[0]==='bonos').slice(1),['A',{campaniaId:'A-camp',desde:null,hasta:null,trabajadorId:null}])
  await app.reportes.exportar(r)
  assert.match(archivos[0].contenido,/Bono generado \(PEN\)/)
  assert.match(archivos[0].contenido,/Gianella Sotil/)
  await assert.rejects(app.reportes.exportar(structuredClone(r)))
  ports.permisos.A=[];await assert.rejects(app.reportes.bonos({campaniaId:'A-camp'}))
})
test('rechaza fechas y respuestas de otra campaña; protege la ruta con reports.view',async()=>{
  const {app,ports}=await preparar()
  await assert.rejects(app.reportes.bonos({campaniaId:'A-camp',desde:'2026-02-30'}))
  ports.reportesHarvest.bonos=async()=>({tenantId:'B'})
  await assert.rejects(app.reportes.bonos({campaniaId:'A-camp'}),/inválida/)
  assert.equal(evaluarRuta('/cosecha/bonos',{permite:p=>p==='harvest.manage'},['HARVEST']).estado,'denegada')
  assert.equal(evaluarRuta('/cosecha/bonos',{permite:p=>['harvest.manage','reports.view'].includes(p)},['HARVEST']).estado,'permitida')
})
