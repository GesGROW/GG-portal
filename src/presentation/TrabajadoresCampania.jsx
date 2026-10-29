import { useState } from 'react'
import { DataTable } from './DataTable.jsx'
import { SkeletonTable } from './Skeleton.jsx'
import { Carga } from './GestionUi.jsx'
import { usePaginaCampania } from './usePaginaCampania.js'
import { CampaignTableEmpty } from './CampaignTableEmpty.jsx'
import { FiltrosCampania, filtrosIniciales } from './FiltrosCampania.jsx'
import { fechaLote } from './LotesCampania.jsx'
import { TrabajadorCampaniaPanel } from './TrabajadorCampaniaPanel.jsx'
import './trabajadores-campania.css'

export const SECCIONES_TRABAJADORES = Object.freeze([
  { id: 'cosechadores', label: 'Cosechadores', rol: 'COSECHADOR', icon: 'avocado' },
  { id: 'jaberos', label: 'Jaberos', rol: 'JABERO', icon: 'package' },
  { id: 'supervisores', label: 'Supervisores', rol: 'SUPERVISORA', icon: 'eye' }
])

export function IconoTrabajador({ tipo }) {
  return (
    <div className="campaign-worker-icons" aria-hidden="true">
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#000"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="8" r="5" />
        <path d="M20 21a8 8 0 0 0-16 0" />
      </svg>
      <svg
        className="campaign-worker-role-icon"
        width="15"
        height="15"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#000"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {tipo === 'avocado' && (
          <>
            <path d="M13.465 3.464a5 5 0 017.07 0 5 5 0 010 7.072c-1.204 1.203-2.38 2.89-2.614 4.577A8 8 0 118.886 6.08c1.687-.235 3.375-1.41 4.579-2.615" />
            <circle cx="10" cy="14" r="3" />
          </>
        )}
        {tipo === 'package' && (
          <>
            <path d="M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z" />
            <path d="M12 22V12" />
            <polyline points="3.29 7 12 12 20.71 7" />
            <path d="m7.5 4.27 9 5.15" />
          </>
        )}
        {tipo === 'eye' && (
          <>
            <path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0" />
            <circle cx="12" cy="12" r="3" />
          </>
        )}
      </svg>
    </div>
  )
}

export function TrabajadoresCampania({
  servicio,
  campania,
  seccion,
  puedeEditar = false
}) {
  const [filtros, setFiltros] = useState(filtrosIniciales)
  const [seleccionado, setSeleccionado] = useState(null)
  const conFicha = ['COSECHADOR', 'JABERO'].includes(seccion.rol)
  const { consulta, filas, paginacion, reiniciar, refrescar } = usePaginaCampania(
    (offset) =>
      servicio.trabajadoresCampania(campania.id, seccion.rol, offset, filtros),
    [servicio, campania.id, seccion.rol, filtros]
  )
  const columnas = [
    { key: 'dni', header: 'DNI', width: '12.1%', render: (t) => t.dni || '—' },
    { key: 'nombre', header: 'Nombre', width: '33%' },
    {
      key: 'activo',
      header: 'Estado',
      width: '23.5%',
      render: (t) => (
        <span
          className={`campaign-worker-state ${t.activo ? 'is-active' : 'is-inactive'}`}
        >
          {t.activo ? 'Activo' : 'Inactivo'}
        </span>
      )
    },
    {
      key: 'iniciadoEn',
      header: 'Fecha y hora de inicio',
      width: '31.4%',
      render: (t) => {
        const fecha = fechaLote(t.iniciadoEn)
        return fecha === 'Sin fecha registrada' ? (
          fecha
        ) : (
          <time dateTime={t.iniciadoEn}>{fecha}</time>
        )
      }
    }
  ]
  return (
    <section className="campaign-workers" aria-label={seccion.label}>
      <FiltrosCampania
        filtros={filtros}
        trabajadores
        consulta={consulta}
        actualizar={() => {
          setSeleccionado(null)
          refrescar()
        }}
        cambiar={(valor) => {
          setFiltros(valor)
          setSeleccionado(null)
          reiniciar()
        }}
      />
      <Carga
        consulta={consulta}
        skeleton={
          <SkeletonTable
            columns={columnas}
            tableClassName="campaign-workers-table"
            rows={paginacion.pageSize}
            reserveRows={paginacion.pageSize}
            pagination
          />
        }
      >
        {() => (
          <>
            <DataTable
              label={seccion.label}
              tableClassName="campaign-workers-table"
              columns={columnas}
              data={filas}
              reserveRows={paginacion.pageSize}
              onRowActivate={conFicha ? setSeleccionado : undefined}
              rowClassName={(t) => (t.id === seleccionado?.id ? 'is-selected' : '')}
              emptyState={
                <CampaignTableEmpty>
                  {filtros.busqueda || filtros.estado || filtros.desde || filtros.hasta
                    ? 'No hay trabajadores para los filtros seleccionados'
                    : `No hay ${seccion.label.toLocaleLowerCase('es')}`}
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
        <TrabajadorCampaniaPanel
          servicio={servicio}
          campania={campania}
          seccion={seccion}
          seleccionado={seleccionado}
          puedeEditar={puedeEditar}
          onClose={() => setSeleccionado(null)}
          onSaved={(r) => {
            setSeleccionado((t) => ({
              ...t,
              nombre: [r.nombres, r.apellidos].filter(Boolean).join(' '),
              dni: r.dni,
              activo: r.activo && r.trabajadorActivo
            }))
            refrescar()
          }}
        />
      )}
    </section>
  )
}
