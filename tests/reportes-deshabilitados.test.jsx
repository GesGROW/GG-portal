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

describe('Reportes temporalmente fuera del Portal', () => {
  it('los accesos del Home y el menú lateral no navegan con mouse ni teclado', async () => {
    mount()
    const user = userEvent.setup()
    await screen.findByText('Ana A')
    for (const name of ['Ver producción diaria', 'Ver ranking completo']) {
      const link = screen.getByRole('link', { name })
      expect(link).toHaveAttribute('aria-disabled', 'true')
      expect(link).not.toHaveAttribute('href')
      await user.click(link)
      await user.keyboard('{Enter}')
      expect(screen.getByTestId('location')).toHaveTextContent(/^\/$/)
    }
    await user.hover(screen.getByRole('button', { name: 'Módulos', exact: true }))
    expect(
      screen.queryByRole('link', { name: 'Reportes', exact: true })
    ).not.toBeInTheDocument()
    expect(screen.getByTestId('location')).toHaveTextContent(/^\/$/)
    expect(screen.getByRole('region', { name: 'Módulos', exact: true })).toBeVisible()
  })

  it.each([
    '/reportes',
    '/reportes/resumen',
    '/reportes/ranking',
    '/reportes/diaria',
    '/reportes/lotes'
  ])('la URL %s vuelve al Home sin mostrar reportes', async (path) => {
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
  })
})
