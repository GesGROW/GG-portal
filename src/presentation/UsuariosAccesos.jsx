import { Select } from './Select.jsx'
import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { useCarga } from './GestionUi.jsx'
import { OwnerIcon } from './OwnerAssets.jsx'
import { UsuariosAccesosSkeleton, ColumnasUsuarios } from './OwnerSkeleton.jsx'
import { NOMBRES_ROL } from './nombresAcceso.js'
import './owner-users-access.css'
import './portal-tables.css'

export function UsuariosAccesos({ servicio, invitando = false }) {
  const consulta = useCarga(() => servicio.accesosCosecha(), [servicio])
  const ultimaConsulta = useRef(null)
  if (consulta.datos) ultimaConsulta.current = consulta.datos
  const datos = consulta.datos ?? ultimaConsulta.current
  const location = useLocation()
  const invitar = useRef(null)
  const focoRestaurado = useRef(null)
  useEffect(() => {
    if (
      !invitando &&
      location.state?.enfocarInvitacion &&
      !consulta.cargando &&
      focoRestaurado.current !== location.key
    ) {
      const timer = setTimeout(() => {
        if (invitar.current) {
          invitar.current.focus()
          focoRestaurado.current = location.key
        }
      }, 0)
      return () => clearTimeout(timer)
    }
  }, [invitando, location.key, consulta.cargando])
  useEffect(() => {
    if (!invitando && location.state?.invitacionEnviada) consulta.refrescar()
  }, [invitando, location.key])
  useEffect(() => {
    const actualizar = () => {
      if (document.visibilityState !== 'hidden') consulta.refrescar()
    }
    window.addEventListener('focus', actualizar)
    const intervalo = setInterval(actualizar, 30_000)
    return () => {
      window.removeEventListener('focus', actualizar)
      clearInterval(intervalo)
    }
  }, [servicio])
  return (
    <section className="owner-users-access" aria-labelledby="owner-users-title">
      <h1 id="owner-users-title">Usuarios y accesos</h1>
      {consulta.cargando && !datos ? (
        <UsuariosAccesosSkeleton />
      ) : consulta.error ? (
        <div role="alert">
          <p>{consulta.error.message}</p>
          <button onClick={consulta.refrescar}>Reintentar</button>
        </div>
      ) : (
        <section className="content-ready" aria-labelledby="owner-users-harvest-title">
          <h2 id="owner-users-harvest-title" className="owner-users-module">
            <OwnerIcon name="avocado" />
            <span>Cosecha</span>
          </h2>
          <div className="owner-users-table-wrap">
            <div className="owner-users-table-region">
              <table
                className="owner-users-table portal-data-table"
                aria-label="Usuarios y accesos"
              >
                <ColumnasUsuarios vacio={datos.usuarios.length === 0} />
                <tbody>
                  {datos.usuarios.map((u) => (
                    <tr key={u.id}>
                      <td title={u.nombre}>{u.nombre}</td>
                      <td title={u.email}>{u.email}</td>
                      <td title={NOMBRES_ROL[u.rol] ?? u.rol}>
                        {NOMBRES_ROL[u.rol] ?? u.rol}
                      </td>
                      <td>
                        <span
                          className={`owner-users-status owner-users-status-${u.estado.toLowerCase()}`}
                        >
                          {u.estado === 'ACEPTADA'
                            ? 'Aceptada'
                            : u.estado === 'PENDIENTE'
                              ? 'Pendiente'
                              : 'Inactivo'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {datos.habilitado && datos.rolSupervisorId ? (
              <Link
                ref={invitar}
                className="owner-users-invite"
                to="/configuracion/invitaciones"
              >
                <OwnerIcon name="plus" />
                <span>Invita a participar a un usuario</span>
              </Link>
            ) : (
              <p className="owner-users-unavailable" role="status">
                {datos.habilitado
                  ? 'El rol Supervisor está pendiente de configuración.'
                  : 'Activa Cosecha para invitar a un usuario.'}
              </p>
            )}
          </div>
        </section>
      )}
      {invitando && <InvitacionSupervisor servicio={servicio} />}
    </section>
  )
}

function InvitacionSupervisor({ servicio }) {
  const navigate = useNavigate()
  const dialogo = useRef(null)
  const enviando = useRef(false)
  const enviada = useRef(false)
  const intencion = useRef(null)
  const [nombre, setNombre] = useState('')
  const [email, setEmail] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState(null)
  const cancelar = () => {
    if (!enviando.current)
      navigate('/configuracion/usuarios', {
        replace: true,
        state: { enfocarInvitacion: true }
      })
  }
  useEffect(() => {
    const el = dialogo.current,
      previo = document.activeElement,
      overflow = document.documentElement.style.overflow
    document.documentElement.style.overflow = 'hidden'
    if (el.showModal) el.showModal()
    else el.setAttribute('open', '')
    el.querySelector('input')?.focus()
    return () => {
      el.close?.()
      document.documentElement.style.overflow = overflow
      if (previo?.isConnected) previo.focus()
    }
  }, [])
  async function enviar(event) {
    event.preventDefault()
    if (enviando.current || enviada.current) return
    const normalizada = { nombre: nombre.trim(), email: email.trim().toLowerCase() }
    if (!normalizada.nombre || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizada.email)) {
      setError(new Error('Ingresa un nombre y correo electrónico válidos.'))
      return
    }
    // Conserva exactamente la solicitud ante un resultado de transporte incierto.
    if (!intencion.current)
      intencion.current = { operacionId: crypto.randomUUID(), ...normalizada }
    enviando.current = true
    setOcupado(true)
    setError(null)
    try {
      await servicio.invitarSupervisor(intencion.current)
      enviada.current = true
      navigate('/configuracion/usuarios', {
        replace: true,
        state: { invitacionEnviada: true, enfocarInvitacion: true }
      })
    } catch (e) {
      if (e.name !== 'SolicitudObsoleta') setError(e)
    } finally {
      enviando.current = false
      setOcupado(false)
    }
  }
  return (
    <dialog
      ref={dialogo}
      className="owner-users-dialog"
      aria-labelledby="owner-invitation-title"
      aria-modal="true"
      onCancel={(event) => {
        event.preventDefault()
        cancelar()
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          const r = event.currentTarget.getBoundingClientRect()
          if (
            event.clientX < r.left ||
            event.clientX > r.right ||
            event.clientY < r.top ||
            event.clientY > r.bottom
          )
            cancelar()
        }
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault()
          cancelar()
        }
        if (event.key !== 'Tab') return
        const elementos = [
            ...dialogo.current.querySelectorAll(
              'button:not(:disabled),input:not(:disabled),select:not(:disabled)'
            )
          ],
          primero = elementos[0],
          ultimo = elementos.at(-1)
        if (event.shiftKey && document.activeElement === primero) {
          event.preventDefault()
          ultimo?.focus()
        } else if (!event.shiftKey && document.activeElement === ultimo) {
          event.preventDefault()
          primero?.focus()
        }
      }}
    >
      <button
        type="button"
        className="owner-users-dialog-close"
        aria-label="Cerrar invitación"
        onClick={cancelar}
        disabled={ocupado}
      >
        ×
      </button>
      <h2 id="owner-invitation-title">Invitación</h2>
      <form onSubmit={enviar}>
        <fieldset disabled={ocupado}>
          <label>
            <span>Nombre</span>
            <input
              required
              autoComplete="name"
              maxLength={200}
              value={nombre}
              readOnly={!!intencion.current}
              onChange={(e) => setNombre(e.target.value)}
            />
          </label>
          <label>
            <span>Correo electrónico</span>
            <input
              required
              type="email"
              autoComplete="email"
              value={email}
              readOnly={!!intencion.current}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label className="owner-users-role">
            <span>Rol</span>
            <span className="owner-users-select">
              <Select value="SUPERVISOR_COSECHA" onChange={() => {}}>
                <option value="SUPERVISOR_COSECHA">Supervisor</option>
              </Select>
              <OwnerIcon name="chevron" />
            </span>
          </label>
        </fieldset>
        {error && <p role="alert">{error.message}</p>}
        <button className="owner-users-send" disabled={ocupado} type="submit">
          {ocupado
            ? 'Enviando…'
            : error && intencion.current
              ? 'Reintentar envío'
              : 'Enviar'}
        </button>
      </form>
    </dialog>
  )
}
