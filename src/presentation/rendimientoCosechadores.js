export function ordenarRendimiento(filas, orden = 'MAYOR') {
  return [...filas].sort(
    (a, b) =>
      (orden === 'MENOR' ? a.jabas - b.jabas : b.jabas - a.jabas) ||
      a.nombre.localeCompare(b.nombre, 'es') ||
      String(a.id).localeCompare(String(b.id))
  )
}

// Los días del calendario permanecen en el eje. La ausencia de hechos es null,
// no cero: cada null termina el tramo de línea que se estaba dibujando.
export function seriesRendimiento(fechas, personas, registros) {
  const indices = new Map(personas.map((p) => [p.id, new Map()]))
  for (const r of registros) {
    if (r.jabas > 0) indices.get(r.trabajadorId)?.set(r.fecha, r.jabas)
  }
  return personas.map((p) => ({
    ...p,
    valores: fechas.map((f) => indices.get(p.id).get(f) ?? null)
  }))
}

export function trazarSerie(valores, x, y) {
  let inicio = true
  return valores
    .map((v, i) => {
      if (v === null) {
        inicio = true
        return ''
      }
      const punto = `${inicio ? 'M' : 'L'}${x(i)},${y(v)}`
      inicio = false
      return punto
    })
    .filter(Boolean)
    .join(' ')
}
