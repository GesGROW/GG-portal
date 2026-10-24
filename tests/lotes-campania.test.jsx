import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LotesCampania, fechaLote } from '../src/presentation/LotesCampania.jsx'

const lote = {
  id: 'LT-123',
  creadoEn: '2026-10-21T05:35:00Z',
  asignadoEn: '2026-10-22T19:03:00Z',
  trabajador: { nombre: 'Gianella Sotil' }
}
const sinFiltros = { busqueda: '', estado: '', desde: null, hasta: null }
function montar({
  asignados = false,
  filas = [lote],
  total = filas.length,
  servicio
} = {}) {
  servicio ??= { listar: vi.fn(async () => ({ filas, total })) }
  const vista = render(
    <LotesCampania
      servicio={servicio}
      campania={{ id: 'camp-1' }}
      asignados={asignados}
    />
  )
  return { servicio, user: userEvent.setup(), ...vista }
}
describe('Listados de lotes de la campaña', () => {
  it('generados muestra los tres campos, convierte a Lima y deja el icono operable sin abrir un detalle inventado', async () => {
    const { user, servicio } = montar()
    expect(await screen.findByRole('cell', { name: 'LT-123' })).toBeInTheDocument()
    expect(screen.getAllByRole('columnheader').map((x) => x.textContent)).toEqual([
      'Lote',
      'Tickets',
      'Fecha y hora'
    ])
    expect(screen.getByText('21 de Octubre 2026, 12:35 a.m.')).toBeInTheDocument()
    const boton = screen.getByRole('button', { name: 'Tickets del lote LT-123' })
    await user.click(boton)
    expect(boton).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText(/Lote LT-123 seleccionado/)).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(servicio.listar).toHaveBeenCalledExactlyOnceWith('lotes', {
      campaniaId: 'camp-1',
      offset: 0,
      ...sinFiltros
    })
  })
  it('asignados usa la hora de asignación del servidor, no la creación del lote', async () => {
    const { servicio } = montar({ asignados: true })
    await screen.findByText('Gianella Sotil')
    expect(screen.getAllByRole('columnheader').map((x) => x.textContent)).toEqual([
      'Lote',
      'Cosechador',
      'Fecha y hora de asignación'
    ])
    expect(screen.getByText('22 de Octubre 2026, 2:03 p.m.')).toBeInTheDocument()
    expect(screen.queryByText(/21 de Octubre/)).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /Tickets del lote/ })
    ).not.toBeInTheDocument()
    expect(servicio.listar).toHaveBeenCalledExactlyOnceWith('asignaciones', {
      campaniaId: 'camp-1',
      offset: 0,
      ...sinFiltros
    })
  })
  it('un histórico sin fecha de asignación informa la ausencia aunque exista fecha de creación', async () => {
    montar({ asignados: true, filas: [{ ...lote, asignadoEn: null }] })
    expect(await screen.findByText('Sin fecha registrada')).toBeInTheDocument()
    expect(screen.queryByText(/21 de Octubre/)).not.toBeInTheDocument()
    expect(fechaLote('invalid')).toBe('Sin fecha registrada')
  })
  it('carga la siguiente página desde la API de la misma campaña', async () => {
    const servicio = {
      listar: vi.fn(async (tipo, f) => ({
        filas: f.offset
          ? [{ ...lote, id: 'LT-51' }]
          : Array.from({ length: 50 }, (_, i) => ({ ...lote, id: `LT-${i}` })),
        total: 51
      }))
    }
    const { user } = montar({ servicio })
    await screen.findByRole('cell', { name: 'LT-9' })
    expect(screen.getAllByRole('row')).toHaveLength(11)
    await user.click(screen.getByRole('button', { name: 'Siguiente' }))
    expect(screen.getByRole('cell', { name: 'LT-19' })).toBeInTheDocument()
    expect(servicio.listar).toHaveBeenCalledTimes(1)
    await user.click(screen.getByRole('button', { name: 'Página 6' }))
    await screen.findByRole('cell', { name: 'LT-51' })
    expect(servicio.listar.mock.calls[1]).toEqual([
      'lotes',
      { campaniaId: 'camp-1', offset: 50, ...sinFiltros }
    ])
    expect(screen.queryByRole('cell', { name: 'LT-19' })).not.toBeInTheDocument()
  })
  it('un error permite reintentar y un resultado vacío conserva sus columnas', async () => {
    const servicio = {
      listar: vi
        .fn()
        .mockRejectedValueOnce(new Error('Sin conexión'))
        .mockResolvedValue({ filas: [], total: 0 })
    }
    const { user } = montar({ servicio })
    expect(await screen.findByRole('alert')).toHaveTextContent('Sin conexión')
    await user.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(await screen.findByText('No hay lotes de tickets generados')).toBeInTheDocument()
    expect(screen.getAllByRole('columnheader')).toHaveLength(3)
    expect(
      screen.queryByRole('button', { name: /Tickets del lote/ })
    ).not.toBeInTheDocument()
  })
  it('descarta la respuesta tardía al cambiar de campaña', async () => {
    let liberar
    const servicio = {
      listar: vi.fn((tipo, f) =>
        f.campaniaId === 'camp-1'
          ? new Promise((r) => {
              liberar = r
            })
          : Promise.resolve({ filas: [{ ...lote, id: 'LT-new' }], total: 1 })
      )
    }
    const { rerender } = montar({ servicio })
    await waitFor(() => expect(servicio.listar).toHaveBeenCalledTimes(1))
    rerender(
      <LotesCampania key="camp-2" servicio={servicio} campania={{ id: 'camp-2' }} />
    )
    await screen.findByRole('cell', { name: 'LT-new' })
    liberar({ filas: [lote], total: 1 })
    await waitFor(() =>
      expect(screen.queryByRole('cell', { name: 'LT-123' })).not.toBeInTheDocument()
    )
  })
})
