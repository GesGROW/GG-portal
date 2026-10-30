import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { Select } from './Select.jsx'
import { DataTable } from './DataTable.jsx'
import { CampaignTableEmpty } from './CampaignTableEmpty.jsx'
import { SkeletonBlock as Block, SkeletonTable } from './Skeleton.jsx'
import {
  ordenarRendimiento,
  seriesRendimiento,
  trazarSerie
} from './rendimientoCosechadores.js'
import './rendimiento-cosechadores.css'

const numero = (n) =>
  n == null
    ? '—'
    : new Intl.NumberFormat('es-PE', { maximumFractionDigits: 1 }).format(n)
const fecha = (d) => d?.split('-').reverse().join('/') ?? ''
const colores = [
  '#137d15',
  '#022f2a',
  '#547ba5',
  '#9a651a',
  '#735794',
  '#ad4b3e',
  '#168080',
  '#6c7429',
  '#a1487b',
  '#506078'
]
const columnas = [
  { key: 'posicion', header: 'Puesto', width: '110px' },
  {
    key: 'nombre',
    header: 'Cosechador',
    width: '29%',
    render: (p) => (
      <span className="rendimiento-persona">
        <span className="rendimiento-persona-nombre" title={p.nombre}>
          {p.nombre}
        </span>
        <small>DNI {p.dni || '—'}</small>
      </span>
    )
  },
  { key: 'jabas', header: 'Total jabas', width: '16%', render: (p) => numero(p.jabas) },
  {
    key: 'diasRegistros',
    header: 'Días con registros',
    width: '22%',
    render: (p) => numero(p.diasRegistros)
  },
  {
    key: 'promedioDiario',
    header: (
      <span
        title="Promedio de jabas por día con registros"
        aria-label="Promedio por día con registros"
      >
        Promedio diario
      </span>
    ),
    width: '22%',
    render: (p) => numero(p.promedioDiario)
  }
]

export function RankingCampania({ filas }) {
  return (
    <DataTable
      label="Ranking de cosechadores"
      columns={columnas}
      data={filas}
      tableClassName="rendimiento-ranking-table"
      pageSize={10}
      reserveRows={10}
      rowClassName={(p) =>
        [1, 2, 3].includes(p.posicion) ? `rendimiento-puesto-${p.posicion}` : undefined
      }
      emptyState={<CampaignTableEmpty>Nadie ha cosechado aún</CampaignTableEmpty>}
    />
  )
}

export function RendimientoSkeleton() {
  return (
    <div className="rendimiento-cosechadores" aria-hidden="true" inert>
      <section className="rendimiento-ranking">
        <div className="rendimiento-section-heading">
          <h3>Ranking de cosechadores</h3>
          <Block className="rendimiento-select skeleton-control" />
        </div>
        <SkeletonTable
          columns={columnas}
          rows={10}
          reserveRows={10}
          pagination
          tableClassName="rendimiento-ranking-table"
        />
      </section>
      <section className="rendimiento-evolucion">
        <div className="rendimiento-section-heading">
          <h3>Evolución por cosechador</h3>
          <Block className="rendimiento-select skeleton-control" />
        </div>
        <p className="rendimiento-legend-help">
          Haz clic en el nombre de un cosechador para ocultarlo o volver a mostrarlo en
          el gráfico.
        </p>
        <div className="rendimiento-legend">
          {[1, 2, 3, 4, 5].map((i) => (
            <Block key={i} className="rendimiento-legend-placeholder" />
          ))}
        </div>
        <div className="rendimiento-chart">
          <Block className="rendimiento-chart-placeholder" />
          <div className="rendimiento-dia-detalle">
            <Block className="rendimiento-dia-placeholder" />
            <Block className="rendimiento-range-placeholder" />
            <dl>
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i}>
                  <dt>
                    <Block className="rendimiento-nombre-placeholder" />
                  </dt>
                  <dd>
                    <Block className="rendimiento-valor-placeholder" />
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </section>
    </div>
  )
}

