import { useEffect, useId, useRef, useState } from 'react'
import { Link, NavLink, useSearchParams } from 'react-router'
import { Icon } from './Ui.jsx'
import { ReportLink } from './ReportLink.jsx'
import { HomeIcon, homeLogo } from './HomeAssets.jsx'
import harvestIcon from '../assets/owner/avocado.svg'
import { OwnerIcon, ownerLogo } from './OwnerAssets.jsx'

const collections = [
  { id: 'inicio', name: 'Inicio', icon: 'home', paths: ['/'] },
  {
    id: 'modulos',
    name: 'Módulos',
    icon: 'layers',
    paths: ['/modulos', '/cosecha', '/cosecha/app', '/reportes']
  },
  {
    id: 'configuracion',
    name: 'Configuración',
    icon: 'settings',
    paths: ['/configuracion']
  }
]
const children = { '/configuracion': [['usuarios', 'Usuarios y accesos']] }
const belongs = (path, base) =>
  base === '/' ? path === '/' : path === base || path.startsWith(base + '/')

function NavigationModules({
  rutas,
  path,
  onNavigate,
  puedeGenerar,
  puedeConsultarCosecha
}) {
  const [params] = useSearchParams()
  const campania = params.get('campania')
  const query = campania ? '?campania=' + encodeURIComponent(campania) : ''
  const cosechaOperativa = rutas.some((r) => r.path === '/cosecha')
  const harvest = cosechaOperativa || rutas.some((r) => r.path === '/cosecha/app')
  const destino = !cosechaOperativa
    ? '/cosecha/app'
    : puedeGenerar
      ? '/cosecha/generar'
      : puedeConsultarCosecha
        ? '/cosecha/lotes'
        : '/cosecha/trabajadores'
  return (
    <div className="navigation-modules">
      {harvest ? (
        <div
          className={`navigation-module harvest-navigation ${belongs(path, '/cosecha') ? 'is-active-module' : ''}`}
        >
          <NavLink
            className="navigation-module-link"
            to={destino + query}
            onClick={onNavigate}
          >
            <img className="sidebar-asset" src={harvestIcon} alt="" />
            <span>Cosecha</span>
          </NavLink>
        </div>
      ) : rutas.some((r) => r.path === '/reportes') ? (
        <ReportLink
          className="navigation-module-link"
          to={'/reportes/resumen' + query}
          onClick={onNavigate}
        >
          <img className="sidebar-asset" src={harvestIcon} alt="" />
          <span>Cosecha</span>
        </ReportLink>
      ) : null}
    </div>
  )
}

