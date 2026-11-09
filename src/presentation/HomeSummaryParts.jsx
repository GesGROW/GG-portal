import { useId } from 'react'
import { nombreCosechadorVisible } from '../application/trabajadores.js'
import { HomeIcon, homeLaurel } from './HomeAssets.jsx'
import { SkeletonBlock } from './Skeleton.jsx'
import { numero } from './formatoNumero.js'

export function HomeFeatureCard({ kind, title, loading, footer, children, cambiar }) {
  const id = useId()
  return (
    <section
      className={kind === 'production' ? 'home-production' : 'home-top-worker'}
      aria-labelledby={id}
      aria-busy={Boolean(loading)}
    >
      {cambiar && <button type="button" className="home-card-toggle" onClick={cambiar}
        aria-label={`Cambiar recipiente de ${title}`} title="Cambiar entre General, Jabas y Jarras" />}
      <header>
        <h3 id={id}>{title}</h3>
        <HomeIcon name={kind === 'production' ? 'production' : 'ranking'} />
      </header>
      {children}
      {footer}
    </section>
  )
}

function HomeNumber({ value, loading = false }) {
  if (loading) return <SkeletonBlock className="home-number-placeholder" />
  const text = numero(value)
  return (
    <span
      className="home-number content-ready"
      style={{ '--home-number-length': text.length }}
    >
      {text}
    </span>
  )
}

export function HomeProductionValues({ datos }) {
  const unidad = datos?.unidad === 'PAQUETES' ? 'paquetes' : datos?.unidad === 'JARRAS' ? 'jarras' : 'jabas'
  return (
    <div className="home-production-values" aria-busy={!datos}>
      <dl>
        <dt>Total {unidad}</dt>
        <dd>
          <HomeNumber value={datos?.resumen.total_jabas} loading={!datos} />
        </dd>
      </dl>
      <div className="home-today">
        <span>{unidad[0].toUpperCase()+unidad.slice(1)} hoy</span>
        <strong>
          <HomeNumber value={datos?.hoy.total_jabas} loading={!datos} />
        </strong>
      </div>
    </div>
  )
}

export function HomeRankingPlaceholder() {
  return (
    <div className="home-winner home-winner-placeholder" aria-hidden="true">
      <SkeletonBlock className="home-winner-name" />
      <SkeletonBlock className="home-winner-score" />
    </div>
  )
}

export function HomeWinner({ ranking, unidad }) {
  const etiqueta = unidad === 'PAQUETES' ? 'Paquetes' : unidad === 'JARRAS' ? 'Jarras' : 'Jabas'
  const top = ranking[0]
  const nombre = top?.cosechador?.trim()
  const sinNombre = !nombre || ['sin nombre registrado', 'sin nombre'].includes(nombre.toLocaleLowerCase('es'))
  return top ? (
    <div className="home-winner content-ready">
      <strong className="home-winner-name">
        {nombreCosechadorVisible(sinNombre ? '' : top.cosechador, top.cosechador_dni)}
      </strong>
      <div className="home-winner-score">
        <img className="home-laurel" src={homeLaurel} alt="" />
        <dl>
          <dt>{etiqueta}</dt>
          <dd>
            <HomeNumber value={top.total_jabas} />
          </dd>
        </dl>
      </div>
    </div>
  ) : (
    <p className="home-ranking-empty content-ready" role="status">
      Nadie ha cosechado aún
    </p>
  )
}

export function HomeStat({ icon, label, value, detail, loading = false }) {
  return (
    <div className="home-stat" title={detail} aria-busy={loading}>
      <span className="home-stat-icon">
        <HomeIcon name={icon} />
      </span>
      <div>
        <dt>{label}</dt>
        <dd>
          {loading ? (
            <SkeletonBlock className="home-stat-value-placeholder" />
          ) : (
            <span className="content-ready">
              {value == null ? (
                <span aria-label="No disponible">—</span>
              ) : (
                numero(value)
              )}
            </span>
          )}
        </dd>
      </div>
    </div>
  )
}
