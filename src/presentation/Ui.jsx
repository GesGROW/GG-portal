import { Select } from './Select.jsx'
import { useEffect, useId, useRef, useState } from 'react'
import { applyTheme, readTheme } from '../theme.js'
import { HomeIcon } from './HomeAssets.jsx'
import { OwnerIcon } from './OwnerAssets.jsx'

// Una sola familia lineal: cuadrícula 24, trazo 1.75 y extremos redondeados.
const paths = {
  home: 'M3 10 12 3l9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z',
  campaign: 'M4 6h16v15H4ZM8 3v6m8-6v6M4 11h16m-12 4h3m2 0h3',
  people:
    'M16 21v-3a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v3m20 0v-3a4 4 0 0 0-3-3.87M9 10a4 4 0 1 0 0-8 4 4 0 0 0 0 8m8-7.87a4 4 0 0 1 0 7.75',
  'user-round-check':
    'M2 21a8 8 0 0 1 13.292-6M15 8a5 5 0 1 1-10 0 5 5 0 0 1 10 0m1 11 2 2 4-4',
  package:
    'M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73ZM12 22V12M3.29 7 12 12l8.71-5M7.5 4.27l9 5.15',
  'grid-2x2-x':
    'M12 3v17a1 1 0 0 1-1 1H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v6a1 1 0 0 1-1 1H3m13.5 4.5 5 5m-5 0 5-5',
  'calendar-check':
    'M8 2v3m8-3v3M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2ZM3 9h18M9 15l2 2 4-4',
  'file-check':
    'M10.5 22H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.706.706l3.588 3.588A2.4 2.4 0 0 1 20 8v6M14 2v5a1 1 0 0 0 1 1h5m-6 12 2 2 4-4',
  'file-minus':
    'M20 14V8a2.4 2.4 0 0 0-.706-1.706l-3.588-3.588A2.4 2.4 0 0 0 14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12M14 2v5a1 1 0 0 0 1 1h5m-6 10h6',
  farm: 'M3 5h18v14H3ZM3 12h18M10 5v7m4 0v7M6 8h1m10 7h1',
  harvest: 'm3 7 9-4 9 4v12l-9 3-9-3Zm0 0 9 4 9-4m-9 4v11M7 5l10 4',
  reports: 'M4 3v18h17M8 16v-5m5 5V7m5 9V4',
  settings:
    'm9 3-1 3-3 1-2 3 2 2v3l3 2 1 4h6l1-4 3-2v-3l2-2-2-3-3-1-1-3Zm6 9a3 3 0 1 1-6 0 3 3 0 0 1 6 0',
  menu: 'M4 6h16M4 12h16M4 18h16',
  close: 'm6 6 12 12M6 18 18 6',
  panel: 'M3 4h18v16H3ZM9 4v16m4-11 3 3-3 3',
  theme:
    'M12 3v2m0 14v2M3 12h2m14 0h2M5.6 5.6 7 7m10 10 1.4 1.4m0-12.8L17 7M7 17l-1.4 1.4M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
  arrow: 'M4 12h16m-6-6 6 6-6 6',
  refresh: 'M20 7v5h-5M4 17v-5h5m-4-5a8 8 0 0 1 13-2l2 3M4 16l2 3a8 8 0 0 0 13-2',
  download: 'M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5',
  clock: 'M12 7v5l3 2M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',
  info: 'M12 11v6m0-10v1M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',
  search: 'm21 21-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0',
  check: 'm5 12 4 4L19 6',
  empty: 'M4 5h16v15H4ZM4 14h5l2 3h2l2-3h5M8 9h8',
  chevron: 'm6 9 6 6 6-6',
  logout: 'M9 4H4v16h5m5-13 5 5-5 5m-6-5h11',
  weather:
    'M8 3v2M3 8H1m3-4 2 2m8-2-2 2M8 13a5 5 0 1 1 5-5m-7 9a4 4 0 0 1 1-8 6 6 0 0 1 11 3 4 4 0 0 1 0 8H7',
  compare: 'M6 3v18m12-18v18M3 8h6m6 8h6M3 8l3-3 3 3m6 8 3 3 3-3'
}
export const routeIcon = (path) =>
  ({
    '/': 'home',
    '/cosecha': 'harvest',
    '/reportes': 'reports',
    '/configuracion': 'settings'
  })[path] ?? 'farm'
