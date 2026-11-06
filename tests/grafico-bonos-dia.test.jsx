import { describe, it, expect } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { GraficoBonosDia } from '../src/presentation/GraficoBonosDia.jsx'

const datos = {
  desde: '2026-11-01', hasta: '2026-11-06', detalle: [
    { trabajadorId:'a', nombre:'Ana Rojas', dni:'12345678', fecha:'2026-11-06',jabas:32,umbral:30,monto:2,adicionales:2,bono:4,habilitado:true },
    { trabajadorId:'b', nombre:'Beatriz Pérez', dni:'87654321',fecha:'2026-11-06',jabas:25,umbral:30,monto:2,adicionales:0,bono:0,habilitado:true },
    { trabajadorId:'a',nombre:'Ana Rojas',dni:'12345678',fecha:'2026-11-05',jabas:31,umbral:25,monto:3,adicionales:6,bono:18,habilitado:true }
  ]
}
describe('Gráfico diario de bonos',()=>{
  it('muestra solo el día seleccionado y colorea únicamente las jabas adicionales',()=>{
    render(<GraficoBonosDia datos={datos} />)
    const ana=screen.getByRole('button',{name:/Ana Rojas.*32 jabas, 2 adicionales/})
    const bea=screen.getByRole('button',{name:/Beatriz Pérez.*25 jabas/})
    expect(ana.querySelectorAll('.bonos-dia-exceso')).toHaveLength(1)
    expect(bea.querySelectorAll('.bonos-dia-exceso')).toHaveLength(0)
    expect(screen.getByLabelText('Umbral diario: 30 jabas')).toBeInTheDocument()
    expect(screen.queryByRole('button',{name:/31 jabas/})).not.toBeInTheDocument()
    expect(screen.getByLabelText('Día del gráfico de bonos')).toHaveValue('2026-11-06')
  })
  it('cambiar de día recupera su umbral y bono históricos sin sumar períodos',async()=>{
    render(<GraficoBonosDia datos={datos} />)
    const input=screen.getByLabelText('Día del gráfico de bonos')
    fireEvent.change(input,{target:{value:'2026-11-05'}})
    expect(await screen.findByLabelText('Umbral diario: 25 jabas')).toBeInTheDocument()
    expect(screen.getByRole('button',{name:/31 jabas, 6 adicionales.*18/})).toBeInTheDocument()
    expect(screen.queryByRole('button',{name:/Beatriz/})).not.toBeInTheDocument()
  })
  it('permite consultar cada cosechador con teclado',async()=>{
    const user=userEvent.setup()
    render(<GraficoBonosDia datos={datos} />)
    const bea=screen.getByRole('button',{name:/Beatriz Pérez/})
    bea.focus(); await user.keyboard('{Enter}')
    expect(bea).toHaveAttribute('aria-pressed','true')
    const grafico=screen.getByRole('region',{name:'Jabas por cosechador del día'})
    expect(within(grafico).getByText('Bono: S/ 0.00',{exact:false})).toBeInTheDocument()
  })
  it('sin bono no inventa un umbral ni pinta excedentes; sin registros muestra vacío',()=>{
    const {rerender}=render(<GraficoBonosDia datos={{...datos,detalle:datos.detalle.map(r=>({...r,habilitado:false,adicionales:0,bono:0}))}} />)
    expect(screen.getByText('Bono no habilitado ese día')).toBeInTheDocument()
    expect(screen.queryByLabelText(/Umbral diario:/)).not.toBeInTheDocument()
    rerender(<GraficoBonosDia datos={{...datos,detalle:[]}} />)
    expect(screen.getByText('No hay registros de cosecha el 06/11/2026.')).toBeInTheDocument()
  })
})
