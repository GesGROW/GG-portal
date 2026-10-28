import { describe, it, expect, vi } from 'vitest'
import { act, render, screen, waitFor, within } from '@testing-library/react'
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
  it.each(SECCIONES_TRABAJADORES.slice(0, 2))(
    '$label abre la ficha con clic o teclado y guarda los campos reales de esa participación',
    async (seccion) => {
      let actual = {
        ...persona,
        id: 'trabajador-1',
        participacionId: persona.id,
        campaniaId: campania.id,
        rol: seccion.rol,
        nombres: 'Ana María',
        apellidos: 'De la Cruz Rojas',
        activo: false,
        trabajadorActivo: true
      }
      const servicio = {
        trabajadoresCampania: vi.fn(async () => ({
          filas: [
            {
              ...persona,
              nombre: [actual.nombres, actual.apellidos].join(' '),
              activo: actual.activo
            }
          ],
          total: 1
        })),
        trabajadorCampania: vi.fn(async () => actual),
        editarTrabajadorCampania: vi.fn(
          async (c, r, id, d) => (actual = { ...actual, ...d })
        )
      }
      render(
        <TrabajadoresCampania
          servicio={servicio}
          campania={campania}
          seccion={seccion}
          puedeEditar
        />
      )
      const user = userEvent.setup(),
        fila = (await screen.findByText('Ana María De la Cruz Rojas')).closest('tr')
      expect(fila).toHaveAttribute('tabindex', '0')
      expect(within(fila).queryByRole('link')).not.toBeInTheDocument()
      if (seccion.rol === 'COSECHADOR') await user.click(fila)
      else {
        fila.focus()
        await user.keyboard('{Enter}')
      }
      const panel = screen.getByRole('dialog')
      expect(await within(panel).findByLabelText('Nombres')).toHaveValue('Ana María')
      expect(within(panel).getByLabelText('Apellidos')).toHaveValue('De la Cruz Rojas')
      expect(servicio.trabajadorCampania).toHaveBeenCalledExactlyOnceWith(
        campania.id,
        seccion.rol,
        persona.id
      )
      expect(within(panel).getByLabelText('DNI')).toHaveAttribute('readonly')
      await user.clear(within(panel).getByLabelText('Nombres'))
      await user.type(within(panel).getByLabelText('Nombres'), 'Ana')
      await user.selectOptions(
        within(panel).getByLabelText('Estado en esta campaña'),
        'true'
      )
      await user.click(within(panel).getByRole('button', { name: 'Guardar datos' }))
      expect(await within(panel).findByRole('status')).toHaveTextContent(
        'Datos guardados.'
      )
      expect(servicio.editarTrabajadorCampania).toHaveBeenCalledExactlyOnceWith(
        campania.id,
        seccion.rol,
        persona.id,
        {
          dni: persona.dni,
          nombres: 'Ana',
          apellidos: 'De la Cruz Rojas',
          activo: true
        }
      )
      expect(servicio.trabajadoresCampania).toHaveBeenCalledTimes(2)
    }
  )
  it('un fallo conserva los cambios y bloquea el cierre durante el guardado para evitar doble envío', async () => {
    let rechazar
    const datos = {
      id: 't1',
      participacionId: persona.id,
      dni: persona.dni,
      nombres: 'Ana',
      apellidos: 'Rojas',
      activo: true,
      trabajadorActivo: true
    }
    const servicio = {
      trabajadoresCampania: vi.fn(async () => ({ filas: [persona], total: 1 })),
      trabajadorCampania: vi.fn(async () => datos),
      editarTrabajadorCampania: vi.fn(
        () =>
          new Promise((r, j) => {
            rechazar = j
          })
      )
    }
    render(
      <TrabajadoresCampania
        servicio={servicio}
        campania={campania}
        seccion={SECCIONES_TRABAJADORES[0]}
        puedeEditar
      />
    )
    const user = userEvent.setup()
    await user.click(await screen.findByText('Ana Rojas'))
    const panel = screen.getByRole('dialog')
    await within(panel).findByLabelText('Nombres')
    await user.dblClick(within(panel).getByRole('button', { name: 'Guardar datos' }))
    expect(servicio.editarTrabajadorCampania).toHaveBeenCalledTimes(1)
    expect(within(panel).getByRole('button', { name: 'Cerrar panel' })).toBeDisabled()
    await user.keyboard('{Escape}')
    expect(panel).toBeInTheDocument()
    await act(async () => rechazar(new Error('DNI duplicado')))
    expect(within(panel).getByRole('alert')).toHaveTextContent('DNI duplicado')
    expect(within(panel).getByLabelText('Nombres')).toHaveValue('Ana')
    expect(within(panel).getByRole('button', { name: 'Guardar datos' })).toBeEnabled()
    await user.click(within(panel).getByRole('button', { name: 'Cancelar' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
  it('consulta permite abrir la ficha sin exponer controles de guardado', async () => {
    const servicio = {
      trabajadoresCampania: vi.fn(async () => ({ filas: [persona], total: 1 })),
      trabajadorCampania: vi.fn(async () => ({
        id: 't1',
        participacionId: persona.id,
        dni: persona.dni,
        nombres: 'Ana',
        apellidos: 'Rojas',
        activo: false,
        trabajadorActivo: true
      }))
    }
    render(
      <TrabajadoresCampania
        servicio={servicio}
        campania={campania}
        seccion={SECCIONES_TRABAJADORES[0]}
      />
    )
    const user = userEvent.setup()
    await user.click(await screen.findByText('Ana Rojas'))
    const panel = screen.getByRole('dialog')
    expect(await within(panel).findByLabelText('DNI')).toBeDisabled()
    expect(
      within(panel).queryByRole('button', { name: 'Guardar datos' })
    ).not.toBeInTheDocument()
  })
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
