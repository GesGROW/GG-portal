import { describe, it, expect, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { Portal } from '../src/presentation/Portal.jsx'
import { crearPortal } from '../src/application/crearPortal.js'
import { fakePorts } from './support/fakePorts.js'

function montar({ existente = false, preparar, completar } = {}) {
  const puertos = fakePorts({ autenticado: true, empresas: ['A', 'B'] })
  let pendiente = true
  const datos = {
    requiereActivacion: !existente,
    tenantId: 'B',
    empresa: 'Agrícola del Norte',
    roles: ['CONSULTA'],
    modulos: ['HARVEST']
  }
  puertos.identity.tieneInvitacion = () => pendiente
  puertos.identity.prepararInvitacion =
    preparar ??
    (async () => {
      if (existente) pendiente = false
      return datos
    })
  puertos.identity.completarInvitacion =
    completar ??
    vi.fn(async () => {
      pendiente = false
    })
  const portal = crearPortal(puertos)
  render(
    <MemoryRouter initialEntries={['/aceptar-invitacion']}>
      <Portal portal={portal} />
    </MemoryRouter>
  )
  return { portal, puertos, user: userEvent.setup() }
}

describe('Activación de cuenta desde una invitación', () => {
  it('permite recuperar el acceso si el perfil falla después de guardar la contraseña', async () => {
    const { portal, puertos, user } = montar()
    const obtenerPerfil = puertos.acceso.obtenerIdentidad
    puertos.acceso.obtenerIdentidad = vi
      .fn()
      .mockRejectedValueOnce(new Error('Red temporal'))
      .mockImplementation(obtenerPerfil)
    await screen.findByRole('heading', { name: 'Activación de cuenta' })
    await user.type(screen.getByLabelText('DNI', { exact: true }), '01234567')
    await user.type(
      screen.getByLabelText('Contraseña', { exact: true }),
      'clave-segura-123'
    )
    await user.type(
      screen.getByLabelText('Confirmar contraseña', { exact: true }),
      'clave-segura-123'
    )
    await user.click(
      screen.getByRole('button', { name: 'Activar cuenta', exact: true })
    )
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Tu contraseña se guardó'
    )
    expect(
      screen.queryByLabelText('Contraseña', { exact: true })
    ).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Reintentar' }))
    await screen.findByRole('heading', { name: 'Bienvenido a GesGROW' })
    expect(puertos.identity.completarInvitacion).toHaveBeenCalledTimes(1)
    expect(portal.estadoActual().contexto.tenantId).toBe('B')
  })
  it('muestra datos de la invitación, valida confirmación y permite mostrar cada secreto por separado', async () => {
    const { puertos, user } = montar()
    expect(
      await screen.findByRole('heading', { name: 'Activación de cuenta' })
    ).toBeInTheDocument()
    expect(screen.getByText('Agrícola del Norte')).toBeInTheDocument()
    expect(screen.getByText('Consulta')).toBeInTheDocument()
    expect(screen.getByText('Cosecha')).toBeInTheDocument()
    await user.type(screen.getByLabelText('DNI', { exact: true }), '01234567')
    await user.type(
      screen.getByLabelText('Contraseña', { exact: true }),
      'clave-segura-123'
    )
    await user.type(
      screen.getByLabelText('Confirmar contraseña', { exact: true }),
      'otra-clave-123'
    )
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
    await user.click(
      screen.getByRole('button', { name: 'Activar cuenta', exact: true })
    )
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Las contraseñas deben coincidir.'
    )
    expect(puertos.identity.completarInvitacion).not.toHaveBeenCalled()
  })

  it('activa una cuenta nueva y abre la empresa invitante aunque existan otras membresías', async () => {
    const { portal, puertos, user } = montar()
    await screen.findByRole('heading', { name: 'Activación de cuenta' })
    await user.type(screen.getByLabelText('DNI', { exact: true }), '01234567')
    await user.type(
      screen.getByLabelText('Contraseña', { exact: true }),
      'clave-segura-123'
    )
    await user.type(
      screen.getByLabelText('Confirmar contraseña', { exact: true }),
      'clave-segura-123'
    )
    await user.click(
      screen.getByRole('button', { name: 'Activar cuenta', exact: true })
    )
    await screen.findByRole('heading', { name: 'Bienvenido a GesGROW' })
    expect(puertos.identity.completarInvitacion).toHaveBeenCalledExactlyOnceWith(
      'clave-segura-123',
      '01234567'
    )
    expect(portal.estadoActual().contexto.tenantId).toBe('B')
    expect(JSON.stringify(portal.estadoActual())).not.toContain('clave-segura-123')
    expect(
      screen.queryByRole('heading', { name: 'Seleccione una empresa' })
    ).not.toBeInTheDocument()
  })

  it('la cuenta existente entra directamente y nunca recibe un formulario para cambiar contraseña', async () => {
    const { portal, puertos } = montar({ existente: true })
    await screen.findByRole('heading', { name: 'Bienvenido a GesGROW' })
    expect(portal.estadoActual().contexto.tenantId).toBe('B')
    expect(
      screen.queryByLabelText('Contraseña', { exact: true })
    ).not.toBeInTheDocument()
    expect(puertos.identity.completarInvitacion).not.toHaveBeenCalled()
  })

  it('un enlace vencido muestra cómo recuperar el acceso sin permitir cambiar contraseña', async () => {
    const { puertos } = montar({
      preparar: async () => {
        throw new Error('El enlace ha caducado. Solicita una nueva invitación.')
      }
    })
    expect(await screen.findByRole('alert')).toHaveTextContent('El enlace ha caducado.')
    expect(
      screen.queryByLabelText('Contraseña', { exact: true })
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'Ir a iniciar sesión' })
    ).toBeInTheDocument()
    expect(puertos.identity.completarInvitacion).not.toHaveBeenCalled()
  })

  it('bloquea envíos dobles, conserva la invitación y limpia secretos al fallar', async () => {
    let rechazar
    const completar = vi.fn(
      () =>
        new Promise((_, reject) => {
          rechazar = reject
        })
    )
    const { user } = montar({ completar })
    await screen.findByRole('heading', { name: 'Activación de cuenta' })
    await user.type(screen.getByLabelText('DNI', { exact: true }), '01234567')
    await user.type(
      screen.getByLabelText('Contraseña', { exact: true }),
      'clave-segura-123'
    )
    await user.type(
      screen.getByLabelText('Confirmar contraseña', { exact: true }),
      'clave-segura-123'
    )
    await user.dblClick(
      screen.getByRole('button', { name: 'Activar cuenta', exact: true })
    )
    expect(completar).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: 'Activando cuenta…' })).toBeDisabled()
    await act(async () => rechazar(new Error('No se pudo establecer la contraseña.')))
    expect(screen.getByRole('alert')).toHaveTextContent(
      'No se pudo establecer la contraseña.'
    )
    expect(screen.getByText('Agrícola del Norte')).toBeInTheDocument()
    expect(screen.getByLabelText('Contraseña', { exact: true })).toHaveValue('')
    expect(screen.getByLabelText('Confirmar contraseña', { exact: true })).toHaveValue(
      ''
    )
  })
})
