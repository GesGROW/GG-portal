export function crearCosechaAdapter(consultar) {
  return Object.freeze({
    catalogoCultivos: (t) => consultar('harvest_cultivos_catalogo', { p_tenant_id: t }),
    crearCultivo: (t, op, datos) =>
      consultar('harvest_cultivos_crear', {
        p_tenant_id: t,
        p_operacion_id: op,
        p_datos: datos
      }),
    crearCampania: (t, op, cultivo, datos) =>
      consultar('harvest_cultivos_campania', {
        p_tenant_id: t,
        p_operacion_id: op,
        p_cultivo_id: cultivo,
        p_datos: datos
      }),
    solicitarUnion: (t, cultivo) =>
      consultar('harvest_cultivos_solicitar', {
        p_tenant_id: t,
        p_cultivo_id: cultivo
      }),
    resolverUnion: (t, solicitud, aceptar) =>
      consultar('harvest_cultivos_resolver', {
        p_tenant_id: t,
        p_solicitud_id: solicitud,
        p_aceptar: aceptar
      }),
    filtros: (t, c) =>
      consultar('harvest_admin_filtros', { p_tenant_id: t, p_campania_id: c }),
    campanias: (t) => consultar('harvest_admin_campanias', { p_tenant_id: t }),
    trabajadoresCampania: (t, campania, rol, offset = 0, filtros) =>
      consultar(
        filtros ? 'harvest_admin_trabajadores_filtrados' : 'harvest_admin_trabajadores',
        {
          p_tenant_id: t,
          p_campania_id: campania,
          p_rol: rol,
          p_offset: offset,
          ...(filtros
            ? {
                p_busqueda: filtros.busqueda,
                p_activo: filtros.estado ? filtros.estado === 'ACTIVO' : null,
                p_desde: filtros.desde,
                p_hasta: filtros.hasta
              }
            : {})
        }
      ),
    generar: (t, d) =>
      consultar('harvest_admin_generar', {
        p_tenant_id: t,
        p_campania_id: d.campaniaId,
        p_operacion_id: d.operacionId,
        p_cantidad: d.cantidadTickets,
        p_tamanio: d.tamanioLote
      }),
    listar: (t, tipo, f) =>
      consultar(
        f.desde !== undefined || f.hasta !== undefined
          ? 'harvest_admin_listar_filtrado'
          : 'harvest_admin_listar',
        {
          p_tenant_id: t,
          p_tipo: tipo,
          p_campania_id: f.campaniaId,
          p_busqueda: f.busqueda,
          p_lote_id: f.loteId,
          p_trabajador_id: f.trabajadorId,
          p_estado: f.estado,
          p_offset: f.offset,
          ...(f.desde !== undefined || f.hasta !== undefined
            ? {
                p_desde: f.desde ?? null,
                p_hasta: f.hasta ?? null
              }
            : {})
        }
      ),
    obtener: (t, tipo, id) =>
      consultar('harvest_admin_obtener', { p_tenant_id: t, p_tipo: tipo, p_clave: id })
  })
}
