import { PanelLateral } from './PanelLateral.jsx'
import { DataTable } from './DataTable.jsx'
import { StatusBadge } from './StatusBadge.jsx'
import { Aviso, Carga } from './GestionUi.jsx'
import { usePaginaCampania } from './usePaginaCampania.js'

function TicketsDelLote({ servicio, campaniaId, lote, asignados }) {
  const { consulta, filas, paginacion } = usePaginaCampania(
    (offset) => servicio.ticketsLote(campaniaId, lote.id, offset),
    [servicio, campaniaId, lote.id]
  )
  return (
    <Carga consulta={consulta}>
      {() => (
        <DataTable
          label={`Tickets del lote ${lote.codigo ?? lote.id}`}
          rowKey="codigo"
          columns={[
            { key: 'codigo', header: 'Código' },
            ...(asignados
              ? [
                  {
                    key: 'estado',
                    header: 'Estado',
                    render: (t) => (
                      <StatusBadge
                        tone={t.estado === 'UTILIZADO' ? 'neutral' : 'available'}
                      >
                        {t.estado === 'UTILIZADO' ? 'Utilizado' : 'Disponible'}
                      </StatusBadge>
                    )
                  }
                ]
              : [])
          ]}
          data={filas}
          pagination={
            paginacion.total > paginacion.pageSize
              ? { ...paginacion, label: 'Paginación de tickets' }
              : false
          }
          emptyState="Este lote no tiene tickets."
        />
      )}
    </Carga>
  )
}

export function TicketsLotePanel({
  servicio,
  campaniaId,
  lote,
  asignados,
  indice,
  total,
  cargando,
  error,
  onRetry,
  onMove,
  onClose
}) {
  return (
    <PanelLateral
      titulo={lote ? `Lote de tickets: ${lote.codigo ?? lote.id}` : 'Lote de tickets'}
      onClose={onClose}
      acciones={
        <>
          <button
            type="button"
            aria-label="Anterior lote"
            disabled={cargando || Boolean(error) || indice <= 0}
            onClick={() => onMove(indice - 1)}
          >
            Anterior
          </button>
          <button
            type="button"
            aria-label="Siguiente lote"
            disabled={cargando || Boolean(error) || indice >= total - 1}
            onClick={() => onMove(indice + 1)}
          >
            Siguiente
          </button>
        </>
      }
    >
      <h3>Tickets</h3>
      {error ? (
        <>
          <Aviso error={error} />
          <button type="button" onClick={onRetry}>
            Reintentar lote
          </button>
        </>
      ) : cargando || !lote ? (
        <p role="status">Cargando lote…</p>
      ) : (
        <TicketsDelLote
          key={lote.id}
          servicio={servicio}
          campaniaId={campaniaId}
          lote={lote}
          asignados={asignados}
        />
      )}
    </PanelLateral>
  )
}
