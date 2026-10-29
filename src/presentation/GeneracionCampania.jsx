import { useEffect, useId, useRef, useState } from 'react'

const geometria = Object.freeze({
  separacionColumnasMm: 2,
  separacionFilasMm: 2,
  margenIzquierdoMm: 3
})

export function GeneracionCampania({
  servicio,
  campania,
  pendiente = false,
  operacionId = null,
  onNuevaGeneracion
}) {
  const [personas, setPersonas] = useState('0'),
    [tamanio, setTamanio] = useState('0')
  const ayudaId = useId()
  const [resultado, setResultado] = useState(null),
    [borrador, setBorrador] = useState(null)
  const [vista, setVista] = useState(null),
    [intento, setIntento] = useState(null)
  const [ocupado, setOcupado] = useState(false),
    [salida, setSalida] = useState(''),
    [error, setError] = useState('')
  const [actualizar, setActualizar] = useState(false)
  const [cuenta, setCuenta] = useState(null)
  const [confirmandoSalida, setConfirmandoSalida] = useState(false)
  const [recuperando, setRecuperando] = useState(Boolean(operacionId)),
    [revision, setRevision] = useState(0)
  const bloqueo = useRef(false),
    montado = useRef(true),
    operacion = useRef(crypto.randomUUID())
  const vistaActual = useRef(null),
    destinos = useRef(new Set())
  function cerrarDestino(d) {
    if (destinos.current.delete(d)) d.cerrar()
  }
  function cerrarVista() {
    vistaActual.current?.cerrar()
    vistaActual.current = null
  }
  function mostrarVista(v) {
    if (!v?.url || typeof v.cerrar !== 'function')
      throw new Error('No se pudo preparar el PDF de vista previa.')
    cerrarVista()
    vistaActual.current = v
    setVista(v)
  }
  useEffect(() => {
    montado.current = true
    return () => {
      montado.current = false
      cerrarVista()
      for (const d of destinos.current) cerrarDestino(d)
    }
  }, [])
  useEffect(() => {
    if (cuenta === null) return
    if (cuenta === 0) {
      nueva()
      return
    }
    const temporizador = setTimeout(() => setCuenta((n) => n - 1), 1000)
    return () => clearTimeout(temporizador)
  }, [cuenta])
  async function leerVistaGuardada(r) {
    const d = servicio.abrirImpresion({ ...geometria, modo: 'vista' })
    try {
      return await servicio.imprimirGeneracion(r.operacionId, d)
    } finally {
      d.cerrar()
    }
  }
  useEffect(() => {
    if (!operacionId || pendiente) return
    let vigente = true
    setRecuperando(true)
    setError('')
    void (async () => {
      try {
        const r = await servicio.recuperarGeneracion(operacionId)
        if (!vigente) return
        if (!r || r.operacionId !== operacionId || r.campaniaId !== campania.id)
          throw new Error(
            'La operación no pertenece a esta campaña o no está disponible.'
          )
        operacion.current = operacionId
        setResultado(r)
        setConfirmandoSalida(r.estadoImpresion === 'PENDIENTE')
        setIntento({
          operacionId,
          campaniaId: campania.id,
          cantidadTickets: r.cantidadTickets,
          tamanioLote: r.tamanioLote
        })
        setPersonas(String(Math.ceil(r.cantidadTickets / r.tamanioLote)))
        setTamanio(String(r.tamanioLote))
        if (r.formatoImpresion === 'TSC_30X20_3') {
          const v = await leerVistaGuardada(r)
          if (!vigente) {
            v.cerrar()
            return
          }
          mostrarVista(v)
        }
      } catch (e) {
        if (vigente) setError(e.message || 'No se pudo recuperar la generación.')
      } finally {
        if (vigente) setRecuperando(false)
      }
    })()
    return () => {
      vigente = false
    }
  }, [servicio, campania.id, operacionId, revision, pendiente])
  const valido = (v) =>
    Number.isSafeInteger(Number(v)) && Number(v) > 0 && Number(v) <= 100000
  const cantidad = resultado?.cantidadTickets ?? Number(personas) * Number(tamanio)
  const uno = valido(personas),
    dos = valido(tamanio) && (Boolean(resultado) || Number(tamanio) % 3 === 0),
    lista = uno && dos && valido(cantidad) && campania.estado === 'ACTIVA'
  const validacion = resultado
    ? ''
    : valido(tamanio) && Number(tamanio) % 3 !== 0
      ? 'Los tickets por persona deben ser múltiplos de 3: 3, 6, 9, 12…'
      : uno && dos && !valido(cantidad)
        ? 'El total no puede superar los 100.000 tickets por generación.'
        : ''
  const esperandoRecibo = Boolean(operacionId) && !resultado
  const bloqueado =
    pendiente || ocupado || recuperando || esperandoRecibo || cuenta !== null
  const puedeVer =
    (Boolean(resultado) || lista) && !bloqueado && !(intento && !resultado)
  const puedeImprimir =
    Boolean(vista && (resultado || borrador)) && !actualizar && !bloqueado
  const historico = resultado && resultado.formatoImpresion !== 'TSC_30X20_3'
  function invalidar() {
    cerrarVista()
    setVista(null)
    setBorrador(null)
    setActualizar(false)
    setError('')
    setSalida('')
    if (!intento && !resultado) operacion.current = crypto.randomUUID()
  }
  async function previsualizar(e) {
    e.preventDefault()
    if (!puedeVer || bloqueo.current) return
    if (historico) {
      await imprimir()
      return
    }
    bloqueo.current = true
    setOcupado('vista')
    setError('')
    setSalida('')
    try {
      if (resultado) {
        const v = await leerVistaGuardada(resultado)
        if (!montado.current) {
          v.cerrar()
          return
        }
        mostrarVista(v)
      } else {
        const solicitud = {
          operacionId: operacion.current,
          campaniaId: campania.id,
          cantidadTickets: cantidad,
          tamanioLote: Number(tamanio)
        }
        const p = await servicio.previsualizarGeneracion(solicitud, geometria)
        if (!montado.current) {
          p.vista?.cerrar()
          return
        }
        mostrarVista(p.vista)
        setBorrador(p)
      }
      setActualizar(false)
    } catch (e) {
      if (montado.current && e.name !== 'SolicitudObsoleta')
        setError(e.message || 'No se pudo preparar la vista previa.')
    } finally {
      bloqueo.current = false
      if (montado.current) setOcupado(false)
    }
  }
  async function imprimir() {
    if ((!puedeImprimir && !historico) || bloqueado || bloqueo.current) return
    bloqueo.current = true
    setOcupado('impresion')
    setError('')
    setSalida('')
    let destino
    const solicitud = intento ?? {
      operacionId: borrador.operacionId,
      campaniaId: campania.id,
      cantidadTickets: borrador.cantidadTickets,
      tamanioLote: borrador.tamanioLote
    }
    try {
      // Preparar el destino solo al confirmar, nunca al previsualizar.
      destino = servicio.abrirImpresion({
        ...geometria,
        modo: 'pdf',
        imprimirAlAbrir: true,
        enPagina: !historico
      })
      if (!destino || typeof destino.cerrar !== 'function')
        throw new Error('No se pudo preparar la impresión. Reintenta.')
      destinos.current.add(destino)
      setIntento(solicitud)
      const r = resultado ?? (await servicio.confirmarGeneracion(solicitud))
      if (!montado.current) {
        cerrarDestino(destino)
        return
      }
      setResultado(r)
      const respuesta = await servicio.imprimirGeneracion(
        solicitud.operacionId,
        destino
      )
      if (!montado.current) return
      if (!respuesta?.dialogoAbierto && !respuesta?.dialogoCerrado)
        throw new Error(
          'No se pudo confirmar la salida. Reintenta con los mismos tickets.'
        )
      setConfirmandoSalida(true)
      // La salida terminó; su limpieza ya no depende del reinicio del formulario.
      destinos.current.delete(destino)
    } catch (e) {
      cerrarDestino(destino)
      if (!montado.current || e.name === 'SolicitudObsoleta') return
      if (/vista previa cambió/i.test(e.message)) {
        setIntento(null)
        setActualizar(true)
      }
      setError(
        e.message ||
          'No se pudo confirmar la impresión. Reintenta con la misma operación.'
      )
    } finally {
      bloqueo.current = false
      if (montado.current) setOcupado(false)
    }
  }
  async function resolverSalida(impresa) {
    if (!resultado || bloqueado || bloqueo.current) return
    if (!impresa && resultado.estadoImpresion !== 'PENDIENTE') {
      nueva()
      return
    }
    bloqueo.current = true
    setOcupado(impresa ? 'confirmacion' : 'cancelacion')
    setError('')
    try {
      const r = await servicio.resolverImpresion(resultado.operacionId, impresa)
      if (!montado.current) return
      if (!impresa) {
        nueva()
        return
      }
      setResultado(r)
      setConfirmandoSalida(false)
      setSalida('Lote de tickets guardados e impresos.')
      setCuenta(3)
    } catch (e) {
      if (montado.current && e.name !== 'SolicitudObsoleta')
        setError(e.message || 'No se pudo registrar tu respuesta. Reintenta.')
    } finally {
      bloqueo.current = false
      if (montado.current) setOcupado(false)
    }
  }
  function nueva() {
    invalidar()
    operacion.current = crypto.randomUUID()
    setIntento(null)
    setResultado(null)
    setPersonas('0')
    setTamanio('0')
    setCuenta(null)
    setConfirmandoSalida(false)
    for (const d of destinos.current) cerrarDestino(d)
    onNuevaGeneracion?.()
  }
  const deshabilitado = bloqueado || Boolean(intento) || Boolean(resultado)
  return (
    <form
      className={`campaign-generation content-ready ${ocupado === 'impresion' ? 'is-printing' : ''}`}
      onSubmit={previsualizar}
      noValidate
      aria-busy={Boolean(ocupado || recuperando)}
    >
      <h2 className="campaign-generation-title">
        Generación e impresión de lotes de tickets
      </h2>
      <div className="campaign-generation-controls">
        <div className={`campaign-step ${uno ? 'is-complete' : ''}`}>
          <span
            className="campaign-step-number"
            aria-label={`Paso 1: ${uno ? 'completo' : 'pendiente'}`}
          >
            1
          </span>
          <label>
            Cantidad de personas
            <Numero
              label="Cantidad de personas"
              valor={personas}
              cambiar={(v) => {
                invalidar()
                setPersonas(v)
              }}
              disabled={deshabilitado}
            />
          </label>
        </div>
        <div className={`campaign-step ${dos ? 'is-complete' : ''}`}>
          <span
            className="campaign-step-number"
            aria-label={`Paso 2: ${dos ? 'completo' : 'pendiente'}`}
          >
            2
          </span>
          <label>
            Tickets por persona
            <Numero
              label="Tickets por persona"
              valor={tamanio}
              step={resultado ? 1 : 3}
              max={resultado ? 100000 : 99999}
              invalid={Boolean(validacion)}
              describedBy={validacion || resultado ? ayudaId : undefined}
              cambiar={(v) => {
                invalidar()
                setTamanio(v)
              }}
              disabled={deshabilitado}
            />
            <span className="campaign-generation-details">
              <span>
                Total de tickets:{' '}
                <strong>
                  {Number.isSafeInteger(cantidad) && cantidad >= 0
                    ? cantidad.toLocaleString('es-PE')
                    : '—'}
                </strong>
              </span>
              {(validacion || resultado) && (
                <small id={ayudaId} className={validacion ? 'is-invalid' : undefined}>
                  {validacion || 'Cada lote conserva sus tickets originales.'}
                </small>
              )}
            </span>
          </label>
        </div>
        <div
          className={`campaign-step campaign-print-step ${vista ? 'is-complete' : ''}`}
        >
          <span
            className="campaign-step-number"
            aria-label={`Paso 3: ${vista ? 'completo' : 'pendiente'}`}
          >
            3
          </span>
          {(lista || resultado) && (
            <div className="campaign-print-reveal">
              <button type="submit" disabled={!puedeVer}>
                {ocupado === 'vista'
                  ? 'Preparando…'
                  : historico
                    ? 'Reimprimir QR/A4'
                    : vista
                      ? 'Actualizar vista previa'
                      : 'Ver vista previa'}
              </button>
            </div>
          )}
        </div>
      </div>
      <section className="campaign-ticket-preview" aria-label="Vista previa de tickets">
        <h3>Vista previa</h3>
        <div className="campaign-preview-frame">
          {vista ? (
            <iframe
              title="Vista previa PDF de tickets"
              src={`${vista.url}#toolbar=0&navpanes=0&view=FitH`}
            />
          ) : (
            <p className="campaign-preview-placeholder">
              Acá aparecerá la vista previa
            </p>
          )}
        </div>
        {actualizar && (
          <p>Actualiza la vista previa para revisar los códigos disponibles.</p>
        )}
      </section>
      <div className="campaign-generation-completion">
        {cuenta !== null && (
          <div
            className="campaign-generation-success"
            role="status"
            aria-live="polite"
            aria-atomic="true"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="30"
              height="30"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="10" />
              <path d="M12 16v-4" />
              <path d="M12 8h.01" />
            </svg>
            <p>
              {salida}
              <br />
              Restableciendo valores en {cuenta}
            </p>
          </div>
        )}
        <div
          className={`campaign-step campaign-confirm-step ${cuenta !== null ? 'is-complete' : ''}`}
        >
          <span
            className="campaign-step-number"
            aria-label={`Paso 4: ${cuenta !== null ? 'completo' : 'pendiente'}`}
          >
            4
          </span>
          {vista && !confirmandoSalida && (
            <div className="campaign-preview-actions">
              <button type="button" disabled={!puedeImprimir} onClick={imprimir}>
                {ocupado === 'impresion'
                  ? 'Preparando…'
                  : cuenta !== null
                    ? 'Imprimir y guardar'
                    : resultado
                      ? 'Imprimir mismo recibo'
                      : intento
                        ? 'Reintentar confirmación'
                        : 'Imprimir y guardar'}
              </button>
              <button
                type="button"
                disabled={bloqueado || Boolean(intento && !resultado)}
                onClick={() =>
                  resultado?.estadoImpresion === 'PENDIENTE'
                    ? resolverSalida(false)
                    : nueva()
                }
              >
                Descartar generación
              </button>
            </div>
          )}
          {confirmandoSalida && cuenta === null && (
            <section
              className="campaign-print-confirmation"
              aria-label="Confirmar impresión"
            >
              <p>¿Se imprimieron los tickets?</p>
              <div className="campaign-preview-actions">
                <button
                  type="button"
                  disabled={bloqueado}
                  onClick={() => resolverSalida(true)}
                >
                  {ocupado === 'confirmacion' ? 'Guardando…' : 'Sí, se imprimieron'}
                </button>
                <button
                  type="button"
                  disabled={bloqueado}
                  onClick={() => resolverSalida(false)}
                >
                  {ocupado === 'cancelacion' ? 'Cancelando…' : 'No, cancelar'}
                </button>
              </div>
            </section>
          )}
        </div>
      </div>
      {campania.estado !== 'ACTIVA' && (
        <p role="status">
          Esta campaña está cerrada. No se pueden generar tickets nuevos; puedes
          reimprimir un recibo existente.
        </p>
      )}
      {recuperando && <p role="status">Recuperando generación…</p>}
      {esperandoRecibo && !recuperando && (
        <button
          type="button"
          disabled={pendiente}
          onClick={() => setRevision((r) => r + 1)}
        >
          Reintentar recuperación
        </button>
      )}
      {error && (
        <p className="campaign-generation-error" role="alert">
          {error}
        </p>
      )}
      {intento && !resultado && error && (
        <p>
          Confirmación pendiente. Reintenta con la misma operación.{' '}
          <a
            href={`/cosecha/generar?campania=${encodeURIComponent(campania.id)}&operacion=${encodeURIComponent(intento.operacionId)}`}
          >
            Consultar operación
          </a>
        </p>
      )}
    </form>
  )
}

function Numero({
  label,
  valor,
  cambiar,
  disabled,
  step = 1,
  max = 100000,
  invalid = false,
  describedBy
}) {
  const ref = useRef(null)
  return (
    <span className="campaign-number">
      <input
        ref={ref}
        aria-label={label}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        type="number"
        min="0"
        max={max}
        step={step}
        value={valor}
        disabled={disabled}
        onChange={(e) => cambiar(e.target.value)}
      />
      <span className="campaign-number-arrows">
        {[1, -1].map((n) => (
          <button
            type="button"
            key={n}
            aria-label={`${n === 1 ? 'Aumentar' : 'Disminuir'} ${label.toLocaleLowerCase('es')}`}
            disabled={disabled}
            onClick={() => {
              ref.current[n === 1 ? 'stepUp' : 'stepDown']()
              cambiar(ref.current.value)
            }}
          >
            <svg viewBox="0 0 16 8" aria-hidden="true">
              <path d={n === 1 ? 'M3 6 8 1l5 5' : 'm3 1 5 5 5-5'} />
            </svg>
          </button>
        ))}
      </span>
    </span>
  )
}