export function RendimientoCosechadores({ datos }) {
  const [orden, setOrden] = useState('MAYOR')
  const [modo, setModo] = useState('5')
  const [elegidos, setElegidos] = useState([])
  const [ocultos, setOcultos] = useState([])
  const [busqueda, setBusqueda] = useState('')
  const filas = useMemo(
    () => ordenarRendimiento(datos.ranking, orden),
    [datos.ranking, orden]
  )
  const personas =
    modo === 'manual'
      ? filas.filter((p) => elegidos.includes(p.id))
      : filas.slice(0, Number(modo))
  const series = useMemo(
    () =>
      seriesRendimiento(
        datos.evolucion.map((d) => d.fecha),
        personas,
        datos.evolucionCosechadores ?? []
      ),
    [datos.evolucion, datos.evolucionCosechadores, personas]
  )
  const visibles = series
    .map((s, i) => ({ ...s, color: colores[i], indiceColor: i }))
    .filter((s) => !ocultos.includes(s.id))
  const buscar = busqueda.trim().toLocaleLowerCase('es')
  return (
    <div className="rendimiento-cosechadores content-ready">
      <section className="rendimiento-ranking" aria-label="Resumen de rendimiento">
        <div className="rendimiento-section-heading">
          <h3>Ranking de cosechadores</h3>
          <label className="rendimiento-select">
            <span className="sr-only">Orden del ranking</span>
            <Select
              aria-label="Orden del ranking"
              value={orden}
              onChange={(e) => {
                setOrden(e.target.value)
                setOcultos([])
              }}
            >
              <option value="MAYOR">Mayor producción</option>
              <option value="MENOR">Menor producción</option>
            </Select>
          </label>
        </div>
        <RankingCampania filas={filas} />
      </section>
      <section
        className="rendimiento-evolucion"
        aria-label="Evolución del rendimiento por cosechador"
      >
        <div className="rendimiento-section-heading">
          <h3>Evolución por cosechador</h3>
          <label className="rendimiento-select">
            <span className="sr-only">Cosechadores del gráfico</span>
            <Select
              aria-label="Cosechadores del gráfico"
              value={modo}
              onChange={(e) => {
                setModo(e.target.value)
                setOcultos([])
              }}
            >
              <option value="5">Primeros 5 del ranking</option>
              <option value="10">Primeros 10 del ranking</option>
              <option value="manual">Selección manual</option>
            </Select>
          </label>
        </div>
        <p className="rendimiento-legend-help">
          Haz clic en el nombre de un cosechador para ocultarlo o volver a mostrarlo en
          el gráfico.
        </p>
        {modo === 'manual' && (
          <div
            className="rendimiento-personas-picker"
            role="group"
            aria-label="Selección de cosechadores"
          >
            <div className="rendimiento-personas-options">
              <input
                type="search"
                aria-label="Buscar cosechador para comparar"
                placeholder="Nombre o DNI"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
              />
              <fieldset>
                <legend className="sr-only">Selecciona hasta 10 cosechadores</legend>
                {filas
                  .filter((p) =>
                    `${p.nombre} ${p.dni ?? ''}`
                      .toLocaleLowerCase('es')
                      .includes(buscar)
                  )
                  .map((p) => (
                    <label key={p.id}>
                      <input
                        type="checkbox"
                        checked={elegidos.includes(p.id)}
                        disabled={!elegidos.includes(p.id) && elegidos.length >= 10}
                        onChange={(e) =>
                          setElegidos((v) =>
                            e.target.checked
                              ? [...v, p.id]
                              : v.filter((id) => id !== p.id)
                          )
                        }
                      />
                      <span>
                        {p.nombre}
                        <small>DNI {p.dni || '—'}</small>
                      </span>
                    </label>
                  ))}
              </fieldset>
            </div>
          </div>
        )}
        <div className="rendimiento-legend" aria-label="Líneas del gráfico">
          {series.map((s, i) => (
            <button
              type="button"
              key={s.id}
              aria-pressed={!ocultos.includes(s.id)}
              style={{ '--serie-color': colores[i] }}
              onClick={() =>
                setOcultos((v) =>
                  v.includes(s.id) ? v.filter((id) => id !== s.id) : [...v, s.id]
                )
              }
            >
              <span className="rendimiento-color" aria-hidden="true" />
              {s.nombre}
            </button>
          ))}
        </div>
        <GraficoRendimiento
          fechas={datos.evolucion.map((d) => d.fecha)}
          series={visibles}
        />
      </section>
    </div>
  )
}

