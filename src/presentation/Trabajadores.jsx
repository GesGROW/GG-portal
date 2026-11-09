import { Select } from './Select.jsx'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useSearchParams } from 'react-router'
import { Aviso, Carga, useCarga, useMutacion } from './GestionUi.jsx'
import { DataTable, EmptyState, Icon, StatusBadge } from './Ui.jsx'
import { HomeIcon } from './HomeAssets.jsx'
import { SummaryMetrics } from './SummaryMetrics.jsx'
import './workers.css'

const funciones = {
  COSECHADOR: 'Cosechador',
  JABERO: 'Jabero',
  SUPERVISORA: 'Supervisor'
}
const nombre = (t) =>
  [t.nombres, t.apellidos].filter(Boolean).join(' ').trim() || 'Datos pendientes'
const fecha = (v) =>
  v
    ? new Intl.DateTimeFormat('es-PE', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'America/Lima'
      }).format(new Date(v))
    : 'Sin actividad'

function Filtro({ label, value, onChange, children }) {
  return (
    <label className="workers-filter">
      <span className="sr-only">{label}</span>
      <Select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">{label}</option>
        {children}
      </Select>
      <Icon name="chevron" />
    </label>
  )
}

export function Trabajadores({ servicio }) {
  const [params, setParams] = useSearchParams()
  const campania = params.get('campania') ?? ''
  const [texto, setTexto] = useState('')
  const [filtros, setFiltros] = useState({
    busqueda: '',
    funcion: '',
    estado: '',
    datos: '',
    offset: 0
  })
  const [editor, setEditor] = useState(null)
  const [opciones, setOpciones] = useState([])
  const consulta = useCarga(
    async () => ({
      ...(await servicio.listarCosecha({ ...filtros, campania })),
      actualizadoEn: new Date().toISOString()
    }),
    [servicio, filtros, campania]
  )
  useEffect(() => {
    if (consulta.datos) setOpciones(consulta.datos.campanias)
  }, [consulta.datos])
  useEffect(() => {
    const timer = setTimeout(
      () =>
        setFiltros((f) =>
          f.busqueda === texto.trim() ? f : { ...f, busqueda: texto.trim(), offset: 0 }
        ),
      250
    )
    return () => clearTimeout(timer)
  }, [texto])
  const filtrar = (clave, valor) =>
    setFiltros((f) => ({ ...f, [clave]: valor, offset: 0 }))
  if (!servicio)
    return <p role="alert">La gestión de trabajadores no está disponible.</p>
  return (
    <section className="workers-page" aria-label="Trabajadores">
      <form
        className="workers-toolbar"
        onSubmit={(e) => {
          e.preventDefault()
          filtrar('busqueda', texto.trim())
        }}
      >
        <div className="workers-campaign-row">
          <Filtro
            label="Campaña"
            value={campania}
            onChange={(v) => {
              filtrar('offset', 0)
              setParams(
                (p) => {
                  const next = new URLSearchParams(p)
                  v ? next.set('campania', v) : next.delete('campania')
                  return next
                },
                { replace: true }
              )
            }}
          >
            {opciones.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
                {c.estado === 'CERRADA' ? ' · Cerrada' : ''}
              </option>
            ))}
          </Filtro>
          <div className="harvest-record-updated workers-updated">
            {consulta.datos && (
              <p>
                Última actualización:{' '}
                <time dateTime={consulta.datos.actualizadoEn}>
                  {fecha(consulta.datos.actualizadoEn)}
                </time>
              </p>
            )}
            <button
              type="button"
              className="quiet icon-button"
              aria-label="Actualizar trabajadores"
              title="Actualizar trabajadores"
              disabled={consulta.cargando}
              onClick={consulta.refrescar}
            >
              <HomeIcon name="refresh" />
            </button>
          </div>
        </div>
        <label className="workers-search">
          <span className="sr-only">Buscar por nombre o DNI</span>
          <Icon name="search" />
          <input
            type="search"
            placeholder="Buscar por nombre o DNI"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
          />
        </label>
        <div className="workers-filter-row">
          <Filtro
            label="Función"
            value={filtros.funcion}
            onChange={(v) => filtrar('funcion', v)}
          >
            {Object.entries(funciones).map(([v, n]) => (
              <option key={v} value={v}>
                {n}
              </option>
            ))}
          </Filtro>
          <Filtro
            label="Estado"
            value={filtros.estado}
            onChange={(v) => filtrar('estado', v)}
          >
            <option value="ACTIVO">Activo</option>
            <option value="INACTIVO">Inactivo</option>
          </Filtro>
        </div>
      </form>
      <div className="workers-results" aria-busy={consulta.cargando || undefined}>
        <Carga consulta={consulta}>
          {(datos) => (
            <>
              <SummaryMetrics
                className="workers-summary"
                label="Resumen de la selección"
                items={[
                  {
                    key: 'activos',
                    icon: 'user-round-check',
                    label: 'Trabajadores activos',
                    value: datos.resumen.activos
                  },
                  {
                    key: 'cosechadores',
                    icon: 'package',
                    label: 'Cosechadores',
                    value: datos.resumen.cosechadores
                  },
                  {
                    key: 'pendientes',
                    icon: 'grid-2x2-x',
                    label: 'Datos pendientes',
                    value: datos.resumen.pendientes,
                    pressed: filtros.datos === 'PENDIENTES',
                    onClick: () =>
                      filtrar(
                        'datos',
                        filtros.datos === 'PENDIENTES' ? '' : 'PENDIENTES'
                      )
                  }
                ]}
              />
              <button
                type="button"
                className="workers-primary workers-register"
                onClick={() => setEditor({ nuevo: true })}
              >
                <Icon name="people" />
                Registrar trabajador
              </button>
              {datos.trabajadores.length ? (
                <DataTable
                  label="Listado de trabajadores"
                  tableLabel="Trabajadores de Cosecha"
                  className="workers-table-scroll"
                  tableClassName="workers-table"
                  pagination={{
                    label: 'Paginación de trabajadores',
                    total: datos.total,
                    offset: filtros.offset,
                    onPageChange: (page) =>
                      setFiltros((f) => ({ ...f, offset: (page - 1) * 50 }))
                  }}
                  onRowActivate={(t) => setEditor(t.trabajador)}
                  rowLabel={(t) => `Abrir trabajador ${nombre(t)}, DNI ${t.dni}`}
                  data={datos.trabajadores.map((t) => {
                    const relaciones = t.participaciones.filter(
                      (r) => r.activo && (!campania || r.campaniaId === campania)
                    )
                    return {
                      ...t,
                      trabajador: t,
                      nombresCampania: [...new Set(relaciones.map((r) => r.campania))],
                      roles: [
                        ...new Set(relaciones.map((r) => funciones[r.rol] ?? r.rol))
                      ]
                    }
                  })}
                  columns={[
                    {
                      key: 'dni',
                      header: 'DNI',
                      className: 'identifier',
                      headerClassName: ''
                    },
                    {
                      key: 'nombre',
                      header: 'Nombre',
                      render: (t) => (
                        <span
                          className={`workers-person${nombre(t) === 'Datos pendientes' ? ' workers-pending-name' : ''}`}
                        >
                          {nombre(t)}
                        </span>
                      )
                    },
                    {
                      key: 'roles',
                      header: 'Función',
                      render: (t) => t.roles.join(' · ') || 'Sin asignar'
                    },
                    {
                      key: 'campania',
                      header: 'Campaña',
                      cellProps: (t) => ({ title: t.nombresCampania.join(', ') }),
                      render: (t) =>
                        t.nombresCampania.length > 1
                          ? `${t.nombresCampania.length} campañas`
                          : t.nombresCampania[0] || 'Sin campaña'
                    },
                    {
                      key: 'activo',
                      header: 'Estado',
                      className: 'workers-status',
                      render: (t) => (
                        <StatusBadge tone={t.activo ? 'success' : 'error'} indicator>
                          {t.activo ? 'Activo' : 'Inactivo'}
                        </StatusBadge>
                      )
                    },
                    {
                      key: 'ultimaActividad',
                      header: 'Última actividad',
                      className: 'workers-activity',
                      render: (t) => (
                        <time
                          dateTime={t.ultimaActividad || undefined}
                          className={
                            !t.ultimaActividad ? 'workers-no-activity' : undefined
                          }
                        >
                          {fecha(t.ultimaActividad)}
                        </time>
                      )
                    }
                  ]}
                />
              ) : (
                <EmptyState>
                  No hay trabajadores que coincidan con los filtros.
                </EmptyState>
              )}
            </>
          )}
        </Carga>
      </div>
      {editor && (
        <EditorTrabajador
          key={editor.id ?? 'nuevo'}
          trabajador={editor}
          campanias={opciones}
          servicio={servicio}
          onClose={() => setEditor(null)}
          onSaved={consulta.refrescar}
          actividadCampania={opciones.find((c) => c.id === campania)?.nombre}
        />
      )}
    </section>
  )
}

