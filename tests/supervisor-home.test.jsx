import { describe, it, expect, vi } from 'vitest'
import { act, render, screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { Portal } from '../src/presentation/Portal.jsx'
import { crearPortal } from '../src/application/crearPortal.js'
import { fakePorts } from './support/fakePorts.js'
import { fakeReportes } from './support/fakeReportes.js'

const supervisor = ['harvest.view', 'harvest.manage', 'harvest.operate', 'reports.view']
function montar({ opciones = {}, lista, cero = false, path = '/' } = {}) {
  const ports = fakePorts({
    autenticado: true,
    permisos: { A: [...supervisor] },
    modulos: { A: ['HARVEST'] },
    ...opciones
  })
  fakeReportes(ports, { vacio: cero })
  if (lista) ports.reportesHarvest.campanias = lista
  const campanias = vi.spyOn(ports.reportesHarvest, 'campanias'),
    reportes = vi.spyOn(ports.reportesHarvest, 'consultar')
  const portal = crearPortal(ports)
  render(
    <MemoryRouter initialEntries={[path]}>
      <Portal portal={portal} />
    </MemoryRouter>
  )
  return { ports, portal, campanias, reportes, user: userEvent.setup() }
}
const mensaje = /Agrega un cultivo para.*comenzar con la cosecha/
describe('Home de Supervisor de Cosecha', () => {
  it('sin campañas muestra el inicio de Cosecha y no consulta métricas ni permite comprar módulos', async () => {
    const { reportes } = montar({ lista: async () => [] })
    expect(await screen.findByText(mensaje)).toBeVisible()
    expect(
      screen.queryByRole('combobox', { name: 'Módulo', exact: true })
    ).not.toBeInTheDocument()
    expect(screen.queryByRole('listbox', { name: 'Campaña' })).not.toBeInTheDocument()
    expect(screen.queryByText(/Adquiere un módulo/)).not.toBeInTheDocument()
    expect(reportes).not.toHaveBeenCalled()
    expect(screen.getByRole('region', { name: 'Bienvenida' })).toHaveTextContent(
      'Ana Gestión'
    )
    expect(
      screen.queryByRole('button', { name: 'Configuración', exact: true })
    ).not.toBeInTheDocument()
  })
  it('con campaña muestra el resumen real de Cosecha sin selector de módulos', async () => {
    montar()
    const produccion = await screen.findByRole('region', {
      name: 'Producción',
      exact: true
    })
    expect(within(produccion).getByText('43')).toBeVisible()
    expect(await screen.findByText('Ana A')).toBeVisible()
    expect(screen.getByRole('listbox', { name: 'Campaña' })).toHaveValue('A-camp')
    expect(
      screen.queryByRole('combobox', { name: 'Módulo', exact: true })
    ).not.toBeInTheDocument()
    expect(screen.queryByText('Marco Góngora')).not.toBeInTheDocument()
    expect(screen.queryByText(mensaje)).not.toBeInTheDocument()
  })
  it('una campaña sin producción muestra cero y no el inicio sin campañas', async () => {
    montar({ cero: true })
    expect(
      await screen.findByText('Nadie ha cosechado aún')
    ).toBeVisible()
    expect(screen.queryByText('Sin datos de producción en esta campaña.')).not.toBeInTheDocument()
    expect(screen.queryByText('Sin datos para los filtros seleccionados.')).not.toBeInTheDocument()
    expect(screen.getByText('Jaberos').nextElementSibling).toHaveTextContent('0')
    expect(screen.queryByText(mensaje)).not.toBeInTheDocument()
    expect(screen.getByRole('listbox', { name: 'Campaña' })).toBeInTheDocument()
  })
  it('actualizar el estado inicial descubre una nueva campaña y carga sus reportes', async () => {
    const { ports, user } = montar({ lista: async () => [] })
    await screen.findByText(mensaje)
    ports.reportesHarvest.campanias = async () => [
      { id: 'A-camp', nombre: 'Nueva campaña', estado: 'ACTIVA' }
    ]
    await user.click(screen.getByRole('button', { name: 'Actualizar campañas' }))
    await screen.findByText('Ana A')
    expect(screen.queryByText(mensaje)).not.toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Nueva campaña' })).toBeInTheDocument()
  })
  it('cambiar de campaña actualiza producción, ranking y lotes conservando el foco', async () => {
    const { user, reportes } = montar()
    await screen.findByText('Ana A')
    reportes.mockClear()
    const selector = screen.getByRole('listbox', { name: 'Campaña' })
    await user.selectOptions(selector, 'A-cerrada')
    await waitFor(() => expect(reportes).toHaveBeenCalledTimes(3))
    expect(reportes.mock.calls.map(([, f]) => f.tipo).sort()).toEqual([
      'DASHBOARD',
      'LOTES',
      'RANKING'
    ])
    expect(reportes.mock.calls.every(([, f]) => f.campaniaId === 'A-cerrada')).toBe(
      true
    )
    expect(selector).toHaveFocus()
  })
  it('una campaña ajena en URL no consulta métricas ni muestra el inicio vacío', async () => {
    const { reportes } = montar({ path: '/?campania=B-camp' })
    expect(await screen.findByRole('alert')).toHaveTextContent('Campaña ajena')
    expect(reportes).not.toHaveBeenCalled()
    expect(screen.queryByText(mensaje)).not.toBeInTheDocument()
  })
  it('un fallo de red al cargar campañas muestra el error y no simula un alta pendiente', async () => {
    montar({
      lista: async () => {
        throw new Error('No se pudo consultar campañas')
      }
    })
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No se pudo consultar campañas'
    )
    expect(screen.queryByText(mensaje)).not.toBeInTheDocument()
  })
  it('sin HARVEST habilitado informa al supervisor sin ofrecerle compras ni consultar datos', async () => {
    const { campanias, reportes } = montar({ opciones: { modulos: { A: [] } } })
    expect(
      await screen.findByText(
        'Cosecha no está habilitado para tu empresa. Consulta al owner.'
      )
    ).toBeVisible()
    expect(campanias).not.toHaveBeenCalled()
    expect(reportes).not.toHaveBeenCalled()
    expect(screen.queryByText(/Adquiere un módulo/)).not.toBeInTheDocument()
  })
  it('sin permiso de reportes no consulta campañas ni métricas', async () => {
    const { campanias, reportes } = montar({
      opciones: { permisos: { A: ['harvest.view'] } }
    })
    await screen.findByText(/Tu cuenta no tiene acceso al resumen de Cosecha/)
    expect(campanias).not.toHaveBeenCalled()
    expect(reportes).not.toHaveBeenCalled()
  })
  it('revocar el módulo retira el resumen y sus datos', async () => {
    const { ports, portal } = montar()
    await screen.findByText('Ana A')
    ports.modulos.A = []
    await act(async () => portal.revalidar())
    await screen.findByText(
      'Cosecha no está habilitado para tu empresa. Consulta al owner.'
    )
    expect(screen.queryByText('Ana A')).not.toBeInTheDocument()
    expect(screen.queryByText('43')).not.toBeInTheDocument()
  })
  it('cambiar empresa descarta una lista tardía y muestra solo el contexto nuevo', async () => {
    let resolver, inicio
    const iniciada = new Promise((r) => (inicio = r))
    const { user } = montar({
      opciones: {
        empresas: ['A', 'B'],
        permisos: { A: supervisor, B: supervisor },
        modulos: { A: ['HARVEST'], B: ['HARVEST'] }
      },
      lista: async (t) => {
        if (t === 'A') {
          inicio()
          await new Promise((r) => (resolver = r))
        }
        return [{ id: t + '-camp', nombre: 'Campaña ' + t, estado: 'ACTIVA' }]
      }
    })
    await user.click(await screen.findByRole('button', { name: /Empresa A/ }))
    await iniciada
    await user.click(screen.getByRole('button', { name: 'Menú de usuario' }))
    await user.selectOptions(screen.getByLabelText('Empresa activa'), 'B')
    await screen.findByText('Ana B')
    await act(async () => resolver())
    expect(screen.queryByText('Ana A')).not.toBeInTheDocument()
    expect(screen.queryByRole('option', { name: 'Campaña A' })).not.toBeInTheDocument()
    expect(screen.getByRole('listbox', { name: 'Campaña' })).toHaveValue('B-camp')
  })
})
