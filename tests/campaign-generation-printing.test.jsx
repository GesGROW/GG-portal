import { describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { GeneracionCampania } from '../src/presentation/CampaniaCosecha.jsx'

const op = '489b3f25-e190-481b-895b-78c68b55f9b1'
const recibo = {
  formatoImpresion: 'TSC_30X20_3',
  operacionId: op,
  campaniaId: 'c1',
  cantidadTickets: 43,
  tamanioLote: 10,
  lotes: [{ id: 'l1', codigoLote: '010613', cantidadTickets: 43 }]
}
function diferida() {
  let resolver, rechazar
  const promesa = new Promise((r, j) => {
    resolver = r
    rechazar = j
  })
  return { promesa, resolver, rechazar }
}
function montar(props = {}, configurar = () => {}) {
  const vistas = [],
    destinos = []
  const crearVista = () => {
    const v = { url: 'blob:preview-' + vistas.length, cerrar: vi.fn() }
    vistas.push(v)
    return v
  }
  const servicio = {
    generar: vi.fn(),
    previsualizarGeneracion: vi.fn(async (s) => ({
      ...recibo,
      ...s,
      vista: crearVista()
    })),
    confirmarGeneracion: vi.fn(async (s) => ({
      ...recibo,
      ...s,
      estadoImpresion: 'PENDIENTE'
    })),
    resolverImpresion: vi.fn(async (id, impresa) =>
      impresa
        ? { ...recibo, operacionId: id, estadoImpresion: 'IMPRESA' }
        : { operacionId: id, cancelada: true }
    ),
    abrirImpresion: vi.fn((opciones) => {
      const d = { opciones, cerrar: vi.fn() }
      destinos.push(d)
      return d
    }),
    imprimirGeneracion: vi.fn(async (id, d) =>
      d.opciones.modo === 'vista'
        ? crearVista()
        : { dialogoAbierto: true, impresionSolicitada: true }
    ),
    recuperarGeneracion: vi.fn(async () => recibo)
  }
  configurar(servicio)
  const vista = render(
    <GeneracionCampania
      servicio={servicio}
      campania={{ id: 'c1', estado: 'ACTIVA' }}
      {...props}
    />
  )
  return { ...vista, servicio, vistas, destinos, user: userEvent.setup() }
}
async function preparar(user) {
  for (const [label, v] of [
    ['Cantidad total de tickets', '43'],
    ['Tickets por lote', '10']
  ]) {
    await user.clear(screen.getByLabelText(label))
    await user.type(screen.getByLabelText(label), v)
  }
  await user.click(screen.getByRole('button', { name: 'Ver vista previa' }))
  return screen.findByTitle('Vista previa PDF de tickets')
}

async function aceptar() {
  await act(async () =>
    screen.getByRole('button', { name: 'Sí, se imprimieron' }).click()
  )
}

describe('Vista previa dentro del generador y confirmación explícita', () => {
  it('No cancela el documento provisional y reinicia sin confirmar impresión ni contar', async () => {
    const onNuevaGeneracion = vi.fn()
    const { user, servicio, vistas } = montar({ onNuevaGeneracion })
    await preparar(user)
    await user.click(screen.getByRole('button', { name: 'Imprimir y guardar' }))
    expect(screen.getByText('¿Se imprimieron los tickets?')).toBeInTheDocument()
    expect(servicio.resolverImpresion).not.toHaveBeenCalled()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'No, cancelar' }))
    expect(servicio.resolverImpresion).toHaveBeenCalledExactlyOnceWith(
      servicio.confirmarGeneracion.mock.calls[0][0].operacionId,
      false
    )
    expect(screen.getByLabelText('Cantidad total de tickets')).toHaveValue(0)
    expect(screen.getByText('Acá aparecerá la vista previa')).toBeInTheDocument()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(vistas[0].cerrar).toHaveBeenCalledTimes(1)
    expect(onNuevaGeneracion).toHaveBeenCalledTimes(1)
  })
  it('fallar al cancelar conserva la pregunta y reintenta la misma operación', async () => {
    const { user, servicio } = montar()
    await preparar(user)
    await user.click(screen.getByRole('button', { name: 'Imprimir y guardar' }))
    servicio.resolverImpresion.mockRejectedValueOnce(new Error('Sin conexión'))
    await user.click(screen.getByRole('button', { name: 'No, cancelar' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Sin conexión')
    expect(screen.getByLabelText('Cantidad total de tickets')).toHaveValue(43)
    expect(screen.getByRole('button', { name: 'No, cancelar' })).toBeEnabled()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'No, cancelar' }))
    expect(servicio.resolverImpresion.mock.calls[0]).toEqual(
      servicio.resolverImpresion.mock.calls[1]
    )
    expect(servicio.confirmarGeneracion).toHaveBeenCalledTimes(1)
  })
  it('espera la confirmación del servidor; un doble clic no guarda dos veces', async () => {
    const { user, servicio } = montar(),
      d = diferida()
    await preparar(user)
    await user.click(screen.getByRole('button', { name: 'Imprimir y guardar' }))
    servicio.resolverImpresion.mockReturnValueOnce(d.promesa)
    await user.dblClick(screen.getByRole('button', { name: 'Sí, se imprimieron' }))
    expect(servicio.resolverImpresion).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Guardando…' })).toBeDisabled()
    await act(async () => d.rechazar(new Error('Respuesta perdida')))
    expect(screen.getByRole('alert')).toHaveTextContent('Respuesta perdida')
    expect(screen.getByRole('button', { name: 'Sí, se imprimieron' })).toBeEnabled()
    await aceptar()
    expect(servicio.resolverImpresion.mock.calls[0]).toEqual(
      servicio.resolverImpresion.mock.calls[1]
    )
    expect(screen.getByRole('status')).toHaveTextContent('Restableciendo valores en 3')
  })
  it('recupera un documento pendiente y permite cancelarlo sin imprimir de nuevo', async () => {
    const { user, servicio } = montar({ operacionId: op }, (s) =>
      s.recuperarGeneracion.mockResolvedValue({
        ...recibo,
        estadoImpresion: 'PENDIENTE'
      })
    )
    await screen.findByTitle('Vista previa PDF de tickets')
    await user.click(screen.getByRole('button', { name: 'No, cancelar' }))
    expect(servicio.resolverImpresion).toHaveBeenCalledExactlyOnceWith(op, false)
    expect(servicio.imprimirGeneracion).toHaveBeenCalledTimes(1)
    expect(servicio.imprimirGeneracion.mock.calls[0][1].opciones.modo).toBe('vista')
    expect(servicio.confirmarGeneracion).not.toHaveBeenCalled()
  })
  it('muestra PDF dentro del contenedor sin guardar ni abrir ventanas', async () => {
    const { user, servicio } = montar()
    const iframe = await preparar(user)
    expect(iframe.closest('form')).toHaveClass('campaign-generation')
    expect(iframe).toHaveAttribute(
      'src',
      'blob:preview-0#toolbar=0&navpanes=0&view=FitH'
    )
    expect(servicio.confirmarGeneracion).not.toHaveBeenCalled()
    expect(servicio.generar).not.toHaveBeenCalled()
    expect(servicio.abrirImpresion).not.toHaveBeenCalled()
    expect(screen.getByLabelText('Cantidad total de tickets')).toBeEnabled()
  })
  it('presenta el recuadro vacío y solo el flujo PDF sin configuración técnica', () => {
    const { servicio } = montar()
    expect(screen.getByText('Acá aparecerá la vista previa')).toBeInTheDocument()
    expect(screen.getByLabelText('Paso 4: pendiente')).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Descartar generación' })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('combobox', { name: 'Formato de salida' })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByLabelText('Nombre de impresora Windows')
    ).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Token del servicio local')).not.toBeInTheDocument()
    expect(screen.queryByText('Descargar TSPL')).not.toBeInTheDocument()
    expect(screen.queryByText('Imprimir directa TSC')).not.toBeInTheDocument()
    expect(servicio.previsualizarGeneracion).not.toHaveBeenCalled()
    expect(servicio.confirmarGeneracion).not.toHaveBeenCalled()
  })
  it('descartar restablece cantidades y vista previa y cambia de operación', async () => {
    const onNuevaGeneracion = vi.fn()
    const { user, servicio, vistas } = montar({ onNuevaGeneracion })
    await preparar(user)
    const anterior = servicio.previsualizarGeneracion.mock.calls[0][0].operacionId
    await user.click(screen.getByRole('button', { name: 'Descartar generación' }))
    expect(screen.getByLabelText('Cantidad total de tickets')).toHaveValue(0)
    expect(screen.getByLabelText('Tickets por lote')).toHaveValue(0)
    expect(screen.getByText('Acá aparecerá la vista previa')).toBeInTheDocument()
    expect(vistas[0].cerrar).toHaveBeenCalledTimes(1)
    expect(onNuevaGeneracion).toHaveBeenCalledTimes(1)
    await preparar(user)
    expect(servicio.previsualizarGeneracion.mock.calls[1][0].operacionId).not.toBe(
      anterior
    )
    expect(servicio.confirmarGeneracion).not.toHaveBeenCalled()
  })
  it('cuenta 3, 2, 1 y reinicia sin cerrar el PDF entregado ni permitir otra confirmación', async () => {
    const onNuevaGeneracion = vi.fn()
    const { user, servicio, destinos, vistas, unmount } = montar({ onNuevaGeneracion })
    await preparar(user)
    vi.useFakeTimers()
    try {
      await act(async () =>
        screen.getByRole('button', { name: 'Imprimir y guardar' }).click()
      )
      await aceptar()
      expect(screen.getByRole('status')).toHaveTextContent(
        'Restableciendo valores en 3'
      )
      expect(screen.getByLabelText('Paso 4: completo')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Imprimir y guardar' })).toBeDisabled()
      expect(
        screen.getByRole('button', { name: 'Descartar generación' })
      ).toBeDisabled()
      for (const n of [2, 1]) {
        await act(async () => vi.advanceTimersByTime(1000))
        expect(screen.getByRole('status')).toHaveTextContent(
          `Restableciendo valores en ${n}`
        )
        expect(onNuevaGeneracion).not.toHaveBeenCalled()
      }
      await act(async () => vi.advanceTimersByTime(1000))
      expect(screen.queryByRole('status')).not.toBeInTheDocument()
      expect(screen.getByLabelText('Cantidad total de tickets')).toHaveValue(0)
      expect(screen.getByLabelText('Tickets por lote')).toHaveValue(0)
      expect(screen.getByLabelText('Paso 4: pendiente')).toBeInTheDocument()
      expect(screen.getByText('Acá aparecerá la vista previa')).toBeInTheDocument()
      expect(vistas[0].cerrar).toHaveBeenCalledTimes(1)
      expect(destinos[0].cerrar).not.toHaveBeenCalled()
      expect(servicio.confirmarGeneracion).toHaveBeenCalledTimes(1)
      expect(onNuevaGeneracion).toHaveBeenCalledTimes(1)
      unmount()
      expect(destinos[0].cerrar).not.toHaveBeenCalled()
    } finally {
      unmount()
      vi.useRealTimers()
    }
  })
  it('limpia la cuenta al salir y conserva el recibo sin reiniciar si falla la salida', async () => {
    const onNuevaGeneracion = vi.fn()
    const { user, servicio, unmount } = montar({ onNuevaGeneracion })
    await preparar(user)
    servicio.imprimirGeneracion.mockRejectedValueOnce(
      new Error('Impresora desconectada')
    )
    vi.useFakeTimers()
    try {
      await act(async () =>
        screen.getByRole('button', { name: 'Imprimir y guardar' }).click()
      )
      await act(async () => vi.advanceTimersByTime(4000))
      expect(screen.getByRole('alert')).toHaveTextContent('Impresora desconectada')
      expect(screen.queryByRole('status')).not.toBeInTheDocument()
      expect(screen.getByLabelText('Cantidad total de tickets')).toHaveValue(43)
      expect(onNuevaGeneracion).not.toHaveBeenCalled()
      await act(async () =>
        screen.getByRole('button', { name: 'Imprimir mismo recibo' }).click()
      )
      await aceptar()
      expect(screen.getByRole('status')).toHaveTextContent(
        'Restableciendo valores en 3'
      )
      unmount()
      await act(async () => vi.advanceTimersByTime(4000))
      expect(onNuevaGeneracion).not.toHaveBeenCalled()
      expect(vi.getTimerCount()).toBe(0)
    } finally {
      unmount()
      vi.useRealTimers()
    }
  })
  it('editar cantidades invalida la revisión y libera su PDF', async () => {
    const { user, servicio, vistas } = montar()
    await preparar(user)
    await user.clear(screen.getByLabelText('Tickets por lote'))
    await user.type(screen.getByLabelText('Tickets por lote'), '5')
    expect(screen.queryByTitle('Vista previa PDF de tickets')).not.toBeInTheDocument()
    expect(vistas[0].cerrar).toHaveBeenCalledTimes(1)
    await user.click(screen.getByRole('button', { name: 'Ver vista previa' }))
    await screen.findByTitle('Vista previa PDF de tickets')
    expect(servicio.confirmarGeneracion).not.toHaveBeenCalled()
  })
  it('solo Imprimir y guardar abre destino en el gesto y confirma antes de enviar', async () => {
    const { user, servicio, destinos } = montar(),
      d = diferida()
    servicio.confirmarGeneracion.mockReturnValue(d.promesa)
    await preparar(user)
    act(() => screen.getByRole('button', { name: 'Imprimir y guardar' }).click())
    expect(servicio.abrirImpresion).toHaveBeenCalledExactlyOnceWith({
      modo: 'pdf',
      imprimirAlAbrir: true,
      enPagina: true,
      separacionColumnasMm: 2,
      separacionFilasMm: 2,
      margenIzquierdoMm: 3
    })
    expect(servicio.abrirImpresion.mock.invocationCallOrder[0]).toBeLessThan(
      servicio.confirmarGeneracion.mock.invocationCallOrder[0]
    )
    expect(servicio.imprimirGeneracion).not.toHaveBeenCalled()
    expect(screen.queryByText(/Generación guardada:/)).not.toBeInTheDocument()
    expect(
      screen.queryByRole('link', { name: 'Enlace a esta operación' })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Preparar otra generación' })
    ).not.toBeInTheDocument()
    expect(screen.getByLabelText('Cantidad total de tickets')).toBeDisabled()
    const s = servicio.confirmarGeneracion.mock.calls[0][0]
    await act(async () => d.resolver({ ...recibo, ...s }))
    expect(servicio.imprimirGeneracion).toHaveBeenCalledExactlyOnceWith(
      s.operacionId,
      destinos[0]
    )
    await aceptar()
    expect(screen.getByRole('status')).toHaveTextContent(
      'Lote de tickets guardados e impresos.'
    )
    expect(servicio.generar).not.toHaveBeenCalled()
  })
  it('destino no disponible conserva la vista previa y no confirma', async () => {
    const { user, servicio } = montar()
    await preparar(user)
    servicio.abrirImpresion.mockImplementation(() => {
      throw new Error('Impresión no disponible')
    })
    await user.click(screen.getByRole('button', { name: 'Imprimir y guardar' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Impresión no disponible'
    )
    expect(servicio.confirmarGeneracion).not.toHaveBeenCalled()
    expect(screen.getByLabelText('Cantidad total de tickets')).toBeEnabled()
  })
  it('respuesta perdida reintenta la misma confirmación y bloquea editar la intención', async () => {
    const { user, servicio } = montar()
    await preparar(user)
    servicio.confirmarGeneracion.mockRejectedValueOnce(new Error('Respuesta perdida'))
    await user.click(screen.getByRole('button', { name: 'Imprimir y guardar' }))
    await screen.findByRole('alert')
    expect(screen.getByLabelText('Cantidad total de tickets')).toBeDisabled()
    expect(
      screen.getByRole('button', { name: 'Actualizar vista previa' })
    ).toBeDisabled()
    const s = servicio.confirmarGeneracion.mock.calls[0][0]
    await user.click(screen.getByRole('button', { name: 'Reintentar confirmación' }))
    await screen.findByRole('button', { name: 'Sí, se imprimieron' })
    await aceptar()
    expect(screen.getByRole('status')).toHaveTextContent(
      'Lote de tickets guardados e impresos.'
    )
    expect(servicio.confirmarGeneracion.mock.calls).toEqual([[s], [s]])
    expect(servicio.previsualizarGeneracion).toHaveBeenCalledTimes(1)
  })
  it('códigos ocupados exigen actualizar la vista previa antes de confirmar otra vez', async () => {
    const { user, servicio } = montar()
    await preparar(user)
    servicio.confirmarGeneracion.mockRejectedValueOnce(
      new Error('La vista previa cambió. Actualízala')
    )
    await user.click(screen.getByRole('button', { name: 'Imprimir y guardar' }))
    await screen.findByRole('alert')
    expect(screen.getByRole('button', { name: 'Imprimir y guardar' })).toBeDisabled()
    expect(servicio.imprimirGeneracion).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Actualizar vista previa' }))
    expect(servicio.previsualizarGeneracion).toHaveBeenCalledTimes(2)
    await user.click(screen.getByRole('button', { name: 'Imprimir y guardar' }))
    await screen.findByRole('button', { name: 'Sí, se imprimieron' })
    await aceptar()
    expect(screen.getByRole('status')).toHaveTextContent(
      'Lote de tickets guardados e impresos.'
    )
  })
  it('fallo de salida conserva el recibo guardado y reimprime sin confirmar de nuevo', async () => {
    const { user, servicio } = montar()
    await preparar(user)
    servicio.imprimirGeneracion.mockRejectedValueOnce(
      new Error('Impresión no disponible')
    )
    await user.click(screen.getByRole('button', { name: 'Imprimir y guardar' }))
    await screen.findByRole('alert')
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Imprimir mismo recibo' }))
    await aceptar()
    expect(screen.getByRole('status')).toHaveTextContent('Restableciendo valores en 3')
    expect(servicio.confirmarGeneracion).toHaveBeenCalledTimes(1)
    expect(servicio.imprimirGeneracion).toHaveBeenCalledTimes(2)
  })
  it('espera el cierre del diálogo antes del mensaje y de los tres segundos de reinicio', async () => {
    const onNuevaGeneracion = vi.fn()
    const { user, servicio, unmount } = montar({ onNuevaGeneracion }),
      d = diferida()
    await preparar(user)
    servicio.imprimirGeneracion.mockReturnValue(d.promesa)
    await user.click(screen.getByRole('button', { name: 'Imprimir y guardar' }))
    vi.useFakeTimers()
    try {
      await act(async () => vi.advanceTimersByTime(10000))
      expect(screen.queryByRole('status')).not.toBeInTheDocument()
      expect(screen.queryByText(/Generación guardada:/)).not.toBeInTheDocument()
      expect(
        screen.queryByRole('button', { name: 'Preparar otra generación' })
      ).not.toBeInTheDocument()
      expect(screen.getByLabelText('Cantidad total de tickets')).toHaveValue(43)
      expect(
        screen.getByRole('button', { name: 'Actualizar vista previa' })
      ).toBeDisabled()
      expect(screen.getByRole('button', { name: 'Preparando…' })).toHaveAttribute(
        'type',
        'button'
      )
      expect(screen.getAllByRole('button', { name: 'Preparando…' })).toHaveLength(1)
      expect(onNuevaGeneracion).not.toHaveBeenCalled()
      await act(async () =>
        d.resolver({
          dialogoAbierto: true,
          dialogoCerrado: true,
          impresionSolicitada: true
        })
      )
      expect(screen.queryByRole('status')).not.toBeInTheDocument()
      expect(servicio.resolverImpresion).not.toHaveBeenCalled()
      await act(async () => vi.advanceTimersByTime(10000))
      expect(onNuevaGeneracion).not.toHaveBeenCalled()
      await aceptar()
      expect(screen.getByRole('status')).toHaveTextContent(
        'Lote de tickets guardados e impresos.Restableciendo valores en 3'
      )
      for (const n of [2, 1]) {
        await act(async () => vi.advanceTimersByTime(1000))
        expect(screen.getByRole('status')).toHaveTextContent(
          `Restableciendo valores en ${n}`
        )
        expect(onNuevaGeneracion).not.toHaveBeenCalled()
      }
      await act(async () => vi.advanceTimersByTime(1000))
      expect(screen.getByLabelText('Cantidad total de tickets')).toHaveValue(0)
      expect(onNuevaGeneracion).toHaveBeenCalledTimes(1)
      expect(servicio.confirmarGeneracion).toHaveBeenCalledTimes(1)
    } finally {
      unmount()
      vi.useRealTimers()
    }
  })
  it('salir durante la preparación libera la respuesta tardía sin imprimir ni guardar', async () => {
    const { user, servicio, unmount } = montar(),
      d = diferida(),
      cerrar = vi.fn()
    servicio.previsualizarGeneracion.mockReturnValue(d.promesa)
    for (const label of ['Cantidad total de tickets', 'Tickets por lote']) {
      await user.clear(screen.getByLabelText(label))
      await user.type(screen.getByLabelText(label), '10')
    }
    await user.click(screen.getByRole('button', { name: 'Ver vista previa' }))
    unmount()
    await act(async () =>
      d.resolver({ ...recibo, vista: { url: 'blob:tardia', cerrar } })
    )
    expect(cerrar).toHaveBeenCalledTimes(1)
    expect(servicio.confirmarGeneracion).not.toHaveBeenCalled()
    expect(servicio.imprimirGeneracion).not.toHaveBeenCalled()
  })
  it('salir durante confirmación cierra el destino y no inicia impresión tardía', async () => {
    const { user, servicio, unmount, destinos } = montar(),
      d = diferida()
    await preparar(user)
    servicio.confirmarGeneracion.mockReturnValue(d.promesa)
    await user.click(screen.getByRole('button', { name: 'Imprimir y guardar' }))
    unmount()
    await act(async () => d.resolver(recibo))
    expect(destinos[0].cerrar).toHaveBeenCalledTimes(1)
    expect(servicio.imprimirGeneracion).not.toHaveBeenCalled()
  })
  it('doble clic confirma una vez; descartar el borrador no crea generación', async () => {
    const { user, servicio, vistas } = montar()
    await preparar(user)
    await user.click(screen.getByRole('button', { name: 'Descartar generación' }))
    expect(vistas[0].cerrar).toHaveBeenCalledTimes(1)
    expect(servicio.confirmarGeneracion).not.toHaveBeenCalled()
    expect(screen.getByLabelText('Cantidad total de tickets')).toHaveValue(0)
    expect(screen.getByLabelText('Tickets por lote')).toHaveValue(0)
    await preparar(user)
    await user.dblClick(screen.getByRole('button', { name: 'Imprimir y guardar' }))
    expect(servicio.confirmarGeneracion).toHaveBeenCalledTimes(1)
  })
  it('recuperar una generación cerrada presenta PDF interno y reimprime sin generar', async () => {
    const { user, servicio } = montar({
      operacionId: op,
      campania: { id: 'c1', estado: 'CERRADA' }
    })
    await screen.findByTitle('Vista previa PDF de tickets')
    expect(servicio.confirmarGeneracion).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Imprimir mismo recibo' }))
    expect(servicio.imprimirGeneracion).toHaveBeenCalledTimes(2)
    expect(servicio.confirmarGeneracion).not.toHaveBeenCalled()
    expect(servicio.generar).not.toHaveBeenCalled()
  })
  it('recibo de otra campaña no entrega vista previa y ofrece recuperación', async () => {
    const { servicio } = montar({ operacionId: op }, (s) =>
      s.recuperarGeneracion.mockResolvedValue({ ...recibo, campaniaId: 'otra' })
    )
    expect(await screen.findByRole('alert')).toHaveTextContent('no pertenece')
    expect(servicio.imprimirGeneracion).not.toHaveBeenCalled()
    expect(
      screen.getByRole('button', { name: 'Reintentar recuperación' })
    ).toBeEnabled()
  })
})
