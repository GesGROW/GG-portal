import { useEffect, useState } from 'react'
import { AgriculturalVisual } from './AgriculturalVisual.jsx'
import { Icon } from './Ui.jsx'
import { HomeIcon, harvestPhoto } from './HomeAssets.jsx'

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

function weatherTimeOfDay() {
  const hour = Number(
    new Intl.DateTimeFormat('en-GB', {
      hour: '2-digit',
      hourCycle: 'h23',
      timeZone: 'America/Lima'
    }).format(new Date())
  )
  return hour >= 6 && hour < 16
    ? 'day'
    : hour >= 16 && hour < 19
      ? 'afternoon'
      : 'night'
}

export function WeatherCard({ figma = false }) {
  const [timeOfDay, setTimeOfDay] = useState(weatherTimeOfDay)

  useEffect(() => {
    const updateTimeOfDay = () => setTimeOfDay(weatherTimeOfDay())
    const timer = window.setInterval(updateTimeOfDay, 60_000)
    document.addEventListener('visibilitychange', updateTimeOfDay)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', updateTimeOfDay)
    }
  }, [])

  return (
    <section
      className={`weather-card ${figma ? 'home-weather' : ''}`}
      data-time-of-day={timeOfDay}
      aria-labelledby="weather-title"
      title={
        figma
          ? 'Clima no configurado. La información meteorológica aún no está disponible.'
          : undefined
      }
    >
      <div className="weather-symbol">
        {figma ? <HomeIcon name="weather" /> : <Icon name="weather" />}
      </div>
      <span className="eyebrow">En el campo</span>
      <h2 id="weather-title">Clima no configurado</h2>
      <p>La información meteorológica aún no está disponible.</p>
      <span className="weather-footer">Contexto meteorológico</span>
    </section>
  )
}
