import { useEffect, useId, useRef, useState } from 'react'
import { PanelLateral } from './PanelLateral.jsx'
import { Aviso, Carga, useCarga } from './GestionUi.jsx'
import { Select } from './Select.jsx'

function FichaTrabajador({
  persona,
  servicio,
  campaniaId,
  rol,
  puedeEditar,
  onSaved,
  formId,
  onBusy
}) {
  const [datos, setDatos] = useState({
    dni: persona.dni ?? '',
    nombres: persona.nombres ?? '',
    apellidos: persona.apellidos ?? '',
    activo: persona.activo
  })
  const [ocupado, setOcupado] = useState(false),
    [error, setError] = useState(null),
    [mensaje, setMensaje] = useState('')
  const bloqueo = useRef(false),
    montado = useRef(true)
  useEffect(() => {
    montado.current = true
    return () => {
      montado.current = false
    }
  }, [])
  async function guardar(e) {
    e.preventDefault()
    if (!puedeEditar || bloqueo.current) return
    bloqueo.current = true
    setOcupado(true)
    onBusy(true)
    setError(null)
    setMensaje('')
    try {
      const r = await servicio.editarTrabajadorCampania(
        campaniaId,
        rol,
        persona.participacionId,
        datos
      )
      if (!montado.current) return
      setDatos({
        dni: r.dni,
        nombres: r.nombres,
        apellidos: r.apellidos,
        activo: r.activo
      })
      setMensaje('Datos guardados.')
      onSaved(r)
    } catch (e) {
      if (montado.current && e.name !== 'SolicitudObsoleta') setError(e)
    } finally {
      bloqueo.current = false
      if (montado.current) {
        setOcupado(false)
        onBusy(false)
      }
    }
  }
  return (
    <form id={formId} className="campaign-worker-form" onSubmit={guardar}>
      <h3>Datos del trabajador</h3>
      <Aviso error={error} mensaje={mensaje} />
      <fieldset disabled={!puedeEditar || ocupado}>
        <label>
          DNI
          <input
            required
            inputMode="numeric"
            pattern="[0-9]{8}"
            maxLength={8}
            value={datos.dni}
            onChange={(e) => setDatos({ ...datos, dni: e.target.value })}
          />
        </label>
        <label>
          Nombres
          <input
            required
            maxLength={200}
            value={datos.nombres}
            onChange={(e) => setDatos({ ...datos, nombres: e.target.value })}
          />
        </label>
        <label>
          Apellidos
          <input
            required
            maxLength={200}
            value={datos.apellidos}
            onChange={(e) => setDatos({ ...datos, apellidos: e.target.value })}
          />
        </label>
        <label>
          Estado en esta campaña
          <Select
            value={String(datos.activo)}
            onChange={(e) => setDatos({ ...datos, activo: e.target.value === 'true' })}
          >
            <option
              value="true"
              disabled={!persona.trabajadorActivo && !persona.activo}
            >
              Activo
            </option>
            <option value="false">Inactivo</option>
          </Select>
        </label>
      </fieldset>
      <p>
        El estado solo cambia su participación como{' '}
        {rol === 'JABERO' ? 'jabero' : 'cosechador'} en esta campaña.
      </p>
      {!persona.trabajadorActivo && <p>El trabajador está inactivo a nivel general.</p>}
      {rol === 'JABERO' && (
        <p>La habilitación diaria del jabero se conserva por separado.</p>
      )}
      {!puedeEditar && (
        <p>Solo consulta. Se requiere permiso de gestión de Cosecha para editar.</p>
      )}
    </form>
  )
}

export function TrabajadorCampaniaPanel({
  servicio,
  campania,
  seccion,
  seleccionado,
  puedeEditar,
  onClose,
  onSaved
}) {
  const formId = useId()
  const [ocupado, setOcupado] = useState(false)
  const consulta = useCarga(
    () => servicio.trabajadorCampania(campania.id, seccion.rol, seleccionado.id),
    [servicio, campania.id, seccion.rol, seleccionado.id]
  )
  return (
    <PanelLateral
      titulo={`${seccion.rol === 'JABERO' ? 'Jabero' : 'Cosechador'}: ${seleccionado.nombre}`}
      onClose={onClose}
      ocupado={ocupado}
      acciones={
        puedeEditar && (
          <>
            <button type="button" disabled={ocupado} onClick={onClose}>
              Cancelar
            </button>
            <button
              type="submit"
              form={formId}
              disabled={ocupado || consulta.cargando || Boolean(consulta.error)}
            >
              {ocupado ? 'Guardando…' : 'Guardar datos'}
            </button>
          </>
        )
      }
    >
      <Carga consulta={consulta}>
        {(persona) => (
          <FichaTrabajador
            key={persona.participacionId}
            persona={persona}
            servicio={servicio}
            campaniaId={campania.id}
            rol={seccion.rol}
            puedeEditar={puedeEditar}
            onSaved={onSaved}
            formId={formId}
            onBusy={setOcupado}
          />
        )}
      </Carga>
    </PanelLateral>
  )
}
