export const impresionTicketsLegacy = Object.freeze({
  abrir() {
    const ventana = window.open('', '_blank')
    if (!ventana)
      throw new Error('Permite las ventanas emergentes para imprimir los tickets.')
    ventana.opener = null
    ventana.document.title = 'Preparando tickets · GesGROW'
    ventana.document.body.textContent = 'Preparando los tickets para imprimir…'
    return { ventana, cerrar: () => ventana.close() }
  },
  async imprimir(destino, datos, autorizar) {
    const { default: QRCode } = await import('qrcode')
    const lotes = []
    for (const lote of datos.lotes) {
      const tickets = []
      for (const codigo of lote.codigos) {
        if (destino.ventana.closed)
          throw new Error(
            'La ventana de impresión se cerró. Reintenta con los mismos tickets.'
          )
        tickets.push({
          codigo,
          svg: await QRCode.toString(codigo, {
            type: 'svg',
            errorCorrectionLevel: 'M',
            margin: 4
          })
        })
        if (tickets.length % 50 === 0) await new Promise((r) => setTimeout(r, 0))
      }
      lotes.push({ ...lote, tickets })
    }
    await autorizar()
    const w = destino.ventana
    if (w.closed)
      throw new Error(
        'La ventana de impresión se cerró. Reintenta con los mismos tickets.'
      )
    const d = w.document
    d.documentElement.lang = 'es'
    d.title = 'Tickets de cosecha · GesGROW'
    d.body.replaceChildren()
    const estilo = d.createElement('style')
    estilo.textContent =
      '@page{size:A4;margin:10mm}*{box-sizing:border-box}body{margin:0;color:#000;background:white;font-family:Arial,sans-serif}.lote{break-before:page}.lote:first-of-type{break-before:auto}h1{font-size:14pt;margin:0 0 3mm}h2{font-size:10pt;font-weight:400;overflow-wrap:anywhere;margin:0 0 5mm}.tickets{display:grid;grid-template-columns:repeat(4,1fr);gap:2mm}.ticket{border:.2mm dashed #888;break-inside:avoid;text-align:center;padding:2mm}.ticket svg{display:block;width:32mm;height:32mm;margin:auto}.codigo{font:7pt monospace;overflow-wrap:anywhere;margin:1mm 0}.numero{font-size:8pt;margin:0}.acciones{padding:16px;background:#eef0e3;margin-bottom:20px}@media print{.acciones{display:none}}'
    d.head.append(estilo)
    const barra = d.createElement('div')
    barra.className = 'acciones'
    const boton = d.createElement('button')
    boton.textContent = 'Imprimir tickets'
    boton.onclick = () => w.print()
    barra.append(boton)
    d.body.append(barra)
    lotes.forEach((lote, i) => {
      const seccion = d.createElement('section')
      seccion.className = 'lote'
      const titulo = d.createElement('h1')
      titulo.textContent = `${datos.empresa} · Lote ${i + 1} · ${lote.tickets.length} tickets`
      const subtitulo = d.createElement('h2')
      subtitulo.textContent = `Lote: ${lote.id} · Campaña: ${datos.campaniaId}`
      const grid = d.createElement('div')
      grid.className = 'tickets'
      lote.tickets.forEach((ticket, j) => {
        const bloque = d.createElement('article')
        bloque.className = 'ticket'
        const svg = new DOMParser().parseFromString(
          ticket.svg,
          'image/svg+xml'
        ).documentElement
        bloque.append(d.importNode(svg, true))
        const codigo = d.createElement('p')
        codigo.className = 'codigo'
        codigo.textContent = ticket.codigo
        const numero = d.createElement('p')
        numero.className = 'numero'
        numero.textContent = `Lote ${i + 1} · Ticket ${j + 1}/${lote.tickets.length}`
        bloque.append(codigo, numero)
        grid.append(bloque)
      })
      seccion.append(titulo, subtitulo, grid)
      d.body.append(seccion)
    })
    w.focus()
    w.print()
  }
})
