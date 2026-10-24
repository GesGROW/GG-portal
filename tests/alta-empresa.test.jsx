import { expect, it, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { Portal } from '../src/presentation/Portal.jsx'
import { crearPortal } from '../src/application/crearPortal.js'
import { fakePorts } from './support/fakePorts.js'

async function montar() {
  const p = fakePorts({ empresas: [], autenticado: true }),
    portal = crearPortal(p)
  render(
    <MemoryRouter initialEntries={['/login']}>
      <Portal portal={portal} />
    </MemoryRouter>
  )
  await screen.findByRole('heading', { name: 'Crea tu empresa' })
  return { p, portal, user: userEvent.setup() }
}
it('crea la empresa desde la cuenta nueva y abre Home del owner', async () => {
  const { p, user } = await montar()
  await user.type(screen.getByLabelText('Nombre de la empresa'), 'Fundo nuevo')
  await user.click(screen.getByRole('button', { name: 'Crear empresa' }))
  await screen.findByRole('heading', { name: 'Home' })
  expect(p.empresas).toEqual(['NUEVA'])
  expect(
    screen.queryByRole('heading', { name: 'Crea tu empresa' })
  ).not.toBeInTheDocument()
  expect(
    screen.queryByRole('link', { name: 'Cosecha', exact: true })
  ).not.toBeInTheDocument()
})
it('conserva los datos y el ID al reintentar; permite corregir datos sin duplicar envíos', async () => {
  const { p, user } = await montar()
  let rechazar
  const crear = vi.fn(
    () =>
      new Promise((_, reject) => {
        rechazar = reject
      })
  )
  p.acceso.crearEmpresa = crear
  await user.type(screen.getByLabelText('Nombre de la empresa'), 'Fundo nuevo')
  await user.dblClick(screen.getByRole('button', { name: 'Crear empresa' }))
  expect(crear).toHaveBeenCalledTimes(1)
  expect(screen.getByRole('button', { name: 'Creando empresa…' })).toBeDisabled()
  await act(async () => rechazar(new Error('Reintenta la conexión.')))
  expect(screen.getByRole('alert')).toHaveTextContent('Reintenta la conexión.')
  expect(screen.getByLabelText('Nombre de la empresa')).toHaveValue('Fundo nuevo')
  await user.click(screen.getByRole('button', { name: 'Reintentar' }))
  expect(crear.mock.calls[1][0]).toEqual(crear.mock.calls[0][0])
  await act(async () => rechazar(new Error('Datos inválidos')))
  await user.click(screen.getByRole('button', { name: 'Editar datos' }))
  expect(screen.getByLabelText('Nombre de la empresa')).not.toHaveAttribute('readonly')
  expect(screen.getByRole('button', { name: 'Crear empresa' })).toBeEnabled()
})
it('permite actualizar una invitación existente y cerrar sesión', async () => {
  const { p, user } = await montar()
  p.empresas.push('A')
  await user.click(screen.getByRole('button', { name: 'Actualizar acceso' }))
  await screen.findByRole('heading', { name: 'Home' })
})
