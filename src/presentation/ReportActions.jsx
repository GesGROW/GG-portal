import { useState } from 'react'
import { fecha } from './Reportes.jsx'
import { Icon } from './Ui.jsx'

export function ReportActions({ consulta, servicio }) {
  const [exportando, setExportando] = useState(false),
    [error, setError] = useState(null)
  async function exportar() {
    setError(null)
    setExportando(true)
    try {
      await servicio.exportar(consulta.datos)
    } catch (e) {
      if (e.name !== 'SolicitudObsoleta') setError(e)
    } finally {
      setExportando(false)
    }
  }
  return (
    <div className="editorial-report-actions">
      <button
        className="quiet icon-button"
        aria-label="Actualizar datos"
        title="Actualizar datos"
        disabled={consulta.cargando}
        onClick={consulta.refrescar}
      >
        <Icon name="refresh" />
      </button>
      {consulta.datos && !consulta.error && !consulta.cargando && (
        <>
          <p>
            Última actualización:{' '}
            <time dateTime={consulta.datos.actualizadoEn}>
              {fecha(consulta.datos.actualizadoEn)}
            </time>
          </p>
          <button className="secondary" disabled={exportando} onClick={exportar}>
            <Icon name="download" />
            {exportando ? 'Exportando…' : 'Exportar CSV'}
          </button>
        </>
      )}
      {error && <p role="alert">{error.message}</p>}
    </div>
  )
}
