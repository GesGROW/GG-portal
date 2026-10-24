import { describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { Portal } from '../src/presentation/Portal.jsx'
import { NavigationRail } from '../src/presentation/Navigation.jsx'
import { crearPortal } from '../src/application/crearPortal.js'
import { fakePorts } from './support/fakePorts.js'
import { fakeHarvestAdmin } from './support/fakeHarvestAdmin.js'
import { fakeReportes } from './support/fakeReportes.js'
// Las pantallas previas de reportes se verifican aisladas del bloqueo temporal.
vi.mock('../src/presentation/reportesDisponibles.js', () => ({
  REPORTES_HABILITADOS: true
}))

function mount(path = '/reportes/ranking', options = {}, configure = () => {}) {
  const ports = fakePorts({ autenticado: true, ...options })
  const reportes = fakeReportes(ports)
  fakeHarvestAdmin(ports)
  configure(ports)
  const portal = crearPortal(ports)
  render(
    <MemoryRouter initialEntries={[path]}>
      <Portal portal={portal} />
    </MemoryRouter>
  )
  return { ports, portal, ...reportes }
}
const ready = () => screen.findByRole('table', { name: 'Ranking de cosechadores' })
const tray = () => screen.getByRole('region', { name: 'Bandeja de comparación' })

describe('Widgets de Home', () => {
  it.each([1, 3])(
    'abre el reporte diario desde el home y conserva sus %s puntos',
    async (count) => {
      mount('/', {}, (ports) => {
        const original = ports.reportesHarvest.consultar
        ports.reportesHarvest.consultar = async (...args) => {
          const result = await original(...args)
          if (result.tipo === 'DIARIA') {
            result.datos.produccion = Array.from({ length: count }, (_, i) => ({
              fecha: `2026-10-${14 - i}`,
              total_jabas: 23 - i,
              total_cosechadores: 1,
              total_sesiones: 2
            }))
          }
          return result
        }
      })
      expect(
        await screen.findByRole('heading', { name: 'Clima no configurado' })
      ).toBeInTheDocument()
      await userEvent
        .setup()
        .click(await screen.findByRole('link', { name: 'Ver producción diaria' }))
      const table = await screen.findByRole('table', { name: 'Producción diaria' })
      expect(within(table).getAllByRole('row')).toHaveLength(count + 1)
      expect(screen.getAllByRole('meter')).toHaveLength(count)
      for (let i = 0; i < count; i++)
        expect(screen.getAllByRole('meter')[i]).toHaveAttribute('value', String(23 - i))
      expect(within(table).queryByText('2026-10-14')).not.toBeInTheDocument()
    }
  )
})

describe('Sidebar actualizado de Figma', () => {
  const rutas = [
    { path: '/', nombre: 'Inicio' },
    { path: '/cosecha', nombre: 'Cosecha' },
    { path: '/reportes', nombre: 'Reportes' },
    { path: '/estructura', nombre: 'Estructura agrícola' },
    { path: '/campanias', nombre: 'Campañas' },
    { path: '/personal', nombre: 'Personal' },
    { path: '/configuracion', nombre: 'Configuración' }
  ]
  function navigation({ routes = rutas, puedeGenerar = true } = {}) {
    return render(
      <MemoryRouter>
        <NavigationRail
          navegacion={routes}
          path="/"
          mobileOpen={false}
          onClose={() => {}}
          puedeGenerar={puedeGenerar}
        />
        <button>Fuera del menú</button>
      </MemoryRouter>
    )
  }
  it('usa tres accesos y permite flechas, foco y Escape', async () => {
    navigation()
    const user = userEvent.setup()
    const modules = screen.getByRole('button', { name: 'Módulos' })
    const settings = screen.getByRole('button', { name: 'Configuración' })
    expect(
      screen.getByRole('link', { name: 'Inicio', exact: true })
    ).toBeInTheDocument()
    expect(modules).toHaveAttribute('aria-expanded', 'false')
    await user.hover(modules)
    expect(modules).toHaveAttribute('aria-expanded', 'true')
    expect(
      screen.getByRole('link', { name: 'Cosecha', exact: true })
    ).toBeInTheDocument()
    fireEvent.mouseLeave(modules.closest('aside'), {
      relatedTarget: screen.getByRole('button', { name: 'Fuera del menú' })
    })
    expect(modules).toHaveAttribute('aria-expanded', 'false')
    act(() => modules.focus())
    await user.keyboard('{ArrowDown}')
    expect(settings).toHaveFocus()
    expect(screen.getByRole('link', { name: 'Usuarios y accesos' })).toHaveAttribute(
      'href',
      '/configuracion/usuarios'
    )
    await user.keyboard('{Escape}')
    expect(settings).toHaveFocus()
    expect(settings).toHaveAttribute('aria-expanded', 'false')
    await user.keyboard('{Home}')
    expect(screen.getByRole('link', { name: 'Inicio', exact: true })).toHaveFocus()
  })
  it('Cosecha es un único enlace, sin opciones anidadas', async () => {
    navigation()
    const user = userEvent.setup()
    await user.hover(screen.getByRole('button', { name: 'Módulos' }))
    const panel = within(screen.getByRole('region', { name: 'Módulos' }))
    expect(panel.getByRole('link', { name: 'Cosecha', exact: true })).toHaveAttribute(
      'href',
      '/cosecha/generar'
    )
    expect(panel.getAllByRole('link')).toHaveLength(1)
    for (const name of [
      'Registros',
      'Tickets',
      'Reportes',
      'Cultivos y campañas',
      'Generación',
      'Lotes',
      'Asignaciones'
    ])
      expect(panel.queryByRole('link', { name, exact: true })).not.toBeInTheDocument()
    expect(
      panel.queryByRole('button', { name: 'Opciones de tickets' })
    ).not.toBeInTheDocument()
  })
  it('Escape cierra el panel y devuelve el foco a Módulos', async () => {
    navigation()
    const user = userEvent.setup(),
      modules = screen.getByRole('button', { name: 'Módulos' })
    await user.click(modules)
    act(() => screen.getByRole('link', { name: 'Cosecha', exact: true }).focus())
    await user.keyboard('{Escape}')
    expect(modules).toHaveFocus()
    expect(modules).toHaveAttribute('aria-expanded', 'false')
  })
  it('la consulta abre lotes sin conceder generación', async () => {
    navigation({ puedeGenerar: false })
    await userEvent.setup().hover(screen.getByRole('button', { name: 'Módulos' }))
    expect(screen.getByRole('link', { name: 'Cosecha', exact: true })).toHaveAttribute(
      'href',
      '/cosecha/lotes'
    )
  })
  it('el acceso exclusivo de reportes mantiene su autorización sin submenú', async () => {
    navigation({ routes: rutas.filter((r) => ['/', '/reportes'].includes(r.path)) })
    await userEvent.setup().hover(screen.getByRole('button', { name: 'Módulos' }))
    expect(screen.getByRole('link', { name: 'Cosecha', exact: true })).toHaveAttribute(
      'href',
      '/reportes/resumen'
    )
    expect(
      screen.queryByRole('link', { name: 'Registros', exact: true })
    ).not.toBeInTheDocument()
  })
  it('sólo muestra Cosecha en Módulos incluso si existen otros permisos', async () => {
    navigation()
    const user = userEvent.setup()
    await user.hover(screen.getByRole('button', { name: 'Módulos' }))
    const panel = within(screen.getByRole('region', { name: 'Módulos' }))
    expect(
      panel.getByRole('link', { name: 'Cosecha', exact: true })
    ).toBeInTheDocument()
    for (const name of ['Campañas', 'Personal', 'Estructura agrícola']) {
      expect(panel.queryByRole('button', { name, exact: true })).not.toBeInTheDocument()
      expect(panel.queryByRole('link', { name, exact: true })).not.toBeInTheDocument()
    }
  })
  it('mantiene la opción de fijar y contraer el panel', async () => {
    navigation()
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Fijar navegación' }))
    await user.click(screen.getByRole('button', { name: 'Fuera del menú' }))
    expect(
      screen.getByRole('link', { name: 'Cosecha', exact: true })
    ).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Contraer navegación' }))
    expect(
      screen.queryByRole('link', { name: 'Cosecha', exact: true })
    ).not.toBeInTheDocument()
  })
  it('Inicio navega directamente sin abrir un panel redundante', async () => {
    mount('/')
    await screen.findByRole('heading', { name: 'Bienvenido a GesGROW' })
    const user = userEvent.setup()
    const home = screen.getByRole('link', { name: 'Inicio', exact: true })
    await user.hover(home)
    expect(screen.queryByRole('region', { name: 'Inicio' })).not.toBeInTheDocument()
    await user.click(home)
    expect(home).toHaveAttribute('aria-current', 'page')
  })
  it('sin módulos habilitados muestra el catálogo sin conceder acceso operativo', async () => {
    mount('/', {
      permisos: { A: ['reports.view', 'company.manage'] },
      modulos: { A: [] }
    })
    await screen.findByRole('heading', { name: 'Bienvenido a GesGROW' })
    expect(screen.getByRole('link', { name: 'Módulos', exact: true })).toHaveAttribute(
      'href',
      '/modulos'
    )
    expect(screen.queryByRole('link', { name: 'Registros' })).not.toBeInTheDocument()
    await userEvent.setup().click(screen.getByRole('button', { name: 'Configuración' }))
    expect(screen.getByRole('link', { name: 'Usuarios y accesos' })).toHaveAttribute(
      'href',
      '/configuracion/usuarios'
    )
    expect(
      screen.queryByRole('link', { name: 'Cosecha', exact: true })
    ).not.toBeInTheDocument()
  })
  it('el drawer cierra al navegar y devuelve foco al botón de apertura', async () => {
    mount('/')
    await screen.findByRole('heading', { name: 'Bienvenido a GesGROW' })
    const user = userEvent.setup(),
      trigger = screen.getByRole('button', { name: 'Menú', exact: true })
    await user.click(trigger)
    const drawer = screen.getByRole('dialog', { name: 'Menú del Portal' })
    await user.click(within(drawer).getByRole('button', { name: 'Módulos' }))
    await user.click(within(drawer).getByRole('link', { name: 'Cosecha', exact: true }))
    await screen.findByRole('heading', { name: 'Lotes de tickets generados' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
    expect(document.body.style.overflow).not.toBe('hidden')
  })
})

describe('Ranking y comparación con totales del read model', () => {
  it('ranking vacío muestra estado honesto y no permite comparar', async () => {
    mount('/reportes/ranking', {}, (ports) => {
      const original = ports.reportesHarvest.consultar
      ports.reportesHarvest.consultar = async (...args) => {
        const result = await original(...args)
        if (result.tipo === 'RANKING') result.datos.ranking = []
        return result
      }
    })
    await screen.findByText('Sin datos para los filtros seleccionados.')
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
    expect(within(tray()).getByRole('button', { name: /^Comparar/ })).toBeDisabled()
    expect(
      screen.queryByRole('table', { name: /Comparación de cosechadores/ })
    ).not.toBeInTheDocument()
  })
  it('selecciona por teclado, compara datos exactos en barras y tabla, quita y limpia', async () => {
    mount()
    await ready()
    const user = userEvent.setup(),
      ana = screen.getByRole('checkbox', { name: 'Comparar a Ana A' })
    expect(within(tray()).getByRole('button', { name: /^Comparar/ })).toBeDisabled()
    act(() => ana.focus())
    await user.keyboard(' ')
    await user.click(screen.getByRole('checkbox', { name: 'Comparar a Bruno A' }))
    await user.click(within(tray()).getByRole('button', { name: 'Comparar 2' }))
    const table = screen.getByRole('table', {
      name: 'Comparación de cosechadores · Campaña'
    })
    expect(within(table).getByText('23')).toBeInTheDocument()
    expect(within(table).getByText('20')).toBeInTheDocument()
    const result = screen.getByRole('region', { name: 'Resultado de comparación' })
    expect(result).toHaveFocus()
    expect(within(result).getByLabelText('Ana A: 23 jabas')).toHaveAttribute(
      'tabindex',
      '0'
    )
    expect(within(result).getAllByRole('tooltip')).toHaveLength(2)
    await user.click(within(tray()).getByRole('button', { name: 'Quitar a Ana A' }))
    expect(
      screen.queryByRole('table', { name: /Comparación de cosechadores/ })
    ).not.toBeInTheDocument()
    expect(ana).not.toBeChecked()
    await user.click(within(tray()).getByRole('button', { name: 'Limpiar selección' }))
    expect(within(tray()).getByText('0 de 5')).toBeInTheDocument()
  })
  it('conserva selección entre búsquedas y exporta exactamente el snapshot filtrado mostrado', async () => {
    const { archivos } = mount()
    await ready()
    const user = userEvent.setup()
    await user.click(screen.getByRole('checkbox', { name: 'Comparar a Ana A' }))
    await user.type(screen.getByLabelText('Buscar por nombre o DNI'), 'Bruno')
    await waitFor(() =>
      expect(
        screen.queryByRole('checkbox', { name: 'Comparar a Ana A' })
      ).not.toBeInTheDocument()
    )
    await user.click(
      await screen.findByRole('checkbox', { name: 'Comparar a Bruno A' })
    )
    expect(
      within(tray()).getByRole('button', { name: 'Quitar a Ana A' })
    ).toBeInTheDocument()
    await user.click(within(tray()).getByRole('button', { name: 'Comparar 2' }))
    expect(
      screen.getByRole('table', { name: /Comparación de cosechadores/ })
    ).toHaveTextContent('Ana A')
    await user.click(screen.getByRole('button', { name: 'Exportar CSV' }))
    await waitFor(() => expect(archivos).toHaveLength(1))
    expect(archivos[0].contenido).toContain('Bruno A')
    expect(archivos[0].contenido).not.toContain('Ana A')
    await user.click(screen.getByRole('button', { name: 'Limpiar búsqueda' }))
    expect(
      await screen.findByRole('checkbox', { name: 'Comparar a Ana A' })
    ).toBeChecked()
  })
  it('limita a cinco, permite sustituir una selección y nunca inventa resultados temporales', async () => {
    mount('/reportes/ranking', {}, (ports) => {
      const original = ports.reportesHarvest.consultar
      ports.reportesHarvest.consultar = async (...args) => {
        const result = await original(...args)
        if (result.tipo === 'RANKING')
          result.datos.ranking = Array.from({ length: 6 }, (_, i) => ({
            posicion: i + 1,
            cosechador_dni: String(i),
            cosechador: `Persona ${i}`,
            total_jabas: 30 - i,
            ultima_lectura: null
          }))
        return result
      }
    })
    await ready()
    const user = userEvent.setup()
    for (let i = 0; i < 5; i++)
      await user.click(
        screen.getByRole('checkbox', { name: `Comparar a Persona ${i}` })
      )
    expect(
      screen.getByRole('checkbox', { name: 'Comparar a Persona 5' })
    ).toBeDisabled()
    expect(screen.getByText(/Límite de 5/)).toBeInTheDocument()
    for (let i = 0; i < 5; i++)
      expect(within(tray()).getByText(`Persona ${i}`).closest('li')).toHaveClass(
        `series-${i + 1}`
      )
    await user.click(within(tray()).getByRole('button', { name: 'Quitar a Persona 0' }))
    await user.click(screen.getByRole('checkbox', { name: 'Comparar a Persona 5' }))
    await user.click(within(tray()).getByRole('button', { name: 'Comparar 5' }))
    // Removing green frees its slot; existing workers keep aqua/gold/soil/berry.
    for (let i = 1; i < 5; i++) {
      expect(within(tray()).getByText(`Persona ${i}`).closest('li')).toHaveClass(
        `series-${i + 1}`
      )
      expect(screen.getByLabelText(`Persona ${i}: ${30 - i} jabas`)).toHaveClass(
        `series-${i + 1}`
      )
    }
    expect(screen.getByLabelText('Persona 5: 25 jabas')).toHaveClass('series-1')
    expect(
      within(
        screen.getByRole('table', { name: /Comparación de cosechadores/ })
      ).getAllByRole('row')
    ).toHaveLength(6)
    expect(
      screen.getByText(/La evolución por día de cada cosechador aún no está disponible/)
    ).toBeInTheDocument()
  })
  it('conserva Hoy/Semana/Mes/Campaña y limpia selección al cambiar periodo, campaña o actualizar', async () => {
    const { ports } = mount()
    await ready()
    const user = userEvent.setup()
    for (const [enumValue, label] of [
      ['HOY', 'Hoy'],
      ['SEMANA', 'Semana'],
      ['MES', 'Mes'],
      ['CAMPANIA', 'Campaña']
    ]) {
      await user.click(screen.getByRole('checkbox', { name: 'Comparar a Ana A' }))
      await user.click(screen.getByRole('button', { name: label, exact: true }))
      await ready()
      expect(
        screen.getByRole('checkbox', { name: 'Comparar a Ana A' })
      ).not.toBeChecked()
      expect(
        ports.calls.filter((c) => c[0] === 'consultarReporte').at(-1)[2].periodo
      ).toBe(enumValue)
    }
    await user.click(screen.getByRole('checkbox', { name: 'Comparar a Ana A' }))
    await user.selectOptions(screen.getByLabelText('Campaña'), 'A-cerrada')
    await ready()
    expect(within(tray()).getByText('0 de 5')).toBeInTheDocument()
    await user.click(screen.getByRole('checkbox', { name: 'Comparar a Ana A' }))
    await user.click(screen.getByRole('button', { name: 'Actualizar datos' }))
    await ready()
    expect(within(tray()).getByText('0 de 5')).toBeInTheDocument()
  })
  it('limpia comparación y descarta ranking tardío al cambiar Tenant', async () => {
    const { ports } = mount('/reportes/ranking', {
      empresas: ['A', 'B'],
      permisos: { A: ['reports.view'], B: ['reports.view'] }
    })
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: /Empresa A/ }))
    await ready()
    await user.click(screen.getByRole('checkbox', { name: 'Comparar a Ana A' }))
    const original = ports.reportesHarvest.consultar
    let release, start
    const started = new Promise((resolve) => {
      start = resolve
    })
    ports.reportesHarvest.consultar = async (...args) => {
      const result = await original(...args)
      if (args[0] === 'A') {
        start()
        await new Promise((resolve) => {
          release = resolve
        })
      }
      return result
    }
    await user.type(screen.getByLabelText('Buscar por nombre o DNI'), 'A')
    await started
    await user.click(screen.getByRole('button', { name: 'Menú de usuario' }))
    await user.selectOptions(screen.getByLabelText('Empresa activa'), 'B')
    await screen.findByRole('heading', { name: 'Bienvenido a GesGROW' })
    await act(async () => release())
    await user.click(screen.getByRole('button', { name: 'Módulos' }))
    await user.click(screen.getByRole('link', { name: 'Cosecha', exact: true }))
    await user.click(screen.getByRole('link', { name: 'Ranking de cosechadores' }))
    await ready()
    expect(within(tray()).getByText('0 de 5')).toBeInTheDocument()
    expect(screen.queryByText('Ana A')).not.toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: 'Comparar a Ana B' })).not.toBeChecked()
  })
})
