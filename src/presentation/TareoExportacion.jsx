import { useRef, useState } from 'react'
import { Carga, useCarga } from './GestionUi.jsx'
import { DataTable } from './DataTable.jsx'
import { semanaTareo } from '../application/tareo.js'

export function TareoExportacion({ servicio, campaniaId, trabajadorId, hoy }) {
  const [abierto, setAbierto] = useState(false)
  return <section className="tareo-exportacion" aria-label="Exportación de tareo">
    <button className="secondary" aria-expanded={abierto} onClick={() => setAbierto(v => !v)}>Exportar tareo de Quijas</button>
    {abierto && <Editor key={`${campaniaId}:${trabajadorId}`} servicio={servicio} campaniaId={campaniaId} trabajadorId={trabajadorId} hoy={hoy} />}
  </section>
}
function Editor({ servicio, campaniaId, trabajadorId, hoy }) {
  const [fecha, setFecha] = useState(hoy), [periodo, setPeriodo] = useState(semanaTareo(hoy).periodo)
  const consulta = useCarga(() => servicio.tareo({ campaniaId, trabajadorId, fecha }), [servicio, campaniaId, trabajadorId, fecha])
  const semana = fecha ? semanaTareo(fecha) : null
  return <div className="tareo-editor">
    <h3>Tareo semanal</h3>
    <p>Revisa los cosechadores, lotes y variedades con producción en la semana. El Excel agrupa por trabajador, actividad, labor y consumidor. Los siete días se exportan en 0, sin importes de bonos.</p>
    <div className="tareo-campos">
      <label>Fecha de la semana<input type="date" required value={fecha} onChange={e => {
        if (!e.target.value) return
        setFecha(e.target.value); setPeriodo(semanaTareo(e.target.value).periodo)
      }} /></label>
      <label>Período de Quijas<input type="text" required maxLength={9} pattern="[0-9]{6}-[0-9]{2}" value={periodo} onChange={e => setPeriodo(e.target.value)} /></label>
    </div>
    {semana && <p>Jueves {semana.desde} a miércoles {semana.hasta}. Confirma el período sugerido antes de exportar.</p>}
    <Carga consulta={consulta}>{snapshot => snapshot.datos.desde === semana?.desde
      ? <Filas key={`${fecha}:${JSON.stringify(snapshot.datos.filas)}`} snapshot={snapshot} servicio={servicio} periodo={periodo} recargar={consulta.refrescar} />
      : <p role="status">Actualizando semana…</p>}</Carga>
  </div>
}
function Filas({ snapshot, servicio, periodo, recargar }) {
  const [filas, setFilas] = useState(snapshot.datos.filas), [ocupado, setOcupado] = useState(false),
    [error, setError] = useState(''), [mensaje, setMensaje] = useState('')
  const guardando = useRef(false)
  const cambiado = JSON.stringify(filas) !== JSON.stringify(snapshot.datos.filas)
  const incompletos = filas.filter(r => ![r.codigoTrabajador, r.actividad, r.labor, r.consumidor].every(v => typeof v === 'string' && v.trim())).length
  const cambiar = (r, campo, valor) => setFilas(actual => actual.map(f =>
    (campo === 'codigoTrabajador' ? f.trabajadorId === r.trabajadorId : f.loteId === r.loteId && f.variedadId === r.variedadId)
      ? { ...f, [campo]: valor } : f))
  async function ejecutar(accion) {
    if (guardando.current) return
    guardando.current = true; setOcupado(true); setError(''); setMensaje('')
    try { await accion() } catch (e) { if (e.name !== 'SolicitudObsoleta') setError(e.message) }
    finally { guardando.current = false; setOcupado(false) }
  }
  async function importar(file) {
    if (!file) return
    await ejecutar(async () => {
      const padron = await servicio.leerPadron(file)
      setFilas(actual => actual.map(r => {
        if (!padron.has(r.dni)) return r
        return { ...r, codigoTrabajador: padron.get(r.dni) }
      }))
      // Count against the current snapshot, independently of React's state scheduling.
      const coinciden = new Set(filas.filter(r => padron.has(r.dni)).map(r => r.trabajadorId)).size
      setMensaje(`${coinciden} trabajadores encontrados por DNI. Revisa y guarda los códigos antes de exportar.`)
    })
  }
  const input = campo => ({ key: campo, header: { codigoTrabajador: 'Código trabajador', actividad: 'Actividad', labor: 'Labor', consumidor: 'Consumidor' }[campo],
    render: r => <input type="text" maxLength={campo === 'codigoTrabajador' ? 40 : 60} disabled={ocupado} value={r[campo] ?? ''}
      aria-label={`${{ codigoTrabajador: 'Código trabajador', actividad: 'Actividad', labor: 'Labor', consumidor: 'Consumidor' }[campo]}: ${r.nombre}, ${r.lote}, ${r.variedad ?? ''}`}
      onChange={e => cambiar(r, campo, e.target.value)} /> })
  return <>
    <p>Completa los códigos externos de actividad, labor y consumidor para cada lote y variedad. Se guardan para las próximas exportaciones.</p>
    <label className="tareo-padron">Completar códigos desde padrón Excel<input type="file" accept=".xlsx" disabled={ocupado || !filas.length} onChange={e => { void importar(e.target.files?.[0]); e.target.value = '' }} /></label>
    <DataTable label="Vista previa del tareo" data={filas} pageSize={10} rowKey={r => `${r.trabajadorId}:${r.loteId}:${r.variedadId}`}
      emptyState="No hay producción en esta semana." columns={[
        { key: 'nombre', header: 'Apellidos y nombres' }, { key: 'lote', header: 'Lote' }, { key: 'variedad', header: 'Variedad' },
        input('codigoTrabajador'), input('actividad'), input('labor'), input('consumidor'),
        { key: 'horas', header: 'Días 01–07', render: () => '0' }
      ]} />
    {incompletos > 0 && <p role="status">{incompletos} filas con códigos pendientes.</p>}
    {error && <p role="alert">{error}</p>}{mensaje && <p role="status">{mensaje}</p>}
    <div className="tareo-acciones">
      <button disabled={ocupado || !cambiado} onClick={() => ejecutar(async () => {
        const trabajadores = [...new Map(filas.filter(r => snapshot.datos.filas.find(o => o.trabajadorId === r.trabajadorId)?.codigoTrabajador !== r.codigoTrabajador)
          .map(r => [r.trabajadorId, { id: r.trabajadorId, codigo: r.codigoTrabajador?.trim() ?? '' }])).values()]
        const imputaciones = [...new Map(filas.filter(r => {
          const o = snapshot.datos.filas.find(o => o.loteId === r.loteId && o.variedadId === r.variedadId)
          return ['actividad', 'labor', 'consumidor'].some(k => o[k] !== r[k])
        }).map(r => [`${r.loteId}:${r.variedadId}`, { loteId: r.loteId, variedadId: r.variedadId,
          actividad: r.actividad?.trim() ?? '', labor: r.labor?.trim() ?? '', consumidor: r.consumidor?.trim() ?? '' }])).values()]
        await servicio.guardarTareo(snapshot.campaniaId, { trabajadores, imputaciones })
        recargar()
      })}>{ocupado ? 'Procesando…' : 'Guardar códigos'}</button>
      <button className="secondary" disabled={ocupado || cambiado || !filas.length || incompletos > 0}
        onClick={() => ejecutar(async () => { await servicio.exportarTareo(snapshot, periodo); setMensaje('Archivo de tareo generado.') })}>Descargar Excel</button>
    </div>
    {cambiado && <p>Guarda los códigos para habilitar la descarga.</p>}
  </>
}
