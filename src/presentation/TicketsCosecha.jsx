import { Select } from './Select.jsx'
import { useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { Aviso, Carga, useCarga, useMutacion } from './GestionUi.jsx'
import { DataTable, EmptyState, StatusBadge } from './Ui.jsx'
import { HomeIcon } from './HomeAssets.jsx'
import { SummaryMetrics } from './SummaryMetrics.jsx'
import calendarIcon from '../assets/harvest/calendar.svg'
import generationIcon from '../assets/harvest/tickets/generation.svg'
import lotsIcon from '../assets/harvest/tickets/lots.svg'
import assignmentsIcon from '../assets/harvest/tickets/assignments.svg'
import waitingIcon from '../assets/harvest/tickets/waiting.svg'
import printingIcon from '../assets/harvest/tickets/printing.svg'

const normalizar = (valor) =>
  String(valor ?? '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase('es-PE')

const diaLima = (valor) =>
  valor
    ? new Intl.DateTimeFormat('en-CA', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        timeZone: 'America/Lima'
      }).format(new Date(valor))
    : ''

const fechaCorta = (valor) =>
  valor
    ? new Intl.DateTimeFormat('es-PE', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
        timeZone: 'America/Lima'
      })
        .format(new Date(valor))
        .replace(',', '')
    : '—'

async function cargarTodo(servicio, tipo, campaniaId) {
  const filas = []
  let total = 0
  do {
    const pagina = await servicio.listar(tipo, {
      campaniaId: campaniaId || null,
      busqueda: '',
      loteId: null,
      trabajadorId: null,
      estado: '',
      offset: filas.length
    })
    total = pagina.total
    filas.push(...pagina.filas)
    if (!pagina.filas.length && filas.length < total)
      throw new Error(
        'La consulta de Tickets está incompleta. Actualice para reintentar.'
      )
  } while (filas.length < total)
  return filas
}

async function cargarListado(servicio, tipo, campaniaId) {
  return {
    filas: await cargarTodo(servicio, tipo, campaniaId),
    actualizadoEn: new Date().toISOString()
  }
}

const estadoLote = (lote) => {
  if (lote.cantidadTickets > 0 && lote.utilizados >= lote.cantidadTickets)
    return 'CONSUMIDO'
  if (lote.utilizados > 0) return 'EN_USO'
  return lote.estado
}
const impresionLote = (lote) => lote.impresion?.estado ?? lote.estadoImpresion ?? ''
const etiquetaEstado = (valor) =>
  ({
    DISPONIBLE: 'Disponible',
    ASIGNADO: 'Asignado',
    EN_USO: 'En uso',
    CONSUMIDO: 'Consumido',
    UTILIZADO: 'Utilizado',
    FINALIZADO: 'Finalizado'
  })[valor] ?? valor

function TicketTabs({ activo, campania, puedeGenerar }) {
  const query = campania ? `?campania=${encodeURIComponent(campania)}` : ''
  const tabs = [
    ...(puedeGenerar
      ? [
          {
            id: 'generar',
            label: 'Generación',
            to: '/cosecha/generar',
            icon: generationIcon
          }
        ]
      : []),
    { id: 'lotes', label: 'Lotes', to: '/cosecha/lotes', icon: lotsIcon },
    {
      id: 'asignaciones',
      label: 'Asignaciones',
      to: '/cosecha/asignaciones',
      icon: assignmentsIcon
    }
  ]
  return (
    <nav
      className="harvest-ticket-tabs"
      data-active={activo}
      aria-label="Secciones de Tickets"
    >
      {tabs.map((tab) => (
        <Link
          key={tab.id}
          to={tab.to + query}
          className={`harvest-ticket-tab ${activo === tab.id ? 'is-active' : ''}`}
          aria-current={activo === tab.id ? 'page' : undefined}
        >
          <img src={tab.icon} alt="" />
          <span>{tab.label}</span>
        </Link>
      ))}
    </nav>
  )
}

