import { Select } from './Select.jsx'
import { useEffect, useRef, useState } from 'react'
import { Carga, useCarga } from './GestionUi.jsx'
import { CampaignReportSkeleton } from './CampaignSkeleton.jsx'
import { RendimientoCosechadores } from './RendimientoCosechadores.jsx'
export { RankingCampania } from './RendimientoCosechadores.jsx'
import './reportes-campania.css'

const numero = (n) =>
  new Intl.NumberFormat('es-PE', { maximumFractionDigits: 1 }).format(n)
const fecha = (d) => d?.split('-').reverse().join('/') ?? ''
const fechaSelector = (d) => {
  if (!d) return 'Selecciona'
  const [anio, mes, dia] = d.split('-')
  const meses = ['Ene.', 'Feb.', 'Mar.', 'Abr.', 'May.', 'Jun.', 'Jul.', 'Ago.', 'Sep.', 'Oct.', 'Nov.', 'Dic.']
  return `${Number(dia)} de ${meses[Number(mes) - 1]} ${anio}`
}
const hoyLima = () =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Lima',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date())

export function ReportIcon({ name }) {
  const paths = {
    production:
      'M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z M12 22V12 M3.29 7 12 12 20.71 7 M7.5 4.27l9 5.15',
    ranking:
      'M12 6V2h-1 M9 21V11a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v10 M9 15a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v5a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1v-3a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1',
    calendar:
      'M8 2v3 M16 2v3 M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2 M3 9h18 M8 13h.01 M12 13h.01 M16 13h.01 M8 17h.01 M12 17h.01 M16 17h.01',
    chevron: 'm6 9 6 6 6-6'
  }
  return (
    <svg
      className="campaign-report-icon"
      aria-hidden="true"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#022F2A"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={paths[name]} />
    </svg>
  )
}

export function ReportesCampania({ servicio, campania, rendimiento = false }) {
  const [loteId, setLote] = useState(''),
    [variedadId, setVariedad] = useState('')
  const [periodo, setPeriodo] = useState({ desde: null, hasta: null })
  const [anterior, setAnterior] = useState(null)
  const tipo = rendimiento ? 'RENDIMIENTO' : 'PRODUCCION'
  const consulta = useCarga(() => {
    if (!servicio) throw new Error('La consulta de reportes no está disponible.')
    return servicio.campania({
      campaniaId: campania.id,
      tipo,
      loteId,
      variedadId,
      ...periodo
    })
  }, [servicio, campania.id, tipo, loteId, variedadId, periodo.desde, periodo.hasta])
  useEffect(() => {
    if (consulta.datos) setAnterior(consulta.datos.datos)
  }, [consulta.datos])
  const datos = consulta.datos?.datos ?? anterior
  const catalogo = datos?.catalogo ?? { lotes: [], variedades: [] }
  const lote = catalogo.lotes.find((l) => l.id === loteId)
  const variedades = catalogo.variedades.filter(
    (v) => !lote || lote.variedades.includes(v.id)
  )
  const titulo = rendimiento ? 'Rendimiento' : 'Producción'
  return (
    <section
      className="campaign-report"
      aria-label={`Reporte de ${titulo.toLocaleLowerCase('es')}`}
    >
      <div className="campaign-report-toolbar">
        <h2>{titulo}</h2>
        <label className="campaign-report-select">
          <span className="sr-only">Lote del reporte</span>
          <Select
            aria-label="Lote del reporte"
            value={loteId}
            disabled={!datos}
            onChange={(e) => {
              setLote(e.target.value)
              setVariedad('')
            }}
          >
            <option value="">Todos los lotes</option>
            {catalogo.lotes.map((l) => (
              <option key={l.id} value={l.id}>
                {l.nombre}
              </option>
            ))}
          </Select>
          <ReportIcon name="chevron" />
        </label>
        <label className="campaign-report-select">
          <span className="sr-only">Variedad del reporte</span>
          <Select
            aria-label="Variedad del reporte"
            value={variedadId}
            disabled={!datos}
            onChange={(e) => setVariedad(e.target.value)}
          >
            <option value="">Todas las variedades</option>
            {variedades.map((v) => (
              <option key={v.id} value={v.id}>
                {v.nombre}
              </option>
            ))}
          </Select>
          <ReportIcon name="chevron" />
        </label>
        <PeriodoFiltro
          key={`${datos?.desde}:${datos?.hasta}`}
          datos={datos}
          rendimiento={rendimiento}
          cambiar={setPeriodo}
        />
      </div>
      <Carga consulta={consulta} skeleton={<CampaignReportSkeleton ranking={rendimiento} />}>
        {(respuesta) => {
          const d = respuesta.datos,
            m = d.metricas
          const tarjetas = rendimiento
            ? [
                ['Cosechadores con registros', m.cosechadoresActivos],
                ['Promedio por cosechador', m.promedioCosechador],
                ['Mayor rendimiento', m.mayorRendimiento],
                ['Total cosechado', m.totalJabas]
              ]
            : [
                ['Total jabas', m.totalJabas],
                ['Jabas hoy', m.jabasHoy],
                ['Promedio diario', m.promedioDiario],
                ['Días de producción', m.diasProduccion]
              ]
          return (
            <>
              <div
                className="campaign-report-metrics"
                aria-label="Indicadores del reporte"
              >
                {tarjetas.map(([label, valor]) => (
                  <article key={label} aria-label={label}>
                    <h3>{label}</h3>
                    <strong>{numero(valor)}</strong>
                  </article>
                ))}
              </div>
              {rendimiento ? (
                <RendimientoCosechadores datos={d} />
              ) : (
                <section
                  className="campaign-report-section"
                  data-report-type="production"
                  aria-label="Evolución de producción"
                >
                  <h3>Evolución</h3>
                  <EvolucionCampania dias={d.evolucion} hoy={d.hoy} />
                </section>
              )}
            </>
          )
        }}
      </Carga>
    </section>
  )
}

