import { crearAdministracionHarvest } from '@gesgrow/core/contexts/harvest/index.js'
import { crearEntitlements } from '@gesgrow/core/contexts/platform/index.js'
import { SolicitudObsoleta } from '../ports/administracion.js'

export function crearCosechaPortal({ puerto, scopePara, entitlements, impresion }) {
  if (!puerto) return null
  const servicio = crearAdministracionHarvest({ administracionHarvest: puerto }),
    capacidades = crearEntitlements({ entitlements })
  const recibos = new Map()
  const borradores = new Map()
  const clave = (c, op) => `${c.tenantId}:${c.usuarioId}:${op}`
  function validarParticipacion(campaniaId, rol, participacionId) {
    if (!campaniaId || !participacionId || !['COSECHADOR', 'JABERO'].includes(rol))
      throw new Error('Consulta de participación inválida.')
  }
  function validarPersona(r, tenantId, campaniaId, rol, participacionId) {
    if (
      !r ||
      !r.id ||
      r.tenantId !== tenantId ||
      r.campaniaId !== campaniaId ||
      r.rol !== rol ||
      r.participacionId !== participacionId
    )
      throw new Error('La ficha no corresponde al trabajador y campaña solicitados.')
    return r
  }
  async function gestionar(accion) {
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
      return await accion(c, exigir, scope)
    } catch (e) {
      if (scope.vigente(c)) await scope.onError(e)
      throw e
    }
  }
  const api = Object.fromEntries(
    Object.entries({
      ...servicio,
      ticketsLote: async (t, campaniaId, loteId, offset = 0) => {
        if (!campaniaId || !loteId || !Number.isSafeInteger(offset) || offset < 0)
          throw new Error('Consulta de tickets inválida.')
        const r = await puerto.ticketsLote(t, campaniaId, loteId, offset)
        if (
          !r ||
          r.tenantId !== t ||
          r.campaniaId !== campaniaId ||
          r.loteId !== loteId ||
          !Array.isArray(r.filas) ||
          r.filas.some(
            (f) => !f.codigo || !['DISPONIBLE', 'UTILIZADO'].includes(f.estado)
          )
        )
          throw new Error('Los tickets no corresponden al lote solicitado.')
        return r
      },
      trabajadorCampania: async (t, campaniaId, rol, participacionId) => {
        validarParticipacion(campaniaId, rol, participacionId)
        return validarPersona(
          await puerto.trabajadorCampania(t, campaniaId, rol, participacionId),
          t,
          campaniaId,
          rol,
          participacionId
        )
      },
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
          let d
          if (['ticketsLote', 'trabajadorCampania'].includes(nombre)) {
            // Both read-only RPCs enforce module, permission and crop access
            // themselves. Keep the client check too, without serial network waits.
            const resultados = await Promise.all([
              capacidades.exigirModulo(c.tenantId, 'HARVEST'),
              accion(c.tenantId, ...args)
            ])
            d = resultados[1]
          } else {
            await capacidades.exigirModulo(c.tenantId, 'HARVEST')
            if (!scope.vigente(c)) throw new SolicitudObsoleta()
            d = await accion(c.tenantId, ...args)
          }
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
    async editarTrabajadorCampania(campaniaId, rol, participacionId, datos) {
      return gestionar(async (c, exigir, scope) => {
        validarParticipacion(campaniaId, rol, participacionId)
        const d = {
          dni: String(datos?.dni ?? '').trim(),
          nombres: String(datos?.nombres ?? '').trim(),
          apellidos: String(datos?.apellidos ?? '').trim(),
          activo: datos?.activo
        }
        if (
          !/^\d{8}$/.test(d.dni) ||
          !d.nombres ||
          !d.apellidos ||
          d.nombres.length > 200 ||
          d.apellidos.length > 200 ||
          typeof d.activo !== 'boolean'
        )
          throw new Error(
            'DNI de ocho dígitos, nombres, apellidos y estado requeridos.'
          )
        const r = await puerto.editarTrabajadorCampania(
          c.tenantId,
          campaniaId,
          rol,
          participacionId,
          d
        )
        if (!scope.vigente(c)) throw new SolicitudObsoleta()
        return validarPersona(r, c.tenantId, campaniaId, rol, participacionId)
      })
    },
    async previsualizarGeneracion(solicitud, opciones) {
      return gestionar(async (c, exigir, scope) => {
        if (!puerto.previsualizar || !impresion?.previsualizar)
          throw new Error(
            'La vista previa requiere actualizar el portal y la migración de impresión.'
          )
        const p = await puerto.previsualizar(c.tenantId, solicitud)
        if (!scope.vigente(c)) throw new SolicitudObsoleta()
        if (
          !p ||
          p.tenantId !== c.tenantId ||
          p.operacionId !== solicitud.operacionId ||
          p.campaniaId !== solicitud.campaniaId ||
          p.cantidadTickets !== solicitud.cantidadTickets ||
          p.tamanioLote !== solicitud.tamanioLote ||
          !Array.isArray(p.lotes)
        )
          throw new Error('La propuesta de impresión no coincide con la solicitud.')
        const filas = []
        for (const [i, l] of p.lotes.entries()) {
          if (
            !/^\d{6}$/.test(l.codigoLote) ||
            l.numeroLote !== i + 1 ||
            !Number.isSafeInteger(l.cantidadTickets) ||
            l.cantidadTickets < 1 ||
            filas.length + l.cantidadTickets > p.cantidadTickets
          )
            throw new Error('La propuesta no tiene lotes de impresión válidos.')
          for (let n = 1; n <= l.cantidadTickets; n++)
            filas.push({
              codigo: `C${l.codigoLote}${String(n).padStart(2, '0')}`,
              codigoLote: l.codigoLote,
              numeroLote: l.numeroLote,
              numeroTicket: n
            })
        }
        if (filas.length !== p.cantidadTickets)
          throw new Error('La propuesta está incompleta.')
        const autorizar = async () => {
          await exigir()
          await puerto.filtros(c.tenantId, p.campaniaId)
          if (!scope.vigente(c)) throw new SolicitudObsoleta()
        }
        const vista = await impresion.previsualizar(
          { ...p, total: p.cantidadTickets, filas },
          opciones,
          autorizar
        )
        if (!scope.vigente(c)) {
          vista.cerrar()
          throw new SolicitudObsoleta()
        }
        if (borradores.size >= 100) borradores.delete(borradores.keys().next().value)
        borradores.set(clave(c, p.operacionId), structuredClone(p))
        return { ...p, vista }
      })
    },
    async confirmarGeneracion(solicitud) {
      return gestionar(async (c, exigir, scope) => {
        const p = borradores.get(clave(c, solicitud.operacionId))
        if (
          !p ||
          !puerto.confirmarImpresion ||
          p.campaniaId !== solicitud.campaniaId ||
          p.cantidadTickets !== solicitud.cantidadTickets ||
          p.tamanioLote !== solicitud.tamanioLote
        )
          throw new Error(
            'Primero prepara y revisa una vista previa con estas cantidades.'
          )
        const r = await puerto.confirmarImpresion(c.tenantId, solicitud, p)
        if (!scope.vigente(c)) throw new SolicitudObsoleta()
        if (!r || r.operacionId !== p.operacionId || r.tenantId !== c.tenantId)
          throw new Error(
            'No se pudo confirmar la generación. Conserva la operación y reintenta.'
          )
        recibos.set(clave(c, r.operacionId), structuredClone(r))
        return r
      })
    },
    async resolverImpresion(operacionId, impresa) {
      return gestionar(async (c, exigir, scope) => {
        const anterior = recibos.get(clave(c, operacionId))
        if (!anterior || typeof impresa !== 'boolean' || !puerto.resolverImpresion)
          throw new Error('Primero recupera la operación de impresión.')
        const r = await puerto.resolverImpresion(c.tenantId, operacionId, impresa)
        if (!scope.vigente(c)) throw new SolicitudObsoleta()
        if (
          !r ||
          r.operacionId !== operacionId ||
          r.tenantId !== c.tenantId ||
          (impresa
            ? r.estadoImpresion !== 'IMPRESA' || r.campaniaId !== anterior.campaniaId
            : r.cancelada !== true)
        )
          throw new Error(
            'No se pudo verificar la confirmación. Conserva la operación y reintenta.'
          )
        if (impresa) recibos.set(clave(c, operacionId), structuredClone(r))
        else {
          recibos.delete(clave(c, operacionId))
          borradores.delete(clave(c, operacionId))
        }
        return r
      })
    },
    abrirImpresion(opciones) {
      if (!impresion)
        throw new Error('La impresión no está disponible en este navegador.')
      return impresion.abrir(opciones)
    },
    async recuperarGeneracion(operacionId) {
      const scope = scopePara('harvest.manage', 'HARVEST')
      const c = await scope.tenantContext.obtener()
      try {
        if (!scope.vigente(c)) throw new SolicitudObsoleta()
        await capacidades.exigirModulo(c.tenantId, 'HARVEST')
        if (!scope.vigente(c)) throw new SolicitudObsoleta()
        if (!puerto.generacion || !operacionId)
          throw new Error('No se puede recuperar esta generación.')
        const recibo = await puerto.generacion(c.tenantId, operacionId)
        if (!scope.vigente(c)) throw new SolicitudObsoleta()
        if (
          !recibo ||
          recibo.operacionId !== operacionId ||
          recibo.tenantId !== c.tenantId
        )
          throw new Error('La generación no pertenece a esta empresa.')
        recibos.set(
          `${c.tenantId}:${c.usuarioId}:${operacionId}`,
          structuredClone(recibo)
        )
        return recibo
      } catch (e) {
        if (scope.vigente(c)) await scope.onError(e)
        throw e
      }
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
        if (recibo.formatoImpresion === 'TSC_30X20_3') {
          if (!puerto.documentoImpresion || !puerto.generacion)
            throw new Error('Actualiza la conexión para imprimir estas etiquetas.')
          const filas = []
          do {
            await exigir()
            const pagina = await puerto.documentoImpresion(
              c.tenantId,
              operacionId,
              filas.length
            )
            if (!scope.vigente(c)) throw new SolicitudObsoleta()
            if (
              !pagina ||
              pagina.operacionId !== operacionId ||
              pagina.campaniaId !== recibo.campaniaId ||
              pagina.total !== recibo.cantidadTickets ||
              pagina.fecha !== recibo.fecha ||
              pagina.abreviaturaCultivo !== recibo.abreviaturaCultivo ||
              !Array.isArray(pagina.filas) ||
              !pagina.filas.length ||
              filas.length + pagina.filas.length > recibo.cantidadTickets
            )
              throw new Error(
                'La consulta del documento de impresión está incompleta o contiene datos incompatibles.'
              )
            filas.push(...pagina.filas)
          } while (filas.length < recibo.cantidadTickets)
          // Un segundo control contra el recibo evita mover tickets entre lotes
          // aunque la respuesta conserve cantidades y códigos válidos.
          let indice = 0
          for (const [posicion, lote] of recibo.lotes.entries()) {
            for (let n = 1; n <= lote.cantidadTickets; n++) {
              const ticket = filas[indice++]
              if (
                !ticket ||
                ticket.codigoLote !== lote.codigoLote ||
                ticket.numeroLote !== posicion + 1 ||
                ticket.numeroTicket !== n
              )
                throw new Error(
                  'Los tickets no coinciden con los lotes originales de la generación.'
                )
            }
          }
          if (indice !== filas.length)
            throw new Error('La cantidad de tickets no coincide con la generación.')
          const confirmar = async () => {
            await exigir()
            // Revalidar también la participación en el cultivo después de
            // renderizar el PDF/TSPL, justo antes de entregar o enviar bytes.
            await puerto.generacion(c.tenantId, operacionId)
            if (!scope.vigente(c)) throw new SolicitudObsoleta()
          }
          await exigir()
          return await impresion.imprimir(
            destino,
            {
              ...recibo,
              empresa: c.empresa,
              total: recibo.cantidadTickets,
              filas
            },
            confirmar
          )
        }
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
        const resultadoImpresion = await impresion.imprimir(
          destino,
          { empresa: c.empresa, campaniaId: recibo.campaniaId, lotes },
          confirmar
        )
        return resultadoImpresion ?? { dialogoAbierto: true }
      } catch (e) {
        destino?.cerrar?.()
        if (scope.vigente(c)) await scope.onError(e)
        throw e
      }
    }
  })
}
