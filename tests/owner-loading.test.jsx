import { it, expect, vi } from 'vitest'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useNavigate } from 'react-router'
import { Portal } from '../src/presentation/Portal.jsx'
import { crearPortal } from '../src/application/crearPortal.js'
import { fakePorts } from './support/fakePorts.js'
import { fakeComercial } from './support/fakeComercial.js'
import { fakeAdministracion } from './support/fakeAdministracion.js'

function pendiente() {
  let resolver
  const promise = new Promise((resolve) => {
    resolver = resolve
  })
  return { promise, resolver }
}
function CambiarRuta() {
  const navigate = useNavigate()
  return (
    <button onClick={() => navigate('/configuracion/usuarios')}>Abrir usuarios</button>
  )
}

it('conserva la estructura del owner durante autorización y consulta, y habilita sólo el contenido listo', async () => {
  const ports = fakePorts({ autenticado: true, permisos: { A: ['company.manage'] } })
  fakeComercial(ports)
  fakeAdministracion(ports)
  const catalogo = pendiente()
  const acceso = pendiente()
  const usuarios = pendiente()
  const consultar = ports.comercial.consultar
  const listar = ports.administracion.accesosCosecha
  ports.comercial.consultar = async (...args) => {
    await catalogo.promise
    return consultar(...args)
  }
  ports.administracion.accesosCosecha = vi.fn(async (...args) => {
    await usuarios.promise
    return listar(...args)
  })
  render(
    <MemoryRouter initialEntries={['/modulos']}>
      <CambiarRuta />
      <Portal portal={crearPortal(ports)} />
    </MemoryRouter>
  )

  await screen.findByText('Cargando módulos…')
  expect(screen.getByRole('heading', { name: 'Módulos Adquiridos' })).toBeVisible()
  expect(screen.queryByRole('button', { name: /Adquirir/ })).not.toBeInTheDocument()
  await act(async () => catalogo.resolver())
  expect(await screen.findByRole('button', { name: /Adquirir/ })).toBeDisabled()
  expect(screen.queryByText('Cargando módulos…')).not.toBeInTheDocument()

  ports.setResolver(() => acceso.promise)
  await userEvent.setup().click(screen.getByRole('button', { name: 'Abrir usuarios' }))
  await screen.findByText('Cargando usuarios…')
  expect(screen.getByRole('heading', { name: 'Usuarios y accesos' })).toBeVisible()
  expect(ports.administracion.accesosCosecha).not.toHaveBeenCalled()
  expect(
    screen.queryByRole('link', { name: 'Invita a participar a un usuario' })
  ).not.toBeInTheDocument()
  await act(async () => acceso.resolver())
  await waitFor(() =>
    expect(ports.administracion.accesosCosecha).toHaveBeenCalledOnce()
  )
  expect(screen.getByText('Cargando usuarios…')).toBeInTheDocument()
  await act(async () => usuarios.resolver())
  expect(await screen.findByText('Persona A')).toBeVisible()
  expect(
    screen.getByRole('link', { name: 'Invita a participar a un usuario' })
  ).toBeVisible()
  expect(screen.queryByText('Cargando usuarios…')).not.toBeInTheDocument()
})
