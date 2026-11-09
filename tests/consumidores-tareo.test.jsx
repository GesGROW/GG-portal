import { it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ConsumidoresCampania } from '../src/presentation/ConsumidoresCampania.jsx'

it('muestra la correspondencia interna ya cargada y permite corregirla en configuración', async () => {
  const user=userEvent.setup()
  let datos={ tenantId:'A',campaniaId:'c1',revision:'1',catalogo:[{codigo:'TR011005',nombre:'Sekoya A'},{codigo:'TR011007',nombre:'Sekoya B'}],
    filas:[{loteId:'l1',variedadId:'v1',lote:'Lote 02',variedad:'Sekoya',consumidor:'TR011005'}] }
  const servicio={consumidoresCampania:vi.fn(async()=>datos),guardarConsumidoresCampania:vi.fn(async(_,d)=>{
    datos={...datos,revision:'2',filas:datos.filas.map(f=>({...f,consumidor:d.filas[0].consumidor}))}
  })}
  render(<ConsumidoresCampania servicio={servicio} campaniaId="c1" />)
  expect(await screen.findByLabelText('Lote 02 · Sekoya')).toHaveValue('TR011005')
  await user.selectOptions(screen.getByLabelText('Lote 02 · Sekoya'),'TR011007')
  await user.click(screen.getByRole('button',{name:'Guardar consumidores'}))
  expect(servicio.guardarConsumidoresCampania).toHaveBeenCalledExactlyOnceWith('c1',{revision:'1',filas:[{loteId:'l1',variedadId:'v1',consumidor:'TR011007'}]})
})
