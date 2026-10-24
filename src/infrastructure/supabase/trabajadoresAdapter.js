export function crearTrabajadoresAdapter(rpc) {
  const persona = (t, d) => ({
    p_tenant_id: t,
    p_dni: d.dni,
    p_nombres: d.nombres,
    p_apellidos: d.apellidos
  })
  const rol = (t, id, c, r) => ({
    p_tenant_id: t,
    p_trabajador_id: id,
    p_campania_id: c,
    p_rol: r
  })
  return Object.freeze({
    listarCosecha: (t, filtros) =>
      rpc('workforce_cosecha_listar', { p_tenant_id: t, p_filtros: filtros }),
    listar: (t, { busqueda = '', activo = null, offset = 0 } = {}) =>
      rpc('workforce_admin_listar', {
        p_tenant_id: t,
        p_busqueda: busqueda,
        p_activo: activo,
        p_offset: offset
      }),
    obtener: (t, id) => rpc('workforce_admin_obtener', { p_tenant_id: t, p_id: id }),
    crear: (t, d) => rpc('workforce_admin_crear', persona(t, d)),
    editar: (t, id, d) => rpc('workforce_admin_editar', { ...persona(t, d), p_id: id }),
    activar: (t, id) => rpc('workforce_admin_activar', { p_tenant_id: t, p_id: id }),
    desactivar: (t, id) =>
      rpc('workforce_admin_desactivar', { p_tenant_id: t, p_id: id }),
    catalogo: (t) => rpc('workforce_admin_catalogo', { p_tenant_id: t }),
    participaciones: (t, id) =>
      rpc('workforce_admin_participaciones', { p_tenant_id: t, p_trabajador_id: id }),
    asignarRol: (t, id, c, r) => rpc('workforce_admin_asignar_rol', rol(t, id, c, r)),
    retirarRol: (t, id, c, r) => rpc('workforce_admin_retirar_rol', rol(t, id, c, r)),
    habilitarJaberoDelDia: (t, id, c) =>
      rpc('workforce_admin_jornada_jabero', {
        p_tenant_id: t,
        p_trabajador_id: id,
        p_campania_id: c,
        p_habilitar: true
      }),
    retirarJabero: (t, id, c) =>
      rpc('workforce_admin_jornada_jabero', {
        p_tenant_id: t,
        p_trabajador_id: id,
        p_campania_id: c,
        p_habilitar: false
      })
  })
}
