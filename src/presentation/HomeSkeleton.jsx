import { SkeletonBlock as Block } from './Skeleton.jsx'
import { HomeIcon } from './HomeAssets.jsx'
import {
  HomeFeatureCard,
  HomeProductionValues,
  HomeRankingPlaceholder,
  HomeStat
} from './HomeSummaryParts.jsx'
import './home-skeleton.css'

function Summary({ dataOnly }) {
  const cards = (
    <div className="home-feature-cards" aria-hidden="true" inert>
      <HomeFeatureCard
        kind="production"
        title="Producción"
        loading
        footer={
          <span className="home-link">
            Ver producción diaria
            <HomeIcon name="arrow" />
          </span>
        }
      >
        <HomeProductionValues />
      </HomeFeatureCard>
      <HomeFeatureCard
        kind="ranking"
        title="Top cosechador"
        loading
        footer={
          <span className="home-link">
            Ver ranking completo
            <HomeIcon name="arrow" />
          </span>
        }
      >
        <HomeRankingPlaceholder />
      </HomeFeatureCard>
    </div>
  )
  const stats = (
    <dl className="home-stats" aria-hidden="true">
      <HomeStat icon="harvesters" label="Cosechadores" loading />
      <HomeStat icon="carriers" label="Jaberos" loading />
      <HomeStat icon="calendar" label="Lotes operativos" loading />
      <HomeStat icon="varieties" label="Variedades" loading />
      <HomeStat icon="lots" label="Días en producción" loading />
    </dl>
  )
  return dataOnly ? (
    <>
      {cards}
      {stats}
    </>
  ) : (
    <div className="home-summary-content-embedded">
      {cards}
      <div className="home-campaign-panel" aria-hidden="true">
        <h3>Selecciona una campaña</h3>
        <div className="home-campaign-list">
          <Block className="skeleton-control" />
        </div>
      </div>
      {stats}
    </div>
  )
}

export function HomeSkeleton({ page = false, owner = false, dataOnly = false }) {
  return (
    <div
      className={`loading-state skeleton home-skeleton figma-home ${dataOnly ? 'home-skeleton-data' : ''} ${page ? `owner-home owner-home-harvest ${owner ? '' : 'harvest-supervisor-home'}` : ''}`}
      role="status"
      aria-busy="true"
    >
      <span className="sr-only">Cargando resumen de Cosecha…</span>
      {page && (
        <div aria-hidden="true">
          <h1 className="owner-home-title">Home</h1>
          <div className="owner-welcome">
            <div className="owner-greeting">
              <div className="owner-greeting-copy home-skeleton-greeting">
                <Block className="skeleton-label" />
                <Block className="skeleton-label" />
                <Block className="skeleton-value" />
              </div>
            </div>
            <div className="owner-weather">
              <Block className="skeleton-circle" />
            </div>
          </div>
          <div className="owner-summary-heading">
            <h2>Resumen</h2>
            {owner && (
              <div className="owner-module-select">
                <span className="home-skeleton-module-label">
                  <Block className="skeleton-label" />
                </span>
                <Block className="skeleton-control" />
              </div>
            )}
          </div>
        </div>
      )}
      <Summary dataOnly={dataOnly} />
    </div>
  )
}
