import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import QRCode from 'qrcode'
import { crearPortal } from '../src/application/crearPortal.js'
import { Portal } from '../src/presentation/Portal.jsx'
import { fakePorts } from './support/fakePorts.js'
import { fakeHarvestAdmin } from './support/fakeHarvestAdmin.js'
import { fakePda } from './support/fakePda.js'

vi.mock('qrcode', () => ({
  default: { toDataURL: vi.fn(async () => 'data:image/png;base64,cXItcHJ1ZWJh') }
}))

function montar({
  path = '/cosecha/app?campania=A-camp',
  permisos,
  vacio = false
} = {}) {
  const ports = fakePorts({
    autenticado: true,
    permisos: {
      A: permisos ?? [
        'company.manage',
        'harvest.view',
        'harvest.manage',
        'reports.view'
      ]
    }
  })
  fakeHarvestAdmin(ports)
  const datos = fakePda(ports, { vacio })
  const portal = crearPortal(ports)
  render(
    <MemoryRouter initialEntries={[path]}>
      <Portal portal={portal} />
    </MemoryRouter>
  )
  return { ports, datos, portal }
}

describe('App de Cosecha y PDA', () => {
  it('muestra el QR fijo de instalación y genera el de vinculación únicamente al pedirlo', async () => {
    const user = userEvent.setup()
    const escribir = vi.spyOn(navigator.clipboard, 'writeText')
    const { ports } = montar()
    await screen.findByRole('heading', { name: 'Instalar la aplicación' })
    expect(
      screen.getByRole('heading', { name: 'Vincular PDA a la empresa' })
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'App de Cosecha' })).toHaveAttribute(
      'aria-current',
      'page'
    )
    expect(
      screen
        .getByRole('link', { name: 'Instalar y vincular la app con el PDA' })
        .querySelectorAll('svg rect')
    ).toHaveLength(3)
    expect(ports.calls.some((c) => c[0] === 'pdaGenerar')).toBe(false)
    await screen.findByRole('img', {
      name: 'QR para abrir e instalar la App de Cosecha'
    })
    expect(QRCode.toDataURL).toHaveBeenCalledWith(
      'https://gg-app-m-harvest.vercel.app/',
      expect.objectContaining({ margin: 4 })
    )
    expect(
      screen.queryByRole('img', { name: 'QR para vincular el PDA a la empresa' })
    ).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Copiar enlace' }))
    expect(escribir).toHaveBeenCalledWith('https://gg-app-m-harvest.vercel.app/')
    await screen.findByText('Enlace copiado.')
    const generar = screen.getByRole('button', { name: 'Generar QR' })
    await waitFor(() => expect(generar).toBeEnabled())
    await user.click(generar)
    await screen.findByRole('img', { name: 'QR para vincular el PDA a la empresa' })
    expect(QRCode.toDataURL).toHaveBeenCalledWith(
      expect.stringMatching(
        /^https:\/\/gg-app-m-harvest.vercel.app\/#vincular=[0-9a-f]{64}$/
      ),
      expect.objectContaining({ margin: 4 })
    )
    expect(screen.getByRole('button', { name: 'Regenerar QR' })).toBeEnabled()
    expect(screen.getByText('Empresa A')).toBeInTheDocument()
    expect(ports.calls.filter((c) => c[0] === 'pdaGenerar')).toHaveLength(1)
    expect(
      QRCode.toDataURL.mock.calls.filter(
        ([enlace]) => enlace === 'https://gg-app-m-harvest.vercel.app/'
      )
    ).toHaveLength(1)
    await user.click(screen.getByRole('link', { name: 'Dispositivos vinculados' }))
    await screen.findByRole('heading', { name: 'Dispositivos vinculados' })
    await user.click(
      screen.getByRole('link', { name: 'Instalar y vincular la app con el PDA' })
    )
    await screen.findByRole('img', { name: 'QR para vincular el PDA a la empresa' })
    expect(ports.calls.filter((c) => c[0] === 'pdaGenerar')).toHaveLength(1)
  })

  it('tabla real de equipos, fecha Lima y revocación con confirmación y cancelación', async () => {
    const user = userEvent.setup()
    const { ports } = montar({ path: '/cosecha/dispositivos' })
    const tabla = await screen.findByRole('table', {
      name: 'Dispositivos de Empresa A'
    })
    expect(
      within(tabla).getByRole('rowheader', { name: 'PDA Campo Norte' })
    ).toBeInTheDocument()
    expect(within(tabla).getByText(/10:00/)).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Renovar acceso de PDA Almacén' })
    ).toBeEnabled()
    const origen = screen.getByRole('button', {
      name: 'Revocar acceso de PDA Campo Norte'
    })
    await user.click(origen)
    const dialogo = screen.getByRole('dialog', { name: 'Revocar acceso del PDA' })
    expect(dialogo).toHaveFocus()
    await user.click(within(dialogo).getByRole('button', { name: 'Cancelar' }))
    expect(origen).toHaveFocus()
    expect(ports.calls.some((c) => c[0] === 'pdaRevocar')).toBe(false)
    await user.click(origen)
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Revocar acceso' })
    )
    await screen.findByText('Acceso revocado para PDA Campo Norte.')
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Renovar acceso de PDA Campo Norte' })
      ).toBeEnabled()
    )
    expect(ports.calls.filter((c) => c[0] === 'pdaRevocar')).toEqual([
      ['pdaRevocar', 'A', 'pda-A-1']
    ])
    expect(tabla).toHaveClass('portal-data-table')
    await user.click(
      screen.getByRole('button', { name: 'Renovar acceso de PDA Campo Norte' })
    )
    await user.click(
      within(screen.getByRole('dialog', { name: 'Renovar acceso del PDA' })).getByRole(
        'button',
        { name: 'Renovar acceso' }
      )
    )
    await screen.findByText('Acceso renovado para PDA Campo Norte.')
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Revocar acceso de PDA Campo Norte' })
      ).toBeEnabled()
    )
    expect(ports.calls).toContainEqual(['pdaRenovar', 'A', 'pda-A-1'])
  })

  it('muestra el estado vacío de equipos al supervisor', async () => {
    const { ports } = montar({
      path: '/cosecha/dispositivos',
      permisos: ['harvest.manage'],
      vacio: true
    })
    await screen.findByText('Aún no hay dispositivos vinculados.')
    expect(ports.calls.some((c) => c[0] === 'harvestCampanias')).toBe(false)
    expect(ports.calls).toContainEqual(['pdaListar', 'A'])
  })

  it('un supervisor genera y regenera QR, consulta equipos y revoca sin company.manage', async () => {
    const user = userEvent.setup()
    const { ports } = montar({ permisos: ['harvest.view', 'harvest.manage'] })
    await screen.findByRole('heading', { name: 'Instalar la aplicación' })
    expect(screen.getByRole('button', { name: 'Copiar enlace' })).toBeEnabled()
    const generar = screen.getByRole('button', { name: 'Generar QR' })
    await waitFor(() => expect(generar).toBeEnabled())
    await user.click(generar)
    await screen.findByRole('img', { name: 'QR para vincular el PDA a la empresa' })
    await user.click(screen.getByRole('button', { name: 'Regenerar QR' }))
    await waitFor(() =>
      expect(ports.calls.filter((c) => c[0] === 'pdaGenerar')).toHaveLength(2)
    )
    await user.click(screen.getByRole('link', { name: 'Dispositivos vinculados' }))
    await screen.findByRole('table', { name: 'Dispositivos de Empresa A' })
    await user.click(
      screen.getByRole('button', { name: 'Revocar acceso de PDA Campo Norte' })
    )
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Revocar acceso' })
    )
    await screen.findByText('Acceso revocado para PDA Campo Norte.')
    expect(ports.calls).toContainEqual(['pdaRevocar', 'A', 'pda-A-1'])
    await user.click(
      await screen.findByRole('button', { name: 'Renovar acceso de PDA Campo Norte' })
    )
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Renovar acceso' })
    )
    await screen.findByText('Acceso renovado para PDA Campo Norte.')
    expect(ports.calls).toContainEqual(['pdaRenovar', 'A', 'pda-A-1'])
  })

  it('un fallo al renovar conserva el estado revocado y permite reintentar', async () => {
    const user = userEvent.setup()
    const { ports } = montar({ path: '/cosecha/dispositivos' })
    await user.click(
      await screen.findByRole('button', { name: 'Renovar acceso de PDA Almacén' })
    )
    ports.pda.renovar = async () => {
      throw new Error('No se pudo renovar el acceso.')
    }
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Renovar acceso' })
    )
    await screen.findByText('No se pudo renovar el acceso.')
    expect(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Renovar acceso' })
    ).toBeEnabled()
    expect(
      screen.getByRole('button', { name: 'Renovar acceso de PDA Almacén' })
    ).toBeEnabled()
  })

  it('un usuario de consulta puede instalar pero no administrar QR ni equipos', async () => {
    const { ports } = montar({ permisos: ['harvest.view'] })
    await screen.findByRole('heading', { name: 'Instalar la aplicación' })
    expect(
      screen.getByText('Solicita el QR al supervisor de Cosecha.')
    ).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Generar QR' })).not.toBeInTheDocument()
    expect(
      screen.queryByRole('link', { name: 'Dispositivos vinculados' })
    ).not.toBeInTheDocument()
    expect(ports.calls.some((c) => c[0].startsWith('pda'))).toBe(false)
  })

  it('la URL directa de equipos no elude los permisos', async () => {
    const { ports } = montar({
      path: '/cosecha/dispositivos',
      permisos: ['harvest.view']
    })
    await screen.findByRole('heading', { name: 'Acceso restringido' })
    expect(ports.calls.some((c) => c[0] === 'pdaListar')).toBe(false)
  })

  it('un fallo de regeneración no presenta el QR anterior como válido y permite reintentar', async () => {
    const user = userEvent.setup()
    const { ports } = montar()
    const generar = await screen.findByRole('button', { name: 'Generar QR' })
    await waitFor(() => expect(generar).toBeEnabled())
    await user.click(generar)
    await screen.findByRole('img', { name: 'QR para vincular el PDA a la empresa' })
    ports.pda.generar = async () => {
      throw new Error('No se pudo generar el QR.')
    }
    await user.click(screen.getByRole('button', { name: 'Regenerar QR' }))
    await screen.findByText('No se pudo generar el QR.')
    await waitFor(() =>
      expect(
        screen.queryByRole('img', { name: 'QR para vincular el PDA a la empresa' })
      ).not.toBeInTheDocument()
    )
    expect(screen.getByRole('button', { name: 'Regenerar QR' })).toBeEnabled()
  })
})
