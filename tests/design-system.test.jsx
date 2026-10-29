import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { ThemeSwitcher, UserMenu } from '../src/presentation/Ui.jsx'
import { Portal } from '../src/presentation/Portal.jsx'
import { crearPortal } from '../src/application/crearPortal.js'
import { fakePorts } from './support/fakePorts.js'
import { fakeReportes } from './support/fakeReportes.js'
import { applyTheme, readTheme } from '../src/theme.js'

afterEach(() => {
  localStorage.clear()
  delete document.documentElement.dataset.theme
  vi.unstubAllGlobals()
})

describe('Interacción y accesibilidad del rediseño', () => {
  it('UserMenu abre por teclado, recupera el foco con Escape y conserva el cierre de sesión', async () => {
    const logout = vi.fn(),
      user = userEvent.setup()
    render(
      <>
        <UserMenu
          usuario={{ nombre: 'Ana Gestión', email: 'ana@example.test' }}
          onLogout={logout}
        />
        <button>Otra acción</button>
      </>
    )
    const trigger = screen.getByRole('button', { name: 'Menú de usuario' })
    await user.tab()
    await user.keyboard('{Enter}')
    expect(screen.getByRole('region', { name: 'Cuenta de usuario' })).toHaveTextContent(
      'ana@example.test'
    )
    expect(screen.getByRole('button', { name: 'Cerrar sesión' })).toHaveFocus()
    await user.keyboard('{Escape}')
    expect(trigger).toHaveFocus()
    expect(
      screen.queryByRole('region', { name: 'Cuenta de usuario' })
    ).not.toBeInTheDocument()
    await user.keyboard('{Enter}')
    await user.tab()
    expect(screen.getByRole('button', { name: 'Otra acción' })).toHaveFocus()
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    await user.click(trigger)
    await user.click(screen.getByRole('button', { name: 'Cerrar sesión' }))
    expect(logout).toHaveBeenCalledTimes(1)
  })
  it.each(['light', 'system', 'dark'])(
    'mantiene oscuro con la preferencia guardada %s y el sistema en claro',
    (preference) => {
      localStorage.setItem('gesgrow.portal.theme.v1', preference)
      const media = {
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn()
      }
      vi.stubGlobal('matchMedia', () => media)
      render(<ThemeSwitcher />)
      expect(readTheme()).toBe('dark')
      expect(document.documentElement.dataset.theme).toBe('dark')
      expect(localStorage.getItem('gesgrow.portal.theme.v1')).toBe('dark')
      expect(screen.getByLabelText('Tema')).toHaveValue('dark')
      expect(screen.getByLabelText('Tema')).toBeDisabled()
      expect(screen.getByRole('option', { name: 'Claro' })).toBeDisabled()
      expect(media.addEventListener).not.toHaveBeenCalled()
    }
  )

  it.each(['light', 'system'])(
    'ignora un intento de aplicar el tema %s',
    (preference) => {
      applyTheme(preference)
      expect(document.documentElement.dataset.theme).toBe('dark')
    }
  )

  it('el tema funciona aunque el navegador no permita persistir preferencias', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    render(<ThemeSwitcher />)
    expect(document.documentElement.dataset.theme).toBe('dark')
  })

  it('el drawer contiene el foco, cierra con Escape y devuelve el foco al botón de apertura', async () => {
    const portal = crearPortal(fakePorts({ autenticado: true }))
    render(
      <MemoryRouter>
        <Portal portal={portal} />
      </MemoryRouter>
    )
    await screen.findByRole('heading', { name: 'Bienvenido a GesGROW' })
    const user = userEvent.setup()
    const trigger = screen.getByRole('button', { name: 'Menú', exact: true })
    await user.click(trigger)
    const dialog = screen.getByRole('dialog', { name: 'Menú del Portal' })
    const first = within(dialog).getByRole('button', { name: 'Cerrar menú' })
    expect(first).toHaveFocus()
    await user.tab({ shift: true })
    expect(
      within(dialog).getByRole('link', { name: 'Cosecha', exact: true })
    ).toHaveFocus()
    await user.tab()
    expect(first).toHaveFocus()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
    expect(document.body.style.overflow).not.toBe('hidden')
  })

  it('los paneles del dashboard usan reportes existentes y descartan respuestas de la empresa anterior', async () => {
    const ports = fakePorts({
      autenticado: true,
      empresas: ['A', 'B'],
      permisos: { A: ['reports.view'], B: ['reports.view'] }
    })
    fakeReportes(ports)
    const original = ports.reportesHarvest.consultar
    let release, started
    const waiting = new Promise((resolve) => {
      started = resolve
    })
    ports.reportesHarvest.consultar = async (tenant, filters) => {
      const result = await original(tenant, filters)
      if (tenant === 'A' && filters.tipo === 'RANKING') {
        started()
        await new Promise((resolve) => {
          release = resolve
        })
      }
      return result
    }
    render(
      <MemoryRouter>
        <Portal portal={crearPortal(ports)} />
      </MemoryRouter>
    )
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: /Empresa A/ }))
    await waiting
    expect(await within(screen.getByRole('region', { name: 'Producción' })).findByText('43')).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Top cosechador' })).toHaveAttribute('aria-busy', 'true')
    await user.click(screen.getByRole('button', { name: 'Menú de usuario' }))
    await user.selectOptions(screen.getByLabelText('Empresa activa'), 'B')
    await screen.findByText('Ana B')
    await act(async () => release())
    await waitFor(() => expect(screen.queryByText('Ana A')).not.toBeInTheDocument())
    expect(
      within(screen.getByRole('region', { name: 'Top cosechador' })).getByText('Ana B')
    ).toBeInTheDocument()
    for (const type of ['DASHBOARD', 'RANKING', 'LOTES']) {
      expect(
        ports.calls.some(
          (c) => c[0] === 'consultarReporte' && c[1] === 'B' && c[2].tipo === type
        )
      ).toBe(true)
    }
  })
})
