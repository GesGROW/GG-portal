import { useEffect, useRef, useState } from 'react'
import QRCode from 'qrcode'
import { useCarga } from './GestionUi.jsx'
import { PdaIcon } from './PdaIcon.jsx'
import './app-cosecha.css'

const fechaLima = new Intl.DateTimeFormat('es-PE', {
  timeZone: 'America/Lima',
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false
})
export const fechaPda = (fecha) =>
  fecha && Number.isFinite(Date.parse(fecha))
    ? fechaLima.format(new Date(fecha))
    : 'Sin registros'

function CodigoQr({ enlace }) {
  const [imagen, setImagen] = useState(null)
  const [error, setError] = useState(false)
  useEffect(() => {
    let vigente = true
    setImagen(null)
    setError(false)
    QRCode.toDataURL(enlace, { width: 640, margin: 4, errorCorrectionLevel: 'M' }).then(
      (url) => {
        if (vigente) setImagen(url)
      },
      () => {
        if (vigente) setError(true)
      }
    )
    return () => {
      vigente = false
    }
  }, [enlace])
  return imagen ? (
    <img
      className="pda-qr-image"
      src={imagen}
      alt="QR para vincular el PDA a la empresa"
    />
  ) : (
    <p role={error ? 'alert' : 'status'}>
      {error ? 'No se pudo dibujar el QR. Vuelve a intentarlo.' : 'Preparando QR…'}
    </p>
  )
}

