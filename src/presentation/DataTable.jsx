import { useState } from 'react'
import { TablePagination } from './TablePagination.jsx'
import { StatusBadge } from './StatusBadge.jsx'
import './portal-tables.css'

const emptyLabels = new Set([
  '—',
  'Sin actividad',
  'Datos pendientes',
  'Sin asignar',
  'Sin campaña',
  'Sin acceso',
  'Sin módulos',
  'Sin rol activo',
  'Sin cosechador',
  'Sin actividad registrada'
])

// Cada columna define key, header y, opcionalmente, render(fila, índice),
// width, className, headerClassName, cellProps(fila, índice) y rowHeader.
// Las pantallas conservan la consulta y los filtros. pagination permite paginación remota.
export function DataTable({
  columns,
  data,
  rowKey = 'id',
  label = 'Tabla de datos',
  className = '',
  tableClassName,
  tableLabel,
  caption,
  captionClassName,
  rowClassName,
  onRowActivate,
  rowLabel,
  emptyState,
  pagination = true,
  pageSize = 50,
  actions,
  actionsHeader = 'Acciones'
}) {
  const [localPage, setLocalPage] = useState({ page: 1, signature: '' })
  const remote = typeof pagination === 'object' && pagination !== null
  const size = remote ? (pagination.pageSize ?? pageSize) : pageSize
  const signature = remote
    ? ''
    : JSON.stringify(
        data.map((row, index) =>
          typeof rowKey === 'function' ? rowKey(row, index) : row[rowKey]
        )
      )
  const page = localPage.signature === signature ? localPage.page : 1
  const offset = remote ? pagination.offset : (page - 1) * size
  const rows = remote || pagination === false ? data : data.slice(offset, offset + size)
  const tableColumns = actions
    ? [...columns, { key: '__actions', header: actionsHeader, render: actions }]
    : columns
  return (
    <>
      <div
        className={`table-scroll ${className}`.trim()}
        role="region"
        aria-label={label}
        tabIndex={0}
      >
        <table
          className={`portal-data-table ${tableClassName ?? ''}`.trim()}
          aria-label={tableLabel ?? (caption ? undefined : label)}
        >
          {caption && <caption className={captionClassName}>{caption}</caption>}
          {tableColumns.some((column) => column.width != null) && (
            <colgroup>
              {tableColumns.map((column) => (
                <col
                  key={column.key}
                  style={column.width == null ? undefined : { width: column.width }}
                />
              ))}
            </colgroup>
          )}
          <thead>
            <tr>
              {tableColumns.map((column) => (
                <th
                  key={column.key}
                  scope="col"
                  className={column.headerClassName ?? column.className}
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && emptyState && (
              <tr className="table-empty-row">
                <td colSpan={tableColumns.length}>{emptyState}</td>
              </tr>
            )}
            {rows.map((row, pageIndex) => {
              const index =
                remote || pagination === false ? pageIndex : offset + pageIndex
              return (
                <tr
                  key={typeof rowKey === 'function' ? rowKey(row, index) : row[rowKey]}
                  className={
                    typeof rowClassName === 'function'
                      ? rowClassName(row, index)
                      : rowClassName
                  }
                  tabIndex={onRowActivate ? 0 : undefined}
                  aria-label={
                    typeof rowLabel === 'function' ? rowLabel(row, index) : rowLabel
                  }
                  data-interactive={onRowActivate ? 'true' : undefined}
                  onClick={
                    onRowActivate
                      ? (event) => {
                          if (
                            event.defaultPrevented ||
                            event.target.closest(
                              'a, button, input, select, textarea, label, summary, [role="button"], [role="link"], [contenteditable]'
                            )
                          )
                            return
                          event.currentTarget.focus()
                          onRowActivate(row, index)
                        }
                      : undefined
                  }
                  onKeyDown={
                    onRowActivate
                      ? (event) => {
                          if (
                            event.target !== event.currentTarget ||
                            event.defaultPrevented ||
                            event.repeat
                          )
                            return
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault()
                            onRowActivate(row, index)
                          }
                        }
                      : undefined
                  }
                >
                  {tableColumns.map((column) => {
                    const Cell = column.rowHeader ? 'th' : 'td'
                    const content = column.render
                      ? column.render(row, index)
                      : (row[column.key] ?? '—')
                    const muted =
                      (typeof column.muted === 'function'
                        ? column.muted(row)
                        : column.muted) ||
                      (typeof content === 'string' && emptyLabels.has(content))
                    return (
                      <Cell
                        key={column.key}
                        scope={column.rowHeader ? 'row' : undefined}
                        className={column.className}
                        {...column.cellProps?.(row, index)}
                        data-muted={muted ? 'true' : undefined}
                        data-status={column.status ? 'true' : undefined}
                      >
                        {column.status ? (
                          <StatusBadge indicator>{content}</StatusBadge>
                        ) : (
                          content
                        )}
                      </Cell>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {pagination !== false && (
        <TablePagination
          label={remote ? pagination.label : `Paginación: ${label}`}
          total={remote ? pagination.total : data.length}
          offset={offset}
          pageSize={size}
          showSummary
          onPageChange={
            remote
              ? pagination.onPageChange
              : (next) => setLocalPage({ page: next, signature })
          }
        />
      )}
    </>
  )
}
