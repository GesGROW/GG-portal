import { useRef, useState } from 'react'
import { Link } from 'react-router'
import photo from '../assets/login/seedling.png'
import logo from '../assets/login/logo.png'

export function Login({ portal, estado }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const enviando = useRef(false)

  async function enviar(event) {
    event.preventDefault()
    if (enviando.current || estado.cargando) return
    enviando.current = true
    const secreto = password
    setPassword('')
    setShowPassword(false)
    try {
      await portal.login({ email: email.trim(), password: secreto })
    } finally {
      enviando.current = false
    }
  }

  return (
    <main className="account-screen figma-login-current" data-node-id="64:341">
      <img className="account-photo" src={photo} alt="" aria-hidden="true" />
      <section className="account-panel" aria-labelledby="login-title">
        <img className="account-logo" src={logo} alt="GesGROW" />
        <div className="account-content">
          <h1 id="login-title">Iniciar sesión</h1>
          <form className="account-form" onSubmit={enviar} aria-busy={estado.cargando}>
            <div className="account-fields">
              <div className="account-field">
                <label htmlFor="login-email">Correo electrónico</label>
                <input
                  id="login-email"
                  name="email"
                  type="email"
                  autoComplete="username"
                  autoCapitalize="none"
                  spellCheck={false}
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  disabled={estado.cargando}
                />
              </div>
              <div className="account-field">
                <div className="account-password-label">
                  <label htmlFor="login-password">Contraseña</label>
                  <button
                    className="account-show"
                    type="button"
                    onClick={() => setShowPassword((show) => !show)}
                    aria-controls="login-password"
                    aria-label={
                      showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'
                    }
                    aria-pressed={showPassword}
                    disabled={estado.cargando}
                  >
                    {showPassword ? 'Ocultar' : 'Mostrar'}
                  </button>
                </div>
                <input
                  id="login-password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  disabled={estado.cargando}
                />
              </div>
            </div>
            <p className="account-login">
              ¿No tienes cuenta? Crear una cuenta{' '}
              <Link to="/registro" aria-label="Crear una cuenta de empresa">
                aqui.
              </Link>
            </p>
            {estado.mensaje && (
              <p className="account-message" role="alert">
                {estado.mensaje}
              </p>
            )}
            <button className="account-submit" type="submit" disabled={estado.cargando}>
              {estado.cargando ? 'Verificando…' : 'Iniciar sesión'}
            </button>
          </form>
        </div>
      </section>
    </main>
  )
}
