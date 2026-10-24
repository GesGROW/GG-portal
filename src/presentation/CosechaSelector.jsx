import { Select } from './Select.jsx'
import { useNavigate } from 'react-router'
import { OwnerIcon } from './OwnerAssets.jsx'
import './cosecha-selector.css'

export function CosechaSelector({
  campanias = [],
  seleccion = '',
  pendiente = false,
  destino = '/cosecha/generar'
}) {
  const navigate = useNavigate()
  return (
    <div className="cosecha-heading">
      <h1>Cosecha</h1>
      <label className="cosecha-campaign-selector">
        <span className="sr-only">Campaña de cosecha</span>
        <Select
          aria-label="Campaña de cosecha"
          value={seleccion}
          disabled={pendiente}
          onChange={(e) =>
            navigate(
              e.target.value === ''
                ? '/cosecha/configurar'
                : `${destino}?campania=${encodeURIComponent(e.target.value)}`
            )
          }
        >
          {campanias.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre}
              {c.estado === 'ACTIVA' ? ' (actual)' : ''}
            </option>
          ))}
          <option value="">Agregar campaña / cultivo</option>
        </Select>
        <OwnerIcon name="chevron" />
      </label>
    </div>
  )
}