export function NavigationRail({
  navegacion,
  path,
  mobileOpen,
  onClose,
  ownerDesign = false,
  mostrarCatalogo = false,
  soloOwner = false,
  puedeGenerar = false,
  puedeConsultarCosecha = true
}) {
  // Sólo se agrupan rutas ya autorizadas por Application; no se resuelven permisos aquí.
  const available = collections
    .map((c) => ({
      ...c,
      routes: c.paths.map((p) => navegacion.find((r) => r.path === p)).filter(Boolean)
    }))
    .filter((c) => c.routes.length || (c.id === 'modulos' && mostrarCatalogo))
  const active =
    available.find((c) => c.routes.some((r) => belongs(path, r.path)))?.id ?? 'inicio'
  const [selection, setSelection] = useState(active)
  const [expanded, setExpanded] = useState(false)
  const [expandedBy, setExpandedBy] = useState('focus-expanded')
  const [pinned, setPinned] = useState(false)
  const container = useRef(null),
    rail = useRef(null),
    lastTrigger = useRef(null)
  const id = useId()
  const current = available.find((c) => c.id === selection) ?? available[0]
  const open = current?.id !== 'inicio' && (expanded || pinned || mobileOpen)

  useEffect(() => {
    setSelection(active)
    setExpanded(false)
  }, [path, active])

  useEffect(() => {
    if (!mobileOpen) return
    if (selection === 'inicio')
      setSelection(available.find((c) => c.id !== 'inicio')?.id ?? 'inicio')
    const previous = document.activeElement,
      root = container.current
    const focusable = () =>
      [...root.querySelectorAll('a, button')].filter(
        (el) =>
          !el.disabled && !el.closest('[hidden]') && !el.classList.contains('rail-pin')
      )
    focusable()[0]?.focus()
    const keydown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
      if (e.key === 'Tab') {
        const items = focusable(),
          first = items[0],
          last = items.at(-1)
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last?.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first?.focus()
        }
      }
    }
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    root.addEventListener('keydown', keydown)
    return () => {
      root.removeEventListener('keydown', keydown)
      document.body.style.overflow = overflow
      previous?.focus()
    }
  }, [mobileOpen, onClose])

  function reveal(collection, trigger, reason) {
    setSelection(collection.id)
    setExpanded(true)
    setExpandedBy(reason)
    lastTrigger.current = trigger
  }
  function home() {
    setSelection('inicio')
    setExpanded(false)
    setPinned(false)
  }
  function closePanel() {
    // El foco permanece en el control de la rail tras Escape; no reabrir por ese foco.
    lastTrigger.current?.focus()
    setExpanded(false)
    setPinned(false)
  }
  function railKeys(event) {
    const items = [...rail.current.querySelectorAll('a, button')]
    const index = items.indexOf(document.activeElement)
    let next
    if (event.key === 'ArrowDown') next = (index + 1) % items.length
    if (event.key === 'ArrowUp') next = (index - 1 + items.length) % items.length
    if (event.key === 'Home') next = 0
    if (event.key === 'End') next = items.length - 1
    if (next != null) {
      event.preventDefault()
      items[next]?.focus()
    }
  }
  return (
    <aside
      ref={container}
      id="portal-nav"
      className={`suite-navigation figma-navigation ${open ? 'is-expanded' : ''} ${mobileOpen ? 'is-open' : ''} ${pinned ? 'is-pinned' : ''}`}
      data-state={
        mobileOpen
          ? 'mobile-drawer'
          : pinned
            ? 'pinned'
            : open
              ? expandedBy
              : 'collapsed'
      }
      role={mobileOpen ? 'dialog' : undefined}
      aria-modal={mobileOpen || undefined}
      aria-label="Menú del Portal"
      onMouseLeave={(event) => {
        if (
          event.relatedTarget instanceof Node &&
          container.current?.contains(event.relatedTarget)
        )
          return
        if (!container.current?.contains(document.activeElement)) setExpanded(false)
      }}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setExpanded(false)
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape' && !mobileOpen) {
          e.preventDefault()
          closePanel()
        }
      }}
    >
      {mobileOpen && (
        <button
          className="drawer-close quiet"
          onClick={onClose}
          aria-label="Cerrar menú"
        >
          <Icon name="close" /> Cerrar
        </button>
      )}
      <nav aria-label="Navegación principal" className="suite-nav-content">
        <div className="navigation-rail">
          <Link
            className="rail-wordmark"
            to="/"
            aria-label="GesGROW · Inicio"
            onClick={onClose}
          >
            <img
              className="home-logo"
              src={ownerDesign ? ownerLogo : homeLogo}
              alt=""
            />
          </Link>
          <div ref={rail} className="rail-collections" onKeyDown={railKeys}>
            {available.map((c) => (
              <div className="rail-entry" key={c.id}>
                {c.id === 'inicio' ? (
                  <NavLink
                    to="/"
                    end
                    className={`rail-collection ${active === c.id ? 'is-active' : ''}`}
                    aria-label="Inicio"
                    onMouseEnter={home}
                    onFocus={home}
                    onClick={() => {
                      home()
                      onClose()
                    }}
                  >
                    {ownerDesign ? <OwnerIcon name="home" /> : <HomeIcon name="home" />}
                  </NavLink>
                ) : c.id === 'modulos' && soloOwner ? (
                  <NavLink
                    to="/modulos"
                    className={`rail-collection ${active === c.id ? 'is-active' : ''}`}
                    aria-label="Módulos"
                    onMouseEnter={home}
                    onFocus={home}
                    onClick={() => {
                      home()
                      onClose()
                    }}
                  >
                    <OwnerIcon name="layers" />
                  </NavLink>
                ) : (
                  <button
                    className={`rail-collection ${active === c.id ? 'is-active' : ''} ${open && selection === c.id ? 'is-selected' : ''}`}
                    aria-label={c.name}
                    aria-expanded={open && selection === c.id}
                    aria-controls={id}
                    aria-describedby={`${id}-${c.id}`}
                    aria-current={active === c.id ? 'true' : undefined}
                    onMouseEnter={(e) => reveal(c, e.currentTarget, 'hover-expanded')}
                    onFocus={(e) => reveal(c, e.currentTarget, 'focus-expanded')}
                    onClick={(e) => reveal(c, e.currentTarget, 'focus-expanded')}
                  >
                    {ownerDesign ? (
                      <OwnerIcon name={c.icon} />
                    ) : (
                      <HomeIcon name={c.icon} />
                    )}
                    <span className="sr-only">{c.name}</span>
                  </button>
                )}
                {c.id !== 'inicio' && (
                  <span className="rail-tooltip" role="tooltip" id={`${id}-${c.id}`}>
                    {c.name}
                  </span>
                )}
              </div>
            ))}
          </div>
          <button
            className="rail-pin quiet icon-button"
            aria-label={pinned ? 'Contraer navegación' : 'Fijar navegación'}
            aria-pressed={pinned}
            onClick={() => {
              if (!pinned && current?.id === 'inicio')
                setSelection(available.find((c) => c.id !== 'inicio')?.id ?? 'inicio')
              setPinned(!pinned)
              setExpanded(false)
            }}
          >
            <Icon name="panel" />
          </button>
          <span className="rail-caption" aria-hidden="true">
            GesGROW
          </span>
        </div>
        <section
          className="navigation-panel"
          onMouseEnter={() => {
            if (current?.id !== 'inicio') setExpanded(true)
          }}
          id={id}
          hidden={!open}
          aria-label={current?.name}
        >
          <header className="navigation-panel-heading">
            <strong>{current?.name}</strong>
          </header>
          {current?.id === 'configuracion' ? (
            <div className="sidebar-settings-links">
              {children['/configuracion'].map(([sub, name]) => (
                <NavLink
                  key={sub}
                  to={`/configuracion/${sub}`}
                  onClick={() => {
                    setExpanded(false)
                    onClose()
                  }}
                >
                  {name}
                </NavLink>
              ))}
            </div>
          ) : mostrarCatalogo && !current?.routes.length ? (
            <div className="sidebar-settings-links">
              <Link
                to="/modulos"
                onClick={() => {
                  setExpanded(false)
                  onClose()
                }}
              >
                Módulos adquiridos
              </Link>
            </div>
          ) : (
            current?.id !== 'inicio' && (
              <>
                {current?.routes.some((r) => r.path === '/modulos') && (
                  <div className="sidebar-settings-links">
                    <NavLink to="/modulos" onClick={onClose}>
                      Módulos adquiridos
                    </NavLink>
                  </div>
                )}
                <NavigationModules
                  key={current?.id}
                  rutas={current?.routes ?? []}
                  path={path}
                  puedeGenerar={puedeGenerar}
                  puedeConsultarCosecha={puedeConsultarCosecha}
                  onNavigate={() => {
                    setExpanded(false)
                    onClose()
                  }}
                />
              </>
            )
          )}
        </section>
      </nav>
    </aside>
  )
}
