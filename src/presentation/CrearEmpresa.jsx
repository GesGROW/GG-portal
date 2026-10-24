import { useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import photo from '../assets/login/seedling.png'
import logo from '../assets/login/logo.png'
import './crear-empresa.css'

export function CrearEmpresa({ portal, estado }) {
  const navigate = useNavigate()
  const [empresa, setEmpresa] = useState('')
  const [nombre, setNombre] = useState(
    estado.usuario?.nombre === 'Usuario' ? '' : (estado.usuario?.nombre ?? '')
  )
  const [intento, setIntento] = useState(null)
  const enviando = useRef(false)
  async function enviar(event) {
    event.preventDefault()
    if (enviando.current || estado.cargando) return
    enviando.current = true
    const datos = intento ?? {
      operacionId: crypto.randomUUID(),
      nombreEmpresa: empresa.trim(),
      nombreOwner: nombre.trim()
    }
    setIntento(datos)
    try {
      if (await portal.crearEmpresa(datos)) navigate('/', { replace: true })
    } finally {
      enviando.current = false
    }
  }
  return (
    <main className="account-screen crear-empresa">
      <img className="account-photo" src={photo} alt="" aria-hidden="true" />
      <section className="account-panel" aria-labelledby="empresa-title">
        <img className="account-logo" src={logo} alt="GesGROW" />
        <div className="account-content">
          <h1 id="empresa-title">Crea tu empresa</h1>
          <p className="empresa-intro">
            Empieza tu espacio en GesGROW. Podrás elegir tus módulos e invitar a tu
            equipo.
          </p>
          <form className="account-form" onSubmit={enviar} aria-busy={estado.cargando}>
            <div className="account-fields">
              <div className="account-field">
                <label htmlFor="empresa-nombre">Nombre de la empresa</label>
                <input
                  id="empresa-nombre"
                  autoComplete="organization"
                  required
                  maxLength={120}
                  pattern=".*\S.*"
                  value={empresa}
                  onChange={(e) => setEmpresa(e.target.value)}
                  readOnly={Boolean(intento)}
                  disabled={estado.cargando}
                />
              </div>
              <div className="account-field">
                <label htmlFor="owner-nombre">Tu nombre</label>
                <input
                  id="owner-nombre"
                  autoComplete="name"
                  required
                  maxLength={120}
                  pattern=".*\S.*"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  readOnly={Boolean(intento)}
                  disabled={estado.cargando}
                />
              </div>
            </div>
            {estado.mensaje && (
              <p className="account-message" role="alert">
                {estado.mensaje}
              </p>
            )}
            <button className="account-submit" type="submit" disabled={estado.cargando}>
              {estado.cargando
                ? 'Creando empresa…'
                : intento
                  ? 'Reintentar'
                  : 'Crear empresa'}
            </button>
            {intento && !estado.cargando && (
              <button
                className="empresa-link"
                type="button"
                onClick={() => setIntento(null)}
              >
                Editar datos
              </button>
            )}
          </form>
          <p className="empresa-invitacion">¿Ya te invitaron a una empresa?</p>
          <div className="empresa-actions">
            <button
              className="empresa-link"
              disabled={estado.cargando}
              onClick={() => portal.restaurar()}
            >
              Actualizar acceso
            </button>
            <button
              className="empresa-link"
              disabled={estado.cargando}
              onClick={() => portal.logout()}
            >
              Cerrar sesión
            </button>
          </div>
        </div>
      </section>
    </main>
  )
}
