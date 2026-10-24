import modulo from '../assets/supervisor/module.svg'
import flecha from '../assets/supervisor/arrow.svg'
import cosecha from '../assets/supervisor/harvest.svg'

export function SupervisorSetupEmpty({ actualizar }) {
  return (
    <div className="supervisor-setup-empty">
      <div className="supervisor-setup-message" role="status">
        <div className="supervisor-setup-icons" aria-hidden="true">
          {[modulo, flecha, cosecha].map((src) => (
            <span className="supervisor-setup-icon" key={src}>
              <img src={src} alt="" />
            </span>
          ))}
        </div>
        <p>
          Agrega un cultivo para <br />
          comenzar con la cosecha
        </p>
      </div>
      <button type="button" className="supervisor-setup-refresh" onClick={actualizar}>
        Actualizar campañas
      </button>
    </div>
  )
}
