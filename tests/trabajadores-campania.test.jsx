import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { CampaniaCosecha } from '../src/presentation/CampaniaCosecha.jsx'
import {
  TrabajadoresCampania,
  SECCIONES_TRABAJADORES
} from '../src/presentation/TrabajadoresCampania.jsx'

const persona = {
  id: 'p1',
  dni: '76338971',
  nombre: 'Ana Rojas',
  activo: false,
  iniciadoEn: '2026-10-20T19:03:00Z'
}
const campania = { id: 'camp-1', nombre: 'Campaña Arándano 2026', estado: 'ACTIVA' }
const contexto = { permite: (p) => p === 'harvest.manage' }
const sinFiltros = { busqueda: '', estado: '', desde: null, hasta: null }
describe('Trabajadores dentro de una campaña', () => {
  it.each(SECCIONES_TRABAJADORES)(
    '$label consulta la campaña y rol correctos, incluidos los inactivos',
    async (seccion) => {
      const servicio = {
        trabajadoresCampania: vi.fn(async () => ({
          filas: [
            persona,
            {
              ...persona,
              id: 'p2',
              nombre: 'Gianella Sotil',
              activo: true,
              iniciadoEn: null
            }
          ],
          total: 2
        }))
      }
      render(
        <TrabajadoresCampania
          servicio={servicio}
          campania={campania}
          seccion={seccion}
        />
      )
      await screen.findByText('Ana Rojas')
      expect(screen.getAllByRole('columnheader').map((x) => x.textContent)).toEqual([
        'DNI',
        'Nombre',
        'Estado',
        'Fecha y hora de inicio'
      ])
      expect(screen.getByText('Inactivo')).toHaveClass('is-inactive')
      expect(screen.getByText('Activo')).toHaveClass('is-active')
      expect(screen.getByText('20 de Octubre 2026, 2:03 p.m.')).toBeInTheDocument()
      expect(screen.getByText('Sin fecha registrada')).toBeInTheDocument()
      expect(servicio.trabajadoresCampania).toHaveBeenCalledExactlyOnceWith(
        'camp-1',
        seccion.rol,
        0,
        sinFiltros
      )
    }
  )
  it('mantiene la pestaña y la opción Trabajadores activas, con los SVG compuestos', async () => {
    const servicio = {
      campanias: vi.fn(async () => [
        campania,
        { id: 'camp-2', nombre: 'Campaña anterior', estado: 'CERRADA' }
      ]),
      trabajadoresCampania: vi.fn(async () => ({ filas: [], total: 0 }))
    }
    render(
      <MemoryRouter initialEntries={['/cosecha/jaberos?campania=camp-1']}>
        <CampaniaCosecha servicio={servicio} contexto={contexto} seccion="jaberos" />
      </MemoryRouter>
    )
    await screen.findByText('No hay jaberos')
    expect(
      screen.getByRole('link', { name: 'Trabajadores', exact: true })
    ).toHaveAttribute('aria-current', 'page')
    expect(
      screen.getByRole('link', { name: 'Tickets', exact: true })
    ).not.toHaveAttribute('aria-current')
    const tab = screen.getByRole('link', { name: 'Jaberos', exact: true })
    expect(tab).toHaveAttribute('aria-current', 'page')
    expect(tab.querySelectorAll('svg')).toHaveLength(2)
    expect(tab.querySelectorAll('svg')[1]).toHaveAttribute('stroke-width', '2')
    expect(
      screen.getByRole('option', { name: 'Campaña Arándano 2026 (actual)' })
    ).toBeInTheDocument()
    const user = userEvent.setup()
    await user.selectOptions(screen.getByLabelText('Campaña de cosecha'), 'camp-2')
    await waitFor(() =>
      expect(servicio.trabajadoresCampania).toHaveBeenLastCalledWith(
        'camp-2',
        'JABERO',
        0,
        sinFiltros
      )
    )
    expect(screen.getByRole('link', { name: 'Jaberos', exact: true })).toHaveAttribute(
      'href',
      '/cosecha/jaberos?campania=camp-2'
    )
  })
  it('pagina sin mezclar roles y descarta la respuesta de una campaña anterior', async () => {
    let liberar
    const servicio = {
      trabajadoresCampania: vi.fn((id, rol, offset) =>
        id === 'anterior'
          ? new Promise((r) => {
              liberar = r
            })
          : Promise.resolve({
              filas: offset
                ? [{ ...persona, id: 'p51', nombre: 'Último' }]
                : Array.from({ length: 50 }, (_, i) => ({ ...persona, id: `p${i}` })),
              total: 51
            })
      )
    }
    const { rerender } = render(
      <TrabajadoresCampania
        key="anterior"
        servicio={servicio}
        campania={{ id: 'anterior' }}
        seccion={SECCIONES_TRABAJADORES[0]}
      />
    )
    await waitFor(() => expect(liberar).toBeTypeOf('function'))
    rerender(
      <TrabajadoresCampania
        key="nueva"
        servicio={servicio}
        campania={campania}
        seccion={SECCIONES_TRABAJADORES[1]}
      />
    )
    await screen.findAllByText('Ana Rojas')
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Página 6' }))
    await screen.findByText('Último')
    expect(servicio.trabajadoresCampania).toHaveBeenLastCalledWith(
      'camp-1',
      'JABERO',
      50,
      sinFiltros
    )
    liberar({ filas: [{ ...persona, nombre: 'Obsoleta' }], total: 1 })
    await waitFor(() => expect(screen.queryByText('Obsoleta')).not.toBeInTheDocument())
  })
})
