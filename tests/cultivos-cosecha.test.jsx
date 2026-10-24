import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CultivosCosecha } from '../src/presentation/CultivosCosecha.jsx'
import { COLORES_CULTIVO, hoyLima } from '../src/application/cultivosCosecha.js'

const cultivo = (id = 'c1', nombre = 'Mango') => ({
  id,
  nombre,
  color: '#FF8800',
  variedades: [
    { id: 'v1', nombre: 'Kent' },
    { id: 'v2', nombre: 'Keitt' }
  ],
  lotes: [{ nombre: 'Sector norte', variedades: ['Kent'] }],
  supervisores: [{ nombre: 'Ana Ruiz' }],
  campanias: [
    { id: 'a0', nombre: 'Campaña anterior', estado: 'CERRADA' },
    { id: 'a1', nombre: 'Cosecha de verano', estado: 'ACTIVA' }
  ],
  solicitudEstado: null
})
const solicitud = {
  id: 's1',
  cultivoId: 'c1',
  cultivoNombre: 'Mango',
  nombre: 'Luis Pérez',
  email: 'luis@example.test',
  estado: 'PENDIENTE'
}
function servicioPara(catalogo = {}) {
  return {
    catalogoCultivos: vi.fn().mockResolvedValue({
      propios: [],
      disponibles: [],
      solicitudes: [],
      ...catalogo
    }),
    crearCultivo: vi.fn().mockResolvedValue({ cultivoId: 'nuevo', campaniaId: 'a2' }),
    crearCampania: vi.fn().mockResolvedValue({ cultivoId: 'c1', campaniaId: 'a2' }),
    solicitarUnion: vi.fn().mockResolvedValue({}),
    resolverUnion: vi.fn().mockResolvedValue({})
  }
}
async function montar(catalogo = {}, props = {}) {
  const servicio = props.servicio ?? servicioPara(catalogo)
  const onCreada = vi.fn()
  const vista = render(
    <CultivosCosecha servicio={servicio} onCreada={onCreada} {...props} />
  )
  if (!props.pendiente)
    await waitFor(() =>
      expect(vista.container.querySelector('.cultivos-cosecha')).toHaveAttribute('aria-busy', 'false')
    )
  return { ...vista, servicio, onCreada, user: userEvent.setup() }
}
function cambiar(nombre, valor) {
  fireEvent.change(screen.getByLabelText(nombre, { exact: true }), {
    target: { value: valor }
  })
}
async function pasoLotes(user, variedades = ['Kent']) {
  cambiar('Nombre del cultivo', ' Mango ')
  variedades.forEach((v, i) => cambiar(`Variedad ${i + 1}`, v))
  await user.click(screen.getByRole('button', { name: 'Siguiente' }))
}
async function asignar(user, numero = 1, variedad = 'Kent') {
  const detalle = screen
    .getByLabelText(`Variedades del lote ${numero}`, { selector: 'summary' })
    .closest('details')
  if (!detalle.open)
    await user.click(
      within(detalle).getByLabelText(`Variedades del lote ${numero}`, {
        selector: 'summary'
      })
    )
  await user.click(within(detalle).getByRole('checkbox', { name: variedad }))
}
async function pasoCampania(user) {
  await pasoLotes(user)
  cambiar('Lote 1', ' Norte ')
  await asignar(user)
  await user.click(screen.getByRole('button', { name: 'Siguiente' }))
}
function completarCampania() {
  cambiar('Nombre de la campaña', ' Verano ')
  cambiar('Fecha de fin', hoyLima())
}
afterEach(() => vi.useRealTimers())

