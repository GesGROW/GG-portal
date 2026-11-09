import { useRef, useState } from 'react'
import { Carga, useCarga } from './GestionUi.jsx'
import { Select } from './Select.jsx'

export function ConsumidoresCampania({ servicio, campaniaId }) {
  const consulta = useCarga(() => servicio.consumidoresCampania(campaniaId), [servicio, campaniaId])
  return <Carga consulta={consulta} skeleton="form">{datos => datos.catalogo.length > 0
    ? <Editor key={datos.revision} datos={datos} servicio={servicio} recargar={consulta.refrescar} /> : null}</Carga>
}
function Editor({ datos, servicio, recargar }) {
  const [filas, setFilas] = useState(datos.filas), [ocupado, setOcupado] = useState(false), [error, setError] = useState('')
  const bloqueo = useRef(false)
  const cambiado = filas.some((f, i) => f.consumidor !== datos.filas[i].consumidor)
  async function guardar(e) {
    e.preventDefault()
    if (bloqueo.current) return
    bloqueo.current = true; setOcupado(true); setError('')
    try {
      await servicio.guardarConsumidoresCampania(datos.campaniaId, { revision: datos.revision,
        filas: filas.map(({ loteId, variedadId, consumidor }) => ({ loteId, variedadId, consumidor })) })
      recargar()
    } catch (e) { if (e.name !== 'SolicitudObsoleta') setError(e.message) }
    finally { bloqueo.current = false; setOcupado(false) }
  }
  return <form className="campaign-settings" onSubmit={guardar} aria-label="Consumidores del tareo">
    <h2>Consumidores del tareo</h2>
    <p>Estas correspondencias se utilizan automáticamente al descargar el Excel.</p>
    <fieldset disabled={ocupado}>
      <legend>Consumidor por lote y variedad</legend>
      <div className="campaign-settings-varieties">{filas.map((f, i) => <label key={`${f.loteId}:${f.variedadId}`}>
        {f.lote} · {f.variedad}
        <Select value={f.consumidor} onChange={e => setFilas(actual => actual.map((a, j) => j === i ? { ...a, consumidor: e.target.value } : a))}>
          <option value="">Sin correspondencia</option>
          {datos.catalogo.map(c => <option key={c.codigo} value={c.codigo}>{c.codigo} · {c.nombre}</option>)}
        </Select>
      </label>)}</div>
    </fieldset>
    {error && <p role="alert">{error}</p>}
    <footer className="campaign-settings-actions"><button className="campaign-settings-save" disabled={ocupado || !cambiado}>
      {ocupado ? 'Guardando…' : 'Guardar consumidores'}</button></footer>
  </form>
}
