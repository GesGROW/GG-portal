import { Navigate } from 'react-router'
import { UsuariosAccesos } from './UsuariosAccesos.jsx'
import { AccesoUsuario } from './AccesoUsuario.jsx'
import { Suscripcion } from './Suscripcion.jsx'

export function Configuracion({ portal, path }) {
  const servicio = portal.configuracion
  const [, , seccion, id] = path.split('/')
  if (!seccion) return <Navigate to="/configuracion/usuarios" replace />
  if (seccion === 'suscripcion')
    return portal.suscripcion ? (
      <Suscripcion servicio={portal.suscripcion} />
    ) : (
      <p role="alert">Consulta comercial no disponible.</p>
    )
  if (seccion === 'usuarios' || seccion === 'invitaciones') {
    if (!servicio) return <p role="alert">Administración no disponible.</p>
    return id ? (
      <AccesoUsuario key={id} servicio={servicio} portal={portal} id={id} />
    ) : (
      <UsuariosAccesos servicio={servicio} invitando={seccion === 'invitaciones'} />
    )
  }
  return null
}
