import { expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router'
import { Portal } from '../src/presentation/Portal.jsx'
import { crearPortal } from '../src/application/crearPortal.js'
import { fakePorts } from './support/fakePorts.js'
import { fakeHarvestAdmin } from './support/fakeHarvestAdmin.js'
function Location() {
  const l = useLocation()
  return (
    <output data-testid="location">
      {l.pathname}
      {l.search}
    </output>
  )
}
function mount(path, permisos = ['harvest.view', 'harvest.manage']) {
  const ports = fakePorts({ autenticado: true, permisos: { A: permisos } })
  fakeHarvestAdmin(ports)
  render(
    <MemoryRouter initialEntries={[path]}>
      <Location />
      <Portal portal={crearPortal(ports)} />
    </MemoryRouter>
  )
  return ports
}
it.each(['/cosecha', '/cosecha/registros', '/cosecha/registros/recurso-antiguo'])(
  'el enlace %s abre Generación y elimina la página antigua',
  async (path) => {
    const p = mount(path + '?campania=A-camp')
    await screen.findByLabelText('Cantidad de personas')
    expect(screen.getByTestId('location')).toHaveTextContent(
      '/cosecha/generar?campania=A-camp'
    )
    expect(
      screen.queryByRole('table', { name: 'Registros de cosecha' })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('link', { name: 'Registros', exact: true })
    ).not.toBeInTheDocument()
    expect(p.calls.some((c) => c[0] === 'listarHarvest' && c[2] === 'registros')).toBe(
      false
    )
  }
)
it('el enlace antiguo de consulta abre lotes sin ofrecer generación', async () => {
  mount('/cosecha/registros?campania=A-camp', ['harvest.view'])
  await screen.findByRole('heading', { name: 'Lotes de tickets generados' })
  expect(screen.getByTestId('location')).toHaveTextContent(
    '/cosecha/lotes?campania=A-camp'
  )
  expect(screen.queryByLabelText('Cantidad de personas')).not.toBeInTheDocument()
})
