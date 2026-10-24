// Recursos exportados del frame Figma 1:4, servidos desde el proyecto.
import home from '../assets/home/home.svg'
import layers from '../assets/home/layers.svg'
import settings from '../assets/home/settings.svg'
import chevron from '../assets/home/chevron.svg'
import moon from '../assets/home/moon.svg'
import refresh from '../assets/home/refresh.svg'
import production from '../assets/home/production.svg'
import ranking from '../assets/home/ranking.svg'
import arrow from '../assets/home/arrow.svg'
import harvesters from '../assets/home/harvesters.svg'
import carriers from '../assets/home/carriers.svg'
import lots from '../assets/home/lots.svg'
import varieties from '../assets/home/varieties.svg'
import calendar from '../assets/home/calendar.svg'
import clock from '../assets/home/clock.svg'
import weather from '../assets/home/weather.svg'
export { default as harvestPhoto } from '../assets/home/harvest-photo.png'
export { default as homeLogo } from '../assets/home/logo.png'
export { default as homeLaurel } from '../assets/home/—Pngtree—green laurel wreath vector illustration_21057227 (1).png'

const icons = {
  home,
  layers,
  settings,
  chevron,
  moon,
  refresh,
  production,
  ranking,
  arrow,
  harvesters,
  carriers,
  lots,
  varieties,
  calendar,
  clock,
  weather
}

export function HomeIcon({ name }) {
  return <img className="home-icon" src={icons[name]} alt="" aria-hidden="true" />
}
