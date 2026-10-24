import { Select } from './Select.jsx'
import { useEffect, useId, useRef, useState } from 'react'
import { COLORES_CULTIVO, hoyLima } from '../application/cultivosCosecha.js'
import { useCarga } from './GestionUi.jsx'
import { OwnerIcon } from './OwnerAssets.jsx'
import { HomeIcon } from './HomeAssets.jsx'
import { CultivosCosechaSkeleton } from './CultivosCosechaSkeleton.jsx'
import './cultivos-cosecha.css'

const vacio = { propios: [], disponibles: [], solicitudes: [] }
const nuevosLotes = () => [{ nombre: '', variedades: [] }]
const nuevaCampania = () => ({ nombre: '', fechaInicio: hoyLima(), fechaFin: '' })
const nombres = (items) =>
  (items ?? [])
    .map((v) => (typeof v === 'string' ? v : v.nombre))
    .filter(Boolean)
    .join(', ') || 'Sin registrar'
const estado = (valor) =>
  ({ PENDING: 'PENDIENTE', APPROVED: 'APROBADA', REJECTED: 'RECHAZADA' })[
    String(valor ?? '').toUpperCase()
  ] ?? String(valor ?? '').toUpperCase()
const repetidos = (items) =>
  new Set(items.map((s) => s.toLocaleLowerCase('es'))).size !== items.length
function tinta(color) {
  const rgb = /^#[\da-f]{6}$/i.test(color ?? '')
    ? color
        .slice(1)
        .match(/../g)
        .map((v) => parseInt(v, 16) / 255)
    : [1, 1, 1]
  const [r, g, b] = rgb.map((v) =>
    v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
  )
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.179 ? '#022f2a' : '#ffffff'
}
function Lista({ items }) {
  return items?.length ? (
    <ul>
      {items.map((item, i) => (
        <li key={item.id ?? i}>{typeof item === 'string' ? item : item.nombre}</li>
      ))}
    </ul>
  ) : (
    <p>Sin registrar</p>
  )
}

function Globo() {
  return (
    <svg
      className="cc-globo"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#022F2A"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
      <path d="M2 12h20" />
    </svg>
  )
}

function Plus() {
  return (
    <svg
      className="cc-plus"
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#022F2A"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M5 12h14" />
      <path d="M12 5v14" />
    </svg>
  )
}

function Calendario() {
  return (
    <svg
      className="cc-date-icon"
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#022F2A"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M8 2v3" />
      <path d="M16 2v3" />
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M3 9h18" />
      <path d="M8 13h.01" />
      <path d="M12 13h.01" />
      <path d="M16 13h.01" />
      <path d="M8 17h.01" />
      <path d="M12 17h.01" />
      <path d="M16 17h.01" />
    </svg>
  )
}

function FechasCampania({ datos, onChange, prefijo }) {
  const hoy = hoyLima()
  return (
    <div className="cc-campania-fields">
      <label htmlFor={`${prefijo}-nombre`}>Nombre de la campaña</label>
      <input
        id={`${prefijo}-nombre`}
        maxLength={100}
        required
        value={datos.nombre}
        onChange={(e) => onChange({ ...datos, nombre: e.target.value })}
      />
      <div className="cc-fechas">
        <label>
          Fecha de inicio
          <span className="cc-date-control">
            <input
              type="date"
              required
              min={hoy}
              value={datos.fechaInicio}
              onChange={(e) => onChange({ ...datos, fechaInicio: e.target.value })}
            />
            <Calendario />
          </span>
        </label>
        <label>
          Fecha de fin
          <span className="cc-date-control">
            <input
              type="date"
              required
              min={datos.fechaInicio > hoy ? datos.fechaInicio : hoy}
              value={datos.fechaFin}
              onChange={(e) => onChange({ ...datos, fechaFin: e.target.value })}
            />
            <Calendario />
          </span>
        </label>
      </div>
    </div>
  )
}

