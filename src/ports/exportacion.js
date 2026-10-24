// ExportPort.guardar({ nombre, contenido, mime }): descarga un archivo neutral.
// La autorización y la selección de filas preceden al adaptador de descarga.
export function serializarCsv(columnas, filas) {
  const celda = (valor) => {
    let s = String(valor ?? '')
    if (/^[\s]*[=+@-]/.test(s) || /^[\t\r\n]/.test(s)) s = "'" + s
    return '"' + s.replaceAll('"', '""') + '"'
  }
  return (
    '\uFEFF' +
    [columnas, ...filas].map((f) => f.map(celda).join(',')).join('\r\n') +
    '\r\n'
  )
}