function ajustarAnchoPeriodo(elemento) {
  if (!elemento?.open) return
  const inicio = elemento.querySelector('summary').getBoundingClientRect().left
  const disponible = document.documentElement.clientWidth - inicio - 16
  elemento.style.setProperty(
    '--campaign-date-menu-width',
    `${Math.max(0, Math.min(560, disponible))}px`
  )
}

export function PeriodoFiltro({ datos, rendimiento, cambiar, etiqueta = 'Período del reporte' }) {
  const [desde, setDesde] = useState(datos?.desde ?? '')
  const [hasta, setHasta] = useState(datos?.hasta ?? '')
  const ref = useRef(null),
    hoy = datos?.hoy ?? hoyLima()
  useEffect(() => {
    const ajustar = () => ajustarAnchoPeriodo(ref.current)
    window.addEventListener('resize', ajustar)
    return () => window.removeEventListener('resize', ajustar)
  }, [])
  const texto = datos
    ? !datos.desde && !datos.hasta
      ? 'Todas las fechas'
      : datos.desde === hoy && datos.hasta === hoy
      ? 'Hoy'
      : `${fecha(datos.desde)} - ${datos.hasta === hoy ? 'Hoy' : fecha(datos.hasta)}`
    : 'Campaña - Hoy'
  return (
    <details
      className="campaign-report-period"
      ref={ref}
      onToggle={(e) => ajustarAnchoPeriodo(e.currentTarget)}
    >
      <summary aria-label={`${etiqueta}: ${texto}`} title={texto}>
        <ReportIcon name="calendar" />
        <span className="campaign-report-period-label">{texto}</span>
      </summary>
      <form
        className="campaign-report-dates"
        onSubmit={(e) => {
          e.preventDefault()
          if (desde && hasta && desde <= hasta && hasta <= hoy) {
            cambiar({ desde, hasta })
            ref.current.open = false
          }
        }}
      >
        <label>
          Desde
          <span className="campaign-report-date-control">
            <ReportIcon name="calendar" />
            <span aria-hidden="true">{fechaSelector(desde)}</span>
            <input
              aria-label="Desde"
              type="date"
              value={desde}
              max={hasta || hoy}
              required
              onChange={(e) => setDesde(e.target.value)}
              onClick={(e) => e.currentTarget.showPicker?.()}
            />
          </span>
        </label>
        <label>
          Hasta
          <span className="campaign-report-date-control">
            <ReportIcon name="calendar" />
            <span aria-hidden="true">{fechaSelector(hasta)}</span>
            <input
              aria-label="Hasta"
              type="date"
              value={hasta}
              min={desde}
              max={hoy}
              required
              onChange={(e) => setHasta(e.target.value)}
              onClick={(e) => e.currentTarget.showPicker?.()}
            />
          </span>
        </label>
        <button
          type="submit"
          disabled={!desde || !hasta || desde > hasta || hasta > hoy}
        >
          Aplicar
        </button>
        <button
          type="button"
          onClick={() => {
            setDesde(datos?.desde ?? '')
            setHasta(datos?.hasta ?? '')
            cambiar({ desde: null, hasta: null })
            ref.current.open = false
          }}
        >
          Restablecer
        </button>
      </form>
    </details>
  )
}

export function EvolucionCampania({ dias, hoy }) {
  const sinProduccion = !dias.some((d) => d.jabas > 0)
  const maximo = Math.max(
    sinProduccion ? 40 : 20,
    Math.ceil(Math.max(0, ...dias.map((d) => d.jabas)) / 20) * 20
  )
  const saltos = Array.from({ length: 5 }, (_, i) => (maximo * (4 - i)) / 4)
  return (
    <figure className="campaign-evolution">
      <figcaption className="sr-only">
        Jabas cosechadas por día. Hoy se destaca en verde claro.
      </figcaption>
      <div className="campaign-evolution-axis" aria-hidden="true">
        {saltos.map((n) => (
          <span key={n}>{numero(n)}</span>
        ))}
      </div>
      <div
        className="campaign-evolution-scroll"
        tabIndex="0"
        role="region"
        aria-label="Gráfico de producción diaria"
      >
        {sinProduccion ? (
          <div className="campaign-evolution-empty">
            <MensajeRanking>Nadie ha cosechado aún</MensajeRanking>
          </div>
        ) : <ol
          className="campaign-evolution-bars"
          style={{
            gridTemplateColumns: `repeat(${Math.max(1, dias.length)}, minmax(calc(90 * var(--owner-scale)), 1fr))`
          }}
        >
          {dias.map((d) => (
            <li key={d.fecha}>
              <button
                type="button"
                className={d.fecha === hoy ? 'is-today' : ''}
                style={{ height: `${(d.jabas / maximo) * 100}%` }}
                aria-label={`${fecha(d.fecha)}: ${numero(d.jabas)} jabas`}
                title={`${fecha(d.fecha)}: ${numero(d.jabas)} jabas`}
              />
              <time dateTime={d.fecha}>{fecha(d.fecha)}</time>
            </li>
          ))}
        </ol>}
      </div>
    </figure>
  )
}

function MensajeRanking({ children }) {
  return <p className="campaign-report-banner" role="status">{children}</p>
}
