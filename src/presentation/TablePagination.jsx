function visiblePages(page, total) {
  const candidates = new Set([1, total, page - 1, page, page + 1])
  if (page <= 2) candidates.add(3)
  if (page >= total - 1) candidates.add(total - 2)
  const pages = [...candidates]
    .filter((value) => value >= 1 && value <= total)
    .sort((a, b) => a - b)
  const items = []
  for (const [index, value] of pages.entries()) {
    const previous = pages[index - 1]
    if (value - previous === 2) items.push(previous + 1)
    else if (value - previous > 2) items.push(`gap-${previous}`)
    items.push(value)
  }
  return items
}

export function TablePagination({
  total,
  offset = 0,
  pageSize = 50,
  onPageChange,
  label = 'Paginación de la tabla',
  showSummary = false
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const page = Math.max(1, Math.min(totalPages, Math.floor(offset / pageSize) + 1))
  return (
    <nav className="table-pagination" aria-label={label}>
      {showSummary && (
        <span className="table-pagination-summary">
          {total
            ? `Mostrando ${(page - 1) * pageSize + 1}-${Math.min(page * pageSize, total)} de ${total}`
            : 'Sin resultados'}
        </span>
      )}
      <span className="sr-only" role="status">
        Página {page} de {totalPages}
      </span>
      <div className="table-pagination-controls">
        <button
          type="button"
          className="table-pagination-button table-pagination-arrow"
          aria-label="Anterior"
          title="Página anterior"
          disabled={page === 1}
          onClick={() => onPageChange(page - 1)}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="m15 18-6-6 6-6" />
          </svg>
        </button>
        {visiblePages(page, totalPages).map((item) =>
          typeof item === 'number' ? (
            <button
              key={item}
              type="button"
              className="table-pagination-button"
              aria-label={`Página ${item}`}
              aria-current={item === page ? 'page' : undefined}
              onClick={() => {
                if (item !== page) onPageChange(item)
              }}
            >
              {item}
            </button>
          ) : (
            <span key={item} className="table-pagination-ellipsis" aria-hidden="true">
              …
            </span>
          )
        )}
        <button
          type="button"
          className="table-pagination-button table-pagination-arrow"
          aria-label="Siguiente"
          title="Página siguiente"
          disabled={page === totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="m9 6 6 6-6 6" />
          </svg>
        </button>
      </div>
    </nav>
  )
}
