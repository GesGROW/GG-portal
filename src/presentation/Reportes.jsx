import { Select } from './Select.jsx'
import { reportePublicado } from './rutasReportesHome.js'
import { useId, useState } from 'react'
import { NavLink, useSearchParams } from 'react-router'
import { useCarga } from './GestionUi.jsx'
import {
  ChartCard,
  DataTable,
  EmptyState,
  Icon,
  ManagementPageHeader,
  Skeleton
} from './Ui.jsx'

const vistas = [
  ['resumen', 'Resumen de campaña', 'RESUMEN'],
  ['ranking', 'Ranking de cosechadores', 'RANKING'],
  ['diaria', 'Producción diaria', 'DIARIA'],
  ['lotes', 'Producción por lote', 'LOTES']
]
export const fecha = (value, soloDia = false) => {
  if (!value) return 'Sin actividad registrada'
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value)
  return new Intl.DateTimeFormat('es-PE', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    ...(!soloDia && !dateOnly ? { hour: '2-digit', minute: '2-digit' } : {}),
    timeZone: dateOnly ? 'UTC' : 'America/Lima'
  }).format(new Date(dateOnly ? value + 'T12:00:00Z' : value))
}
const periodos = { HOY: 'Hoy', SEMANA: 'Semana', MES: 'Mes', CAMPANIA: 'Campaña' }

export function EstadoConsulta({ consulta, children, skeleton = 'report' }) {
  if (consulta.cargando)
    return <Skeleton text="Cargando reportes…" variant={skeleton} />
  if (consulta.error) {
    const e = consulta.error
    const titulo =
      e.name === 'ModuloNoHabilitado'
        ? 'Módulo deshabilitado'
        : e.name === 'AccesoDenegado'
          ? 'Sin permiso'
          : e.name === 'ServicioNoDisponible'
            ? 'Error de conexión'
            : 'No se pudo consultar el reporte'
    return (
      <div role="alert">
        <h2>{titulo}</h2>
        <p>{e.message}</p>
        <button onClick={consulta.refrescar}>Reintentar</button>
      </div>
    )
  }
  return children(consulta.datos)
}

