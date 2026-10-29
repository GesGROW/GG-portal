import { act, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { Dashboard } from '../src/presentation/Dashboard.jsx'

function deferred() {
  let resolve, reject
  const promise = new Promise((ok, fail) => {
    resolve = ok
    reject = fail
  })
  return { promise, resolve, reject }
}

function mount() {
  const campaigns = deferred()
  const requests = { DASHBOARD: deferred(), RANKING: deferred(), LOTES: deferred() }
  const servicio = {
    campanias: () => campaigns.promise,
    consultar: vi.fn(({ tipo }) => requests[tipo].promise)
  }
  render(
    <MemoryRouter>
      <Dashboard servicio={servicio} embedded />
    </MemoryRouter>
  )
  return { campaigns, requests, servicio }
}

describe('Carga estable de Home', () => {
  it('muestra producción e indicadores listos mientras ranking y variedades siguen cargando', async () => {
    const { campaigns, requests, servicio } = mount()
    expect(screen.getAllByRole('status')).toHaveLength(1)
    await act(async () =>
      campaigns.resolve([{ id: 'camp', nombre: 'Campaña', estado: 'ACTIVA' }])
    )
    await waitFor(() => expect(servicio.consultar).toHaveBeenCalledTimes(3))
    await act(async () =>
      requests.DASHBOARD.resolve({
        datos: {
          resumen: {
            total_jabas: 12,
            total_cosechadores: 1,
            total_lotes: 1,
            dias_con_produccion: 1
          },
          hoy: { total_jabas: 3 }
        }
      })
    )
    const produccion = screen.getByRole('region', { name: 'Producción' })
    expect(produccion).toHaveAttribute('aria-busy', 'false')
    expect(within(produccion).getByText('12')).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Top cosechador' })).toHaveAttribute(
      'aria-busy',
      'true'
    )
    expect(screen.getByText('Variedades').closest('.home-stat')).toHaveAttribute(
      'aria-busy',
      'true'
    )
    await act(async () =>
      requests.RANKING.resolve({
        datos: { ranking: [{ cosechador: 'Ana', total_jabas: 12 }] }
      })
    )
    expect(screen.getByText('Ana')).toBeInTheDocument()
    expect(screen.getByText('Variedades').closest('.home-stat')).toHaveAttribute(
      'aria-busy',
      'true'
    )
    await act(async () => requests.LOTES.resolve({ datos: { produccion: [] } }))
    expect(
      await screen.findByRole('heading', { name: 'Producción' })
    ).toBeInTheDocument()
    expect(screen.getByText('Ana')).toBeInTheDocument()
    expect(screen.getByText('Variedades').nextElementSibling).toHaveTextContent('0')
    expect(screen.queryByText('Cargando resumen de Cosecha…')).not.toBeInTheDocument()
  })

  it('el ranking aparece aunque producción no haya respondido, sin inventar ceros', async () => {
    const { campaigns, requests, servicio } = mount()
    await act(async () =>
      campaigns.resolve([{ id: 'camp', nombre: 'Campaña', estado: 'ACTIVA' }])
    )
    await waitFor(() => expect(servicio.consultar).toHaveBeenCalledTimes(3))
    await act(async () =>
      requests.RANKING.resolve({
        datos: { ranking: [{ cosechador: 'Ana', total_jabas: 12 }] }
      })
    )
    expect(screen.getByText('Ana')).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Producción' })).toHaveAttribute(
      'aria-busy',
      'true'
    )
    expect(screen.getByText('Cosechadores').closest('.home-stat')).toHaveAttribute(
      'aria-busy',
      'true'
    )
    expect(screen.getByText('Cosechadores').nextElementSibling).not.toHaveTextContent(
      '0'
    )
    await act(async () =>
      requests.DASHBOARD.resolve({
        datos: {
          resumen: { total_jabas: 12, total_variedades_configuradas: 4 },
          hoy: { total_jabas: 3 }
        }
      })
    )
    expect(screen.getByText('Variedades').nextElementSibling).toHaveTextContent('4')
    expect(screen.getByText('Variedades').closest('.home-stat')).toHaveAttribute(
      'aria-busy',
      'false'
    )
  })

  it('muestra el error y permite reintentar si falla la consulta principal aunque las demás sigan pendientes', async () => {
    const { campaigns, requests, servicio } = mount()
    await act(async () =>
      campaigns.resolve([{ id: 'camp', nombre: 'Campaña', estado: 'ACTIVA' }])
    )
    await waitFor(() => expect(servicio.consultar).toHaveBeenCalledTimes(3))
    await act(async () =>
      requests.DASHBOARD.reject(new Error('Error de conexión de prueba'))
    )
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Error de conexión de prueba'
    )
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument()
    expect(screen.queryByText('Cargando resumen de Cosecha…')).not.toBeInTheDocument()
  })
})
