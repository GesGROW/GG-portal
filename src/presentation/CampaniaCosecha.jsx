import { useEffect, useRef, useState } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router'
import { useCarga, Carga } from './GestionUi.jsx'
import { CosechaSelector } from './CosechaSelector.jsx'
import { ReportesCampania, ReportIcon } from './ReportesCampania.jsx'
import { TicketsCosecha } from './TicketsCosecha.jsx'
import { LotesCampania } from './LotesCampania.jsx'
import {
  TrabajadoresCampania,
  IconoTrabajador,
  SECCIONES_TRABAJADORES
} from './TrabajadoresCampania.jsx'
import './campania-cosecha.css'

export function CampaignIcon({ name }) {
  const paths = {
    tickets:
      'M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z M13 5v2 M13 17v2 M13 11v2',
    workers:
      'M17 21a5 5 0 00-10 0 M22 10.5a3.5 3.5 0 00-5.507-2.868 M7.507 7.632A3.5 3.5 0 002 10.5',
    reports: 'M3 3v16a2 2 0 0 0 2 2h16 M18 17V9 M13 17V5 M8 17v-3',
    generation:
      'M12 16h.01 M16 16h.01 M3 19a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8.5a.5.5 0 0 0-.769-.422l-4.462 2.844A.5.5 0 0 1 15 10.5v-2a.5.5 0 0 0-.769-.422L9.77 10.922A.5.5 0 0 1 9 10.5V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2z M8 16h.01',
    lots: 'M7.5 3v18 M12 3v18 M16.5 3v18',
    assignments:
      'M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z M14 2v5a1 1 0 0 0 1 1h5 M16 22a4 4 0 0 0-8 0'
  }
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#022F2A"
      strokeWidth={2}
      width={['tickets', 'workers', 'reports'].includes(name) ? 35 : 24}
      height={['tickets', 'workers', 'reports'].includes(name) ? 35 : 24}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={paths[name]} />
      {name === 'workers' && (
        <>
          <circle cx="12" cy="13" r="3" />
          <circle cx="18.5" cy="4.5" r="2.5" />
          <circle cx="5.5" cy="4.5" r="2.5" />
        </>
      )}
      {name === 'lots' && <rect width="18" height="18" x="3" y="3" rx="2" />}
      {name === 'assignments' && <circle cx="12" cy="15" r="3" />}
    </svg>
  )
}

