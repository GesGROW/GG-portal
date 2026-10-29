export function momentoDia(fecha = new Date()) {
  const hora = Number(
    new Intl.DateTimeFormat('en-GB', {
      hour: '2-digit',
      hourCycle: 'h23',
      timeZone: 'America/Lima'
    }).format(fecha)
  )
  return hora >= 6 && hora < 12
    ? 'day'
    : hora >= 12 && hora < 19
      ? 'afternoon'
      : 'night'
}
