import { expect, it } from 'vitest'
import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { Portal } from '../src/presentation/Portal.jsx'
import { crearPortal } from '../src/application/crearPortal.js'
import { fakePorts } from './support/fakePorts.js'
import { fakeHarvestAdmin } from './support/fakeHarvestAdmin.js'
function mount(path = '/cosecha') {
  const ports = fakePorts({
    autenticado: true,
    permisos: { A: ['harvest.view', 'harvest.manage'] }
  })
  fakeHarvestAdmin(ports)
  render(
    <MemoryRouter initialEntries={[path]}>
      <Portal portal={crearPortal(ports)} />
    </MemoryRouter>
  )
  return ports
}
it('mantiene cabecera, contenedor y sidebar durante la autorización de otra sección', async () => {
  const ports = mount()
  await screen.findByLabelText('Cantidad de personas')
  const heading = screen.getByRole('heading', { name: 'Cosecha', exact: true })
  const main = screen.getByRole('main')
  const tabs = screen.getByRole('navigation', { name: 'Opciones de Cosecha' })
  let release
  const gate = new Promise((resolve) => {
    release = resolve
  })
  ports.setResolver(() => gate)
  await userEvent
    .setup()
    .click(screen.getByRole('link', { name: 'Lotes de tickets generados' }))
  expect(heading).toBeInTheDocument()
  expect(tabs).toBeInTheDocument()
  expect(screen.getByRole('main')).toBe(main)
  ports.setResolver(null)
  await act(async () => release())
  await screen.findByRole('table', { name: 'Lotes de tickets generados' })
  expect(screen.getByRole('heading', { name: 'Cosecha', exact: true })).toBe(heading)
})
it('la entrada muestra generación y recorre subopciones solo dentro del contenedor', async () => {
  mount('/cosecha?campania=A-camp')
  const user = userEvent.setup()
  await screen.findByLabelText('Cantidad de personas')
  const tabs = () =>
    within(screen.getByRole('navigation', { name: 'Secciones de Tickets' }))
  expect(
    tabs().getByRole('link', { name: 'Generación e impresión de lotes de tickets' })
  ).toHaveAttribute('aria-current', 'page')
  await user.click(tabs().getByRole('link', { name: 'Lotes de tickets generados' }))
  await screen.findByRole('cell', { name: 'A-lote' })
  await user.click(tabs().getByRole('link', { name: 'Lotes de tickets asignados' }))
  await screen.findByRole('table', { name: 'Lotes de tickets asignados' })
  expect(
    screen.queryByRole('link', { name: 'Registros', exact: true })
  ).not.toBeInTheDocument()
})
