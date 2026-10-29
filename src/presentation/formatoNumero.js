export const numero = (value) =>
  value == null ? '—' : new Intl.NumberFormat('es-PE').format(value)
