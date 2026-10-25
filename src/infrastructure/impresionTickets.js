import {
  prepararEtiquetas,
  generarTspl,
  generarPdfEtiquetas,
  generarHtmlEtiquetas,
  estiloPaginaEtiquetas,
  configurarRollo,
  FORMATO_TICKETS
} from './etiquetasTickets.js'

const MODOS = ['pdf', 'tspl', 'directa', 'vista']
const PUENTE = 'http://127.0.0.1:18191'
// Un reintento tras perder la respuesta conserva el UUID del envío. Una
// reimpresión confirmada recibe otro UUID y produce una copia deliberada.
const pendientes = new Map()

async function previsualizar(datos, opciones, autorizar) {
  const documento = prepararEtiquetas(datos, opciones)
  const pdf = await generarPdfEtiquetas(documento)
  await autorizar()
  const url = URL.createObjectURL(
    new Blob([pdf.output('arraybuffer')], { type: 'application/pdf' })
  )
  let cerrada = false
  return {
    url,
    filas: documento.filas.length,
    cerrar() {
      if (!cerrada) URL.revokeObjectURL(url)
      cerrada = true
    }
  }
}

function descargar(contenido, tipo, nombre) {
  const url = URL.createObjectURL(new Blob([contenido], { type: tipo }))
  const enlace = document.createElement('a')
  enlace.href = url
  enlace.download = nombre
  enlace.click()
  setTimeout(() => URL.revokeObjectURL(url), 60000)
}

function imprimirEnPagina(documento, destino, autorizar, vigente) {
  const visor = document.createElement('iframe')
  visor.title = 'Impresión de etiquetas de cosecha'
  visor.setAttribute('aria-hidden', 'true')
  visor.tabIndex = -1
  // HTML de igual origen: Chrome sí devuelve afterprint al cancelar su diálogo.
  visor.style.cssText =
    'position:fixed;left:0;bottom:0;width:1px;height:1px;border:0;opacity:0;pointer-events:none'
  return new Promise((resolve, reject) => {
    let liberado = false,
      solicitado = false,
      carga,
      impresion,
      ventana,
      estiloPagina
    function liberar() {
      if (liberado) return
      liberado = true
      clearTimeout(carga)
      clearTimeout(impresion)
      destino.cancelacion.signal.removeEventListener('abort', cancelar)
      ventana?.removeEventListener('afterprint', terminar)
      window.removeEventListener?.('afterprint', terminar)
      visor.onload = null
      visor.onerror = null
      visor.remove()
      estiloPagina?.remove()
    }
    function fallar(error) {
      liberar()
      reject(error)
    }
    function cancelar() {
      fallar(new DOMException('La preparación se cerró.', 'AbortError'))
    }
    function terminar() {
      if (!solicitado || liberado || impresion !== undefined) return
      // El cierre puede notificarse en el iframe o en la página que lo contiene.
      impresion = setTimeout(() => {
        try {
          vigente()
          liberar()
          resolve({
            dialogoAbierto: true,
            dialogoCerrado: true,
            impresionSolicitada: true,
            filas: documento.filas.length
          })
        } catch (error) {
          fallar(error)
        }
      }, 0)
    }
    visor.onload = async () => {
      visor.onload = null
      try {
        await autorizar()
        vigente()
        if (liberado) return
        ventana = visor.contentWindow
        if (typeof ventana?.print !== 'function')
          throw new Error(
            'Este navegador no permite imprimir las etiquetas integradas.'
          )
        // Chrome puede consultar también la página que contiene el iframe.
        // Los márgenes cero evitan sus encabezados automáticos; solo durante esta salida.
        estiloPagina = document.createElement('style')
        estiloPagina.media = 'print'
        estiloPagina.textContent = estiloPaginaEtiquetas(documento.rollo.anchoMm)
        document.head.append(estiloPagina)
        ventana.addEventListener('afterprint', terminar)
        window.addEventListener?.('afterprint', terminar)
        ventana.focus()
        solicitado = true
        clearTimeout(carga)
        ventana.print()
      } catch (error) {
        fallar(error)
      }
    }
    visor.onerror = () =>
      fallar(new Error('No se pudieron cargar las etiquetas para imprimir.'))
    carga = setTimeout(() => {
      fallar(
        new Error('Las etiquetas no terminaron de cargar. Reintenta la impresión.')
      )
    }, 60000)
    destino.cancelacion.signal.addEventListener('abort', cancelar, { once: true })
    if (destino.cancelacion.signal.aborted) {
      cancelar()
      return
    }
    try {
      visor.srcdoc = generarHtmlEtiquetas(documento)
      document.body.append(visor)
    } catch (error) {
      fallar(error)
    }
  })
}

