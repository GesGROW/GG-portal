import { describe, expect, it } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router'
import { Portal } from '../src/presentation/Portal.jsx'
import { crearPortal } from '../src/application/crearPortal.js'
import { fakePorts } from './support/fakePorts.js'
import { fakeReportes } from './support/fakeReportes.js'
import { fakeHarvestAdmin } from './support/fakeHarvestAdmin.js'

function Location() {
  const location = useLocation()
  return (
    <output data-testid="location">
      {location.pathname}
      {location.search}
    </output>
  )
}
function mount(path = '/') {
  const ports = fakePorts({ autenticado: true })
  fakeReportes(ports)
  fakeHarvestAdmin(ports)
  const portal = crearPortal(ports)
  render(
    <MemoryRouter initialEntries={[path]}>
      <Location />
      <Portal portal={portal} />
    </MemoryRouter>
  )
}

describe('Accesos publicados a reportes', () => {
  it('el Home enlaza a producción y ranking mientras el menú general permanece oculto', async () => {
    mount()
    const user = userEvent.setup()
    await screen.findByText('Ana A')
    for (const [name, route] of [
      ['Ver producción diaria', 'diaria'],
      ['Ver ranking completo', 'ranking']
    ]) {
      const link = screen.getByRole('link', { name })
      expect(link).not.toHaveAttribute('aria-disabled')
      expect(link).toHaveAttribute('href', '/reportes/' + route + '?campania=A-camp')
    }
    await user.hover(screen.getByRole('button', { name: 'Módulos', exact: true }))
    expect(
      screen.queryByRole('link', { name: 'Reportes', exact: true })
    ).not.toBeInTheDocument()
    expect(screen.getByTestId('location')).toHaveTextContent(/^\/$/)
    expect(screen.getByRole('region', { name: 'Módulos', exact: true })).toBeVisible()
  })

  it.each(['/reportes', '/reportes/resumen', '/reportes/lotes'])(
    'la URL %s vuelve al Home sin mostrar reportes',
    async (path) => {
      mount(path)
      await screen.findByText('Ana A')
      expect(screen.getByTestId('location')).toHaveTextContent(/^\/$/)
      expect(
        screen.queryByRole('heading', { name: 'Reportes', exact: true })
      ).not.toBeInTheDocument()
      expect(
        screen.queryByRole('heading', { name: 'Ranking de cosechadores', exact: true })
      ).not.toBeInTheDocument()
      expect(
        screen.queryByRole('navigation', { name: 'Reportes disponibles' })
      ).not.toBeInTheDocument()
    }
  )

  it.each([
    ['diaria', 'Producción diaria'],
    ['ranking', 'Ranking de cosechadores']
  ])(
    'permite abrir directamente el reporte %s de la campaña',
    async (route, heading) => {
      mount('/reportes/' + route + '?campania=A-camp')
      await screen.findByRole('heading', { name: heading, exact: true })
      expect(await screen.findByLabelText('Campaña')).toHaveValue('A-camp')
      expect(screen.getByTestId('location')).toHaveTextContent(
        '/reportes/' + route + '?campania=A-camp'
      )
    }
  )
})
