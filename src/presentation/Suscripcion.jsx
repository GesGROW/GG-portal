import { Select } from './Select.jsx'
import { DataTable, Icon, StatusBadge } from './Ui.jsx'
import { useState } from 'react'
import { useCarga, Carga } from './GestionUi.jsx'
import './subscription.css'

const operaciones = [
  ['cambiarPlan', 'Cambiar plan'],
  ['renovarSuscripcion', 'Renovar suscripción'],
  ['suspenderSuscripcion', 'Suspender suscripción'],
  ['reactivarSuscripcion', 'Reactivar suscripción'],
  ['cancelarSuscripcion', 'Cancelar suscripción'],
  ['habilitarModulo', 'Habilitar módulo'],
  ['deshabilitarModulo', 'Deshabilitar módulo']
]
const fecha = (v) =>
  v ? new Date(v).toLocaleString('es-PE', { timeZone: 'America/Lima' }) : 'Sin límite'
const iso = (v) => (v ? new Date(v).toISOString() : null)
const fechaCorta = (v) =>
  v
    ? new Date(v).toLocaleDateString('es-PE', {
        timeZone: 'America/Lima',
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      })
    : 'Sin fecha de fin'
const nombresModulo = {
  HARVEST: 'Cosecha',
  CAMPAIGN: 'Campañas',
  WORKFORCE: 'Personal',
  FARM_STRUCTURE: 'Estructura agrícola'
}

