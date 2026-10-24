import { Select } from './Select.jsx'
import { useId, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { useCarga } from './GestionUi.jsx'
import { EstadoConsulta, fecha, numero } from './Reportes.jsx'
import { DataTable, EmptyState, Icon } from './Ui.jsx'
import { ReportActions } from './ReportActions.jsx'

const periods = { HOY: 'Hoy', SEMANA: 'Semana', MES: 'Mes', CAMPANIA: 'Campaña' }

export function PeriodSelector({ value, onChange }) {
  return (
    <fieldset className="period-selector">
      <legend>Periodo</legend>
      <div>
        {Object.entries(periods).map(([id, name]) => (
          <button
            key={id}
            type="button"
            aria-pressed={value === id}
            onClick={() => onChange(id)}
          >
            {name}
          </button>
        ))}
      </div>
    </fieldset>
  )
}

export function Ranking({ servicio }) {
  const [params, setParams] = useSearchParams()
  const campaigns = useCarga(() => servicio.campanias(), [servicio])
  const period = params.get('periodo') ?? 'CAMPANIA'
  const search = params.get('buscar') ?? ''
  const change = (key, value) =>
    setParams(
      (p) => {
        const next = new URLSearchParams(p)
        next.set(key, value)
        return next
      },
      { replace: true }
    )
  return (
    <div className="ranking-page">
      <div className="page-heading">
        <Link className="eyebrow" to="/reportes">
          Reportes / Ranking
        </Link>
        <h1>Ranking de cosechadores</h1>
        <p>
          Una mirada a la producción de su equipo. Seleccione de 2 a 5 cosechadores para
          comparar.
        </p>
      </div>
      <EstadoConsulta consulta={campaigns}>
        {(lista) => {
          if (!lista.length)
            return <EmptyState>Sin campañas disponibles para esta empresa.</EmptyState>
          const id =
            params.get('campania') ||
            (lista.find((c) => c.estado === 'ACTIVA') ?? lista[0]).id
          const campaign = lista.find((c) => c.id === id)
          return (
            <>
              <div className="ranking-controls">
                <label>
                  Campaña
                  <Select
                    value={id}
                    onChange={(e) => change('campania', e.target.value)}
                  >
                    {!campaign && <option value={id}>Selección no autorizada</option>}
                    {lista.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.codigo} · {c.nombre}
                        {c.estado === 'CERRADA' ? ' · Cerrada' : ''}
                      </option>
                    ))}
                  </Select>
                </label>
                <button
                  className="quiet icon-button"
                  aria-label="Actualizar campañas"
                  title="Actualizar campañas"
                  onClick={campaigns.refrescar}
                >
                  <Icon name="refresh" />
                </button>
                <PeriodSelector
                  value={period}
                  onChange={(value) => change('periodo', value)}
                />
              </div>
              {!campaign ? (
                <p role="alert">
                  Campaña ajena o no disponible. Seleccione una campaña de esta empresa.
                </p>
              ) : (
                <RankingData
                  key={`${id}:${period}`}
                  servicio={servicio}
                  campania={campaign}
                  periodo={period}
                  busqueda={search}
                  onSearch={(value) => change('buscar', value)}
                />
              )}
            </>
          )
        }}
      </EstadoConsulta>
    </div>
  )
}

function RankingData({ servicio, campania, periodo, busqueda, onSearch }) {
  const filters = { campaniaId: campania.id, tipo: 'RANKING', periodo, busqueda }
  const consulta = useCarga(
    () => servicio.consultar(filters),
    [servicio, campania.id, periodo, busqueda]
  )
  return (
    <>
      <div className="ranking-toolbar">
        <div className="ranking-search">
          <label htmlFor="ranking-search">Buscar por nombre o DNI</label>
          <div>
            <Icon name="search" />
            <input
              id="ranking-search"
              type="search"
              value={busqueda}
              onChange={(e) => onSearch(e.target.value)}
              placeholder="Nombre o DNI…"
            />
            {busqueda && (
              <button
                className="quiet icon-button"
                aria-label="Limpiar búsqueda"
                onClick={() => onSearch('')}
              >
                <Icon name="close" />
              </button>
            )}
          </div>
        </div>
        <ReportActions servicio={servicio} consulta={consulta} />
      </div>
      <RankingResults
        key={consulta.revision}
        consulta={consulta}
        campania={campania.nombre}
        periodo={periodo}
        busqueda={busqueda}
      />
    </>
  )
}

