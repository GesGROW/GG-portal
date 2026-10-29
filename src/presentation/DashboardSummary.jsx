import { useCarga } from './GestionUi.jsx'
import { EstadoConsulta, fecha } from './Reportes.jsx'
import { ReportLink } from './ReportLink.jsx'
import { HomeIcon } from './HomeAssets.jsx'
import { PortalHero, WeatherCard } from './DashboardWidgets.jsx'
import { Select } from './Select.jsx'
import {
  HomeFeatureCard,
  HomeProductionValues,
  HomeRankingPlaceholder,
  HomeWinner,
  HomeStat
} from './HomeSummaryParts.jsx'

export function DashboardData({
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
  const s = consulta.datos?.datos.resumen
  const filas = lotes.datos?.datos.produccion
  const variedades =
    s?.total_variedades_configuradas ??
    s?.total_variedades ??
    (filas
      ? new Set(filas.map((f) => f.variedad_id ?? f.variedad).filter(Boolean)).size
      : null)
  const reportLink = (vista) =>
    `/reportes/${vista}?campania=${encodeURIComponent(campania.id)}`
  const footer = (vista, label) => (
    <ReportLink className="home-link" to={reportLink(vista)} disponible={puedeDetalles}>
      {label}
      <HomeIcon name="arrow" />
    </ReportLink>
  )
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
              <label className="home-report-select">
                <span className="sr-only">Área del resumen</span>
                <Select defaultValue="cosecha">
                  <option value="cosecha">Cosecha</option>
                </Select>
                <HomeIcon name="chevron" />
              </label>
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
        <div className="home-feature-cards">
          <HomeFeatureCard
            kind="production"
            title={embedded ? 'Producción' : 'Producción de campaña'}
            loading={consulta.cargando}
            footer={footer('diaria', 'Ver producción diaria')}
          >
            <EstadoConsulta consulta={consulta} skeleton={<HomeProductionValues />}>
              {(r) => <HomeProductionValues datos={r.datos} />}
            </EstadoConsulta>
          </HomeFeatureCard>
          <HomeFeatureCard
            kind="ranking"
            title="Top cosechador"
            loading={ranking.cargando}
            footer={footer('ranking', 'Ver ranking completo')}
          >
            <EstadoConsulta consulta={ranking} skeleton={<HomeRankingPlaceholder />}>
              {(r) => <HomeWinner ranking={r.datos.ranking} />}
            </EstadoConsulta>
          </HomeFeatureCard>
        </div>
        <dl className="home-stats">
          <HomeStat
            icon="harvesters"
            label="Cosechadores"
            loading={consulta.cargando}
            value={s?.total_cosechadores_registrados ?? s?.total_cosechadores}
            detail="Cosechadores activos registrados en la campaña"
          />
          <HomeStat
            icon="carriers"
            label="Jaberos"
            loading={consulta.cargando}
            value={s?.total_jaberos_registrados ?? s?.total_jaberos}
            detail="Jaberos activos registrados en la campaña"
          />
          <HomeStat
            icon={embedded ? 'calendar' : 'lots'}
            label="Lotes operativos"
            loading={consulta.cargando}
            value={s?.total_lotes_configurados ?? s?.total_lotes}
            detail="Lotes operativos configurados en la campaña"
          />
          <HomeStat
            icon="varieties"
            label="Variedades"
            loading={consulta.cargando || (variedades == null && lotes.cargando)}
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
            loading={consulta.cargando}
            value={s?.dias_con_produccion}
            detail="Días con producción registrada"
          />
        </dl>
        {embedded && consulta.datos && (
          <span className="sr-only">
            Última actualización: {fecha(consulta.datos.actualizadoEn)}
          </span>
        )}
        {!embedded && (
          <section className="home-activity" aria-label="Última actividad registrada">
            <HomeIcon name="clock" />
            <h3>Última actividad registrada</h3>
            <time dateTime={s?.ultima_lectura ?? undefined}>
              {fecha(s?.ultima_lectura)}
            </time>
          </section>
        )}
      </section>
    </>
  )
}
