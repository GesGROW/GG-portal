import { Select } from './Select.jsx'
import { useState } from 'react'
import { useSearchParams } from 'react-router'
import { useCarga } from './GestionUi.jsx'
import { EmptyState } from './Ui.jsx'
import { EstadoConsulta } from './Reportes.jsx'
import { PortalHero, WeatherCard } from './DashboardWidgets.jsx'
import { HomeIcon } from './HomeAssets.jsx'
import { HomeSkeleton } from './HomeSkeleton.jsx'
import { DashboardData } from './DashboardSummary.jsx'

export function Dashboard({
  servicio,
  empresa,
  usuario,
  embedded = false,
  puedeDetalles = true,
  sinCampanias
}) {
  const [params, setParams] = useSearchParams()
  const [revision, setRevision] = useState(0)
  const actualizar = () => setRevision((r) => r + 1)
  const campaigns = useCarga(() => servicio.campanias(), [servicio])
  if (campaigns.cargando) return <HomeSkeleton page={!embedded} />
  return (
    <div className="dashboard-page figma-home">
      <EstadoConsulta consulta={campaigns} skeleton={embedded ? 'summary' : 'home'}>
        {(lista) => {
          if (!lista.length && sinCampanias) return sinCampanias(campaigns.refrescar)
          const id =
            params.get('campania') ||
            (lista.find((c) => c.estado === 'ACTIVA') ?? lista[0])?.id
          const campaign = lista.find((c) => c.id === id)
          const selection = (
            <Select
              className={embedded ? 'home-campaign-list' : undefined}
              aria-label="Campaña"
              size={embedded ? 3 : undefined}
              value={id ?? ''}
              onChange={(e) =>
                setParams(
                  (p) => {
                    const next = new URLSearchParams(p)
                    next.set('campania', e.target.value)
                    return next
                  },
                  { replace: true }
                )
              }
            >
              {!campaign && <option value={id ?? ''}>Selección no autorizada</option>}
              {lista.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                  {c.estado === 'CERRADA' ? ' · Cerrada' : ''}
                </option>
              ))}
            </Select>
          )
          const controls = (actions = null) =>
            embedded ? (
              <aside
                className="home-campaign-panel"
                aria-labelledby="home-campaign-title"
              >
                <h3 id="home-campaign-title">Selecciona una campaña</h3>
                {actions}
                {selection}
              </aside>
            ) : (
              <label className="home-campaign-select">
                <span className="sr-only">Campaña</span>
                {selection}
                <HomeIcon name="chevron" />
              </label>
            )
          if (!campaign)
            return (
              <>
                {!embedded && (
                  <div className="home-welcome">
                    <PortalHero empresa={empresa} usuario={usuario} figma />
                    <WeatherCard figma />
                  </div>
                )}
                {lista.length ? (
                  <>
                    {controls()}
                    <p role="alert">
                      Campaña ajena o no disponible. Seleccione una campaña de esta
                      empresa.
                    </p>
                  </>
                ) : (
                  <EmptyState>Sin campañas disponibles para esta empresa.</EmptyState>
                )}
                <button className="quiet" onClick={campaigns.refrescar}>
                  <HomeIcon name="refresh" /> Actualizar campañas
                </button>
              </>
            )
          return (
            <div className={embedded ? 'home-summary-content-embedded' : undefined}>
              <DashboardData
                key={id}
                servicio={servicio}
                empresa={empresa}
                usuario={usuario}
                campania={campaign}
                controls={controls}
                embedded={embedded}
                puedeDetalles={puedeDetalles}
                revision={revision}
                actualizar={actualizar}
              />
              {embedded &&
                controls(
                  <button
                    className="home-campaign-refresh"
                    type="button"
                    aria-label="Actualizar datos"
                    title="Actualizar datos"
                    onClick={actualizar}
                  >
                    <HomeIcon name="refresh" />
                  </button>
                )}
            </div>
          )
        }}
      </EstadoConsulta>
    </div>
  )
}
