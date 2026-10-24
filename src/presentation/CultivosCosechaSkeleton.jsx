import { SkeletonBlock as Block } from './Skeleton.jsx'

function Campo() {
  return (
    <div className="cc-skeleton-field">
      <Block className="cc-skeleton-label" />
      <Block className="cc-skeleton-control" />
    </div>
  )
}

export function CultivosCosechaSkeleton({ tipo }) {
  return (
    <div className="cc-panel-skeleton" aria-hidden="true" data-tipo={tipo}>
      <div className="cc-skeleton-heading">
        <Block className="cc-skeleton-icon" />
        <Block className="cc-skeleton-title" />
      </div>
      {tipo === 'discovery' ? (
        <div className="cc-skeleton-card">
          <Block className="cc-skeleton-title" />
          <div className="cc-skeleton-columns">
            {[1, 2, 3].map((i) => (
              <div key={i}><Block /><Block /><Block /></div>
            ))}
          </div>
          <Block className="cc-skeleton-control" />
        </div>
      ) : (
        <>
          <Campo />
          {tipo === 'campania' ? (
            <>
              <div className="cc-skeleton-dates"><Campo /><Campo /></div>
              <Block className="cc-skeleton-template" />
            </>
          ) : tipo === 'lotes' ? <Campo /> : (
            <>
              <Block className="cc-skeleton-label" />
              <div className="cc-skeleton-variety">
                <Block className="cc-skeleton-label" />
                <Block className="cc-skeleton-control" />
              </div>
              <div className="cc-skeleton-palette">
                {Array.from({ length: 10 }, (_, i) => <Block key={i} />)}
              </div>
            </>
          )}
          <Block className="cc-skeleton-submit" />
        </>
      )}
    </div>
  )
}