export function Suscripcion({ servicio }) {
  const consulta = useCarga(() => servicio.consultar(), [servicio])
  const [administrando, setAdministrando] = useState(false)
  const [intencion, setIntencion] = useState(null),
    [recibo, setRecibo] = useState(null),
    [error, setError] = useState(null),
    [ocupado, setOcupado] = useState(false)
  async function enviar(solicitud) {
    setError(null)
    setOcupado(true)
    // Congelar la intención y su versión: un fallo de transporte sólo permite
    // reintentar ese mismo comando, nunca generar silenciosamente otro UUID.
    const i = intencion ?? solicitud
    setIntencion(i)
    try {
      const r = await servicio[i.metodo](i.datos)
      setRecibo(r)
      consulta.refrescar()
      // Acceso/nav se resuelven de nuevo al navegar; no remontar aquí el Portal,
      // para conservar el recibo y el bloqueo explícito contra dobles envíos.
    } catch (e) {
      if (e.name !== 'SolicitudObsoleta') setError(e)
    } finally {
      setOcupado(false)
    }
  }
  return (
    <section className="subscription-page" aria-labelledby="subscription-title">
      <h1 id="subscription-title">Suscripción</h1>
      <p className="subscription-description">
        Consulta el plan de tu empresa, los módulos contratados y la facturación.
      </p>
      <div className="subscription-toolbar">
        <p>
          {consulta.datos
            ? `Última actualización: ${fecha(consulta.datos.actualizadoEn)} (Lima)`
            : 'Suscripción de la empresa'}
        </p>
        <button
          className="subscription-button subscription-refresh"
          disabled={
            ocupado ||
            (intencion && !recibo && !error) ||
            error?.name === 'ServicioNoDisponible'
          }
          onClick={consulta.refrescar}
        >
          <Icon name="refresh" />
          Actualizar suscripción
        </button>
      </div>
      {recibo && (
        <p role="status" className="notice">
          {recibo.fase === 'PROGRAMADA'
            ? `Cambio programado para ${fecha(recibo.effectiveAt)}. El estado actual se mantiene hasta su aplicación en servidor.`
            : 'Cambio aplicado y auditado.'}{' '}
          Operación: {recibo.operacionId}
        </p>
      )}
      {error && (
        <div role="alert">
          <p>{error.message}</p>
          {error.name === 'ConflictoVersionComercial' && (
            <p>
              Actualice los datos y prepare una nueva intención con la versión actual.
            </p>
          )}
        </div>
      )}
      {intencion && !recibo && error?.name === 'ServicioNoDisponible' && (
        <p>
          No hay confirmación del servidor. Reintente la misma solicitud; conserva ID,
          parámetros y versión.
        </p>
      )}
      {intencion && !recibo && (
        <button
          disabled={ocupado || !error || error.name === 'ConflictoVersionComercial'}
          onClick={() => enviar(intencion)}
        >
          Reintentar misma solicitud
        </button>
      )}
      {intencion && (recibo || (error && error.name !== 'ServicioNoDisponible')) && (
        <button
          disabled={
            ocupado ||
            consulta.cargando ||
            (error?.name === 'ConflictoVersionComercial' &&
              consulta.datos?.versionBase === intencion.datos.versionBase)
          }
          onClick={() => {
            setIntencion(null)
            setRecibo(null)
            setError(null)
          }}
        >
          Preparar otro cambio
        </button>
      )}
      <Carga consulta={consulta}>
        {(d) => (
          <>
            <PlanActual
              datos={d}
              administrando={administrando}
              administrar={() => setAdministrando((abierto) => !abierto)}
            />
            <div className="subscription-columns">
              <ModulosSuscripcion datos={d} />
              <Facturacion />
            </div>
            <Pagos />
            {d.puedeAdministrar && administrando && (
              <section
                id="subscription-management"
                className="subscription-card subscription-management"
                aria-label="Administrar suscripción"
              >
                <h2>Administrar suscripción</h2>
                <p className="subscription-muted">
                  Versión del contrato: {d.versionBase}
                </p>
                <Formulario
                  key={d.versionBase}
                  datos={d}
                  enviar={enviar}
                  bloqueado={ocupado || !!intencion}
                />
              </section>
            )}
            {d.programados.length > 0 && <Programados filas={d.programados} />}
            <details className="subscription-details subscription-card">
              <summary>Detalles de la suscripción</summary>
              <ResumenComercial datos={d} />
            </details>
            <details className="subscription-details subscription-card">
              <summary>Historial de cambios</summary>
              <Historial filas={d.historial} />
            </details>
          </>
        )}
      </Carga>
    </section>
  )
}
function PlanActual({ datos: d, administrando, administrar }) {
  const s = d.estado.suscripcion
  const estados = {
    ACTIVA: 'Activa',
    SUSPENDIDA: 'Suspendida',
    CANCELADA: 'Cancelada',
    VENCIDA: 'Vencida'
  }
  return (
    <section
      className="subscription-card subscription-plan"
      aria-labelledby="subscription-plan-title"
    >
      <div className="subscription-plan-heading">
        <div>
          <h2 id="subscription-plan-title">Estado de la suscripción</h2>
          <dl className="subscription-plan-name">
            <dt className="sr-only">Plan actual</dt>
            <dd>
              {s ? (d.planActual?.nombre ?? 'Plan no disponible') : 'Sin suscripción'}
            </dd>
            {s && (
              <>
                <dt className="sr-only">Estado</dt>
                <dd className="sr-only">{s.estado}</dd>
              </>
            )}
          </dl>
        </div>
        {s && (
          <StatusBadge tone={s.estado === 'ACTIVA' ? 'success' : 'neutral'}>
            {estados[s.estado] ?? s.estado}
          </StatusBadge>
        )}
      </div>
      <div className="subscription-plan-bottom">
        <dl className="subscription-facts">
          <div>
            <dt>Período actual</dt>
            <dd>
              {s
                ? `${fechaCorta(s.desde)} — ${fechaCorta(s.hasta)}`
                : 'Sin período contratado'}
            </dd>
          </div>
          <div>
            <dt>Próxima renovación</dt>
            <dd>No informada</dd>
          </div>
          <div>
            <dt>Precio</dt>
            <dd>No informado</dd>
          </div>
        </dl>
        {d.puedeAdministrar ? (
          <button
            type="button"
            className="subscription-button"
            aria-expanded={administrando}
            aria-controls="subscription-management"
            onClick={administrar}
          >
            {administrando ? 'Cerrar administración' : 'Administrar suscripción'}
          </button>
        ) : (
          <p className="subscription-readonly">
            Tu cuenta tiene acceso de consulta a la suscripción.
          </p>
        )}
      </div>
    </section>
  )
}
function ModulosSuscripcion({ datos: d }) {
  const contratados = [
    ...new Set([
      ...d.modulosPlan,
      ...d.estado.modulos.filter((m) => m.habilitado).map((m) => m.modulo_codigo),
      ...d.modulosEfectivos
    ])
  ]
  const disponibles = d.modulos.filter(
    (m) => m.disponible && !contratados.includes(m.codigo)
  )
  const nombre = (codigo) =>
    nombresModulo[codigo] ??
    d.modulos.find((m) => m.codigo === codigo)?.nombre ??
    codigo
  return (
    <section
      className="subscription-card subscription-modules"
      aria-labelledby="subscription-modules-title"
    >
      <h2 id="subscription-modules-title">Módulos incluidos</h2>
      <ul className="subscription-module-list">
        {contratados.map((codigo) => (
          <li key={codigo}>
            <span>{nombre(codigo)}</span>
            <StatusBadge
              tone={d.modulosEfectivos.includes(codigo) ? 'success' : 'neutral'}
            >
              {d.modulosEfectivos.includes(codigo) ? 'Activo' : 'Sin acceso actual'}
            </StatusBadge>
          </li>
        ))}
      </ul>
      {!contratados.length && (
        <p className="subscription-muted">Sin módulos contratados.</p>
      )}
      <p className="subscription-modules-note">
        Los módulos se contratan para toda la empresa. Cada usuario conserva sus propios
        permisos.
      </p>
      {disponibles.length > 0 && (
        <>
          <h3>Otros módulos disponibles</h3>
          {disponibles.map((m) => (
            <details className="subscription-module-option" key={m.codigo}>
              <summary>
                <span>{nombre(m.codigo)}</span>
                <StatusBadge tone="neutral">No contratado</StatusBadge>
                <span className="subscription-module-link">Ver módulo</span>
              </summary>
              <p>
                Este módulo está disponible para contratar y no forma parte de la
                suscripción actual.
              </p>
            </details>
          ))}
        </>
      )}
    </section>
  )
}
function Facturacion() {
  return (
    <section
      className="subscription-card subscription-billing"
      aria-labelledby="subscription-billing-title"
    >
      <h2 id="subscription-billing-title">Facturación</h2>
      <dl>
        <div>
          <dt>Método de pago</dt>
          <dd>No registrado</dd>
        </div>
        <div>
          <dt>Correo de facturación</dt>
          <dd>No registrado</dd>
        </div>
        <div>
          <dt>Próximo cobro</dt>
          <dd>No informado</dd>
        </div>
      </dl>
      <p className="subscription-muted">
        Los datos de facturación aún no están disponibles.
      </p>
    </section>
  )
}
function Pagos() {
  return (
    <section
      className="subscription-card subscription-payments"
      aria-labelledby="subscription-payments-title"
    >
      <h2 id="subscription-payments-title">Historial de pagos</h2>
      <DataTable
        label="Historial de pagos"
        className="subscription-payments-table"
        data={[]}
        columns={['Fecha', 'Concepto', 'Importe', 'Estado', 'Recibo'].map((header) => ({
          key: header,
          header
        }))}
      />
      <p className="subscription-payments-empty" role="status">
        Aún no hay información de pagos disponible.
      </p>
    </section>
  )
}
function ResumenComercial({ datos: d }) {
  return (
    <div className="subscription-contract-details">
      <div className="commercial-modules-grid">
        <div>
          <span className="eyebrow">Catálogo del plan</span>
          <h4>Módulos contratados</h4>
          <p>{d.modulosPlan.join(' · ') || 'Sin módulos de plan'}</p>
        </div>
        <div className="commercial-effective-modules">
          <span className="eyebrow">Acceso real</span>
          <h4>Módulos efectivos</h4>
          <p>
            {d.modulosEfectivos.join(' · ') || 'Ningún módulo habilitado actualmente'}
          </p>
        </div>
      </div>
      <p className="muted">
        El acceso efectivo lo resuelve Platform con suscripción, vigencia y
        entitlements. El catálogo del plan no concede acceso por sí solo.
      </p>
      <DataTable
        className="management-table commercial-entitlements-table"
        caption="Entitlements, add-ons y excepciones"
        rowKey="modulo_codigo"
        data={d.estado.modulos}
        columns={[
          { key: 'modulo_codigo', header: 'Módulo', rowHeader: true },
          { key: 'origen', header: 'Origen' },
          {
            key: 'habilitado',
            header: 'Habilitado en contrato',
            render: (m) => (m.habilitado ? 'Sí' : 'No')
          },
          { key: 'desde', header: 'Desde', render: (m) => fecha(m.desde) },
          { key: 'hasta', header: 'Hasta', render: (m) => fecha(m.hasta) },
          {
            key: 'acceso',
            header: 'Acceso efectivo',
            render: (m) => (
              <StatusBadge
                indicator
                tone={
                  d.modulosEfectivos.includes(m.modulo_codigo) ? 'success' : 'neutral'
                }
              >
                {d.modulosEfectivos.includes(m.modulo_codigo)
                  ? 'Habilitado'
                  : 'No habilitado'}
              </StatusBadge>
            )
          }
        ]}
      />
      {!d.estado.modulos.length && <p>Sin entitlements contratados.</p>}
    </div>
  )
}
function Formulario({ datos, enviar, bloqueado }) {
  const [metodo, setMetodo] = useState('cambiarPlan'),
    [planId, setPlan] = useState(''),
    [modulo, setModulo] = useState(''),
    [origen, setOrigen] = useState('ADD_ON'),
    [hasta, setHasta] = useState(''),
    [programar, setProgramar] = useState(false),
    [effectiveAt, setEffectiveAt] = useState(''),
    [motivo, setMotivo] = useState(''),
    [confirmar, setConfirmar] = useState(false)
  const tieneModulo = ['habilitarModulo', 'deshabilitarModulo'].includes(metodo)
  function guardar(e) {
    e.preventDefault()
    const d = {
      operacionId: crypto.randomUUID(),
      versionBase: datos.versionBase,
      motivo,
      effectiveAt: programar ? iso(effectiveAt) : null
    }
    if (metodo === 'cambiarPlan') d.planId = planId
    if (tieneModulo) d.modulo = modulo
    if (metodo === 'habilitarModulo') d.origen = origen
    if (['renovarSuscripcion', 'habilitarModulo'].includes(metodo)) d.hasta = iso(hasta)
    void enviar({ metodo, datos: d })
  }
  return (
    <form className="settings-form commercial-form" onSubmit={guardar}>
      <h3>Administración comercial delegada</h3>
      <p>
        Los cambios se validan en Platform y requieren motivo. Ninguna operación realiza
        cobros.
      </p>
      <fieldset disabled={bloqueado || !datos.estado.suscripcion}>
        <legend>Intención comercial</legend>
        <label>
          Operación{' '}
          <Select
            value={metodo}
            onChange={(e) => {
              setMetodo(e.target.value)
              setConfirmar(false)
            }}
          >
            {operaciones.map(([m, n]) => (
              <option key={m} value={m}>
                {n}
              </option>
            ))}
          </Select>
        </label>
        {metodo === 'cambiarPlan' && (
          <label>
            Nuevo plan{' '}
            <Select required value={planId} onChange={(e) => setPlan(e.target.value)}>
              <option value="">Seleccione un plan</option>
              {datos.planes
                .filter((p) => p.activo)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre}
                  </option>
                ))}
            </Select>
          </label>
        )}
        {tieneModulo && (
          <label>
            Módulo{' '}
            <Select required value={modulo} onChange={(e) => setModulo(e.target.value)}>
              <option value="">Seleccione un módulo</option>
              {datos.modulos
                .filter((m) => m.disponible)
                .map((m) => (
                  <option key={m.codigo}>{m.codigo}</option>
                ))}
            </Select>
          </label>
        )}
        {metodo === 'habilitarModulo' && (
          <label>
            Origen{' '}
            <Select value={origen} onChange={(e) => setOrigen(e.target.value)}>
              <option value="ADD_ON">Add-on</option>
              <option value="EXCEPCION">Excepción</option>
            </Select>
          </label>
        )}
        {['renovarSuscripcion', 'habilitarModulo'].includes(metodo) && (
          <label>
            Vigencia hasta (hora local){metodo === 'habilitarModulo' && ' — opcional'}{' '}
            <input
              type="datetime-local"
              required={metodo === 'renovarSuscripcion'}
              value={hasta}
              onChange={(e) => setHasta(e.target.value)}
            />
          </label>
        )}
        <label className="check-row">
          <input
            type="checkbox"
            checked={programar}
            onChange={(e) => setProgramar(e.target.checked)}
          />
          Programar cambio futuro
        </label>
        {programar && (
          <label>
            Fecha efectiva (hora local){' '}
            <input
              type="datetime-local"
              required
              value={effectiveAt}
              onChange={(e) => setEffectiveAt(e.target.value)}
            />
          </label>
        )}
        <p className="muted">
          Sin programación, se solicita un cambio inmediato. El reloj del servidor
          decide la vigencia y aplicación de los cambios.
        </p>
        <label>
          Motivo{' '}
          <textarea
            required
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
          />
        </label>
        {metodo === 'cancelarSuscripcion' && (
          <label className="check-row">
            <input
              type="checkbox"
              required
              checked={confirmar}
              onChange={(e) => setConfirmar(e.target.checked)}
            />
            Entiendo que la cancelación es terminal y afecta el acceso a los módulos.
          </label>
        )}
        <button
          className="primary"
          type="submit"
          disabled={metodo === 'cancelarSuscripcion' && !confirmar}
        >
          Solicitar cambio comercial
        </button>
      </fieldset>
    </form>
  )
}
function Programados({ filas }) {
  return (
    <section className="management-section commercial-future">
      <h3>Cambios futuros programados</h3>
      <p>
        Son intenciones pendientes; no sustituyen el estado actual. Platform los
        aplicará o rechazará al llegar la fecha del servidor y revalidar autorización y
        versión.
      </p>
      {!filas.length ? (
        <p>Sin cambios programados pendientes.</p>
      ) : (
        <DataTable
          className="management-table"
          caption="Cambios programados"
          data={filas}
          columns={[
            { key: 'tipo_evento', header: 'Cambio' },
            {
              key: 'effective_at',
              header: 'Fecha efectiva (Lima)',
              render: (o) => fecha(o.effective_at)
            },
            {
              key: 'actor',
              header: 'Actor',
              render: (o) => o.actor.usuarioId ?? o.actor.tipo
            },
            { key: 'version_base', header: 'Versión base' },
            { key: 'motivo', header: 'Motivo' },
            {
              key: 'parametros',
              header: 'Intención',
              render: (o) => <Json valor={o.parametros} />
            }
          ]}
        />
      )}
    </section>
  )
}
function Json({ valor }) {
  return <pre className="commercial-json">{JSON.stringify(valor, null, 2)}</pre>
}
function Historial({ filas }) {
  return (
    <section className="management-section commercial-audit">
      <h3>Historial comercial inmutable</h3>
      <p>Consulta de eventos de auditoría; sus datos no se pueden editar ni borrar.</p>
      {!filas.length ? (
        <p>Sin eventos comerciales.</p>
      ) : (
        <ol className="commercial-history">
          {filas.map((e) => (
            <li key={e.id}>
              <h4>
                {e.tipo_evento} · {e.fase}
              </h4>
              <p>
                Fecha: {fecha(e.fecha_hora)} · Efectivo: {fecha(e.effective_at)} ·
                Actor: {e.actor.usuarioId ?? e.actor.tipo}
              </p>
              <p>Motivo: {e.motivo}</p>
              <details>
                <summary>Ver estado anterior, nuevo y contexto</summary>
                <h5>Estado anterior</h5>
                <Json valor={e.estado_anterior} />
                <h5>Estado nuevo</h5>
                <Json valor={e.estado_nuevo} />
                <h5>Contexto</h5>
                <Json valor={e.contexto} />
              </details>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