export function TicketsCosecha({ servicio, contexto, seccion, catalogo, pendiente }) {
  const [params] = useSearchParams()
  const puedeGenerar = contexto.permite('harvest.manage')
  const solicitada = params.get('campania')
  const campania =
    solicitada ||
    (catalogo.datos?.find((c) => c.estado === 'ACTIVA') ?? catalogo.datos?.[0])?.id ||
    ''
  const activa = seccion
  return (
    <>
      <TicketTabs
        activo={activa}
        campania={campania || solicitada}
        puedeGenerar={puedeGenerar}
      />
      <Carga consulta={pendiente ? { cargando: true } : catalogo} skeleton={seccion === 'generar' ? 'generation' : 'table'}>
        {(campanias) => {
          if (!campanias.length)
            return <EmptyState>Sin campañas disponibles para esta empresa.</EmptyState>
          const elegida = campanias.find((c) => c.id === campania)
          if (!elegida)
            return <p role="alert">Campaña ajena o no disponible para esta empresa.</p>
          if (activa === 'tickets')
            return (
              <TicketInventory
                key={elegida.id}
                servicio={servicio}
                campania={elegida}
              />
            )
          if (activa === 'generar') {
            if (!puedeGenerar)
              return (
                <section className="harvest-ticket-restricted">
                  <h2>Acceso restringido</h2>
                  <p>Se requiere harvest.manage para generar lotes de tickets.</p>
                </section>
              )
            return (
              <Generation key={elegida.id} servicio={servicio} campania={elegida} />
            )
          }
          if (activa === 'asignaciones')
            return (
              <Assignments key={elegida.id} servicio={servicio} campania={elegida} />
            )
          return <Lots key={elegida.id} servicio={servicio} campania={elegida} />
        }}
      </Carga>
    </>
  )
}

