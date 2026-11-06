import { describe, it, expect, vi } from 'vitest'
import { render, screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { Portal } from '../src/presentation/Portal.jsx'
import { ConfiguracionCampania } from '../src/presentation/ConfiguracionCampania.jsx'
import { crearPortal } from '../src/application/crearPortal.js'
import { fakePorts } from './support/fakePorts.js'
import { fakeHarvestAdmin } from './support/fakeHarvestAdmin.js'
import { fakeCultivosCosecha } from './support/fakeCultivosCosecha.js'

function montar({ permisos = ['harvest.manage'], directo = true } = {}) {
  const ports = fakePorts({ autenticado: true, permisos: { A: permisos } })
  fakeHarvestAdmin(ports); fakeCultivosCosecha(ports, { propio: true })
  const portal = crearPortal(ports)
  render(<MemoryRouter initialEntries={[directo ? '/cosecha/ajustes?campania=A-camp' : '/cosecha/generar?campania=A-camp']}>
    <Portal portal={portal} />
  </MemoryRouter>)
  return { ports, portal, user: userEvent.setup() }
}
describe('Configuración de campaña', () => {
  it('separa Campaña y Bono dentro de Configuración y conserva Agregar', async () => {
    const { user } = montar()
    await screen.findByLabelText('Nombre de la campaña')
    const nav = screen.getByRole('navigation', { name: 'Secciones de configuración' })
    await user.click(within(nav).getByRole('link', { name: 'Bono', exact: true }))
    expect(await screen.findByRole('checkbox', { name: 'Habilitar bono' })).toBeInTheDocument()
    expect(screen.queryByLabelText('Nombre de la campaña')).not.toBeInTheDocument()
    await user.click(within(nav).getByRole('link', { name: 'Configuración general de la campaña' }))
    await screen.findByLabelText('Nombre de la campaña')
    expect(screen.queryByRole('checkbox', { name: 'Habilitar bono' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('link', { name: 'Agregar', exact: true }))
    expect(await screen.findByRole('tab', { name: 'Nueva campaña' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Nuevo cultivo' })).toBeInTheDocument()
  })
  it('se abre desde Cosecha, conserva la campaña y guarda nombre y fechas históricas', async () => {
    const { user, ports } = montar({ directo: false })
    await screen.findByRole('navigation', { name: 'Opciones de Cosecha' })
    await waitFor(() => expect(screen.getByRole('combobox', { name: 'Campaña de cosecha' })).not.toBeDisabled())
    await user.selectOptions(screen.getByRole('combobox', { name: 'Campaña de cosecha' }), '')
    await user.click(await screen.findByRole('link', { name: 'Configuración', exact: true }))
    const nombre = await screen.findByLabelText('Nombre de la campaña')
    expect(screen.getByRole('combobox', { name: 'Campaña de cosecha' })).toHaveValue('')
    expect(screen.getByLabelText('Fecha de inicio')).not.toHaveAttribute('min')
    expect(screen.getByRole('button', { name: 'Guardar cambios' })).toBeDisabled()
    await user.clear(nombre); await user.type(nombre, 'Temporada corregida')
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))
    await screen.findByText('Configuración guardada.')
    await waitFor(() => expect(screen.getByLabelText('Nombre de la campaña')).toHaveValue('Temporada corregida'))
    expect(ports.calls.filter(c => c[0] === 'guardarConfiguracionCampania')).toHaveLength(1)
    expect(screen.getByRole('button', { name: 'Guardar cambios' })).toBeDisabled()
  })
  it('agrega variedad y lote y exige relacionarlos antes de guardar', async () => {
    const { user, ports } = montar()
    await screen.findByLabelText('Nombre de la campaña')
    await user.click(screen.getByRole('button', { name: 'Agregar variedad' }))
    await user.type(screen.getByRole('textbox', { name: 'Variedad 3' }), 'Emerald')
    await user.click(screen.getByRole('button', { name: 'Agregar lote' }))
    await user.type(screen.getByLabelText('Nombre del lote 2'), 'Sector norte')
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))
    await screen.findByRole('alert')
    expect(ports.calls.filter(c => c[0] === 'guardarConfiguracionCampania')).toHaveLength(0)
    const lote = screen.getByRole('group', { name: 'Variedades del lote 2' })
    await user.click(within(lote).getByRole('checkbox', { name: 'Emerald' }))
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))
    await screen.findByText('Configuración guardada.')
    const d = ports.calls.find(c => c[0] === 'guardarConfiguracionCampania')[4]
    expect(d.lotes[1].variedades).toEqual([d.variedades[2].id])
  })
  it('descartar recupera el formulario sin realizar escrituras', async () => {
    const { user, ports } = montar()
    const nombre = await screen.findByLabelText('Nombre de la campaña')
    const anterior = nombre.value
    await user.clear(nombre); await user.type(nombre, 'Descartar esto')
    await user.click(screen.getByRole('button', { name: 'Descartar cambios' }))
    expect(nombre).toHaveValue(anterior)
    expect(ports.calls.some(c => c[0] === 'guardarConfiguracionCampania')).toBe(false)
  })
  it('un lector no accede al formulario ni mediante enlace directo', async () => {
    const { ports } = montar({ permisos: ['harvest.view'] })
    await screen.findByRole('heading', { name: 'Acceso restringido' })
    expect(screen.queryByLabelText('Nombre de la campaña')).not.toBeInTheDocument()
    expect(ports.calls.some(c => c[0] === 'configuracionCampania')).toBe(false)
  })
  it('un error conserva cambios para reintentar y permite recargar una versión reciente', async () => {
    const { user, ports } = montar()
    const nombre = await screen.findByLabelText('Nombre de la campaña')
    ports.harvestAdmin.guardarConfiguracionCampania = vi.fn().mockRejectedValue(new Error('La configuración cambió. Recarga y revisa'))
    await user.clear(nombre); await user.type(nombre, 'Mi borrador')
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('La configuración cambió')
    expect(nombre).toHaveValue('Mi borrador')
    await user.click(screen.getByRole('button', { name: 'Recargar configuración' }))
    await waitFor(() => expect(screen.getByLabelText('Nombre de la campaña')).not.toHaveValue('Mi borrador'))
  })
  it('muestra variedades inactivas asociadas sin ofrecerlas a lotes nuevos', async () => {
    const ports = fakePorts(); fakeHarvestAdmin(ports); fakeCultivosCosecha(ports, { propio: true })
    const d = await ports.harvestAdmin.configuracionCampania('A', 'A-camp')
    d.variedades[0].activo = false
    render(<MemoryRouter><ConfiguracionCampania servicio={{ configuracionCampania: async () => d }} campania={{ id: 'A-camp' }} /></MemoryRouter>)
    const inactiva = await screen.findByRole('checkbox', { name: `${d.variedades[0].nombre} (inactiva)` })
    expect(inactiva).toBeChecked()
    expect(inactiva).toBeDisabled()
    await userEvent.setup().click(screen.getByRole('button', { name: 'Agregar lote' }))
    const nuevo = screen.getByRole('group', { name: 'Variedades del lote 2' })
    expect(within(nuevo).queryByRole('checkbox', { name: /inactiva/ })).not.toBeInTheDocument()
    expect(within(nuevo).getByRole('checkbox', { name: d.variedades[1].nombre })).toBeEnabled()
  })
  it('protege nombres históricos y desactivación de lotes con sesión activa', async () => {
    const ports = fakePorts(); fakeHarvestAdmin(ports); fakeCultivosCosecha(ports, { propio: true })
    const d = await ports.harvestAdmin.configuracionCampania('A', 'A-camp')
    d.variedades[0].protegida = true; d.lotes[0].protegido = true; d.lotes[0].sesionActiva = true
    render(<MemoryRouter><ConfiguracionCampania servicio={{ configuracionCampania: async () => d }} campania={{ id: 'A-camp' }} /></MemoryRouter>)
    expect(await screen.findByLabelText('Variedad 1')).toHaveAttribute('readonly')
    expect(screen.getByLabelText('Nombre del lote 1')).toHaveAttribute('readonly')
    expect(screen.getByRole('checkbox', { name: 'Lote activo' })).toBeDisabled()
  })
})