export function Reportes({ servicio, path = '/', dashboard = false }) {
  const [params, setParams] = useSearchParams()
  const campanias = useCarga(() => servicio.campanias(), [servicio])
  const vista = vistas.find(([ruta]) => path.endsWith('/' + ruta)) ?? vistas[0]
  const refrescoVisual = !dashboard && vista[2] !== 'RANKING'
  const seleccion = params.get('campania') ?? ''
  const cambiar = (clave, valor) =>
    setParams(
      (p) => {
        const siguiente = new URLSearchParams(p)
        siguiente.set(clave, valor)
        return siguiente
      },
      { replace: true }
    )
  return (
    <div className={`report-page report-${vista[2].toLowerCase()}`}>
      {refrescoVisual ? (
        <ManagementPageHeader
          eyebrow="Información operativa"
          icon="reports"
          title="Reportes"
          description="Producción consolidada de su empresa. Fechas y horas de Lima."
        />
      ) : (
        <section className="page-heading">
          <span className="eyebrow">Información operativa</span>
          <h1>{dashboard ? 'Bienvenido a GesGROW' : 'Reportes'}</h1>
          <p>
            {dashboard
              ? 'Dashboard de producción por campaña.'
              : 'Producción consolidada de su empresa.'}{' '}
            Fechas y horas de Lima.
          </p>
        </section>
      )}
      {!dashboard && (
        <nav
          className={
            refrescoVisual ? 'settings-tabs report-secondary-nav' : 'settings-tabs'
          }
          aria-label="Reportes disponibles"
        >
          {vistas
            .filter(([ruta]) => reportePublicado('/reportes/' + ruta))
            .map(([ruta, nombre]) => (
              <NavLink
                key={ruta}
                to={
                  '/reportes/' +
                  ruta +
                  (seleccion ? '?campania=' + encodeURIComponent(seleccion) : '')
                }
              >
                {nombre}
              </NavLink>
            ))}
        </nav>
      )}
      <section
        className={`content-card report-surface${refrescoVisual ? ' management-surface-editorial internal-report-surface' : ''}`}
      >
        <EstadoConsulta consulta={campanias}>
          {(lista) => {
            if (!lista.length)
              return (
                <EmptyState>Sin campañas disponibles para esta empresa.</EmptyState>
              )
            const campaniaId =
              seleccion || (lista.find((c) => c.estado === 'ACTIVA') ?? lista[0]).id
            const contexto = (
              <>
                <label>
                  Campaña{' '}
                  <Select
                    value={campaniaId}
                    onChange={(e) => cambiar('campania', e.target.value)}
                  >
                    {!lista.some((c) => c.id === campaniaId) && (
                      <option value={campaniaId}>Selección no autorizada</option>
                    )}
                    {lista.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.codigo} · {c.nombre} ({c.estado})
                      </option>
                    ))}
                  </Select>
                </label>
                <button
                  className="quiet icon-button"
                  title="Actualizar campañas"
                  aria-label="Actualizar campañas"
                  onClick={campanias.refrescar}
                >
                  <Icon name="refresh" />
                </button>
              </>
            )
            return (
              <>
                <div
                  className={
                    refrescoVisual
                      ? 'report-context internal-report-context'
                      : 'report-context'
                  }
                >
                  {contexto}
                </div>
                {!lista.some((c) => c.id === campaniaId) ? (
                  <p role="alert">
                    Campaña ajena o no disponible. Seleccione una campaña de esta
                    empresa.
                  </p>
                ) : (
                  <>
                    {!dashboard && vista[2] === 'RANKING' && (
                      <div className="report-filters">
                        <label>
                          Periodo{' '}
                          <Select
                            value={params.get('periodo') ?? 'CAMPANIA'}
                            onChange={(e) => cambiar('periodo', e.target.value)}
                          >
                            {['HOY', 'SEMANA', 'MES', 'CAMPANIA'].map((p) => (
                              <option key={p} value={p}>
                                {periodos[p]}
                              </option>
                            ))}
                          </Select>
                        </label>
                      </div>
                    )}
                    {!dashboard && ['RANKING', 'LOTES'].includes(vista[2]) && (
                      <div
                        className={
                          refrescoVisual
                            ? 'report-filters management-filterbar'
                            : 'report-filters'
                        }
                      >
                        <label>
                          {vista[2] === 'RANKING'
                            ? 'Buscar por nombre o DNI'
                            : 'Buscar lote o variedad'}
                          <input
                            type="search"
                            value={params.get('buscar') ?? ''}
                            onChange={(e) => cambiar('buscar', e.target.value)}
                          />
                        </label>
                        {vista[2] === 'LOTES' && (
                          <label>
                            Orden{' '}
                            <Select
                              value={params.get('orden') ?? 'mas-jabas'}
                              onChange={(e) => cambiar('orden', e.target.value)}
                            >
                              <option value="mas-jabas">Más jabas</option>
                              <option value="az">Lote A–Z</option>
                            </Select>
                          </label>
                        )}
                      </div>
                    )}
                    <Consulta
                      key={[
                        campaniaId,
                        dashboard,
                        vista[2],
                        params.get('periodo'),
                        params.get('buscar'),
                        params.get('orden')
                      ].join(':')}
                      servicio={servicio}
                      filtros={{
                        campaniaId,
                        tipo: dashboard ? 'DASHBOARD' : vista[2],
                        periodo: params.get('periodo') ?? 'CAMPANIA',
                        busqueda: params.get('buscar') ?? '',
                        orden: params.get('orden') ?? 'mas-jabas'
                      }}
                    />
                  </>
                )}
              </>
            )
          }}
        </EstadoConsulta>
      </section>
    </div>
  )
}

