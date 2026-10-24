import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  GeneracionCampania,
  CampaniaCosecha
} from '../src/presentation/CampaniaCosecha.jsx'
import { MemoryRouter, createMemoryRouter, RouterProvider } from 'react-router'
function montar(estado = 'ACTIVA') {
  const servicio = {
    abrirImpresion: vi.fn(() => ({ cerrar: vi.fn() })),
    generar: vi.fn(async (d) => ({
      ...d,
      lotes: [{ id: 'l1', cantidadTickets: d.cantidadTickets }]
    })),
    imprimirGeneracion: vi.fn(async () => ({ dialogoAbierto: true }))
  }
  const vista = render(
    <GeneracionCampania servicio={servicio} campania={{ id: 'c1', estado }} />
  )
  return { servicio, user: userEvent.setup(), ...vista }
}
describe('Generación dentro de una campaña', () => {
  it.each([
    ['/cosecha/generar?lote=LT-1', 'c1', 'REPLACE'],
    ['/cosecha/generar?campania=c2&lote=LT-1', 'c2', 'POP']
  ])(
    'al entrar por %s, la URL y los tickets usan la misma campaña',
    async (entrada, elegida, accion) => {
      let resolver
      const catalogo = new Promise((resolve) => {
        resolver = resolve
      })
      const servicio = {
        campanias: vi.fn(() => catalogo),
        abrirImpresion: vi.fn(() => ({ cerrar: vi.fn() })),
        generar: vi.fn(async (d) => ({ ...d, lotes: [{ id: 'LT-nuevo' }] })),
        imprimirGeneracion: vi.fn(async () => {})
      }
      const router = createMemoryRouter(
        [
          {
            path: '*',
            element: (
              <CampaniaCosecha
                servicio={servicio}
                contexto={{ permite: () => true }}
                seccion="generar"
              />
            )
          }
        ],
        { initialEntries: [entrada] }
      )
      render(<RouterProvider router={router} />)
      expect(router.state.location.search).toBe(
        new URL(entrada, 'https://portal.test').search
      )
      expect(
        screen.queryByLabelText('Cantidad total de tickets')
      ).not.toBeInTheDocument()
      await act(async () =>
        resolver([
          { id: 'cerrada', nombre: 'Anterior', estado: 'CERRADA' },
          { id: 'c1', nombre: 'Actual', estado: 'ACTIVA' },
          { id: 'c2', nombre: 'Otra', estado: 'ACTIVA' }
        ])
      )
      await screen.findByLabelText('Cantidad total de tickets')
      const params = new URLSearchParams(router.state.location.search)
      expect(params.get('campania')).toBe(elegida)
      expect(params.get('lote')).toBe('LT-1')
      expect(router.state.historyAction).toBe(accion)
      expect(servicio.campanias).toHaveBeenCalledTimes(1)
      const user = userEvent.setup()
      await user.clear(screen.getByLabelText('Cantidad total de tickets'))
      await user.type(screen.getByLabelText('Cantidad total de tickets'), '10')
      await user.clear(screen.getByLabelText('Tickets por lote'))
      await user.type(screen.getByLabelText('Tickets por lote'), '5')
      await user.click(screen.getByRole('button', { name: 'Imprimir tickets' }))
      await screen.findByLabelText('Paso 3: completo')
      expect(servicio.generar).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({
          campaniaId: elegida,
          cantidadTickets: 10,
          tamanioLote: 5
        })
      )
    }
  )
  it('el contenedor muestra la activa como actual, conserva las tres opciones y reinicia al cambiar de campaña', async () => {
    const user = userEvent.setup()
    const servicio = {
      campanias: async () => [
        { id: 'c1', nombre: 'Campaña actual', estado: 'ACTIVA' },
        { id: 'c2', nombre: 'Campaña anterior', estado: 'CERRADA' }
      ]
    }
    render(
      <MemoryRouter initialEntries={['/cosecha/generar?campania=c1']}>
        <CampaniaCosecha
          servicio={servicio}
          contexto={{ permite: () => true }}
          seccion="generar"
          puedeTrabajadores={false}
        />
      </MemoryRouter>
    )
    await screen.findByLabelText('Cantidad total de tickets')
    expect(
      screen.getByRole('option', { name: 'Campaña actual (actual)' })
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Tickets', exact: true })).toHaveAttribute(
      'aria-current',
      'page'
    )
    expect(
      screen.getByRole('link', { name: 'Trabajadores', exact: true })
    ).toHaveAttribute('href', '/cosecha/cosechadores?campania=c1')
    expect(screen.getByRole('link', { name: 'Reportes', exact: true })).toHaveAttribute(
      'href',
      '/cosecha/produccion?campania=c1'
    )
    await user.clear(screen.getByLabelText('Cantidad total de tickets'))
    await user.type(screen.getByLabelText('Cantidad total de tickets'), '100')
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Campaña de cosecha' }),
      'c2'
    )
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Esta campaña está cerrada'
    )
    expect(screen.getByLabelText('Cantidad total de tickets')).toHaveValue(0)
    expect(
      screen.queryByRole('button', { name: 'Imprimir tickets' })
    ).not.toBeInTheDocument()
  })
  it('inicia en cero, completa cada paso y abre la impresión sólo con ambos datos válidos', async () => {
    const { user, servicio } = montar()
    const total = screen.getByLabelText('Cantidad total de tickets'),
      lote = screen.getByLabelText('Tickets por lote')
    expect(total).toHaveValue(0)
    expect(lote).toHaveValue(0)
    await user.click(
      screen.getByRole('button', { name: 'Aumentar cantidad total de tickets' })
    )
    expect(total).toHaveValue(1)
    await user.click(
      screen.getByRole('button', { name: 'Disminuir cantidad total de tickets' })
    )
    expect(total).toHaveValue(0)
    expect(
      screen.queryByRole('button', { name: 'Imprimir tickets' })
    ).not.toBeInTheDocument()
    await user.clear(total)
    await user.type(total, '100')
    expect(screen.getByLabelText('Paso 1: completo')).toBeInTheDocument()
    expect(screen.getByLabelText('Paso 2: pendiente')).toBeInTheDocument()
    await user.clear(lote)
    await user.type(lote, '20')
    expect(screen.getByLabelText('Paso 2: completo')).toBeInTheDocument()
    expect(screen.getByLabelText('Paso 3: pendiente')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Imprimir tickets' }))
    expect(await screen.findByLabelText('Paso 3: completo')).toBeInTheDocument()
    expect(servicio.generar.mock.calls[0][0]).toMatchObject({
      cantidadTickets: 100,
      tamanioLote: 20,
      campaniaId: 'c1'
    })
    expect(servicio.imprimirGeneracion).toHaveBeenCalledTimes(1)
  })
  it('un error de impresión deja pendiente el tercer paso y reintenta sin generar otra vez', async () => {
    const { user, servicio } = montar()
    servicio.imprimirGeneracion.mockRejectedValueOnce(
      new Error('Impresión interrumpida')
    )
    for (const [n, v] of [
      ['Cantidad total de tickets', '43'],
      ['Tickets por lote', '10']
    ]) {
      await user.clear(screen.getByLabelText(n))
      await user.type(screen.getByLabelText(n), v)
    }
    await user.click(screen.getByRole('button', { name: 'Imprimir tickets' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Impresión interrumpida')
    expect(screen.getByLabelText('Paso 3: pendiente')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Reintentar impresión' }))
    expect(await screen.findByLabelText('Paso 3: completo')).toBeInTheDocument()
    expect(servicio.generar).toHaveBeenCalledTimes(1)
    expect(servicio.imprimirGeneracion).toHaveBeenCalledTimes(2)
  })
  it('una ventana bloqueada no genera tickets, y una campaña cerrada no ofrece imprimir', async () => {
    const { user, servicio, unmount } = montar()
    servicio.abrirImpresion.mockImplementation(() => {
      throw new Error('Ventana bloqueada')
    })
    for (const n of ['Cantidad total de tickets', 'Tickets por lote']) {
      await user.clear(screen.getByLabelText(n))
      await user.type(screen.getByLabelText(n), '10')
    }
    await user.click(screen.getByRole('button', { name: 'Imprimir tickets' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Ventana bloqueada')
    expect(servicio.generar).not.toHaveBeenCalled()
    unmount()
    montar('CERRADA')
    expect(screen.getByRole('status')).toHaveTextContent('Esta campaña está cerrada')
    expect(
      screen.queryByRole('button', { name: 'Imprimir tickets' })
    ).not.toBeInTheDocument()
  })
  it('doble clic no duplica, y salir antes de responder no abre impresión tardía', async () => {
    const { user, servicio, unmount } = montar()
    let resolver
    servicio.generar.mockImplementation(
      () =>
        new Promise((r) => {
          resolver = r
        })
    )
    for (const n of ['Cantidad total de tickets', 'Tickets por lote']) {
      await user.clear(screen.getByLabelText(n))
      await user.type(screen.getByLabelText(n), '10')
    }
    await user.dblClick(screen.getByRole('button', { name: 'Imprimir tickets' }))
    expect(servicio.generar).toHaveBeenCalledTimes(1)
    unmount()
    await act(async () => resolver({ cantidadTickets: 10, lotes: [] }))
    expect(servicio.imprimirGeneracion).not.toHaveBeenCalled()
  })
})
