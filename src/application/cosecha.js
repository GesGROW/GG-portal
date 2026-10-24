import { crearAdministracionHarvest } from '@gesgrow/core/contexts/harvest/index.js'
import { crearEntitlements } from '@gesgrow/core/contexts/platform/index.js'
import { SolicitudObsoleta } from '../ports/administracion.js'

export function crearCosechaPortal({ puerto, scopePara, entitlements, impresion }) {
  if (!puerto) return null
  const servicio = crearAdministracionHarvest({ administracionHarvest: puerto }),
    capacidades = crearEntitlements({ entitlements })
  const recibos = new Map()
  const api = Object.fromEntries(
    Object.entries({
      ...servicio,
      trabajadoresCampania: (t, campaniaId, rol, offset = 0, filtros) => {
        if (
          !campaniaId ||
          !['COSECHADOR', 'JABERO', 'SUPERVISORA'].includes(rol) ||
          !Number.isSafeInteger(offset) ||
          offset < 0
        )
          throw new Error('Consulta de trabajadores inválida.')
        if (filtros) {
          const { busqueda = '', estado = '', desde = null, hasta = null } = filtros
          const fechaValida = (f) =>
            f === null ||
            (typeof f === 'string' &&
              /^\d{4}-\d{2}-\d{2}$/.test(f) &&
              Number.isFinite(Date.parse(f)) &&
              new Date(f).toISOString().slice(0, 10) === f)
          if (
            typeof busqueda !== 'string' ||
            busqueda.trim().length > 200 ||
            !['', 'ACTIVO', 'INACTIVO'].includes(estado) ||
            !fechaValida(desde) ||
            !fechaValida(hasta) ||
            (desde && hasta && desde > hasta)
          )
            throw new Error('Filtros de trabajadores inválidos.')
          return puerto.trabajadoresCampania(t, campaniaId, rol, offset, {
            busqueda: busqueda.trim(),
            estado,
            desde,
            hasta
          })
        }
        return puerto.trabajadoresCampania(t, campaniaId, rol, offset)
      }
    }).map(([nombre, accion]) => [
      nombre,
      async (...args) => {
        const scope = scopePara(
          nombre === 'generar' ? 'harvest.manage' : ['harvest.view', 'harvest.manage'],
          'HARVEST'
        )
        const c = await scope.tenantContext.obtener()
        if (!scope.vigente(c)) throw new SolicitudObsoleta()
        try {
          await capacidades.exigirModulo(c.tenantId, 'HARVEST')
          if (!scope.vigente(c)) throw new SolicitudObsoleta()
          const d = await accion(c.tenantId, ...args)
          if (!scope.vigente(c)) throw new SolicitudObsoleta()
          if (nombre === 'generar')
            recibos.set(
              `${c.tenantId}:${c.usuarioId}:${d.operacionId}`,
              structuredClone(d)
            )
          return d
        } catch (e) {
          if (scope.vigente(c)) await scope.onError(e)
          throw e
        }
      }
    ])
  )
  return Object.freeze({
    ...api,
    abrirImpresion() {
      if (!impresion)
        throw new Error('La impresión no está disponible en este navegador.')
      return impresion.abrir()
    },
    async imprimirGeneracion(operacionId, destino) {
      const scope = scopePara('harvest.manage', 'HARVEST')
      const c = await scope.tenantContext.obtener()
      const exigir = async () => {
        if (!scope.vigente(c)) throw new SolicitudObsoleta()
        await scope.tenantContext.obtener()
        await capacidades.exigirModulo(c.tenantId, 'HARVEST')
        if (!scope.vigente(c)) throw new SolicitudObsoleta()
      }
      try {
        await exigir()
        const recibo = recibos.get(`${c.tenantId}:${c.usuarioId}:${operacionId}`)
        if (!recibo || !impresion)
          throw new Error('Primero confirma la generación de tickets.')
        const lotes = [],
          codigos = new Set()
        for (const lote of recibo.lotes) {
          const tickets = []
          let total = 0
          do {
            await exigir()
            const pagina = await servicio.listar(c.tenantId, 'tickets', {
              campaniaId: recibo.campaniaId,
              loteId: lote.id,
              offset: tickets.length
            })
            if (
              !Array.isArray(pagina.filas) ||
              !Number.isSafeInteger(pagina.total) ||
              pagina.total !== lote.cantidadTickets ||
              (!pagina.filas.length && tickets.length < pagina.total)
            )
              throw new Error(
                'La consulta de tickets para impresión está incompleta. Reintenta la impresión.'
              )
            total = pagina.total
            for (const t of pagina.filas) {
              if (
                !t.codigo ||
                codigos.has(t.codigo) ||
                t.lote?.id !== lote.id ||
                t.lote?.campaniaId !== recibo.campaniaId
              )
                throw new Error(
                  'La respuesta de impresión contiene tickets incompatibles con el lote.'
                )
              codigos.add(t.codigo)
              tickets.push(t.codigo)
            }
            if (tickets.length > total)
              throw new Error('La consulta de impresión contiene tickets duplicados.')
          } while (tickets.length < total)
          lotes.push({ id: lote.id, codigos: tickets })
        }
        if (codigos.size !== recibo.cantidadTickets)
          throw new Error('La cantidad de tickets no coincide con la generación.')
        await exigir()
        const confirmar = async () => {
          await exigir()
          await servicio.filtros(c.tenantId, recibo.campaniaId)
          if (!scope.vigente(c)) throw new SolicitudObsoleta()
        }
        await impresion.imprimir(
          destino,
          { empresa: c.empresa, campaniaId: recibo.campaniaId, lotes },
          confirmar
        )
        return { dialogoAbierto: true }
      } catch (e) {
        destino?.cerrar?.()
        if (scope.vigente(c)) await scope.onError(e)
        throw e
      }
    }
  })
}
