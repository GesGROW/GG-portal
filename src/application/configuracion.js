import { validarAdministracion, SolicitudObsoleta } from '../ports/administracion.js'
import { crearEntitlements } from '@gesgrow/core/contexts/platform/index.js'

export function crearConfiguracion({
  tenantContext,
  administracion,
  entitlements,
  vigente = () => true,
  onError = async () => {}
}) {
  validarAdministracion(administracion)
  const capacidades = crearEntitlements({ entitlements })
  const ejecutar = async (accion) => {
    const c = await tenantContext.obtener()
    c.exigir('company.manage')
    if (!vigente(c)) throw new SolicitudObsoleta()
    let resultado
    try {
      resultado = await accion(c.tenantId, c)
    } catch (e) {
      if (vigente(c)) await onError(e)
      throw e
    }
    if (!vigente(c)) throw new SolicitudObsoleta()
    return resultado
  }
  const membresia = (d) => ({
    usuarioId: d.usuarioId,
    activo: d.activo,
    roles: [...d.roles],
    trabajadorId: d.trabajadorId || null,
    nombre: d.nombre?.trim() || null
  })
  return Object.freeze({
    accesosCosecha: () =>
      ejecutar((tenant) => {
        if (!administracion.accesosCosecha)
          throw new Error(
            'Usuarios y accesos está pendiente de actualización en el servidor.'
          )
        return administracion.accesosCosecha(tenant)
      }),
    invitarSupervisor: (d) =>
      ejecutar(async (tenant, contexto) => {
        if (
          !d.operacionId ||
          !d.nombre?.trim() ||
          !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email?.trim() ?? '')
        )
          throw new Error('Nombre y correo electrónico válidos requeridos.')
        const accesos = await administracion.accesosCosecha(tenant)
        if (!vigente(contexto)) throw new SolicitudObsoleta()
        if (!accesos.habilitado || !accesos.rolSupervisorId)
          throw new Error('Cosecha debe estar habilitado para invitar a un supervisor.')
        return administracion.invitarUsuario(tenant, {
          operacionId: d.operacionId,
          nombre: d.nombre.trim(),
          email: d.email.trim().toLowerCase(),
          roles: [accesos.rolSupervisorId],
          trabajadorId: null
        })
      }),
    listarAccesos: ({
      busqueda = '',
      rol = '',
      modulo = '',
      estado = '',
      offset = 0
    } = {}) =>
      ejecutar(async (tenant) => {
        const [catalogo, modulos] = await Promise.all([
          administracion.catalogoAccesos(tenant),
          capacidades.modulosHabilitados(tenant)
        ])
        if (modulo && !modulos.includes(modulo))
          return { usuarios: [], total: 0, roles: catalogo.roles, modulos }
        const filtrar = Boolean(rol || estado)
        const primera = await administracion.listarUsuarios(
          tenant,
          busqueda,
          filtrar ? 0 : offset
        )
        let usuarios = primera.usuarios
        if (filtrar) {
          // Los filtros se aplican antes de paginar, también a miembros fuera
          // de la primera página del RPC existente. No modifican autorizaciones.
          while (usuarios.length < primera.total) {
            const pagina = await administracion.listarUsuarios(
              tenant,
              busqueda,
              usuarios.length
            )
            if (!pagina.usuarios.length)
              throw new Error(
                'No se pudo completar el listado de usuarios. Reintente la consulta.'
              )
            usuarios = [...usuarios, ...pagina.usuarios]
          }
          usuarios = usuarios.filter(
            (u) =>
              (!rol || u.roles.includes(rol)) &&
              (!estado ||
                (u.cuentaActiva === false
                  ? 'INACTIVO'
                  : u.activo
                    ? 'ACTIVO'
                    : 'SUSPENDIDO') === estado)
          )
        }
        return {
          usuarios: filtrar ? usuarios.slice(offset, offset + 50) : usuarios,
          total: filtrar ? usuarios.length : primera.total,
          roles: catalogo.roles,
          modulos
        }
      }),
    obtenerUsuario: (usuarioId) =>
      ejecutar((tenant) => administracion.obtenerUsuario(tenant, usuarioId)),
    catalogoAccesos: () => ejecutar((tenant) => administracion.catalogoAccesos(tenant)),
    guardarMembresia: (datos) =>
      ejecutar((tenant) => administracion.guardarMembresia(tenant, membresia(datos))),
    invitarUsuario: (d) =>
      ejecutar((tenant) => {
        if (
          !d.operacionId ||
          !d.nombre?.trim() ||
          !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email?.trim() ?? '')
        )
          throw new Error('Nombre, correo e ID de invitación requeridos.')
        return administracion.invitarUsuario(tenant, {
          operacionId: d.operacionId,
          email: d.email.trim().toLowerCase(),
          nombre: d.nombre.trim(),
          roles: [...d.roles],
          trabajadorId: d.trabajadorId || null
        })
      }),
    modulosHabilitados: () =>
      ejecutar((tenant) => capacidades.modulosHabilitados(tenant))
  })
}