export function CampaniaCosecha({
  servicio,
  reportes,
  contexto,
  seccion,
  pendiente,
  puedeTrabajadores
}) {
  const [params, setParams] = useSearchParams()
  const catalogo = useCarga(() => servicio.campanias(), [servicio])
  const campania =
    params.get('campania') ||
    (catalogo.datos?.find((c) => c.estado === 'ACTIVA') ?? catalogo.datos?.[0])?.id ||
    ''
  useEffect(() => {
    if (
      pendiente ||
      catalogo.cargando ||
      catalogo.error ||
      !campania ||
      params.get('campania')
    )
      return
    const siguientes = new URLSearchParams(params)
    siguientes.set('campania', campania)
    setParams(siguientes, { replace: true })
  }, [pendiente, catalogo.cargando, catalogo.error, campania, params, setParams])
  const query = campania ? `?campania=${encodeURIComponent(campania)}` : ''
  const generar = contexto.permite('harvest.manage')
  const trabajadores = SECCIONES_TRABAJADORES.find((t) => t.id === seccion)
  const esReporte = ['produccion', 'rendimiento'].includes(seccion)
  const subtabs = esReporte
    ? [
        { id: 'produccion', label: 'Producción', icon: 'production' },
        { id: 'rendimiento', label: 'Rendimiento', icon: 'ranking' }
      ]
    : trabajadores
      ? SECCIONES_TRABAJADORES
      : [
          ...(generar
            ? [
                {
                  id: 'generar',
                  label: 'Generación e impresión de lotes de tickets',
                  icon: 'generation'
                }
              ]
            : []),
          { id: 'lotes', label: 'Lotes de tickets generados', icon: 'lots' },
          {
            id: 'asignaciones',
            label: 'Lotes de tickets asignados',
            icon: 'assignments'
          }
        ]
  if (
    !pendiente &&
    !catalogo.cargando &&
    !catalogo.error &&
    catalogo.datos?.length === 0 &&
    generar
  )
    return <Navigate to="/cosecha/configurar" replace />
  return (
    <div className="harvest-campaign-page">
      <CosechaSelector
        destino={
          trabajadores || esReporte
            ? '/cosecha/' + seccion
            : generar
              ? '/cosecha/generar'
              : '/cosecha/lotes'
        }
        campanias={catalogo.datos ?? []}
        seleccion={campania}
        pendiente={pendiente || catalogo.cargando || Boolean(catalogo.error)}
      />
      <div className="campaign-container">
        <nav className="campaign-main-tabs" aria-label="Opciones de Cosecha">
          <Link
            aria-current={!trabajadores && !esReporte ? 'page' : undefined}
            to={(generar ? '/cosecha/generar' : '/cosecha/lotes') + query}
            aria-label="Tickets"
          >
            <CampaignIcon name="tickets" />
            <span>Tickets</span>
          </Link>
          {puedeTrabajadores || contexto.permite('harvest.view') || generar ? (
            <Link
              to={'/cosecha/cosechadores' + query}
              aria-label="Trabajadores"
              aria-current={trabajadores ? 'page' : undefined}
            >
              <CampaignIcon name="workers" />
              <span>Trabajadores</span>
            </Link>
          ) : (
            <button
              disabled
              aria-label="Trabajadores"
              title="No tienes acceso a la gestión de trabajadores"
            >
              <CampaignIcon name="workers" />
              <span>Trabajadores</span>
            </button>
          )}
          {contexto.permite('reports.view') ? (
            <Link
              to={'/cosecha/produccion' + query}
              aria-label="Reportes"
              aria-current={esReporte ? 'page' : undefined}
            >
              <CampaignIcon name="reports" />
              <span>Reportes</span>
            </Link>
          ) : (
            <button
              disabled
              aria-label="Reportes"
              title="Se requiere permiso para consultar reportes"
            >
              <CampaignIcon name="reports" />
              <span>Reportes</span>
            </button>
          )}
        </nav>
        <nav
          className="campaign-sub-tabs"
          aria-label={
            esReporte
              ? 'Secciones de Reportes'
              : trabajadores
                ? 'Secciones de Trabajadores'
                : 'Secciones de Tickets'
          }
        >
          {subtabs.map((t) => (
            <Link
              key={t.id}
              to={'/cosecha/' + t.id + query}
              aria-label={t.label}
              aria-current={seccion === t.id ? 'page' : undefined}
            >
              {esReporte ? (
                <ReportIcon name={t.icon} />
              ) : trabajadores ? (
                <IconoTrabajador tipo={t.icon} />
              ) : (
                <CampaignIcon name={t.icon} />
              )}
              <span>{t.label}</span>
            </Link>
          ))}
        </nav>
        <section className="campaign-body" aria-busy={pendiente || catalogo.cargando}>
          {seccion === 'generar' && <h2>Generación e impresión de lotes de tickets</h2>}
          {seccion === 'lotes' && <h2>Lotes de tickets generados</h2>}
          {seccion === 'asignaciones' && <h2>Lotes de tickets asignados</h2>}
          {trabajadores && <h2>{trabajadores.label}</h2>}
          <Carga
            consulta={pendiente ? { cargando: true } : catalogo}
            skeleton={
              esReporte ? 'report' : seccion === 'generar' ? 'generation' : 'table'
            }
          >
            {(campanias) => {
              const elegida = campanias.find((c) => c.id === campania)
              if (!elegida)
                return (
                  <p role="alert">
                    No hay una campaña disponible. Selecciona una campaña o agrega un
                    cultivo.
                  </p>
                )
              if (esReporte)
                return (
                  <ReportesCampania
                    key={`${elegida.id}:${seccion}`}
                    servicio={reportes}
                    campania={elegida}
                    rendimiento={seccion === 'rendimiento'}
                  />
                )
              if (trabajadores)
                return (
                  <TrabajadoresCampania
                    key={`${elegida.id}:${seccion}`}
                    servicio={servicio}
                    campania={elegida}
                    seccion={trabajadores}
                  />
                )
              if (seccion === 'generar')
                return (
                  <GeneracionCampania
                    key={elegida.id}
                    servicio={servicio}
                    campania={elegida}
                    pendiente={pendiente}
                  />
                )
              if (seccion === 'lotes' || seccion === 'asignaciones')
                return (
                  <LotesCampania
                    key={`${elegida.id}:${seccion}`}
                    servicio={servicio}
                    campania={elegida}
                    asignados={seccion === 'asignaciones'}
                  />
                )
              return (
                <TicketsCosecha
                  servicio={servicio}
                  contexto={contexto}
                  seccion={seccion}
                  catalogo={catalogo}
                  pendiente={pendiente}
                />
              )
            }}
          </Carga>
        </section>
      </div>
    </div>
  )
}

