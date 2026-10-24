import { Select } from './Select.jsx'
import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { Skeleton } from './Ui.jsx'
import selectIcon from '../assets/users/select.svg'
import './user-access-editor.css'

import { NOMBRES_ROL, NOMBRES_MODULO } from './nombresAcceso.js'
export { NOMBRES_ROL, NOMBRES_MODULO } from './nombresAcceso.js'
const gruposPermisos = [
  ['Empresa y usuarios', ['company.manage']],
  ['Campañas', ['campaign.manage']],
  ['Personal', ['workforce.manage']],
  ['Registros', ['harvest.view']],
  ['Operación de campo', ['harvest.operate']],
  ['Tickets', ['harvest.manage']],
  ['Reportes', ['reports.view']],
  ['Estructura agrícola', ['farm.manage']]
]

function useDatos(cargar, claves) {
  const [consulta, setConsulta] = useState({ cargando: true })
  const [version, setVersion] = useState(0)
  useEffect(() => {
    let vigente = true
    setConsulta({ cargando: true })
    Promise.resolve()
      .then(cargar)
      .then(
        (datos) => {
          if (vigente) setConsulta({ datos })
        },
        (error) => {
          if (vigente && error.name !== 'SolicitudObsoleta') setConsulta({ error })
        }
      )
    return () => {
      vigente = false
    }
  }, [...claves, version])
  return { ...consulta, reintentar: () => setVersion((v) => v + 1) }
}
function Datos({ consulta, children }) {
  if (consulta.cargando) return <Skeleton text="Cargando accesos…" />
  if (consulta.error)
    return (
      <div className="access-load-error">
        <p role="alert">{consulta.error.message}</p>
        <button type="button" onClick={consulta.reintentar}>
          Reintentar
        </button>
      </div>
    )
  return children(consulta.datos)
}

