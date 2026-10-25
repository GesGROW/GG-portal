import JsBarcode from 'jsbarcode'

export const FORMATO_TICKETS = 'TSC_30X20_3'
const DOTS_MM = 8
const BARRAS_Y = 20
const BARRAS_ALTO = 72
const entero = (n, min, max) => Number.isSafeInteger(n) && n >= min && n <= max

export function configurarRollo(opciones = {}) {
  const configuracion = {
    separacionColumnasMm: opciones.separacionColumnasMm ?? 2,
    separacionFilasMm: opciones.separacionFilasMm ?? 2,
    margenIzquierdoMm: opciones.margenIzquierdoMm ?? 3
  }
  for (const [campo, numero] of Object.entries(configuracion)) {
    if (
      typeof numero !== 'number' ||
      !Number.isFinite(numero) ||
      numero < 0 ||
      numero > 10 ||
      !Number.isInteger(numero * DOTS_MM)
    )
      throw new Error(
        `Medida de rollo inválida: ${campo}. Usa múltiplos de 0.125 mm entre 0 y 10.`
      )
  }
  // El ancho físico del soporte no cambia al ajustar las separaciones.
  configuracion.anchoMm = 100
  configuracion.margenDerechoMm =
    configuracion.anchoMm -
    90 -
    2 * configuracion.separacionColumnasMm -
    configuracion.margenIzquierdoMm
  if (configuracion.margenDerechoMm < 0)
    throw new Error(
      'Las tres etiquetas, separaciones y margen no caben en el rollo de 100 mm.'
    )
  return configuracion
}

export function prepararEtiquetas(datos, opciones) {
  const rollo = configurarRollo(opciones)
  if (
    datos.formatoImpresion !== FORMATO_TICKETS ||
    !/^\d{8}$/.test(datos.fecha ?? '') ||
    !/^[A-Z0-9]{2,5}$/.test(datos.abreviaturaCultivo ?? '') ||
    !Array.isArray(datos.filas) ||
    !entero(datos.total, 1, 100000) ||
    datos.filas.length !== datos.total
  )
    throw new Error(
      'La generación no tiene un documento válido para etiquetas de 30 × 20 mm.'
    )
  const codigos = new Set()
  let previo = null
  const filas = []
  datos.filas.forEach((ticket, indice) => {
    if (
      !/^\d{6}$/.test(ticket.codigoLote ?? '') ||
      !entero(ticket.numeroTicket, 1, 100000) ||
      !entero(ticket.numeroLote, 1, 100000)
    )
      throw new Error('El ticket no tiene numeración de impresión válida.')
    const numero = String(ticket.numeroTicket).padStart(2, '0')
    if (
      ticket.codigo !== `C${ticket.codigoLote}${numero}` ||
      codigos.has(ticket.codigo)
    )
      throw new Error(
        'El código impreso no coincide con la identidad del ticket o está duplicado.'
      )
    if (
      (!previo && (ticket.numeroLote !== 1 || ticket.numeroTicket !== 1)) ||
      (previo &&
        !(
          (ticket.numeroLote === previo.numeroLote &&
            ticket.codigoLote === previo.codigoLote &&
            ticket.numeroTicket === previo.numeroTicket + 1) ||
          (ticket.numeroLote === previo.numeroLote + 1 &&
            ticket.codigoLote !== previo.codigoLote &&
            ticket.numeroTicket === 1)
        ))
    )
      throw new Error('Los tickets no están en el orden original de generación.')
    codigos.add(ticket.codigo)
    previo = ticket
    const objeto = {}
    JsBarcode(objeto, ticket.codigo, {
      format: 'CODE128',
      displayValue: false,
      margin: 0
    })
    const barras = objeto.encodings.map((e) => e.data).join('')
    // Los márgenes blancos del propio código ya protegen los extremos: no
    // añadir otro margen que reduzca innecesariamente el área de las barras.
    // Una escala próxima a dos puntos cabe en 30 mm; en códigos más largos
    // mantener módulos enteros para evitar patrones ilegibles a 203 dpi.
    const maximo = 240 / (barras.length + 20)
    const modulo = maximo >= 1.95 ? Math.min(2, maximo) : Math.floor(maximo)
    if (modulo < 1)
      throw new Error('El código es demasiado largo para una etiqueta de 30 mm.')
    const columna = indice % 3
    if (columna === 0) filas.push([])
    filas.at(-1).push({
      ...ticket,
      numero,
      barras,
      modulo,
      x: Math.round(
        (rollo.margenIzquierdoMm + columna * (30 + rollo.separacionColumnasMm)) *
          DOTS_MM
      ),
      // Guía izquierda común de 2.5 mm para barras, cultivo y fecha.
      xBarras: 20,
      izquierda: `TI-${datos.abreviaturaCultivo}`,
      derecha: `${ticket.codigoLote}|${numero}`
    })
  })
  return { rollo, filas, fecha: datos.fecha, total: datos.total }
}

