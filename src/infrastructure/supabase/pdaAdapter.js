export function crearPdaAdapter(consultar) {
  return Object.freeze({
    listar: (tenantId) =>
      consultar('pda_administrar_dispositivos', { p_tenant_id: tenantId }),
    generar: (tenantId) =>
      consultar('pda_generar_vinculacion', { p_tenant_id: tenantId }),
    revocar: (tenantId, dispositivoId) =>
      consultar('pda_revocar_dispositivo', {
        p_tenant_id: tenantId,
        p_dispositivo_id: dispositivoId
      })
  })
}