function Generation({ servicio, campania }) {
  const operacion = useRef(crypto.randomUUID())
  const mutacion = useMutacion()
  const campaniaId = campania.id
  const [cantidad, setCantidad] = useState('')
  const [tamanio, setTamanio] = useState('')
  const [intento, setIntento] = useState(null)
  const [resultado, setResultado] = useState(null)

  function enviar(event) {
    event.preventDefault()
    const cantidadTickets = Number(cantidad)
    const tamanioLote = Number(tamanio)
    const solicitud = intento ?? {
      operacionId: operacion.current,
      campaniaId,
      cantidadTickets,
      tamanioLote
    }
    if (
      !campaniaId ||
      !Number.isSafeInteger(cantidadTickets) ||
      cantidadTickets < 1 ||
      cantidadTickets > 100000 ||
      !Number.isSafeInteger(tamanioLote) ||
      tamanioLote < 1 ||
      tamanioLote > 100000
    )
      return
    setIntento(solicitud)
    void mutacion.ejecutar(async () => setResultado(await servicio.generar(solicitud)))
  }

  const bloquear = mutacion.ocupado || Boolean(intento)
  const cantidadValida =
    Number.isSafeInteger(Number(cantidad)) &&
    Number(cantidad) > 0 &&
    Number(cantidad) <= 100000
  const tamanioValido =
    Number.isSafeInteger(Number(tamanio)) &&
    Number(tamanio) > 0 &&
    Number(tamanio) <= 100000
  const listo = cantidadValida && tamanioValido && Boolean(campaniaId)
  return (
    <section className="harvest-generation-section" aria-label="Generación de tickets">
      <form onSubmit={enviar}>
        <div className="harvest-ticket-generation">
          <div className="harvest-generation-steps">
            <div
              className={`harvest-generation-step ${cantidadValida ? 'is-complete' : ''}`}
            >
              <span className="harvest-step-number">1</span>
              <label>
                <span>Ingrese cantidad total de tickets</span>
                <GenerationNumber
                  label="Cantidad total de tickets"
                  value={cantidad}
                  disabled={bloquear}
                  onChange={setCantidad}
                />
              </label>
            </div>
            <div
              className={`harvest-generation-step ${tamanioValido ? 'is-complete' : ''}`}
            >
              <span className="harvest-step-number">2</span>
              <label className="harvest-generation-size">
                <span>Tamaño del lote</span>
                <GenerationNumber
                  label="Tamaño del lote"
                  value={tamanio}
                  disabled={bloquear}
                  onChange={setTamanio}
                />
              </label>
            </div>
            <div
              className={`harvest-generation-step harvest-print-step ${intento ? 'is-complete' : ''}`}
            >
              <button
                className="harvest-step-number"
                type="submit"
                aria-label="Confirmar paso 3"
                disabled={!listo || mutacion.ocupado || Boolean(resultado)}
              >
                3
              </button>
              <div className="harvest-print-reveal" hidden={!listo && !intento}>
                <button
                  disabled={!listo || mutacion.ocupado || Boolean(resultado)}
                  aria-labelledby="harvest-print-label"
                  aria-describedby="harvest-print-help"
                >
                  <span id="harvest-print-label">
                    {intento && !resultado
                      ? 'Reintentar generación'
                      : 'Click para imprimir tickets'}
                  </span>
                  <small id="harvest-print-help">
                    Asegúrese de tener conectada la impresora térmica
                  </small>
                </button>
              </div>
            </div>
            <Aviso error={mutacion.error} />
            {intento && (
              <button
                type="button"
                className="harvest-generation-reset"
                disabled={mutacion.ocupado}
                onClick={() => {
                  operacion.current = crypto.randomUUID()
                  setIntento(null)
                  setResultado(null)
                  setCantidad('')
                  setTamanio('')
                }}
              >
                Preparar otra generación
              </button>
            )}
          </div>
          <div
            className="harvest-generation-status"
            role={resultado ? 'status' : undefined}
          >
            <img
              src={mutacion.ocupado || resultado ? printingIcon : waitingIcon}
              alt=""
            />
            <strong>
              {mutacion.ocupado
                ? 'Generando tickets ...'
                : resultado
                  ? 'Tickets generados'
                  : 'Esperando petición...'}
            </strong>
            {resultado && (
              <>
                <p>
                  {resultado.cantidadTickets} tickets · {resultado.lotes.length} lotes
                </p>
                <ul className="harvest-generation-result-list">
                  {resultado.lotes.map((lote) => (
                    <li key={lote.id}>
                      <Link to={`/cosecha/lotes/${encodeURIComponent(lote.id)}`}>
                        {lote.id}
                      </Link>{' '}
                      · {lote.cantidadTickets} tickets
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </div>
      </form>
    </section>
  )
}

function GenerationNumber({ label, value, disabled, onChange }) {
  const input = useRef(null)
  function cambiar(direccion) {
    input.current[direccion === 1 ? 'stepUp' : 'stepDown']()
    onChange(input.current.value)
  }
  return (
    <div className="harvest-number-control">
      <input
        ref={input}
        aria-label={label}
        type="number"
        min="1"
        max="100000"
        step="1"
        required
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      />
      <div className="harvest-number-arrows">
        <button
          type="button"
          aria-label={`Aumentar ${label.toLocaleLowerCase('es')}`}
          disabled={disabled}
          onPointerDown={(e) => e.preventDefault()}
          onClick={() => cambiar(1)}
        />
        <button
          type="button"
          aria-label={`Disminuir ${label.toLocaleLowerCase('es')}`}
          disabled={disabled}
          onPointerDown={(e) => e.preventDefault()}
          onClick={() => cambiar(-1)}
        />
      </div>
    </div>
  )
}

function TicketInventory({ servicio, campania }) {
  const navigate = useNavigate()
  const [texto, setTexto] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [estado, setEstado] = useState('')
  const consulta = useCarga(
    () =>
      servicio.listar('tickets', {
        campaniaId: campania.id,
        busqueda,
        loteId: null,
        trabajadorId: null,
        estado,
        offset: 0
      }),
    [servicio, campania.id, busqueda, estado]
  )

  return (
    <section
      className="harvest-ticket-list harvest-ticket-inventory"
      aria-label="Tickets generados"
    >
      <form
        className="harvest-ticket-inventory-filters"
        onSubmit={(event) => {
          event.preventDefault()
          setBusqueda(texto.trim())
        }}
      >
        <label>
          <span>Buscar código de Ticket</span>
          <input value={texto} onChange={(event) => setTexto(event.target.value)} />
        </label>
        <label>
          <span>Estado de consumo</span>
          <Select value={estado} onChange={(event) => setEstado(event.target.value)}>
            <option value="">Todos</option>
            <option value="DISPONIBLE">DISPONIBLE</option>
            <option value="UTILIZADO">UTILIZADO</option>
          </Select>
        </label>
        <button className="secondary">Buscar</button>
      </form>
      <Carga consulta={consulta}>
        {(datos) =>
          datos.filas.length ? (
            <DataTable
              label="Tickets"
              className="harvest-ticket-table-scroll"
              tableClassName="harvest-ticket-table harvest-inventory-table"
              rowKey="codigo"
              onRowActivate={(ticket) =>
                navigate(`/cosecha/tickets/${encodeURIComponent(ticket.codigo)}`)
              }
              data={datos.filas}
              columns={[
                { key: 'codigo', header: 'Ticket' },
                {
                  key: 'lote',
                  header: 'Lote',
                  render: (ticket) => ticket.lote?.id ?? '—'
                },
                {
                  key: 'trabajador',
                  header: 'Trabajador',
                  render: (ticket) => {
                    const trabajador = ticket.lote?.asignacion?.trabajador
                    return trabajador ? `${trabajador.nombre} · ${trabajador.dni}` : '—'
                  }
                },
                {
                  key: 'estado',
                  header: 'Estado',
                  render: (ticket) => <TicketStatus>{ticket.estado}</TicketStatus>
                }
              ]}
              actionsHeader="Detalle"
              actions={(ticket) => (
                <Link
                  to={`/cosecha/tickets/${encodeURIComponent(ticket.codigo)}`}
                  aria-label={`Ver Ticket ${ticket.codigo}`}
                >
                  Ver detalle
                </Link>
              )}
            />
          ) : (
            <EmptyState>Sin resultados para estos filtros de Harvest.</EmptyState>
          )
        }
      </Carga>
    </section>
  )
}

function Lots({ servicio, campania }) {
  const navigate = useNavigate()
  const consulta = useCarga(
    () => cargarListado(servicio, 'lotes', campania.id),
    [servicio, campania.id]
  )
  const [busqueda, setBusqueda] = useState('')
  const [fecha, setFecha] = useState('')
  const [estado, setEstado] = useState('')
  const [impresion, setImpresion] = useState('')
  const filas = (consulta.datos?.filas ?? []).filter((lote) => {
    const buscar = `${lote.id} ${lote.campania}`
    return (
      (!busqueda || normalizar(buscar).includes(normalizar(busqueda.trim()))) &&
      (!fecha || diaLima(lote.creadoEn) === fecha) &&
      (!estado || estadoLote(lote) === estado) &&
      (!impresion || impresionLote(lote) === impresion)
    )
  })
  return (
    <section className="harvest-ticket-list" aria-label="Lotes de tickets">
      <TicketFilters
        searchLabel="Buscar por lote o ticket"
        search={busqueda}
        setSearch={setBusqueda}
        date={fecha}
        setDate={setFecha}
        consulta={consulta}
        state={estado}
        setState={setEstado}
        states={['DISPONIBLE', 'ASIGNADO', 'EN_USO', 'CONSUMIDO']}
        print={impresion}
        setPrint={setImpresion}
      />
      <Carga consulta={consulta}>
        {() =>
          filas.length ? (
            <DataTable
              label="Lotes de tickets"
              className="harvest-ticket-table-scroll"
              tableClassName="harvest-ticket-table harvest-lots-table"
              data={filas}
              onRowActivate={(lote) =>
                navigate(`/cosecha/lotes/${encodeURIComponent(lote.id)}`)
              }
              columns={[
                {
                  key: 'id',
                  header: 'Lote',
                  width: '15.93%',
                  render: (lote) => (
                    <Link to={`/cosecha/lotes/${encodeURIComponent(lote.id)}`}>
                      {lote.id}
                    </Link>
                  )
                },
                { key: 'cantidadTickets', header: 'Tickets', width: '13.37%' },
                {
                  key: 'estado',
                  header: 'Estado',
                  width: '15.93%',
                  render: (lote) => <TicketStatus>{estadoLote(lote)}</TicketStatus>
                },
                {
                  key: 'creadoEn',
                  header: 'Generado',
                  width: '24.72%',
                  render: (lote) => fechaCorta(lote.creadoEn)
                },
                {
                  key: 'impresion',
                  header: 'Impresión',
                  status: true,
                  width: '30.05%',
                  render: (lote) =>
                    lote.impresion?.estado ?? lote.estadoImpresion ?? '—'
                }
              ]}
            />
          ) : (
            <EmptyState>Sin lotes para los filtros seleccionados.</EmptyState>
          )
        }
      </Carga>
    </section>
  )
}

function Assignments({ servicio, campania }) {
  const navigate = useNavigate()
  const consulta = useCarga(
    () => cargarListado(servicio, 'asignaciones', campania.id),
    [servicio, campania.id]
  )
  const [busqueda, setBusqueda] = useState('')
  const [fecha, setFecha] = useState('')
  const [estado, setEstado] = useState('')
  const todas = consulta.datos?.filas ?? []
  const estadoFila = (fila) =>
    fila.cantidadTickets > 0 && fila.utilizados >= fila.cantidadTickets
      ? 'FINALIZADO'
      : 'EN_USO'
  const filas = todas.filter((fila) => {
    const persona = fila.trabajador ?? fila.asignacion?.trabajador
    const buscar = `${persona?.nombre ?? ''} ${persona?.dni ?? ''} ${fila.id}`
    return (
      (!busqueda || normalizar(buscar).includes(normalizar(busqueda.trim()))) &&
      (!fecha || diaLima(fila.creadoEn) === fecha) &&
      (!estado || estadoFila(fila) === estado)
    )
  })
  const hoy = diaLima(new Date())
  const asignadasHoy = todas.filter((fila) => diaLima(fila.creadoEn) === hoy).length
  const activas = todas.filter((fila) => estadoFila(fila) === 'EN_USO').length
  const finalizadas = todas.filter((fila) => estadoFila(fila) === 'FINALIZADO').length
  return (
    <section
      className="harvest-ticket-list harvest-assignments"
      aria-label="Asignaciones de tickets"
    >
      <SummaryMetrics
        label="Resumen de asignaciones"
        items={[
          {
            key: 'hoy',
            icon: 'calendar-check',
            label: 'Asignaciones hoy',
            value: asignadasHoy
          },
          { key: 'activas', icon: 'file-check', label: 'Activas', value: activas },
          {
            key: 'finalizadas',
            icon: 'file-minus',
            label: 'Finalizadas',
            value: finalizadas
          }
        ]}
      />
      <TicketFilters
        searchLabel="Buscar por cosechador, DNI, lote o ticket"
        search={busqueda}
        setSearch={setBusqueda}
        date={fecha}
        setDate={setFecha}
        state={estado}
        setState={setEstado}
        consulta={consulta}
      />
      <Carga consulta={consulta}>
        {() =>
          filas.length ? (
            <DataTable
              label="Asignaciones de tickets"
              className="harvest-ticket-table-scroll"
              tableClassName="harvest-ticket-table harvest-assignments-table"
              onRowActivate={(fila) =>
                navigate(`/cosecha/asignaciones/${encodeURIComponent(fila.id)}`)
              }
              data={filas}
              columns={[
                {
                  key: 'creadoEn',
                  header: 'Fecha / hora',
                  width: '15.93%',
                  render: (fila) => fechaCorta(fila.creadoEn)
                },
                {
                  key: 'trabajador',
                  header: 'Cosechador',
                  width: '13.37%',
                  render: (fila) => {
                    const persona = fila.trabajador ?? fila.asignacion?.trabajador
                    return (
                      <span
                        title={persona?.dni}
                        className={!persona?.nombre ? 'table-placeholder' : undefined}
                      >
                        {persona?.nombre ?? 'Sin cosechador'}
                      </span>
                    )
                  }
                },
                {
                  key: 'id',
                  header: 'Lote',
                  width: '15.93%',
                  render: (fila) => (
                    <Link to={`/cosecha/asignaciones/${encodeURIComponent(fila.id)}`}>
                      {fila.id}
                    </Link>
                  )
                },
                {
                  key: 'ticketInicial',
                  header: 'Ticket inicial',
                  width: '24.72%',
                  render: (fila) => fila.ticketInicial ?? fila.primerTicket ?? '—'
                },
                {
                  key: 'uso',
                  header: 'Uso',
                  width: '15.02%',
                  render: (fila) => (
                    <>
                      {fila.utilizados ?? 0}/{fila.cantidadTickets ?? 0}
                    </>
                  )
                },
                {
                  key: 'estado',
                  header: 'Estado',
                  width: '15.03%',
                  render: (fila) => (
                    <TicketStatus>
                      {estadoFila(fila) === 'FINALIZADO' ? 'Finalizado' : 'En uso'}
                    </TicketStatus>
                  )
                }
              ]}
            />
          ) : (
            <EmptyState>Sin asignaciones para los filtros seleccionados.</EmptyState>
          )
        }
      </Carga>
    </section>
  )
}

function TicketFilters({
  searchLabel,
  search,
  setSearch,
  date,
  setDate,
  state,
  setState,
  states = ['EN_USO', 'FINALIZADO'],
  print,
  setPrint,
  consulta
}) {
  return (
    <form className="harvest-ticket-filters" onSubmit={(e) => e.preventDefault()}>
      <div className="harvest-ticket-toolbar">
        <label className="harvest-ticket-search">
          <span className="sr-only">{searchLabel}</span>
          <input
            type="search"
            placeholder={searchLabel}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <div className="harvest-ticket-updated">
          {consulta.datos && (
            <p>
              Última actualización:{' '}
              <time dateTime={consulta.datos.actualizadoEn}>
                {fechaCorta(consulta.datos.actualizadoEn)}
              </time>
            </p>
          )}
          <button
            type="button"
            aria-label="Actualizar consulta"
            disabled={consulta.cargando}
            onClick={consulta.refrescar}
          >
            <HomeIcon name="refresh" />
          </button>
        </div>
      </div>
      <div className="harvest-ticket-filter-row">
        <label className={`harvest-ticket-date ${date ? 'has-value' : ''}`}>
          <span>Fecha</span>
          <input
            aria-label="Fecha"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
          <img src={calendarIcon} alt="" />
        </label>
        {setState && (
          <label className="harvest-ticket-state">
            <span className="sr-only">Estado</span>
            <Select
              aria-label="Estado"
              value={state}
              onChange={(e) => setState(e.target.value)}
            >
              <option value="">Estado</option>
              {states.map((value) => (
                <option key={value} value={value}>
                  {etiquetaEstado(value)}
                </option>
              ))}
            </Select>
            <HomeIcon name="chevron" />
          </label>
        )}
        {setPrint && (
          <label className="harvest-ticket-state">
            <span className="sr-only">Impresión</span>
            <Select
              aria-label="Impresión"
              value={print}
              onChange={(e) => setPrint(e.target.value)}
            >
              <option value="">Impresión</option>
              {[
                ...new Set(
                  (consulta.datos?.filas ?? []).map(impresionLote).filter(Boolean)
                )
              ].map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </Select>
            <HomeIcon name="chevron" />
          </label>
        )}
      </div>
    </form>
  )
}

function TicketStatus({ children }) {
  return <StatusBadge indicator>{etiquetaEstado(children)}</StatusBadge>
}
