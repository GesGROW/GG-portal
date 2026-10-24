export function fakeTrabajadores(puertos) {
  const campanias = [
    { id: 'A-camp', nombre: 'Arándano 2026', estado: 'ACTIVA' },
    { id: 'A-mand', nombre: 'Mandarina 2026', estado: 'ACTIVA' }
  ]
  const relacion = (id, rol = 'COSECHADOR') => ({
    id: 'R-' + id,
    campaniaId: 'A-camp',
    campania: 'Arándano 2026',
    estadoCampania: 'ACTIVA',
    rol,
    activo: true,
    vigente: true
  })
  const trabajadores = [
    {
      id: 'W1',
      dni: '74851236',
      nombres: 'Ana',
      apellidos: 'Campos Ruiz',
      activo: true,
      participaciones: [relacion('W1')],
      primeraActividad: '2026-09-02T15:00:00Z',
      ultimaActividad: '2026-10-19T15:43:00Z'
    },
    {
      id: 'W2',
      dni: '70123456',
      nombres: 'Ricardo',
      apellidos: 'Sola',
      activo: true,
      participaciones: [relacion('W2', 'JABERO')],
      primeraActividad: null,
      ultimaActividad: null
    },
    {
      id: 'W3',
      dni: '71234567',
      nombres: '',
      apellidos: '',
      activo: true,
      participaciones: [relacion('W3')],
      primeraActividad: null,
      ultimaActividad: null
    },
    {
      id: 'W4',
      dni: '72555123',
      nombres: 'Carla',
      apellidos: 'Torres',
      activo: false,
      participaciones: [],
      primeraActividad: null,
      ultimaActividad: null
    }
  ]
  const copia = (v) => structuredClone(v)
  const obtener = (id) => {
    const t = trabajadores.find((t) => t.id === id)
    if (!t) throw new Error('Trabajador no disponible.')
    return t
  }
  const guardar = (id, d) => {
    Object.assign(obtener(id), d)
    return copia(obtener(id))
  }
  const normalizar = (s) =>
    s
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toLowerCase()
  const registrar =
    (nombre, accion) =>
    async (t, ...args) => {
      puertos.calls.push([nombre, t, ...args])
      return accion(...args)
    }
  function cambiar(id, c, r, activo) {
    const w = obtener(id)
    let relacion = w.participaciones.find((p) => p.campaniaId === c && p.rol === r)
    if (!relacion) {
      relacion = {
        id: crypto.randomUUID(),
        campaniaId: c,
        campania: campanias.find((x) => x.id === c).nombre,
        rol: r
      }
      w.participaciones.push(relacion)
    }
    Object.assign(relacion, { activo, vigente: activo })
    if (r === 'JABERO') relacion.fechaJabero = '2026-10-19'
    return copia(w.participaciones)
  }
  puertos.workforce = {
    listarCosecha: registrar('listarTrabajadores', (f = {}) => {
      const filas = trabajadores
        .map((t) => ({
          ...t,
          datosCompletos: !!(t.nombres.trim() && t.apellidos.trim())
        }))
        .filter(
          (t) =>
            (!f.busqueda ||
              normalizar(t.dni + ' ' + t.nombres + ' ' + t.apellidos).includes(
                normalizar(f.busqueda)
              )) &&
            (!f.estado || t.activo === (f.estado === 'ACTIVO')) &&
            (!f.datos || t.datosCompletos === (f.datos === 'COMPLETOS')) &&
            ((!f.campania && !f.funcion) ||
              t.participaciones.some(
                (r) =>
                  r.activo &&
                  (!f.campania || r.campaniaId === f.campania) &&
                  (!f.funcion || r.rol === f.funcion)
              ))
        )
      return copia({
        trabajadores: filas.slice(f.offset || 0, (f.offset || 0) + 50),
        total: filas.length,
        campanias,
        resumen: {
          activos: filas.filter((t) => t.activo).length,
          pendientes: filas.filter((t) => !t.datosCompletos).length,
          cosechadores: filas.filter(
            (t) =>
              t.activo &&
              t.participaciones.some((r) => r.activo && r.rol === 'COSECHADOR')
          ).length
        }
      })
    }),
    listar: registrar('listarPersonal', () => ({
      trabajadores: copia(trabajadores),
      total: trabajadores.length
    })),
    obtener: registrar('obtenerTrabajador', (id) => copia(obtener(id))),
    crear: registrar('crearTrabajador', (d) => {
      if (trabajadores.some((t) => t.dni === d.dni)) throw new Error('DNI duplicado.')
      const t = { id: crypto.randomUUID(), ...d, activo: true, participaciones: [] }
      trabajadores.push(t)
      return copia(t)
    }),
    editar: registrar('editarTrabajador', (id, d) => guardar(id, d)),
    activar: registrar('activarTrabajador', (id) => guardar(id, { activo: true })),
    desactivar: registrar('desactivarTrabajador', (id) =>
      guardar(id, { activo: false })
    ),
    catalogo: registrar('catalogoTrabajadores', () => ({
      campanias,
      roles: ['COSECHADOR', 'SUPERVISORA']
    })),
    participaciones: registrar('participacionesTrabajador', (id) =>
      copia(obtener(id).participaciones)
    ),
    asignarRol: registrar('asignarFuncion', (id, c, r) => cambiar(id, c, r, true)),
    retirarRol: registrar('retirarFuncion', (id, c, r) => cambiar(id, c, r, false)),
    habilitarJaberoDelDia: registrar('habilitarJaberoHoy', (id, c) =>
      cambiar(id, c, 'JABERO', true)
    ),
    retirarJabero: registrar('retirarJabero', (id, c) =>
      cambiar(id, c, 'JABERO', false)
    )
  }
  return { trabajadores, campanias }
}
