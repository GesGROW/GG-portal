import { useRef, useState } from 'react'
import { Link } from 'react-router'
import photo from '../assets/login/seedling.png'
import logo from '../assets/login/logo.png'
import { NOMBRES_ROL, NOMBRES_MODULO } from './nombresAcceso.js'

const enumerar = (valores) =>
  new Intl.ListFormat('es', { style: 'long', type: 'conjunction' }).format(valores)

export function ActivacionCuenta({ portal, estado }) {
  const [dni, setDni] = useState('')
  const [password, setPassword] = useState('')
  const [confirmacion, setConfirmacion] = useState('')
  const [visibles, setVisibles] = useState({ password: false, confirmacion: false })
  const [error, setError] = useState('')
  const enviando = useRef(false)
  const invitacion = estado.invitacion
  const invalida = estado.fase === 'invitacion-error'
  const roles = enumerar((invitacion?.roles ?? []).map((r) => NOMBRES_ROL[r] ?? r))
  const modulos = enumerar(
    (invitacion?.modulos ?? []).map((m) => NOMBRES_MODULO[m] ?? m)
  )

  async function enviar(event) {
    event.preventDefault()
    if (enviando.current || estado.cargando) return
    if (password !== confirmacion) {
      setError('Las contraseñas deben coincidir.')
      document.getElementById('activation-confirmacion')?.focus()
      return
    }
    enviando.current = true
    const secreto = password
    setPassword('')
    setConfirmacion('')
    setVisibles({ password: false, confirmacion: false })
    setError('')
    try {
      await portal.completarInvitacion({ password: secreto, dni: dni.trim() })
    } finally {
      enviando.current = false
    }
  }

  return (
    <main className="account-screen account-activation" data-node-id="116:377">
      <img className="account-photo" src={photo} alt="" aria-hidden="true" />
      <section className="account-panel" aria-labelledby="activation-title">
        <img className="account-logo" src={logo} alt="GesGROW" />
        <div className="account-content">
          <h1 id="activation-title">Activación de cuenta</h1>
          {invalida ? (
            <div className="activation-invalid">
              <p className="account-message" role="alert">
                {estado.mensaje}
              </p>
              <p>
                Solicita al administrador de tu empresa una nueva invitación o inicia
                sesión si ya tienes cuenta.
              </p>
              <button
                className="account-submit"
                type="button"
                onClick={() => portal.restaurar()}
              >
                Reintentar
              </button>
              <Link to="/login" onClick={() => void portal.logout()}>
                Ir a iniciar sesión
              </Link>
            </div>
          ) : (
            <>
              <div className="activation-description">
                <p>
                  ¡En horabuena! has sido invitado(a)
                  {invitacion?.empresa ? (
                    <>
                      {' '}
                      por <strong>{invitacion.empresa}</strong>
                    </>
                  ) : (
                    ' a GesGROW'
                  )}
                  {roles && (
                    <>
                      {' '}
                      como <strong>{roles}</strong>
                    </>
                  )}
                  {modulos && (
                    <>
                      {' '}
                      de <strong>{modulos}</strong>
                    </>
                  )}
                  .
                </p>
                <p>Para continuar, registra tu DNI y crea una contraseña.</p>
              </div>
              <form
                className="activation-form"
                onSubmit={enviar}
                aria-busy={estado.cargando}
              >
                <div className="account-fields">
                  <div className="account-field">
                    <label htmlFor="activation-dni">DNI</label>
                    <input
                      id="activation-dni"
                      name="dni"
                      type="text"
                      inputMode="numeric"
                      autoComplete="off"
                      required
                      pattern="[0-9]{8}"
                      maxLength={8}
                      title="Ingresa un DNI de 8 dígitos."
                      value={dni}
                      onChange={(event) => {
                        setDni(event.target.value.replace(/\D/g, '').slice(0, 8))
                        setError('')
                      }}
                      disabled={estado.cargando}
                    />
                  </div>
                  {[
                    ['password', 'Contraseña'],
                    ['confirmacion', 'Confirmar contraseña']
                  ].map(([id, label]) => (
                    <div className="account-field" key={id}>
                      <div className="account-password-label">
                        <label htmlFor={`activation-${id}`}>{label}</label>
                        <button
                          className="account-show"
                          type="button"
                          aria-controls={`activation-${id}`}
                          aria-label={`${visibles[id] ? 'Ocultar' : 'Mostrar'} ${label.toLowerCase()}`}
                          aria-pressed={visibles[id]}
                          disabled={estado.cargando}
                          onClick={() => setVisibles((v) => ({ ...v, [id]: !v[id] }))}
                        >
                          {visibles[id] ? 'Ocultar' : 'Mostrar'}
                        </button>
                      </div>
                      <input
                        id={`activation-${id}`}
                        name={id}
                        type={visibles[id] ? 'text' : 'password'}
                        autoComplete="new-password"
                        required
                        minLength={8}
                        title="Usa al menos 8 caracteres."
                        value={id === 'password' ? password : confirmacion}
                        onChange={(e) => {
                          if (id === 'password') setPassword(e.target.value)
                          else setConfirmacion(e.target.value)
                          setError('')
                        }}
                        aria-invalid={id === 'confirmacion' && Boolean(error)}
                        aria-describedby={error ? 'activation-error' : undefined}
                        disabled={estado.cargando}
                      />
                    </div>
                  ))}
                </div>
                {(error || estado.mensaje) && (
                  <p className="account-message" id="activation-error" role="alert">
                    {error || estado.mensaje}
                  </p>
                )}
                <button
                  className="account-submit"
                  type="submit"
                  disabled={estado.cargando}
                >
                  {estado.cargando ? 'Activando cuenta…' : 'Activar cuenta'}
                </button>
              </form>
            </>
          )}
        </div>
      </section>
    </main>
  )
}
