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
  const configuraciones = new Map()
  let revision = 1
  Object.assign(ports.harvestAdmin, {
    bonoConfiguracion: async (t, id) => ({ tenantId: t, campaniaId: id, hoy: '2026-11-06', revision: '0',
      habilitado: false, umbral: 30, monto: 2, bloqueado: false, historial: [] }),
    configuracionCampania: async (t, id) => {
      ports.calls.push(['configuracionCampania', t, id])
      const camp = campanias.find((c) => c.id === id)
      if (!camp) throw new Error('Campaña no disponible')
      if (!configuraciones.has(id)) configuraciones.set(id, {
        tenantId: t, campaniaId: id, cultivoId: cultivo.id, cultivo: cultivo.nombre,
        nombre: camp.nombre, estado: camp.estado, fechaInicio: '2026-11-04', fechaFin: '2027-04-30',
        revision: String(revision++).padStart(32, '0'),
        variedades: cultivo.variedades.map((v) => ({ ...v, activo: true, protegida: false })),
        lotes: [{ id: 'lote-1', nombre: 'Lote 2', activo: true, variedades: ['v1', 'v2'], protegido: false, sesionActiva: false }]
      })
      return structuredClone(configuraciones.get(id))
    },
    guardarConfiguracionCampania: async (t, op, id, d) => {
      ports.calls.push(['guardarConfiguracionCampania', t, op, id, structuredClone(d)])
      if (recibos.has(op)) return structuredClone(recibos.get(op))
      const anterior = configuraciones.get(id)
      if (anterior.revision !== d.revision) throw new Error('La configuración cambió. Recarga y revisa los cambios antes de guardar')
      const resultado = { ...anterior, ...structuredClone(d), revision: String(revision++).padStart(32, '0') }
      configuraciones.set(id, resultado)
      campanias.find((c) => c.id === id).nombre = d.nombre
      recibos.set(op, resultado)
      return structuredClone(resultado)
    },
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