describe('CultivosCosecha: wizard independiente', () => {
  it('sin cultivos propios solo habilita nuevo cultivo y usa la paleta de aplicación', async () => {
    await montar()
    expect(screen.getByRole('tab', { name: 'Nueva campaña' })).toBeDisabled()
    expect(screen.getByRole('tab', { name: 'Nuevo cultivo' })).toHaveAttribute(
      'aria-selected',
      'true'
    )
    expect(screen.getAllByRole('radio')).toHaveLength(10)
    COLORES_CULTIVO.forEach((color) =>
      expect(screen.getByRole('radio', { name: `Color ${color}` })).toBeInTheDocument()
    )
    expect(screen.getAllByRole('textbox', { name: /^Variedad \d/ })).toHaveLength(1)
    expect(screen.getByText('Aún no hay cosechas externas operativas')).toBeVisible()
    expect(
      screen.queryByRole('region', { name: 'Solicitudes pendientes' })
    ).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { level: 1 })).not.toBeInTheDocument()
  })

  it('exige nombre y una variedad, rechaza duplicados y agrega una fila al completar cada campo', async () => {
    const { user, servicio } = await montar()
    await user.click(screen.getByRole('button', { name: 'Siguiente' }))
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Ingresa el nombre del cultivo.'
    )
    cambiar('Nombre del cultivo', 'Mango')
    await user.click(screen.getByRole('button', { name: 'Siguiente' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Agrega al menos una variedad.')
    cambiar('Variedad 1', 'Kent')
    expect(screen.getAllByRole('textbox', { name: /^Variedad \d/ })).toHaveLength(2)
    cambiar('Variedad 2', ' kent ')
    cambiar('Variedad 3', 'Keitt')
    expect(screen.getAllByRole('textbox', { name: /^Variedad \d/ })).toHaveLength(4)
    await user.click(screen.getByRole('button', { name: 'Siguiente' }))
    expect(screen.getByRole('alert')).toHaveTextContent('no pueden repetirse')
    expect(servicio.crearCultivo).not.toHaveBeenCalled()
  })

  it('reduce filas al borrar variedades y conserva siempre un único campo vacío al final', async () => {
    const { user } = await montar()
    await user.type(screen.getByLabelText('Variedad 1'), 'Kent')
    await user.type(screen.getByLabelText('Variedad 2'), 'Keitt')
    await user.type(screen.getByLabelText('Variedad 3'), 'Tommy')
    expect(screen.getAllByRole('textbox', { name: /^Variedad \d/ })).toHaveLength(4)
    await user.clear(screen.getByLabelText('Variedad 2'))
    expect(screen.getAllByRole('textbox', { name: /^Variedad \d/ }).map((el) => el.value)).toEqual(['Kent', 'Tommy', ''])
    await user.clear(screen.getByLabelText('Variedad 2'))
    await user.clear(screen.getByLabelText('Variedad 1'))
    expect(screen.getAllByRole('textbox', { name: /^Variedad \d/ }).map((el) => el.value)).toEqual([''])
  })

  it('al eliminar una variedad reasigna los índices de lotes sin cambiar las variedades restantes', async () => {
    const { user, servicio } = await montar()
    await pasoLotes(user, ['Kent', 'Keitt', 'Tommy'])
    cambiar('Lote 1', 'Norte')
    await asignar(user, 1, 'Kent')
    await asignar(user, 1, 'Tommy')
    await user.click(screen.getByRole('button', { name: 'Cancelar' }))
    await user.clear(screen.getByLabelText('Variedad 1'))
    expect(screen.getByLabelText('Variedad 1')).toHaveValue('Keitt')
    await user.click(screen.getByRole('button', { name: 'Siguiente' }))
    const lote = screen.getByLabelText('Variedades del lote 1', { selector: 'summary' }).closest('details')
    await user.click(within(lote).getByLabelText('Variedades del lote 1', { selector: 'summary' }))
    expect(within(lote).getByRole('checkbox', { name: 'Tommy' })).toBeChecked()
    expect(within(lote).getByRole('checkbox', { name: 'Keitt' })).not.toBeChecked()
    await user.click(screen.getByRole('button', { name: 'Siguiente' }))
    completarCampania()
    await user.click(screen.getByRole('button', { name: 'Activar campaña' }))
    expect(servicio.crearCultivo).toHaveBeenCalledWith(expect.objectContaining({
      variedades: ['Keitt', 'Tommy'], lotes: [{ nombre: 'Norte', variedades: ['Tommy'] }]
    }))
  })

  it('exige lotes nombrados con al menos una variedad y permite multiselección', async () => {
    const { user } = await montar()
    await pasoLotes(user, ['Kent', 'Keitt'])
    expect(screen.getAllByRole('textbox', { name: /^Lote \d/ })).toHaveLength(1)
    expect(screen.queryByRole('button', { name: 'Atrás' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Siguiente' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Agrega al menos un lote.')
    cambiar('Lote 1', 'Norte')
    expect(screen.getAllByRole('textbox', { name: /^Lote \d/ })).toHaveLength(2)
    await user.click(screen.getByRole('button', { name: 'Siguiente' }))
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Selecciona al menos una variedad'
    )
    await asignar(user)
    await asignar(user, 1, 'Keitt')
    expect(screen.getByText('Kent, Keitt')).toBeVisible()
    cambiar('Lote 2', 'Sur')
    await asignar(user, 2)
    cambiar('Lote 3', 'Este')
    await asignar(user, 3)
    expect(screen.getAllByRole('textbox', { name: /^Lote \d/ })).toHaveLength(4)
    await user.click(screen.getByRole('button', { name: 'Siguiente' }))
    expect(screen.getByLabelText('Nombre de la campaña')).toBeVisible()
  })

  it('reduce filas al borrar lotes y conserva las variedades de los lotes restantes', async () => {
    const { user, servicio } = await montar()
    await pasoLotes(user, ['Kent', 'Keitt'])
    await user.type(screen.getByLabelText('Lote 1'), 'Norte')
    await asignar(user, 1, 'Kent')
    await user.type(screen.getByLabelText('Lote 2'), 'Sur')
    await asignar(user, 2, 'Kent')
    await user.type(screen.getByLabelText('Lote 3'), 'Este')
    await asignar(user, 3, 'Keitt')
    expect(screen.getAllByRole('textbox', { name: /^Lote \d/ })).toHaveLength(4)
    await user.clear(screen.getByLabelText('Lote 2'))
    expect(screen.getAllByRole('textbox', { name: /^Lote \d/ }).map((el) => el.value)).toEqual(['Norte', 'Este', ''])
    expect(screen.getByLabelText('Variedades del lote 2', { selector: 'summary' })).toHaveTextContent('Keitt')
    await user.click(screen.getByRole('button', { name: 'Siguiente' }))
    completarCampania()
    await user.click(screen.getByRole('button', { name: 'Activar campaña' }))
    expect(servicio.crearCultivo).toHaveBeenCalledWith(expect.objectContaining({
      lotes: [
        { nombre: 'Norte', variedades: ['Kent'] },
        { nombre: 'Este', variedades: ['Keitt'] }
      ]
    }))
  })

  it('al borrar todos los lotes deja una fila vacía sin selecciones anteriores', async () => {
    const { user } = await montar()
    await pasoLotes(user)
    cambiar('Lote 1', 'Norte')
    await asignar(user)
    cambiar('Lote 2', 'Sur')
    await asignar(user, 2)
    await user.clear(screen.getByLabelText('Lote 1'))
    await user.clear(screen.getByLabelText('Lote 1'))
    expect(screen.getAllByRole('textbox', { name: /^Lote \d/ }).map((el) => el.value)).toEqual([''])
    expect(screen.getByLabelText('Variedades del lote 1', { selector: 'summary' })).toHaveTextContent('Selecciona')
    await user.click(screen.getByRole('button', { name: 'Siguiente' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Agrega al menos un lote.')
  })

  it('rechaza lotes duplicados o selecciones sin nombre', async () => {
    const { user } = await montar()
    await pasoLotes(user)
    await asignar(user)
    await user.click(screen.getByRole('button', { name: 'Siguiente' }))
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Ingresa el nombre de cada lote'
    )
    cambiar('Lote 1', 'Norte')
    cambiar('Lote 2', ' norte ')
    await asignar(user, 2)
    await user.click(screen.getByRole('button', { name: 'Siguiente' }))
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Los nombres de los lotes no pueden repetirse.'
    )
  })

  it('envía solo filas completas y los nombres de variedades, y navega después del guardado', async () => {
    const { user, servicio, onCreada } = await montar()
    await user.click(screen.getByRole('radio', { name: 'Color #6F1D79' }))
    await pasoCampania(user)
    expect(screen.getByLabelText('Fecha de inicio')).toHaveValue(hoyLima())
    completarCampania()
    await user.click(screen.getByRole('button', { name: 'Activar campaña' }))
    expect(servicio.crearCultivo).toHaveBeenCalledExactlyOnceWith({
      nombre: 'Mango',
      color: '#6F1D79',
      variedades: ['Kent'],
      lotes: [{ nombre: 'Norte', variedades: ['Kent'] }],
      campania: { nombre: 'Verano', fechaInicio: hoyLima(), fechaFin: hoyLima() }
    })
    expect(onCreada).toHaveBeenCalledExactlyOnceWith({
      cultivoId: 'nuevo',
      campaniaId: 'a2'
    })
    expect(screen.getByRole('button', { name: 'Campaña activada' })).toBeDisabled()
  })

  it('calcula el inicio con el día de Lima aun si UTC ya cambió de fecha y valida ambos límites', async () => {
    const { user, servicio } = await montar()
    await pasoCampania(user)
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-23T02:30:00Z'))
    cambiar('Nombre de la campaña', 'Verano')
    cambiar('Fecha de inicio', '2026-10-21')
    cambiar('Fecha de fin', '2026-10-23')
    expect(screen.getByLabelText('Fecha de inicio')).toHaveAttribute(
      'min',
      '2026-10-22'
    )
    await user.click(screen.getByRole('button', { name: 'Activar campaña' }))
    expect(screen.getByRole('alert')).toHaveTextContent('posterior en Lima')
    cambiar('Fecha de inicio', '2026-10-23')
    cambiar('Fecha de fin', '2026-10-22')
    expect(screen.getByLabelText('Fecha de fin')).toHaveAttribute('min', '2026-10-23')
    await user.click(screen.getByRole('button', { name: 'Activar campaña' }))
    expect(screen.getByRole('alert')).toHaveTextContent('igual o posterior al inicio')
    expect(servicio.crearCultivo).not.toHaveBeenCalled()
  })

  it('conserva datos tras un fallo, bloquea dobles envíos y permite reintentar', async () => {
    let rechazar
    const servicio = servicioPara()
    servicio.crearCultivo.mockImplementationOnce(
      () =>
        new Promise((_, reject) => {
          rechazar = reject
        })
    )
    const { user, onCreada } = await montar({}, { servicio })
    await pasoCampania(user)
    completarCampania()
    await user.dblClick(screen.getByRole('button', { name: 'Activar campaña' }))
    expect(servicio.crearCultivo).toHaveBeenCalledTimes(1)
    expect(onCreada).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeDisabled()
    expect(screen.getByRole('tab', { name: 'Nuevo cultivo' })).toBeDisabled()
    expect(screen.getByLabelText('Nombre de la campaña')).toBeDisabled()
    await act(async () => rechazar(new Error('Sin conexión')))
    expect(screen.getByRole('alert')).toHaveTextContent('Sin conexión')
    expect(screen.getByLabelText('Nombre de la campaña')).toHaveValue(' Verano ')
    await user.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(screen.getByLabelText('Lote 1')).toHaveValue(' Norte ')
    await user.click(screen.getByRole('button', { name: 'Siguiente' }))
    await user.click(screen.getByRole('button', { name: 'Activar campaña' }))
    expect(servicio.crearCultivo).toHaveBeenCalledTimes(2)
    expect(onCreada).toHaveBeenCalledTimes(1)
  })

  it('cancelar lotes vuelve al cultivo conservando el borrador sin escribir', async () => {
    const { user, servicio } = await montar()
    await pasoCampania(user)
    completarCampania()
    expect(screen.queryByRole('button', { name: 'Atrás' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Cancelar' }))
    await user.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(screen.getByLabelText('Nombre del cultivo')).toHaveValue(' Mango ')
    expect(screen.getByLabelText('Variedad 1')).toHaveValue('Kent')
    expect(
      screen.getByRole('radio', { name: `Color ${COLORES_CULTIVO[0]}` })
    ).toBeChecked()
    await user.click(screen.getByRole('button', { name: 'Siguiente' }))
    await user.click(screen.getByRole('button', { name: 'Siguiente' }))
    expect(screen.getByLabelText('Nombre de la campaña')).toHaveValue(' Verano ')
    expect(screen.getByLabelText('Fecha de fin')).toHaveValue(hoyLima())
    expect(servicio.crearCultivo).not.toHaveBeenCalled()
  })

  it('renombrar variedades al volver conserva su asociación con el lote', async () => {
    const { user, servicio } = await montar()
    await pasoCampania(user)
    await user.click(screen.getByRole('button', { name: 'Cancelar' }))
    await user.click(screen.getByRole('button', { name: 'Cancelar' }))
    cambiar('Variedad 1', 'Keitt')
    await user.click(screen.getByRole('button', { name: 'Siguiente' }))
    expect(screen.getByText('Keitt', { selector: 'summary > span' })).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Siguiente' }))
    completarCampania()
    await user.click(screen.getByRole('button', { name: 'Activar campaña' }))
    expect(servicio.crearCultivo.mock.calls[0][0].lotes).toEqual([
      { nombre: 'Norte', variedades: ['Keitt'] }
    ])
  })
})

describe('Campañas sobre cultivos existentes', () => {
  it('abre campaña por defecto y reutiliza las plantillas sin enviarlas como cambios', async () => {
    const { user, servicio, onCreada } = await montar({ propios: [cultivo()] })
    expect(screen.getByRole('tab', { name: 'Nueva campaña' })).toHaveAttribute(
      'aria-selected',
      'true'
    )
    expect(screen.getByText('Kent, Keitt')).toBeVisible()
    expect(screen.getByText('Sector norte')).toBeVisible()
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
    completarCampania()
    await user.click(screen.getByRole('button', { name: 'Activar campaña' }))
    expect(servicio.crearCampania).toHaveBeenCalledExactlyOnceWith('c1', {
      nombre: 'Verano',
      fechaInicio: hoyLima(),
      fechaFin: hoyLima()
    })
    expect(servicio.crearCultivo).not.toHaveBeenCalled()
    expect(onCreada).toHaveBeenCalledExactlyOnceWith({
      cultivoId: 'c1',
      campaniaId: 'a2'
    })
  })

  it('con varios cultivos exige selección explícita y guarda contra el ID seleccionado', async () => {
    const { user, servicio } = await montar({
      propios: [cultivo(), cultivo('c2', 'Palta')]
    })
    completarCampania()
    await user.click(screen.getByRole('button', { name: 'Activar campaña' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Selecciona el cultivo')
    expect(servicio.crearCampania).not.toHaveBeenCalled()
    await user.selectOptions(screen.getByRole('combobox', { name: 'Cultivo' }), 'c2')
    await user.click(screen.getByRole('button', { name: 'Activar campaña' }))
    expect(servicio.crearCampania.mock.calls[0][0]).toBe('c2')
  })

  it('cambia de tab conservando borrador sin ofrecer cancelar', async () => {
    const { user } = await montar({ propios: [cultivo()] })
    await user.click(screen.getByRole('tab', { name: 'Nuevo cultivo' }))
    cambiar('Nombre del cultivo', 'Mi cultivo')
    await user.click(screen.getByRole('tab', { name: 'Nueva campaña' }))
    await user.click(screen.getByRole('tab', { name: 'Nuevo cultivo' }))
    expect(screen.getByLabelText('Nombre del cultivo')).toHaveValue('Mi cultivo')
    expect(screen.queryByRole('button', { name: 'Cancelar' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('tab', { name: 'Nueva campaña' }))
    expect(screen.getByRole('tab', { name: 'Nueva campaña' })).toHaveAttribute(
      'aria-selected',
      'true'
    )
  })
})

describe('Descubrimiento y aprobación', () => {
  it.each([
    ['PENDING', 'Solicitud pendiente'],
    ['APPROVED', 'Solicitud aprobada'],
    ['REJECTED', 'Solicitud rechazada']
  ])(
    'interpreta el estado %s recibido del servidor sin reenviar',
    async (estado, texto) => {
      const { servicio } = await montar({
        disponibles: [{ ...cultivo(), solicitudEstado: estado }]
      })
      expect(screen.getByRole('button', { name: texto })).toBeDisabled()
      expect(servicio.solicitarUnion).not.toHaveBeenCalled()
    }
  )

  it('muestra y resuelve las solicitudes PENDING del contrato SQL', async () => {
    const { user, servicio } = await montar({
      solicitudes: [{ ...solicitud, estado: 'PENDING' }]
    })
    servicio.catalogoCultivos.mockResolvedValue({
      propios: [],
      disponibles: [],
      solicitudes: []
    })
    await user.click(screen.getByRole('button', { name: 'Aprobar' }))
    expect(servicio.resolverUnion).toHaveBeenCalledExactlyOnceWith('s1', true)
    await waitFor(() =>
      expect(
        screen.queryByRole('article', { name: 'Solicitud de Luis Pérez' })
      ).not.toBeInTheDocument()
    )
  })

  it('muestra datos reales, pide unión, refresca y conserva el borrador', async () => {
    const { user, servicio } = await montar({ disponibles: [cultivo()] })
    const card = within(screen.getByRole('article', { name: 'Cultivo Mango' }))
    expect(card.getByText('Kent')).toBeVisible()
    expect(card.getByText('Keitt')).toBeVisible()
    expect(card.getAllByRole('list')).toHaveLength(3)
    expect(card.getByText('Sector norte')).toBeVisible()
    expect(card.getByText('Ana Ruiz')).toBeVisible()
    expect(card.getByText('Cosecha de verano')).toBeVisible()
    expect(card.queryByText('Campaña anterior')).not.toBeInTheDocument()
    cambiar('Nombre del cultivo', 'Borrador')
    servicio.catalogoCultivos.mockResolvedValue({
      propios: [],
      disponibles: [{ ...cultivo(), solicitudEstado: 'PENDIENTE' }],
      solicitudes: []
    })
    await user.click(card.getByRole('button', { name: 'Solicitar unirme' }))
    await waitFor(() => expect(servicio.catalogoCultivos).toHaveBeenCalledTimes(2))
    expect(servicio.solicitarUnion).toHaveBeenCalledExactlyOnceWith('c1')
    expect(
      await screen.findByRole('button', { name: 'Solicitud pendiente' })
    ).toBeDisabled()
    expect(screen.getByLabelText('Nombre del cultivo')).toHaveValue('Borrador')
  })

  it('no permite reenviar pendientes ni aprobadas y contempla campañas vacías', async () => {
    const { servicio } = await montar({
      disponibles: [
        { ...cultivo(), campanias: [], solicitudEstado: 'PENDIENTE' },
        { ...cultivo('c2', 'Palta'), solicitudEstado: 'APROBADA' }
      ]
    })
    expect(screen.getByRole('button', { name: 'Solicitud pendiente' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Solicitud aprobada' })).toBeDisabled()
    expect(screen.getByText('Sin campaña activa')).toBeVisible()
    expect(servicio.solicitarUnion).not.toHaveBeenCalled()
  })

  it.each([
    ['Aprobar', true],
    ['Rechazar', false]
  ])('%s resuelve la solicitud y refresca el catálogo', async (boton, aceptar) => {
    const { user, servicio } = await montar({
      solicitudes: [
        solicitud,
        { ...solicitud, id: 'vieja', estado: 'APROBADA', nombre: 'Histórico' }
      ]
    })
    const region = within(
      screen.getByRole('region', { name: 'Solicitudes pendientes' })
    )
    expect(region.getByText('Luis Pérez')).toBeVisible()
    expect(region.getByText('luis@example.test')).toBeVisible()
    expect(region.getByText('Mango')).toBeVisible()
    expect(region.queryByText('Histórico')).not.toBeInTheDocument()
    servicio.catalogoCultivos.mockResolvedValue({
      propios: [],
      disponibles: [],
      solicitudes: []
    })
    await user.click(region.getByRole('button', { name: boton }))
    await waitFor(() => expect(servicio.catalogoCultivos).toHaveBeenCalledTimes(2))
    expect(servicio.resolverUnion).toHaveBeenCalledExactlyOnceWith('s1', aceptar)
    await waitFor(() =>
      expect(
        screen.queryByRole('article', { name: 'Solicitud de Luis Pérez' })
      ).not.toBeInTheDocument()
    )
  })

  it('un error de aprobación conserva la solicitud para reintentar', async () => {
    const { user, servicio } = await montar({ solicitudes: [solicitud] })
    servicio.resolverUnion.mockRejectedValueOnce(new Error('No se pudo aprobar'))
    await user.click(screen.getByRole('button', { name: 'Aprobar' }))
    expect(screen.getByRole('alert')).toHaveTextContent('No se pudo aprobar')
    expect(
      screen.getByRole('article', { name: 'Solicitud de Luis Pérez' })
    ).toBeVisible()
    expect(servicio.catalogoCultivos).toHaveBeenCalledTimes(1)
    await user.click(screen.getByRole('button', { name: 'Aprobar' }))
    expect(servicio.resolverUnion).toHaveBeenCalledTimes(2)
  })

  it('si falla el refresco, reintenta la consulta sin reenviar la solicitud ni borrar el wizard', async () => {
    const { user, servicio } = await montar({ disponibles: [cultivo()] })
    await pasoCampania(user)
    completarCampania()
    servicio.catalogoCultivos.mockRejectedValueOnce(new Error('Fallo al actualizar'))
    await user.click(screen.getByRole('button', { name: 'Solicitar unirme' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Fallo al actualizar')
    expect(screen.getByLabelText('Nombre de la campaña')).toHaveValue(' Verano ')
    expect(screen.getByRole('button', { name: 'Solicitud pendiente' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Reintentar carga' }))
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument())
    expect(servicio.solicitarUnion).toHaveBeenCalledTimes(1)
    expect(screen.getByLabelText('Nombre de la campaña')).toHaveValue(' Verano ')
  })

  it('bloquea solicitudes durante una operación y conserva los datos tras error de unión', async () => {
    let rechazar
    const { user, servicio } = await montar({
      disponibles: [cultivo()],
      solicitudes: [solicitud]
    })
    servicio.solicitarUnion.mockImplementationOnce(
      () =>
        new Promise((_, reject) => {
          rechazar = reject
        })
    )
    await user.dblClick(screen.getByRole('button', { name: 'Solicitar unirme' }))
    expect(servicio.solicitarUnion).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: 'Aprobar' })).toBeDisabled()
    await act(async () => rechazar(new Error('Solicitud no enviada')))
    expect(screen.getByRole('alert')).toHaveTextContent('Solicitud no enviada')
    expect(screen.getByRole('button', { name: 'Solicitar unirme' })).toBeEnabled()
  })
})

describe('Carga y pendiente externo', () => {
  it('muestra skeletons en ambos paneles hasta resolver la carga inicial, sin aviso superior', async () => {
    let resolver
    const servicio = servicioPara()
    servicio.catalogoCultivos.mockImplementationOnce(() => new Promise((r) => { resolver = r }))
    const { container } = render(<CultivosCosecha servicio={servicio} />)
    expect(container.querySelectorAll('.cc-panel-skeleton')).toHaveLength(2)
    expect(container.querySelector('.cc-is-loading')).toHaveAttribute('aria-busy', 'true')
    expect(screen.queryByText('Cargando cultivos…')).not.toBeInTheDocument()
    expect(screen.queryByText('Aún no hay cosechas externas operativas')).not.toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Nuevo cultivo' })).toBeDisabled()
    await waitFor(() => expect(servicio.catalogoCultivos).toHaveBeenCalledTimes(1))
    await act(async () => resolver({ propios: [cultivo()], disponibles: [], solicitudes: [] }))
    expect(container.querySelectorAll('.cc-panel-skeleton')).toHaveLength(0)
    expect(screen.getByRole('button', { name: 'Activar campaña' })).toBeEnabled()
    expect(screen.getByText('Sector norte')).toBeVisible()
  })

  it('muestra skeletons al refrescar y conserva el paso y todo el borrador', async () => {
    const { user, servicio, container } = await montar()
    await pasoCampania(user)
    completarCampania()
    let resolver
    servicio.catalogoCultivos.mockImplementationOnce(() => new Promise((r) => { resolver = r }))
    await user.click(screen.getByRole('button', { name: 'Actualizar cultivos' }))
    expect(container.querySelectorAll('.cc-panel-skeleton')).toHaveLength(2)
    expect(container.querySelector('.cc-is-loading')).toHaveAttribute('aria-busy', 'true')
    expect(screen.getByLabelText('Nombre de la campaña')).toHaveValue(' Verano ')
    expect(screen.getByRole('button', { name: 'Activar campaña' })).toBeDisabled()
    await act(async () => resolver({ propios: [], disponibles: [], solicitudes: [] }))
    expect(container.querySelectorAll('.cc-panel-skeleton')).toHaveLength(0)
    expect(screen.getByLabelText('Nombre de la campaña')).toHaveValue(' Verano ')
    expect(screen.getByLabelText('Fecha de fin')).toHaveValue(hoyLima())
    await user.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(screen.getByLabelText('Lote 1')).toHaveValue(' Norte ')
    expect(servicio.crearCultivo).not.toHaveBeenCalled()
  })

  it('salir del formulario durante el guardado no redirige al recibir una respuesta tardía', async () => {
    const { user, servicio, onCreada, unmount } = await montar()
    await pasoCampania(user)
    completarCampania()
    let resolver
    servicio.crearCultivo.mockImplementation(
      () =>
        new Promise((r) => {
          resolver = r
        })
    )
    await user.click(screen.getByRole('button', { name: 'Activar campaña' }))
    unmount()
    await act(async () => resolver({ cultivoId: 'nuevo', campaniaId: 'a2' }))
    expect(onCreada).not.toHaveBeenCalled()
  })
  it('permite reintentar carga inicial fallida', async () => {
    const servicio = servicioPara()
    servicio.catalogoCultivos.mockRejectedValueOnce(new Error('Servicio no disponible'))
    const { user } = await montar({}, { servicio })
    expect(screen.getByRole('alert')).toHaveTextContent('Servicio no disponible')
    expect(screen.getByRole('button', { name: 'Siguiente' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Reintentar carga' }))
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Siguiente' })).toBeEnabled()
    )
  })

  it('pendiente no consulta ni escribe; al liberarse carga el catálogo', async () => {
    const { servicio, rerender } = await montar({}, { pendiente: true })
    expect(screen.getByRole('button', { name: 'Siguiente' })).toBeDisabled()
    expect(servicio.catalogoCultivos).not.toHaveBeenCalled()
    rerender(<CultivosCosecha servicio={servicio} pendiente={false} />)
    await waitFor(() => expect(servicio.catalogoCultivos).toHaveBeenCalledTimes(1))
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Siguiente' })).toBeEnabled()
    )
    expect(servicio.crearCultivo).not.toHaveBeenCalled()
  })

  it('un pendiente externo durante el wizard conserva paso, lotes y campaña', async () => {
    const { user, servicio, rerender } = await montar()
    await pasoCampania(user)
    completarCampania()
    rerender(<CultivosCosecha servicio={servicio} pendiente />)
    expect(screen.getByLabelText('Nombre de la campaña')).toHaveValue(' Verano ')
    expect(screen.getByLabelText('Nombre de la campaña')).toBeDisabled()
    rerender(<CultivosCosecha servicio={servicio} />)
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Activar campaña' })).toBeEnabled()
    )
    expect(screen.getByLabelText('Nombre de la campaña')).toHaveValue(' Verano ')
    await user.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(screen.getByLabelText('Lote 1')).toHaveValue(' Norte ')
  })
})
