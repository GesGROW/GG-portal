export class SesionExpirada extends Error {
  constructor(mensaje = 'Su sesión ha expirado. Inicie sesión nuevamente.') {
    super(mensaje)
    this.name = 'SesionExpirada'
  }
}
export class ServicioNoDisponible extends Error {
  constructor(
    mensaje = 'No se pudo conectar. Compruebe su conexión e inténtelo nuevamente.'
  ) {
    super(mensaje)
    this.name = 'ServicioNoDisponible'
  }
}
export class CredencialesInvalidas extends Error {
  constructor(mensaje = 'No se pudo iniciar sesión. Revise su correo y contraseña.') {
    super(mensaje)
    this.name = 'CredencialesInvalidas'
  }
}
