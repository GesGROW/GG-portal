import { describe, it, expect } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { BonoConfiguracion } from '../src/presentation/BonoConfiguracion.jsx'
import { BonosCampania } from '../src/presentation/BonosCampania.jsx'
import { crearPortal } from '../src/application/crearPortal.js'
import { fakePorts } from './support/fakePorts.js'
import { fakeHarvestAdmin } from './support/fakeHarvestAdmin.js'
import { fakeCultivosCosecha } from './support/fakeCultivosCosecha.js'
import { fakeReportes } from './support/fakeReportes.js'
import { fakeBonos } from './support/fakeBonos.js'
async function preparar() {
  const ports=fakePorts({autenticado:true,permisos:{A:['harvest.manage','harvest.view','reports.view']}})
  fakeHarvestAdmin(ports);fakeCultivosCosecha(ports,{propio:true});fakeReportes(ports)
  const bonos=fakeBonos(ports), app=crearPortal(ports)
  await app.restaurar()
  return {ports,app,bonos,user:userEvent.setup()}
}
describe('bonos de campaña',()=>{
  it('muestra 0 kg en bonos sin lecturas',async()=>{
    const {app}=await preparar()
    const r=await app.reportes.bonos({campaniaId:'A-camp'})
    const servicio={bonos:async()=>({...r,datos:{...r.datos,detalle:[],resumen:[],totalKgEstimados:null,totalBono:0,totalAdicionales:0}})}
    render(<MemoryRouter><BonosCampania servicio={servicio} campania={{id:'A-camp'}} /></MemoryRouter>)
    const titulo=await screen.findByRole('heading',{name:'Kg estimados',exact:true})
    expect(within(titulo.closest('article')).getByText('0')).toBeInTheDocument()
  })
  it('configura el bono de jarras sin habilitar el de jabas',async()=>{
    const {app,ports,user}=await preparar()
    render(<BonoConfiguracion servicio={app.cultivosCosecha} campania={{id:'A-camp',estado:'ACTIVA'}} />)
    await user.click(await screen.findByRole('checkbox',{name:'Habilitar bono de jarras'}))
    const umbral=screen.getByLabelText('Umbral diario de jarras')
    await user.clear(umbral); await user.type(umbral,'40')
    const monto=screen.getByLabelText('Monto por jarra adicional (S/)')
    await user.clear(monto); await user.type(monto,'1.5')
    await user.click(screen.getByRole('button',{name:'Guardar bono'}))
    await screen.findByRole('table',{name:'Historial del bono'})
    expect(ports.calls.find(c=>c[0]==='guardarBono')[3]).toMatchObject({habilitado:false,jarrasHabilitado:true,jarrasUmbral:40,jarrasMonto:1.5})
  })
  it('pagina las dos tablas de diez en diez con controles independientes',async()=>{
    const {app,user}=await preparar()
    const original=await app.reportes.bonos({campaniaId:'A-camp'})
    const filas=Array.from({length:21},(_,i)=>({...original.datos.detalle[0],trabajadorId:`persona-${i}`,nombre:`Persona ${i+1}`}))
    const servicio={...app.reportes,bonos:async()=>({...original,datos:{...original.datos,resumen:filas,detalle:filas}})}
    render(<MemoryRouter><BonosCampania servicio={servicio} campania={{id:'A-camp'}} /></MemoryRouter>)
    const resumen=await screen.findByRole('table',{name:'Totales de bonos por cosechador'})
    expect(within(resumen).getAllByRole('row')).toHaveLength(11)
    const nav=screen.getByRole('navigation',{name:'Paginación: Totales de bonos por cosechador'})
    await user.click(within(nav).getByRole('button',{name:'Siguiente',exact:true}))
    expect(within(resumen).getByText('Persona 11')).toBeInTheDocument()
    expect(within(screen.getByRole('table',{name:'Detalle diario de bonos'})).getByText('Persona 1')).toBeInTheDocument()
    const detalle=screen.getByRole('navigation',{name:'Paginación: Detalle diario de bonos'})
    await user.click(within(detalle).getByRole('button',{name:'Página 3',exact:true}))
    expect(within(screen.getByRole('table',{name:'Detalle diario de bonos'})).getAllByRole('row')).toHaveLength(2)
  })
  it('guarda umbral y monto sin fecha de vigencia editable',async()=>{
    const {app,ports,user}=await preparar()
    render(<BonoConfiguracion servicio={app.cultivosCosecha} campania={{id:'A-camp',estado:'ACTIVA'}} />)
    await user.click(await screen.findByRole('checkbox',{name:'Habilitar bono'}))
    const umbral=screen.getByLabelText('Umbral diario de jabas')
    await user.clear(umbral);await user.type(umbral,'35')
    await user.click(screen.getByRole('button',{name:'Guardar bono'}))
    expect(await screen.findByRole('table', { name: 'Historial del bono' })).toBeVisible()
    expect(ports.calls.find(c=>c[0]==='guardarBono')[3]).toMatchObject({umbral:35,monto:2,habilitado:true})
    expect(screen.queryByLabelText('Aplicar desde')).not.toBeInTheDocument()
  })
  it('bloquea todos los controles del bono después de una apertura',async()=>{
    const {app,bonos}=await preparar();bonos.bloquear()
    render(<BonoConfiguracion servicio={app.cultivosCosecha} campania={{id:'A-camp',estado:'ACTIVA'}} />)
    expect(await screen.findByRole('checkbox',{name:'Habilitar bono'})).toBeDisabled()
    expect(screen.getByLabelText('Umbral diario de jabas')).toBeDisabled()
    expect(screen.getByRole('button',{name:'Guardar bono'})).toBeDisabled()
    expect(screen.getByText(/bono está bloqueado/)).toBeInTheDocument()
  })
  it('muestra totales diarios y filtra por persona sin barra de exportación',async()=>{
    const {app,user}=await preparar()
    render(<MemoryRouter><BonosCampania servicio={app.reportes} campania={{id:'A-camp'}} /></MemoryRouter>)
    const tabla=await screen.findByRole('table',{name:'Detalle diario de bonos'})
    expect(within(tabla).getAllByRole('row')).toHaveLength(4)
    await screen.findByRole('option', {name:'Carlos Quispe · 87654321'})
    await user.selectOptions(screen.getByRole('combobox',{name:'Cosechador del reporte'}),'p2')
    const filtrada=await screen.findByRole('table',{name:'Detalle diario de bonos'})
    expect(within(filtrada).getAllByRole('row')).toHaveLength(2)
    expect(screen.queryByRole('button',{name:/Exportar CSV/})).not.toBeInTheDocument()
    expect(screen.queryByText(/Bonos generados por día/)).not.toBeInTheDocument()
  })
})
