import {
  crearAdministracionComercial,
  EVENTOS_COMERCIALES
} from '@gesgrow/core/contexts/platform/index.js'
import { SolicitudObsoleta } from '../ports/administracion.js'

export function crearSuscripcionPortal({ comercial, scope }) {
  if (!comercial) return null
  async function ejecutar(accion) {
    const c = await scope.tenantContext.obtener()
    if (!scope.vigente(c)) throw new SolicitudObsoleta()
    const servicio = crearAdministracionComercial({
      comercial,
      tenantContext: { obtener: async () => c }
    })
    try {
      const r = await accion(servicio)
      if (!scope.vigente(c)) throw new SolicitudObsoleta()
      return r
    } catch (e) {
      if (scope.vigente(c)) await scope.onError(e)
      throw e
    }
  }
  return Object.freeze({
    consultar: () => ejecutar((s) => s.consultar()),
    ...Object.fromEntries(
      Object.keys(EVENTOS_COMERCIALES)
        .filter((m) => m !== 'crearSuscripcion')
        .map((m) => [
          m,
          (datos) =>
            ejecutar((s) => {
              if (datos.versionBase === undefined)
                throw new Error(
                  'Versión comercial requerida. Actualice la suscripción.'
                )
              return s[m](datos)
            })
        ])
    )
  })
}
