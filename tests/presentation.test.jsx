import { describe, it, expect } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { Portal } from '../src/presentation/Portal.jsx'
import { crearPortal } from '../src/application/crearPortal.js'
import { ServicioNoDisponible } from '../src/ports/errores.js'
import { fakePorts } from './support/fakePorts.js'

const diferido = () => {
  let resolver
  const promise = new Promise((r) => {
    resolver = r
  })
  return { promise, resolver }
}

function montar(options = {}, path = '/') {
  const ports = fakePorts(options),
    portal = crearPortal(ports)
  render(
    <MemoryRouter initialEntries={[path]}>
      <Portal portal={portal} />
    </MemoryRouter>
  )
  return { ports, portal }
}
describe('Portal React con Application real y puertos controlados', () => {
  it('bootstrap inicial muestra Validando su acceso hasta resolver la sesión', async () => {
    const ports = fakePorts({ autenticado: true }),
      gate = diferido(),
      obtenerSesion = ports.identity.obtenerSesion
    ports.identity.obtenerSesion = async () => {
      await gate.promise
      return obtenerSesion()
    }
    const portal = crearPortal(ports)
    render(
      <MemoryRouter>
        <Portal portal={portal} />
      </MemoryRouter>
    )
    expect(screen.getByText('Validando su acceso…')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true')
    expect(screen.queryByRole('img', { name: 'GesGROW' })).not.toBeInTheDocument()
    expect(screen.queryByText('Preparando su espacio')).not.toBeInTheDocument()
    expect(screen.queryByText('Una visión clara.')).not.toBeInTheDocument()
    expect(
      document.querySelector('.access-screen, .access-story, .field-pattern')
    ).toBeNull()
    expect(portal.estadoActual().initializingSession).toBe(true)
    gate.resolver()
    await screen.findByRole('heading', { name: 'Bienvenido a GesGROW' })
    expect(portal.estadoActual().initializingSession).toBe(false)
  })

  it('login, recuperación de ruta directa, usuario/empresa y logout', async () => {
    montar({}, '/cosecha/registros')
    const user = userEvent.setup()
    await screen.findByRole('heading', { name: 'Iniciar sesión' })
    await user.type(screen.getByLabelText('Correo electrónico'), 'ana@example.test')
    await user.type(screen.getByLabelText('Contraseña'), 'clave')
    await user.click(screen.getByRole('button', { name: 'Iniciar sesión' }))
    await screen.findByRole('heading', { name: 'Cosecha', exact: true })
    expect(screen.getByRole('button', { name: 'Menú de usuario' })).toHaveTextContent(
      'Cuenta'
    )
    await user.click(screen.getByRole('button', { name: 'Menú de usuario' }))
    expect(screen.getAllByText('Empresa A').length).toBeGreaterThan(0)
    expect(screen.getByRole('region', { name: 'Cuenta de usuario' })).toHaveTextContent(
      'Ana Gestión'
    )
    await user.click(screen.getByRole('button', { name: 'Cerrar sesión' }))
    await screen.findByRole('heading', { name: 'Iniciar sesión' })
    expect(screen.queryByText('Ana Gestión')).not.toBeInTheDocument()
  })
  it('restauración sin login y menú permitido; URL oculta se rechaza por permiso', async () => {
    montar(
      { autenticado: true, permisos: { A: ['harvest.view'] } },
      '/configuracion/usuarios'
    )
    await screen.findByRole('heading', { name: 'Acceso restringido' })
    expect(
      screen.getByText('No tiene permiso para acceder a esta sección.')
    ).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Personal/ })).not.toBeInTheDocument()
    await userEvent.setup().click(screen.getByRole('button', { name: 'Módulos' }))
    expect(
      screen.getByRole('link', { name: 'Cosecha', exact: true })
    ).toBeInTheDocument()
    expect(screen.queryByLabelText('Contraseña')).not.toBeInTheDocument()
  })
  it('permiso sin módulo deniega ruta y oculta navegación', async () => {
    montar({ autenticado: true, modulos: { A: [] } }, '/cosecha/registros')
    await screen.findByRole('heading', { name: 'Acceso restringido' })
    expect(screen.getByText(/no tiene el módulo requerido/)).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Campañas/ })).not.toBeInTheDocument()
  })
  it('varias empresas requieren elección; cambio B elimina contenido y menú de A', async () => {
    const { portal } = montar({ autenticado: true, empresas: ['A', 'B'] })
    const user = userEvent.setup()
    await screen.findByRole('heading', { name: 'Seleccione una empresa' })
    await user.click(screen.getByRole('button', { name: /Empresa A/ }))
    await screen.findByRole('heading', { name: 'Bienvenido a GesGROW' })
    await user.click(screen.getByRole('button', { name: 'Módulos' }))
    await user.click(screen.getByRole('link', { name: 'Cosecha', exact: true }))
    await screen.findByRole('heading', { name: 'Cosecha', exact: true })
    await user.click(screen.getByRole('button', { name: 'Menú de usuario' }))
    await user.selectOptions(screen.getByLabelText('Empresa activa'), 'B')
    await screen.findByRole('heading', { name: 'Bienvenido a GesGROW' })
    await waitFor(() => expect(portal.estadoActual().contexto?.tenantId).toBe('B'))
    expect(
      screen.queryByRole('heading', { name: 'Cosecha', exact: true })
    ).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Personal/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Campañas/ })).not.toBeInTheDocument()
  })
  it('usuario sin membresías puede actualizar acceso y cerrar sesión', async () => {
    montar({ autenticado: true, empresas: [] })
    await screen.findByRole('heading', { name: 'Crea tu empresa' })
    expect(
      screen.getByRole('button', { name: 'Actualizar acceso' })
    ).toBeInTheDocument()
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
  })
  it('evento de cierre de sesión limpia la pantalla y vuelve al login sin advertencia', async () => {
    const { ports } = montar({ autenticado: true }, '/cosecha/registros')
    await screen.findByRole('heading', { name: 'Cosecha', exact: true })
    act(() => ports.notificar())
    await screen.findByRole('heading', { name: 'Iniciar sesión' })
    expect(
      screen.queryByRole('heading', { name: 'Cosecha', exact: true })
    ).not.toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
  it('focus y visibilitychange revalidan en background sin desmontar ni mostrar Validando su acceso', async () => {
    const { ports, portal } = montar({ autenticado: true }, '/cosecha/registros')
    const heading = await screen.findByRole('heading', {
        name: 'Cosecha',
        exact: true
      }),
      main = document.getElementById('contenido'),
      gateFocus = diferido()
    ports.setEntitlements(() => gateFocus.promise)
    act(() => window.dispatchEvent(new Event('focus')))
    await waitFor(() => expect(portal.estadoActual().backgroundRevalidation).toBe(true))
    expect(screen.getByRole('heading', { name: 'Cosecha', exact: true })).toBe(heading)
    expect(document.getElementById('contenido')).toBe(main)
    expect(screen.queryByText('Validando su acceso…')).not.toBeInTheDocument()
    gateFocus.resolver()
    await act(() => portal.revalidar())
    expect(portal.estadoActual().backgroundRevalidation).toBe(false)

    const gateVisibility = diferido()
    ports.setEntitlements(() => gateVisibility.promise)
    act(() => document.dispatchEvent(new Event('visibilitychange')))
    await waitFor(() => expect(portal.estadoActual().backgroundRevalidation).toBe(true))
    expect(screen.getByRole('heading', { name: 'Cosecha', exact: true })).toBe(heading)
    expect(screen.queryByText('Validando su acceso…')).not.toBeInTheDocument()
    gateVisibility.resolver()
    await act(() => portal.revalidar())
  })

  it('fallo temporal de red en background conserva la pantalla y navegación responsive funciona', async () => {
    const { ports, portal } = montar({ autenticado: true })
    const user = userEvent.setup()
    await screen.findByRole('heading', { name: 'Bienvenido a GesGROW' })
    await user.click(screen.getByRole('button', { name: 'Menú' }))
    expect(screen.getByRole('button', { name: 'Menú' })).toHaveAttribute(
      'aria-expanded',
      'true'
    )
    await user.click(screen.getByRole('button', { name: 'Cerrar navegación' }))
    ports.setEntitlements(() => {
      throw new ServicioNoDisponible('Conexión interrumpida')
    })
    await act(() => portal.revalidar())
    expect(
      screen.getByRole('heading', { name: 'Bienvenido a GesGROW' })
    ).toBeInTheDocument()
    expect(screen.getByRole('navigation')).toBeInTheDocument()
    expect(screen.queryByText('Validando su acceso…')).not.toBeInTheDocument()
    expect(
      screen.queryByRole('heading', { name: 'No se pudo validar el acceso' })
    ).not.toBeInTheDocument()
    ports.setEntitlements(null)
    await act(() => portal.revalidar())
    await screen.findByRole('heading', { name: 'Bienvenido a GesGROW' })
  })
})
