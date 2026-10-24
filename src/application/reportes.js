import { crearReportesHarvest } from '@gesgrow/core/contexts/harvest/index.js'
import { crearEntitlements } from '@gesgrow/core/contexts/platform/index.js'
import { SolicitudObsoleta } from '../ports/administracion.js'
import { serializarCsv } from '../ports/exportacion.js'

const congelar = (o) => {
  if (o && typeof o === 'object') {
    Object.values(o).forEach(congelar)
    Object.freeze(o)
  }
  return o
}
export function crearReportesPortal({ puerto, scope, entitlements, exportacion }) {
  if (!puerto) return null
  const servicio = crearReportesHarvest({ reportesHarvest: puerto }),
    capacidades = crearEntitlements({ entitlements }),
    snapshots = new WeakMap()
  const vigente = (c) => {
    if (!scope.vigente(c)) throw new SolicitudObsoleta()
  }
  async function ejecutar(accion) {
    const c = await scope.tenantContext.obtener()
    vigente(c)
    try {
      await capacidades.exigirModulo(c.tenantId, 'HARVEST')
      vigente(c)
      const r = await accion(c)
      vigente(c)
      return r
    } catch (e) {
      if (scope.vigente(c)) await scope.onError(e)
      throw e
    }
  }
  return Object.freeze({
    campanias: () => ejecutar((c) => servicio.campanias(c.tenantId)),
    campania: (f) =>
      ejecutar(async (c) => {
        const {
          campaniaId,
          tipo,
          loteId = null,
          variedadId = null,
          desde = null,
          hasta = null
        } = f
        const fecha = (v) =>
          v === null ||
          (typeof v === 'string' &&
            /^\d{4}-\d{2}-\d{2}$/.test(v) &&
            Number.isFinite(Date.parse(v + 'T12:00:00Z')) &&
            new Date(v + 'T12:00:00Z').toISOString().slice(0, 10) === v)
        if (
          !campaniaId ||
          !['PRODUCCION', 'RENDIMIENTO'].includes(tipo) ||
          !fecha(desde) ||
          !fecha(hasta) ||
          (desde && hasta && desde > hasta)
        )
          throw new Error('Filtros de reporte inválidos.')
        const r = await puerto.campania(c.tenantId, {
          campaniaId,
          tipo,
          loteId: loteId || null,
          variedadId: variedadId || null,
          desde,
          hasta
        })
        if (
          r?.tenantId !== c.tenantId ||
          r?.campaniaId !== campaniaId ||
          r?.tipo !== tipo ||
          r?.datos?.ok !== true ||
          !r.datos.metricas ||
          !Array.isArray(r.datos.evolucion) ||
          !Array.isArray(r.datos.ranking) ||
          !r.datos.catalogo
        )
          throw new Error('Respuesta de reporte de campaña inválida.')
        return congelar(r)
      }),
    consultar: (f) =>
      ejecutar(async (c) => {
        const r = congelar(await servicio.consultar(c.tenantId, f))
        snapshots.set(r, c)
        return r
      }),
    exportar: (snapshot) =>
      ejecutar(async (c) => {
        const anterior = snapshots.get(snapshot)
        if (!anterior || !scope.vigente(anterior) || anterior.tenantId !== c.tenantId)
          throw new SolicitudObsoleta()
        // Exporta exactamente las filas mostradas. Revalida autorización y campaña
        // en servidor, sin aceptar un dataset fabricado por Presentation.
        if ((await servicio.validar(c.tenantId, snapshot.campaniaId)) !== true)
          throw new Error('Exportación no autorizada.')
        vigente(c)
        if (!exportacion) throw new Error('Exportación no disponible.')
        const { columnas, filas } = tablaCsv(snapshot)
        return exportacion.guardar({
          nombre: `${snapshot.tipo.toLowerCase()}-${snapshot.campaniaId}.csv`,
          mime: 'text/csv;charset=utf-8',
          contenido: serializarCsv(columnas, filas)
        })
      })
  })
}
function tablaCsv({ tipo, datos: d }) {
  if (tipo === 'RESUMEN' || tipo === 'DASHBOARD')
    return {
      columnas: [
        'Total jabas',
        'Cosechadores',
        'Lotes operativos',
        'Sesiones',
        'Días con producción',
        'Última actividad'
      ],
      filas: [
        [
          d.resumen.total_jabas,
          d.resumen.total_cosechadores,
          d.resumen.total_lotes,
          d.resumen.total_sesiones,
          d.resumen.dias_con_produccion,
          d.resumen.ultima_lectura
        ]
      ]
    }
  if (tipo === 'RANKING')
    return {
      columnas: ['Posición', 'DNI', 'Cosechador', 'Jabas', 'Última actividad'],
      filas: d.ranking.map((f) => [
        f.posicion,
        f.cosechador_dni,
        f.cosechador,
        f.total_jabas,
        f.ultima_lectura
      ])
    }
  if (tipo === 'DIARIA')
    return {
      columnas: ['Fecha', 'Jabas', 'Cosechadores', 'Sesiones'],
      filas: d.produccion.map((f) => [
        f.fecha,
        f.total_jabas,
        f.total_cosechadores,
        f.total_sesiones
      ])
    }
  return {
    columnas: [
      'Lote',
      'Nombre',
      'Variedad',
      'Jabas',
      'Cosechadores',
      'Sesiones',
      'Última actividad'
    ],
    filas: d.produccion.map((f) => [
      f.lote_codigo,
      f.lote_nombre,
      f.variedad,
      f.total_jabas,
      f.total_cosechadores,
      f.total_sesiones,
      f.ultima_lectura
    ])
  }
}
