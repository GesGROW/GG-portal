export const columnasTareo = ['Item', 'Cod.Trabajador', 'Apellidos y Nombres', 'Periodo',
  'Cod.Actividad', 'Cod.Labor', 'Cod.Consumidor', 'Cod. Orden Produccion', 'Tipo Asistencia',
  ...Array.from({ length: 7 }, (_, i) => `Dia ${String(i + 1).padStart(2, '0')}`), 'Total semanal']

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

export function tablaTareo(datos) {
  if (!datos.filas.length) throw new Error('No hay producción en el período seleccionado.')
  const claves = new Set()
  const filas = datos.filas.map((r, i) => {
    const semana = semanaTareo(r.semanaInicio)
    if (semana.desde !== r.semanaInicio || semana.periodo !== r.periodo || !r.trabajadorId || !Array.isArray(r.dias))
      throw new Error('Semana de bonos inválida.')
    const clave = `${r.trabajadorId}:${r.semanaInicio}`
    if (claves.has(clave)) throw new Error('El trabajador tiene una semana duplicada.')
    claves.add(clave)
    const dias = Array(7).fill(0), fechas = new Set()
    for (const d of r.dias) {
      semanaTareo(d.fecha)
      const indice = Math.round((Date.parse(d.fecha) - Date.parse(r.semanaInicio)) / 86400000)
      if (indice < 0 || indice > 6 || fechas.has(d.fecha) || !Number.isFinite(d.bono) || d.bono < 0)
        throw new Error('Bono diario inválido.')
      fechas.add(d.fecha)
      const centimos = Math.round(d.bono * 100)
      if (!Number.isSafeInteger(centimos) || Math.abs(centimos / 100 - d.bono) > 1e-6) throw new Error('Importe de bono inválido.')
      dias[indice] = centimos
    }
    const suma = dias.reduce((a,b) => a+b,0)
    if (!Number.isFinite(r.totalSemanal) || Math.abs(suma / 100 - r.totalSemanal) > 1e-6)
      throw new Error('El total semanal no coincide con los bonos diarios.')
    return [String(i+1).padStart(4,'0'), r.codigoTrabajador ?? '', r.nombre, r.periodo,
      r.actividad ?? '', r.labor ?? '', r.consumidor ?? '', '', 'N', ...dias.map(n => n/100), suma/100]
  })
  const total = filas.reduce((s,r) => s + Math.round(r[16]*100),0)/100
  if (!Number.isFinite(datos.totalBono) || Math.abs(total-datos.totalBono)>1e-6)
    throw new Error('El Excel no coincide con el total del reporte de bonos.')
  return [columnasTareo, ...filas]
}
