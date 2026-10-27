import { useEffect, useRef, useState } from 'react'
import { useCarga } from './GestionUi.jsx'
import { OwnerIcon } from './OwnerAssets.jsx'
import { Skeleton } from './Ui.jsx'
import './owner-modules.css'
import { Link } from 'react-router'

const TIPO_MODULO = 'application/x-gesgrow-module'

export function ModulosOwner({ servicio, modulos, onActualizar }) {
  const consulta = useCarga(
    () =>
      servicio
        ? servicio.consultar()
        : Promise.reject(new Error('El catálogo no está disponible en este momento.')),
    [servicio]
  )
  return (
    <section className="owner-modules" aria-labelledby="owner-modules-title">
      <h1 id="owner-modules-title">Módulos Adquiridos</h1>
      {consulta.cargando ? (
        <Skeleton text="Cargando módulos…" variant="cards" />
      ) : consulta.error ? (
        <div role="alert">
          <p>{consulta.error.message}</p>
          <button onClick={consulta.refrescar}>Reintentar</button>
        </div>
      ) : (
        <CatalogoOwner
          datos={consulta.datos}
          servicio={servicio}
          modulos={modulos}
          actualizar={async () => {
            consulta.refrescar()
            await onActualizar?.()
          }}
        />
      )}
    </section>
  )
}

