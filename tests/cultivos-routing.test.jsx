import { describe, expect, it } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { Portal } from '../src/presentation/Portal.jsx'
import { crearPortal } from '../src/application/crearPortal.js'
import { fakePorts } from './support/fakePorts.js'
import { fakeHarvestAdmin } from './support/fakeHarvestAdmin.js'
import { fakeCultivosCosecha } from './support/fakeCultivosCosecha.js'

function montar({
  propio = false,
  path = '/cosecha',
  permisos = ['harvest.view', 'harvest.manage']
} = {}) {
  const ports = fakePorts({ autenticado: true, permisos: { A: permisos } })
  fakeHarvestAdmin(ports)
  fakeCultivosCosecha(ports, { propio })
  const portal = crearPortal(ports)
  render(
    <MemoryRouter initialEntries={[path]}>
      <Portal portal={portal} />
    </MemoryRouter>
  )
  return { ports, portal, user: userEvent.setup() }
}
describe('Integración de cultivos con Cosecha', () => {
  it('supervisor nuevo entra desde Cosecha y ve el configurador con la opción extra del selector', async () => {
    const { portal } = montar()
    await screen.findByLabelText('Nombre del cultivo')
    expect(screen.getByRole('combobox', { name: 'Campaña de cosecha' })).toHaveValue('')
    expect(
      screen.getByRole('option', { name: 'Agregar campaña / cultivo' })
    ).toBeInTheDocument()
    expect(portal.estadoActual().ruta.path).toBe('/cosecha/configurar')
    expect(document.querySelector('.crop-setup-layout')).toBeInTheDocument()
  })
  it('el selector alterna campañas y configurador desde una vista operativa', async () => {
    const { user, portal } = montar({
      propio: true,
      path: '/cosecha/registros?campania=A-camp'
    })
    const selector = await screen.findByRole('combobox', { name: 'Campaña de cosecha' })
    await waitFor(() => expect(selector).not.toBeDisabled())
    await user.selectOptions(selector, '')
    await screen.findByRole('tab', { name: 'Nueva campaña' })
    expect(portal.estadoActual().ruta.path).toBe('/cosecha/configurar')
    await waitFor(() =>
      expect(
        screen.getByRole('combobox', { name: 'Campaña de cosecha' })
      ).not.toBeDisabled()
    )
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Campaña de cosecha' }),
      'A-camp'
    )
    await waitFor(() =>
      expect(portal.estadoActual().ruta.path).toBe('/cosecha/generar')
    )
    expect(screen.queryByRole('tab', { name: 'Nuevo cultivo' })).not.toBeInTheDocument()
  })
  it('un enlace directo no muestra el formulario a un owner sin rol operativo', async () => {
    montar({
      path: '/cosecha/configurar',
      permisos: ['company.manage', 'reports.view']
    })
    await screen.findByRole('heading', { name: 'Acceso restringido' })
    expect(screen.queryByLabelText('Nombre del cultivo')).not.toBeInTheDocument()
  })
})
