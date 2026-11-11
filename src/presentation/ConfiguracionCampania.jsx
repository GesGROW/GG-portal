import { useEffect, useRef, useState } from 'react'
import { Carga, useCarga } from './GestionUi.jsx'
import { Skeleton } from './Ui.jsx'
import { ConsumidoresCampania } from './ConsumidoresCampania.jsx'
import './configuracion-campania.css'

export function ConfiguracionCampania({ servicio, campania, onGuardado }) {
  const consulta = useCarga(() => servicio.configuracionCampania(campania.id), [servicio, campania.id])
  return <><Carga consulta={consulta} skeleton={<Skeleton variant="form" />}>
    {(datos) => <EditorConfiguracion key={datos.revision} datos={datos} servicio={servicio}
      onGuardado={onGuardado} onRecargar={consulta.refrescar} />}
  </Carga>{servicio.consumidoresCampania && <ConsumidoresCampania key={campania.id} servicio={servicio} campaniaId={campania.id} />}</>
}

function EditorConfiguracion({ datos, servicio, onGuardado, onRecargar }) {
  const [borrador, setBorrador] = useState(() => structuredClone(datos))
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState('')
  const [mensaje, setMensaje] = useState('')
  const montado = useRef(true)
  const bloqueo = useRef(false)
  useEffect(() => { montado.current = true; return () => { montado.current = false } }, [])
  const cambiado = JSON.stringify(borrador) !== JSON.stringify(datos)
  useEffect(() => {
    if (!cambiado) return
    const salir = (e) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', salir)
    return () => window.removeEventListener('beforeunload', salir)
  }, [cambiado])
  function cambiar(datosNuevos) {
    setMensaje('')
    setBorrador((previo) => ({ ...previo, ...datosNuevos }))
  }
  function lote(id, datosNuevos) {
    cambiar({ lotes: borrador.lotes.map((l) => l.id === id ? { ...l, ...datosNuevos } : l) })
  }
  async function guardar(e) {
    e.preventDefault()
    if (bloqueo.current) return
    bloqueo.current = true
    setOcupado(true); setError(''); setMensaje('')
    try {
      const resultado = await servicio.guardarConfiguracionCampania(datos.campaniaId, borrador)
      if (!montado.current) return
      setBorrador(structuredClone(resultado))
      setMensaje('Configuración guardada.')
      onGuardado?.(resultado)
      onRecargar()
    } catch (e) {
      if (montado.current && e.name !== 'SolicitudObsoleta') setError(e.message)
    } finally {
      bloqueo.current = false
      if (montado.current) setOcupado(false)
    }
  }
  return <form className="campaign-settings" onSubmit={guardar} aria-label="Configuración de campaña" aria-busy={ocupado}>
    <header className="campaign-settings-heading">
      <h2>Configuración de campaña</h2>
    </header>
    <fieldset disabled={ocupado}>
      <legend>Datos de la campaña</legend>
      <div className="campaign-settings-basics">
        <label className="campaign-settings-name">Nombre de la campaña
          <input required maxLength={100} value={borrador.nombre} onChange={(e) => cambiar({ nombre: e.target.value })} />
        </label>
        <label>Fecha de inicio<input type="date" required value={borrador.fechaInicio ?? ''}
          onChange={(e) => cambiar({ fechaInicio: e.target.value })} /></label>
        <label>Fecha de fin<input type="date" required min={borrador.fechaInicio || undefined} value={borrador.fechaFin ?? ''}
          onChange={(e) => cambiar({ fechaFin: e.target.value })} /></label>
      </div>
    </fieldset>
    <fieldset disabled={ocupado}>
      <legend>Variedades</legend>
      <div className="campaign-settings-varieties">
        {borrador.variedades.map((v, i) => <div className="campaign-settings-variety" key={v.id}>
          <label>Variedad {i + 1}<input required maxLength={100} value={v.nombre} readOnly={v.protegida}
            aria-describedby={v.protegida ? `protected-${v.id}` : undefined}
            onChange={(e) => cambiar({ variedades: borrador.variedades.map((item) => item.id === v.id ? { ...item, nombre: e.target.value } : item) })} /></label>
          {v.protegida && <small id={`protected-${v.id}`}>Nombre protegido por historial o uso compartido</small>}
          {!datos.variedades.some((item) => item.id === v.id) && <button className="campaign-settings-text" type="button"
            onClick={() => cambiar({ variedades: borrador.variedades.filter((item) => item.id !== v.id),
              lotes: borrador.lotes.map((l) => ({ ...l, variedades: l.variedades.filter((id) => id !== v.id) })) })}>Quitar variedad {i + 1}</button>}
        </div>)}
      </div>
      <button className="campaign-settings-add" type="button" disabled={borrador.variedades.length >= 100}
        onClick={() => cambiar({ variedades: [...borrador.variedades, { id: crypto.randomUUID(), nombre: '', activo: true, protegida: false }] })}>
        <span aria-hidden="true">+</span> Agregar variedad</button>
    </fieldset>
    <fieldset disabled={ocupado}>
      <legend>Lotes de campo</legend>
      <div className="campaign-settings-lots">
        {borrador.lotes.map((l, i) => <section className="campaign-settings-lot" key={l.id} aria-label={`Lote de campo ${i + 1}`}>
          <div className="campaign-settings-lot-heading">
            <label>Nombre del lote {i + 1}<input required maxLength={100} value={l.nombre} readOnly={l.protegido}
              onChange={(e) => lote(l.id, { nombre: e.target.value })} /></label>
            <label className="campaign-settings-check"><input type="checkbox" checked={l.activo} disabled={l.sesionActiva}
              onChange={(e) => lote(l.id, { activo: e.target.checked })} />Lote activo</label>
          </div>
          {l.protegido && <p className="campaign-settings-help">El nombre se conserva porque este lote tiene sesiones registradas.</p>}
          {l.sesionActiva && <p className="campaign-settings-help">Cierra sus sesiones activas antes de desactivarlo o retirar una variedad en uso.</p>}
          <div className="campaign-settings-choices" role="group" aria-label={`Variedades del lote ${i + 1}`}>
            {borrador.variedades.filter((v) => v.activo !== false || l.variedades.includes(v.id)).map((v, j) => <label className="campaign-settings-check" key={v.id}>
              <input type="checkbox" checked={l.variedades.includes(v.id)} disabled={v.activo === false} onChange={(e) => lote(l.id, {
                variedades: e.target.checked ? [...l.variedades, v.id] : l.variedades.filter((id) => id !== v.id)
              })} />{v.nombre.trim() || `Variedad ${j + 1}`}{v.activo === false && ' (inactiva)'}</label>)}
          </div>
          {!datos.lotes.some((item) => item.id === l.id) && <button className="campaign-settings-text" type="button"
            onClick={() => cambiar({ lotes: borrador.lotes.filter((item) => item.id !== l.id) })}>Quitar lote {i + 1}</button>}
        </section>)}
      </div>
      <button className="campaign-settings-add" type="button" disabled={borrador.lotes.length >= 100}
        onClick={() => cambiar({ lotes: [...borrador.lotes, { id: crypto.randomUUID(), nombre: '', activo: true,
          variedades: [], protegido: false, sesionActiva: false }] })}>
        <span aria-hidden="true">+</span> Agregar lote</button>
    </fieldset>
    {error && <div className="campaign-settings-error" role="alert"><p>{error}</p>
      <button type="button" className="campaign-settings-text" disabled={ocupado} onClick={onRecargar}>Recargar configuración</button></div>}
    {mensaje && <p role="status">{mensaje}</p>}
    <footer className="campaign-settings-actions">
      <span role="status">{cambiado ? 'Tienes cambios sin guardar' : 'Sin cambios pendientes'}</span>
      <button className="campaign-settings-discard" type="button" disabled={ocupado || !cambiado}
        onClick={() => { setBorrador(structuredClone(datos)); setError(''); setMensaje('') }}>Descartar cambios</button>
      <button className="campaign-settings-save" type="submit" disabled={ocupado || !cambiado}>
        {ocupado ? 'Guardando…' : 'Guardar cambios'}</button>
    </footer>
  </form>
}
