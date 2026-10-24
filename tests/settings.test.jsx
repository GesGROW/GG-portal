import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor, act, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { Portal } from '../src/presentation/Portal.jsx'
import { crearPortal } from '../src/application/crearPortal.js'
import { fakePorts } from './support/fakePorts.js'
import { fakeAdministracion } from './support/fakeAdministracion.js'

function montar(path = '/configuracion/usuarios', options = {}, vacio = false) {
  const ports = fakePorts({ autenticado: true, ...options }),
    datos = fakeAdministracion(ports),
    portal = crearPortal(ports)
  if (vacio) datos.usuarios.A = []
  render(
    <MemoryRouter initialEntries={[path]}>
      <Portal portal={portal} />
    </MemoryRouter>
  )
  return { ports, datos, portal, user: userEvent.setup() }
}
async function formulario(user) {
  await user.click(
    await screen.findByRole('link', { name: 'Invita a participar a un usuario' })
  )
  return within(await screen.findByRole('dialog', { name: 'Invitación' }))
}
async function completar(card, user) {
  await user.type(card.getByLabelText('Nombre', { exact: true }), 'Deysi Regalado')
  await user.type(card.getByLabelText('Correo electrónico'), 'deysi@example.test')
}
describe('Usuarios y accesos por módulo', () => {
  it('Configuración abre Cosecha con una tabla simple y sin filtros ni acciones operativas', async () => {
    montar('/configuracion')
    const tabla = await screen.findByRole('table', { name: 'Usuarios y accesos' })
    expect(
      within(tabla)
        .getAllByRole('columnheader')
        .map((h) => h.textContent)
    ).toEqual(['Nombre', 'Correo', 'Rol', 'Estado'])
    expect(within(tabla).getByText('Persona A')).toBeVisible()
    expect(screen.getByRole('heading', { name: 'Cosecha', exact: true })).toBeVisible()
    expect(screen.queryByRole('searchbox')).not.toBeInTheDocument()
    expect(within(tabla).queryByRole('link')).not.toBeInTheDocument()
    expect(screen.queryByText('Todas las campañas')).not.toBeInTheDocument()
  })
  it('sin usuarios presenta el estado vacío del primer PNG y permite invitar', async () => {
    montar('/configuracion/usuarios', {}, true)
    const tabla = await screen.findByRole('table', { name: 'Usuarios y accesos' })
    expect(
      within(tabla)
        .getAllByRole('columnheader')
        .map((h) => h.textContent)
    ).toEqual(['Nombre', 'Correo', 'Activo'])
    expect(
      screen.getByRole('link', { name: 'Invita a participar a un usuario' })
    ).toHaveAttribute('href', '/configuracion/invitaciones')
    expect(screen.queryByText('No hay usuarios que coincidan.')).not.toBeInTheDocument()
  })
  it('solo ofrece Supervisor con nombre y correo obligatorios, sin contraseña ni otros módulos', async () => {
    const { user } = montar()
    const card = await formulario(user)
    expect(card.getByLabelText('Nombre', { exact: true })).toBeRequired()
    expect(card.getByLabelText('Correo electrónico')).toBeRequired()
    expect(card.getAllByRole('option').map((o) => o.textContent)).toEqual([
      'Supervisor'
    ])
    expect(card.queryByLabelText('Contraseña')).not.toBeInTheDocument()
    expect(card.queryByRole('checkbox')).not.toBeInTheDocument()
    expect(card.queryByRole('switch')).not.toBeInTheDocument()
  })
  it('cancelar con Escape restaura foco y conserva la tabla montada', async () => {
    const { user } = montar()
    const tabla = await screen.findByRole('table', { name: 'Usuarios y accesos' })
    await formulario(user)
    expect(screen.getByLabelText('Nombre', { exact: true })).toHaveFocus()
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(screen.getByRole('table', { name: 'Usuarios y accesos' })).toBe(tabla)
    await waitFor(() =>
      expect(
        screen.getByRole('link', { name: 'Invita a participar a un usuario' })
      ).toHaveFocus()
    )
  })
  it('envía una sola invitación de supervisor y vuelve al listado con Pendiente', async () => {
    const { user, ports } = montar('/configuracion/usuarios', {}, true)
    const card = await formulario(user)
    await completar(card, user)
    await user.dblClick(card.getByRole('button', { name: 'Enviar', exact: true }))
    expect(await screen.findByText('Pendiente', { exact: true })).toBeVisible()
    expect(screen.queryByText('Aceptada', { exact: true })).not.toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    const llamadas = ports.calls.filter((c) => c[0] === 'invitacion')
    expect(llamadas).toHaveLength(1)
    expect(llamadas[0][2]).toMatchObject({
      nombre: 'Deysi Regalado',
      email: 'deysi@example.test',
      roles: ['A-supervisor'],
      trabajadorId: null
    })
  })
  it('la aceptación real actualiza el estado al recuperar foco sin duplicar personas', async () => {
    const { user, datos } = montar('/configuracion/usuarios', {}, true)
    const card = await formulario(user)
    await completar(card, user)
    await user.click(card.getByRole('button', { name: 'Enviar', exact: true }))
    await screen.findByText('Pendiente', { exact: true })
    datos.invitaciones.A[0].aceptadaEn = '2026-10-21T15:00:00Z'
    await act(async () => window.dispatchEvent(new Event('focus')))
    expect(await screen.findByText('Aceptada', { exact: true })).toBeVisible()
    expect(screen.queryByText('Pendiente', { exact: true })).not.toBeInTheDocument()
    expect(screen.getAllByText('Deysi Regalado')).toHaveLength(1)
  })
  it('un envío incierto conserva UUID y campos al reintentar', async () => {
    const { ports, user } = montar()
    const solicitudes = []
    const original = ports.administracion.invitarUsuario
    ports.administracion.invitarUsuario = async (t, d) => {
      solicitudes.push(d)
      if (solicitudes.length === 1) throw new Error('Fallo de conexión')
      return original(t, d)
    }
    const card = await formulario(user)
    await completar(card, user)
    await user.click(card.getByRole('button', { name: 'Enviar', exact: true }))
    await card.findByRole('alert')
    expect(card.getByLabelText('Nombre', { exact: true })).toHaveAttribute('readonly')
    await user.click(card.getByRole('button', { name: 'Reintentar envío' }))
    await screen.findByText('Pendiente', { exact: true })
    expect(solicitudes).toHaveLength(2)
    expect(solicitudes[0]).toEqual(solicitudes[1])
  })
  it('sin Cosecha contratado no muestra acción de invitar y rechaza el acceso directo al envío', async () => {
    const { ports, user } = montar('/configuracion/invitaciones', {
      modulos: { A: [] }
    })
    const card = within(await screen.findByRole('dialog', { name: 'Invitación' }))
    await completar(card, user)
    await user.click(card.getByRole('button', { name: 'Enviar', exact: true }))
    expect(await card.findByRole('alert')).toHaveTextContent(
      'Cosecha debe estar habilitado'
    )
    expect(ports.calls.some((c) => c[0] === 'invitacion')).toBe(false)
  })
  it('el listado muestra un error del servidor y permite reintentar', async () => {
    const { ports } = montar()
    ports.administracion.accesosCosecha = vi
      .fn()
      .mockRejectedValueOnce(new Error('Sin conexión'))
      .mockResolvedValue({
        habilitado: true,
        rolSupervisorId: 'A-supervisor',
        usuarios: []
      })
    expect(await screen.findByRole('alert')).toHaveTextContent('Sin conexión')
    await userEvent.setup().click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(
      await screen.findByRole('table', { name: 'Usuarios y accesos' })
    ).toBeVisible()
  })
  it('la URL sin company.manage se deniega sin consultar datos', async () => {
    const { ports } = montar('/configuracion/usuarios', {
      permisos: { A: ['harvest.view'] }
    })
    await screen.findByRole('heading', { name: 'Acceso restringido' })
    expect(ports.calls.some((c) => c[0] === 'accesosCosecha')).toBe(false)
  })
  it('cambiar empresa cierra el formulario y descarta el listado anterior', async () => {
    const { user, datos } = montar('/configuracion/usuarios', {
      empresas: ['A', 'B'],
      permisos: { A: ['company.manage'], B: ['company.manage'] }
    })
    await user.click(await screen.findByRole('button', { name: /Empresa A/ }))
    await screen.findByText('Persona A')
    await user.click(screen.getByRole('button', { name: 'Menú de usuario' }))
    await user.selectOptions(screen.getByLabelText('Empresa activa'), 'B')
    await screen.findByRole('heading', { name: 'Bienvenido a GesGROW' })
    await user.click(screen.getByRole('button', { name: 'Configuración' }))
    await user.click(
      await screen.findByRole('link', { name: 'Usuarios y accesos', exact: true })
    )
    await screen.findByText('Persona B')
    expect(screen.queryByText('Persona A')).not.toBeInTheDocument()
    expect(datos.usuarios.A[0].nombre).toBe('Persona A')
  })
  it('conserva el editor de membresía existente y su validación por empresa', async () => {
    const { datos, user } = montar('/configuracion/usuarios/persona-A')
    await user.selectOptions(
      await screen.findByLabelText('Estado de acceso'),
      'suspendida'
    )
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))
    await waitFor(() => expect(datos.usuarios.A[0].activo).toBe(false))
    expect(datos.usuarios.A[0].cuentaActiva).toBe(true)
  })
})
