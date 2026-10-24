export function crearSuscripcionAdapter(consultar) {
  return Object.freeze({
    consultar: (t) =>
      consultar('platform_portal_obtener_suscripcion', { p_tenant_id: t }),
    puedeAdministrar: (t) =>
      consultar('platform_puede_administrar', { p_tenant_id: t }),
    solicitarCambio: (d) =>
      consultar('platform_portal_solicitar_cambio', {
        p_operacion_id: d.operacionId,
        p_tenant_id: d.tenantId,
        p_tipo: d.tipoEvento,
        p_parametros: d.parametros,
        p_motivo: d.motivo,
        p_version_base: d.versionBase,
        p_effective_at: d.effectiveAt
      })
  })
}
