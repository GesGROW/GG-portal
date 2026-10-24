import { SkeletonBlock as Block } from './Skeleton.jsx'
import './home-skeleton.css'

function Summary({ dataOnly }) {
  const cards = (
    <div className="home-feature-cards" aria-hidden="true">
      {[1, 2].map((card) => (
        <div className="home-skeleton-feature" key={card}>
          <Block className="skeleton-label" />
          <Block className="skeleton-value" />
          <Block className="skeleton-label" />
        </div>
      ))}
    </div>
  )
  const stats = (
    <div className="home-stats" aria-hidden="true">
      {[1, 2, 3, 4, 5].map((stat) => (
        <div className="home-stat" key={stat}>
          <Block className="skeleton-circle" />
          <div><Block /><Block className="skeleton-value" /></div>
        </div>
      ))}
    </div>
  )
  return dataOnly ? <>{cards}{stats}</> : (
    <div className="home-summary-content-embedded">
      {cards}
      <div className="home-campaign-panel" aria-hidden="true">
        <h3>
          <span className="home-skeleton-text">Selecciona una campaña</span>
          <Block />
        </h3>
        <div className="home-campaign-list"><Block className="skeleton-control" /></div>
      </div>
      {stats}
    </div>
  )
}

export function HomeSkeleton({ page = false, owner = false, dataOnly = false }) {
  return (
    <div
      className={`loading-state skeleton home-skeleton ${dataOnly ? 'home-skeleton-data' : ''} ${page ? `owner-home owner-home-harvest ${owner ? '' : 'harvest-supervisor-home'}` : ''}`}
      role="status"
      aria-busy="true"
    >
      <span className="sr-only">Cargando resumen de Cosecha…</span>
      {page && (
        <div aria-hidden="true">
          <div className="owner-home-title"><Block className="home-skeleton-title" /></div>
          <div className="owner-welcome">
            <div className="owner-greeting">
              <div className="owner-greeting-copy home-skeleton-greeting">
                <Block className="skeleton-label" />
                <Block className="skeleton-label" />
                <Block className="skeleton-value" />
              </div>
            </div>
            <div className="owner-weather"><Block className="skeleton-circle" /></div>
          </div>
          <div className="owner-summary-heading">
            <div className="home-skeleton-summary-title"><Block className="home-skeleton-title" /></div>
            {owner && (
              <div className="owner-module-select">
                <span className="home-skeleton-module-label"><Block className="skeleton-label" /></span>
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
