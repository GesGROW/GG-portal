import { Select } from './Select.jsx'
import { useState } from 'react'
import { useSearchParams } from 'react-router'
import { ReportLink } from './ReportLink.jsx'
import { useCarga } from './GestionUi.jsx'
import { EmptyState } from './Ui.jsx'
import { EstadoConsulta, fecha, numero } from './Reportes.jsx'
import { PortalHero, WeatherCard } from './DashboardWidgets.jsx'
import { HomeIcon, homeLaurel } from './HomeAssets.jsx'
import { HomeSkeleton } from './HomeSkeleton.jsx'

export function Dashboard({
  servicio,
  empresa,
  usuario,
  embedded = false,
  puedeDetalles = true,
  sinCampanias
}) {
  const [params, setParams] = useSearchParams()
  const [revision, setRevision] = useState(0)
  const actualizar = () => setRevision((r) => r + 1)
  const campaigns = useCarga(() => servicio.campanias(), [servicio])
  if (campaigns.cargando) return <HomeSkeleton page={!embedded} />
  return (
    <div className="dashboard-page figma-home">
      <EstadoConsulta consulta={campaigns} skeleton={embedded ? 'summary' : 'home'}>
        {(lista) => {
          if (!lista.length && sinCampanias) return sinCampanias(campaigns.refrescar)
          const id =
            params.get('campania') ||
            (lista.find((c) => c.estado === 'ACTIVA') ?? lista[0])?.id
          const campaign = lista.find((c) => c.id === id)
          const selection = (
            <Select
              className={embedded ? 'home-campaign-list' : undefined}
              aria-label="Campaña"
              size={embedded ? 3 : undefined}
              value={id ?? ''}
              onChange={(e) =>
                setParams(
                  (p) => {
                    const next = new URLSearchParams(p)
                    next.set('campania', e.target.value)
                    return next
                  },
                  { replace: true }
                )
              }
            >
              {!campaign && <option value={id ?? ''}>Selección no autorizada</option>}
              {lista.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                  {c.estado === 'CERRADA' ? ' · Cerrada' : ''}
                </option>
              ))}
            </Select>
          )
          const controls = (actions = null) =>
            embedded ? (
              <aside
                className="home-campaign-panel"
                aria-labelledby="home-campaign-title"
              >
                <h3 id="home-campaign-title">Selecciona una campaña</h3>
                {actions}
                {selection}
              </aside>
            ) : (
              <label className="home-campaign-select">
                <span className="sr-only">Campaña</span>
                {selection}
                <HomeIcon name="chevron" />
              </label>
            )
          if (!campaign)
            return (
              <>
                {!embedded && (
                  <div className="home-welcome">
                    <PortalHero empresa={empresa} usuario={usuario} figma />
                    <WeatherCard figma />
                  </div>
                )}
                {lista.length ? (
                  <>
                    {controls()}
                    <p role="alert">
                      Campaña ajena o no disponible. Seleccione una campaña de esta
                      empresa.
                    </p>
                  </>
                ) : (
                  <EmptyState>Sin campañas disponibles para esta empresa.</EmptyState>
                )}
                <button className="quiet" onClick={campaigns.refrescar}>
                  <HomeIcon name="refresh" /> Actualizar campañas
                </button>
              </>
            )
          return (
            <div className={embedded ? 'home-summary-content-embedded' : undefined}>
              <DashboardData
                key={id}
                servicio={servicio}
                empresa={empresa}
                usuario={usuario}
                campania={campaign}
                controls={controls}
                embedded={embedded}
                puedeDetalles={puedeDetalles}
                revision={revision}
                actualizar={actualizar}
              />
              {embedded &&
                controls(
                  <button
                    className="home-campaign-refresh"
                    type="button"
                    aria-label="Actualizar datos"
                    title="Actualizar datos"
                    onClick={actualizar}
                  >
                    <HomeIcon name="refresh" />
                  </button>
                )}
            </div>
          )
        }}
      </EstadoConsulta>
    </div>
  )
}