function CatalogoOwner({ datos, servicio, modulos, actualizar }) {
  const [seleccionado, setSeleccionado] = useState(false)
  const [arrastrando, setArrastrando] = useState(false)
  const [confirmando, setConfirmando] = useState(false)
  const [intencion, setIntencion] = useState(null)
  const [error, setError] = useState(null)
  const [ocupado, setOcupado] = useState(false)
  const [recibo, setRecibo] = useState(null)
  const enviando = useRef(false)
  const contrato =
    datos.estado.modulos.some((m) => m.modulo_codigo === 'HARVEST' && m.habilitado) ||
    datos.modulosPlan.includes('HARVEST') ||
    datos.modulosEfectivos.includes('HARVEST') ||
    modulos.includes('HARVEST')
  const disponible = datos.modulos.some((m) => m.codigo === 'HARVEST' && m.disponible)
  const puedeSeleccionar = disponible && !contrato && !intencion && !recibo
  const puedeActivar =
    datos.puedeAdministrar && datos.estado.suscripcion?.estado === 'ACTIVA'
  const pendiente = seleccionado && !contrato
  function seleccionar() {
    if (puedeSeleccionar) setSeleccionado(true)
  }
  async function activar() {
    if (enviando.current || !puedeActivar || !pendiente || recibo) return
    enviando.current = true
    setOcupado(true)
    setError(null)
    const solicitud = intencion ?? {
      operacionId: crypto.randomUUID(),
      versionBase: datos.versionBase,
      modulo: 'HARVEST',
      origen: 'ADD_ON',
      motivo:
        'Activación de Cosecha solicitada desde Módulos por el administrador de la empresa.',
      hasta: null,
      effectiveAt: null
    }
    setIntencion(solicitud)
    try {
      const resultado = await servicio.habilitarModulo(solicitud)
      setRecibo(resultado)
    } catch (e) {
      if (e.name !== 'SolicitudObsoleta') setError(e)
    } finally {
      enviando.current = false
      setOcupado(false)
    }
  }
  return (
    <>
      <div
        className={`owner-modules-acquired ${arrastrando ? 'is-dragging' : ''}`}
        role="region"
        aria-label="Módulos adquiridos y seleccionados"
        onDragOver={(event) => {
          if (!puedeSeleccionar || !event.dataTransfer.types.includes(TIPO_MODULO))
            return
          event.preventDefault()
          event.dataTransfer.dropEffect = 'copy'
          setArrastrando(true)
        }}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) setArrastrando(false)
        }}
        onDrop={(event) => {
          event.preventDefault()
          setArrastrando(false)
          if (event.dataTransfer.getData(TIPO_MODULO) === 'HARVEST') seleccionar()
        }}
      >
        {contrato ? (
          <div
            className="owner-module-card"
            role="group"
            aria-label="Cosecha adquirido"
          >
            <OwnerIcon name="avocado" />
            <span>Cosecha</span>
            {modulos.includes('HARVEST') && (
              <Link className="owner-module-app-link" to="/cosecha/app">
                App de Cosecha
              </Link>
            )}
            <span className="sr-only">
              {datos.modulosEfectivos.includes('HARVEST')
                ? 'Activo'
                : 'Contratado, sin acceso actual'}
            </span>
          </div>
        ) : pendiente ? (
          <button
            className="owner-module-card"
            onClick={() => setSeleccionado(false)}
            disabled={!!intencion || ocupado}
            aria-label="Quitar Cosecha de la selección"
          >
            <OwnerIcon name="avocado" />
            <span>Cosecha</span>
            <span className="sr-only">Seleccionado para adquirir</span>
          </button>
        ) : (
          <button
            className="owner-module-drop"
            disabled={!puedeSeleccionar}
            onClick={seleccionar}
            aria-label="Agregar Cosecha a la selección"
          >
            <OwnerIcon name="plus" />
            <span>Arrastra un módulo</span>
          </button>
        )}
      </div>
      <div className="owner-module-purchase-row">
        <button
          className="owner-module-purchase"
          disabled={!pendiente || !!recibo}
          onClick={() => setConfirmando(true)}
        >
          Adquirir {pendiente ? 1 : 0} módulo(s)
        </button>
      </div>
      <section
        className="owner-module-catalog"
        aria-labelledby="owner-module-catalog-title"
      >
        <h2 id="owner-module-catalog-title">Módulos</h2>
        {disponible ? (
          <button
            className="owner-module-card"
            disabled={!puedeSeleccionar || pendiente}
            draggable={puedeSeleccionar && !pendiente}
            onDragStart={(event) => {
              event.dataTransfer.setData(TIPO_MODULO, 'HARVEST')
              event.dataTransfer.effectAllowed = 'copy'
            }}
            onDragEnd={() => setArrastrando(false)}
            onClick={seleccionar}
            aria-label={
              contrato
                ? 'Cosecha ya adquirido'
                : pendiente
                  ? 'Cosecha seleccionado'
                  : 'Seleccionar Cosecha'
            }
          >
            <OwnerIcon name="avocado" />
            <span>Cosecha</span>
          </button>
        ) : (
          <p role="status">No hay módulos disponibles para adquirir.</p>
        )}
      </section>
      <p className="sr-only" role="status">
        {contrato
          ? 'Cosecha ya está contratado.'
          : pendiente
            ? '1 módulo seleccionado: Cosecha.'
            : 'Sin módulos seleccionados.'}
      </p>
      {confirmando && (
        <ActivacionModulo
          ocupado={ocupado}
          cerrar={() => {
            if (!ocupado) setConfirmando(false)
          }}
        >
          <h2 id="module-confirm-title">
            {recibo ? 'Solicitud confirmada' : 'Adquirir Cosecha'}
          </h2>
          {recibo ? (
            <>
              <p role="status">
                {recibo.fase === 'APLICADA'
                  ? 'Cosecha se ha activado para tu empresa.'
                  : 'La solicitud quedó registrada; la activación está pendiente.'}
              </p>
              <button
                autoFocus
                onClick={() => {
                  setConfirmando(false)
                  void actualizar()
                }}
              >
                Aceptar
              </button>
            </>
          ) : (
            <>
              <p>La compra con pago aún no está disponible.</p>
              {puedeActivar ? (
                <p>
                  Puedes solicitar la activación de Cosecha con la autorización
                  comercial de tu cuenta. Esta acción no realiza un cobro.
                </p>
              ) : (
                <p>
                  La activación requiere una suscripción activa y autorización
                  comercial. Contacta con GesGROW para contratar el módulo.
                </p>
              )}
              {error && <p role="alert">{error.message}</p>}
              {error?.name === 'ConflictoVersionComercial' && (
                <button
                  onClick={() => {
                    setConfirmando(false)
                    void actualizar()
                  }}
                >
                  Actualizar módulos
                </button>
              )}
              {puedeActivar && (
                <button
                  disabled={ocupado || error?.name === 'ConflictoVersionComercial'}
                  onClick={(event) => {
                    if (event.detail < 2) void activar()
                  }}
                >
                  {ocupado
                    ? 'Activando…'
                    : intencion
                      ? 'Reintentar activación'
                      : 'Activar módulo'}
                </button>
              )}
              <button
                autoFocus
                disabled={ocupado}
                onClick={() => setConfirmando(false)}
              >
                Cerrar
              </button>
            </>
          )}
        </ActivacionModulo>
      )}
    </>
  )
}

function ActivacionModulo({ children, cerrar, ocupado }) {
  const dialogo = useRef(null)
  useEffect(() => {
    const el = dialogo.current
    const previo = document.activeElement
    if (el.showModal) el.showModal()
    else el.setAttribute('open', '')
    return () => {
      el.close?.()
      previo?.focus()
    }
  }, [])
  return (
    <dialog
      ref={dialogo}
      className="owner-module-dialog"
      aria-modal="true"
      aria-labelledby="module-confirm-title"
      onCancel={(event) => {
        event.preventDefault()
        if (!ocupado) cerrar()
      }}
    >
      {children}
    </dialog>
  )
}
