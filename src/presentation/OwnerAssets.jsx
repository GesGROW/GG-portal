import home from '../assets/owner/home.svg'
import modules from '../assets/owner/modules.svg'
import settings from '../assets/owner/settings.svg'
import chevron from '../assets/owner/chevron.svg'
import greeting from '../assets/owner/greeting.svg'
import weather from '../assets/owner/weather.svg'
import empty from '../assets/owner/modules-empty.svg'
import avocado from '../assets/owner/avocado.svg'
import plus from '../assets/owner/plus.svg'
export { default as ownerLogo } from '../assets/owner/logo.png'

const assets = {
  home,
  layers: modules,
  settings,
  chevron,
  greeting,
  weather,
  empty,
  avocado,
  plus
}
export function OwnerIcon({ name }) {
  return (
    <span className={`owner-icon owner-icon-${name}`} aria-hidden="true">
      <img src={assets[name]} alt="" />
    </span>
  )
}
