import { AccesoDenegado } from '@gesgrow/core/contexts/identity-access/index.js'
export function fakeReportes(ports, { vacio = false } = {}) {
  const hechos = []
  const nombres = [
    'Gianella Sotil',
    'Romina Salazar',
    'Kira Mollar',
    'Lucía Mendoza',
    'Carlos Quispe',
    'Sofía Ramírez',
    'Mateo Flores',
    'Valentina Silva',
    'Gabriel Mamani',
    'Camila Torres',
    'Diego Castillo'
  ]
  for (const [i, cantidad] of [67, 35, 24, 20, 18, 17, 10, 6, 3, 2, 1].entries())
    for (let n = 0; !vacio && n < cantidad; n++)
      hechos.push({
        id: `p${i}`,
        nombre: nombres[i],
        jabas: 1,
        fecha: '2026-10-22',
        loteId: n % 2 ? 'l2' : 'l1',
        variedadId: n % 2 ? 'v2' : 'v1'
      })
  for (let i = 0; !vacio && i < 7; i++)
    for (let n = 0; n < [8, 12, 18, 26, 34, 23, 18][i]; n++)
      hechos.push({
        id: `p${n % 11}`,
        nombre: nombres[n % 11],
        fecha: `2026-10-${15 + i}`,
        loteId: n % 2 ? 'l2' : 'l1',
        variedadId: n % 2 ? 'v2' : 'v1',
        jabas: 1
      })
  const archivos = [],
    ahora = '2026-10-14T15:00:00Z'
  const exigir = async (t, camp) => {
    const c = await ports.acceso.resolverContexto(t)
    if (!c.permisos.includes('reports.view'))
      throw new AccesoDenegado('Sin permiso reports.view.')
    if (!(await ports.entitlements.puedeUsarModulo(t, 'HARVEST')))
      throw new AccesoDenegado('Módulo deshabilitado.')
    if (camp && ![t + '-camp', t + '-cerrada'].includes(camp))
      throw new AccesoDenegado('Campaña de otra empresa.')
  }
  const resumen = {
    total_jabas: vacio ? 0 : 43,
    total_cosechadores: vacio ? 0 : 2,
    total_jaberos: vacio ? 0 : 1,
    total_lotes: vacio ? 0 : 2,
    total_sesiones: vacio ? 0 : 3,
    dias_con_produccion: vacio ? 0 : 2,
    ultima_lectura: vacio ? null : ahora
  }
  ports.reportesHarvest = {
    async campania(t, f) {
      await exigir(t, f.campaniaId)
      ports.calls.push(['reporteCampania', t, { ...f }])
      const hoy = '2026-10-22',
        desde = f.desde ?? (f.tipo === 'RENDIMIENTO' ? hoy : '2026-10-15'),
        hasta = f.hasta ?? hoy
      const filtrados = hechos.filter(
        (p) =>
          p.fecha >= desde &&
          p.fecha <= hasta &&
          (!f.loteId || p.loteId === f.loteId) &&
          (!f.variedadId || p.variedadId === f.variedadId)
      )
      const grupos = new Map(),
        dias = new Map()
      for (const p of filtrados) {
        dias.set(p.fecha, (dias.get(p.fecha) ?? 0) + 1)
        grupos.set(p.id, {
          id: p.id,
          nombre: p.nombre,
          jabas: (grupos.get(p.id)?.jabas ?? 0) + 1
        })
      }
      const ranking = [...grupos.values()].sort(
        (a, b) => b.jabas - a.jabas || a.nombre.localeCompare(b.nombre)
      )
      let posicion = 0,
        previo = null
      ranking.forEach((p) => {
        if (p.jabas !== previo) posicion++
        previo = p.jabas
        p.posicion = posicion
      })
      const evolucion = []
      for (
        let d = Date.parse(desde + 'T12:00:00Z');
        d <= Date.parse(hasta + 'T12:00:00Z');
        d += 86400000
      ) {
        const fecha = new Date(d).toISOString().slice(0, 10)
        evolucion.push({ fecha, jabas: dias.get(fecha) ?? 0 })
      }
      return {
        tenantId: t,
        campaniaId: f.campaniaId,
        tipo: f.tipo,
        actualizadoEn: ahora,
        datos: {
          ok: true,
          hoy,
          desde,
          hasta,
          catalogo: {
            lotes: [
              { id: 'l1', nombre: 'Lote 1', variedades: ['v1'] },
              { id: 'l2', nombre: 'Lote 2', variedades: ['v2'] }
            ],
            variedades: [
              { id: 'v1', nombre: 'Ventura' },
              { id: 'v2', nombre: 'Biloxi' }
            ]
          },
          metricas: {
            totalJabas: filtrados.length,
            jabasHoy: dias.get(hoy) ?? 0,
            diasProduccion: dias.size,
            promedioDiario: dias.size
              ? Math.round((filtrados.length / dias.size) * 10) / 10
              : 0,
            cosechadoresActivos: grupos.size,
            promedioCosechador: grupos.size
              ? Math.round((filtrados.length / grupos.size) * 10) / 10
              : 0,
            mayorRendimiento: ranking[0]?.jabas ?? 0
          },
          evolucion,
          ranking
        }
      }
    },
    async campanias(t) {
      await exigir(t)
      return [
        {
          id: t + '-camp',
          codigo: t + '-2026',
          nombre: 'Campaña ' + t,
          estado: 'ACTIVA'
        },
        {
          id: t + '-cerrada',
          codigo: t + '-2025',
          nombre: 'Cerrada ' + t,
          estado: 'CERRADA'
        }
      ]
    },
    async validar(t, c) {
      await exigir(t, c)
      ports.calls.push(['validarReporte', t, c])
      return true
    },
    async consultar(t, f) {
      await exigir(t, f.campaniaId)
      ports.calls.push(['consultarReporte', t, { ...f }])
      const datos = {
        ok: true,
        campania: { id: f.campaniaId, nombre: 'Campaña ' + t },
        zona_horaria: 'America/Lima'
      }
      if (['DASHBOARD', 'RESUMEN'].includes(f.tipo)) datos.resumen = { ...resumen }
      if (f.tipo === 'DASHBOARD')
        datos.hoy = { fecha: '2026-10-14', total_jabas: vacio ? 0 : 23 }
      if (f.tipo === 'RANKING') {
        datos.periodo = f.periodo
        datos.ranking = vacio
          ? []
          : [
              {
                posicion: 1,
                cosechador_dni: '12345678',
                cosechador: 'Ana ' + t,
                total_jabas: 23,
                ultima_lectura: ahora
              },
              {
                posicion: 2,
                cosechador_dni: '87654321',
                cosechador: 'Bruno ' + t,
                total_jabas: 20,
                ultima_lectura: ahora
              }
            ]
      }
      if (f.tipo === 'DIARIA')
        datos.produccion = vacio
          ? []
          : [
              {
                fecha: '2026-10-14',
                total_jabas: 23,
                total_cosechadores: 1,
                total_sesiones: 2
              },
              {
                fecha: '2026-10-13',
                total_jabas: 20,
                total_cosechadores: 1,
                total_sesiones: 1
              }
            ]
      if (f.tipo === 'LOTES')
        datos.produccion = vacio
          ? []
          : [
              {
                lote_id: '2',
                lote_codigo: 'L2',
                lote_nombre: 'Sur',
                variedad: 'Roja',
                total_jabas: 23,
                total_cosechadores: 1,
                total_sesiones: 2,
                ultima_lectura: ahora
              },
              {
                lote_id: '1',
                lote_codigo: 'L1',
                lote_nombre: 'Norte',
                variedad: 'Verde',
                total_jabas: 20,
                total_cosechadores: 1,
                total_sesiones: 1,
                ultima_lectura: ahora
              }
            ]
      return {
        tenantId: t,
        campaniaId: f.campaniaId,
        tipo: f.tipo,
        actualizadoEn: ahora,
        datos
      }
    }
  }
  ports.exportacion = {
    guardar(a) {
      archivos.push(a)
    }
  }
  return { archivos }
}
