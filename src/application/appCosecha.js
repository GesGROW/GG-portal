import { crearEntitlements } from '@gesgrow/core/contexts/platform/index.js'
import { SolicitudObsoleta } from '../ports/administracion.js'

export function normalizarEnlaceApp(enlace) {
  if (!enlace) return null
  try {
    const url = new URL(enlace)
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
    if (
      url.username ||
      url.password ||
      (url.protocol !== 'https:' && !(local && url.protocol === 'http:'))
    )
      return null
    url.hash = ''
    url.search = ''
    return url.href
  } catch {
    return null
  }
}

export function crearAppCosechaPortal({
  puerto,
  scopePara,
  entitlements,
  enlaceApp = 'https://gg-app-m-harvest.vercel.app/'
}) {
  if (!puerto) return null
  const enlace = normalizarEnlaceApp(enlaceApp)
  const capacidades = crearEntitlements({ entitlements })
  // El token se conserva sólo durante esta sesión de aplicación y por actor/empresa.
  const codigos = new Map()
  const clave = (c) => `${c.tenantId}:${c.usuarioId}`
  const validarDispositivo = (d, tenantId) => {
    if (
      !d ||
      !d.id ||
      d.tenantId !== tenantId ||
      !['ACTIVO', 'REVOCADO'].includes(d.estado)
    )
      throw new Error('El dispositivo no corresponde a esta empresa.')
    return d
  }
  async function ejecutar(accion) {
    const scope = scopePara(['company.manage', 'harvest.manage'], 'HARVEST')
    const c = await scope.tenantContext.obtener()
    const vigente = () => {
      if (!scope.vigente(c)) throw new SolicitudObsoleta()
    }
    try {
      vigente()
      await capacidades.exigirModulo(c.tenantId, 'HARVEST')
      vigente()
      const r = await accion(c, vigente, scope)
      vigente()
      return r
    } catch (error) {
      if (scope.vigente(c)) await scope.onError(error)
      throw error
    }
  }
  return Object.freeze({
    enlaceInstalacion: enlace,
    listar: () =>
      ejecutar(async (c) => {
        const r = await puerto.listar(c.tenantId)
        if (!r || r.tenantId !== c.tenantId || !Array.isArray(r.dispositivos))
          throw new Error('La respuesta no corresponde a esta empresa.')
        r.dispositivos.forEach((d) => validarDispositivo(d, c.tenantId))
        const guardado = codigos.get(clave(c))
        const qr =
          guardado?.scope.vigente(guardado.contexto) &&
          guardado.qr.id === r.vinculacion?.id
            ? guardado.qr
            : null
        if (!qr) codigos.delete(clave(c))
        return { ...r, qr }
      }),
    generar: () =>
      ejecutar(async (c, vigente, scope) => {
        if (!enlace) throw new Error('El enlace de la aplicación no está disponible.')
        codigos.delete(clave(c))
        const r = await puerto.generar(c.tenantId)
        vigente()
        if (
          !r ||
          r.tenantId !== c.tenantId ||
          !r.id ||
          !/^[0-9a-f]{64}$/.test(r.token) ||
          !Number.isFinite(Date.parse(r.venceEn))
        )
          throw new Error('No se pudo obtener un QR válido para esta empresa.')
        const destino = new URL(enlace)
        destino.hash = new URLSearchParams({ vincular: r.token }).toString()
        const qr = { id: r.id, enlace: destino.href, venceEn: r.venceEn }
        // Una nueva sesión del mismo usuario no hereda el QR de la sesión anterior.
        codigos.set(clave(c), { qr, contexto: c, scope })
        return qr
      }),
    renovar: (id) =>
      ejecutar(async (c) => {
        if (typeof id !== 'string' || !id) throw new Error('Selecciona un dispositivo.')
        const r = validarDispositivo(await puerto.renovar(c.tenantId, id), c.tenantId)
        if (r.id !== id || r.estado !== 'ACTIVO')
          throw new Error('No se pudo confirmar la renovación del dispositivo.')
        return r
      }),
    revocar: (id) =>
      ejecutar(async (c) => {
        if (typeof id !== 'string' || !id) throw new Error('Selecciona un dispositivo.')
        const r = validarDispositivo(await puerto.revocar(c.tenantId, id), c.tenantId)
        if (r.id !== id || r.estado !== 'REVOCADO')
          throw new Error('No se pudo confirmar la revocación del dispositivo.')
        return r
      })
  })
}
