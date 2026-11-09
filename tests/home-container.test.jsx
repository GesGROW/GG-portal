import { it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { DashboardData } from '../src/presentation/DashboardSummary.jsx'

it('cambia producción y top entre general, jabas y jarras con una selección compartida', async () => {
  const inicio=vi.fn(async f=>{
    const total={GENERAL:358,JABA:0,JARRA:358}[f.recipiente]
    return {datos:{ok:true,unidad:{GENERAL:'PAQUETES',JABA:'JABAS',JARRA:'JARRAS'}[f.recipiente],
      resumen:{total_jabas:total},hoy:{total_jabas:0},ranking:total?[{cosechador:'Ana',cosechador_dni:'12345678',total_jabas:12}]:[]}}
  })
  const servicio={inicio,consultar:async()=>({datos:{produccion:[]}})}
  render(<MemoryRouter><DashboardData servicio={servicio} campania={{id:'C'}} embedded controls={()=>null} reportesCampania puedeDetalles /></MemoryRouter>)
  const user=userEvent.setup()
  await screen.findByText('Total paquetes')
  await user.click(screen.getByRole('button',{name:'Cambiar recipiente de Producción'}))
  expect(await screen.findByText('Total jabas')).toBeInTheDocument()
  expect(await screen.findByText('Nadie ha cosechado aún')).toBeInTheDocument()
  await user.click(screen.getByRole('button',{name:'Cambiar recipiente de Producción'}))
  expect(await screen.findByText('Total jarras')).toBeInTheDocument()
  expect(await screen.findByText('Jarras',{exact:true})).toBeInTheDocument()
  await waitFor(()=>expect(inicio).toHaveBeenCalledWith(expect.objectContaining({tipo:'RANKING',recipiente:'JARRA'})))
  await user.click(screen.getByRole('button',{name:'Cambiar recipiente de Top cosechador'}))
  expect(await screen.findByText('Total paquetes')).toBeInTheDocument()
})
