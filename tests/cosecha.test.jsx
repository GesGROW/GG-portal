import { describe, it, expect } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { crearPortal } from '../src/application/crearPortal.js'
import { Portal } from '../src/presentation/Portal.jsx'
import { fakePorts } from './support/fakePorts.js'
import { fakeHarvestAdmin } from './support/fakeHarvestAdmin.js'
function montar(path, options = {}) {
  const ports = fakePorts({
      autenticado: true,
      permisos: { A: ['harvest.view', 'harvest.manage'] },
      ...options
    }),
    datos = fakeHarvestAdmin(ports),
    portal = crearPortal(ports)
  render(
    <MemoryRouter initialEntries={[path]}>
      <Portal portal={portal} />
    </MemoryRouter>
  )
  return { ports, datos, portal }
}
describe('Cosecha administrativa del Portal', () => {
  it('listado, filtros y detalle enlazan ticket, lote, asignación, trabajador y RegistroCosecha', async () => {
    montar('/cosecha/tickets')
    const user = userEvent.setup()
    await user.selectOptions(
      await screen.findByLabelText('Estado de consumo'),
      'UTILIZADO'
    )
    await user.click(await screen.findByRole('link', { name: 'Ver Ticket TK-A-USADO' }))
    await screen.findByRole('heading', { name: 'Ticket TK-A-USADO' })
    expect(screen.getAllByText('Trabajador A · 12345678').length).toBeGreaterThan(0)
    expect(
      screen.queryByRole('link', { name: 'Ver RegistroCosecha' })
    ).not.toBeInTheDocument()
    expect(screen.getByText('Versión 1')).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /Editar|Registrar cosecha/ })
    ).not.toBeInTheDocument()
    await user.click(screen.getByRole('link', { name: 'Ver asignación de origen' }))
    await screen.findByRole('heading', { name: 'Asignación de lote' })
    expect(screen.getByText(/no se permite reasignar/)).toBeInTheDocument()
  })
  it('ticket disponible no tiene registro y lote muestra progreso derivado', async () => {
    montar('/cosecha/tickets/TK-A-LIBRE')
    await screen.findByRole('heading', { name: 'Ticket TK-A-LIBRE' })
    expect(
      screen.getByText('Este ticket todavía no tiene RegistroCosecha.')
    ).toBeInTheDocument()
    expect(screen.getByRole('progressbar')).toHaveValue(1)
    expect(
      screen.queryByRole('link', { name: 'Ver RegistroCosecha' })
    ).not.toBeInTheDocument()
  })
  it('consulta no muestra generar y URL directa exige harvest.manage', async () => {
    montar('/cosecha/generar', { permisos: { A: ['harvest.view'] } })
    await screen.findByRole('heading', { name: 'Acceso restringido' })
    expect(screen.getByText(/Se requiere harvest.manage/)).toBeInTheDocument()
    expect(screen.queryByLabelText('Cantidad total de tickets')).not.toBeInTheDocument()
  })
  it('búsqueda y cambio de empresa eliminan resultados anteriores', async () => {
    montar('/cosecha/tickets', {
      empresas: ['A', 'B'],
      permisos: { A: ['harvest.view'], B: ['harvest.view'] }
    })
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: /Empresa A/ }))
    await user.type(
      await screen.findByLabelText('Buscar código de Ticket'),
      'TK-A-LIBRE'
    )
    await user.click(screen.getByRole('button', { name: 'Buscar' }))
    await waitFor(() =>
      expect(
        screen.queryByRole('link', { name: 'Ver Ticket TK-A-USADO' })
      ).not.toBeInTheDocument()
    )
    await user.click(screen.getByRole('button', { name: 'Menú de usuario' }))
    await user.selectOptions(screen.getByLabelText('Empresa activa'), 'B')
    await screen.findByRole('heading', { name: 'Bienvenido a GesGROW' })
    await user.click(screen.getByRole('button', { name: 'Módulos' }))
    await user.click(screen.getByRole('link', { name: 'Cosecha', exact: true }))
    await screen.findByRole('heading', { name: 'Lotes de tickets generados' })
    await screen.findByRole('cell', { name: 'B-lote' })
    expect(screen.queryByText('TK-A-LIBRE')).not.toBeInTheDocument()
  })
})