function RankingResults({ consulta, campania, periodo, busqueda }) {
  const [picks, setPicks] = useState([]),
    [comparing, setComparing] = useState(false)
  const chart = useRef(null)
  // Visual identity only: removing one pick never recolors the remaining workers.
  const seriesByWorker = useRef(new Map())
  const filas = consulta.datos?.datos.ranking ?? []
  const ids = picks.map((f) => f.cosechador_dni)
  // Conserva filas autorizadas seleccionadas al buscar; nunca recalcula sus valores.
  // Refrescar, cambiar campaña/periodo o Tenant descarta la selección completa.
  const selected = picks.map(
    (pick) => filas.find((f) => f.cosechador_dni === pick.cosechador_dni) ?? pick
  )
  const visible = filas
  const max = Math.max(1, ...filas.map((f) => f.total_jabas ?? 0))
  function toggle(id) {
    if (ids.includes(id)) seriesByWorker.current.delete(id)
    else if (ids.length < 5) {
      const used = new Set(seriesByWorker.current.values())
      seriesByWorker.current.set(
        id,
        [1, 2, 3, 4, 5].find((series) => !used.has(series))
      )
    }
    setComparing(false)
    setPicks((current) =>
      current.some((f) => f.cosechador_dni === id)
        ? current.filter((f) => f.cosechador_dni !== id)
        : current.length < 5
          ? [...current, filas.find((f) => f.cosechador_dni === id)]
          : current
    )
  }
  function compare() {
    setComparing(true)
    chart.current?.focus()
  }
  return (
    <EstadoConsulta consulta={consulta}>
      {() => (
        <div className="ranking-layout">
          <section className="ranking-general">
            <div className="section-title">
              <div>
                <span className="eyebrow">
                  {periods[periodo] ?? 'Periodo seleccionado'}
                </span>
                <h2>Ranking general</h2>
              </div>
              <span className="badge">{numero(filas.length)} cosechadores</span>
            </div>
            <p className="ranking-context">
              {campania} · {periods[periodo] ?? 'Periodo seleccionado'}
            </p>
            {!visible.length ? (
              <EmptyState>
                {busqueda.trim()
                  ? 'No hay cosechadores que coincidan con la búsqueda.'
                  : 'Sin datos para los filtros seleccionados.'}
              </EmptyState>
            ) : (
              <DataTable
                label="Ranking de cosechadores"
                tableClassName="ranking-table"
                caption="Ranking de cosechadores"
                captionClassName="sr-only"
                rowKey="cosechador_dni"
                data={visible}
                rowClassName={(f) =>
                  `${ids.includes(f.cosechador_dni) ? 'is-selected' : ''} ${f.posicion <= 3 ? 'is-top' : ''}`
                }
                columns={[
                  {
                    key: 'seleccion',
                    header: <span className="sr-only">Seleccionar</span>,
                    render: (f) => (
                      <label className="ranking-checkbox">
                        <input
                          type="checkbox"
                          aria-label={`Comparar a ${f.cosechador}`}
                          checked={ids.includes(f.cosechador_dni)}
                          disabled={!ids.includes(f.cosechador_dni) && ids.length >= 5}
                          onChange={() => toggle(f.cosechador_dni)}
                        />
                      </label>
                    )
                  },
                  {
                    key: 'posicion',
                    header: 'Posición',
                    render: (f) => (
                      <span className="ranking-position">{f.posicion}</span>
                    )
                  },
                  {
                    key: 'cosechador',
                    header: 'Cosechador',
                    rowHeader: true,
                    render: (f) => (
                      <>
                        <span className="worker-name">{f.cosechador}</span>
                        <small>{f.cosechador_dni}</small>
                        <span className="ranking-mobile-activity">
                          {fecha(f.ultima_lectura)}
                        </span>
                      </>
                    )
                  },
                  {
                    key: 'total_jabas',
                    header: 'Jabas',
                    className: 'numeric',
                    render: (f) => (
                      <>
                        <strong>{numero(f.total_jabas)}</strong>
                        <span className="ranking-in-cell-bar" aria-hidden="true">
                          <span
                            style={{ width: `${((f.total_jabas ?? 0) / max) * 100}%` }}
                          />
                        </span>
                      </>
                    )
                  },
                  {
                    key: 'ultima_lectura',
                    header: 'Última actividad',
                    muted: (f) => !f.ultima_lectura,
                    className: 'ranking-last-activity',
                    render: (f) => (
                      <time dateTime={f.ultima_lectura ?? undefined}>
                        {fecha(f.ultima_lectura)}
                      </time>
                    )
                  }
                ]}
              />
            )}
          </section>
          <aside className="comparison-panel" aria-label="Comparación de cosechadores">
            <ComparisonTray
              selected={selected}
              seriesByWorker={seriesByWorker.current}
              onRemove={toggle}
              onClear={() => {
                seriesByWorker.current.clear()
                setPicks([])
                setComparing(false)
              }}
              onCompare={compare}
            />
            <section
              className="comparison-result"
              ref={chart}
              tabIndex={-1}
              aria-label="Resultado de comparación"
            >
              <span className="eyebrow">
                Producción · {periods[periodo] ?? 'Periodo seleccionado'}
              </span>
              <h2>Comparación de producción</h2>
              <p className="ranking-context">{campania}</p>
              {comparing && selected.length >= 2 ? (
                <ComparisonChart
                  filas={selected}
                  periodo={periods[periodo]}
                  seriesByWorker={seriesByWorker.current}
                />
              ) : (
                <EmptyState>
                  {selected.length < 2
                    ? 'Seleccione al menos 2 cosechadores para comparar su producción.'
                    : 'Su selección está lista. Pulse Comparar para ver los resultados.'}
                </EmptyState>
              )}
              <div className="comparison-availability">
                <Icon name="info" />
                <p>
                  Puede comparar los totales del periodo. La evolución por día de cada
                  cosechador aún no está disponible.
                </p>
              </div>
            </section>
          </aside>
        </div>
      )}
    </EstadoConsulta>
  )
}