export const impresionTickets = Object.freeze({
  previsualizar,
  abrir(opciones = {}) {
    const modo = opciones.modo ?? 'pdf'
    if (!MODOS.includes(modo))
      throw new Error('Selecciona una salida de impresión válida.')
    configurarRollo(opciones)
    if (modo === 'directa' && (!opciones.impresora?.trim() || !opciones.token?.trim()))
      throw new Error(
        'Indica el nombre de la impresora y el token del servicio de impresión.'
      )
    const cancelacion = new AbortController()
    const destino = {
      opciones: { ...opciones, modo },
      cancelacion,
      cerrado: false,
      ventana: null
    }
    if (modo === 'pdf' && !opciones.enPagina) {
      destino.ventana = window.open('', '_blank')
      if (!destino.ventana)
        throw new Error('Permite las ventanas emergentes para ver los tickets.')
      destino.ventana.opener = null
      destino.ventana.document.title = 'Preparando tickets - GesGROW'
      destino.ventana.document.body.textContent = 'Preparando las etiquetas…'
    }
    destino.cerrar = () => {
      destino.cerrado = true
      cancelacion.abort()
      destino.ventana?.close()
    }
    return destino
  },
  async imprimir(destino, datos, autorizar) {
    const vigente = () => {
      if (destino.cerrado || destino.ventana?.closed)
        throw new Error('La preparación se cerró. Reintenta con los mismos tickets.')
    }
    vigente()
    const modo = destino.opciones?.modo ?? 'pdf'
    if (modo === 'vista')
      return previsualizar(datos, destino.opciones, async () => {
        await autorizar()
        vigente()
      })
    if (datos.formatoImpresion !== FORMATO_TICKETS) {
      if (modo !== 'pdf')
        throw new Error(
          'Esta generación antigua conserva su formato QR/A4. Selecciona PDF para reimprimirla.'
        )
      const { impresionTicketsLegacy } = await import('./impresionTicketsLegacy.js')
      await impresionTicketsLegacy.imprimir(destino, datos, autorizar)
      return { dialogoAbierto: true }
    }
    const documento = prepararEtiquetas(datos, destino.opciones)
    if (modo === 'pdf') {
      if (destino.opciones.enPagina) {
        await autorizar()
        vigente()
        return imprimirEnPagina(documento, destino, autorizar, vigente)
      }
      const pdf = await generarPdfEtiquetas(documento)
      await autorizar()
      vigente()
      const url = URL.createObjectURL(
        new Blob([pdf.output('arraybuffer')], { type: 'application/pdf' })
      )
      const d = destino.ventana.document
      d.documentElement.lang = 'es'
      d.title = 'Tickets 30 × 20 mm - GesGROW'
      d.head.replaceChildren()
      d.body.replaceChildren()
      const style = d.createElement('style')
      style.textContent =
        'html,body{margin:0;height:100%;font:14px Arial;background:#f3f5f1;color:#17362d}body{display:flex;flex-direction:column}header{padding:12px 18px}p{margin:5px 0}iframe{border:0;flex:1;width:100%}a{color:#145d44}'
      d.head.append(style)
      const header = d.createElement('header')
      const aviso = d.createElement('p')
      aviso.textContent =
        'Rollo de 100 mm, tres columnas de 30 × 20 mm. Configura el papel de 100 × 20 mm e imprime a tamaño real (100%), sin ajuste de página, márgenes ni encabezados. Cada página es una fila del rollo.'
      const enlace = d.createElement('a')
      enlace.href = url
      enlace.download = `tickets-${datos.operacionId}.pdf`
      enlace.textContent = 'Descargar PDF'
      header.append(aviso, enlace)
      const visor = d.createElement('iframe')
      visor.title = 'PDF de etiquetas de cosecha'
      if (destino.opciones.imprimirAlAbrir)
        visor.onload = async () => {
          visor.onload = null
          try {
            await autorizar()
            vigente()
            visor.contentWindow.focus()
            visor.contentWindow.print()
          } catch {
            aviso.textContent +=
              ' Usa el botón Imprimir del visor si el diálogo no se abrió.'
          }
        }
      visor.src = url
      d.body.append(header, visor)
      destino.ventana.focus()
      const revisar = setInterval(() => {
        if (destino.ventana.closed) {
          URL.revokeObjectURL(url)
          clearInterval(revisar)
        }
      }, 10000)
      return {
        dialogoAbierto: true,
        vistaPrevia: true,
        impresionSolicitada: Boolean(destino.opciones.imprimirAlAbrir),
        filas: documento.filas.length
      }
    }
    const tspl = generarTspl(documento)
    await autorizar()
    vigente()
    if (modo === 'tspl') {
      descargar(
        tspl,
        'text/plain;charset=us-ascii',
        `tickets-${datos.operacionId}.tspl`
      )
      return { descargado: true, filas: documento.filas.length }
    }
    let respuesta
    const clave = JSON.stringify([
      datos.operacionId,
      destino.opciones.impresora.trim(),
      documento.rollo
    ])
    let pendiente = pendientes.get(clave)
    if (!pendiente) {
      if (pendientes.size >= 100)
        throw new Error(
          'Hay demasiados envíos sin confirmar. Revisa la cola de Windows antes de continuar.'
        )
      pendiente = { id: crypto.randomUUID(), creadoEn: Date.now() }
      pendientes.set(clave, pendiente)
    }
    if (Date.now() - pendiente.creadoEn > 3500000)
      throw new Error(
        'Este envío sigue sin confirmar y venció su ventana de reintento. Revisa la cola de Windows antes de recargar y reimprimir.'
      )
    try {
      respuesta = await fetch(`${PUENTE}/imprimir`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Gesgrow-Print-Token': destino.opciones.token
        },
        body: JSON.stringify({
          trabajoId: pendiente.id,
          impresora: destino.opciones.impresora.trim(),
          tspl
        }),
        signal: destino.cancelacion.signal
      })
    } catch (error) {
      if (error.name === 'AbortError') throw error
      throw new Error(
        'No se pudo confirmar el envío al servicio local. Revisa la cola de Windows antes de reintentar para evitar copias duplicadas.'
      )
    }
    let resultado
    try {
      resultado = await respuesta.json()
    } catch {
      throw new Error(
        'El servicio respondió sin una confirmación válida. Revisa la cola de Windows antes de reintentar.'
      )
    }
    if (!respuesta.ok) {
      if (!resultado.resultadoIncierto) pendientes.delete(clave)
      throw new Error(
        (resultado.error || 'El servicio local rechazó la impresión.') +
          (resultado.resultadoIncierto
            ? ' El resultado es incierto: revisa la cola de Windows antes de continuar.'
            : '')
      )
    }
    if (
      resultado.enviado !== true ||
      resultado.trabajoId !== pendiente.id ||
      resultado.impresora !== destino.opciones.impresora.trim() ||
      !['encolado', 'simulado'].includes(resultado.estado) ||
      typeof resultado.simulado !== 'boolean'
    )
      throw new Error(
        'La confirmación del servicio no corresponde al envío. Revisa la cola de Windows antes de reintentar.'
      )
    pendientes.delete(clave)
    return { ...resultado, enviado: true, filas: documento.filas.length }
  }
})
