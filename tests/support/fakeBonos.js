// Datos ilustrativos exclusivamente para pruebas y revisión visual.
export function fakeBonos(ports) {
  let config = { tenantId: 'A', campaniaId: 'A-camp', hoy: '2026-11-06', revision: '0',
    habilitado: false, umbral: 30, monto: 2, bloqueado: false, historial: [] }
  const detalle = [
    { trabajadorId: 'p1', nombre: 'Gianella Sotil', dni: '12345678', fecha: '2026-11-06', jabas: 32, adicionales: 2, bono: 4, habilitado: true, umbral: 30, monto: 2 },
    { trabajadorId: 'p1', nombre: 'Gianella Sotil', dni: '12345678', fecha: '2026-11-05', jabas: 35, adicionales: 5, bono: 10, habilitado: true, umbral: 30, monto: 2 },
    { trabajadorId: 'p2', nombre: 'Carlos Quispe', dni: '87654321', fecha: '2026-11-06', jabas: 30, adicionales: 0, bono: 0, habilitado: true, umbral: 30, monto: 2 }
  ]
  ports.harvestAdmin.bonoConfiguracion = async (t, id) => ({ ...structuredClone(config), tenantId: t, campaniaId: id })
  ports.harvestAdmin.guardarBono = async (t, id, d) => {
    ports.calls.push(['guardarBono', t, id, d])
    if (config.bloqueado) throw new Error('El bono está bloqueado porque ya se inició una sesión de lectura.')
    config = { ...config, ...d, revision: String(Number(config.revision) + 1), historial: [
      { ...d, id: 'regla', usuario: 'Ana Gestión', creadoEn: '2026-11-06T12:00:00Z' }, ...config.historial] }
    return structuredClone(config)
  }
  ports.reportesHarvest.bonos = async (t, f) => {
    ports.calls.push(['bonos', t, f])
    const filas = detalle.filter(r => (!f.trabajadorId || r.trabajadorId === f.trabajadorId) &&
      (!f.desde || r.fecha >= f.desde) && (!f.hasta || r.fecha <= f.hasta))
    const resumen = [...new Set(filas.map(r => r.trabajadorId))].map(id => ({ ...filas.find(r => r.trabajadorId === id),
      jabas: filas.filter(r=>r.trabajadorId===id).reduce((s,r)=>s+r.jabas,0),
      adicionales: filas.filter(r=>r.trabajadorId===id).reduce((s,r)=>s+r.adicionales,0),
      bono: filas.filter(r=>r.trabajadorId===id).reduce((s,r)=>s+r.bono,0) }))
    return { tenantId: t, campaniaId: f.campaniaId, tipo: 'BONOS', actualizadoEn: '2026-11-06T15:00:00Z',
      datos: { ok: true, hoy: '2026-11-06', desde: f.desde ?? '2026-11-05', hasta: f.hasta ?? '2026-11-06',
        detalle: filas, resumen, totalBono: filas.reduce((s,r)=>s+r.bono,0), totalAdicionales: filas.reduce((s,r)=>s+r.adicionales,0) } }
  }
  return { bloquear: () => { config.bloqueado = true } }
}