/** UI sin routing. El servicio aplica permisos y confirma cada escritura. */
export function CultivosCosecha({ servicio, pendiente = false, onCreada }) {
  const consulta = useCarga(
    () => (pendiente ? null : servicio.catalogoCultivos()),
    [servicio, pendiente]
  )
  const [ultimoCatalogo, setUltimoCatalogo] = useState(vacio)
  useEffect(() => {
    if (consulta.datos) setUltimoCatalogo(consulta.datos)
  }, [consulta.datos])
  const catalogo = consulta.datos ?? ultimoCatalogo
  const propios = catalogo.propios ?? []
  const [tabElegido, setTab] = useState(null)
  const tab = tabElegido ?? (propios.length ? 'campania' : 'cultivo')
  const [paso, setPaso] = useState(1)
  const [nombre, setNombre] = useState('')
  const [color, setColor] = useState(COLORES_CULTIVO[0])
  const [variedades, setVariedades] = useState([''])
  const [lotes, setLotes] = useState(nuevosLotes)
  const [campania, setCampania] = useState(nuevaCampania)
  const [cultivoId, setCultivoId] = useState('')
  const [error, setError] = useState('')
  const [errorAccion, setErrorAccion] = useState('')
  const [mensaje, setMensaje] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [creada, setCreada] = useState(false)
  const [enviadas, setEnviadas] = useState([])
  const [resueltas, setResueltas] = useState([])
  const bloqueo = useRef(false)
  const montado = useRef(true)
  useEffect(() => {
    montado.current = true
    return () => {
      montado.current = false
    }
  }, [])
  const aviso = useRef(null)
  const id = useId()
  const cargando = pendiente || Boolean(consulta.cargando)
  const ocupado = cargando || guardando
  const deshabilitado = ocupado || creada || Boolean(consulta.error)
  const elegido =
    propios.find((c) => String(c.id) === cultivoId) ??
    (propios.length === 1 ? propios[0] : null)
  const opciones = variedades
    .map((v, indice) => ({ nombre: v.trim(), indice }))
    .filter((v) => v.nombre)
  const solicitudes = (catalogo.solicitudes ?? []).filter(
    (s) => estado(s.estado) === 'PENDIENTE' && !resueltas.includes(s.id)
  )
  useEffect(() => {
    if (error) aviso.current?.focus()
  }, [error])

  function cambiarTab(valor) {
    setTab(valor)
    setError('')
    setMensaje('')
  }
  function cambiarVariedad(indice, valor) {
    const completas = variedades
      .map((v, i) => ({ valor: i === indice ? valor : v, anterior: i }))
      .filter((v) => v.valor.trim())
    setVariedades([...completas.map((v) => v.valor), ''])
    if (!valor.trim() && variedades[indice].trim()) {
      const indices = new Map(completas.map((v, i) => [v.anterior, i]))
      setLotes((anteriores) => anteriores.map((lote) => ({
        ...lote,
        variedades: lote.variedades.filter((i) => indices.has(i)).map((i) => indices.get(i))
      })))
    }
  }
  function cambiarLote(indice, datos) {
    setLotes((anteriores) => {
      const siguientes = anteriores.map((l, i) =>
        i === indice ? { ...l, ...datos } : l
      )
      const borrado =
        'nombre' in datos && !datos.nombre.trim() && anteriores[indice].nombre.trim()
      const restantes = siguientes.filter((l, i) => !borrado || i !== indice)
      return [
        ...restantes.filter((l) => l.nombre.trim()),
        restantes.find((l) => !l.nombre.trim()) ?? { nombre: '', variedades: [] }
      ]
    })
  }
  function validarCultivo() {
    if (!nombre.trim()) return 'Ingresa el nombre del cultivo.'
    if (!opciones.length) return 'Agrega al menos una variedad.'
    if (repetidos(opciones.map((v) => v.nombre)))
      return 'Los nombres de las variedades no pueden repetirse.'
    return ''
  }
  function validarLotes() {
    const usados = lotes.filter((l) => l.nombre.trim() || l.variedades.length)
    if (!usados.length) return 'Agrega al menos un lote.'
    if (usados.some((l) => !l.nombre.trim()))
      return 'Ingresa el nombre de cada lote con variedades.'
    if (usados.some((l) => !opciones.some((v) => l.variedades.includes(v.indice))))
      return 'Selecciona al menos una variedad para cada lote.'
    if (repetidos(usados.map((l) => l.nombre.trim())))
      return 'Los nombres de los lotes no pueden repetirse.'
    return ''
  }
  function validarCampania() {
    if (!campania.nombre.trim()) return 'Ingresa el nombre de la campaña.'
    if (!campania.fechaInicio || campania.fechaInicio < hoyLima())
      return 'La fecha de inicio debe ser hoy o una fecha posterior en Lima.'
    if (!campania.fechaFin || campania.fechaFin < campania.fechaInicio)
      return 'La fecha de fin debe ser igual o posterior al inicio.'
    return ''
  }
  async function guardar(event) {
    event.preventDefault()
    if (deshabilitado || bloqueo.current) return
    let fallo = ''
    if (tab === 'cultivo') {
      fallo = validarCultivo() || (paso > 1 ? validarLotes() : '')
      if (!fallo && paso < 3) {
        setError('')
        setPaso(paso + 1)
        return
      }
    } else if (!elegido) fallo = 'Selecciona el cultivo para la campaña.'
    fallo ||= validarCampania()
    if (fallo) {
      setError(fallo)
      return
    }
    bloqueo.current = true
    setGuardando(true)
    setError('')
    let resultado
    try {
      const datosCampania = { ...campania, nombre: campania.nombre.trim() }
      resultado =
        tab === 'cultivo'
          ? await servicio.crearCultivo({
              nombre: nombre.trim(),
              color,
              variedades: opciones.map((v) => v.nombre),
              lotes: lotes
                .filter((l) => l.nombre.trim())
                .map((l) => ({
                  nombre: l.nombre.trim(),
                  variedades: opciones
                    .filter((v) => l.variedades.includes(v.indice))
                    .map((v) => v.nombre)
                })),
              campania: datosCampania
            })
          : await servicio.crearCampania(elegido.id, datosCampania)
      if (!montado.current) return
      setCreada(true)
      setMensaje('Campaña activada correctamente.')
    } catch (e) {
      setError(e.message || 'No se pudo activar la campaña. Inténtalo de nuevo.')
      return
    } finally {
      bloqueo.current = false
      setGuardando(false)
    }
    onCreada?.(resultado)
  }
  async function actuar(accion, confirmar, texto) {
    if (deshabilitado || bloqueo.current) return
    bloqueo.current = true
    setGuardando(true)
    setErrorAccion('')
    setMensaje('')
    try {
      await accion()
      if (!montado.current) return
      confirmar()
      setMensaje(texto)
      consulta.refrescar()
    } catch (e) {
      setErrorAccion(
        e.message || 'No se pudo completar la solicitud. Inténtalo de nuevo.'
      )
    } finally {
      bloqueo.current = false
      setGuardando(false)
    }
  }

  return (
    <div className={`cultivos-cosecha${cargando ? ' cc-is-loading' : ''}`} aria-busy={ocupado}>
      <div className="cc-tabs" role="tablist" aria-label="Crear en Cosecha">
        <button
          type="button"
          role="tab"
          id={`${id}-tab-campania`}
          aria-controls={`${id}-panel`}
          aria-selected={tab === 'campania'}
          disabled={deshabilitado || !propios.length}
          onClick={() => cambiarTab('campania')}
        >
          <Globo />
          <Plus />
          <span className="cc-sr-only">Nueva campaña</span>
        </button>
        <button
          type="button"
          role="tab"
          id={`${id}-tab-cultivo`}
          aria-controls={`${id}-panel`}
          aria-selected={tab === 'cultivo'}
          disabled={deshabilitado}
          onClick={() => cambiarTab('cultivo')}
        >
          <OwnerIcon name="avocado" />
          <Plus />
          <span className="cc-sr-only">Nuevo cultivo</span>
        </button>
      </div>
      {cargando && (
        <span className="cc-sr-only" role="status">Cargando información de cosecha…</span>
      )}
      {consulta.error && (
        <div className="cc-notice" role="alert">
          {consulta.error.message || 'No se pudieron cargar los cultivos.'}
          <button type="button" disabled={ocupado} onClick={consulta.refrescar}>
            Reintentar carga
          </button>
        </div>
      )}
      {mensaje && (
        <p className="cc-notice" role="status">
          {mensaje}
        </p>
      )}
      <div className="cc-panels">
        <section
          className="cc-panel cc-editor"
          id={`${id}-panel`}
          role="tabpanel"
          aria-labelledby={`${id}-tab-${tab}`}
        >
          {cargando && (
            <CultivosCosechaSkeleton tipo={tab === 'campania' || paso === 3 ? 'campania' : paso === 2 ? 'lotes' : 'cultivo'} />
          )}
          <div className="cc-editor-heading">
            <h2 className="cc-editor-title">
            {
              <span className="cc-title-icons">
                {tab === 'cultivo' ? <OwnerIcon name="avocado" /> : <Globo />}
                <Plus />
              </span>
            }
            {tab === 'cultivo'
              ? ['Agrega un cultivo', 'Agrega lotes', 'Crea una campaña'][paso - 1]
              : 'Crea una campaña'}
            </h2>
            {tab === 'cultivo' && paso > 1 && (
              <button
                type="button"
                className="cc-cancel"
                disabled={deshabilitado}
                onClick={() => {
                  setPaso(paso - 1)
                  setError('')
                }}
              >
                Cancelar
              </button>
            )}
          </div>
          {tab === 'cultivo' && (
            <ol className="cc-steps cc-sr-only" aria-label="Pasos del nuevo cultivo">
              {['Cultivo', 'Lotes', 'Campaña'].map((titulo, i) => (
                <li key={titulo} aria-current={paso === i + 1 ? 'step' : undefined}>
                  <span>{i + 1}</span>
                  {titulo}
                </li>
              ))}
            </ol>
          )}
          <form onSubmit={guardar} noValidate>
            <fieldset className="cc-form-fields" disabled={deshabilitado}>
              <legend className="cc-sr-only">
                {tab === 'campania'
                  ? 'Nueva campaña'
                  : `Paso ${paso}: ${['Cultivo', 'Lotes', 'Campaña'][paso - 1]}`}
              </legend>
              {tab === 'cultivo' && paso === 1 && (
                <>
                  <label htmlFor={`${id}-cultivo`}>Nombre del cultivo</label>
                  <input
                    id={`${id}-cultivo`}
                    required
                    maxLength={100}
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                  />
                  <h3 className="cc-varieties-label">Variedades</h3>
                  <div
                    className="cc-rows cc-variedades"
                    role="group"
                    aria-label="Variedades del cultivo"
                  >
                    {variedades.map((v, i) => (
                      <label className="cc-numbered-row" key={i}>
                        <span>Variedad {i + 1}:</span>
                        <input
                          aria-label={`Variedad ${i + 1}`}
                          maxLength={100}
                          value={v}
                          onChange={(e) => cambiarVariedad(i, e.target.value)}
                        />
                      </label>
                    ))}
                  </div>
                  <fieldset className="cc-colores">
                    <legend>Escoge un color</legend>
                    <div>
                      {COLORES_CULTIVO.map((c) => (
                        <label key={c} className="cc-color" style={{ '--cc-color': c }}>
                          <input
                            type="radio"
                            name={`${id}-color`}
                            value={c}
                            checked={color === c}
                            onChange={() => setColor(c)}
                            aria-label={`Color ${c}`}
                          />
                          <span aria-hidden="true" />
                        </label>
                      ))}
                    </div>
                  </fieldset>
                </>
              )}
              {tab === 'cultivo' && paso === 2 && (
                <>
                  <h3 className="cc-lots-label">Lotes</h3>
                  <div
                    className="cc-rows cc-lotes"
                    role="group"
                    aria-label="Lotes del cultivo"
                  >
                    {lotes.map((l, i) => (
                      <div className="cc-lote" key={i}>
                        <label htmlFor={`${id}-lote-${i}`}>Lote {i + 1}:</label>
                        <input
                          id={`${id}-lote-${i}`}
                          aria-label={`Lote ${i + 1}`}
                          maxLength={100}
                          value={l.nombre}
                          onChange={(e) => cambiarLote(i, { nombre: e.target.value })}
                        />
                        <div className="cc-lot-varieties">
                          <span className="cc-lot-varieties-label">Asigna una variedad:</span>
                        <details className="cc-multiselect">
                          <summary aria-label={`Variedades del lote ${i + 1}`}>
                            <span>
                              {l.variedades.length ? nombres(
                                opciones.filter((v) => l.variedades.includes(v.indice))
                              ) : 'Selecciona'}
                            </span>
                            <OwnerIcon name="chevron" />
                          </summary>
                          <fieldset>
                            <legend className="cc-sr-only">
                              Variedades del lote {i + 1}
                            </legend>
                            {opciones.map((v) => (
                              <label key={v.indice}>
                                <input
                                  type="checkbox"
                                  checked={l.variedades.includes(v.indice)}
                                  onChange={(e) =>
                                    cambiarLote(i, {
                                      variedades: e.target.checked
                                        ? [...l.variedades, v.indice]
                                        : l.variedades.filter((n) => n !== v.indice)
                                    })
                                  }
                                />
                                {v.nombre}
                              </label>
                            ))}
                          </fieldset>
                        </details>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
              {tab === 'campania' && (
                <>
                  {propios.length > 1 ? (
                    <label>
                      Cultivo
                      <Select
                        required
                        value={cultivoId}
                        onChange={(e) => setCultivoId(e.target.value)}
                      >
                        <option value="">Selecciona un cultivo</option>
                        {propios.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.nombre}
                          </option>
                        ))}
                      </Select>
                    </label>
                  ) : (
                    <span className="cc-sr-only">
                      {elegido?.nombre ?? 'Necesitas crear un cultivo primero.'}
                    </span>
                  )}
                </>
              )}
              {(tab === 'campania' || paso === 3) && (
                <>
                  {tab === 'cultivo' && (
                    <div className="cc-review cc-sr-only">
                      <strong>{nombre}</strong>
                      <span>
                        {opciones.length} variedades ·{' '}
                        {lotes.filter((l) => l.nombre.trim()).length} lotes
                      </span>
                    </div>
                  )}
                  <FechasCampania
                    datos={campania}
                    onChange={setCampania}
                    prefijo={id}
                  />
                </>
              )}
              {tab === 'campania' && elegido && (
                <div
                  className="cc-template"
                  style={{ backgroundColor: elegido.color }}
                >
                  <h3>{elegido.nombre}</h3>
                  <dl>
                    <dt>Variedades</dt>
                    <dd>{nombres(elegido.variedades)}</dd>
                    <dt>Lotes</dt>
                    <dd>{nombres(elegido.lotes)}</dd>
                  </dl>
                </div>
              )}
            </fieldset>
            {error && (
              <p className="cc-error" role="alert" tabIndex={-1} ref={aviso}>
                {error}
              </p>
            )}
            <div className="cc-actions">
              <button type="submit" className="cc-next" disabled={deshabilitado}>
                {guardando
                  ? 'Guardando…'
                  : creada
                    ? 'Campaña activada'
                    : tab === 'cultivo' && paso < 3
                      ? 'Siguiente'
                      : 'Activar campaña'}
              </button>
            </div>
          </form>
        </section>
        <section className="cc-panel cc-discovery" aria-labelledby={`${id}-unete`}>
          {cargando && <CultivosCosechaSkeleton tipo="discovery" />}
          <h2 className="cc-discovery-title" id={`${id}-unete`}>
            <span className="cc-title-icons" aria-hidden="true">
              <OwnerIcon name="avocado" />
              <svg
                className="cc-join-arrow"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M3 12h16m-6-6 6 6-6 6m8-12v12" />
              </svg>
            </span>
            Únete a una cosecha
          </h2>
          {errorAccion && (
            <p className="cc-error" role="alert">
              {errorAccion}
            </p>
          )}
          <div className="cc-discovery-scroll">
            {!consulta.cargando &&
              !pendiente &&
              !consulta.error &&
              !(catalogo.disponibles ?? []).length && (
                <div className="cc-empty" role="status">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="70"
                    height="70"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#829896"
                    strokeWidth="4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path vectorEffect="non-scaling-stroke" d="m16 3 5 5" />
                    <path vectorEffect="non-scaling-stroke" d="M2 12h20A10 10 0 1 1 12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 4-10" />
                    <path vectorEffect="non-scaling-stroke" d="m21 3-5 5" />
                  </svg>
                  <p>Aún no hay cosechas externas operativas</p>
                </div>
              )}
            <div className="cc-cards">
              {(catalogo.disponibles ?? []).map((c) => {
                const actual = (c.campanias ?? []).find(
                  (a) => estado(a.estado) === 'ACTIVA'
                )
                const solicitada =
                  estado(c.solicitudEstado) === 'PENDIENTE' || enviadas.includes(c.id)
                const aceptada = ['ACEPTADA', 'APROBADA'].includes(
                  estado(c.solicitudEstado)
                )
                const rechazada = estado(c.solicitudEstado) === 'RECHAZADA'
                return (
                  <article
                    className="cc-card"
                    key={c.id}
                    aria-label={`Cultivo ${c.nombre}`}
                    style={{ backgroundColor: c.color, color: tinta(c.color) }}
                  >
                    <h3>{c.nombre}</h3>
                    <div className="cc-card-columns">
                      <div>
                        <h4>Variedades</h4>
                        <Lista items={c.variedades} />
                      </div>
                      <div>
                        <h4>Lotes</h4>
                        <Lista items={c.lotes} />
                      </div>
                      <div>
                        <h4>Supervisores</h4>
                        <Lista items={c.supervisores} />
                      </div>
                    </div>
                    <p className="cc-current-campaign">
                      Campaña actual:{' '}
                      <strong>{actual?.nombre ?? 'Sin campaña activa'}</strong>
                    </p>
                    <button
                      type="button"
                      disabled={deshabilitado || solicitada || aceptada || rechazada}
                      onClick={() =>
                        actuar(
                          async () => {
                            const r = await servicio.solicitarUnion(c.id)
                            if (estado(r?.estado) === 'RECHAZADA')
                              throw new Error(
                                'La solicitud fue rechazada por un supervisor de este cultivo.'
                              )
                            return r
                          },
                          () => setEnviadas((prev) => [...prev, c.id]),
                          `Solicitud enviada para ${c.nombre}.`
                        )
                      }
                    >
                      {solicitada
                        ? 'Solicitud pendiente'
                        : aceptada
                          ? 'Solicitud aprobada'
                          : rechazada
                            ? 'Solicitud rechazada'
                            : 'Solicitar unirme'}
                    </button>
                  </article>
                )
              })}
            </div>
            {solicitudes.length > 0 && (
              <section className="cc-requests" aria-labelledby={`${id}-solicitudes`}>
                <h3 id={`${id}-solicitudes`}>Solicitudes pendientes</h3>
                {solicitudes.map((s) => (
                  <article
                    className="cc-request"
                    key={s.id}
                    aria-label={`Solicitud de ${s.nombre}`}
                  >
                    <h4>{s.nombre}</h4>
                    <p>{s.email}</p>
                    <p>{s.cultivoNombre}</p>
                    <div>
                      {[true, false].map((aceptar) => (
                        <button
                          type="button"
                          key={String(aceptar)}
                          className={aceptar ? 'cc-approve' : 'cc-reject'}
                          disabled={deshabilitado}
                          onClick={() =>
                            actuar(
                              () => servicio.resolverUnion(s.id, aceptar),
                              () => setResueltas((prev) => [...prev, s.id]),
                              aceptar ? 'Solicitud aprobada.' : 'Solicitud rechazada.'
                            )
                          }
                        >
                          {aceptar ? 'Aprobar' : 'Rechazar'}
                        </button>
                      ))}
                    </div>
                  </article>
                ))}
              </section>
            )}
          </div>
          <button
            type="button"
            className="cc-refresh"
            aria-label="Actualizar cultivos"
            title="Actualizar cultivos"
            disabled={ocupado}
            onClick={consulta.refrescar}
          >
            <HomeIcon name="refresh" />
          </button>
        </section>
      </div>
    </div>
  )
}

export default CultivosCosecha
