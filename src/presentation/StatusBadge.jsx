const statusTones = {
  ACTIVO: 'success',
  ACTIVA: 'success',
  HABILITADO: 'success',
  INACTIVO: 'error',
  INACTIVA: 'error',
  RECHAZADO: 'error',
  SUSPENDIDO: 'warning',
  ASIGNADO: 'warning',
  EN_USO: 'warning',
  'EN USO': 'warning',
  DISPONIBLE: 'available',
  UTILIZADO: 'success',
  CONSUMIDO: 'success',
  REGISTRADO: 'success',
  FINALIZADO: 'success',
  FINALIZADA: 'success',
  IMPRESO: 'success',
  PENDIENTE: 'warning',
  'NO IMPRESO': 'warning',
  'NO HABILITADO': 'neutral'
}

export function StatusBadge({
  children,
  tone,
  indicator = false,
  as: Component = 'span'
}) {
  const semanticTone =
    tone ??
    (typeof children === 'string' ? statusTones[children.toUpperCase()] : undefined) ??
    'neutral'
  return (
    <Component
      className={`badge status-badge ${semanticTone}${indicator ? ' has-indicator' : ''}`}
    >
      {indicator && <span className="status-badge-dot" aria-hidden="true" />}
      {children}
    </Component>
  )
}
