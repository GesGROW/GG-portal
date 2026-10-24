import { useState } from 'react'
import { Select } from './Select.jsx'
import { PeriodoFiltro } from './ReportesCampania.jsx'
import { HomeIcon } from './HomeAssets.jsx'
import './filtros-campania.css'

export const filtrosIniciales = () => ({
  busqueda: '',
  estado: '',
  desde: null,
  hasta: null
})

export function FiltrosCampania({
  filtros,
  cambiar,
  trabajadores = false,
  asignados = false,
  consulta,
  actualizar
}) {
  const [texto, setTexto] = useState(filtros.busqueda)
  const busqueda = trabajadores
    ? 'Buscar por nombre o DNI'
    : asignados
      ? 'Buscar por lote, cosechador o DNI'
      : 'Buscar por lote'
  const fecha = trabajadores
    ? 'Fecha de inicio'
    : asignados
      ? 'Fecha de asignación'
      : 'Fecha de generación'
  const activos = Boolean(
    texto || filtros.busqueda || filtros.estado || filtros.desde || filtros.hasta
  )
  return (
    <>
      <p
        className="campaign-table-total"
        aria-live="polite"
        aria-busy={Boolean(consulta?.cargando)}
      >
        Total:{' '}
        {consulta?.datos
          ? `${new Intl.NumberFormat('es-PE').format(consulta.datos.total)} ${consulta.datos.total === 1 ? 'fila' : 'filas'}`
          : '—'}
      </p>
      <div
        className="campaign-table-filters"
        role="search"
        aria-label="Filtros de la tabla"
      >
        <label className="campaign-table-search">
          <span>
            {trabajadores ? 'Trabajador' : asignados ? 'Lote o cosechador' : 'Lote'}
          </span>
          <input
            type="search"
            aria-label={busqueda}
            placeholder={busqueda}
            maxLength={200}
            value={texto}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                cambiar({ ...filtros, busqueda: texto.trim() })
              }
            }}
            onChange={(e) => {
              setTexto(e.target.value)
              if (!e.target.value) cambiar({ ...filtros, busqueda: '' })
            }}
          />
        </label>
        {(trabajadores || !asignados) && (
          <label className="campaign-table-state">
            <span>{trabajadores ? 'Estado' : 'Asignación'}</span>
            <Select
              aria-label={
                trabajadores ? 'Estado del trabajador' : 'Estado de asignación'
              }
              value={filtros.estado}
              onChange={(e) =>
                cambiar({ ...filtros, busqueda: texto.trim(), estado: e.target.value })
              }
            >
              <option value="">
                {trabajadores ? 'Todos los estados' : 'Todos los lotes'}
              </option>
              <option value={trabajadores ? 'ACTIVO' : 'DISPONIBLE'}>
                {trabajadores ? 'Activos' : 'Sin asignar'}
              </option>
              <option value={trabajadores ? 'INACTIVO' : 'ASIGNADO'}>
                {trabajadores ? 'Inactivos' : 'Asignados'}
              </option>
            </Select>
          </label>
        )}
        <div className="campaign-table-period">
          <span>{fecha}</span>
          <PeriodoFiltro
            key={`${filtros.desde}:${filtros.hasta}`}
            datos={{ desde: filtros.desde, hasta: filtros.hasta }}
            etiqueta={fecha}
            cambiar={(periodo) =>
              cambiar({ ...filtros, ...periodo, busqueda: texto.trim() })
            }
          />
        </div>
        <button
          type="button"
          className="campaign-filter-search-button"
          onClick={() => cambiar({ ...filtros, busqueda: texto.trim() })}
        >
          Buscar
        </button>
        {activos && (
          <button
            type="button"
            className="campaign-filter-clear-button"
            onClick={() => {
              setTexto('')
              cambiar(filtrosIniciales())
            }}
          >
            Limpiar filtros
          </button>
        )}
        <button
          type="button"
          className="campaign-table-refresh"
          aria-label="Actualizar tabla"
          title="Actualizar tabla"
          disabled={Boolean(consulta?.cargando)}
          onClick={actualizar}
        >
          <HomeIcon name="refresh" />
        </button>
      </div>
    </>
  )
}
