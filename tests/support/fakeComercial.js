import { AccesoDenegado } from '@gesgrow/core/contexts/identity-access/index.js'
import { ConflictoVersionComercial } from '@gesgrow/core/contexts/platform/index.js'
export function fakeComercial(ports, { delegado = true } = {}) {
  const datos = {},
    recibos = new Map(),
    delegaciones = { A: delegado, B: delegado }
  for (const t of ['A', 'B'])
    datos[t] = {
      tenantId: t,
      versionBase: '1',
      puedeAdministrar: delegado,
      actualizadoEn: '2026-10-14T15:00:00Z',
      estado: {
        suscripcion: {
          id: t + '-sub',
          plan_id: 'P1',
          estado: 'ACTIVA',
          desde: '2026-01-01T00:00:00Z',
          hasta: '2030-01-01T00:00:00Z',
          version_comercial: 1
        },
        modulos: [
          {
            modulo_codigo: 'HARVEST',
            origen: 'PLAN',
            habilitado: true,
            desde: '2026-01-01T00:00:00Z',
            hasta: null
          },
          {
            modulo_codigo: 'WORKFORCE',
            origen: 'ADD_ON',
            habilitado: true,
            desde: '2026-01-01T00:00:00Z',
            hasta: null
          }
        ]
      },
      planActual: { id: 'P1', nombre: 'Plan ' + t },
      modulosPlan: ['HARVEST'],
      modulosEfectivos: ['HARVEST', 'WORKFORCE'],
      modulos: ['HARVEST', 'CAMPAIGN', 'WORKFORCE'].map((codigo) => ({
        codigo,
        nombre: codigo,
        disponible: true
      })),
      planes: [
        { id: 'P1', nombre: 'Plan ' + t, activo: true },
        { id: 'P2', nombre: 'Plan completo', activo: true }
      ],
      programados: [],
      historial: [
        {
          id: t + '-baseline',
          tipo_evento: 'ESTADO_IMPORTADO',
          fase: 'BASELINE',
          fecha_hora: '2026-10-14T15:00:00Z',
          effective_at: '2026-10-14T15:00:00Z',
          actor: { tipo: 'MIGRACION_F6.4' },
          motivo: 'Contrato preservado ' + t,
          estado_anterior: { suscripcion: null, modulos: [] },
          estado_nuevo: { suscripcion: { estado: 'ACTIVA' } },
          contexto: { origen: 'F6.4' }
        }
      ]
    }
  const exigir = async (t, escritura = false) => {
    const c = await ports.acceso.resolverContexto(t)
    if (!c.permisos.includes('company.manage'))
      throw new AccesoDenegado('Permiso company.manage requerido')
    if (escritura && !delegaciones[t])
      throw new AccesoDenegado('Delegación subscription.manage requerida')
  }
  ports.comercial = {
    async consultar(t) {
      await exigir(t)
      ports.calls.push(['consultarComercial', t])
      return structuredClone({ ...datos[t], puedeAdministrar: delegaciones[t] })
    },
    async puedeAdministrar(t) {
      await exigir(t)
      return delegaciones[t]
    },
    async solicitarCambio(d) {
      await exigir(d.tenantId, true)
      ports.calls.push(['cambioComercial', d])
      if (recibos.has(d.operacionId)) {
        const previo = recibos.get(d.operacionId)
        if (JSON.stringify(previo.solicitud) !== JSON.stringify(d))
          throw new Error('ID reutilizado')
        return structuredClone(previo.recibo)
      }
      const s = datos[d.tenantId]
      if (String(d.versionBase) !== s.versionBase) throw new ConflictoVersionComercial()
      const r = {
        operacionId: d.operacionId,
        tenantId: d.tenantId,
        tipoEvento: d.tipoEvento,
        fase: d.effectiveAt ? 'PROGRAMADA' : 'APLICADA',
        effectiveAt: d.effectiveAt ?? '2026-10-14T15:00:00Z'
      }
      const e = {
        id: d.operacionId,
        tipo_evento: d.tipoEvento,
        fase: r.fase,
        fecha_hora: '2026-10-14T15:00:00Z',
        effective_at: r.effectiveAt,
        actor: { usuarioId: 'U' },
        motivo: d.motivo,
        estado_anterior: structuredClone(s.estado),
        estado_nuevo: structuredClone(s.estado),
        contexto: { parametros: d.parametros }
      }
      if (d.effectiveAt)
        s.programados.push({
          id: d.operacionId,
          tipo_evento: d.tipoEvento,
          effective_at: d.effectiveAt,
          version_base: d.versionBase,
          motivo: d.motivo,
          parametros: d.parametros,
          actor: { usuarioId: 'U' }
        })
      else {
        if (d.tipoEvento === 'CAMBIAR_PLAN')
          s.planActual = s.planes.find((p) => p.id === d.parametros.planId)
        if (d.tipoEvento === 'SUSPENDER_SUSCRIPCION') {
          s.estado.suscripcion.estado = 'SUSPENDIDA'
          s.modulosEfectivos = []
        }
        if (d.tipoEvento === 'REACTIVAR_SUSCRIPCION') {
          s.estado.suscripcion.estado = 'ACTIVA'
          s.modulosEfectivos = ['HARVEST', 'WORKFORCE']
        }
        if (d.tipoEvento === 'CANCELAR_SUSCRIPCION') {
          s.estado.suscripcion.estado = 'CANCELADA'
          s.modulosEfectivos = []
        }
        s.versionBase = String(Number(s.versionBase) + 1)
        e.estado_nuevo = structuredClone(s.estado)
      }
      s.historial.unshift(e)
      recibos.set(d.operacionId, { solicitud: d, recibo: r })
      return structuredClone(r)
    }
  }
  return { datos, delegaciones, recibos }
}