function Consulta({ servicio, filtros }) {
  const consulta = useCarga(() => servicio.consultar(filtros), [servicio]),
    [exportando, setExportando] = useState(false),
    [error, setError] = useState(null)
  async function exportar(datos) {
    setExportando(true)
    setError(null)
    try {
      await servicio.exportar(datos)
    } catch (e) {
      if (e.name !== 'SolicitudObsoleta') setError(e)
    } finally {
      setExportando(false)
    }
  }
  return (
    <section className="report-results">
      <div
        className="report-toolbar"
        role="group"
        aria-label="Contexto de campaña y acciones"
      >
        <div className="report-actions">
          <button
            className="quiet icon-button"
            title="Actualizar datos"
            aria-label="Actualizar datos"
            onClick={consulta.refrescar}
            disabled={consulta.cargando}
          >
            <Icon name="refresh" />
          </button>
          {!consulta.cargando && !consulta.error && consulta.datos && (
            <>
              <p>
                Última actualización:{' '}
                <time dateTime={consulta.datos.actualizadoEn}>
                  {fecha(consulta.datos.actualizadoEn)}
                </time>
              </p>
              <button
                className="secondary"
                disabled={exportando}
                onClick={() => exportar(consulta.datos)}
              >
                <Icon name="download" />
                {exportando ? 'Exportando…' : 'Exportar CSV'}
              </button>
            </>
          )}
        </div>
      </div>
      <div className="report-data">
        <EstadoConsulta consulta={consulta}>
          {(r) => (
            <>
              {error && <p role="alert">{error.message}</p>}
              <Resultado reporte={r} />
              {r.tipo === 'DASHBOARD' && (
                <DashboardCharts
                  servicio={servicio}
                  campaniaId={r.campaniaId}
                  campania={r.datos.campania.nombre}
                />
              )}
              {r.tipo === 'DASHBOARD' && <Actividad datos={r.datos} />}
            </>
          )}
        </EstadoConsulta>
      </div>
    </section>
  )
}

export const numero = (value) =>
  value == null ? '—' : new Intl.NumberFormat('es-PE').format(value)
