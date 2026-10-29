export function SkeletonBlock({ className = '' }) {
  return <i className={`skeleton-block ${className}`} />
}
const Block = SkeletonBlock

function Cards({ count = 4 }) {
  return (
    <div className="skeleton-cards" style={{ '--skeleton-columns': count }}>
      {Array.from({ length: count }, (_, i) => (
        <div className="skeleton-card" key={i}>
          <Block className="skeleton-label" />
          <Block className="skeleton-value" />
        </div>
      ))}
    </div>
  )
}

function Summary({ campaigns = true }) {
  return (
    <>
      <div className={campaigns ? 'skeleton-summary' : 'skeleton-summary-data-cards'}>
        <Cards count={2} />
        {campaigns && (
          <div className="skeleton-card skeleton-campaigns">
            <Block className="skeleton-label" />
            <Block />
            <Block />
            <Block />
          </div>
        )}
      </div>
      <div className="skeleton-stat-strip">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i}>
            <Block className="skeleton-circle" />
            <div>
              <Block />
              <Block className="skeleton-value" />
            </div>
          </div>
        ))}
      </div>
    </>
  )
}

function Table({
  columns,
  rows = 5,
  tableClassName = '',
  pagination = false,
  reserveRows = 0
}) {
  const cols = columns ?? [1, 2, 3, 4].map((key) => ({ key }))
  return (
    <div aria-hidden="true" inert>
      <div
        className="table-scroll"
        data-reserve-rows={reserveRows || undefined}
        style={reserveRows ? { '--table-reserved-rows': reserveRows } : undefined}
      >
        <table className={`portal-data-table ${tableClassName}`}>
          <colgroup>
            {cols.map((col) => (
              <col key={col.key} style={{ width: col.width }} />
            ))}
          </colgroup>
          <thead>
            <tr>
              {cols.map((col) => (
                <th key={col.key}>{col.header ?? <Block />}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: rows }, (_, row) => (
              <tr key={row}>
                {cols.map((col) => (
                  <td key={col.key}>
                    <Block />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {pagination && (
        <TablePagination
          total={Math.max(1, rows)}
          pageSize={Math.max(1, rows)}
          showSummary
          onPageChange={() => {}}
        />
      )}
    </div>
  )
}

export function SkeletonTable(props) {
  return <Skeleton {...props} variant="table" />
}

export function Skeleton({
  text = 'Cargando gestión…',
  variant = 'table',
  page = false,
  ...tableProps
}) {
  return (
    <div
      className={`loading-state skeleton skeleton-${variant} ${page ? 'skeleton-page' : ''}`}
      role="status"
      aria-busy="true"
    >
      <span className="sr-only">{text}</span>
      <div className="skeleton-layout" aria-hidden="true">
        {page && (
          <div className="skeleton-heading">
            <Block className="skeleton-title" />
            <Block className="skeleton-control" />
          </div>
        )}
        {variant === 'home' && <Cards count={2} />}
        {['home', 'summary', 'summary-data'].includes(variant) ? (
          <Summary campaigns={variant !== 'summary-data'} />
        ) : variant === 'report' ? (
          <>
            <Cards />
            <Block className="skeleton-label" />
            <div className="skeleton-chart">
              {[24, 38, 55, 75, 92, 67, 46, 29].map((height, i) => (
                <Block key={i} className={`skeleton-bar skeleton-bar-${height}`} />
              ))}
            </div>
          </>
        ) : variant === 'generation' ? (
          <div className="skeleton-steps">
            {[1, 2, 3].map((step) => (
              <div key={step}>
                <Block className="skeleton-circle" />
                <div>
                  <Block className="skeleton-label" />
                  <Block className="skeleton-control" />
                </div>
              </div>
            ))}
          </div>
        ) : variant === 'form' ? (
          <div className="skeleton-form">
            {[1, 2, 3].map((field) => (
              <div key={field}>
                <Block className="skeleton-label" />
                <Block className="skeleton-control" />
              </div>
            ))}
          </div>
        ) : variant === 'cards' ? (
          <Cards count={3} />
        ) : variant === 'compact' ? (
          <div className="skeleton-copy">
            <Block />
            <Block />
            <Block />
          </div>
        ) : (
          <Table {...tableProps} />
        )}
      </div>
    </div>
  )
}
import { TablePagination } from './TablePagination.jsx'
