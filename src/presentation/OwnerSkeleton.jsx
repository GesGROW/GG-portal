import { SkeletonBlock as Block } from './Skeleton.jsx'
import { OwnerIcon } from './OwnerAssets.jsx'
import './owner-modules.css'
import './owner-users-access.css'
import './portal-tables.css'
import './owner-skeleton.css'

export function ColumnasUsuarios({ vacio = false }) {
  const columnas = vacio
    ? [
        ['Nombre', '28.7%'],
        ['Correo', '50.5%'],
        ['Activo', '20.8%']
      ]
    : [
        ['Nombre', '33.5%'],
        ['Correo', '34.7%'],
        ['Rol', '15.1%'],
        ['Estado', '16.7%']
      ]
  return (
    <>
      <colgroup>
        {columnas.map(([nombre, width]) => (
          <col key={nombre} style={{ width }} />
        ))}
      </colgroup>
      <thead>
        <tr>
          {columnas.map(([nombre]) => (
            <th key={nombre} scope="col">
              {nombre}
            </th>
          ))}
        </tr>
      </thead>
    </>
  )
}

export function ModulosOwnerSkeleton({ pagina = false }) {
  const contenido = (
    <div
      className="loading-state skeleton owner-content-skeleton owner-modules-skeleton"
      role="status"
      aria-busy="true"
    >
      <span className="sr-only">Cargando módulos…</span>
      <div aria-hidden="true" inert>
        <div className="owner-modules-acquired">
          <div className="owner-module-card">
            <Block className="owner-skeleton-icon" />
            <Block className="owner-skeleton-module-label" />
          </div>
        </div>
        <div className="owner-module-purchase-row">
          <div className="owner-module-purchase">
            <Block />
          </div>
        </div>
        <section className="owner-module-catalog">
          <h2>Módulos</h2>
          <div className="owner-module-card">
            <Block className="owner-skeleton-icon" />
            <Block className="owner-skeleton-module-label" />
          </div>
        </section>
      </div>
    </div>
  )
  return pagina ? (
    <section className="owner-modules">
      <h1>Módulos Adquiridos</h1>
      {contenido}
    </section>
  ) : (
    contenido
  )
}

export function UsuariosAccesosSkeleton({ pagina = false }) {
  const contenido = (
    <div
      className="loading-state skeleton owner-content-skeleton owner-users-skeleton"
      role="status"
      aria-busy="true"
    >
      <span className="sr-only">Cargando usuarios…</span>
      <section aria-hidden="true" inert>
        <h2 className="owner-users-module">
          <OwnerIcon name="avocado" />
          <span>Cosecha</span>
        </h2>
        <div className="owner-users-table-wrap">
          <div className="owner-users-table-region">
            <table className="owner-users-table portal-data-table">
              <ColumnasUsuarios />
              <tbody>
                {[1, 2].map((fila) => (
                  <tr key={fila}>
                    {[1, 2, 3, 4].map((i) => (
                      <td key={i}>
                        <Block />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="owner-users-invite">
            <OwnerIcon name="plus" />
            <span className="skeleton-block owner-skeleton-invite-copy">
              Invita a participar a un usuario
            </span>
          </div>
        </div>
      </section>
    </div>
  )
  return pagina ? (
    <section className="owner-users-access">
      <h1>Usuarios y accesos</h1>
      {contenido}
    </section>
  ) : (
    contenido
  )
}
