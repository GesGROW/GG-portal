import { Select } from './Select.jsx'
import { lazy, Suspense, useEffect, useState } from 'react'
import { OwnerIcon } from './OwnerAssets.jsx'
import { HomeSkeleton } from './HomeSkeleton.jsx'
import { esOwnerSinOperacion } from '../application/accesoOwner.js'
import { SupervisorSetupEmpty } from './SupervisorSetupEmpty.jsx'
import './supervisor-home.css'

const Dashboard = lazy(() =>
  import('./Dashboard.jsx').then((m) => ({ default: m.Dashboard }))
)
const lima = { timeZone: 'America/Lima' }
function saludo(hoy) {
  const hora = Number(
    new Intl.DateTimeFormat('en-GB', {
      ...lima,
      hour: '2-digit',
      hourCycle: 'h23'
    }).format(hoy)
  )
  return hora < 12 ? 'Buenos días' : hora < 19 ? 'Buenas tardes' : 'Buenas noches'
}
const capitalizar = (texto) => texto.charAt(0).toUpperCase() + texto.slice(1)
function fecha(hoy) {
  const dia = new Intl.DateTimeFormat('es-PE', { ...lima, weekday: 'long' }).format(hoy)
  const numero = new Intl.DateTimeFormat('es-PE', { ...lima, day: 'numeric' }).format(
    hoy
  )
  const mes = new Intl.DateTimeFormat('es-PE', { ...lima, month: 'long' }).format(hoy)
  return `${capitalizar(dia)}, ${numero} de ${capitalizar(mes)}`
}

export function OwnerHome({ estado, servicio }) {
  const [hoy, setHoy] = useState(() => new Date())
  useEffect(() => {
    const timer = setInterval(() => setHoy(new Date()), 60_000)
    return () => clearInterval(timer)
  }, [])
  const adquirido = estado.modulos.includes('HARVEST')
  const vistaModulo = !estado.contexto.permite('company.manage')
  const puedeResumen = adquirido && estado.contexto.permite('reports.view')
  return (
    <div
      className={`owner-home ${adquirido ? 'owner-home-harvest' : ''} ${vistaModulo ? 'harvest-supervisor-home' : ''}`}
      data-node-id={vistaModulo ? undefined : adquirido ? '86:656' : '64:383'}
    >
      <h1 className="owner-home-title">Home</h1>
      <div className="owner-welcome">
        <section className="owner-greeting" aria-label="Bienvenida">
          <h2 className="sr-only">Bienvenido a GesGROW</h2>
          <div className="owner-greeting-copy">
            <time
              dateTime={new Intl.DateTimeFormat('en-CA', {
                ...lima,
                year: 'numeric',
                month: '2-digit',
                day: '2-digit'
              }).format(hoy)}
            >
              {fecha(hoy)}
            </time>
            <p>{saludo(hoy)}</p>
            <strong>{estado.usuario?.nombre?.trim() || estado.contexto.empresa}</strong>
          </div>
          <OwnerIcon name="greeting" />
        </section>
        <section
          className="owner-weather"
          title="La información meteorológica aún no está disponible."
          aria-labelledby="owner-weather-title"
        >
          <h2 id="owner-weather-title" className="sr-only">
            Clima no configurado
          </h2>
          <OwnerIcon name="weather" />
        </section>
      </div>
      <section className="owner-summary" aria-labelledby="owner-summary-title">
        <div className="owner-summary-heading">
          <h2 id="owner-summary-title">Resumen</h2>
          {adquirido && !vistaModulo && (
            <label className="owner-module-select">
              <span>Módulo</span>
              <Select value="HARVEST" onChange={() => {}}>
                <option value="HARVEST">Cosecha</option>
              </Select>
              <OwnerIcon name="chevron" />
            </label>
          )}
        </div>
        {!adquirido ? (
          <div className="owner-module-empty" role="status">
            <OwnerIcon name="empty" />
            <p>
              {vistaModulo
                ? 'Cosecha no está habilitado para tu empresa. Consulta al owner.'
                : 'Adquiere un módulo para poder ver su resumen'}
            </p>
          </div>
        ) : !puedeResumen ? (
          <div className="owner-module-empty" role="status">
            <p>
              Tu cuenta no tiene acceso al resumen de Cosecha. Consulta al administrador
              de tu empresa.
            </p>
          </div>
        ) : !servicio ? (
          <div className="owner-module-empty" role="status">
            <p>El resumen de Cosecha no está disponible en este momento.</p>
          </div>
        ) : (
          <Suspense fallback={<HomeSkeleton />}>
            <Dashboard
              servicio={servicio}
              empresa={estado.contexto.empresa}
              usuario={estado.usuario}
              embedded
              puedeDetalles={!esOwnerSinOperacion(estado.contexto)}
              sinCampanias={
                vistaModulo
                  ? (actualizar) => <SupervisorSetupEmpty actualizar={actualizar} />
                  : undefined
              }
            />
          </Suspense>
        )}
      </section>
    </div>
  )
}
