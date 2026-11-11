import { useRef, useState } from 'react'

export function TareoExportacion({ servicio, campaniaId, trabajadorId, desde, hasta }) {
  const [ocupado, setOcupado] = useState(false), [error, setError] = useState('')
  const bloqueo = useRef(false)
  async function descargar() {
    if (bloqueo.current) return
    bloqueo.current = true; setOcupado(true); setError('')
    try {
      await servicio.descargarTareo({ campaniaId, trabajadorId, desde, hasta })
    } catch (e) { if (e.name !== 'SolicitudObsoleta') setError(e.message) }
    finally { bloqueo.current = false; setOcupado(false) }
  }
  return <div className="tareo-exportacion">
    <button type="button" className="bonos-descargar" disabled={ocupado} onClick={descargar}>
      {ocupado ? 'Descargando…' : 'Descargar reporte'}
    </button>
    {error && <p role="alert">{error}</p>}
  </div>
}
