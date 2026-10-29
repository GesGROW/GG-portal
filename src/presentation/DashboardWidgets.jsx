import { useEffect, useState } from 'react'
import { AgriculturalVisual } from './AgriculturalVisual.jsx'
import { Icon } from './Ui.jsx'
import { harvestPhoto } from './HomeAssets.jsx'
import { momentoDia } from './momentoDia.js'
import { ClimaWidget } from './ClimaWidget.jsx'

export function PortalHero({ empresa, campania, hoy, usuario, figma = false }) {
  const date = new Intl.DateTimeFormat('es-PE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'America/Lima'
  }).format(new Date())
  return (
    <section className="portal-hero">
      {figma ? (
        <img className="home-harvest-photo" src={harvestPhoto} alt="" />
      ) : (
        <AgriculturalVisual />
      )}
      <div className="hero-copy">
        <time className="hero-date">{date}</time>
        <h1 className="sr-only">Bienvenido a GesGROW</h1>
        <p className="hero-greeting">{figma ? 'Buenos días' : 'Buen día,'}</p>
        <strong className="hero-company">
          {figma ? usuario?.nombre?.trim().split(/\s+/)[0] || empresa : empresa}
        </strong>
        <p className="hero-campaign">
          {campania?.nombre ?? 'Su espacio de gestión agrícola'}
        </p>
        {campania && !figma && (
          <div className="hero-facts">
            <span>
              <Icon name="campaign" />{' '}
              {campania.estado === 'ACTIVA'
                ? 'Campaña activa'
                : campania.estado === 'CERRADA'
                  ? 'Campaña cerrada'
                  : 'Campaña seleccionada'}
            </span>
            {hoy?.total_jabas != null && (
              <span>
                Hoy · {new Intl.NumberFormat('es-PE').format(hoy.total_jabas)} jabas
              </span>
            )}
          </div>
        )}
      </div>
    </section>
  )
}

export function WeatherCard({ figma = false, servicio }) {
  const [timeOfDay, setTimeOfDay] = useState(momentoDia)

  useEffect(() => {
    const updateTimeOfDay = () => setTimeOfDay(momentoDia())
    const timer = window.setInterval(updateTimeOfDay, 60_000)
    document.addEventListener('visibilitychange', updateTimeOfDay)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', updateTimeOfDay)
    }
  }, [])

  return <ClimaWidget servicio={servicio} momento={timeOfDay} figma={figma} />
}
