import { SkeletonBlock as Block, SkeletonTable } from './Skeleton.jsx'
import './campania-cosecha.css'
import './cosecha-selector.css'
import './app-cosecha.css'

export function AppCosechaSkeleton({ dispositivos = false }) {
  return dispositivos ? (
    <SkeletonTable
      rows={5}
      columns={['Dispositivo', 'Estado', 'Vinculado', 'Último acceso', 'Acciones'].map(
        (header, key) => ({ key, header })
      )}
    />
  ) : (
    <div
      className="loading-state skeleton campaign-content-skeleton pda-content"
      role="status"
      aria-busy="true"
    >
      <span className="sr-only">Cargando App de Cosecha…</span>
      <div className="pda-install-grid" aria-hidden="true">
        <div className="pda-card pda-install-card">
          <h2>Instalar la aplicación</h2>
          <ol className="pda-install-steps">
            <li>
              <span className="pda-step-number">
                <Block />
              </span>
              <div className="pda-install-primary">
                <div className="pda-qr-area pda-install-qr">
                  <Block className="skeleton-qr" />
                </div>
                <span className="pda-action">
                  <Block className="skeleton-filter-icon" />
                  Copiar enlace
                </span>
              </div>
            </li>
            <li>
              <span className="pda-step-number">
                <Block />
              </span>
              <p>
                Escanea el QR y abre el enlace en el navegador del PDA.
                <br />
                (Google Chrome u otro)
              </p>
            </li>
            <li>
              <span className="pda-step-number">
                <Block />
              </span>
              <p>
                Dale clic al icono{' '}
                <span className="pda-browser-menu">
                  <Block />
                </span>{' '}
                y dale a <strong>Instalar y crear acceso directo.</strong>
              </p>
            </li>
          </ol>
        </div>
        <div className="pda-card pda-pair-card">
          <h2>Vincular PDA a la empresa</h2>
          <div className="pda-qr-area">
            <Block className="skeleton-qr" />
          </div>
          <dl className="pda-pair-details">
            <dt>Empresa</dt>
            <dd>
              <Block />
            </dd>
            <dt>Vence</dt>
            <dd>
              <Block />
            </dd>
          </dl>
          <span className="pda-action pda-regenerate">
            <Block className="skeleton-filter-icon" />
            Generar QR
          </span>
        </div>
      </div>
    </div>
  )
}

