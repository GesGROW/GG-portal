import { describe, expect, it, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { Portal } from '../src/presentation/Portal.jsx'
import { crearPortal } from '../src/application/crearPortal.js'
import { fakePorts } from './support/fakePorts.js'

async function montar(
  registrarCuenta = vi.fn().mockResolvedValue({ confirmarCorreo: true })
) {
  const puertos = fakePorts({ autenticado: false })
  puertos.identity.registrarCuenta = registrarCuenta
  const portal = crearPortal(puertos)
  render(
    <MemoryRouter initialEntries={['/registro']}>
      <Portal portal={portal} />
    </MemoryRouter>
  )
  await screen.findByRole('heading', { name: 'Registro' })
  return { portal, puertos, registrarCuenta, user: userEvent.setup() }
}

async function completar(user, confirmacion = 'Clave-segura-123') {
  await user.type(screen.getByLabelText('Correo electrónico'), 'owner@example.test')
  await user.type(
    screen.getByLabelText('Contraseña', { exact: true }),
    'Clave-segura-123'
  )
  await user.type(
    screen.getByLabelText('Confirmar contraseña', { exact: true }),
    confirmacion
  )
}

describe('Registro del owner desde Figma', () => {
  it('valida la confirmación y permite mostrar cada contraseña de forma independiente', async () => {
    const { user, registrarCuenta } = await montar()
    await completar(user, 'Otra-clave-123')
    await user.click(
      screen.getByRole('button', { name: 'Mostrar contraseña', exact: true })
    )
    expect(screen.getByLabelText('Contraseña', { exact: true })).toHaveAttribute(
      'type',
      'text'
    )
    expect(
      screen.getByLabelText('Confirmar contraseña', { exact: true })
    ).toHaveAttribute('type', 'password')
    await user.click(screen.getByRole('button', { name: 'Crear cuenta' }))
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Las contraseñas deben coincidir.'
    )
    expect(screen.getByLabelText('Confirmar contraseña', { exact: true })).toHaveFocus()
    expect(registrarCuenta).not.toHaveBeenCalled()
  })

  it('registra solo las credenciales, informa de la confirmación y permite volver al login', async () => {
    const { user, registrarCuenta, puertos } = await montar()
    await completar(user)
    await user.click(screen.getByRole('button', { name: 'Crear cuenta' }))
    await screen.findByRole('heading', { name: 'Revisa tu correo' })
    expect(registrarCuenta).toHaveBeenCalledExactlyOnceWith({
      email: 'owner@example.test',
      password: 'Clave-segura-123'
    })
    expect(screen.getByRole('status')).toHaveTextContent(
      'El siguiente paso será crear tu empresa'
    )
    // Un evento posterior del SDK no debe sustituir la confirmación por un perfil sin empresa.
    await act(async () => puertos.notificar('actualizada', 'SIGNED_IN'))
    expect(
      screen.getByRole('heading', { name: 'Revisa tu correo' })
    ).toBeInTheDocument()
    await user.click(screen.getByRole('link', { name: 'Ir a iniciar sesión' }))
    expect(screen.getByRole('heading', { name: 'Iniciar sesión' })).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('bloquea envíos simultáneos y limpia los secretos al fallar para permitir reintentar', async () => {
    let rechazar
    const registrar = vi.fn(
      () =>
        new Promise((_, reject) => {
          rechazar = reject
        })
    )
    const { user } = await montar(registrar)
    await completar(user)
    await user.dblClick(screen.getByRole('button', { name: 'Crear cuenta' }))
    expect(registrar).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: 'Creando cuenta…' })).toBeDisabled()
    expect(screen.getByLabelText('Correo electrónico')).toBeDisabled()
    await act(async () => rechazar(new Error('El registro no está habilitado.')))
    expect(screen.getByRole('alert')).toHaveTextContent(
      'El registro no está habilitado.'
    )
    expect(screen.getByLabelText('Contraseña', { exact: true })).toHaveValue('')
    expect(screen.getByLabelText('Confirmar contraseña', { exact: true })).toHaveValue(
      ''
    )
    expect(screen.getByLabelText('Correo electrónico')).toHaveValue(
      'owner@example.test'
    )
    expect(screen.getByRole('button', { name: 'Crear cuenta' })).toBeEnabled()
  })

  it('muestra cuenta creada cuando el proveedor no exige confirmar correo', async () => {
    const { user } = await montar(vi.fn().mockResolvedValue({ confirmarCorreo: false }))
    await completar(user)
    await user.click(screen.getByRole('button', { name: 'Crear cuenta' }))
    expect(
      await screen.findByRole('heading', { name: 'Cuenta creada' })
    ).toBeInTheDocument()
  })

  it('permite regresar al login sin enviar el formulario', async () => {
    const { user, registrarCuenta } = await montar()
    await user.click(screen.getByRole('link', { name: 'aqui.' }))
    expect(screen.getByRole('heading', { name: 'Iniciar sesión' })).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'Crear una cuenta de empresa' })
    ).toHaveAttribute('href', '/registro')
    expect(registrarCuenta).not.toHaveBeenCalled()
  })
})
