import { DetailHero, ManagementPageHeader, Skeleton, StatusBadge } from './Ui.jsx'
import { Link, NavLink, Navigate, useSearchParams, useNavigate } from 'react-router'
import { Carga, useCarga } from './GestionUi.jsx'
import { Trabajadores } from './Trabajadores.jsx'
import { CultivosCosecha } from './CultivosCosecha.jsx'
import { CosechaSelector } from './CosechaSelector.jsx'
import { CampaniaCosecha } from './CampaniaCosecha.jsx'

const titulos = {
  lotes: 'Lotes de tickets',
  tickets: 'Tickets',
  asignaciones: 'Asignaciones'
}
const enlace = (tipo, id) => '/cosecha/' + tipo + '/' + encodeURIComponent(id)
function Persona({ persona }) {
  return persona ? (
    <span>
      {persona.nombre} · {persona.dni}
    </span>
  ) : (
    <span>Sin trabajador asignado</span>
  )
}
function Progreso({ lote }) {
  return (
    <span className="ticket-progress">
      <progress
        aria-label="Tickets utilizados"
        value={lote.utilizados}
        max={lote.cantidadTickets || 1}
      />
      {lote.utilizados} / {lote.cantidadTickets} utilizados
    </span>
  )
}
function FichaLote({ lote }) {
  return (
    <>
      <dl className="fact-list">
        <dt>Lote de tickets</dt>
        <dd className="identifier">{lote.id}</dd>
        <dt>Campaña</dt>
        <dd>{lote.campania}</dd>
        <dt>Estado derivado</dt>
        <dd>
          <StatusBadge>{lote.estado}</StatusBadge>
        </dd>
        <dt>Asignación</dt>
        <dd>
          <Persona persona={lote.asignacion?.trabajador} />
        </dd>
      </dl>
      <Progreso lote={lote} />
      <div className="actions">
        <Link to={'/cosecha/tickets?lote=' + lote.id + '&campania=' + lote.campaniaId}>
          Consultar tickets del lote
        </Link>
        {lote.asignacion && (
          <Link to={enlace('asignaciones', lote.id)}>Ver asignación</Link>
        )}
      </div>
    </>
  )
}
function FichaRegistro({ registro: r }) {
  return (
    <>
      <dl className="fact-list">
        <dt>RegistroCosecha</dt>
        <dd>{r.id}</dd>
        <dt>Ticket</dt>
        <dd>
          <Link to={enlace('tickets', r.codigoTicket)}>{r.codigoTicket}</Link>
        </dd>
        <dt>Campaña</dt>
        <dd>{r.campania}</dd>
        <dt>Trabajador atribuido</dt>
        <dd>
          <Persona persona={r.trabajador} />
        </dd>
        <dt>Fecha del hecho</dt>
        <dd>{r.fechaHora}</dd>
        <dt>Confirmado en servidor</dt>
        <dd>{r.registradoEn ?? 'No disponible'}</dd>
        <dt>Admisión de producción</dt>
        <dd>
          {r.versionProduccion === null
            ? 'Histórico piloto; no admitido como producción'
            : 'Versión ' + r.versionProduccion}
        </dd>
        <dt>Sesión</dt>
        <dd>{r.sesionId ?? 'No disponible'}</dd>
        <dt>Lote operativo / variedad</dt>
        <dd>
          {r.loteOperativo ?? 'No disponible'} · {r.variedad ?? 'No disponible'}
        </dd>
        <dt>Operación de asignación</dt>
        <dd>{r.asignacionOperacionId}</dd>
      </dl>
      <Link to={enlace('asignaciones', r.loteId)}>Ver asignación de origen</Link>
      <p className="context-note">
        Hecho histórico de consulta. El registro de cosecha se realiza desde la PWA.
      </p>
    </>
  )
}
function Detalle({ servicio, tipo, id }) {
  const consulta = useCarga(() => servicio.obtener(tipo, id), [servicio, tipo, id])
  return (
    <>
      <Link className="back-link" to={'/cosecha/' + tipo}>
        ← {titulos[tipo]}
      </Link>
      <Carga consulta={consulta}>
        {(d) => (
          <>
            <DetailHero
              eyebrow="Entidad Harvest"
              icon="harvest"
              title={
                tipo === 'tickets'
                  ? `Ticket ${d.codigo}`
                  : tipo === 'asignaciones'
                    ? 'Asignación de lote'
                    : 'Lote de tickets'
              }
              description={
                tipo === 'tickets'
                  ? `Lote ${d.lote.id} · ${d.lote.campania}`
                  : `${d.campania} · ${d.id}`
              }
              status={<StatusBadge>{d.estado}</StatusBadge>}
              facts={
                tipo === 'tickets'
                  ? [
                      ['Lote de origen', d.lote.id],
                      ['Campaña', d.lote.campania],
                      [
                        'Asignación',
                        d.lote.asignacion?.trabajador?.nombre ?? 'Sin asignar'
                      ],
                      ['Estado', d.estado]
                    ]
                  : [
                      ['Campaña', d.campania],
                      [
                        'Trabajador',
                        d.asignacion?.trabajador?.nombre ??
                          d.trabajador?.nombre ??
                          'Sin asignar'
                      ],
                      ['Tickets', `${d.utilizados ?? 0} / ${d.cantidadTickets ?? 0}`],
                      ['Estado', d.estado]
                    ]
              }
            />
            {tipo === 'tickets' ? (
              <>
                <p>
                  Estado: <strong>{d.estado}</strong>
                </p>
                <Link to={enlace('lotes', d.lote.id)}>Ver lote de origen</Link>
                <FichaLote lote={d.lote} />
                {d.registro ? (
                  <section className="management-section">
                    <FichaRegistro registro={d.registro} />
                  </section>
                ) : (
                  <p>Este ticket todavía no tiene RegistroCosecha.</p>
                )}
              </>
            ) : (
              <>
                <FichaLote lote={d} />
                {tipo === 'asignaciones' && (
                  <>
                    <p>Operación de asignación: {d.operacionId}</p>
                    <p className="context-note">
                      Consulta de asignación física registrada en campo. La corrección
                      administrativa requiere un caso de uso explícito; no se permite
                      reasignar desde esta vista.
                    </p>
                  </>
                )}
              </>
            )}
            <button className="quiet" onClick={consulta.refrescar}>
              Actualizar detalle
            </button>
          </>
        )}
      </Carga>
    </>
  )
}
export function Cosecha({
  servicio,
  appCosecha,
  reportes,
  cultivos,
  trabajadores,
  puedeTrabajadores = false,
  path,
  contexto,
  pendiente = false
}) {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const partes = path.split('/'),
    tipo =
      partes[2] ??
      (contexto.permite('harvest.view') || contexto.permite('harvest.manage')
        ? contexto.permite('harvest.manage')
          ? 'generar'
          : 'lotes'
        : 'trabajadores')
  let id
  try {
    id = partes[3] ? decodeURIComponent(partes[3]) : null
  } catch {
    return <p role="alert">Identificador Harvest inválido.</p>
  }
  if (pendiente && id) return <Skeleton text="Cargando contenido de Cosecha…" />
  if (path === '/cosecha' || partes[2] === 'registros') {
    if (pendiente) return <Skeleton text="Cargando contenido de Cosecha…" />
    const destino = contexto.permite('harvest.manage')
      ? 'generar'
      : contexto.permite('harvest.view')
        ? 'lotes'
        : 'trabajadores'
    const campania = params.get('campania')
    return (
      <Navigate
        to={
          '/cosecha/' +
          destino +
          (campania ? '?campania=' + encodeURIComponent(campania) : '')
        }
        replace
      />
    )
  }
  if (tipo === 'configurar' && cultivos && contexto.permite('harvest.manage'))
    return (
      <ConfiguradorCosecha
        servicio={servicio}
        cultivos={cultivos}
        pendiente={pendiente}
        onCreada={(r) =>
          navigate(`/cosecha/generar?campania=${encodeURIComponent(r.campaniaId)}`)
        }
      />
    )
  if (tipo === 'trabajadores' && !id)
    return (
      <div className="harvest-records-page harvest-workers-page">
        <h1>Cosecha</h1>
        <Link
          className="back-link"
          to={
            '/cosecha' +
            (params.get('campania')
              ? '?campania=' + encodeURIComponent(params.get('campania'))
              : '')
          }
        >
          Volver a Cosecha
        </Link>
        {pendiente ? (
          <Skeleton text="Cargando trabajadores…" />
        ) : (
          <Trabajadores servicio={trabajadores} />
        )}
      </div>
    )
  if (
    !id &&
    [
      'generar',
      'lotes',
      'asignaciones',
      'tickets',
      'cosechadores',
      'jaberos',
      'supervisores',
      'produccion',
      'rendimiento',
      'app',
      'dispositivos'
    ].includes(tipo)
  )
    return (
      <CampaniaCosecha
        servicio={servicio}
        appCosecha={appCosecha}
        reportes={reportes}
        contexto={contexto}
        seccion={tipo}
        pendiente={pendiente}
        puedeTrabajadores={puedeTrabajadores}
      />
    )
  return (
    <>
      <ManagementPageHeader
        eyebrow="Harvest"
        icon="harvest"
        title="Cosecha"
        description="Generación y consulta. Asignación física y registro de cosecha en la PWA."
      />
      <nav className="settings-tabs harvest-tabs" aria-label="Cosecha">
        {Object.entries(titulos).map(([ruta, nombre]) => (
          <NavLink key={ruta} to={'/cosecha/' + ruta}>
            {nombre}
          </NavLink>
        ))}
        {contexto.permite('harvest.manage') && (
          <NavLink to="/cosecha/generar">Generar tickets</NavLink>
        )}
      </nav>
      <section
        className={`content-card management-surface management-surface-editorial harvest-surface harvest-${tipo}`}
        key={path}
      >
        <Detalle servicio={servicio} tipo={tipo} id={id} />
      </section>
    </>
  )
}

function ConfiguradorCosecha({ servicio, cultivos, pendiente, onCreada }) {
  const catalogo = useCarga(() => servicio.campanias(), [servicio])
  return (
    <div className="crop-setup-page">
      <CosechaSelector
        campanias={catalogo.datos ?? []}
        pendiente={pendiente || catalogo.cargando || Boolean(catalogo.error)}
      />
      {catalogo.error && (
        <p role="alert">
          {catalogo.error.message}{' '}
          <button onClick={catalogo.refrescar}>Reintentar campañas</button>
        </p>
      )}
      <CultivosCosecha servicio={cultivos} pendiente={pendiente} onCreada={onCreada} />
    </div>
  )
}
