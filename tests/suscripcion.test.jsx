import { describe, it, expect } from 'vitest'
import { render, screen, within, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Link, MemoryRouter } from 'react-router'
import { Portal } from '../src/presentation/Portal.jsx'
import { crearPortal } from '../src/application/crearPortal.js'
import { ServicioNoDisponible } from '../src/ports/errores.js'
import { fakePorts } from './support/fakePorts.js'
import { fakeComercial } from './support/fakeComercial.js'
function montar(options = {}, comercial = {}, path = '/configuracion/suscripcion') {
  const ports = fakePorts({
      autenticado: true,
      permisos: { A: ['company.manage'], B: ['company.manage'] },
      ...options
    }),
    extra = fakeComercial(ports, comercial),
    portal = crearPortal(ports)
  render(
    <MemoryRouter initialEntries={[path]}>
      <Portal portal={portal} />
      <Link to="/configuracion/suscripcion">Abrir suscripción por URL</Link>
    </MemoryRouter>
  )
  return { ports, portal, ...extra }
}
async function operacion(user, metodo = 'suspenderSuscripcion') {
  if (!screen.queryByLabelText('Operación'))
    await user.click(
      await screen.findByRole('button', {
        name: 'Administrar suscripción',
        exact: true
      })
    )
  await user.selectOptions(await screen.findByLabelText('Operación'), metodo)
  await user.type(screen.getByLabelText('Motivo'), 'Cambio acordado')
}
describe('Suscripción comercial en Configuración', () => {
  it('administrador ordinario consulta plan, entitlements efectivos/add-on e historial sin acciones comerciales', async () => {
    montar({}, { delegado: false })
    await screen.findByRole('heading', { name: 'Suscripción', exact: true })
    await screen.findByText('Plan A', { selector: 'dd' })
    expect(
      screen.getByText('Tu cuenta tiene acceso de consulta a la suscripción.')
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Administrar suscripción' })
    ).not.toBeInTheDocument()
    await userEvent.setup().click(screen.getByText('Detalles de la suscripción'))
    const tabla = screen.getByRole('table', {
      name: 'Entitlements, add-ons y excepciones'
    })
    expect(within(tabla).getByText('ADD_ON')).toBeInTheDocument()
    expect(screen.getByText('HARVEST · WORKFORCE')).toBeInTheDocument()
    await userEvent.setup().click(screen.getByText('Historial de cambios'))
    expect(screen.getByText('Motivo: Contrato preservado A')).toBeVisible()
    expect(
      screen.queryByRole('button', { name: 'Solicitar cambio comercial' })
    ).not.toBeInTheDocument()
    await userEvent
      .setup()
      .click(screen.getByText('Ver estado anterior, nuevo y contexto'))
    expect(screen.getByRole('heading', { name: 'Estado anterior' })).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /Editar evento|Borrar evento|Delegar/ })
    ).not.toBeInTheDocument()
  })
  it('presenta plan, módulos y facturación sin inventar cobros, fechas de renovación ni pagos a partir de la auditoría', async () => {
    montar()
    await screen.findByText('Plan A', { selector: 'dd' })
    expect(screen.queryByLabelText('Operación')).not.toBeInTheDocument()
    const modulos = within(screen.getByRole('region', { name: 'Módulos incluidos' }))
    expect(modulos.getByText('Cosecha')).toBeVisible()
    expect(modulos.getByText('Personal')).toBeVisible()
    expect(modulos.getByText('Campañas')).toBeVisible()
    expect(modulos.getByText('No contratado')).toBeVisible()
    expect(modulos.getAllByText('Activo')).toHaveLength(2)
    expect(screen.getByText('No informada')).toBeVisible()
    const facturacion = within(screen.getByRole('region', { name: 'Facturación' }))
    expect(facturacion.getByText('Método de pago')).toBeVisible()
    expect(facturacion.getByText('Correo de facturación')).toBeVisible()
    expect(
      facturacion.queryByRole('button', { name: 'Editar' })
    ).not.toBeInTheDocument()
    const pagos = within(screen.getByRole('table', { name: 'Historial de pagos' }))
    expect(pagos.getAllByRole('columnheader').map((h) => h.textContent)).toEqual([
      'Fecha',
      'Concepto',
      'Importe',
      'Estado',
      'Recibo'
    ])
    expect(
      screen.getByText('Aún no hay información de pagos disponible.')
    ).toBeVisible()
    expect(pagos.queryByText(/Contrato preservado|150|4242/)).not.toBeInTheDocument()
    expect(pagos.queryByRole('link')).not.toBeInTheDocument()
  })
  it('cambio de plan autorizado usa intención/versionado y exige preparar explícitamente otra operación', async () => {
    const { ports } = montar(),
      user = userEvent.setup()
    await operacion(user, 'cambiarPlan')
    await user.selectOptions(screen.getByLabelText('Nuevo plan'), 'P2')
    await user.dblClick(
      screen.getByRole('button', { name: 'Solicitar cambio comercial' })
    )
    await screen.findByText(/Cambio aplicado y auditado/)
    await screen.findByText('Plan completo', { selector: 'dd' })
    expect(ports.calls.filter((c) => c[0] === 'cambioComercial')).toHaveLength(1)
    expect(
      screen.getByRole('button', { name: 'Solicitar cambio comercial' })
    ).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Preparar otro cambio' }))
    expect(
      screen.getByRole('button', { name: 'Solicitar cambio comercial' })
    ).not.toBeDisabled()
  })
  it('cambio futuro muestra intención programada y conserva el estado actual', async () => {
    montar()
    const user = userEvent.setup()
    await operacion(user)
    await user.click(screen.getByLabelText('Programar cambio futuro'))
    await user.type(
      screen.getByLabelText('Fecha efectiva (hora local)'),
      '2090-01-01T12:00'
    )
    await user.click(screen.getByRole('button', { name: 'Solicitar cambio comercial' }))
    await screen.findByText(/Cambio programado para/)
    const tabla = await screen.findByRole('table', { name: 'Cambios programados' })
    expect(within(tabla).getByText('SUSPENDER_SUSCRIPCION')).toBeInTheDocument()
    expect(screen.getByText('ACTIVA', { selector: 'dd' })).toBeInTheDocument()
    expect(screen.getByText('HARVEST · WORKFORCE')).toBeInTheDocument()
  })
  it('suspensión y reactivación muestran módulos efectivos devueltos por Platform', async () => {
    montar()
    const user = userEvent.setup()
    await operacion(user)
    await user.click(screen.getByRole('button', { name: 'Solicitar cambio comercial' }))
    await screen.findByText('SUSPENDIDA', { selector: 'dd' })
    expect(screen.getByText('Ningún módulo habilitado actualmente')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Preparar otro cambio' }))
    await operacion(user, 'reactivarSuscripcion')
    await user.click(screen.getByRole('button', { name: 'Solicitar cambio comercial' }))
    await screen.findByText('ACTIVA', { selector: 'dd' })
    expect(screen.getByText('HARVEST · WORKFORCE')).toBeInTheDocument()
  })
  it('cancelación requiere acción explícita y muestra estado terminal del servidor', async () => {
    montar()
    const user = userEvent.setup()
    await operacion(user, 'cancelarSuscripcion')
    expect(
      screen.getByRole('button', { name: 'Solicitar cambio comercial' })
    ).toBeDisabled()
    await user.click(screen.getByLabelText(/Entiendo que la cancelación es terminal/))
    await user.click(screen.getByRole('button', { name: 'Solicitar cambio comercial' }))
    await screen.findByText('CANCELADA', { selector: 'dd' })
  })
  it('habilitar módulo expresa origen add-on; baja utiliza operación semántica', async () => {
    const { ports } = montar(),
      user = userEvent.setup()
    await operacion(user, 'habilitarModulo')
    await user.selectOptions(screen.getByLabelText('Módulo'), 'CAMPAIGN')
    await user.selectOptions(screen.getByLabelText('Origen'), 'EXCEPCION')
    await user.click(screen.getByRole('button', { name: 'Solicitar cambio comercial' }))
    await screen.findByText(/Cambio aplicado y auditado/)
    expect(ports.calls.find((c) => c[0] === 'cambioComercial')[1].parametros).toEqual({
      modulo: 'CAMPAIGN',
      origen: 'EXCEPCION',
      hasta: null
    })
    await user.click(screen.getByRole('button', { name: 'Preparar otro cambio' }))
    await operacion(user, 'deshabilitarModulo')
    await user.selectOptions(screen.getByLabelText('Módulo'), 'HARVEST')
    await user.click(screen.getByRole('button', { name: 'Solicitar cambio comercial' }))
    await waitFor(() =>
      expect(
        ports.calls.filter((c) => c[0] === 'cambioComercial').at(-1)[1].tipoEvento
      ).toBe('DESHABILITAR_MODULO')
    )
  })
  it('fallo de conexión conserva UUID, versión e intención para reintento sin duplicar cambio', async () => {
    const { ports } = montar(),
      user = userEvent.setup(),
      original = ports.comercial.solicitarCambio
    let una = true
    ports.comercial.solicitarCambio = async (d) => {
      const r = await original(d)
      if (una) {
        una = false
        throw new ServicioNoDisponible()
      }
      return r
    }
    await operacion(user)
    await user.click(screen.getByRole('button', { name: 'Solicitar cambio comercial' }))
    await screen.findByText(/No hay confirmación del servidor/)
    expect(
      screen.queryByRole('button', { name: 'Preparar otro cambio' })
    ).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Reintentar misma solicitud' }))
    await screen.findByText(/Cambio aplicado y auditado/)
    const llamadas = ports.calls.filter((c) => c[0] === 'cambioComercial')
    expect(llamadas[0][1]).toEqual(llamadas[1][1])
  })
  it('conflicto de versión permite actualizar y preparar intención nueva sin reintento automático', async () => {
    const { datos } = montar(),
      user = userEvent.setup()
    await operacion(user)
    datos.A.versionBase = '2'
    await user.click(screen.getByRole('button', { name: 'Solicitar cambio comercial' }))
    await screen.findByText(/Conflicto de versión comercial/)
    expect(
      screen.getByRole('button', { name: 'Reintentar misma solicitud' })
    ).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Actualizar suscripción' }))
    await screen.findByText(/Versión del contrato: 2/)
    await user.click(screen.getByRole('button', { name: 'Preparar otro cambio' }))
    await operacion(user)
    await user.click(screen.getByRole('button', { name: 'Solicitar cambio comercial' }))
    await screen.findByText(/Cambio aplicado y auditado/)
  })
  it('URL directa sin company.manage se deniega', async () => {
    montar({ permisos: { A: ['reports.view'] } })
    await screen.findByRole('heading', { name: 'Acceso restringido' })
  })
  it('cambio de empresa limpia contrato, formularios e historial y descarta respuesta tardía', async () => {
    const { ports } = montar({ empresas: ['A', 'B'] }),
      user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: /Empresa A/ }))
    await screen.findByText('Plan A', { selector: 'dd' })
    const original = ports.comercial.consultar
    let resolver, inicio
    const iniciada = new Promise((r) => (inicio = r))
    ports.comercial.consultar = async (t) => {
      const r = await original(t)
      if (t === 'A') {
        inicio()
        await new Promise((r) => (resolver = r))
      }
      return r
    }
    await user.click(screen.getByRole('button', { name: 'Actualizar suscripción' }))
    await iniciada
    await user.click(screen.getByRole('button', { name: 'Menú de usuario' }))
    await user.selectOptions(screen.getByLabelText('Empresa activa'), 'B')
    await screen.findByRole('heading', { name: 'Bienvenido a GesGROW' })
    await act(async () => resolver())
    expect(screen.queryByText('Contrato preservado A')).not.toBeInTheDocument()
    await user.click(screen.getByRole('link', { name: 'Abrir suscripción por URL' }))
    await screen.findByText('Plan B', { selector: 'dd' })
    expect(screen.queryByText('Plan A')).not.toBeInTheDocument()
  })
})
