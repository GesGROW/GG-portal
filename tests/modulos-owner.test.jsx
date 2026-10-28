import { describe, it, expect, vi } from 'vitest'
import { render, screen, within, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { Portal } from '../src/presentation/Portal.jsx'
import { crearPortal } from '../src/application/crearPortal.js'
import { fakePorts } from './support/fakePorts.js'
import { fakeComercial } from './support/fakeComercial.js'
import { fakeReportes } from './support/fakeReportes.js'
import { fakeHarvestAdmin } from './support/fakeHarvestAdmin.js'
import { ServicioNoDisponible } from '../src/ports/errores.js'

function montar({
  adquirido = false,
  delegado = true,
  path = '/modulos',
  permisos = ['company.manage', 'reports.view']
} = {}) {
  const ports = fakePorts({
    autenticado: true,
    permisos: { A: permisos },
    modulos: { A: adquirido ? ['HARVEST'] : [] }
  })
  const comercial = fakeComercial(ports, { delegado })
  comercial.datos.A.modulosPlan = adquirido ? ['HARVEST'] : []
  comercial.datos.A.modulosEfectivos = adquirido ? ['HARVEST'] : []
  comercial.datos.A.estado.modulos = []
  fakeReportes(ports)
  fakeHarvestAdmin(ports)
  const consultasCosecha = vi.spyOn(ports.harvestAdmin, 'campanias')
  const portal = crearPortal(ports)
  render(
    <MemoryRouter initialEntries={[path]}>
      <Portal portal={portal} />
    </MemoryRouter>
  )
  return { ports, portal, ...comercial, consultasCosecha, user: userEvent.setup() }
}

describe('Módulos del owner', () => {
  it('abre el catálogo desde el sidebar sin opciones operativas ni compra automática', async () => {
    const { ports, user } = montar({ path: '/' })
    await user.click(await screen.findByRole('link', { name: 'Módulos', exact: true }))
    await screen.findByRole('heading', { name: 'Módulos Adquiridos' })
    expect(
      await screen.findByRole('button', { name: 'Seleccionar Cosecha' })
    ).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Adquirir 0 módulo(s)' })).toBeDisabled()
    expect(
      screen.queryByRole('link', { name: 'App de Cosecha' })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('link', { name: /Registros|Tickets|Reportes/ })
    ).not.toBeInTheDocument()
    expect(ports.calls.some((c) => c[0] === 'cambioComercial')).toBe(false)
  })

  it('selecciona y quita por teclado sin escribir; solo permite un Cosecha', async () => {
    const { user, ports } = montar()
    const modulo = await screen.findByRole('button', { name: 'Seleccionar Cosecha' })
    modulo.focus()
    await user.keyboard('{Enter}')
    expect(screen.getByRole('button', { name: 'Adquirir 1 módulo(s)' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Cosecha seleccionado' })).toBeDisabled()
    await user.click(
      screen.getByRole('button', { name: 'Quitar Cosecha de la selección' })
    )
    expect(screen.getByRole('button', { name: 'Adquirir 0 módulo(s)' })).toBeDisabled()
    expect(ports.calls.some((c) => c[0] === 'cambioComercial')).toBe(false)
  })

  it('acepta solo el módulo del catálogo al arrastrar al área superior', async () => {
    montar()
    await screen.findByRole('button', { name: 'Seleccionar Cosecha' })
    const destino = screen.getByRole('region', {
      name: 'Módulos adquiridos y seleccionados'
    })
    fireEvent.drop(destino, { dataTransfer: { getData: () => 'OTRO' } })
    expect(screen.getByRole('button', { name: 'Adquirir 0 módulo(s)' })).toBeDisabled()
    fireEvent.drop(destino, { dataTransfer: { getData: () => 'HARVEST' } })
    expect(screen.getByRole('button', { name: 'Adquirir 1 módulo(s)' })).toBeEnabled()
  })

  it('los módulos contratados no abren operaciones ni se pueden volver a adquirir', async () => {
    montar({ adquirido: true })
    expect(
      await screen.findByRole('group', { name: 'Cosecha adquirido' })
    ).toBeVisible()
    expect(screen.getByRole('button', { name: 'Cosecha ya adquirido' })).toBeDisabled()
    expect(
      screen.queryByRole('link', { name: 'App de Cosecha' })
    ).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Adquirir 0 módulo(s)' })).toBeDisabled()
  })

  it('sin autorización comercial explica la contratación y no envía cambios', async () => {
    const { ports, user } = montar({ delegado: false })
    await user.click(await screen.findByRole('button', { name: 'Seleccionar Cosecha' }))
    await user.click(screen.getByRole('button', { name: 'Adquirir 1 módulo(s)' }))
    const dialogo = within(screen.getByRole('dialog'))
    expect(dialogo.getByText(/La compra con pago aún no está disponible/)).toBeVisible()
    expect(
      dialogo.queryByRole('button', { name: 'Activar módulo' })
    ).not.toBeInTheDocument()
    expect(ports.calls.some((c) => c[0] === 'cambioComercial')).toBe(false)
  })

  it('la activación autorizada requiere acción explícita y reintenta el mismo ID sin duplicar', async () => {
    const { ports, user } = montar()
    const original = ports.comercial.solicitarCambio
    let primera = true
    ports.comercial.solicitarCambio = async (d) => {
      const r = await original(d)
      if (primera) {
        primera = false
        throw new ServicioNoDisponible()
      }
      return r
    }
    await user.click(await screen.findByRole('button', { name: 'Seleccionar Cosecha' }))
    await user.click(screen.getByRole('button', { name: 'Adquirir 1 módulo(s)' }))
    expect(ports.calls.some((c) => c[0] === 'cambioComercial')).toBe(false)
    await user.dblClick(screen.getByRole('button', { name: 'Activar módulo' }))
    await screen.findByRole('alert')
    await user.click(screen.getByRole('button', { name: 'Reintentar activación' }))
    await screen.findByText('Cosecha se ha activado para tu empresa.')
    const cambios = ports.calls.filter((c) => c[0] === 'cambioComercial')
    expect(cambios).toHaveLength(2)
    expect(cambios[0][1]).toEqual(cambios[1][1])
    expect(cambios[0][1].parametros).toEqual({
      modulo: 'HARVEST',
      origen: 'ADD_ON',
      hasta: null
    })
  })

  it('sin company.manage se deniega la URL y no se consulta el contrato', async () => {
    const { ports } = montar({ permisos: ['harvest.view'] })
    await screen.findByRole('heading', { name: 'Acceso restringido' })
    expect(ports.calls.some((c) => c[0] === 'consultarComercial')).toBe(false)
  })

  it('el owner con Cosecha contratado no accede a la ruta operativa ni consulta sus datos', async () => {
    const { consultasCosecha } = montar({ adquirido: true, path: '/cosecha/registros' })
    await screen.findByRole('heading', { name: 'Acceso restringido' })
    expect(consultasCosecha).not.toHaveBeenCalled()
  })

  it('el owner con Cosecha contratado tampoco abre la app por URL directa', async () => {
    montar({ adquirido: true, path: '/cosecha/app' })
    await screen.findByRole('heading', { name: 'Acceso restringido' })
    expect(
      screen.queryByRole('link', { name: 'App de Cosecha' })
    ).not.toBeInTheDocument()
  })

  it('Home enlaza al reporte diario y al ranking de la campaña elegida', async () => {
    montar({ adquirido: true, path: '/' })
    await screen.findByText('Ana A')
    expect(screen.getByRole('link', { name: 'Ver producción diaria' })).toHaveAttribute(
      'href',
      '/reportes/diaria?campania=A-camp'
    )
    expect(screen.getByRole('link', { name: 'Ver ranking completo' })).toHaveAttribute(
      'href',
      '/reportes/ranking?campania=A-camp'
    )
  })
})