function EditorTrabajador({
  trabajador,
  campanias,
  servicio,
  onClose,
  onSaved,
  actividadCampania
}) {
  const dialog = useRef(null)
  const [persona, setPersona] = useState(trabajador)
  const [datos, setDatos] = useState({
    dni: trabajador.dni ?? '',
    nombres: trabajador.nombres ?? '',
    apellidos: trabajador.apellidos ?? ''
  })
  const [relaciones, setRelaciones] = useState(trabajador.participaciones ?? [])
  const [campaniaId, setCampaniaId] = useState('')
  const [funcion, setFuncion] = useState('COSECHADOR')
  const [mensaje, setMensaje] = useState('')
  const mutacion = useMutacion()
  useEffect(() => {
    const anterior = document.activeElement
    const el = dialog.current
    if (el.showModal) el.showModal()
    else {
      el.setAttribute('open', '')
      el.querySelector('button')?.focus()
    }
    return () => {
      el.close?.()
      anterior?.focus()
    }
  }, [])
  async function ejecutar(accion, aviso) {
    setMensaje('')
    if (await mutacion.ejecutar(accion)) {
      setMensaje(aviso)
      onSaved()
    }
  }
  function guardar(e) {
    e.preventDefault()
    void ejecutar(async () => {
      const actualizada = persona.id
        ? await servicio.editar(persona.id, datos)
        : await servicio.crear(datos)
      setPersona((p) => ({ ...p, ...actualizada, nuevo: false }))
    }, 'Datos guardados. Puedes administrar sus campañas.')
  }
  function cambiarParticipacion(r, retirar) {
    return ejecutar(
      async () => {
        const resultado =
          r.rol === 'JABERO'
            ? await servicio[retirar ? 'retirarJabero' : 'habilitarJaberoDelDia'](
                persona.id,
                r.campaniaId
              )
            : await servicio[retirar ? 'retirarRol' : 'asignarRol'](
                persona.id,
                r.campaniaId,
                r.rol
              )
        setRelaciones(resultado)
      },
      retirar
        ? 'Participación retirada. El historial se conserva.'
        : 'Participación actualizada.'
    )
  }
  return createPortal(
    <dialog
      ref={dialog}
      className="worker-drawer"
      aria-labelledby="worker-drawer-title"
      onCancel={(e) => {
        e.preventDefault()
        if (!mutacion.ocupado) onClose()
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !mutacion.ocupado) {
          const box = e.currentTarget.getBoundingClientRect()
          if (
            e.clientX < box.left ||
            e.clientX > box.right ||
            e.clientY < box.top ||
            e.clientY > box.bottom
          )
            onClose()
        }
      }}
    >
      <header>
        <div>
          <span className="eyebrow">Cosecha · Trabajadores</span>
          <h2 id="worker-drawer-title">
            {persona.nuevo ? 'Registrar trabajador' : nombre(persona)}
          </h2>
          {persona.id && <p>DNI {persona.dni}</p>}
        </div>
        <button
          className="quiet"
          aria-label="Cerrar trabajador"
          onClick={onClose}
          disabled={mutacion.ocupado}
        >
          <Icon name="close" />
        </button>
      </header>
      <Aviso error={mutacion.error} mensaje={mensaje} />
      <form onSubmit={guardar} className="worker-personal">
        <h3>Datos personales</h3>
        <fieldset disabled={mutacion.ocupado}>
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
              value={datos.nombres}
              onChange={(e) => setDatos({ ...datos, nombres: e.target.value })}
            />
          </label>
          <label>
            Apellidos
            <input
              required
              value={datos.apellidos}
              onChange={(e) => setDatos({ ...datos, apellidos: e.target.value })}
            />
          </label>
          <button className="workers-primary" type="submit">
            {mutacion.ocupado ? 'Guardando…' : 'Guardar datos'}
          </button>
        </fieldset>
      </form>
      {persona.id ? (
        <>
          <section className="worker-status">
            <h3>Estado</h3>
            <StatusBadge tone={persona.activo ? 'success' : 'neutral'}>
              {persona.activo ? 'Activo' : 'Inactivo'}
            </StatusBadge>
            <button
              disabled={mutacion.ocupado}
              onClick={() =>
                ejecutar(
                  async () => {
                    const actualizada = await servicio[
                      persona.activo ? 'desactivar' : 'activar'
                    ](persona.id)
                    setPersona((p) => ({ ...p, ...actualizada }))
                  },
                  persona.activo
                    ? 'Trabajador desactivado. El historial se conserva.'
                    : 'Trabajador activado.'
                )
              }
            >
              {persona.activo ? 'Desactivar trabajador' : 'Activar trabajador'}
            </button>
          </section>
          <section className="worker-campaigns">
            <h3>Funciones y campañas</h3>
            <p>
              La función se define por campaña. La habilitación de jabero corresponde al
              día de hoy.
            </p>
            {relaciones.length ? (
              <ul>
                {relaciones.map((r) => (
                  <li key={r.id}>
                    <div>
                      <strong>
                        {campanias.find((c) => c.id === r.campaniaId)?.nombre ??
                          r.campania}
                      </strong>
                      <span>
                        {funciones[r.rol] ?? r.rol} ·{' '}
                        {r.activo ? 'Asignado' : 'Retirado'}
                        {r.rol === 'JABERO' && r.fechaJabero
                          ? ` · Jornada ${r.fechaJabero}`
                          : ''}
                      </span>
                    </div>
                    {r.activo && (
                      <button
                        disabled={mutacion.ocupado}
                        onClick={() => cambiarParticipacion(r, true)}
                        aria-label={`Retirar ${funciones[r.rol]} de ${r.campania}`}
                      >
                        Retirar
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p>Sin campañas asignadas.</p>
            )}
            <form
              onSubmit={(e) => {
                e.preventDefault()
                void cambiarParticipacion({ campaniaId, rol: funcion }, false)
              }}
            >
              <fieldset disabled={mutacion.ocupado || !persona.activo}>
                <label>
                  Campaña de participación
                  <Select
                    required
                    value={campaniaId}
                    onChange={(e) => setCampaniaId(e.target.value)}
                  >
                    <option value="">Seleccionar campaña</option>
                    {campanias
                      .filter((c) => c.estado === 'ACTIVA')
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.nombre}
                        </option>
                      ))}
                  </Select>
                </label>
                <label>
                  Función en la campaña
                  <Select value={funcion} onChange={(e) => setFuncion(e.target.value)}>
                    {Object.entries(funciones).map(([v, n]) => (
                      <option key={v} value={v}>
                        {n}
                      </option>
                    ))}
                  </Select>
                </label>
                <button type="submit" className="workers-primary">
                  {funcion === 'JABERO' ? 'Habilitar jabero hoy' : 'Asignar a campaña'}
                </button>
              </fieldset>
            </form>
          </section>
          <section className="worker-activity">
            <h3>Actividad en campo</h3>
            {actividadCampania && <p className="muted">{actividadCampania}</p>}
            <dl>
              <div>
                <dt>Primera actividad</dt>
                <dd>{fecha(trabajador.primeraActividad)}</dd>
              </div>
              <div>
                <dt>Última actividad</dt>
                <dd>{fecha(trabajador.ultimaActividad)}</dd>
              </div>
            </dl>
          </section>
        </>
      ) : (
        <p className="muted">
          Guarda los datos personales para asignar funciones y campañas.
        </p>
      )}
    </dialog>,
    document.body
  )
}
