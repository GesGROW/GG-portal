import { ModuloNoHabilitado } from '@gesgrow/core/contexts/platform/index.js'
export function crearReportesAdapter(consultar) {
  const ejecutar = async (...args) => {
    try {
      return await consultar(...args)
    } catch (e) {
      if (e.message === 'Módulo no habilitado: HARVEST')
        throw new ModuloNoHabilitado('HARVEST')
      throw e
    }
  }
  return Object.freeze({
    tareoRango: (t, f) => ejecutar('harvest_reportes_tareo_rango', {
      p_tenant_id: t, p_campania_id: f.campaniaId, p_desde: f.desde,
      p_hasta: f.hasta, p_trabajador_id: f.trabajadorId || null
    }),
    inicio: (t, f) => ejecutar('harvest_reportes_inicio', {
      p_tenant_id: t, p_campania_id: f.campaniaId, p_tipo: f.tipo, p_recipiente: f.recipiente ?? 'GENERAL'
    }),
    bonos: (t, f) => ejecutar('harvest_reportes_bonos', {
      p_tenant_id: t, p_campania_id: f.campaniaId, p_desde: f.desde ?? null,
      p_hasta: f.hasta ?? null, p_trabajador_id: f.trabajadorId || null
    }),
    campanias: (t) => ejecutar('harvest_reportes_campanias', { p_tenant_id: t }),
    campania: (t, f) =>
      ejecutar(f.recipiente ? 'harvest_reportes_recipiente' : 'harvest_reportes_campania', {
        p_tenant_id: t,
        p_campania_id: f.campaniaId,
        p_tipo: f.tipo,
        p_lote_id: f.loteId,
        p_variedad_id: f.variedadId,
        p_desde: f.desde,
        p_hasta: f.hasta,
        ...(f.recipiente ? { p_recipiente: f.recipiente } : {})
      }),
    validar: (t, c) =>
      ejecutar('harvest_reportes_validar', { p_tenant_id: t, p_campania_id: c }),
    consultar: (t, f) =>
      ejecutar('harvest_reportes_obtener', {
        p_tenant_id: t,
        p_campania_id: f.campaniaId,
        p_tipo: f.tipo,
        p_periodo: f.periodo
      })
  })
}
