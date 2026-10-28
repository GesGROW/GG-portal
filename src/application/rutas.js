import { esOwnerSinOperacion } from './accesoOwner.js'

export const RUTAS_PORTAL = Object.freeze(
  [
    {
      path: '/',
      nombre: 'Inicio',
      marca: '01',
      permiso: null,
      modulo: null,
      descripcion:
        'Su espacio de gestión de GesGROW. Seleccione una sección para comenzar.'
    },
    {
      path: '/modulos',
      nombre: 'Módulos',
      marca: '02',
      permiso: 'company.manage',
      modulo: null,
      descripcion: 'Módulos adquiridos y disponibles para la empresa.'
    },
    {
      path: '/cosecha',
      nombre: 'Cosecha',
      marca: '04',
      permisos: ['harvest.view', 'harvest.manage'],
      modulo: 'HARVEST',
      descripcion: 'Espacio de consulta y gestión de la cosecha de su empresa.'
    },
    {
      path: '/reportes',
      nombre: 'Reportes',
      marca: '05',
      permiso: 'reports.view',
      modulo: 'HARVEST',
      descripcion: 'Espacio para consultar la producción y los reportes de cosecha.'
    },
    {
      path: '/configuracion',
      nombre: 'Configuración',
      marca: '06',
      permiso: 'company.manage',
      modulo: null,
      descripcion: 'Espacio de configuración de la empresa y su equipo de gestión.'
    }
  ].map((r) =>
    Object.freeze({
      ...r,
      ...(r.permisos ? { permisos: Object.freeze(r.permisos) } : {})
    })
  )
)

export function evaluarRuta(path, contexto, modulos) {
  if (['/cosecha/app', '/cosecha/dispositivos'].includes(path)) {
    const permisos =
      path === '/cosecha/dispositivos'
        ? ['harvest.manage']
        : ['harvest.view', 'harvest.manage', 'harvest.operate']
    if (!contexto || !permisos.some((p) => contexto.permite(p)))
      return {
        estado: 'denegada',
        mensaje: 'No tiene permiso para acceder a esta sección.'
      }
    if (!modulos.includes('HARVEST'))
      return {
        estado: 'denegada',
        mensaje: 'Esta empresa no tiene Cosecha habilitado.'
      }
    return {
      estado: 'permitida',
      ruta: RUTAS_PORTAL.find((r) => r.path === '/cosecha')
    }
  }
  if (esOwnerSinOperacion(contexto) && /^\/(cosecha|reportes)(\/|$)/.test(path))
    return {
      estado: 'denegada',
      mensaje:
        'El owner consulta el resumen en Home. Esta sección requiere permisos de un rol operativo del módulo.'
    }
  if (
    path === '/cosecha/trabajadores' ||
    (path === '/cosecha' &&
      contexto?.permite('workforce.manage') &&
      !contexto.permite('harvest.view') &&
      !contexto.permite('harvest.manage'))
  ) {
    if (!contexto?.permite('workforce.manage'))
      return {
        estado: 'denegada',
        mensaje: 'Se requiere permiso de gestión de trabajadores.'
      }
    if (!modulos.includes('HARVEST') || !modulos.includes('WORKFORCE'))
      return {
        estado: 'denegada',
        mensaje: 'Se requieren los módulos Cosecha y Personal habilitados.'
      }
    return {
      estado: 'permitida',
      ruta: RUTAS_PORTAL.find((r) => r.path === '/cosecha')
    }
  }
  if (path === '/cosecha/generar' || path === '/cosecha/configurar') {
    const base = evaluarRuta('/cosecha', contexto, modulos)
    return base.estado === 'permitida' && !contexto.permite('harvest.manage')
      ? {
          estado: 'denegada',
          mensaje: 'Se requiere harvest.manage para gestionar la cosecha.'
        }
      : base
  }
  if (['/cosecha/produccion', '/cosecha/rendimiento'].includes(path)) {
    const base = evaluarRuta('/cosecha', contexto, modulos)
    return base.estado === 'permitida' && !contexto.permite('reports.view')
      ? {
          estado: 'denegada',
          mensaje: 'Se requiere reports.view para consultar reportes.'
        }
      : base
  }
  const configuracion =
    /^\/configuracion\/(usuarios|invitaciones|suscripcion)$/.test(path) ||
    /^\/configuracion\/usuarios\/[a-zA-Z0-9-]+$/.test(path)
  const ruta = RUTAS_PORTAL.find(
    (r) =>
      r.path ===
      (configuracion
        ? '/configuracion'
        : /^\/cosecha\/(cosechadores|jaberos|supervisores)$/.test(path) ||
            /^\/cosecha\/(lotes|tickets|asignaciones|registros)(\/[^/]+)?$/.test(path)
          ? '/cosecha'
          : /^\/reportes\/(resumen|ranking|diaria|lotes)$/.test(path)
            ? '/reportes'
            : path)
  )
  if (!ruta)
    return { estado: 'no-encontrada', mensaje: 'La página solicitada no existe.' }
  if (!contexto)
    return { estado: 'denegada', mensaje: 'Seleccione una empresa autorizada.' }
  if (
    (ruta.permiso && !contexto.permite(ruta.permiso)) ||
    (ruta.permisos && !ruta.permisos.some((p) => contexto.permite(p)))
  )
    return {
      estado: 'denegada',
      mensaje: 'No tiene permiso para acceder a esta sección.'
    }
  if (ruta.modulo && !modulos.includes(ruta.modulo))
    return {
      estado: 'denegada',
      mensaje: 'Esta empresa no tiene el módulo requerido habilitado.'
    }
  return { estado: 'permitida', ruta }
}

export function navegacionPermitida(contexto, modulos) {
  const rutas = RUTAS_PORTAL.filter(
    (r) =>
      evaluarRuta(r.path, contexto, modulos).estado === 'permitida' ||
      (r.path === '/cosecha' &&
        evaluarRuta('/cosecha/trabajadores', contexto, modulos).estado === 'permitida')
  )
  // Los roles operativos pueden acceder a la app sin gestionar el módulo.
  if (
    !rutas.some((r) => r.path === '/cosecha') &&
    evaluarRuta('/cosecha/app', contexto, modulos).estado === 'permitida'
  )
    rutas.push(
      Object.freeze({
        ...RUTAS_PORTAL.find((r) => r.path === '/cosecha'),
        path: '/cosecha/app',
        nombre: 'App de Cosecha'
      })
    )
  return Object.freeze(rutas)
}
