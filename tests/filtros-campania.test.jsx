import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LotesCampania } from '../src/presentation/LotesCampania.jsx'
import {
  TrabajadoresCampania,
  SECCIONES_TRABAJADORES
} from '../src/presentation/TrabajadoresCampania.jsx'

const campania = { id: 'camp-1' }
const sinFiltros = { busqueda: '', estado: '', desde: null, hasta: null }
const lote = { id: 'LT-51', creadoEn: '2026-10-20T05:00:00Z' }

describe('Filtros de las tablas de Cosecha', () => {
  it('busca lotes desde otra página, combina estado y fechas y limpia la selección', async () => {
    const user = userEvent.setup()
    const servicio = {
      listar: vi.fn(async (_, f) => {
        if (f.busqueda) return { filas: [lote], total: 1 }
        return {
          filas: f.offset
            ? [lote]
            : Array.from({ length: 50 }, (_, i) => ({ ...lote, id: `LT-${i}` })),
          total: 51
        }
      })
    }
    render(<LotesCampania servicio={servicio} campania={campania} />)
    await screen.findByRole('cell', { name: 'LT-9' })
    await user.click(screen.getByRole('button', { name: 'Página 6' }))
    await screen.findByRole('cell', { name: 'LT-51' })
    await user.click(screen.getByRole('button', { name: 'Tickets del lote LT-51' }))
    await user.type(
      screen.getByRole('searchbox', { name: 'Buscar por lote' }),
      'LT-51{Enter}'
    )
    await waitFor(() =>
      expect(servicio.listar).toHaveBeenLastCalledWith('lotes', {
        campaniaId: 'camp-1',
        offset: 0,
        ...sinFiltros,
        busqueda: 'LT-51'
      })
    )
    expect(screen.queryByText(/Lote LT-51 seleccionado/)).not.toBeInTheDocument()
    await user.selectOptions(
      screen.getByLabelText('Estado de asignación'),
      'DISPONIBLE'
    )
    await user.click(screen.getByText('Todas las fechas'))
    await user.type(screen.getByLabelText('Desde'), '2026-10-20')
    await user.type(screen.getByLabelText('Hasta'), '2026-10-21')
    await user.click(screen.getByRole('button', { name: 'Aplicar', exact: true }))
    await waitFor(() =>
      expect(servicio.listar).toHaveBeenLastCalledWith('lotes', {
        campaniaId: 'camp-1',
        offset: 0,
        busqueda: 'LT-51',
        estado: 'DISPONIBLE',
        desde: '2026-10-20',
        hasta: '2026-10-21'
      })
    )
    await user.click(screen.getByRole('button', { name: 'Limpiar filtros' }))
    await waitFor(() =>
      expect(servicio.listar).toHaveBeenLastCalledWith('lotes', {
        campaniaId: 'camp-1',
        offset: 0,
        ...sinFiltros
      })
    )
    expect(screen.getByRole('searchbox')).toHaveValue('')
    expect(screen.getByText('Todas las fechas')).toBeInTheDocument()
  })

  it('en asignados ofrece búsqueda por cosechador o DNI y filtra fecha de asignación', async () => {
    const user = userEvent.setup()
    const servicio = { listar: vi.fn(async () => ({ filas: [], total: 0 })) }
    render(<LotesCampania servicio={servicio} campania={campania} asignados />)
    await screen.findByText('No hay lotes de tickets asignados')
    expect(screen.queryByLabelText('Estado de asignación')).not.toBeInTheDocument()
    expect(screen.getByText('Fecha de asignación')).toBeInTheDocument()
    await user.type(screen.getByRole('searchbox'), '76338971')
    await user.click(screen.getByRole('button', { name: 'Buscar', exact: true }))
    await screen.findByText('No hay lotes para los filtros seleccionados')
    expect(servicio.listar).toHaveBeenLastCalledWith('asignaciones', {
      campaniaId: 'camp-1',
      offset: 0,
      ...sinFiltros,
      busqueda: '76338971'
    })
    expect(screen.getAllByRole('columnheader')).toHaveLength(3)
  })

  it.each(SECCIONES_TRABAJADORES)(
    '$label combina nombre o DNI, estado y período sin perder el rol',
    async (seccion) => {
      const user = userEvent.setup()
      const servicio = {
        trabajadoresCampania: vi.fn(async (_, __, offset, f) => {
          if (f.estado) return { filas: [], total: 0 }
          return {
            filas: offset
              ? [{ id: 'p51', nombre: 'Persona final', activo: true }]
              : Array.from({ length: 50 }, (_, i) => ({
                  id: `p${i}`,
                  nombre: `Persona ${i}`,
                  activo: true
                })),
            total: 51
          }
        })
      }
      render(
        <TrabajadoresCampania
          servicio={servicio}
          campania={campania}
          seccion={seccion}
        />
      )
      await screen.findByRole('cell', { name: 'Persona 9' })
      await user.click(screen.getByRole('button', { name: 'Página 6' }))
      await screen.findByText('Persona final')
      await user.type(screen.getByRole('searchbox'), 'Lucía')
      await user.selectOptions(
        screen.getByLabelText('Estado del trabajador'),
        'INACTIVO'
      )
      await screen.findByText('No hay trabajadores para los filtros seleccionados')
      await user.click(screen.getByText('Todas las fechas'))
      await user.type(screen.getByLabelText('Desde'), '2026-10-20')
      await user.type(screen.getByLabelText('Hasta'), '2026-10-21')
      await user.click(screen.getByRole('button', { name: 'Aplicar', exact: true }))
      await waitFor(() =>
        expect(servicio.trabajadoresCampania).toHaveBeenLastCalledWith(
          'camp-1',
          seccion.rol,
          0,
          {
            busqueda: 'Lucía',
            estado: 'INACTIVO',
            desde: '2026-10-20',
            hasta: '2026-10-21'
          }
        )
      )
      expect(screen.getAllByRole('columnheader')).toHaveLength(4)
      await user.click(screen.getByRole('button', { name: 'Limpiar filtros' }))
      await waitFor(() =>
        expect(servicio.trabajadoresCampania).toHaveBeenLastCalledWith(
          'camp-1',
          seccion.rol,
          0,
          sinFiltros
        )
      )
      expect(screen.getByRole('searchbox')).toHaveValue('')
    }
  )
})
