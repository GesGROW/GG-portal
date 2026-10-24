import { useState } from 'react'
import { DataTable } from './DataTable.jsx'
import { Carga } from './GestionUi.jsx'
import { usePaginaCampania } from './usePaginaCampania.js'
import { CampaignTableEmpty } from './CampaignTableEmpty.jsx'
import { FiltrosCampania, filtrosIniciales } from './FiltrosCampania.jsx'
import './lotes-campania.css'

export function fechaLote(valor) {
  if (!valor || !Number.isFinite(new Date(valor).getTime()))
    return 'Sin fecha registrada'
  const partes = new Intl.DateTimeFormat('es-PE', {
    timeZone: 'America/Lima',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  }).formatToParts(new Date(valor))
  const p = (tipo) => partes.find((x) => x.type === tipo)?.value ?? ''
  const mes = p('month')
  return `${p('day')} de ${mes.charAt(0).toUpperCase() + mes.slice(1)} ${p('year')}, ${p('hour')}:${p('minute')} ${p('dayPeriod').replace(/\s/g, '')}`
}

export function LotesCampania({ servicio, campania, asignados = false }) {
  const [seleccionado, setSeleccionado] = useState(null)
  const [filtros, setFiltros] = useState(filtrosIniciales)
  const tipo = asignados ? 'asignaciones' : 'lotes'
  const titulo = asignados ? 'Lotes de tickets asignados' : 'Lotes de tickets generados'
  const { consulta, filas, paginacion, reiniciar, refrescar } = usePaginaCampania(
    (offset) => servicio.listar(tipo, { campaniaId: campania.id, offset, ...filtros }),
    [servicio, campania.id, tipo, filtros]
  )
  const columnas = [
    {
      key: 'id',
      header: 'Lote',
      width: asignados ? '25%' : '32%',
      render: (l) => l.codigo ?? l.id
    },
    asignados
      ? {
          key: 'trabajador',
          header: 'Cosechador',
          width: '32%',
          render: (l) =>
            l.trabajador?.nombre ?? l.asignacion?.trabajador?.nombre ?? 'Sin cosechador'
        }
      : {
          key: 'tickets',
          header: 'Tickets',
          width: '35%',
          render: (l) => (
            <button
              type="button"
              className="lot-tickets-button"
              aria-label={`Tickets del lote ${l.codigo ?? l.id}`}
              aria-pressed={seleccionado === l.id}
              onClick={() => setSeleccionado(l.id)}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#000000"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="1" />
                <circle cx="19" cy="12" r="1" />
                <circle cx="5" cy="12" r="1" />
              </svg>
            </button>
          )
        },
    {
      key: 'fecha',
      header: asignados ? 'Fecha y hora de asignación' : 'Fecha y hora',
      width: asignados ? '43%' : '33%',
      render: (l) => {
        const valor = asignados ? l.asignadoEn : l.creadoEn
        const fecha = fechaLote(valor)
        return fecha === 'Sin fecha registrada' ? (
          fecha
        ) : (
          <time dateTime={valor}>{fecha}</time>
        )
      }
    }
  ]
  return (
    <section className="campaign-lots" aria-label={titulo}>
      <FiltrosCampania
        filtros={filtros}
        asignados={asignados}
        consulta={consulta}
        actualizar={() => {
          setSeleccionado(null)
          refrescar()
        }}
        cambiar={(valor) => {
          setFiltros(valor)
          reiniciar()
          setSeleccionado(null)
        }}
      />
      <Carga consulta={consulta}>
        {() => (
          <>
            <DataTable
              label={titulo}
              tableClassName={`campaign-lots-table ${asignados ? 'campaign-assigned-table' : ''}`}
              columns={columnas}
              data={filas}
              emptyState={
                <CampaignTableEmpty>
                  {filtros.busqueda || filtros.estado || filtros.desde || filtros.hasta
                    ? 'No hay lotes para los filtros seleccionados'
                    : asignados
                      ? 'No hay lotes de tickets asignados'
                      : 'No hay lotes de tickets generados'}
                </CampaignTableEmpty>
              }
              pagination={{
                ...paginacion,
                onPageChange: (pagina) => {
                  setSeleccionado(null)
                  paginacion.onPageChange(pagina)
                }
              }}
            />
          </>
        )}
      </Carga>
      {seleccionado && (
        <span className="sr-only" role="status">
          Lote {seleccionado} seleccionado.
        </span>
      )}
    </section>
  )
}