export function ComparisonTray({
  selected,
  seriesByWorker,
  onRemove,
  onClear,
  onCompare
}) {
  return (
    <section className="comparison-tray" aria-label="Bandeja de comparación">
      <div className="section-title">
        <h2>Comparar</h2>
        <span className="badge" aria-live="polite">
          {selected.length} de 5
        </span>
      </div>
      {selected.length ? (
        <ul className="comparison-chips">
          {selected.map((f, i) => (
            <li
              key={f.cosechador_dni}
              className={`series-${seriesByWorker?.get(f.cosechador_dni) ?? i + 1}`}
            >
              <span>{f.cosechador}</span>
              <button
                className="quiet icon-button"
                aria-label={`Quitar a ${f.cosechador}`}
                onClick={() => onRemove(f.cosechador_dni)}
              >
                <Icon name="close" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted">Marque cosechadores en el ranking para añadirlos aquí.</p>
      )}
      <div className="actions">
        <button className="primary" disabled={selected.length < 2} onClick={onCompare}>
          <Icon name="compare" />
          Comparar {selected.length || ''}
        </button>
        {selected.length > 0 && (
          <button className="quiet" onClick={onClear}>
            Limpiar selección
          </button>
        )}
      </div>
      <p className="selection-hint" role="status">
        {selected.length === 5
          ? 'Límite de 5 cosechadores alcanzado. Quite uno para cambiar su selección.'
          : 'Seleccione de 2 a 5 cosechadores.'}
      </p>
    </section>
  )
}

export function ComparisonChart({ filas, periodo, seriesByWorker }) {
  const id = useId(),
    max = Math.max(1, ...filas.map((f) => f.total_jabas ?? 0))
  return (
    <>
      <figure className="comparison-chart">
        <figcaption>Jabas por cosechador · {periodo}</figcaption>
        <div className="comparison-bars">
          {filas.map((f, i) => (
            <div
              key={f.cosechador_dni}
              className={`comparison-bar series-${seriesByWorker?.get(f.cosechador_dni) ?? i + 1}`}
              tabIndex={0}
              aria-label={`${f.cosechador}: ${numero(f.total_jabas)} jabas`}
              aria-describedby={`${id}-${i}`}
            >
              <div className="bar-label">
                <span>
                  <span className="series-index">
                    {seriesByWorker?.get(f.cosechador_dni) ?? i + 1}
                  </span>
                  {f.cosechador}
                </span>
                <strong>{numero(f.total_jabas)} jabas</strong>
              </div>
              <div className="bar-track" aria-hidden="true">
                <span
                  className="bar-fill"
                  style={{ width: `${((f.total_jabas ?? 0) / max) * 100}%` }}
                />
              </div>
              <span className="chart-tooltip" role="tooltip" id={`${id}-${i}`}>
                {periodo} · {numero(f.total_jabas)} jabas · Última actividad:{' '}
                {fecha(f.ultima_lectura)}
              </span>
            </div>
          ))}
        </div>
        <div className="chart-scale">
          <span>0 jabas</span>
          <span>{numero(max)} jabas</span>
        </div>
      </figure>
      <DataTable
        label="Datos de comparación"
        caption={`Comparación de cosechadores · ${periodo}`}
        rowKey="cosechador_dni"
        data={filas}
        columns={[
          { key: 'cosechador', header: 'Cosechador', rowHeader: true },
          {
            key: 'total_jabas',
            header: 'Jabas',
            className: 'numeric',
            render: (f) => numero(f.total_jabas)
          },
          {
            key: 'ultima_lectura',
            header: 'Última actividad',
            render: (f) => fecha(f.ultima_lectura)
          }
        ]}
      />
    </>
  )
}
