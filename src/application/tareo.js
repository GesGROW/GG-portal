export const columnasTareo = ['Item', 'Cod.Trabajador', 'Apellidos y Nombres', 'Periodo',
  'Cod.Actividad', 'Cod.Labor', 'Cod.Consumidor', 'Cod. Orden Produccion', 'Tipo Asistencia',
  ...Array.from({ length: 7 }, (_, i) => `Dia ${String(i + 1).padStart(2, '0')}`)]

export function semanaTareo(fecha) {
  const d = new Date(`${fecha}T12:00:00Z`)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || !Number.isFinite(+d) || d.toISOString().slice(0, 10) !== fecha)
    throw new Error('Selecciona una fecha válida para el tareo.')
  const inicio = new Date(d)
  inicio.setUTCDate(inicio.getUTCDate() - (inicio.getUTCDay() + 3) % 7)
  const fin = new Date(inicio)
  fin.setUTCDate(fin.getUTCDate() + 6)
  // Sugerencia ISO del jueves inicial; el período es editable hasta confirmar
  // el contrato de numeración y las semanas que cruzan mes o año con Quijas.
  const iso = new Date(inicio)
  iso.setUTCDate(iso.getUTCDate() + 4 - (iso.getUTCDay() || 7))
  const numero = Math.ceil((((iso - new Date(Date.UTC(iso.getUTCFullYear(), 0, 1))) / 86400000) + 1) / 7)
  return { desde: inicio.toISOString().slice(0, 10), hasta: fin.toISOString().slice(0, 10),
    periodo: `${inicio.toISOString().slice(0, 7).replace('-', '')}-${String(numero).padStart(2, '0')}` }
}

export function tablaTareo(datos, periodo) {
  if (!/^\d{6}-\d{2}$/.test(periodo) || +periodo.slice(4, 6) < 1 || +periodo.slice(4, 6) > 12 ||
      +periodo.slice(7) < 1 || +periodo.slice(7) > 53) throw new Error('Ingresa un período válido: AAAAMM-SS.')
  if (!datos.filas.length) throw new Error('No hay producción en la semana seleccionada.')
  const filas = []
  const claves = new Set()
  for (const r of datos.filas) {
    if (![r.codigoTrabajador, r.actividad, r.labor, r.consumidor].every(v => typeof v === 'string' && v.trim()))
      throw new Error('Completa los códigos de trabajador, actividad, labor y consumidor antes de exportar.')
    const clave = JSON.stringify([r.codigoTrabajador, r.actividad, r.labor, r.consumidor])
    if (claves.has(clave)) continue
    claves.add(clave)
    filas.push([String(filas.length + 1).padStart(4, '0'), r.codigoTrabajador, r.nombre, periodo,
      r.actividad, r.labor, r.consumidor, '', 'N', 0, 0, 0, 0, 0, 0, 0])
  }
  return [columnasTareo, ...filas]
}
