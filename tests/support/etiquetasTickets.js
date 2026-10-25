export function documentoEtiquetas(cantidades = [10, 10], abreviaturaCultivo = 'MAN') {
  const filas = []
  const lotes = cantidades.map((cantidadTickets, i) => {
    const codigoLote = String(10613 + i).padStart(6, '0')
    for (let n = 1; n <= cantidadTickets; n++)
      filas.push({
        codigo: `C${codigoLote}${String(n).padStart(2, '0')}`,
        codigoLote,
        numeroLote: i + 1,
        numeroTicket: n
      })
    return { id: `lote-${i + 1}`, codigoLote, numeroLote: i + 1, cantidadTickets }
  })
  return {
    formatoImpresion: 'TSC_30X20_3',
    operacionId: 'operacion-prueba',
    tenantId: 'A',
    campaniaId: 'A-camp',
    fecha: '20261008',
    abreviaturaCultivo,
    total: filas.length,
    cantidadTickets: filas.length,
    tamanioLote: cantidades[0],
    lotes,
    filas
  }
}
