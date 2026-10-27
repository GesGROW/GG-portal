import { GeneracionCampania } from './GeneracionCampania.jsx'
export { GeneracionCampania } from './GeneracionCampania.jsx'
import { lazy, Suspense, useEffect } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router'
import { useCarga, Carga } from './GestionUi.jsx'
import { CosechaSelector } from './CosechaSelector.jsx'
import { ReportesCampania, ReportIcon } from './ReportesCampania.jsx'
import { TicketsCosecha } from './TicketsCosecha.jsx'
import { LotesCampania } from './LotesCampania.jsx'
import {
  TrabajadoresCampania,
  IconoTrabajador,
  SECCIONES_TRABAJADORES
} from './TrabajadoresCampania.jsx'
import './campania-cosecha.css'
import { PdaIcon } from './PdaIcon.jsx'
const AppCosecha = lazy(() =>
  import('./AppCosecha.jsx').then((m) => ({ default: m.AppCosecha }))
)

export function CampaignIcon({ name }) {
  const paths = {
    tickets:
      'M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z M13 5v2 M13 17v2 M13 11v2',
    workers:
      'M17 21a5 5 0 00-10 0 M22 10.5a3.5 3.5 0 00-5.507-2.868 M7.507 7.632A3.5 3.5 0 002 10.5',
    reports: 'M3 3v16a2 2 0 0 0 2 2h16 M18 17V9 M13 17V5 M8 17v-3',
    generation:
      'M12 16h.01 M16 16h.01 M3 19a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8.5a.5.5 0 0 0-.769-.422l-4.462 2.844A.5.5 0 0 1 15 10.5v-2a.5.5 0 0 0-.769-.422L9.77 10.922A.5.5 0 0 1 9 10.5V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2z M8 16h.01',
    lots: 'M7.5 3v18 M12 3v18 M16.5 3v18',
    assignments:
      'M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z M14 2v5a1 1 0 0 0 1 1h5 M16 22a4 4 0 0 0-8 0'
  }
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#022F2A"
      strokeWidth={2}
      width={['tickets', 'workers', 'reports'].includes(name) ? 35 : 24}
      height={['tickets', 'workers', 'reports'].includes(name) ? 35 : 24}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={paths[name]} />
      {name === 'workers' && (
        <>
          <circle cx="12" cy="13" r="3" />
          <circle cx="18.5" cy="4.5" r="2.5" />
          <circle cx="5.5" cy="4.5" r="2.5" />
        </>
      )}
      {name === 'lots' && <rect width="18" height="18" x="3" y="3" rx="2" />}
      {name === 'assignments' && <circle cx="12" cy="15" r="3" />}
    </svg>
  )
}