function Selector({ label, children, ...props }) {
  return (
    <label className="access-field">
      <span>{label}</span>
      <span className="access-select">
        <Select {...props}>{children}</Select>
        <img src={selectIcon} alt="" />
      </span>
    </label>
  )
}
function SelectorRol({ catalogo, roles, cambiar }) {
  return (
    <Selector
      label="Rol"
      value={roles.length > 1 ? 'multiple' : (roles[0] ?? '')}
      onChange={(e) => cambiar(e.target.value ? [e.target.value] : [])}
    >
      <option value="">Sin rol asignado</option>
      {roles.length > 1 && <option value="multiple">Varios roles actuales</option>}
      {catalogo.roles.map((r) => (
        <option key={r.id} value={r.id}>
          {NOMBRES_ROL[r.codigo] ?? r.codigo}
        </option>
      ))}
    </Selector>
  )
}
function ModulosEmpresa({ modulos, compacto = false }) {
  return (
    <fieldset className={`access-modules${compacto ? ' access-module-chips' : ''}`}>
      <legend>Módulos de la empresa</legend>
      {modulos.map((m) => (
        <div key={m}>
          <label className="access-check">
            <input
              type="checkbox"
              role={compacto ? 'switch' : undefined}
              checked
              disabled
            />
            <span>{NOMBRES_MODULO[m] ?? m}</span>
          </label>
        </div>
      ))}
      {!compacto && modulos.length > 0 && (
        <small>
          Disponibles en la suscripción actual. El rol define las acciones permitidas.
        </small>
      )}
      {!modulos.length && <p>La empresa no tiene módulos habilitados.</p>}
    </fieldset>
  )
}
function Alcance({ harvest }) {
  return (
    <fieldset className="access-scope">
      <legend>{harvest ? 'Campañas permitidas' : 'Alcance de acceso'}</legend>
      <label className="access-check">
        <input type="radio" checked readOnly name="alcance" value="TODAS" />
        <span>Todas las campañas</span>
      </label>
      <small>
        Los permisos se aplican a toda la empresa. La selección de campañas todavía no
        está disponible.
      </small>
    </fieldset>
  )
}
function PermisosRol({ permisos }) {
  const grupos = gruposPermisos.filter(([, claves]) =>
    claves.some((p) => permisos.includes(p))
  )
  return (
    <div className="access-inherited">
      <p>Permisos heredados del rol</p>
      <ul>
        {grupos.map(([nombre]) => (
          <li key={nombre}>{nombre}</li>
        ))}
      </ul>
      {!grupos.length && <small>Sin permisos efectivos</small>}
    </div>
  )
}
function Editor({ usuario, catalogo, modulos, servicio, portal }) {
  const [guardado, setGuardado] = useState(usuario)
  const [roles, setRoles] = useState(usuario.roles)
  const [activo, setActivo] = useState(usuario.activo)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState(null)
  const [mensaje, setMensaje] = useState('')
  const permisos =
    activo && usuario.cuentaActiva !== false
      ? [
          ...new Set(
            catalogo.roles
              .filter((r) => roles.includes(r.id))
              .flatMap((r) => r.permisos)
          )
        ]
      : []
  const cambiar = (setter) => (value) => {
    setter(value)
    setMensaje('')
  }
  async function guardar(event) {
    event.preventDefault()
    setGuardando(true)
    setError(null)
    setMensaje('')
    try {
      const resultado = await servicio.guardarMembresia({
        usuarioId: usuario.usuarioId,
        nombre: guardado.nombre,
        roles,
        activo,
        trabajadorId: guardado.trabajadorId
      })
      setGuardado(resultado)
      setRoles(resultado.roles)
      setActivo(resultado.activo)
      await portal.revalidar()
      setMensaje('Cambios guardados.')
    } catch (e) {
      if (e.name !== 'SolicitudObsoleta') setError(e)
    } finally {
      setGuardando(false)
    }
  }
  return (
    <section className="user-access-editor">
      <nav className="access-breadcrumb" aria-label="Ruta de usuario">
        <Link to="/configuracion/usuarios">Usuarios y accesos</Link>
        <span aria-hidden="true">/</span>
        <span>{guardado.nombre}</span>
      </nav>
      <h1>Acceso de usuario</h1>
      <p className="access-description">
        Configura qué puede hacer esta cuenta y sobre qué campañas puede trabajar.
      </p>
      <div className="access-account-card">
        <div>
          <h2>{guardado.nombre}</h2>
          <p>{usuario.email}</p>
        </div>
        <span className="access-account-status">
          {usuario.cuentaActiva === false
            ? 'Cuenta inactiva'
            : guardado.activo
              ? 'Activo'
              : 'Suspendido'}
        </span>
      </div>
      <form onSubmit={guardar}>
        <fieldset className="access-editor-fields" disabled={guardando}>
          <div className="access-editor-columns">
            <section className="access-editor-card">
              <h2>Acceso general</h2>
              <SelectorRol
                catalogo={catalogo}
                roles={roles}
                cambiar={cambiar(setRoles)}
              />
              <small>
                El rol define qué acciones puede realizar dentro de GesGROW.
              </small>
              <ModulosEmpresa modulos={modulos} />
              <Selector
                label="Estado de acceso"
                value={activo ? 'activa' : 'suspendida'}
                onChange={(e) => cambiar(setActivo)(e.target.value === 'activa')}
              >
                <option value="activa">Activo</option>
                <option value="suspendida">Suspendido</option>
              </Selector>
              <small>
                Suspender esta membresía revoca su acceso a la empresa y conserva su
                historial.
              </small>
              {usuario.cuentaActiva === false && (
                <p className="access-warning">
                  La cuenta global está inactiva. Activar la membresía no reactiva la
                  cuenta.
                </p>
              )}
            </section>
            <section className="access-editor-card">
              <h2>
                {modulos.includes('HARVEST')
                  ? 'Alcance de Cosecha'
                  : 'Alcance de acceso'}
              </h2>
              <Alcance harvest={modulos.includes('HARVEST')} />
              <PermisosRol permisos={permisos} />
            </section>
          </div>
        </fieldset>
        {error && (
          <p role="alert" className="access-message">
            {error.message}
          </p>
        )}
        {mensaje && (
          <p role="status" className="access-message">
            {mensaje}
          </p>
        )}
        <div className="access-form-actions">
          <Link className="access-cancel" to="/configuracion/usuarios">
            Cancelar
          </Link>
          <button className="access-submit" disabled={guardando}>
            {guardando ? 'Guardando…' : 'Guardar cambios'}
          </button>
        </div>
      </form>
    </section>
  )
}
export function AccesoUsuario({ servicio, portal, id }) {
  const consulta = useDatos(async () => {
    const [usuario, catalogo, modulos] = await Promise.all([
      servicio.obtenerUsuario(id),
      servicio.catalogoAccesos(),
      servicio.modulosHabilitados()
    ])
    return { usuario, catalogo, modulos }
  }, [servicio, id])
  return (
    <Datos consulta={consulta}>
      {(datos) => <Editor key={id} {...datos} servicio={servicio} portal={portal} />}
    </Datos>
  )
}
