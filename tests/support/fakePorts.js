import { AccesoDenegado } from '@gesgrow/core/contexts/identity-access/index.js'
import { CredencialesInvalidas } from '../../src/ports/errores.js'

export function fakePorts({
  empresas = ['A'],
  autenticado = false,
  permisos = {
    A: [
      'company.manage',
      'campaign.manage',
      'workforce.manage',
      'harvest.view',
      'reports.view'
    ],
    B: ['harvest.operate']
  },
  modulos = { A: ['HARVEST', 'CAMPAIGN', 'WORKFORCE'], B: ['HARVEST'] }
} = {}) {
  let sesion = autenticado,
    listener,
    usuarioId = 'U',
    nombreUsuario = 'Ana Gestión',
    empresasNombres = {},
    resolver = null,
    obtenerModulos = null
  const calls = []
  return {
    calls,
    empresas,
    permisos,
    modulos,
    identity: {
      async iniciarSesion(datos) {
        calls.push(['login', datos])
        if (datos.password !== 'clave') throw new CredencialesInvalidas()
        sesion = true
      },
      obtenerSesion: async () => (sesion ? { sujeto: 'SUJETO-' + usuarioId } : null),
      async cerrarSesion() {
        calls.push(['logout'])
        sesion = false
      },
      observarSesion(fn) {
        listener = fn
        return () => {
          listener = null
        }
      }
    },
    acceso: {
      async crearEmpresa({ operacionId, nombreEmpresa, nombreOwner }) {
        calls.push(['crearEmpresa', { operacionId, nombreEmpresa, nombreOwner }])
        const id = 'NUEVA'
        if (!empresas.includes(id)) empresas.push(id)
        empresasNombres[id] = nombreEmpresa
        nombreUsuario = nombreOwner
        permisos[id] = ['company.manage', 'reports.view']
        modulos[id] = []
        return { tenantId: id, usuarioId, membresiaId: 'M-' + id }
      },
      async obtenerIdentidad() {
        return {
          usuario: { id: usuarioId, nombre: nombreUsuario, email: 'ana@example.test' },
          membresias: empresas.map((id) => ({
            id: 'M-' + id,
            tenantId: id,
            usuarioId,
            activo: true
          })),
          empresas: empresas.map((id) => ({
            id,
            nombre: empresasNombres[id] ?? 'Empresa ' + id
          }))
        }
      },
      async resolverContexto(tenantId) {
        calls.push(['resolver', tenantId])
        if (resolver) await resolver(tenantId)
        if (!sesion || !empresas.includes(tenantId))
          throw new AccesoDenegado('Empresa no autorizada.')
        return {
          usuarioId,
          membresiaId: 'M-' + tenantId,
          tenantId,
          empresa: empresasNombres[tenantId] ?? 'Empresa ' + tenantId,
          permisos: permisos[tenantId] ?? []
        }
      }
    },
    entitlements: {
      async puedeUsarModulo(tenantId, modulo) {
        calls.push(['modulo', tenantId, modulo])
        if (obtenerModulos) await obtenerModulos(tenantId, modulo)
        if (!sesion || !empresas.includes(tenantId))
          throw new AccesoDenegado('Empresa no autorizada.')
        return modulos[tenantId]?.includes(modulo) ?? false
      }
    },
    expirar() {
      sesion = false
    },
    notificar(
      tipo = 'cerrada',
      evento = tipo === 'cerrada' ? 'SIGNED_OUT' : 'TOKEN_REFRESHED'
    ) {
      if (tipo === 'cerrada') sesion = false
      listener?.({ tipo, evento })
    },
    setResolver(fn) {
      resolver = fn
    },
    setEntitlements(fn) {
      obtenerModulos = fn
    },
    cambiarUsuario(id) {
      usuarioId = id
    }
  }
}
