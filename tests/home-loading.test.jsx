import { act, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { Dashboard } from '../src/presentation/Dashboard.jsx'

function deferred() {
  let resolve, reject
  const promise = new Promise((ok, fail) => { resolve = ok; reject = fail })
  return { promise, resolve, reject }
}

function mount() {
  const campaigns = deferred()
  const requests = { DASHBOARD: deferred(), RANKING: deferred(), LOTES: deferred() }
  const servicio = {
    campanias: () => campaigns.promise,
    consultar: vi.fn(({ tipo }) => requests[tipo].promise)
  }
  render(<MemoryRouter><Dashboard servicio={servicio} embedded /></MemoryRouter>)
  return { campaigns, requests, servicio }
}

describe('Carga estable de Home', () => {
  it('mantiene un solo skeleton hasta que terminen campañas, indicadores, ranking y variedades', async () => {
    const { campaigns, requests, servicio } = mount()
    expect(screen.getAllByRole('status')).toHaveLength(1)
    await act(async () => campaigns.resolve([{ id: 'camp', nombre: 'Campaña', estado: 'ACTIVA' }]))
    await waitFor(() => expect(servicio.consultar).toHaveBeenCalledTimes(3))
    await act(async () => requests.DASHBOARD.resolve({ datos: {
      resumen: { total_jabas: 12, total_cosechadores: 1, total_lotes: 1, dias_con_produccion: 1 },
      hoy: { total_jabas: 3 }
    } }))
    expect(screen.queryByRole('heading', { name: 'Producción' })).not.toBeInTheDocument()
    await act(async () => requests.RANKING.resolve({ datos: { ranking: [{ cosechador: 'Ana', total_jabas: 12 }] } }))
    expect(screen.getAllByRole('status')).toHaveLength(1)
    expect(screen.queryByText('Ana')).not.toBeInTheDocument()
    await act(async () => requests.LOTES.resolve({ datos: { produccion: [] } }))
    expect(await screen.findByRole('heading', { name: 'Producción' })).toBeInTheDocument()
    expect(screen.getByText('Ana')).toBeInTheDocument()
    expect(screen.queryByText('Cargando resumen de Cosecha…')).not.toBeInTheDocument()
  })

  it('muestra el error y permite reintentar si falla la consulta principal aunque las demás sigan pendientes', async () => {
    const { campaigns, requests, servicio } = mount()
    await act(async () => campaigns.resolve([{ id: 'camp', nombre: 'Campaña', estado: 'ACTIVA' }]))
    await waitFor(() => expect(servicio.consultar).toHaveBeenCalledTimes(3))
    await act(async () => requests.DASHBOARD.reject(new Error('Error de conexión de prueba')))
    expect(await screen.findByRole('alert')).toHaveTextContent('Error de conexión de prueba')
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument()
    expect(screen.queryByText('Cargando resumen de Cosecha…')).not.toBeInTheDocument()
  })
})
