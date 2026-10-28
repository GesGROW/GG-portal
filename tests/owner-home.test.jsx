import { describe, it, expect, vi } from 'vitest'
import { act, render, screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { Portal } from '../src/presentation/Portal.jsx'
import { crearPortal } from '../src/application/crearPortal.js'
import { fakePorts } from './support/fakePorts.js'
import { fakeReportes } from './support/fakeReportes.js'

async function montar(options = {}) {
  const puertos = fakePorts({
    autenticado: true,
    modulos: { A: [] },
    permisos: { A: ['company.manage', 'reports.view'] },
    ...options
  })
  fakeReportes(puertos)
  const campanias = vi.spyOn(puertos.reportesHarvest, 'campanias')
  const reportes = vi.spyOn(puertos.reportesHarvest, 'consultar')
  const portal = crearPortal(puertos)
  render(
    <MemoryRouter>
      <Portal portal={portal} />
    </MemoryRouter>
  )
  await screen.findByRole('heading', { name: 'Home', exact: true })
  return { puertos, portal, campanias, reportes, user: userEvent.setup() }
}

describe('Home del owner', () => {
  for (const [enlace, titulo] of [
    ['Ver producción diaria', 'Producción diaria'],
    ['Ver ranking completo', 'Ranking de cosechadores']
  ]) {
    it(`E024: ${enlace} abre el reporte de la campaña seleccionada`, async () => {
      const { user } = await montar({ modulos: { A: ['HARVEST'] } })
      const link = await screen.findByRole('link', { name: enlace })
      expect(link).toHaveAttribute('href', expect.stringContaining('campania=A-camp'))
      await user.click(link)
      await screen.findByRole('heading', { name: titulo, exact: true })
      expect(
        screen.queryByRole('heading', { name: 'Acceso restringido' })
      ).not.toBeInTheDocument()
    })
  }
  it('sin Cosecha muestra la invitación a adquirir y no presenta selector ni consulta datos', async () => {
    const { campanias, reportes } = await montar()
    expect(
      screen.getByText('Adquiere un módulo para poder ver su resumen')
    ).toBeVisible()
    expect(
      screen.queryByRole('combobox', { name: 'Módulo', exact: true })
    ).not.toBeInTheDocument()
    expect(campanias).not.toHaveBeenCalled()
    expect(reportes).not.toHaveBeenCalled()
    expect(screen.getByRole('region', { name: 'Bienvenida' })).toHaveTextContent(
      'Ana Gestión'
    )
  })

  it('el catálogo permite consultar Cosecha y Configuración sólo ofrece Usuarios y accesos', async () => {
    const { user } = await montar()
    expect(screen.getByRole('link', { name: 'Módulos', exact: true })).toHaveAttribute(
      'href',
      '/modulos'
    )
    expect(
      screen.queryByRole('link', { name: 'Registros', exact: true })
    ).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Configuración', exact: true }))
    const settings = within(screen.getByRole('region', { name: 'Configuración' }))
    expect(settings.getAllByRole('link')).toHaveLength(1)
    expect(settings.getByRole('link', { name: 'Usuarios y accesos' })).toHaveAttribute(
      'href',
      '/configuracion/usuarios'
    )
  })

  it('al activar y revocar Cosecha actualiza selector y resumen con los entitlements revalidados', async () => {
    const { puertos, portal } = await montar()
    puertos.modulos.A = ['HARVEST']
    await act(async () => portal.revalidar())
    expect(
      await screen.findByRole('combobox', { name: 'Módulo', exact: true })
    ).toHaveValue('HARVEST')
    await screen.findByText('Ana A')
    expect(
      screen.queryByText('Adquiere un módulo para poder ver su resumen')
    ).not.toBeInTheDocument()
    puertos.modulos.A = []
    await act(async () => portal.revalidar())
    expect(
      screen.getByText('Adquiere un módulo para poder ver su resumen')
    ).toBeInTheDocument()
    expect(screen.queryByText('Ana A')).not.toBeInTheDocument()
    expect(
      screen.queryByRole('combobox', { name: 'Módulo', exact: true })
    ).not.toBeInTheDocument()
  })

  it('tener el módulo sin permiso de resumen no dispara consultas', async () => {
    const { campanias, reportes } = await montar({
      modulos: { A: ['HARVEST'] },
      permisos: { A: ['company.manage', 'harvest.view'] }
    })
    expect(screen.getByRole('combobox', { name: 'Módulo', exact: true })).toHaveValue(
      'HARVEST'
    )
    expect(
      screen.getByText(/Tu cuenta no tiene acceso al resumen de Cosecha/)
    ).toBeInTheDocument()
    expect(campanias).not.toHaveBeenCalled()
    expect(reportes).not.toHaveBeenCalled()
  })

  it('conserva la lista al cambiar de campaña y actualiza las tres consultas del resumen', async () => {
    const { user, reportes } = await montar({ modulos: { A: ['HARVEST'] } })
    await screen.findByText('Ana A')
    const lista = screen.getByRole('listbox', { name: 'Campaña', exact: true })
    reportes.mockClear()
    await user.selectOptions(lista, 'A-cerrada')
    expect(screen.getByRole('listbox', { name: 'Campaña', exact: true })).toBe(lista)
    expect(lista).toHaveFocus()
    expect(lista).toHaveValue('A-cerrada')
    await waitFor(() => {
      const consultas = reportes.mock.calls.map(([, filtros]) => filtros)
      expect(consultas.map((f) => f.tipo).sort()).toEqual([
        'DASHBOARD',
        'LOTES',
        'RANKING'
      ])
      expect(consultas.every((f) => f.campaniaId === 'A-cerrada')).toBe(true)
    })
    await screen.findByText('Ana A')
  })

  it('el topbar ofrece Cuenta y permite cerrar sesión desde su menú', async () => {
    const { user } = await montar()
    const topbar = within(screen.getByRole('banner'))
    expect(topbar.queryByRole('combobox', { name: 'Tema' })).not.toBeInTheDocument()
    expect(topbar.getByRole('button', { name: 'Menú de usuario' })).toHaveTextContent(
      'Cuenta'
    )
    await user.click(topbar.getByRole('button', { name: 'Menú de usuario' }))
    expect(screen.getByRole('region', { name: 'Cuenta de usuario' })).toHaveTextContent(
      'ana@example.test'
    )
    await user.click(screen.getByRole('button', { name: 'Cerrar sesión' }))
    expect(
      await screen.findByRole('heading', { name: 'Iniciar sesión', exact: true })
    ).toBeInTheDocument()
  })
})
