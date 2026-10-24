import { useRef, useState } from 'react'
import { Link } from 'react-router'
import photo from '../assets/login/seedling.png'
import logo from '../assets/login/logo.png'

export function Registro({ portal, estado }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmacion, setConfirmacion] = useState('')
  const [visible, setVisible] = useState({ password: false, confirmacion: false })
  const [error, setError] = useState('')
  const enviando = useRef(false)
  const mensajeRef = useRef(null)
  const completo = estado.fase === 'registro-completo'

  async function enviar(event) {
    event.preventDefault()
    if (enviando.current || estado.cargando) return
    if (password !== confirmacion) {
      setError('Las contraseñas deben coincidir.')
      document.getElementById('register-confirmacion')?.focus()
      return
    }
    enviando.current = true
    setError('')
    try {
      await portal.registrar({ email: email.trim(), password })
    } finally {
      setPassword('')
      setConfirmacion('')
      setVisible({ password: false, confirmacion: false })
      enviando.current = false
      requestAnimationFrame(() => mensajeRef.current?.focus())
    }
  }

  function campoPassword(id, label) {
    const confirmar = id === 'confirmacion'
    return (
      <div className="account-field">
        <div className="account-password-label">
          <label htmlFor={`register-${id}`}>{label}</label>
          <button
            className="account-show"
            type="button"
            aria-controls={`register-${id}`}
            aria-label={`${visible[id] ? 'Ocultar' : 'Mostrar'} ${label.toLowerCase()}`}
            aria-pressed={visible[id]}
            disabled={estado.cargando}
            onClick={() => setVisible((v) => ({ ...v, [id]: !v[id] }))}
          >
            {visible[id] ? 'Ocultar' : 'Mostrar'}
          </button>
        </div>
        <input
          id={`register-${id}`}
          name={id}
          type={visible[id] ? 'text' : 'password'}
          autoComplete="new-password"
          minLength={8}
          required
          title="Usa al menos 8 caracteres."
          value={confirmar ? confirmacion : password}
          onChange={(e) => {
            if (confirmar) setConfirmacion(e.target.value)
            else setPassword(e.target.value)
            setError('')
          }}
          aria-invalid={confirmar && Boolean(error)}
          aria-describedby={confirmar && error ? 'register-message' : undefined}
          disabled={estado.cargando}
        />
      </div>
    )
  }

  return (
    <main className="account-screen figma-register" data-node-id="166:2221">
      <img className="account-photo" src={photo} alt="" aria-hidden="true" />
      <section className="account-panel" aria-labelledby="register-title">
        <img className="account-logo" src={logo} alt="GesGROW" />
        <div className="account-content">
          <h1 id="register-title">Registro</h1>
          {completo ? (
            <div
              className="account-success"
              role="status"
              tabIndex={-1}
              ref={mensajeRef}
            >
              <h2>{estado.confirmarCorreo ? 'Revisa tu correo' : 'Cuenta creada'}</h2>
              <p>{estado.mensaje}</p>
              <p>El siguiente paso será crear tu empresa en GesGROW.</p>
              <Link className="account-submit" to="/login">
                Ir a iniciar sesión
              </Link>
            </div>
          ) : (
            <form
              className="account-form"
              onSubmit={enviar}
              aria-busy={estado.cargando}
            >
              <div className="account-fields">
                <div className="account-field">
                  <label htmlFor="register-email">Correo electrónico</label>
                  <input
                    id="register-email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    autoCapitalize="none"
                    spellCheck={false}
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={estado.cargando}
                  />
                </div>
                {campoPassword('password', 'Contraseña')}
                {campoPassword('confirmacion', 'Confirmar contraseña')}
              </div>
              <p className="account-login">
                ¿Ya tienes cuenta? Inicia sesión <Link to="/login">aqui.</Link>
              </p>
              {(error || estado.mensaje) && (
                <p
                  id="register-message"
                  className="account-message"
                  role="alert"
                  tabIndex={-1}
                  ref={mensajeRef}
                >
                  {error || estado.mensaje}
                </p>
              )}
              <button
                className="account-submit"
                type="submit"
                disabled={estado.cargando}
              >
                {estado.cargando ? 'Creando cuenta…' : 'Crear cuenta'}
              </button>
            </form>
          )}
        </div>
      </section>
    </main>
  )
}
