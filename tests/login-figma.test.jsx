import { describe, expect, it, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { Login } from '../src/presentation/Login.jsx'
import { Portal } from '../src/presentation/Portal.jsx'
import { crearPortal } from '../src/application/crearPortal.js'
import { fakePorts } from './support/fakePorts.js'

function view(login, estado = { cargando: false, mensaje: '' }) {
  return (
    <MemoryRouter>
      <Login portal={{ login }} estado={estado} />
    </MemoryRouter>
  )
}
function mount(login = vi.fn().mockResolvedValue(false)) {
  return { login, ...render(view(login)) }
}

describe('Login de Figma 64:341', () => {
  it('permite mostrar y ocultar la contraseña sin enviar credenciales', async () => {
    const { login } = mount()
    const user = userEvent.setup()
    const password = screen.getByLabelText('Contraseña', { exact: true })
    await user.type(password, 'privada')
    expect(password).toHaveAttribute('type', 'password')
    await user.click(screen.getByRole('button', { name: 'Mostrar contraseña' }))
    expect(password).toHaveAttribute('type', 'text')
    expect(password).toHaveValue('privada')
    await user.click(screen.getByRole('button', { name: 'Ocultar contraseña' }))
    expect(password).toHaveAttribute('type', 'password')
    expect(login).not.toHaveBeenCalled()
  })

  it('envía las credenciales y borra y oculta la contraseña al enviar', async () => {
    const { login } = mount()
    const user = userEvent.setup()
    await user.type(screen.getByLabelText('Correo electrónico'), 'ana@example.test')
    const password = screen.getByLabelText('Contraseña', { exact: true })
    await user.type(password, 'privada')
    await user.click(screen.getByRole('button', { name: 'Mostrar contraseña' }))
    await user.click(
      screen.getByRole('button', { name: 'Iniciar sesión', exact: true })
    )
    expect(login).toHaveBeenCalledExactlyOnceWith({
      email: 'ana@example.test',
      password: 'privada'
    })
    expect(password).toHaveValue('')
    expect(password).toHaveAttribute('type', 'password')
    expect(screen.getByLabelText('Correo electrónico')).toHaveValue('ana@example.test')
  })

  it('navega al registro y vuelve al login sin enviar el formulario', async () => {
    const puertos = fakePorts({ autenticado: false })
    const login = vi.spyOn(puertos.identity, 'iniciarSesion')
    render(
      <MemoryRouter initialEntries={['/login']}>
        <Portal portal={crearPortal(puertos)} />
      </MemoryRouter>
    )
    const user = userEvent.setup()
    await screen.findByRole('heading', { name: 'Iniciar sesión' })
    await user.click(screen.getByRole('link', { name: 'Crear una cuenta de empresa' }))
    expect(screen.getByRole('heading', { name: 'Registro' })).toBeInTheDocument()
    await user.click(screen.getByRole('link', { name: 'aqui.' }))
    expect(screen.getByRole('heading', { name: 'Iniciar sesión' })).toBeInTheDocument()
    expect(login).not.toHaveBeenCalled()
  })

  it('bloquea los controles durante el envío y muestra errores para reintentar', async () => {
    const login = vi.fn()
    const { rerender } = mount(login)
    await act(async () => rerender(view(login, { cargando: true, mensaje: '' })))
    expect(screen.getByLabelText('Correo electrónico')).toBeDisabled()
    expect(screen.getByLabelText('Contraseña', { exact: true })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Mostrar contraseña' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Verificando…' })).toBeDisabled()
    rerender(view(login, { cargando: false, mensaje: 'Credenciales inválidas.' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Credenciales inválidas.')
    expect(
      screen.getByRole('button', { name: 'Iniciar sesión', exact: true })
    ).toBeEnabled()
  })

  it('evita reenviar credenciales mientras la petición anterior está pendiente', async () => {
    let terminar
    const login = vi.fn(
      () =>
        new Promise((resolve) => {
          terminar = resolve
        })
    )
    mount(login)
    const user = userEvent.setup()
    await user.type(screen.getByLabelText('Correo electrónico'), 'ana@example.test')
    await user.type(screen.getByLabelText('Contraseña', { exact: true }), 'privada')
    await user.click(
      screen.getByRole('button', { name: 'Iniciar sesión', exact: true })
    )
    await user.type(
      screen.getByLabelText('Contraseña', { exact: true }),
      'segundo-intento'
    )
    await user.click(
      screen.getByRole('button', { name: 'Iniciar sesión', exact: true })
    )
    expect(login).toHaveBeenCalledTimes(1)
    await act(async () => terminar(false))
  })
})
