import { useEffect, useId, useState } from 'react'
import { OwnerIcon } from './OwnerAssets.jsx'
import { HomeIcon } from './HomeAssets.jsx'
import { Icon } from './Ui.jsx'

const formato = (valor) =>
  new Intl.NumberFormat('es-PE', { maximumFractionDigits: 0 }).format(valor)
function horaActualizacion(datos) {
  if (!datos.actualizadoEn || !Number.isFinite(Date.parse(datos.actualizadoEn)))
    return null
  try {
    return new Intl.DateTimeFormat('es-PE', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: datos.zonaHoraria || 'America/Lima'
    }).format(new Date(datos.actualizadoEn))
  } catch {
    return null
  }
}

export function ClimaWidget({ servicio, momento, owner = false, figma = false }) {
  const [datos, setDatos] = useState(null)
  const id = useId()
  useEffect(() => {
    setDatos(null)
    if (!servicio) return
    let activo = true,
      disponible = false
    const actualizar = async () => {
      try {
        const siguiente = await servicio.consultar()
        if (activo) {
          disponible = Boolean(siguiente)
          setDatos(siguiente)
        }
      } catch {
        if (activo) {
          disponible = false
          setDatos(null)
        }
      }
    }
    void actualizar()
    const dejarPermiso = servicio.observarPermiso?.((estado) => {
      disponible = false
      setDatos(null)
      if (estado === 'granted') void actualizar()
    })
    const alVolver = () => {
      if (disponible && !document.hidden) void actualizar()
    }
    const timer = setInterval(alVolver, 15 * 60_000)
    document.addEventListener('visibilitychange', alVolver)
    return () => {
      activo = false
      dejarPermiso?.()
      clearInterval(timer)
      document.removeEventListener('visibilitychange', alVolver)
    }
  }, [servicio])
  const actualizado = datos ? horaActualizacion(datos) : null
  return (
    <section
      className={`${owner ? 'owner-weather' : `weather-card ${figma ? 'home-weather' : ''}`} ${datos ? 'weather-live' : ''}`}
      data-time-of-day={momento}
      aria-labelledby={id}
      title={datos ? undefined : 'La información meteorológica aún no está disponible.'}
    >
      <h2 id={id} className="sr-only">
        {datos ? `Clima en ${datos.ubicacion}` : 'Clima no configurado'}
      </h2>
      {datos ? (
        <div className="weather-live-content content-ready">
          <span
            className="weather-location"
            title={
              datos.ubicacionAproximada
                ? 'Ubicación aproximada según tu conexión'
                : undefined
            }
          >
            {datos.ubicacion}
            {datos.ubicacionAproximada && <small> · Aprox.</small>}
          </span>
          <div className="weather-current">
            <strong className="weather-temperature">
              {formato(datos.temperatura)}°<span>C</span>
            </strong>
            {datos.icono &&
              /^https:\/\/cdn\.weatherapi\.com\/weather\/64x64\/(day|night)\/\d+\.png$/.test(
                datos.icono
              ) && (
                <img
                  className="weather-condition-icon"
                  src={datos.icono}
                  alt=""
                  width="48"
                  height="48"
                />
              )}
            <span className="weather-condition">{datos.condicion}</span>
          </div>
          <dl className="weather-measures">
            <div>
              <dt>Lluvia próximas 3 h</dt>
              <dd>
                {datos.probabilidadLluvia == null
                  ? '—'
                  : `${formato(datos.probabilidadLluvia)} %`}
              </dd>
            </div>
            <div>
              <dt>Humedad</dt>
              <dd>{datos.humedad == null ? '—' : `${formato(datos.humedad)} %`}</dd>
            </div>
            <div>
              <dt>Viento</dt>
              <dd>{datos.viento == null ? '—' : `${formato(datos.viento)} km/h`}</dd>
            </div>
          </dl>
          <div className="weather-source">
            {actualizado && <span>Actualizado {actualizado}</span>}
            <a href="https://www.weatherapi.com/" target="_blank" rel="noreferrer">
              WeatherAPI.com
            </a>
          </div>
        </div>
      ) : owner ? (
        <OwnerIcon name="weather" />
      ) : (
        <>
          <div className="weather-symbol">
            {figma ? <HomeIcon name="weather" /> : <Icon name="weather" />}
          </div>
          {!figma && <p>La información meteorológica aún no está disponible.</p>}
        </>
      )}
    </section>
  )
}
