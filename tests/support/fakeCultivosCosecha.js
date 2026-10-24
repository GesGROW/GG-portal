// Sólo fixtures de pruebas; la aplicación de producción consulta las RPC.
export function fakeCultivosCosecha(ports, { propio = false } = {}) {
  const cultivo = {
    id: 'crop-blue',
    nombre: 'Arándanos',
    color: '#3B64EC',
    variedades: [
      { id: 'v1', nombre: 'Ventura' },
      { id: 'v2', nombre: 'Biloxi' }
    ],
    lotes: [{ nombre: 'Lote 2', variedades: ['Ventura', 'Biloxi'] }],
    supervisores: [{ nombre: 'Deysi Regalado' }],
    campanias: [
      { id: 'A-camp', nombre: 'Campaña Arándano 2026', estado: 'ACTIVA', cutover: null }
    ]
  }
  const datos = {
    propios: propio ? [cultivo] : [],
    disponibles: propio ? [] : [cultivo],
    solicitudes: []
  }
  const campanias = propio ? [...cultivo.campanias] : []
  const recibos = new Map()
  Object.assign(ports.harvestAdmin, {
    catalogoCultivos: async () => structuredClone(datos),
    campanias: async () => structuredClone(campanias),
    crearCultivo: async (t, op, d) => {
      if (recibos.has(op)) return recibos.get(op)
      const c = {
        id: crypto.randomUUID(),
        nombre: d.nombre,
        color: d.color,
        variedades: d.variedades.map((nombre) => ({ nombre, id: crypto.randomUUID() })),
        lotes: d.lotes,
        supervisores: [{ nombre: 'Ana Gestión' }],
        campanias: []
      }
      const camp = {
        id: crypto.randomUUID(),
        nombre: d.campania.nombre,
        estado: 'ACTIVA',
        cutover: null
      }
      c.campanias.push(camp)
      datos.propios.push(c)
      campanias.push(camp)
      const resultado = { cultivoId: c.id, campaniaId: camp.id }
      recibos.set(op, resultado)
      return resultado
    },
    crearCampania: async (t, op, id, d) => {
      if (recibos.has(op)) return recibos.get(op)
      const camp = {
        id: crypto.randomUUID(),
        nombre: d.nombre,
        estado: 'ACTIVA',
        cutover: null
      }
      datos.propios.find((c) => c.id === id).campanias.push(camp)
      campanias.push(camp)
      const r = { cultivoId: id, campaniaId: camp.id }
      recibos.set(op, r)
      return r
    },
    solicitarUnion: async (t, id) => {
      datos.disponibles.find((c) => c.id === id).solicitudEstado = 'PENDIENTE'
      return { estado: 'PENDIENTE' }
    },
    resolverUnion: async (t, id, aceptar) => {
      datos.solicitudes = datos.solicitudes.filter((s) => s.id !== id)
      return { estado: aceptar ? 'ACEPTADA' : 'RECHAZADA' }
    }
  })
  return datos
}
