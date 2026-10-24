import { crearGestionPersonal } from '@gesgrow/core/contexts/workforce/index.js'
import { crearEntitlements } from '@gesgrow/core/contexts/platform/index.js'
import { SolicitudObsoleta } from '../ports/administracion.js'

export function crearTrabajadoresPortal({ puerto, scope, entitlements }) {
  if (!puerto) return null
  const gestion = crearGestionPersonal({ workforce: puerto })
  const capacidades = crearEntitlements({ entitlements })
  return Object.freeze(
    Object.fromEntries(
      Object.entries({
        ...gestion,
        listarCosecha: (t, filtros) => puerto.listarCosecha(t, filtros)
      }).map(([nombre, accion]) => [
        nombre,
        async (...args) => {
          const c = await scope.tenantContext.obtener()
          const comprobar = () => {
            if (!scope.vigente(c)) throw new SolicitudObsoleta()
          }
          comprobar()
          try {
            await capacidades.exigirModulo(c.tenantId, 'HARVEST')
            await capacidades.exigirModulo(c.tenantId, 'WORKFORCE')
            comprobar()
            const resultado = await accion(c.tenantId, ...args)
            comprobar()
            return resultado
          } catch (error) {
            if (scope.vigente(c)) await scope.onError(error)
            throw error
          }
        }
      ])
    )
  )
}
