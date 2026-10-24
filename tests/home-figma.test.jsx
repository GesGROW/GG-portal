import { describe, expect, it } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { Portal } from '../src/presentation/Portal.jsx'
import { crearPortal } from '../src/application/crearPortal.js'
import { fakePorts } from './support/fakePorts.js'
import { fakeReportes } from './support/fakeReportes.js'

function mount(configure = () => {}, path = '/') {
  const ports = fakePorts({ autenticado: true })
  const { archivos } = fakeReportes(ports)
  configure(ports)
  render(
    <MemoryRouter initialEntries={[path]}>
      <Portal portal={crearPortal(ports)} />
    </MemoryRouter>
  )
  return { ports, archivos }
}

describe('Home desde Figma con datos de la campaña', () => {
  it('usa el usuario, el primer puesto y el conteo de jaberos reales', async () => {
    mount()
    const top = await screen.findByRole('region', { name: 'Top cosechador' })
    expect(await within(top).findByText('Ana A')).toBeInTheDocument()
    expect(within(top).getByText('23')).toBeInTheDocument()
    expect(screen.queryByText('Bruno A')).not.toBeInTheDocument()
    expect(
      within(screen.getByRole('main')).getByText('Ana Gestión', { exact: true })
    ).toBeInTheDocument()
    expect(screen.getByText('Jaberos').nextElementSibling).toHaveTextContent('1')
    await waitFor(() =>
      expect(screen.getByText('Variedades').nextElementSibling).toHaveTextContent('2')
    )
    expect(
      screen.getByRole('link', { name: 'Ver ranking completo' })
    ).not.toHaveAttribute('href')
    expect(screen.getByRole('link', { name: 'Ver ranking completo' })).toHaveAttribute(
      'aria-disabled',
      'true'
    )
  })

  it('actualiza juntos producción, ranking y variedades sin mostrar cifras anteriores', async () => {
    const { ports } = mount()
    await screen.findByText('Ana A')
    const original = ports.reportesHarvest.consultar
    ports.reportesHarvest.consultar = async (...args) => {
      const result = await original(...args)
      if (result.tipo === 'DASHBOARD') {
        result.datos.resumen.total_jabas = 91
        result.datos.resumen.total_jaberos = 0
      }
      if (result.tipo === 'RANKING')
        result.datos.ranking[0] = {
          posicion: 1,
          cosechador_dni: '12345678',
          cosechador: 'Nueva persona',
          total_jabas: 80
        }
      if (result.tipo === 'LOTES')
        result.datos.produccion = [
          {
            lote_id: '1',
            lote_codigo: 'L1',
            variedad_id: 'V1',
            variedad: 'Roja',
            total_jabas: 41
          },
          {
            lote_id: '2',
            lote_codigo: 'L2',
            variedad_id: 'V1',
            variedad: 'Roja',
            total_jabas: 50
          }
        ]
      return result
    }
    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: 'Actualizar datos' }))
    await screen.findByText('Nueva persona')
    expect(screen.getByText('91')).toBeInTheDocument()
    expect(screen.queryByText('Ana A')).not.toBeInTheDocument()
    expect(screen.getByText('Jaberos').nextElementSibling).toHaveTextContent('0')
    await waitFor(() =>
      expect(screen.getByText('Variedades').nextElementSibling).toHaveTextContent('1')
    )
  })

  it('conserva la campaña elegida con los accesos a reportes inactivos', async () => {
    mount()
    await screen.findByText('Ana A')
    const user = userEvent.setup()
    await user.selectOptions(screen.getByLabelText('Campaña'), 'A-cerrada')
    await screen.findByText('43')
    const ranking = screen.getByRole('link', { name: 'Ver ranking completo' })
    expect(ranking).not.toHaveAttribute('href')
    await user.click(ranking)
    expect(screen.getByLabelText('Campaña')).toHaveValue('A-cerrada')
    expect(screen.getByText('43')).toBeInTheDocument()
    expect(screen.queryByText('Más acciones')).not.toBeInTheDocument()
  })

  it('una campaña ajena no llega a consultar producción, ranking ni lotes', async () => {
    const { ports } = mount(() => {}, '/?campania=B-camp')
    await screen.findByRole('alert')
    expect(ports.calls.some((c) => c[0] === 'consultarReporte')).toBe(false)
  })
})