function DashboardData({
  servicio,
  empresa,
  usuario,
  campania,
  controls,
  embedded,
  puedeDetalles,
  revision,
  actualizar
}) {
  const consulta = useCarga(
    () => servicio.consultar({ campaniaId: campania.id, tipo: 'DASHBOARD' }),
    [servicio, campania.id, revision]
  )
  const ranking = useCarga(
    () =>
      servicio.consultar({
        campaniaId: campania.id,
        tipo: 'RANKING',
        periodo: 'CAMPANIA',
        busqueda: '',
        orden: 'mas-jabas'
      }),
    [servicio, campania.id, revision]
  )
  const lotes = useCarga(
    () =>
      servicio.consultar({
        campaniaId: campania.id,
        tipo: 'LOTES',
        periodo: 'CAMPANIA',
        busqueda: '',
        orden: 'mas-jabas'
      }),
    [servicio, campania.id, revision]
  )
  const reportLink = (vista) =>
    `/reportes/${vista}?campania=${encodeURIComponent(campania.id)}`
  if (!consulta.error && (consulta.cargando || ranking.cargando || lotes.cargando))
    return <HomeSkeleton dataOnly={embedded} />
  return (
    <>
      {!embedded && (
        <div className="home-welcome">
          <PortalHero empresa={empresa} usuario={usuario} campania={campania} figma />
          <WeatherCard figma />
        </div>
      )}
      <section
        className="home-summary"
        aria-label={embedded ? 'Resumen de Cosecha' : undefined}
        aria-labelledby={embedded ? undefined : 'home-summary-title'}
      >
        {!embedded && <h2 id="home-summary-title">Resumen</h2>}
        {!embedded && (
          <div className="home-toolbar">
            <div className="home-filters">
              {!embedded && (
                <label className="home-report-select">
                  <span className="sr-only">Área del resumen</span>
                  <Select defaultValue="cosecha">
                    <option value="cosecha">Cosecha</option>
                  </Select>
                  <HomeIcon name="chevron" />
                </label>
              )}
              {controls()}
            </div>
            <div className="home-updated">
              {consulta.datos && (
                <p>
                  Última actualización:{' '}
                  <time dateTime={consulta.datos.actualizadoEn}>
                    {fecha(consulta.datos.actualizadoEn)}
                  </time>
                </p>
              )}
              <button
                className="quiet icon-button"
                aria-label="Actualizar datos"
                title="Actualizar datos"
                disabled={consulta.cargando}
                onClick={actualizar}
              >
                <HomeIcon name="refresh" />
              </button>
            </div>
          </div>
        )}
        <EstadoConsulta
          consulta={consulta}
          skeleton={embedded ? 'summary-data' : 'summary'}
        >
          {(r) => {
            const s = r.datos.resumen
            const filas = lotes.datos?.datos.produccion
            const variedades =
              s.total_variedades_configuradas ??
              s.total_variedades ??
              (filas
                ? new Set(filas.map((f) => f.variedad_id ?? f.variedad).filter(Boolean))
                    .size
                : null)
            return (
              <>
                <div className="home-feature-cards">
                  <section
                    className="home-production"
                    aria-labelledby="home-production-title"
                  >
                    <header>
                      <h3 id="home-production-title">
                        {embedded ? 'Producción' : 'Producción de campaña'}
                      </h3>
                      <HomeIcon name="production" />
                    </header>
                    <div className="home-production-values">
                      <dl>
                        <dt>Total jabas</dt>
                        <dd>
                          <HomeNumber value={s.total_jabas} />
                        </dd>
                      </dl>
                      <div className="home-today">
                        <span>Jabas hoy</span>
                        <strong>
                          <HomeNumber value={r.datos.hoy.total_jabas} />
                        </strong>
                      </div>
                    </div>
                    <ReportLink
                      className="home-link"
                      to={reportLink('diaria')}
                      disponible={puedeDetalles}
                    >
                      Ver producción diaria
                      <HomeIcon name="arrow" />
                    </ReportLink>
                  </section>
                  <section
                    className="home-top-worker"
                    aria-labelledby="home-ranking-title"
                  >
                    <header>
                      <h3 id="home-ranking-title">Top cosechador</h3>
                      <HomeIcon name="ranking" />
                    </header>
                    <EstadoConsulta consulta={ranking} skeleton="compact">
                      {(result) => {
                        const top = result.datos.ranking[0]
                        return top ? (
                          <div className="home-winner">
                            <strong className="home-winner-name">
                              {top.cosechador}
                            </strong>
                            <div className="home-winner-score">
                              <img className="home-laurel" src={homeLaurel} alt="" />
                              <dl>
                                <dt>Jabas</dt>
                                <dd>
                                  <HomeNumber value={top.total_jabas} />
                                </dd>
                              </dl>
                            </div>
                          </div>
                        ) : (
                          <p className="home-ranking-empty" role="status">
                            Nadie ha cosechado aún
                          </p>
                        )
                      }}
                    </EstadoConsulta>
                    <ReportLink
                      className="home-link"
                      to={reportLink('ranking')}
                      disponible={puedeDetalles}
                    >
                      Ver ranking completo
                      <HomeIcon name="arrow" />
                    </ReportLink>
                  </section>
                </div>
                <dl className="home-stats">
                  <HomeStat
                    icon="harvesters"
                    label="Cosechadores"
                    value={s.total_cosechadores_registrados ?? s.total_cosechadores}
                    detail="Cosechadores activos registrados en la campaña"
                  />
                  <HomeStat
                    icon="carriers"
                    label="Jaberos"
                    value={s.total_jaberos_registrados ?? s.total_jaberos}
                    detail={
                      s.total_jaberos == null
                        ? 'Cantidad de jaberos no disponible en el reporte actual'
                        : 'Jaberos activos registrados en la campaña'
                    }
                  />
                  <HomeStat
                    icon={embedded ? 'calendar' : 'lots'}
                    label="Lotes operativos"
                    value={s.total_lotes_configurados ?? s.total_lotes}
                    detail="Lotes operativos configurados en la campaña"
                  />
                  <HomeStat
                    icon="varieties"
                    label="Variedades"
                    value={variedades}
                    detail={
                      lotes.error
                        ? 'No se pudieron consultar las variedades; actualice los datos para reintentar'
                        : 'Variedades configuradas en los lotes de la campaña'
                    }
                  />
                  <HomeStat
                    icon={embedded ? 'lots' : 'calendar'}
                    label="Días en producción"
                    value={s.dias_con_produccion}
                    detail="Días con producción registrada"
                  />
                </dl>
                {embedded && (
                  <span className="sr-only">
                    Última actualización: {fecha(r.actualizadoEn)}
                  </span>
                )}
                {!embedded && (
                  <section
                    className="home-activity"
                    aria-label="Última actividad registrada"
                  >
                    <HomeIcon name="clock" />
                    <h3>Última actividad registrada</h3>
                    <time dateTime={s.ultima_lectura ?? undefined}>
                      {fecha(s.ultima_lectura)}
                    </time>
                  </section>
                )}
              </>
            )
          }}
        </EstadoConsulta>
      </section>
    </>
  )
}

function HomeNumber({ value }) {
  const text = numero(value)
  return (
    <span className="home-number" style={{ '--home-number-length': text.length }}>
      {text}
    </span>
  )
}

function HomeStat({ icon, label, value, detail }) {
  return (
    <div className="home-stat" title={detail}>
      <span className="home-stat-icon">
        <HomeIcon name={icon} />
      </span>
      <div>
        <dt>{label}</dt>
        <dd>
          {value == null ? <span aria-label="No disponible">—</span> : numero(value)}
        </dd>
      </div>
    </div>
  )
}