// Se dibujan las mismas barras vectoriales en PDF y TSPL, incluidos inicio,
// cambio de subconjunto, checksum y parada que calcula Code 128.
export function segmentosBarras(ticket) {
  const segmentos = []
  for (const coincidencia of ticket.barras.matchAll(/1+/g))
    segmentos.push({
      x: ticket.x + ticket.xBarras + Math.round(coincidencia.index * ticket.modulo),
      ancho:
        Math.round((coincidencia.index + coincidencia[0].length) * ticket.modulo) -
        Math.round(coincidencia.index * ticket.modulo)
    })
  return segmentos
}

export function generarTspl(documento) {
  const { rollo, filas, fecha } = documento
  const comandos = [
    `SIZE ${rollo.anchoMm} mm,20 mm`,
    `GAP ${rollo.separacionFilasMm} mm,0 mm`,
    'DIRECTION 1',
    'REFERENCE 0,0',
    'OFFSET 0 mm',
    'SET TEAR ON'
  ]
  for (const fila of filas) {
    comandos.push('CLS')
    for (const ticket of fila) {
      for (const barra of segmentosBarras(ticket))
        comandos.push(`BAR ${barra.x},${BARRAS_Y},${barra.ancho},${BARRAS_ALTO}`)
      comandos.push(
        `TEXT ${ticket.x + ticket.xBarras},104,"1",0,1,1,"${ticket.izquierda}"`,
        `TEXT ${ticket.x + 108},104,"1",0,1,1,"${ticket.derecha}"`,
        `TEXT ${ticket.x + ticket.xBarras},130,"1",0,1,1,"${fecha}"`,
        `TEXT ${ticket.x + 108},130,"1",0,1,1,"${ticket.numeroLote}"`
      )
    }
    comandos.push('PRINT 1,1')
  }
  return comandos.join('\r\n') + '\r\n'
}

export function estiloPaginaEtiquetas(anchoMm) {
  return `@page{size:${anchoMm}mm 20mm;margin:0!important}@page:first{margin:0!important}`
}

export function generarHtmlEtiquetas({ rollo, filas, fecha }) {
  const escapar = (valor) =>
    String(valor).replace(
      /[&<>"']/g,
      (c) =>
        ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
    )
  const texto = (x, y, valor) =>
    `<text x="${x}" y="${y}" font-family="Arial" font-size="1.905">${escapar(valor)}</text>`
  const paginas = filas
    .map((fila) => {
      const contenido = fila
        .map((ticket) => {
          const barras = segmentosBarras(ticket)
            .map(
              (barra) =>
                `<rect x="${barra.x / DOTS_MM}" y="${BARRAS_Y / DOTS_MM}" width="${barra.ancho / DOTS_MM}" height="${BARRAS_ALTO / DOTS_MM}"/>`
            )
            .join('')
          const x = ticket.x / DOTS_MM,
            izquierda = x + ticket.xBarras / DOTS_MM,
            derecha = x + 13.5
          return `${barras}${texto(izquierda, 14.2, ticket.izquierda)}${texto(derecha, 14.2, ticket.derecha)}${texto(izquierda, 17.5, fecha)}${texto(derecha, 17.5, ticket.numeroLote)}`
        })
        .join('')
      return `<svg xmlns="http://www.w3.org/2000/svg" width="${rollo.anchoMm}mm" height="20mm" viewBox="0 0 ${rollo.anchoMm} 20">${contenido}</svg>`
    })
    .join('')
  // Imprimir HTML vectorial evita depender de los eventos del visor PDF de Chrome.
  // Las posiciones, barras y tamaño de letra coinciden con el documento PDF.
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Tickets de cosecha - GesGROW</title><style>${estiloPaginaEtiquetas(rollo.anchoMm)}*{box-sizing:border-box}html,body{margin:0;padding:0;background:white;color:black}body{width:${rollo.anchoMm}mm}svg{display:block;width:${rollo.anchoMm}mm;height:20mm;break-inside:avoid;break-after:page;fill:black;print-color-adjust:exact;-webkit-print-color-adjust:exact}svg:last-child{break-after:auto}</style></head><body>${paginas}</body></html>`
}

export async function generarPdfEtiquetas(documento) {
  const { jsPDF } = await import('jspdf')
  const { rollo, filas, fecha } = documento
  const pdf = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: [rollo.anchoMm, 20],
    compress: true,
    putOnlyUsedFonts: true
  })
  pdf.setProperties({ title: 'Tickets de cosecha - GesGROW', creator: 'GesGROW' })
  pdf.viewerPreferences({ PrintScaling: 'None', PickTrayByPDFSize: true })
  filas.forEach((fila, indice) => {
    if (indice) pdf.addPage([rollo.anchoMm, 20], 'landscape')
    pdf.setFillColor(0)
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(5.4)
    for (const ticket of fila) {
      for (const barra of segmentosBarras(ticket))
        pdf.rect(
          barra.x / DOTS_MM,
          BARRAS_Y / DOTS_MM,
          barra.ancho / DOTS_MM,
          BARRAS_ALTO / DOTS_MM,
          'F'
        )
      const x = ticket.x / DOTS_MM
      pdf.text(ticket.izquierda, x + ticket.xBarras / DOTS_MM, 14.2)
      pdf.text(ticket.derecha, x + 13.5, 14.2)
      pdf.text(fecha, x + ticket.xBarras / DOTS_MM, 17.5)
      pdf.text(String(ticket.numeroLote), x + 13.5, 17.5)
    }
  })
  return pdf
}