function Resumen({ datos, dashboard }) {
  const s = datos.resumen
  const metrics = dashboard
    ? [
        ['Total jabas', s.total_jabas, 'jabas · campaña completa'],
        ['Jabas hoy', datos.hoy.total_jabas, 'jabas · hoy, Lima'],
        ['Cosechadores con producción', s.total_cosechadores, 'personas · campaña'],
        ['Sesiones', s.total_sesiones, 'sesiones · campaña']
      ]
    : [
        ['Total jabas', s.total_jabas, 'jabas · campaña completa'],
        ['Cosechadores con producción', s.total_cosechadores, 'personas · campaña'],
        ['Lotes operativos con producción', s.total_lotes, 'lotes · campaña'],
        ['Sesiones', s.total_sesiones, 'sesiones · campaña']
      ]
  return (
    <>
      <div className="section-title report-summary-heading">
        <div>
          {!dashboard && <span className="eyebrow">Visión de la campaña</span>}
          <h2>{dashboard ? 'Dashboard operativo' : 'Resumen de campaña'}</h2>
        </div>
        {!dashboard && <span className="badge">{datos.campania.nombre}</span>}
      </div>
      {s.total_jabas === 0 && (
        <EmptyState>Sin datos de producción en esta campaña.</EmptyState>
      )}
      <dl className="report-metrics">
        {metrics.map(([label, value, unit]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{numero(value)}</dd>
            <span className="metric-unit">{unit}</span>
          </div>
        ))}
      </dl>
      <dl className="report-detail">
        {dashboard && (
          <div>
            <dt>Lotes operativos con producción</dt>
            <dd>{numero(s.total_lotes)}</dd>
          </div>
        )}
        <div>
          <dt>Días con producción</dt>
          <dd>{numero(s.dias_con_produccion)}</dd>
        </div>
        {!dashboard && (
          <div>
            <dt>Última actividad</dt>
            <dd>{fecha(s.ultima_lectura)}</dd>
          </div>
        )}
      </dl>
    </>
  )
}
function Actividad({ datos }) {
  return (
    <section className="base-note">
      <h2>
        <Icon name="clock" /> Última actividad
      </h2>
      <p>{fecha(datos.resumen.ultima_lectura)}</p>
      <p>Actividad de producción de {datos.campania.nombre}.</p>
    </section>
  )
}
function DashboardCharts({ servicio, campaniaId, campania }) {
  return (
    <>
      <DashboardPanel
        servicio={servicio}
        campaniaId={campaniaId}
        tipo="DIARIA"
        titulo="Producción diaria"
        campania={campania}
      />
      <div className="dashboard-comparisons">
        <DashboardPanel
          servicio={servicio}
          campaniaId={campaniaId}
          tipo="RANKING"
          titulo="Ranking de cosechadores"
          campania={campania}
        />
        <DashboardPanel
          servicio={servicio}
          campaniaId={campaniaId}
          tipo="LOTES"
          titulo="Producción por lote operativo"
          campania={campania}
        />
      </div>
    </>
  )
}
function DashboardPanel({ servicio, campaniaId, tipo, titulo, campania }) {
  // Mismos reportes autorizados que el detalle; sin agregaciones de dominio.
  const consulta = useCarga(
    () =>
      servicio.consultar({
        campaniaId,
        tipo,
        periodo: 'CAMPANIA',
        busqueda: '',
        orden: 'mas-jabas'
      }),
    [servicio, campaniaId, tipo]
  )
  return (
    <ChartCard title={titulo} context={`${campania} · Campaña completa`}>
      <EstadoConsulta consulta={consulta}>
        {(r) => <Resultado reporte={r} embedded />}
      </EstadoConsulta>
    </ChartCard>
  )
}
export function Resultado({ reporte: { tipo, datos }, embedded = false }) {
  if (tipo === 'RESUMEN' || tipo === 'DASHBOARD')
    return <Resumen datos={datos} dashboard={tipo === 'DASHBOARD'} />
  const filas = tipo === 'RANKING' ? datos.ranking : datos.produccion
  if (!filas.length)
    return <EmptyState>Sin datos para los filtros seleccionados.</EmptyState>
  if (tipo === 'RANKING')
    return (
      <>
        {!embedded && <h2>Ranking de cosechadores</h2>}
        {!embedded && (
          <p className="report-period">
            Periodo: {periodos[datos.periodo] ?? datos.periodo}
          </p>
        )}
        <BarrasHorizontales filas={filas} tipo="RANKING" />
        <Tabla
          titulo="Ranking de cosechadores"
          columnas={['Posición', 'DNI', 'Cosechador', 'Jabas', 'Última actividad']}
          filas={filas.map((f) => [
            f.posicion,
            f.cosechador_dni,
            f.cosechador,
            f.total_jabas,
            fecha(f.ultima_lectura)
          ])}
        />
      </>
    )
  if (tipo === 'DIARIA')
    return (
      <>
        {!embedded && <h2>Producción diaria</h2>}
        <GraficaDiaria filas={filas} interactive={embedded} />
        <Tabla
          titulo="Producción diaria"
          columnas={['Fecha', 'Jabas', 'Cosechadores', 'Sesiones']}
          filas={filas.map((f) => [
            fecha(f.fecha, true),
            f.total_jabas,
            f.total_cosechadores,
            f.total_sesiones
          ])}
        />
      </>
    )
  return (
    <>
      {!embedded && <h2>Producción por lote operativo</h2>}
      <BarrasHorizontales filas={filas} tipo="LOTES" />
      <TablaLotes filas={filas} />
    </>
  )
}
function TablaLotes({ filas }) {
  return (
    <DataTable
      label="Producción por lote y variedad"
      tableClassName="lot-table"
      caption="Producción por lote y variedad"
      rowKey={(_, index) => index}
      data={filas}
      columns={[
        {
          key: 'lote_codigo',
          header: 'Lote',
          render: (f) => (
            <>
              <strong>{f.lote_codigo}</strong>
              <small>{f.lote_nombre}</small>
            </>
          )
        },
        { key: 'variedad', header: 'Variedad' },
        {
          key: 'total_jabas',
          header: 'Jabas',
          className: 'numeric',
          render: (f) => numero(f.total_jabas)
        }
      ]}
      actionsHeader="Detalle"
      actions={(f) => (
        <details className="lot-detail">
          <summary
            aria-label={`Ver detalle de ${f.lote_codigo} · ${f.variedad ?? 'Sin variedad'}`}
          >
            Ver detalle
          </summary>
          <dl>
            <dt>Cosechadores</dt>
            <dd>{numero(f.total_cosechadores)}</dd>
            <dt>Sesiones</dt>
            <dd>{numero(f.total_sesiones)}</dd>
            <dt>Última actividad</dt>
            <dd>{fecha(f.ultima_lectura)}</dd>
          </dl>
        </details>
      )}
    />
  )
}
function Tabla({ titulo, columnas, filas }) {
  return (
    <DataTable
      label={titulo}
      caption={titulo}
      rowKey={(_, index) => index}
      data={filas}
      columns={columnas.map((header, index) => ({
        key: index,
        header,
        cellProps: (f) => ({
          className: typeof f[index] === 'number' ? 'numeric' : undefined
        }),
        render: (f) =>
          typeof f[index] === 'number' ? numero(f[index]) : (f[index] ?? '—')
      }))}
    />
  )
}
function BarrasHorizontales({ filas, tipo }) {
  const maximo = Math.max(1, ...filas.map((f) => f.total_jabas ?? 0))
  return (
    <div
      className="bar-list"
      aria-label={
        tipo === 'RANKING'
          ? 'Comparación de producción por cosechador'
          : 'Comparación de producción por lote'
      }
    >
      {filas.map((f, i) => {
        const label =
          tipo === 'RANKING'
            ? `${f.posicion}. ${f.cosechador}`
            : `${f.lote_codigo} · ${f.lote_nombre} · ${f.variedad}`
        return (
          <div className="bar-row" key={i}>
            <div className="bar-label">
              <span>{label}</span>
              <strong>{numero(f.total_jabas)} jabas</strong>
            </div>
            <div className="bar-track" aria-hidden="true">
              <span
                className="bar-fill"
                style={{ width: `${((f.total_jabas ?? 0) / maximo) * 100}%` }}
              />
            </div>
          </div>
        )
      })}
      <div className="chart-scale">
        <span>0 jabas</span>
        <span>{numero(maximo)} jabas</span>
      </div>
    </div>
  )
}
function GraficaDiaria({ filas, interactive = false }) {
  const id = useId()
  // Escala exclusivamente visual. Orden cronológico sin alterar filas ni cálculos.
  const maximo = Math.max(1, ...filas.map((f) => f.total_jabas ?? 0))
  const cronologicas = [...filas].sort((a, b) => a.fecha.localeCompare(b.fecha))
  const tieneComparacion = cronologicas.filter((f) => f.total_jabas != null).length > 1
  return (
    <figure className="daily-chart">
      <figcaption className="sr-only">Producción diaria en jabas</figcaption>
      <div
        className={`daily-plot ${cronologicas.length <= 3 ? 'is-sparse' : ''}`}
        role={interactive ? 'group' : 'img'}
        aria-label="Gráfica de producción diaria; datos en la tabla Producción diaria"
      >
        {cronologicas.map((f) => (
          <div
            className={`daily-column ${tieneComparacion && f.fecha === cronologicas.at(-1).fecha && f.total_jabas != null ? 'is-recent' : ''}`}
            key={f.fecha}
            tabIndex={interactive ? 0 : undefined}
            role={interactive ? 'group' : undefined}
            aria-label={
              interactive
                ? `${fecha(f.fecha, true)}: ${numero(f.total_jabas)} jabas`
                : undefined
            }
            aria-describedby={interactive ? `${id}-${f.fecha}` : undefined}
          >
            {interactive && (
              <span className="chart-tooltip" role="tooltip" id={`${id}-${f.fecha}`}>
                {fecha(f.fecha, true)} · {numero(f.total_jabas)} jabas ·{' '}
                {numero(f.total_cosechadores)} cosechadores · {numero(f.total_sesiones)}{' '}
                sesiones
              </span>
            )}
            <span className="daily-value">{numero(f.total_jabas)} jabas</span>
            <div className="daily-track" aria-hidden="true">
              <span
                className="daily-fill"
                style={{ height: `${((f.total_jabas ?? 0) / maximo) * 100}%` }}
              />
            </div>
            <span>{fecha(f.fecha, true)}</span>
          </div>
        ))}
      </div>
      <div className="chart-scale">
        <span>0 jabas</span>
        <span>{numero(maximo)} jabas</span>
      </div>
      <div className="sr-only">
        {filas
          .filter((f) => f.total_jabas != null)
          .map((f) => (
            <meter
              key={f.fecha}
              min="0"
              max={maximo}
              value={f.total_jabas}
              aria-label={fecha(f.fecha, true) + ': ' + f.total_jabas + ' jabas'}
            />
          ))}
      </div>
    </figure>
  )
}