export function CampaniaCosecha({
  servicio,
  appCosecha,
  reportes,
  contexto,
  seccion,
  pendiente,
  puedeTrabajadores
}) {
  const [params, setParams] = useSearchParams()
  const esApp = ['app', 'dispositivos'].includes(seccion)
  const consultaCampanias =
    contexto.permite('harvest.view') || contexto.permite('harvest.manage')
  const catalogo = useCarga(
    () => (consultaCampanias ? servicio.campanias() : []),
    [servicio, consultaCampanias]
  )
  const campania =
    params.get('campania') ||
    (catalogo.datos?.find((c) => c.estado === 'ACTIVA') ?? catalogo.datos?.[0])?.id ||
    ''
  useEffect(() => {
    if (
      pendiente ||
      esApp ||
      catalogo.cargando ||
      catalogo.error ||
      !campania ||
      params.get('campania')
    )
      return
    const siguientes = new URLSearchParams(params)
    siguientes.set('campania', campania)
    setParams(siguientes, { replace: true })
  }, [pendiente, esApp, catalogo.cargando, catalogo.error, campania, params, setParams])
  const query = campania ? `?campania=${encodeURIComponent(campania)}` : ''
  const generar = contexto.permite('harvest.manage')
  const trabajadores = SECCIONES_TRABAJADORES.find((t) => t.id === seccion)
  const esReporte = ['produccion', 'rendimiento'].includes(seccion)
  const subtabs = esApp
    ? [
        { id: 'app', label: 'Instalar y vincular la app con el PDA', icon: 'qr' },
        ...(contexto.permite('company.manage') || contexto.permite('harvest.manage')
          ? [{ id: 'dispositivos', label: 'Dispositivos vinculados', icon: 'devices' }]
          : [])
      ]
    : esReporte
      ? [
          { id: 'produccion', label: 'Producción', icon: 'production' },
          { id: 'rendimiento', label: 'Rendimiento', icon: 'ranking' }
        ]
      : trabajadores
        ? SECCIONES_TRABAJADORES
        : [
            ...(generar
              ? [
                  {
                    id: 'generar',
                    label: 'Generación e impresión de lotes de tickets',
                    icon: 'generation'
                  }
                ]
              : []),
            { id: 'lotes', label: 'Lotes de tickets generados', icon: 'lots' },
            {
              id: 'asignaciones',
              label: 'Lotes de tickets asignados',
              icon: 'assignments'
            }
          ]
  if (
    !pendiente &&
    !catalogo.cargando &&
    !catalogo.error &&
    catalogo.datos?.length === 0 &&
    generar &&
    !esApp
  )
    return <Navigate to="/cosecha/configurar" replace />
  return (
    <div className="harvest-campaign-page">
      {consultaCampanias ? (
        <CosechaSelector
          destino={
            trabajadores || esReporte || esApp
              ? '/cosecha/' + seccion
              : generar
                ? '/cosecha/generar'
                : '/cosecha/lotes'
          }
          campanias={catalogo.datos ?? []}
          seleccion={campania}
          pendiente={pendiente || catalogo.cargando || Boolean(catalogo.error)}
        />
      ) : (
        <div className="cosecha-heading">
          <h1>Cosecha</h1>
        </div>
      )}
      <div className="campaign-container">
        <nav className="campaign-main-tabs" aria-label="Opciones de Cosecha">
          {consultaCampanias && (
            <Link
              aria-current={!trabajadores && !esReporte && !esApp ? 'page' : undefined}
              to={(generar ? '/cosecha/generar' : '/cosecha/lotes') + query}
              aria-label="Tickets"
            >
              <CampaignIcon name="tickets" />
              <span>Tickets</span>
            </Link>
          )}
          {puedeTrabajadores || contexto.permite('harvest.view') || generar ? (
            <Link
              to={'/cosecha/cosechadores' + query}
              aria-label="Trabajadores"
              aria-current={trabajadores ? 'page' : undefined}
            >
              <CampaignIcon name="workers" />
              <span>Trabajadores</span>
            </Link>
          ) : (
            <button
              disabled
              aria-label="Trabajadores"
              title="No tienes acceso a la gestión de trabajadores"
            >
              <CampaignIcon name="workers" />
              <span>Trabajadores</span>
            </button>
          )}
          {consultaCampanias && contexto.permite('reports.view') ? (
            <Link
              to={'/cosecha/produccion' + query}
              aria-label="Reportes"
              aria-current={esReporte ? 'page' : undefined}
            >
              <CampaignIcon name="reports" />
              <span>Reportes</span>
            </Link>
          ) : (
            <button
              disabled
              aria-label="Reportes"
              title="Se requiere permiso para consultar reportes"
            >
              <CampaignIcon name="reports" />
              <span>Reportes</span>
            </button>
          )}
          <Link
            className="campaign-app-tab"
            to={'/cosecha/app' + query}
            aria-label="App de Cosecha"
            aria-current={esApp ? 'page' : undefined}
          >
            <PdaIcon name="phone" />
            <span>App de Cosecha</span>
          </Link>
        </nav>
        <nav
          className="campaign-sub-tabs"
          aria-label={
            esApp
              ? 'Secciones de App de Cosecha'
              : esReporte
                ? 'Secciones de Reportes'
                : trabajadores
                  ? 'Secciones de Trabajadores'
                  : 'Secciones de Tickets'
          }
        >
          {subtabs.map((t) => (
            <Link
              key={t.id}
              to={'/cosecha/' + t.id + query}
              aria-label={t.label}
              aria-current={seccion === t.id ? 'page' : undefined}
            >
              {esApp ? (
                <PdaIcon name={t.icon} />
              ) : esReporte ? (
                <ReportIcon name={t.icon} />
              ) : trabajadores ? (
                <IconoTrabajador tipo={t.icon} />
              ) : (
                <CampaignIcon name={t.icon} />
              )}
              <span>{t.label}</span>
            </Link>
          ))}
        </nav>
        <section className="campaign-body" aria-busy={pendiente || catalogo.cargando}>
          {seccion === 'lotes' && <h2>Lotes de tickets generados</h2>}
          {seccion === 'asignaciones' && <h2>Lotes de tickets asignados</h2>}
          {trabajadores && <h2>{trabajadores.label}</h2>}
          {esApp ? (
            <Suspense fallback={<p role="status">Cargando App de Cosecha…</p>}>
              <AppCosecha
                key={`${contexto.tenantId}:${contexto.usuarioId}`}
                servicio={appCosecha}
                contexto={contexto}
                dispositivos={seccion === 'dispositivos'}
                pendiente={pendiente}
              />
            </Suspense>
          ) : (
            <Carga
              consulta={pendiente ? { cargando: true } : catalogo}
              skeleton={
                esReporte ? 'report' : seccion === 'generar' ? 'generation' : 'table'
              }
            >
              {(campanias) => {
                const elegida = campanias.find((c) => c.id === campania)
                if (!elegida)
                  return (
                    <p role="alert">
                      No hay una campaña disponible. Selecciona una campaña o agrega un
                      cultivo.
                    </p>
                  )
                if (esReporte)
                  return (
                    <ReportesCampania
                      key={`${elegida.id}:${seccion}`}
                      servicio={reportes}
                      campania={elegida}
                      rendimiento={seccion === 'rendimiento'}
                    />
                  )
                if (trabajadores)
                  return (
                    <TrabajadoresCampania
                      key={`${elegida.id}:${seccion}`}
                      servicio={servicio}
                      campania={elegida}
                      seccion={trabajadores}
                      puedeEditar={generar}
                    />
                  )
                if (seccion === 'generar')
                  return (
                    <GeneracionCampania
                      key={`${elegida.id}:${params.get('operacion') ?? ''}`}
                      servicio={servicio}
                      campania={elegida}
                      pendiente={pendiente}
                      operacionId={params.get('operacion')}
                      onNuevaGeneracion={() => {
                        const siguientes = new URLSearchParams(params)
                        siguientes.delete('operacion')
                        setParams(siguientes, { replace: true })
                      }}
                    />
                  )
                if (seccion === 'lotes' || seccion === 'asignaciones')
                  return (
                    <LotesCampania
                      key={`${elegida.id}:${seccion}`}
                      servicio={servicio}
                      campania={elegida}
                      asignados={seccion === 'asignaciones'}
                    />
                  )
                return (
                  <TicketsCosecha
                    servicio={servicio}
                    contexto={contexto}
                    seccion={seccion}
                    catalogo={catalogo}
                    pendiente={pendiente}
                  />
                )
              }}
            </Carga>
          )}
        </section>
      </div>
    </div>
  )
}
