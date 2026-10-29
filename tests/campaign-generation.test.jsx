import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor, act, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  GeneracionCampania,
  CampaniaCosecha
} from '../src/presentation/CampaniaCosecha.jsx'
import { MemoryRouter, createMemoryRouter, RouterProvider } from 'react-router'
function montar(estado = 'ACTIVA') {
  const servicio = {
    abrirImpresion: vi.fn(() => ({ cerrar: vi.fn() })),
    previsualizarGeneracion: vi.fn(async (d) => ({
      ...d,
      lotes: [{}],
      vista: { url: 'blob:preview', cerrar: vi.fn() }
    })),
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
  it('20 personas con 27 tickets solicitan 540 tickets en lotes de 27', async () => {
    const { user, servicio } = montar()
    for (const [label, valor] of [
      ['Cantidad de personas', '20'],
      ['Tickets por persona', '27']
    ]) {
      await user.clear(screen.getByLabelText(label))
      await user.type(screen.getByLabelText(label), valor)
    }
    expect(screen.getByText('540')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Ver vista previa' }))
    expect(servicio.previsualizarGeneracion).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ cantidadTickets: 540, tamanioLote: 27 }),
      expect.any(Object)
    )
  })
  it.each([
    ['2', '4', /múltiplos de 3/],
    ['2', '27.5', null],
    ['-1', '27', null],
    ['0', '27', null],
    ['33334', '3', /100.000/]
  ])(
    'rechaza %s personas y %s tickets sin pedir vista previa ni guardar',
    (personas, tickets, aviso) => {
      const { servicio } = montar()
      fireEvent.change(screen.getByLabelText('Cantidad de personas'), {
        target: { value: personas }
      })
      fireEvent.change(screen.getByLabelText('Tickets por persona'), {
        target: { value: tickets }
      })
      if (aviso) expect(screen.getByText(aviso)).toBeInTheDocument()
      expect(
        screen.queryByRole('button', { name: 'Ver vista previa' })
      ).not.toBeInTheDocument()
      fireEvent.submit(screen.getByLabelText('Cantidad de personas').closest('form'))
      expect(servicio.previsualizarGeneracion).not.toHaveBeenCalled()
      expect(servicio.generar).not.toHaveBeenCalled()
    }
  )
  it('las flechas cambian tickets de tres en tres y permiten el máximo de 99.999 tickets', async () => {
    const { user, servicio } = montar()
    await user.click(
      screen.getByRole('button', { name: 'Aumentar tickets por persona' })
    )
    expect(screen.getByLabelText('Tickets por persona')).toHaveValue(3)
    await user.click(
      screen.getByRole('button', { name: 'Aumentar tickets por persona' })
    )
    expect(screen.getByLabelText('Tickets por persona')).toHaveValue(6)
    await user.click(
      screen.getByRole('button', { name: 'Disminuir tickets por persona' })
    )
    expect(screen.getByLabelText('Tickets por persona')).toHaveValue(3)
    fireEvent.change(screen.getByLabelText('Cantidad de personas'), {
      target: { value: '33333' }
    })
    expect(screen.getByText('99,999')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Ver vista previa' }))
    expect(servicio.previsualizarGeneracion).toHaveBeenCalledWith(
      expect.objectContaining({ cantidadTickets: 99999, tamanioLote: 3 }),
      expect.any(Object)
    )
  })
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
        previsualizarGeneracion: vi.fn(async (d) => ({
          ...d,
          lotes: [{}],
          vista: { url: 'blob:preview', cerrar: vi.fn() }
        })),
        generar: vi.fn(async (d) => ({ ...d, lotes: [{ id: 'LT-nuevo' }] })),
        imprimirGeneracion: vi.fn(async () => ({ dialogoAbierto: true }))
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
      expect(screen.queryByLabelText('Cantidad de personas')).not.toBeInTheDocument()
      await act(async () =>
        resolver([
          { id: 'cerrada', nombre: 'Anterior', estado: 'CERRADA' },
          { id: 'c1', nombre: 'Actual', estado: 'ACTIVA' },
          { id: 'c2', nombre: 'Otra', estado: 'ACTIVA' }
        ])
      )
      await screen.findByLabelText('Cantidad de personas')
      const params = new URLSearchParams(router.state.location.search)
      expect(params.get('campania')).toBe(elegida)
      expect(params.get('lote')).toBe('LT-1')
      expect(router.state.historyAction).toBe(accion)
      expect(servicio.campanias).toHaveBeenCalledTimes(1)
      const user = userEvent.setup()
      await user.clear(screen.getByLabelText('Cantidad de personas'))
      await user.type(screen.getByLabelText('Cantidad de personas'), '10')
      await user.clear(screen.getByLabelText('Tickets por persona'))
      await user.type(screen.getByLabelText('Tickets por persona'), '6')
      await user.click(screen.getByRole('button', { name: 'Ver vista previa' }))
      await screen.findByLabelText('Paso 3: completo')
      expect(servicio.previsualizarGeneracion).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({
          campaniaId: elegida,
          cantidadTickets: 60,
          tamanioLote: 6
        }),
        expect.any(Object)
      )
      expect(servicio.generar).not.toHaveBeenCalled()
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
    await screen.findByLabelText('Cantidad de personas')
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
    await user.clear(screen.getByLabelText('Cantidad de personas'))
    await user.type(screen.getByLabelText('Cantidad de personas'), '100')
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Campaña de cosecha' }),
      'c2'
    )
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Esta campaña está cerrada'
    )
    expect(screen.getByLabelText('Cantidad de personas')).toHaveValue(0)
    expect(
      screen.queryByRole('button', { name: 'Ver vista previa' })
    ).not.toBeInTheDocument()
  })
  it('prepara la vista previa solo con cantidades validas y no guarda la generacion', async () => {
    const { user, servicio } = montar()
    for (const [label, valor] of [
      ['Cantidad de personas', '100'],
      ['Tickets por persona', '21']
    ]) {
      await user.clear(screen.getByLabelText(label))
      await user.type(screen.getByLabelText(label), valor)
    }
    await user.click(screen.getByRole('button', { name: 'Ver vista previa' }))
    expect(await screen.findByTitle('Vista previa PDF de tickets')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Imprimir y guardar' })).toBeEnabled()
    expect(servicio.generar).not.toHaveBeenCalled()
    expect(servicio.abrirImpresion).not.toHaveBeenCalled()
  })
})