export function GraficoRendimiento({ fechas, series }) {
  const [dia, setDia] = useState(0)
  const [disponible, setDisponible] = useState(640)
  const contenedor = useRef(null)
  useEffect(() => {
    const elemento = contenedor.current
    const medir = () => setDisponible(elemento.clientWidth)
    medir()
    if (typeof ResizeObserver === 'undefined') return
    const observador = new ResizeObserver(medir)
    observador.observe(elemento)
    return () => observador.disconnect()
  }, [])
  const id = useId()
  const actual = Math.min(dia, Math.max(0, fechas.length - 1))
  const rankingDelDia = [...series].sort(
    (a, b) =>
      (b.valores[actual] ?? -1) - (a.valores[actual] ?? -1) ||
      a.nombre.localeCompare(b.nombre, 'es')
  )
  const puestosDelDia = new Map(
    [...new Set(rankingDelDia.map((s) => s.valores[actual]).filter((v) => v != null))]
      .slice(0, 3)
      .map((jabas, i) => [jabas, i + 1])
  )
  const valores = series.flatMap((s) => s.valores.filter((v) => v !== null))
  const paso = Math.max(1, Math.ceil(Math.max(0, ...valores) / 4))
  const maximo = paso * 4
  const ancho = Math.max(640, disponible, (fechas.length - 1) * 42 + 80)
  const x = (i) =>
    48 +
    (fechas.length <= 1 ? (ancho - 72) / 2 : (i * (ancho - 72)) / (fechas.length - 1))
  const y = (n) => 280 - (n / maximo) * 250
  const intervalo = Math.max(1, Math.ceil(fechas.length / 16))
  const vacio = !series.length || !valores.length
  return (
    <div className="rendimiento-chart">
      <div
        ref={contenedor}
        className="rendimiento-chart-scroll"
        tabIndex={0}
        role="region"
        aria-label="Gráfico de jabas por día"
      >
        <svg
          viewBox={`0 0 ${ancho} 330`}
          style={{ width: ancho }}
          role="img"
          aria-labelledby={`${id}-titulo ${id}-descripcion`}
          onPointerMove={(e) => {
            if (vacio) return
            const r = e.currentTarget.getBoundingClientRect()
            const px = ((e.clientX - r.left) * ancho) / r.width
            setDia(
              fechas.length <= 1
                ? 0
                : Math.max(
                    0,
                    Math.min(
                      fechas.length - 1,
                      Math.round(((px - 48) / (ancho - 72)) * (fechas.length - 1))
                    )
                  )
            )
          }}
        >
          <title id={`${id}-titulo`}>Evolución diaria de jabas por cosechador</title>
          <desc id={`${id}-descripcion`}>
            Cada línea representa un cosechador. Los días sin registros quedan vacíos y
            no se conectan. Usa el selector de día para consultar los valores.
          </desc>
          {[0, 1, 2, 3, 4].map((i) => (
            <g key={i}>
              <line
                x1="48"
                x2={ancho - 24}
                y1={y(i * paso)}
                y2={y(i * paso)}
                className="rendimiento-gridline"
              />
              <text x="38" y={y(i * paso) + 4} textAnchor="end">
                {numero(i * paso)}
              </text>
            </g>
          ))}
          {fechas.map((f, i) =>
            i % intervalo === 0 || i === fechas.length - 1 ? (
              <text key={f} x={x(i)} y="307" textAnchor="middle">
                {f.slice(8)}/{f.slice(5, 7)}
              </text>
            ) : null
          )}
          {!vacio && (
            <line
              x1={x(actual)}
              x2={x(actual)}
              y1="24"
              y2="280"
              className="rendimiento-dia-line"
            />
          )}
          {series.map((s) => (
            <g key={s.id} data-serie-id={s.id}>
              <path
                d={trazarSerie(s.valores, x, y)}
                fill="none"
                stroke={s.color}
                strokeWidth="3"
                strokeLinejoin="round"
                strokeLinecap="round"
                strokeDasharray={s.indiceColor % 3 === 2 ? '7 4' : undefined}
              />
              {s.valores.map((v, i) =>
                v === null ? null : (
                  <circle
                    key={fechas[i]}
                    cx={x(i)}
                    cy={y(v)}
                    r={i === actual ? 5 : 3}
                    fill={s.color}
                    data-fecha={fechas[i]}
                  >
                    <title>
                      {s.nombre}: {numero(v)} jabas · {fecha(fechas[i])}
                    </title>
                  </circle>
                )
              )}
            </g>
          ))}
        </svg>
        {vacio && (
          <p className="rendimiento-chart-empty">
            {series.length
              ? 'Sin registros diarios para este período'
              : 'Selecciona un cosechador para ver su evolución'}
          </p>
        )}
      </div>
      <div className="rendimiento-dia-detalle">
        <label htmlFor={`${id}-dia`}>
          Día: <strong>{fecha(fechas[actual]) || 'Sin fechas'}</strong>
        </label>
        <input
          id={`${id}-dia`}
          type="range"
          aria-label="Día de la evolución"
          aria-valuetext={fecha(fechas[actual])}
          min="0"
          max={Math.max(0, fechas.length - 1)}
          value={actual}
          style={{
            '--rendimiento-range-progress': `${fechas.length > 1 ? (actual / (fechas.length - 1)) * 100 : 0}%`
          }}
          disabled={!fechas.length || !series.length}
          onChange={(e) => setDia(Number(e.target.value))}
        />
        <dl>
          {rankingDelDia.map((s) => (
            <div
              key={s.id}
              className={
                puestosDelDia.has(s.valores[actual])
                  ? `rendimiento-puesto-${puestosDelDia.get(s.valores[actual])}`
                  : undefined
              }
            >
              <dt>
                <span
                  className="rendimiento-color"
                  style={{ '--serie-color': s.color }}
                  aria-hidden="true"
                />
                {s.nombre}
              </dt>
              <dd>
                {s.valores[actual] == null
                  ? 'Sin registro'
                  : `${numero(s.valores[actual])} jabas`}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  )
}
