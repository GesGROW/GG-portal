const texto = (valor, etiqueta) => {
  if (typeof valor !== 'string' || !valor.trim() || valor.trim().length > 100)
    throw new Error(`${etiqueta}: ingresa un nombre de hasta 100 caracteres.`)
  return valor.trim()
}
const fecha = (valor) =>
  typeof valor === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(valor) &&
  Number.isFinite(Date.parse(valor)) && new Date(valor).toISOString().slice(0, 10) === valor
const identificador = (id) => {
  if (typeof id !== 'string' || !id || id.length > 100)
    throw new Error('Identificador de configuración inválido.')
  return id
}
function unicos(filas, campo, etiqueta) {
  const valores = filas.map((f) => String(f[campo]).toLocaleLowerCase('es'))
  if (new Set(valores).size !== valores.length)
    throw new Error(`${etiqueta}: no puede haber valores repetidos.`)
}
export function validarConfiguracionCampania(datos) {
  if (!/^[a-f0-9]{32}$/.test(datos?.revision ?? ''))
    throw new Error('Vuelve a cargar la configuración antes de guardar.')
  if (!fecha(datos.fechaInicio) || !fecha(datos.fechaFin) || datos.fechaFin < datos.fechaInicio)
    throw new Error('Las fechas deben ser válidas y el fin igual o posterior al inicio.')
  if (!Array.isArray(datos.variedades) || !datos.variedades.length || datos.variedades.length > 100 ||
      !Array.isArray(datos.lotes) || !datos.lotes.length || datos.lotes.length > 100)
    throw new Error('Agrega entre 1 y 100 variedades y lotes.')
  const variedades = datos.variedades.map((v) => ({
    id: identificador(v.id), nombre: texto(v.nombre, 'Variedad')
  }))
  unicos(variedades, 'id', 'Variedades')
  unicos(variedades, 'nombre', 'Variedades')
  const ids = new Set(variedades.map((v) => v.id))
  const lotes = datos.lotes.map((l) => {
    if (typeof l.activo !== 'boolean' || !Array.isArray(l.variedades) ||
        !l.variedades.length || new Set(l.variedades).size !== l.variedades.length ||
        l.variedades.some((id) => !ids.has(id)))
      throw new Error('Cada lote debe tener al menos una variedad del cultivo, sin repetir.')
    return { id: identificador(l.id), nombre: texto(l.nombre, 'Lote'), activo: l.activo,
      variedades: [...l.variedades] }
  })
  unicos(lotes, 'id', 'Lotes')
  unicos(lotes, 'nombre', 'Lotes')
  if (!lotes.some((l) => l.activo)) throw new Error('Conserva al menos un lote activo.')
  return { revision: datos.revision, nombre: texto(datos.nombre, 'Campaña'),
    fechaInicio: datos.fechaInicio, fechaFin: datos.fechaFin, variedades, lotes }
}

export function crearConfiguracionCampania({ ejecutar, operacion }) {
  function validarRespuesta(r, campaniaId) {
    if (!r || r.campaniaId !== campaniaId || !Array.isArray(r.lotes) ||
        !Array.isArray(r.variedades) || !/^[a-f0-9]{32}$/.test(r.revision ?? ''))
      throw new Error('La configuración no corresponde a la campaña solicitada.')
    return r
  }
  return {
    configuracionCampania: async (id) => validarRespuesta(
      await ejecutar('configuracionCampania', identificador(id)), id),
    guardarConfiguracionCampania: async (id, datos) => validarRespuesta(
      await operacion('guardarConfiguracionCampania', validarConfiguracionCampania(datos), identificador(id)), id)
  }
}
