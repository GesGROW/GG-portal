import { Icon } from './Ui.jsx'
import './summary-metrics.css'

// Comparte escala, iconos y tipografía; cada pantalla entrega sus métricas.
export function SummaryMetrics({ label, items, className = '' }) {
  return (
    <div className={`summary-metrics ${className}`.trim()} aria-label={label}>
      {items.map((item) => {
        const Component = item.onClick ? 'button' : 'article'
        return (
          <Component
            key={item.key}
            className="summary-metric"
            type={item.onClick ? 'button' : undefined}
            onClick={item.onClick}
            aria-pressed={item.onClick ? item.pressed : undefined}
          >
            <Icon name={item.icon} strokeWidth={1.5} />
            <div className="summary-metric-copy">
              <span>{item.label}</span>
              <strong>{item.value}</strong>
            </div>
          </Component>
        )
      })}
    </div>
  )
}
