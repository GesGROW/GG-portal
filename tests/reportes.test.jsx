import { describe, it, expect, vi } from 'vitest'
import { render, screen, within, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { crearPortal } from '../src/application/crearPortal.js'
import { Portal } from '../src/presentation/Portal.jsx'
import { fakePorts } from './support/fakePorts.js'
import { fakeReportes } from './support/fakeReportes.js'
import { ServicioNoDisponible } from '../src/ports/errores.js'
// Cobertura del código conservado de reportes, fuera de la configuración publicada.
vi.mock('../src/presentation/reportesDisponibles.js', () => ({
  REPORTES_HABILITADOS: true
}))
function montar(path = '/', options = {}, datos = {}) {
  const ports = fakePorts({ autenticado: true, ...options }),
    extra = fakeReportes(ports, datos),
    portal = crearPortal(ports)
  render(
    <MemoryRouter initialEntries={[path]}>
      <Portal portal={portal} />
    </MemoryRouter>
  )
  return { ports, portal, ...extra }
}
describe('Dashboard y reportes del Portal', () => {
  it('dashboard con métricas del servidor y actualización manual', async () => {
    const { ports } = montar(),
      user = userEvent.setup()
    await screen.findByRole('heading', { name: 'Bienvenido a GesGROW' })
    expect(screen.queryByText('Su operación, en perspectiva')).not.toBeInTheDocument()
    expect(screen.queryByText('Dashboard operativo')).not.toBeInTheDocument()
    expect(await screen.findByText('43')).toBeInTheDocument()
    expect(
      within(screen.getByText('Jabas hoy').closest('div')).getByText('23')
    ).toBeInTheDocument()
    expect(screen.getByText('Jabas hoy')).toBeInTheDocument()
    expect(screen.getByText(/Última actualización/)).toBeInTheDocument()
    const antes = ports.calls.filter((c) => c[0] === 'consultarReporte').length
    await user.click(screen.getByRole('button', { name: 'Actualizar datos' }))
    await waitFor(() =>
      expect(
        ports.calls.filter((c) => c[0] === 'consultarReporte').length
      ).toBeGreaterThan(antes)
    )
  })
  it('dashboard sin datos diferencia métricas cero y ausencia de campañas', async () => {
    montar('/', {}, { vacio: true })
    await screen.findByText('Nadie ha cosechado aún')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
  it('consulta campañas activas y cerradas y resumen sin usar Campaign.manage', async () => {
    const { ports } = montar('/reportes/resumen', {
        permisos: { A: ['reports.view'] }
      }),
      user = userEvent.setup()
    await screen.findByRole('heading', { name: 'Resumen de campaña' })
    await user.selectOptions(screen.getByLabelText('Campaña'), 'A-cerrada')
    await waitFor(() =>
      expect(
        ports.calls.some(
          (c) => c[0] === 'consultarReporte' && c[2].campaniaId === 'A-cerrada'
        )
      ).toBe(true)
    )
    expect(screen.queryByRole('link', { name: /Cosecha/ })).not.toBeInTheDocument()
  })
  it('ranking filtra nombre/DNI conservando posición, cambia periodo y exporta filas visibles', async () => {
    const { archivos, ports } = montar('/reportes/ranking'),
      user = userEvent.setup()
    await screen.findByRole('table', { name: 'Ranking de cosechadores' })
    await user.type(screen.getByLabelText('Buscar por nombre o DNI'), '87654321')
    const tabla = await screen.findByRole('table', { name: 'Ranking de cosechadores' })
    await waitFor(() =>
      expect(within(tabla).queryByText('Ana A')).not.toBeInTheDocument()
    )
    expect(within(screen.getByRole('table')).getByText('2')).toBeInTheDocument()
    for (const periodo of ['HOY', 'SEMANA', 'MES', 'CAMPANIA']) {
      await user.click(
        screen.getByRole('button', {
          name: { HOY: 'Hoy', SEMANA: 'Semana', MES: 'Mes', CAMPANIA: 'Campaña' }[
            periodo
          ],
          exact: true
        })
      )
      await waitFor(() =>
        expect(
          ports.calls.filter((c) => c[0] === 'consultarReporte').at(-1)[2].periodo
        ).toBe(periodo)
      )
    }
    await user.click(await screen.findByRole('button', { name: 'Exportar CSV' }))
    await waitFor(() => expect(archivos.length).toBe(1))
    expect(archivos[0].contenido).toContain('Bruno A')
    expect(archivos[0].contenido).not.toContain('Ana A')
  })
  it('producción diaria usa exactamente los valores de la tabla en las barras accesibles', async () => {
    montar('/reportes/diaria')
    const tabla = await screen.findByRole('table', { name: 'Producción diaria' })
    expect(within(tabla).getByText('23')).toBeInTheDocument()
    expect(within(tabla).getByText('20')).toBeInTheDocument()
    expect(within(tabla).getByText('14 oct. 2026')).toBeInTheDocument()
    expect(within(tabla).queryByText('2026-10-14')).not.toBeInTheDocument()
    expect(
      screen.getByRole('meter', { name: '14 oct. 2026: 23 jabas' })
    ).toHaveAttribute('value', '23')
    expect(
      screen.getByRole('meter', { name: '13 oct. 2026: 20 jabas' })
    ).toHaveAttribute('value', '20')
    expect(
      screen.getByRole('img', { name: /Gráfica de producción diaria/ })
    ).toBeInTheDocument()
  })
  it('producción por lote operativo con filtro de variedad y orden existente', async () => {
    ;(montar('/reportes/lotes'),
      await screen.findByRole('table', { name: 'Producción por lote y variedad' }))
    const user = userEvent.setup()
    await user.selectOptions(screen.getByLabelText('Orden'), 'az')
    await waitFor(() =>
      expect(
        within(screen.getByRole('table')).getAllByRole('row')[1]
      ).toHaveTextContent('L1')
    )
    await user.type(screen.getByLabelText('Buscar lote o variedad'), 'Roja')
    await waitFor(() =>
      expect(
        within(screen.getByRole('table')).queryByText('Verde')
      ).not.toBeInTheDocument()
    )
    expect(within(screen.getByRole('table')).getByText('Roja')).toBeInTheDocument()
  })
  it('acceso directo sin permiso o sin módulo denegado; dashboard base distingue motivo', async () => {
    montar('/reportes/diaria', { permisos: { A: ['harvest.manage'] } })
    await screen.findByRole('heading', { name: 'Acceso restringido' })
    expect(screen.getByText(/No tiene permiso/)).toBeInTheDocument()
  })
  it('el detalle de lote conserva métricas secundarias y el CSV conserva su dataset completo', async () => {
    const { archivos } = montar('/reportes/lotes')
    const tabla = await screen.findByRole('table', {
      name: 'Producción por lote y variedad'
    })
    const row = within(tabla).getAllByRole('row')[1]
    expect(within(tabla).getAllByRole('columnheader')).toHaveLength(4)
    const user = userEvent.setup()
    await user.click(within(row).getByText('Ver detalle'))
    expect(within(row).getByText('Última actividad')).toBeVisible()
    expect(within(row).getByText('Cosechadores')).toBeVisible()
    expect(within(row).getByText('Sesiones')).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Exportar CSV' }))
    await waitFor(() => expect(archivos).toHaveLength(1))
    expect(archivos[0].contenido).toContain('Última actividad')
    expect(archivos[0].contenido).toContain('2026-10-14T15:00:00Z')
    expect(archivos[0].contenido).toContain('Sur')
  })
  it('HARVEST deshabilitado deniega URL y navegación de reportes', async () => {
    montar('/reportes/resumen', { modulos: { A: [] } })
    await screen.findByRole('heading', { name: 'Acceso restringido' })
    expect(screen.getByText(/no tiene el módulo requerido/)).toBeInTheDocument()
  })
  it('inicio sin reports.view conserva áreas permitidas y explica la ausencia de dashboard', async () => {
    const { ports } = montar('/', { permisos: { A: ['harvest.view'] } })
    await screen.findByText(/Tu cuenta no tiene acceso al resumen de Cosecha/)
    await userEvent.setup().click(screen.getByRole('button', { name: 'Módulos' }))
    expect(
      within(
        screen.getByRole('navigation', { name: 'Navegación principal' })
      ).getByRole('link', { name: 'Cosecha', exact: true })
    ).toBeInTheDocument()
    expect(ports.calls.some((c) => c[0] === 'consultarReporte')).toBe(false)
  })
  it('inicio sin HARVEST explica módulo deshabilitado', async () => {
    const { ports } = montar('/', { modulos: { A: [] } })
    await screen.findByText('Adquiere un módulo para poder ver su resumen')
    expect(ports.calls.some((c) => c[0] === 'consultarReporte')).toBe(false)
  })
  it('empresa sin campañas muestra ausencia de campañas, no error ni datos anteriores', async () => {
    const { ports } = montar('/reportes')
    await screen.findByRole('heading', { name: 'Resumen de campaña' })
    ports.reportesHarvest.campanias = async () => []
    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: 'Actualizar campañas' }))
    await screen.findByText('Sin campañas disponibles para esta empresa.')
    expect(
      screen.queryByRole('button', { name: 'Exportar CSV' })
    ).not.toBeInTheDocument()
  })
  it('selección de campaña ajena por URL no consulta ni muestra datos', async () => {
    const { ports } = montar('/reportes/resumen?campania=B-camp')
    await screen.findByText(/Campaña ajena o no disponible/)
    expect(ports.calls.some((c) => c[0] === 'consultarReporte')).toBe(false)
  })
  it('sin datos, cargando, error de conexión y reintento diferenciados', async () => {
    const { ports } = montar('/reportes/diaria', {}, { vacio: true }),
      user = userEvent.setup()
    await screen.findByText('Sin datos para los filtros seleccionados.')
    const original = ports.reportesHarvest.consultar
    ports.reportesHarvest.consultar = async () => {
      throw new ServicioNoDisponible()
    }
    await user.click(screen.getByRole('button', { name: 'Actualizar datos' }))
    await screen.findByRole('heading', { name: 'Error de conexión' })
    ports.reportesHarvest.consultar = original
    await user.click(screen.getByRole('button', { name: 'Reintentar' }))
    await screen.findByText('Sin datos para los filtros seleccionados.')
  })
  it('cambiar Tenant limpia reporte anterior y descarta respuesta tardía', async () => {
    const { ports } = montar('/reportes/ranking', {
        empresas: ['A', 'B'],
        permisos: { A: ['reports.view'], B: ['reports.view'] }
      }),
      user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: /Empresa A/ }))
    await screen.findByText('Ana A')
    const original = ports.reportesHarvest.consultar
    let resolver, inicio
    const iniciada = new Promise((r) => (inicio = r))
    ports.reportesHarvest.consultar = async (...a) => {
      const d = await original(...a)
      if (a[0] === 'A') {
        inicio()
        await new Promise((r) => (resolver = r))
      }
      return d
    }
    await user.click(screen.getByRole('button', { name: 'Actualizar datos' }))
    await iniciada
    expect(screen.getByText('Cargando reportes…')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Menú de usuario' }))
    await user.selectOptions(screen.getByLabelText('Empresa activa'), 'B')
    await screen.findByRole('heading', { name: 'Bienvenido a GesGROW' })
    await act(async () => resolver())
    expect(screen.queryByText('Ana A')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Módulos' }))
    await user.click(screen.getByRole('link', { name: 'Cosecha', exact: true }))
    await user.click(
      await screen.findByRole('link', { name: 'Ranking de cosechadores' })
    )
    await screen.findByText('Ana B')
    expect(screen.queryByText('Ana A')).not.toBeInTheDocument()
  })
})
