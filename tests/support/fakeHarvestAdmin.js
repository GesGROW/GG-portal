import { AccesoDenegado } from '@gesgrow/core/contexts/identity-access/index.js'
export function fakeHarvestAdmin(ports) {
  const texto = (s) => String(s ?? '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase('es')
  const dia = (s) => s ? new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(s)) : ''
  const enPeriodo = (fecha, f) => (!f.desde || (fecha && dia(fecha) >= f.desde)) && (!f.hasta || (fecha && dia(fecha) <= f.hasta))
  const lotes = {},
    tickets = {},
    asignaciones = {},
    registros = {},
    recibos = {},
    trabajadoresCampania = {}
  for (const t of ports.empresas) {
    trabajadoresCampania[t] = []
    const trabajador = {
        id: t + '-worker',
        dni: '12345678',
        nombre: 'Trabajador ' + t
      },
      a = { operacionId: t + '-asignacion', trabajador }
    lotes[t] = [
      {
        id: t + '-lote',
        campaniaId: t + '-camp',
        campania: 'C-' + t,
        cantidadTickets: 2,
        utilizados: 1,
        creadoEn: '2026-10-21T05:35:00Z',
        estado: 'ASIGNADO',
        asignacion: a
      }
    ]
    registros[t] = [
      {
        id: t + '-registro',
        campaniaId: t + '-camp',
        campania: 'C-' + t,
        codigoTicket: 'TK-' + t + '-USADO',
        loteId: t + '-lote',
        trabajador,
        fechaHora: '2026-10-14T12:00:00Z',
        registradoEn: '2026-10-14T12:00:01Z',
        versionProduccion: 1,
        sesionId: t + '-sesion',
        asignacionOperacionId: a.operacionId,
        loteOperativo: 'Norte',
        variedad: 'Variedad ' + t
      }
    ]
    asignaciones[t] = [
      {
        ...lotes[t][0],
        trabajador,
        operacionId: a.operacionId,
        asignadoEn: '2026-10-22T19:03:00Z'
      }
    ]
    tickets[t] = [
      {
        codigo: 'TK-' + t + '-USADO',
        estado: 'UTILIZADO',
        lote: lotes[t][0],
        registro: registros[t][0]
      },
      {
        codigo: 'TK-' + t + '-LIBRE',
        estado: 'DISPONIBLE',
        lote: lotes[t][0],
        registro: null
      }
    ]
  }
  const guard = (t, manage = false) => {
    if (
      !ports.permisos[t]?.some(
        (p) => p === 'harvest.manage' || (!manage && p === 'harvest.view')
      ) ||
      !ports.modulos[t]?.includes('HARVEST')
    )
      throw new AccesoDenegado('Consulta Harvest denegada.')
  }
  const colecciones = { lotes, tickets, asignaciones, registros }
  ports.harvestAdmin = {
    async trabajadoresCampania(t, campania, rol, offset = 0, f) {
      guard(t)
      ports.calls.push(['trabajadoresCampania', t, campania, rol, offset, ...(f ? [f] : [])])
      const filas = trabajadoresCampania[t].filter(
        (p) => p.campaniaId === campania && p.rol === rol && (!f || (
          (!f.estado || p.activo === (f.estado === 'ACTIVO')) &&
          texto(`${p.nombre} ${p.dni}`).includes(texto(f.busqueda)) && enPeriodo(p.iniciadoEn, f)
        ))
      )
      return structuredClone({
        filas: filas.slice(offset, offset + 50),
        total: filas.length
      })
    },
    async campanias(t) {
      guard(t)
      return [
        {
          id: t + '-camp',
          codigo: 'C-' + t,
          nombre: 'Campaña ' + t,
          estado: 'ACTIVA',
          cutover: null
        }
      ]
    },
    async filtros(t) {
      guard(t)
      return { trabajadores: asignaciones[t].map((a) => a.trabajador) }
    },
    async generar(t, d) {
      guard(t, true)
      ports.calls.push(['generarHarvest', t, d])
      if (recibos[d.operacionId]) return recibos[d.operacionId]
      // Resultado simulado del servidor, no un cálculo de Presentation/Application.
      const r = {
        operacionId: d.operacionId,
        tenantId: t,
        campaniaId: d.campaniaId,
        actorUsuarioId: 'U',
        creadaEn: '2026-10-14T12:00:00Z',
        cantidadTickets: d.cantidadTickets,
        tamanioLote: d.tamanioLote,
        lotes: []
      }
      for (let i = 0; i < d.cantidadTickets; i += d.tamanioLote) {
        const l = {
          id: t + '-generado-' + d.operacionId + '-' + i,
          campaniaId: d.campaniaId,
          campania: 'C-' + t,
          cantidadTickets: Math.min(d.tamanioLote, d.cantidadTickets - i),
          utilizados: 0,
          creadoEn: r.creadaEn,
          estado: 'DISPONIBLE',
          asignacion: null
        }
        lotes[t].push(l)
        for (let j = 0; j < l.cantidadTickets; j++)
          tickets[t].push({
            codigo: `GG-${d.operacionId}-${i}-${j}`,
            estado: 'DISPONIBLE',
            lote: l,
            registro: null
          })
        r.lotes.push({ id: l.id, cantidadTickets: l.cantidadTickets })
      }
      recibos[d.operacionId] = r
      return structuredClone(r)
    },
    async listar(t, tipo, f) {
      guard(t)
      ports.calls.push(['listarHarvest', t, tipo, f])
      const filas = colecciones[tipo][t].filter((d) => {
        const l = tipo === 'tickets' ? d.lote : d,
          trabajador = d.trabajador ?? l.asignacion?.trabajador
        return (
          (!f.campaniaId || l.campaniaId === f.campaniaId) &&
          (!f.loteId || (tipo === 'registros' ? d.loteId : l.id) === f.loteId) &&
          (!f.trabajadorId || trabajador?.id === f.trabajadorId) &&
          (!f.estado || d.estado === f.estado) &&
          texto(JSON.stringify(d)).includes(texto(f.busqueda)) &&
          enPeriodo(tipo === 'asignaciones' ? d.asignadoEn : tipo === 'registros' ? d.fechaHora : l.creadoEn, f)
        )
      })
      return structuredClone({
        filas: filas.slice(f.offset, f.offset + 50),
        total: filas.length
      })
    },
    async obtener(t, tipo, id) {
      guard(t)
      ports.calls.push(['obtenerHarvest', t, tipo, id])
      const d = colecciones[tipo][t].find(
        (d) => (tipo === 'tickets' ? d.codigo : d.id) === id
      )
      if (!d) throw new AccesoDenegado('Recurso de otra empresa.')
      return structuredClone(d)
    }
  }
  return { lotes, tickets, asignaciones, registros, recibos, trabajadoresCampania }
}
