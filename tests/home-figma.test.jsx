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
  it('muestra trabajadores, lotes y variedades configurados antes de la primera lectura', async () => {
    mount((ports) => {
      const consultar = ports.reportesHarvest.consultar
      ports.reportesHarvest.consultar = async (...args) => {
        const result = await consultar(...args)
        if (result.tipo === 'DASHBOARD') {
          result.datos.hoy.total_jabas = 0
          Object.assign(result.datos.resumen, {
            total_jabas: 0,
            dias_con_produccion: 0,
            total_cosechadores: 0,
            total_jaberos: 0,
            total_lotes: 0,
            total_cosechadores_registrados: 2,
            total_jaberos_registrados: 1,
            total_lotes_configurados: 2,
            total_variedades_configuradas: 3
          })
        }
        if (result.tipo === 'RANKING') result.datos.ranking = []
        if (result.tipo === 'LOTES') result.datos.produccion = []
        return result
      }
    })
    await waitFor(() => {
      for (const [label, value] of [
        ['Cosechadores', '2'],
        ['Jaberos', '1'],
        ['Lotes operativos', '2'],
        ['Variedades', '3'],
        ['Días en producción', '0']
      ]) {
        expect(screen.getByText(label).nextElementSibling).toHaveTextContent(value)
      }
    })
    const produccion = screen.getByRole('region', { name: 'Producción' })
    expect(within(produccion).getAllByText('0')).toHaveLength(2)
  })

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
    expect(screen.getByRole('link', { name: 'Ver ranking completo' })).toHaveAttribute(
      'href',
      '/reportes/ranking?campania=A-camp'
    )
    expect(
      screen.getByRole('link', { name: 'Ver ranking completo' })
    ).not.toHaveAttribute('aria-disabled')
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

  it('conserva la campaña elegida al abrir el ranking', async () => {
    mount()
    await screen.findByText('Ana A')
    const user = userEvent.setup()
    await user.selectOptions(screen.getByLabelText('Campaña'), 'A-cerrada')
    await screen.findByText('43')
    const ranking = screen.getByRole('link', { name: 'Ver ranking completo' })
    expect(ranking).toHaveAttribute('href', '/reportes/ranking?campania=A-cerrada')
    await user.click(ranking)
    await screen.findByRole('heading', { name: 'Ranking de cosechadores', exact: true })
    expect(screen.getByLabelText('Campaña')).toHaveValue('A-cerrada')
  })

  it('una campaña ajena no llega a consultar producción, ranking ni lotes', async () => {
    const { ports } = mount(() => {}, '/?campania=B-camp')
    await screen.findByRole('alert')
    expect(ports.calls.some((c) => c[0] === 'consultarReporte')).toBe(false)
  })
})