export function GeneracionCampania({ servicio, campania, pendiente = false }) {
  const [cantidad, setCantidad] = useState('0'),
    [tamanio, setTamanio] = useState('0')
  const [intento, setIntento] = useState(null),
    [resultado, setResultado] = useState(null)
  const [ocupado, setOcupado] = useState(false),
    [impreso, setImpreso] = useState(false),
    [error, setError] = useState('')
  const bloqueo = useRef(false),
    operacion = useRef(crypto.randomUUID()),
    destinoActual = useRef(null),
    montado = useRef(true)
  useEffect(() => {
    montado.current = true
    return () => {
      montado.current = false
      if (bloqueo.current) destinoActual.current?.cerrar?.()
    }
  }, [])
  const valido = (v) =>
    Number.isSafeInteger(Number(v)) && Number(v) > 0 && Number(v) <= 100000
  const uno = valido(cantidad),
    dos = valido(tamanio),
    lista = uno && dos && campania.estado === 'ACTIVA'
  async function enviar(e) {
    e.preventDefault()
    if (!lista || pendiente || bloqueo.current || impreso) return
    let destino
    try {
      destino = servicio.abrirImpresion()
      destinoActual.current = destino
    } catch (e) {
      setError(e.message)
      return
    }
    bloqueo.current = true
    setOcupado(true)
    setError('')
    const solicitud = intento ?? {
      operacionId: operacion.current,
      campaniaId: campania.id,
      cantidadTickets: Number(cantidad),
      tamanioLote: Number(tamanio)
    }
    setIntento(solicitud)
    try {
      const recibo = resultado ?? (await servicio.generar(solicitud))
      if (!montado.current) {
        destino.cerrar()
        return
      }
      setResultado(recibo)
      await servicio.imprimirGeneracion(solicitud.operacionId, destino)
      if (montado.current) setImpreso(true)
    } catch (e) {
      destino?.cerrar?.()
      if (montado.current && e.name !== 'SolicitudObsoleta')
        setError(
          e.message ||
            'No se pudo preparar la impresión. Reintenta con los mismos tickets.'
        )
    } finally {
      bloqueo.current = false
      if (montado.current) setOcupado(false)
    }
  }
  const deshabilitado = pendiente || ocupado || Boolean(intento)
  return (
    <form className="campaign-generation" onSubmit={enviar} noValidate>
      <div className={`campaign-step ${uno ? 'is-complete' : ''}`}>
        <span
          className="campaign-step-number"
          aria-label={`Paso 1: ${uno ? 'completo' : 'pendiente'}`}
        >
          1
        </span>
        <label>
          Cantidad total de tickets
          <Numero
            label="Cantidad total de tickets"
            valor={cantidad}
            cambiar={setCantidad}
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
          Tickets por lote
          <Numero
            label="Tickets por lote"
            valor={tamanio}
            cambiar={setTamanio}
            disabled={deshabilitado}
          />
        </label>
      </div>
      <div
        className={`campaign-step campaign-print-step ${impreso ? 'is-complete' : ''}`}
      >
        <span
          className="campaign-step-number"
          aria-label={`Paso 3: ${impreso ? 'completo' : 'pendiente'}`}
        >
          3
        </span>
        {lista && (
          <div className="campaign-print-reveal">
            <button type="submit" disabled={ocupado || pendiente || impreso}>
              {ocupado
                ? 'Preparando…'
                : impreso
                  ? 'Impresión abierta'
                  : intento
                    ? 'Reintentar impresión'
                    : 'Imprimir tickets'}
            </button>
          </div>
        )}
      </div>
      {campania.estado !== 'ACTIVA' && (
        <p role="status">
          Esta campaña está cerrada. Selecciona la campaña actual para generar tickets.
        </p>
      )}
      {error && (
        <p className="campaign-generation-error" role="alert">
          {error}
        </p>
      )}
      {resultado && (
        <div className="campaign-generation-result" role="status">
          <p>
            {resultado.cantidadTickets} tickets · {resultado.lotes.length} lotes
          </p>
          {impreso && (
            <p>
              Se abrió la impresión en A4. Completa la impresión desde el navegador.
            </p>
          )}
          <button
            type="button"
            disabled={ocupado || pendiente}
            onClick={() => {
              operacion.current = crypto.randomUUID()
              setIntento(null)
              setResultado(null)
              setImpreso(false)
              setError('')
              setCantidad('0')
              setTamanio('0')
            }}
          >
            Preparar otra generación
          </button>
        </div>
      )}
    </form>
  )
}
function Numero({ label, valor, cambiar, disabled }) {
  const ref = useRef(null)
  return (
    <span className="campaign-number">
      <input
        ref={ref}
        aria-label={label}
        type="number"
        min="0"
        max="100000"
        step="1"
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