export function AppCosecha({
  servicio,
  contexto,
  dispositivos = false,
  pendiente = false
}) {
  const puedeAdministrar =
    contexto.permite('company.manage') || contexto.permite('harvest.manage')
  const consulta = useCarga(
    () => (puedeAdministrar && servicio ? servicio.listar() : null),
    [servicio, puedeAdministrar]
  )
  const [qr, setQr] = useState(null)
  const [ocupado, setOcupado] = useState(false)
  const [aviso, setAviso] = useState('')
  const [error, setError] = useState('')
  const [confirmar, setConfirmar] = useState(null)
  const confirmacion = useRef(null)
  const botonOrigen = useRef(null)
  const qrActual = qr ?? consulta.datos?.qr
  const vencimiento = qrActual?.venceEn ?? consulta.datos?.vinculacion?.venceEn
  const [ahora, setAhora] = useState(Date.now())
  useEffect(() => {
    const intervalo = setInterval(() => setAhora(Date.now()), 30000)
    return () => clearInterval(intervalo)
  }, [])
  const vencido = vencimiento && Date.parse(vencimiento) <= ahora
  useEffect(() => {
    if (consulta.datos)
      setQr((anterior) =>
        anterior?.id === consulta.datos.vinculacion?.id ? anterior : null
      )
  }, [consulta.datos])
  useEffect(() => {
    if (confirmar) {
      confirmacion.current?.focus()
    } else {
      botonOrigen.current?.focus()
    }
  }, [confirmar])

  async function copiar() {
    setError('')
    setAviso('')
    try {
      if (!servicio?.enlaceInstalacion)
        throw new Error('El enlace de la aplicación no está disponible.')
      if (!navigator.clipboard?.writeText)
        throw new Error(
          'No se pudo copiar el enlace. Usa el enlace que aparece debajo del botón.'
        )
      await navigator.clipboard.writeText(servicio.enlaceInstalacion)
      setAviso('Enlace copiado.')
    } catch (e) {
      setError(e.message)
    }
  }
  async function generar() {
    setOcupado(true)
    setAviso('')
    setError('')
    setQr(null)
    try {
      const nuevo = await servicio.generar()
      setQr(nuevo)
      setAhora(Date.now())
      setAviso('QR generado. Los dispositivos vinculados siguen activos.')
      consulta.refrescar()
    } catch (e) {
      if (e.name !== 'SolicitudObsoleta') setError(e.message)
      consulta.refrescar()
    } finally {
      setOcupado(false)
    }
  }
  async function revocar() {
    setOcupado(true)
    setError('')
    setAviso('')
    try {
      await servicio.revocar(confirmar.id)
      setAviso(`Acceso revocado para ${confirmar.nombre}.`)
      setConfirmar(null)
      consulta.refrescar()
    } catch (e) {
      if (e.name !== 'SolicitudObsoleta') setError(e.message)
    } finally {
      setOcupado(false)
    }
  }
  const errorCarga = puedeAdministrar && (!servicio || consulta.error)
  return (
    <div className="pda-content" aria-busy={pendiente || ocupado}>
      {error && (
        <p className="pda-notice" role="alert">
          {error}
        </p>
      )}
      {aviso && (
        <p className="sr-only" role="status">
          {aviso}
        </p>
      )}
      {errorCarga && (
        <div className="pda-notice" role="alert">
          <p>
            {consulta.error?.message ??
              'La administración de dispositivos no está disponible.'}
          </p>
          {servicio && (
            <button className="pda-text-button" onClick={consulta.refrescar}>
              Reintentar
            </button>
          )}
        </div>
      )}
      {dispositivos ? (
        <section className="pda-devices" aria-labelledby="pda-devices-title">
          <div className="pda-devices-heading">
            <h2 id="pda-devices-title">Dispositivos vinculados</h2>
            <button
              className="pda-action"
              onClick={consulta.refrescar}
              disabled={!servicio || ocupado || consulta.cargando || pendiente}
            >
              <PdaIcon name="refresh" />
              Actualizar
            </button>
          </div>
          {!puedeAdministrar ? (
            <p>
              Se requiere permiso de gestión de Cosecha para consultar los dispositivos.
            </p>
          ) : consulta.cargando ? (
            <p role="status">Cargando dispositivos…</p>
          ) : (
            !errorCarga && (
              <div className="pda-table-scroll">
                <table className="pda-table">
                  <caption className="sr-only">
                    Dispositivos de {contexto.empresa}
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">Dispositivo</th>
                      <th scope="col">Estado</th>
                      <th scope="col">Vinculado</th>
                      <th scope="col">Último acceso</th>
                      <th scope="col">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {consulta.datos?.dispositivos.length ? (
                      consulta.datos.dispositivos.map((d) => (
                        <tr key={d.id}>
                          <th scope="row">
                            <span className="pda-device-name">
                              <PdaIcon name="phone" />
                              {d.nombre}
                            </span>
                          </th>
                          <td>
                            <span
                              className={`pda-device-status ${d.estado === 'ACTIVO' ? 'is-active' : 'is-revoked'}`}
                            >
                              {d.estado === 'ACTIVO' ? 'Activo' : 'Revocado'}
                            </span>
                          </td>
                          <td>{fechaPda(d.vinculadoEn)}</td>
                          <td>{fechaPda(d.ultimoAccesoEn)}</td>
                          <td>
                            <button
                              className="pda-revoke"
                              disabled={ocupado || pendiente || d.estado === 'REVOCADO'}
                              onClick={(e) => {
                                botonOrigen.current = e.currentTarget
                                setConfirmar(d)
                              }}
                              aria-label={`Revocar acceso de ${d.nombre}`}
                            >
                              Revocar acceso
                            </button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td className="pda-table-empty" colSpan="5">
                          <PdaIcon name="devices" />
                          <p>Aún no hay dispositivos vinculados.</p>
                          <p>
                            Vincula el primer PDA desde la opción de instalar y
                            vincular.
                          </p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )
          )}
        </section>
      ) : (
        <div className="pda-install-grid">
          <section
            className="pda-card pda-install-card"
            aria-labelledby="pda-install-title"
          >
            <h2 id="pda-install-title">Instalar la aplicación</h2>
            <ol className="pda-install-steps">
              <li>
                <span className="pda-step-number" aria-hidden="true">
                  1
                </span>
                <div>
                  <button
                    className="pda-action"
                    onClick={copiar}
                    disabled={pendiente || !servicio?.enlaceInstalacion}
                  >
                    <PdaIcon name="copy" />
                    {aviso === 'Enlace copiado.' ? 'Enlace copiado' : 'Copiar enlace'}
                  </button>
                  {error && servicio?.enlaceInstalacion && (
                    <a
                      className="pda-install-link"
                      href={servicio.enlaceInstalacion}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Abrir App de Cosecha
                    </a>
                  )}
                  {!servicio?.enlaceInstalacion && (
                    <p className="pda-install-unavailable">
                      El enlace de instalación aún no está disponible.
                    </p>
                  )}
                </div>
              </li>
              <li>
                <span className="pda-step-number" aria-hidden="true">
                  2
                </span>
                <p>
                  Abre el enlace en el navegador del PDA.
                  <br />
                  (Google Chrome u otro)
                </p>
              </li>
              <li>
                <span className="pda-step-number" aria-hidden="true">
                  3
                </span>
                <p>
                  Dale clic al icono{' '}
                  <span
                    className="pda-browser-menu"
                    role="img"
                    aria-label="de los tres puntos"
                  >
                    <PdaIcon name="ellipsis" />
                  </span>{' '}
                  y dale a <strong>Instalar y crear acceso directo.</strong>
                </p>
              </li>
            </ol>
          </section>
          <section className="pda-card pda-pair-card" aria-labelledby="pda-pair-title">
            <h2 id="pda-pair-title">Vincular PDA a la empresa</h2>
            <div className="pda-qr-area" aria-busy={ocupado || consulta.cargando}>
              {!puedeAdministrar ? (
                <p>Solicita el QR al supervisor de Cosecha o al administrador.</p>
              ) : ocupado ? (
                <p role="status">Generando QR…</p>
              ) : consulta.cargando && !qrActual ? (
                <p role="status">Consultando QR…</p>
              ) : qrActual && !vencido ? (
                <CodigoQr enlace={qrActual.enlace} />
              ) : (
                <div className="pda-qr-placeholder">
                  <PdaIcon name="qr" />
                  <p>
                    {vencido
                      ? 'El QR ha vencido. Genera uno nuevo para vincular otro PDA.'
                      : consulta.datos?.vinculacion
                        ? 'Regenera el QR para mostrar un nuevo código de vinculación.'
                        : 'Genera un QR para vincular el primer PDA.'}
                  </p>
                </div>
              )}
            </div>
            <dl className="pda-pair-details">
              <dt>Empresa</dt>
              <dd>{contexto.empresa}</dd>
              <dt>Vence</dt>
              <dd>{vencimiento ? fechaPda(vencimiento) : 'Sin QR activo'}</dd>
            </dl>
            {puedeAdministrar && (
              <button
                className="pda-action pda-regenerate"
                onClick={generar}
                disabled={
                  !servicio?.enlaceInstalacion ||
                  ocupado ||
                  consulta.cargando ||
                  pendiente ||
                  Boolean(consulta.error)
                }
              >
                <PdaIcon name="refresh" />
                {consulta.datos?.vinculacion || qrActual
                  ? 'Regenerar QR'
                  : 'Generar QR'}
              </button>
            )}
          </section>
        </div>
      )}
      {confirmar && (
        <div
          className="pda-confirm-backdrop"
          onKeyDown={(e) => {
            if (e.key === 'Escape' && !ocupado) setConfirmar(null)
            if (e.key === 'Tab') {
              const botones = confirmacion.current?.querySelectorAll(
                'button:not(:disabled)'
              )
              if (!botones?.length) {
                e.preventDefault()
                return
              }
              const primero = botones[0],
                ultimo = botones[botones.length - 1]
              if (
                e.shiftKey &&
                (document.activeElement === primero ||
                  document.activeElement === confirmacion.current)
              ) {
                e.preventDefault()
                ultimo.focus()
              } else if (!e.shiftKey && document.activeElement === ultimo) {
                e.preventDefault()
                primero.focus()
              }
            }
          }}
        >
          <section
            className="pda-confirm"
            role="dialog"
            aria-modal="true"
            aria-labelledby="pda-confirm-title"
            aria-describedby="pda-confirm-text"
            ref={confirmacion}
            tabIndex={-1}
          >
            <h2 id="pda-confirm-title">Revocar acceso del PDA</h2>
            <p id="pda-confirm-text">
              {confirmar.nombre} perderá el acceso al conectarse. Sus registros
              guardados se conservarán.
            </p>
            <div>
              <button
                className="pda-text-button"
                onClick={() => setConfirmar(null)}
                disabled={ocupado}
              >
                Cancelar
              </button>
              <button className="pda-action" onClick={revocar} disabled={ocupado}>
                {ocupado ? 'Revocando…' : 'Revocar acceso'}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  )
}
