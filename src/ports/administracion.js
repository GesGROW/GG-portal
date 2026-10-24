export function validarAdministracion(puerto) {
  for (const metodo of [
    'listarUsuarios',
    'obtenerUsuario',
    'catalogoAccesos',
    'guardarMembresia',
    'invitarUsuario'
  ])
    if (typeof puerto?.[metodo] !== 'function')
      throw new Error(`Administración requiere ${metodo}.`)
  return puerto
}
export class SolicitudObsoleta extends Error {
  constructor() {
    super('La empresa o sesión cambió.')
    this.name = 'SolicitudObsoleta'
  }
}