export function CampaignPageSkeleton({ seccion }) {
  const workers = ['cosechadores', 'jaberos', 'supervisores'].includes(seccion)
  const app = ['app', 'dispositivos'].includes(seccion)
  const report = ['produccion', 'rendimiento'].includes(seccion)
  return (
    <div
      className="harvest-campaign-page loading-state skeleton campaign-content-skeleton"
      role="status"
      aria-busy="true"
    >
      <span className="sr-only">Cargando Cosecha…</span>
      <div className="cosecha-heading" aria-hidden="true">
        <h1>Cosecha</h1>
        <Block className="skeleton-control" />
      </div>
      <div className="campaign-container" aria-hidden="true" inert>
        <div className="campaign-main-tabs">
          {[1, 2, 3, 4].map((i) => (
            <button
              key={i}
              className={i === 4 ? 'campaign-app-tab' : undefined}
              disabled
            >
              <Block className="skeleton-circle" />
            </button>
          ))}
        </div>
        <div className="campaign-sub-tabs">
          {Array.from({ length: app || report ? 2 : 3 }, (_, i) => (
            <a key={i}>
              <Block className="skeleton-filter-icon" />
            </a>
          ))}
        </div>
        <div className="campaign-body">
          {app ? (
            <AppCosechaSkeleton dispositivos={seccion === 'dispositivos'} />
          ) : seccion === 'generar' ? (
            <CampaignGenerationSkeleton />
          ) : report ? (
            <CampaignReportPageSkeleton ranking={seccion === 'rendimiento'} />
          ) : (
            <>
              <h2>
                <Block className="skeleton-card-heading" />
              </h2>
              <CampaignListSkeleton
                trabajadores={workers}
                asignados={seccion === 'asignaciones'}
              />
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export function CampaignGenerationSkeleton() {
  return (
    <div
      className="loading-state skeleton campaign-content-skeleton"
      role="status"
      aria-busy="true"
    >
      <span className="sr-only">Cargando generación de tickets…</span>
      <div className="campaign-generation" aria-hidden="true">
        <h2 className="campaign-generation-title">
          Generación e impresión de lotes de tickets
        </h2>
        <div className="campaign-generation-controls">
          {[1, 2, 3].map((step) => (
            <div
              className={`campaign-step ${step === 3 ? 'campaign-print-step' : ''}`}
              key={step}
            >
              <span className="campaign-step-number">
                <Block />
              </span>
              {step < 3 && (
                <label>
                  {step === 1 ? 'Cantidad total de tickets' : 'Tickets por lote'}
                  <span className="campaign-number">
                    <Block />
                  </span>
                </label>
              )}
            </div>
          ))}
        </div>
        <div className="campaign-ticket-preview">
          <h3>Vista previa</h3>
          <Block className="campaign-preview-frame" />
        </div>
        <div className="campaign-generation-completion">
          <div className="campaign-step campaign-confirm-step">
            <span className="campaign-step-number">
              <Block />
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

export function CampaignReportSkeleton({ ranking = false }) {
  const labels = ranking
    ? [
        'Cosechadores activos',
        'Promedio por cosechador',
        'Mayor rendimiento',
        'Total cosechado'
      ]
    : ['Total jabas', 'Jabas hoy', 'Promedio diario', 'Días de producción']
  return (
    <div
      className="loading-state skeleton campaign-content-skeleton"
      role="status"
      aria-busy="true"
    >
      <span className="sr-only">Cargando reporte…</span>
      <div aria-hidden="true">
        <div className="campaign-report-metrics">
          {labels.map((label) => (
            <article key={label}>
              <h3>{label}</h3>
              <strong>
                <Block />
              </strong>
            </article>
          ))}
        </div>
        <section
          className="campaign-report-section"
          data-report-type={ranking ? 'ranking' : 'production'}
        >
          <h3>{ranking ? 'Ranking' : 'Evolución'}</h3>
          {ranking ? (
            <div className="campaign-ranking">
              <ol className="campaign-podium">
                {[2, 1, 3].map((i) => (
                  <li key={i} className={`podium-place podium-place-${i}`}>
                    <Block className="podium-name" />
                    <Block className="podium-column" />
                  </li>
                ))}
              </ol>
              <div className="campaign-ranking-results">
                <ol className="campaign-ranking-list">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <li key={i}>
                      <Block />
                      <Block />
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          ) : (
            <figure className="campaign-evolution">
              <div className="campaign-evolution-axis">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Block key={i} />
                ))}
              </div>
              <div className="campaign-evolution-scroll">
                <ol
                  className="campaign-evolution-bars"
                  style={{
                    gridTemplateColumns:
                      'repeat(8, minmax(calc(90 * var(--owner-scale)), 1fr))'
                  }}
                >
                  {[24, 38, 55, 75, 92, 67, 46, 29].map((h, i) => (
                    <li key={i}>
                      <Block className={`skeleton-bar-${h}`} />
                    </li>
                  ))}
                </ol>
              </div>
            </figure>
          )}
        </section>
      </div>
    </div>
  )
}

export function CampaignReportPageSkeleton({ ranking = false }) {
  return (
    <section className="campaign-report">
      <div className="campaign-report-toolbar" aria-hidden="true">
        <h2>{ranking ? 'Rendimiento' : 'Producción'}</h2>
        <Block className="campaign-report-select skeleton-control" />
        {!ranking && <Block className="campaign-report-select skeleton-control" />}
        <Block className="campaign-report-period skeleton-control" />
      </div>
      <CampaignReportSkeleton ranking={ranking} />
    </section>
  )
}

export function CampaignListSkeleton({ trabajadores = false, asignados = false }) {
  const cols = trabajadores
    ? ['DNI', 'Nombre', 'Estado', 'Fecha y hora de inicio']
    : asignados
      ? ['Lote', 'Cosechador', 'Tickets', 'Fecha y hora de asignación']
      : ['Lote', 'Tickets', 'Fecha y hora']
  const widths = trabajadores
    ? ['12.1%', '33%', '23.5%', '31.4%']
    : asignados
      ? ['20%', '27%', '16%', '37%']
      : ['32%', '35%', '33%']
  return (
    <div
      className={`loading-state skeleton campaign-content-skeleton ${trabajadores ? 'campaign-workers' : 'campaign-lots'}`}
      role="status"
      aria-busy="true"
    >
      <span className="sr-only">Cargando tabla…</span>
      <div className="campaign-table-filters" aria-hidden="true" inert>
        <label className="campaign-table-search">
          <span>{trabajadores ? 'Trabajador' : 'Lote'}</span>
          <Block className="skeleton-control" />
        </label>
        {!asignados && (
          <label className="campaign-table-state">
            <span>{trabajadores ? 'Estado' : 'Asignación'}</span>
            <Block className="skeleton-control" />
          </label>
        )}
        <div className="campaign-table-period">
          <span>Fecha</span>
          <Block className="skeleton-control" />
        </div>
        <button disabled>Buscar</button>
        <button className="campaign-table-refresh" disabled>
          <Block className="skeleton-filter-icon" />
        </button>
      </div>
      <SkeletonTable
        columns={cols.map((header, i) => ({ key: i, header, width: widths[i] }))}
        tableClassName={trabajadores ? 'campaign-workers-table' : 'campaign-lots-table'}
        rows={10}
        reserveRows={10}
        pagination
      />
    </div>
  )
}