export function Icon({ name, ...props }) {
  return (
    <svg
      className="icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d={paths[name] ?? paths.farm} />
    </svg>
  )
}
export function ThemeSwitcher({ homeDesign = false }) {
  const theme = readTheme()
  const id = useId()
  useEffect(() => {
    applyTheme()
  }, [])
  return (
    <label className="theme-switcher" htmlFor={id}>
      {homeDesign ? <HomeIcon name="moon" /> : <Icon name="theme" />}
      <span className="sr-only">Tema</span>
      <Select
        id={id}
        value={theme}
        disabled
        title="El modo claro está desactivado temporalmente"
      >
        <option value="light" disabled>
          Claro
        </option>
        <option value="dark">Oscuro</option>
      </Select>
    </label>
  )
}
export function UserMenu({
  usuario,
  onLogout,
  homeDesign = false,
  ownerDesign = false,
  empresas = [],
  empresaActiva = '',
  onEmpresa,
  ocupado = false
}) {
  const [open, setOpen] = useState(false)
  const id = useId(),
    container = useRef(null),
    trigger = useRef(null),
    action = useRef(null)
  useEffect(() => {
    if (!open) return
    action.current?.focus()
    const outside = (event) => {
      if (!container.current?.contains(event.target)) setOpen(false)
    }
    const escape = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        setOpen(false)
        trigger.current?.focus()
      }
    }
    document.addEventListener('pointerdown', outside)
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('pointerdown', outside)
      document.removeEventListener('keydown', escape)
    }
  }, [open])
  return (
    <div
      className="user-menu"
      ref={container}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false)
      }}
    >
      <button
        ref={trigger}
        className="user-menu-trigger quiet"
        aria-label="Menú de usuario"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen(!open)}
      >
        {!ownerDesign && (
          <span className="avatar" aria-hidden="true">
            {usuario?.nombre?.slice(0, 1)}
          </span>
        )}
        <span className="user-menu-name">
          {ownerDesign
            ? 'Cuenta'
            : homeDesign
              ? usuario?.nombre?.trim().split(/\s+/)[0]
              : usuario?.nombre}
        </span>
        {ownerDesign ? (
          <OwnerIcon name="chevron" />
        ) : homeDesign ? (
          <HomeIcon name="chevron" />
        ) : (
          <Icon name="chevron" />
        )}
      </button>
      {open && (
        <div
          className="user-menu-panel"
          id={id}
          role="region"
          aria-label="Cuenta de usuario"
        >
          <small>Cuenta de usuario</small>
          <strong>{usuario?.nombre}</strong>
          <p>{usuario?.email}</p>
          {ownerDesign && empresas.length === 1 && <p>{empresas[0].nombre}</p>}
          {empresas.length > 1 && (
            <label className="account-company-switch">
              Empresa activa
              <Select
                value={empresaActiva}
                disabled={ocupado}
                onChange={(event) => {
                  void onEmpresa?.(event.target.value)
                  setOpen(false)
                }}
              >
                {!empresaActiva && <option value="">Validando…</option>}
                {empresas.map((empresa) => (
                  <option key={empresa.id} value={empresa.id}>
                    {empresa.nombre}
                  </option>
                ))}
              </Select>
            </label>
          )}
          <button ref={action} className="quiet" onClick={onLogout}>
            <Icon name="logout" />
            Cerrar sesión
          </button>
        </div>
      )}
    </div>
  )
}
export { Skeleton } from './Skeleton.jsx'
export { StatusBadge } from './StatusBadge.jsx'
export function EmptyState({ children }) {
  return (
    <div className="empty-state" role="status">
      <Icon name="empty" />
      <p>{children}</p>
    </div>
  )
}
export function ManagementPageHeader({
  eyebrow,
  icon,
  title,
  description,
  action,
  children
}) {
  return (
    <section className="management-page-header">
      <div className="management-page-header-main">
        {icon && (
          <span className="management-page-icon" aria-hidden="true">
            <Icon name={icon} />
          </span>
        )}
        <div className="management-page-copy">
          {eyebrow && <span className="eyebrow">{eyebrow}</span>}
          <h1>{title}</h1>
          {description && <p>{description}</p>}
        </div>
      </div>
      {action && <div className="management-page-action">{action}</div>}
      {children && <div className="management-page-context">{children}</div>}
    </section>
  )
}
export function DetailHero({
  eyebrow,
  icon,
  title,
  description,
  status,
  facts = [],
  actions
}) {
  return (
    <section className="detail-hero">
      <div className="detail-hero-heading">
        {icon && (
          <span className="detail-hero-icon" aria-hidden="true">
            <Icon name={icon} />
          </span>
        )}
        <div>
          {eyebrow && <span className="eyebrow">{eyebrow}</span>}
          <div className="detail-hero-title-row">
            <h2>{title}</h2>
            {status}
          </div>
          {description && <p>{description}</p>}
        </div>
      </div>
      {facts.length > 0 && (
        <dl className="detail-hero-facts">
          {facts.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value ?? '—'}</dd>
            </div>
          ))}
        </dl>
      )}
      {actions && <div className="detail-hero-actions">{actions}</div>}
    </section>
  )
}
export { DataTable } from './DataTable.jsx'
export { TablePagination } from './TablePagination.jsx'
export function ChartCard({ title, context, children, className = '' }) {
  return (
    <section className={`chart-card ${className}`}>
      <div className="section-title">
        <div>
          <h2>{title}</h2>
          {context && <p className="muted">{context}</p>}
        </div>
      </div>
      {children}
    </section>
  )
}
