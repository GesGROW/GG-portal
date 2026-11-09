import { useEffect, useRef, useState } from 'react'
import { Carga, useCarga } from './GestionUi.jsx'
import { Skeleton } from './Ui.jsx'
import { DataTable } from './DataTable.jsx'
import './configuracion-campania.css'

export const soles = (n) => new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' }).format(n)
export function BonoConfiguracion({ servicio, campania }) {
  const [mensaje, setMensaje] = useState('')
  const consulta = useCarga(() => servicio.bonoConfiguracion(campania.id), [servicio, campania.id])
  return <>{mensaje && <p role="status">{mensaje}</p>}<Carga consulta={consulta} skeleton={<Skeleton variant="form" />}>
    {(datos) => <Editor key={`${datos.revision}:${datos.hoy}:${datos.bloqueado}`} datos={datos}
      servicio={servicio} campania={campania} recargar={consulta.refrescar} onGuardado={() => setMensaje('Configuración del bono guardada.')} />}
  </Carga></>
}
function Editor({ datos: recibidos, servicio, campania, recargar, onGuardado }) {
  const datos = { jarrasHabilitado: false, jarrasUmbral: 30, jarrasMonto: 2, ...recibidos }
  const [d, setD] = useState(datos), [ocupado, setOcupado] = useState(false),
    [error, setError] = useState('')
  const guardando = useRef(false)
  const bloqueado = datos.bloqueado || campania.estado !== 'ACTIVA'
  const cambiado = d.habilitado !== datos.habilitado || d.umbral !== datos.umbral || d.monto !== datos.monto || d.jarrasHabilitado !== datos.jarrasHabilitado || d.jarrasUmbral !== datos.jarrasUmbral || d.jarrasMonto !== datos.jarrasMonto
  useEffect(() => {
    if (!cambiado) return
    const salir = (e) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', salir)
    return () => window.removeEventListener('beforeunload', salir)
  }, [cambiado])
  async function guardar(e) {
    e.preventDefault()
    if (guardando.current) return
    guardando.current = true; setOcupado(true); setError('')
    try {
      await servicio.guardarBono(campania.id, d)
      onGuardado(); recargar()
    } catch (e) { if (e.name !== 'SolicitudObsoleta') setError(e.message) }
    finally { guardando.current = false; setOcupado(false) }
  }
  return <section className="campaign-settings" aria-label="Bono por jabas adicionales">
    <form onSubmit={guardar} aria-busy={ocupado}>
      <fieldset disabled={ocupado || bloqueado}>
        <legend>Bono por jabas adicionales</legend>
        <label className="campaign-settings-check"><input type="checkbox" checked={d.habilitado}
          onChange={(e) => setD({ ...d, habilitado: e.target.checked })} />Habilitar bono</label>
        <div className="campaign-settings-varieties">
          <label>Umbral diario de jabas<input type="number" required min="0" max="1000000" step="1" value={d.umbral}
            onChange={(e) => setD({ ...d, umbral: e.target.value === '' ? '' : Number(e.target.value) })} /></label>
          <label>Monto por jaba adicional (S/)<input type="number" required min="0.01" max="1000000" step="0.01" value={d.monto}
            onChange={(e) => setD({ ...d, monto: e.target.value === '' ? '' : Number(e.target.value) })} /></label>
        </div>
      </fieldset>
      <fieldset disabled={ocupado || bloqueado}>
        <legend>Bono por jarras adicionales</legend>
        <label className="campaign-settings-check"><input type="checkbox" checked={d.jarrasHabilitado}
          onChange={(e) => setD({ ...d, jarrasHabilitado: e.target.checked })} />Habilitar bono de jarras</label>
        <div className="campaign-settings-varieties">
          <label>Umbral diario de jarras<input type="number" required min="0" max="1000000" step="1" value={d.jarrasUmbral}
            onChange={(e) => setD({ ...d, jarrasUmbral: e.target.value === '' ? '' : Number(e.target.value) })} /></label>
          <label>Monto por jarra adicional (S/)<input type="number" required min="0.01" max="1000000" step="0.01" value={d.jarrasMonto}
            onChange={(e) => setD({ ...d, jarrasMonto: e.target.value === '' ? '' : Number(e.target.value) })} /></label>
        </div>
      </fieldset>
      {bloqueado && <p className="campaign-settings-help" role="status">{datos.bloqueado
        ? 'El bono está bloqueado porque ya se inició una sesión de lectura. Podrás modificarlo otro día, antes de la primera sesión y sin sesiones activas.'
        : 'La campaña está cerrada. Se conserva el historial del bono.'}</p>}
      {error && <p className="campaign-settings-error" role="alert">{error}</p>}
      <footer className="campaign-settings-actions">
        <button className="campaign-settings-discard" type="button" onClick={recargar} disabled={ocupado}>Actualizar configuración del bono</button>
        <button className="campaign-settings-save" disabled={ocupado || bloqueado || !cambiado}>
          {ocupado ? 'Guardando…' : 'Guardar bono'}</button>
      </footer>
    </form>
    <section className="campaign-settings-history" aria-label="Historial de cambios del bono">
      <DataTable label="Historial del bono" data={datos.historial} pageSize={10}
        emptyState="Todavía no hay cambios registrados." columns={[
        { key: 'creadoEn', header: 'Modificado', render: (r) => new Date(r.creadoEn).toLocaleString('es-PE', { timeZone: 'America/Lima' }) },
        { key: 'habilitado', header: 'Bono', render: (r) => r.habilitado ? 'Habilitado' : 'Deshabilitado' },
        { key: 'umbral', header: 'Umbral' }, { key: 'monto', header: 'Por jaba', render: (r) => soles(r.monto) },
        { key: 'jarrasHabilitado', header: 'Bono de jarras', render: (r) => r.jarrasHabilitado ? 'Habilitado' : 'Deshabilitado' },
        { key: 'jarrasUmbral', header: 'Umbral de jarras', render: (r) => r.jarrasUmbral ?? 30 },
        { key: 'jarrasMonto', header: 'Por jarra', render: (r) => soles(r.jarrasMonto ?? 2) },
        { key: 'usuario', header: 'Usuario' }
      ]} />
    </section>
  </section>
}
