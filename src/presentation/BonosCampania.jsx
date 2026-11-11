import { useEffect, useState } from 'react'
import { Carga, useCarga } from './GestionUi.jsx'
import { CampaignReportSkeleton } from './CampaignSkeleton.jsx'
import { PeriodoFiltro, ReportIcon } from './ReportesCampania.jsx'
import { Select } from './Select.jsx'
import { DataTable } from './DataTable.jsx'
import { CampaignTableEmpty } from './CampaignTableEmpty.jsx'
import { GraficoBonosDia } from './GraficoBonosDia.jsx'
import { semanaTareo } from '../application/tareo.js'
import { TareoExportacion } from './TareoExportacion.jsx'
import './reportes-campania.css'
import './bonos-campania.css'

const soles = (n) => new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' }).format(n)
const kilos = (r) => r.kgEstimados == null ? 'N/A' : `${new Intl.NumberFormat('es-PE', { maximumFractionDigits: 1 }).format(r.kgEstimados)}${r.lecturasSinPeso ? ' (parcial)' : ''}`
const columnasRecipientes = [
  { key: 'jabas', header: 'Jabas' }, { key: 'jarras', header: 'Jarras', render: r => r.jarras ?? 0 },
  { key: 'kgEstimados', header: 'Kg estimados', render: kilos },
  { key: 'adicionales', header: 'Jabas adicionales' },
  { key: 'adicionalesJarras', header: 'Jarras adicionales', render: r => r.adicionalesJarras ?? 0 },
  { key: 'bonoJabas', header: 'Bono de jabas', render: r => soles(r.bonoJabas ?? r.bono) },
  { key: 'bonoJarras', header: 'Bono de jarras', render: r => soles(r.bonoJarras ?? 0) },
  { key: 'bono', header: 'Bono total', render: r => soles(r.bono) }
]
const persona = { key: 'nombre', header: 'Cosechador', width: '300px', render: (r) => <span className="rendimiento-persona">
  <span className="rendimiento-persona-nombre" title={r.nombre}>{r.nombre}</span><small>DNI {r.dni}</small></span> }
export function BonosCampania({ servicio, campania }) {
  const [periodo, setPeriodo] = useState({ desde: null, hasta: null }),
    [trabajadorId, setTrabajador] = useState(''), [catalogo, setCatalogo] = useState([])
  const consulta = useCarga(async () => {
    if (!servicio) throw new Error('La consulta de bonos no está disponible.')
    return servicio.bonos({ campaniaId: campania.id, ...periodo, trabajadorId })
  }, [servicio, campania.id, periodo.desde, periodo.hasta, trabajadorId])
  useEffect(() => {
    if (consulta.datos && !trabajadorId) setCatalogo(consulta.datos.datos.resumen)
  }, [consulta.datos, trabajadorId])
  const datos = consulta.datos?.datos
  const formatoFecha = f => f.split('-').reverse().join('/')
  const periodoDescarga = datos?.desde && datos?.hasta
    ? `${formatoFecha(semanaTareo(datos.desde).desde)} al ${formatoFecha(semanaTareo(datos.hasta).hasta)}` : null
  return <section className="campaign-report campaign-bonus-report" aria-label="Reporte de bonos">
    <div className="campaign-report-toolbar">
      <h2>Bonos</h2>
      <label className="campaign-report-select"><span className="sr-only">Cosechador del reporte</span>
        <Select aria-label="Cosechador del reporte" value={trabajadorId} onChange={(e) => setTrabajador(e.target.value)}>
          <option value="">Todos los cosechadores</option>
          {catalogo.map((p) => <option key={p.trabajadorId} value={p.trabajadorId}>{p.nombre} · {p.dni}</option>)}
        </Select><ReportIcon name="chevron" />
      </label>
      <PeriodoFiltro key={`${datos?.desde}:${datos?.hasta}`} datos={datos} cambiar={setPeriodo} />
        {datos && !consulta.cargando && servicio.descargarTareo && <TareoExportacion key={`${campania.id}:${trabajadorId}:${datos.desde}:${datos.hasta}`} servicio={servicio} campaniaId={campania.id} trabajadorId={trabajadorId} desde={datos.desde} hasta={datos.hasta} />}
    </div>
    <p className="bonos-exportacion-periodo">{periodoDescarga && <>Descarga: {periodoDescarga}. </>}El reporte incluye semanas completas de jueves a miércoles. Los días sin datos aparecen en 0.</p>
    <Carga consulta={consulta} skeleton={<CampaignReportSkeleton ranking />}>
      {(r) => <>

        <div className="campaign-report-metrics" aria-label="Indicadores de bonos">
          <article><h3>Bono total generado</h3><strong>{soles(r.datos.totalBono)}</strong></article>
          <article><h3>Jabas adicionales</h3><strong>{r.datos.totalAdicionales}</strong></article>
          <article><h3>Jarras adicionales</h3><strong>{r.datos.totalAdicionalesJarras ?? 0}</strong></article>
          <article><h3>Kg estimados{r.datos.totalKgEstimados != null && r.datos.lecturasSinPeso > 0 ? ' (parcial)' : ''}</h3><strong>{r.datos.totalKgEstimados == null ? (r.datos.detalle.length === 0 ? '0' : 'N/A') : new Intl.NumberFormat('es-PE', { maximumFractionDigits: 1 }).format(r.datos.totalKgEstimados)}</strong></article>
        </div>
        <section className="rendimiento-ranking" aria-label="Totales por cosechador">
          <div className="rendimiento-section-heading"><h3>Totales por cosechador</h3></div>
          <DataTable label="Totales de bonos por cosechador" pageSize={10} tableClassName="campaign-bonos-summary" data={r.datos.resumen} rowKey="trabajadorId"
            emptyState={<CampaignTableEmpty>No hay registros de cosecha en este período.</CampaignTableEmpty>}
            columns={[persona, ...columnasRecipientes]} />
        </section>
        <section className="rendimiento-ranking" aria-label="Detalle diario de bonos">
          <div className="rendimiento-section-heading"><h3>Detalle diario</h3></div>
          <GraficoBonosDia datos={r.datos} />
          <DataTable label="Detalle diario de bonos" pageSize={10} tableClassName="campaign-bonos-detail" data={r.datos.detalle} rowKey={(p) => `${p.trabajadorId}:${p.fecha}`}
            emptyState={<CampaignTableEmpty>No hay registros de cosecha en este período.</CampaignTableEmpty>}
            columns={[{ key: 'fecha', header: 'Fecha', render: p => p.fecha.split('-').reverse().join('/') }, persona,
              ...columnasRecipientes]} />
        </section>
      </>}
    </Carga>
  </section>
}
