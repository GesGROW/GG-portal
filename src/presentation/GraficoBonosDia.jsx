import { useEffect, useId, useRef, useState } from 'react'
import { CampaignTableEmpty } from './CampaignTableEmpty.jsx'

const soles = (n) => new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' }).format(n)
const fechaVisible = (d) => d.split('-').reverse().join('/')

export function GraficoBonosDia({ datos }) {
  const [elegida, setElegida] = useState('')
  const dia = elegida >= datos.desde && elegida <= datos.hasta ? elegida : datos.hasta
  const filas = datos.detalle.filter(r => r.fecha === dia).sort((a, b) =>
    b.jabas - a.jabas || a.nombre.localeCompare(b.nombre, 'es') || a.trabajadorId.localeCompare(b.trabajadorId))
  return <section className="bonos-dia" aria-label="Jabas por cosechador del día">
    <div className="rendimiento-section-heading">
      <h4>Jabas por cosechador</h4>
      <label className="bonos-dia-selector">Día
        <input type="date" aria-label="Día del gráfico de bonos" min={datos.desde} max={datos.hasta}
          value={dia} onChange={e => setElegida(e.target.value)} />
      </label>
    </div>
    {filas.length ? <BarrasBonos key={dia} filas={filas} dia={dia} />
      : <CampaignTableEmpty>No hay registros de cosecha el {fechaVisible(dia)}.</CampaignTableEmpty>}
  </section>
}

function BarrasBonos({ filas, dia }) {
  const contenedor = useRef(null)
  const [disponible, setDisponible] = useState(680)
  useEffect(() => {
    const medir = () => setDisponible(contenedor.current?.clientWidth ?? 680)
    medir()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(medir)
    observer.observe(contenedor.current)
    return () => observer.disconnect()
  }, [])
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, '')
  const [seleccion, setSeleccion] = useState(filas[0].trabajadorId)
  const actual = filas.find(r => r.trabajadorId === seleccion) ?? filas[0]
  const regla = filas.find(r => r.habilitado)
  const umbral = regla?.umbral
  const maximo = Math.max(1, ...filas.map(r => r.jabas), umbral ?? 0)
  const paso = Math.max(1, Math.ceil(maximo / 5))
  const techo = paso * 6
  const ancho = Math.max(680, disponible, filas.length * 116 + 92)
  const izquierda = 52, derecha = ancho - 22, base = 272, alto = 230
  const y = valor => base - valor / techo * alto
  const espacio = (derecha - izquierda) / filas.length
  const barra = Math.min(60, espacio * 0.52)
  return <>
    <div className="bonos-dia-legend" aria-label="Leyenda del gráfico">
      <span><i className="bonos-dia-base" aria-hidden="true" />{regla ? 'Jabas hasta el umbral' : 'Jabas recolectadas'}</span>
      {regla && <><span><i className="bonos-dia-extra" aria-hidden="true" />Jabas con bono</span>
        <span><i className="bonos-dia-umbral" aria-hidden="true" />Umbral: {umbral} jabas</span></>}
      {!regla && <span>Bono no habilitado ese día</span>}
    </div>
    <div className="rendimiento-chart bonos-dia-chart">
      <div ref={contenedor} className="bonos-dia-scroll" role="region" aria-label={`Gráfico de jabas del ${fechaVisible(dia)}`} tabIndex={0}>
        <svg width={ancho} height="362" viewBox={`0 0 ${ancho} 362`} aria-label="Jabas diarias por cosechador">
          <defs><pattern id={`bonos-rayado-${id}`} patternUnits="userSpaceOnUse" width="7" height="7">
            <rect width="7" height="7" fill="#e5efdf" />
            <path d="M-2 2 2-2 M0 7 7 0 M5 9 9 5" fill="none" stroke="#137d15" strokeWidth="1.3" />
          </pattern></defs>
          <text x="8" y="18" className="bonos-dia-axis-label">Jabas</text>
          {Array.from({ length: 7 }, (_, i) => i * paso).map(v => <g key={v} aria-hidden="true">
            <line x1={izquierda} x2={derecha} y1={y(v)} y2={y(v)} className="rendimiento-gridline" />
            <text x={izquierda - 10} y={y(v) + 4} textAnchor="end">{v}</text>
          </g>)}
          {filas.map((r, i) => {
            const centro = izquierda + espacio * (i + 0.5)
            const adicionales = r.habilitado ? r.adicionales : 0
            const normales = r.jabas - adicionales
            const nombre = r.nombre.length > 15 ? r.nombre.slice(0, 14) + '…' : r.nombre
            const descripcion = `${r.nombre}, DNI ${r.dni}. ${r.jabas} jabas, ${adicionales} adicionales. Bono ${soles(r.bono)}.`
            return <g key={r.trabajadorId} role="button" tabIndex={0} aria-label={descripcion}
              aria-pressed={actual.trabajadorId === r.trabajadorId} className="bonos-dia-bar"
              onMouseEnter={() => setSeleccion(r.trabajadorId)} onFocus={() => setSeleccion(r.trabajadorId)}
              onClick={() => setSeleccion(r.trabajadorId)} onKeyDown={e => {
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSeleccion(r.trabajadorId) }
              }}>
              <title>{descripcion}</title>
              <rect className="bonos-dia-target" x={centro - espacio / 2 + 4} y="28" width={espacio - 8} height="320" rx="8" />
              <rect x={centro - barra / 2} y={y(normales)} width={barra} height={base - y(normales)} fill={`url(#bonos-rayado-${id})`} />
              {adicionales > 0 && <rect className="bonos-dia-exceso" x={centro - barra / 2} y={y(r.jabas)}
                width={barra} height={y(normales) - y(r.jabas)} fill="#c59a32" />}
              <text x={centro} y={y(r.jabas) - 9} textAnchor="middle" className="bonos-dia-value">{r.jabas}</text>
              <text x={centro} y="300" textAnchor="middle"><title>{r.nombre}</title>{nombre}</text>
              <text x={centro} y="320" textAnchor="middle">DNI {r.dni}</text>
            </g>
          })}
          {regla && <g aria-label={`Umbral diario: ${umbral} jabas`} className="bonos-dia-threshold">
            <line x1={izquierda} x2={derecha} y1={y(umbral)} y2={y(umbral)} />
            <text x={derecha} y={y(umbral) - 8} textAnchor="end">Umbral: {umbral}</text>
          </g>}
          <text x={(izquierda + derecha) / 2} y="350" textAnchor="middle" className="bonos-dia-axis-label">Cosechadores</text>
        </svg>
      </div>
      <p className="bonos-dia-selection" aria-live="polite" aria-atomic="true">
        <strong>{actual.nombre}</strong><span>DNI {actual.dni}</span><span>{actual.jabas} jabas</span>
        <span>{actual.adicionales} adicionales</span><strong>Bono: {soles(actual.bono)}</strong>
      </p>
    </div>
  </>
}
