import { crearEntitlements } from '@gesgrow/core/contexts/platform/index.js'
import { SolicitudObsoleta } from '../ports/administracion.js'
import { crearConfiguracionCampania } from './configuracionCampania.js'

export const COLORES_CULTIVO = Object.freeze([
  '#F92D2D',
  '#FF8800',
  '#1FD200',
  '#137D15',
  '#3B64EC',
  '#6F1D79',
  '#D54E4E',
  '#F1E907',
  '#ED3BB8',
  '#D9D9D9'
])

export function hoyLima() {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Lima',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(new Date())
  return ['year', 'month', 'day']
    .map((p) => partes.find((x) => x.type === p).value)
    .join('-')
}

function texto(valor, max, etiqueta) {
  if (typeof valor !== 'string' || !valor.trim() || valor.trim().length > max)
    throw new Error(`${etiqueta}: ingresa un nombre de hasta ${max} caracteres.`)
  return valor.trim()
}
function fecha(valor) {
  return (
    typeof valor === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(valor) &&
    !Number.isNaN(Date.parse(valor)) &&
    new Date(valor).toISOString().slice(0, 10) === valor
  )
}
function campania(d) {
  if (!fecha(d?.fechaInicio) || d.fechaInicio < hoyLima())
    throw new Error('La fecha de inicio debe ser hoy o una fecha posterior.')
  if (!fecha(d?.fechaFin) || d.fechaFin < d.fechaInicio)
    throw new Error('La fecha fin debe ser igual o posterior al inicio.')
  return {
    nombre: texto(d.nombre, 100, 'Campaña'),
    fechaInicio: d.fechaInicio,
    fechaFin: d.fechaFin
  }
}
function cultivo(d) {
  const color = typeof d?.color === 'string' ? d.color.toUpperCase() : ''
  if (!COLORES_CULTIVO.includes(color))
    throw new Error('Escoge un color para el cultivo.')
  const variedades = (d.variedades ?? [])
    .filter((v) => typeof v === 'string' && v.trim())
    .map((v) => texto(v, 100, 'Variedad'))
  if (
    !variedades.length ||
    new Set(variedades.map((v) => v.toLowerCase())).size !== variedades.length
  )
    throw new Error('Agrega al menos una variedad; los nombres no pueden repetirse.')
  const lotes = (d.lotes ?? [])
    .filter((l) => l.nombre?.trim())
    .map((l) => {
      const asignadas = [...new Set(l.variedades ?? [])]
      if (!asignadas.length || asignadas.some((v) => !variedades.includes(v)))
        throw new Error('Cada lote debe tener al menos una variedad de este cultivo.')
      return { nombre: texto(l.nombre, 100, 'Lote'), variedades: asignadas }
    })
  if (
    !lotes.length ||
    new Set(lotes.map((l) => l.nombre.toLowerCase())).size !== lotes.length
  )
    throw new Error('Agrega al menos un lote; los nombres no pueden repetirse.')
  return {
    nombre: texto(d.nombre, 100, 'Cultivo'),
    color,
    variedades,
    lotes,
    campania: campania(d.campania)
  }
}

export function crearCultivosCosechaPortal({ puerto, scopePara, entitlements }) {
  const metodos = [
    'catalogoCultivos',
    'crearCultivo',
    'crearCampania',
    'solicitarUnion',
    'resolverUnion'
  ]
  if (!metodos.every((m) => typeof puerto?.[m] === 'function')) return null
  const capacidades = crearEntitlements({ entitlements })
  const ejecutar = async (metodo, ...args) => {
    const scope = scopePara('harvest.manage', 'HARVEST')
    const c = await scope.tenantContext.obtener()
    if (!scope.vigente(c)) throw new SolicitudObsoleta()
    try {
      await capacidades.exigirModulo(c.tenantId, 'HARVEST')
      if (!scope.vigente(c)) throw new SolicitudObsoleta()
      const parametros = args.map((a) => (typeof a === 'function' ? a(c) : a))
      const r = await puerto[metodo](c.tenantId, ...parametros)
      if (!scope.vigente(c)) throw new SolicitudObsoleta()
      if (['configuracionCampania', 'guardarConfiguracionCampania', 'bonoConfiguracion', 'guardarBono'].includes(metodo) && r?.tenantId !== c.tenantId)
        throw new Error('La configuración no corresponde a la empresa autorizada.')
      return r
    } catch (e) {
      if (scope.vigente(c)) await scope.onError(e)
      throw e
    }
  }
  // Un reintento de la misma intención conserva el UUID incluso tras un fallo de red.
  const operaciones = new Map()
  const operacion = (metodo, datos, ...args) => {
    return ejecutar(
      metodo,
      (c) => {
        const clave = JSON.stringify([c.tenantId, c.usuarioId, metodo, ...args, datos])
        if (!operaciones.has(clave)) operaciones.set(clave, crypto.randomUUID())
        return operaciones.get(clave)
      },
      ...args,
      datos
    )
  }
  return Object.freeze({
    bonoConfiguracion: async (id) => {
      const r = await ejecutar('bonoConfiguracion', id)
      if (r?.campaniaId !== id) throw new Error('El bono no corresponde a la campaña solicitada.')
      return r
    },
    guardarBono: async (id, d) => {
      if (!id || typeof d?.habilitado !== 'boolean' || !Number.isSafeInteger(d.umbral) ||
          d.umbral < 0 || d.umbral > 1000000 || !Number.isFinite(d.monto) || d.monto <= 0 ||
          d.monto > 1000000 || Math.abs(d.monto * 100 - Math.round(d.monto * 100)) > 1e-6)
        throw new Error('Ingresa un umbral entero y un monto positivo con hasta dos decimales.')
      const jarras = { jarrasHabilitado: d.jarrasHabilitado ?? false, jarrasUmbral: d.jarrasUmbral ?? 30, jarrasMonto: d.jarrasMonto ?? 2 }
      if (typeof jarras.jarrasHabilitado !== 'boolean' || !Number.isSafeInteger(jarras.jarrasUmbral) || jarras.jarrasUmbral < 0 || jarras.jarrasUmbral > 1000000 || !Number.isFinite(jarras.jarrasMonto) || jarras.jarrasMonto <= 0 || jarras.jarrasMonto > 1000000 || Math.abs(jarras.jarrasMonto * 100 - Math.round(jarras.jarrasMonto * 100)) > 1e-6)
        throw new Error('Ingresa un umbral entero y un monto positivo con hasta dos decimales para jarras.')
      const r = await ejecutar('guardarBono', id, { habilitado: d.habilitado, umbral: d.umbral,
        monto: d.monto, ...(d.jarrasHabilitado !== undefined ? jarras : {}), revision: d.revision, hoy: d.hoy })
      if (r?.campaniaId !== id) throw new Error('El bono no corresponde a la campaña solicitada.')
      return r
    },
    ...crearConfiguracionCampania({ ejecutar, operacion }),
    catalogoCultivos: () => ejecutar('catalogoCultivos'),
    crearCultivo: (d) => operacion('crearCultivo', cultivo(d)),
    crearCampania: (id, d) => operacion('crearCampania', campania(d), id),
    solicitarUnion: (id) => ejecutar('solicitarUnion', id),
    resolverUnion: (id, aceptar) => ejecutar('resolverUnion', id, aceptar === true)
  })
}
