export function validarPuertosPortal({ identity, acceso, entitlements }) {
  for (const [puerto, metodos] of [
    [identity, ['iniciarSesion', 'obtenerSesion', 'cerrarSesion']],
    [acceso, ['obtenerIdentidad', 'resolverContexto']],
    [entitlements, ['puedeUsarModulo']]
  ])
    for (const metodo of metodos) {
      if (typeof puerto?.[metodo] !== 'function')
        throw new Error(`Portal requiere el puerto ${metodo}.`)
    }
}
