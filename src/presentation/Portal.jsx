import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useState,
  useSyncExternalStore
} from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { Icon, routeIcon, Skeleton, UserMenu } from './Ui.jsx'
import { NavigationRail } from './Navigation.jsx'
import { evaluarRuta } from '../application/rutas.js'
import { reportePublicado } from './rutasReportesHome.js'
import { Login } from './Login.jsx'
import { Registro } from './Registro.jsx'
import { CrearEmpresa } from './CrearEmpresa.jsx'
import { ActivacionCuenta } from './ActivacionCuenta.jsx'
import { OwnerHome } from './OwnerHome.jsx'
import { HomeSkeleton } from './HomeSkeleton.jsx'
import { ModulosOwner } from './ModulosOwner.jsx'
import { esOwnerSinOperacion } from '../application/accesoOwner.js'
import loginPhoto from '../assets/login/seedling.png'
import loginLogo from '../assets/login/logo.png'
const Ranking = lazy(() =>
  import('./Ranking.jsx').then((m) => ({ default: m.Ranking }))
)
const Configuracion = lazy(() =>
  import('./Configuracion.jsx').then((m) => ({ default: m.Configuracion }))
)
const Reportes = lazy(() =>
  import('./Reportes.jsx').then((m) => ({ default: m.Reportes }))
)
const Cosecha = lazy(() =>
  import('./Cosecha.jsx').then((m) => ({ default: m.Cosecha }))
)

function SessionScreen({ children }) {
  return (
    <main className="figma-login session-screen">
      <div className="login-photo" aria-hidden="true">
        <img src={loginPhoto} alt="" />
      </div>
      <section className="login-panel" aria-label="Acceso a GesGROW">
        <img className="login-logo" src={loginLogo} alt="GesGROW" />
        <div className="login-access session-content">{children}</div>
      </section>
    </main>
  )
}

function Estado({ titulo, children, mensaje, acciones }) {
  return (
    <section className="session-card">
      <h1>{titulo}</h1>
      {children}
      <Mensaje texto={mensaje} />
      {acciones && <div className="actions">{acciones}</div>}
    </section>
  )
}

function Mensaje({ texto }) {
  return texto ? (
    <p className="notice" role="alert">
      {texto}
    </p>
  ) : null
}
function Cargando({ texto = 'Cargando…' }) {
  return <Skeleton text={texto} variant="compact" />
}

function SeleccionEmpresa({ portal, estado }) {
  return (
    <Estado titulo="Seleccione una empresa" mensaje={estado.mensaje}>
      <p className="muted">
        Su cuenta tiene acceso a estas empresas. Elija con cuál trabajar.
      </p>
      <div className="company-list">
        {estado.empresas.map((empresa) => (
          <button
            key={empresa.id}
            className="company-option"
            disabled={estado.cargando}
            onClick={() => portal.seleccionarEmpresa(empresa.id)}
          >
            <span>
              <strong>{empresa.nombre}</strong>
              <small>Entrar al espacio de gestión</small>
            </span>
            <span aria-hidden="true">→</span>
          </button>
        ))}
      </div>
      {estado.cargando && <Cargando texto="Validando la empresa seleccionada…" />}
      <button
        className="quiet"
        onClick={() => portal.logout()}
        disabled={estado.cargando}
      >
        Cerrar sesión
      </button>
    </Estado>
  )
}

function ContenidoProtegido({ portal, estado, path }) {
  const vistaCarga =
    path === '/'
      ? 'home'
      : /\/(produccion|rendimiento)(?:\/|$)/.test(path) || path.startsWith('/reportes')
        ? 'report'
        : /\/cosecha(?:\/generar)?$/.test(path)
          ? 'generation'
          : path.includes('/configurar') ||
              /\/(invitaciones|accesos)(?:\/|$)/.test(path)
            ? 'form'
            : path === '/modulos'
              ? 'cards'
              : 'table'
  const carga =
    path === '/' ? (
      <HomeSkeleton page owner={estado.contexto?.permite('company.manage')} />
    ) : (
      <Skeleton text="Cargando…" variant={vistaCarga} page />
    )
  if (!reportePublicado(path) && /^\/reportes(?:\/|$)/.test(path)) return null
  // El listado permanece montado al abrir/cerrar la invitación. El formulario
  // de destino se muestra después de revalidar el permiso de configuración.
  if (
    estado.contexto &&
    ['permitida', 'cargando'].includes(estado.ruta?.estado) &&
    /^\/configuracion\/(usuarios|invitaciones)$/.test(estado.ruta.path) &&
    /^\/configuracion\/(usuarios|invitaciones)$/.test(path)
  ) {
    const autorizada =
      !estado.cargando &&
      estado.ruta.path === path &&
      estado.ruta.estado === 'permitida'
    return (
      <Suspense fallback={carga}>
        <Configuracion
          portal={portal}
          path={autorizada ? path : '/configuracion/usuarios'}
        />
      </Suspense>
    )
  }
  // La estructura de Cosecha persiste mientras se autoriza la siguiente pestaña.
  // El contenido de destino espera siempre el resultado de esa autorización.
  if (
    estado.contexto &&
    estado.ruta?.ruta?.path === '/cosecha' &&
    ['permitida', 'cargando'].includes(estado.ruta.estado) &&
    /^\/cosecha(?:\/|$)/.test(path) &&
    portal.cosecha
  )
    return (
      <Suspense fallback={carga}>
        <Cosecha
          trabajadores={portal.trabajadores}
          puedeTrabajadores={
            evaluarRuta('/cosecha/trabajadores', estado.contexto, estado.modulos)
              .estado === 'permitida'
          }
          servicio={portal.cosecha}
          appCosecha={portal.appCosecha}
          reportes={portal.reportes}
          cultivos={portal.cultivosCosecha}
          path={path}
          contexto={estado.contexto}
          pendiente={
            estado.cargando ||
            estado.ruta.path !== path ||
            estado.ruta.estado === 'cargando'
          }
        />
      </Suspense>
    )
  if (
    estado.cargando ||
    !estado.contexto ||
    estado.ruta?.path !== path ||
    estado.ruta?.estado === 'cargando'
  )
    return carga
  if (estado.ruta.estado !== 'permitida')
    return (
      <section className="content-card" role="alert">
        <span className="eyebrow">Acceso al Portal</span>
        <h1>
          {estado.ruta.estado === 'no-encontrada'
            ? 'Página no encontrada'
            : 'Acceso restringido'}
        </h1>
        <p>{estado.ruta.mensaje}</p>
        <Link className="text-link" to="/">
          Volver al inicio
        </Link>
      </section>
    )
  const ruta = estado.ruta.ruta
  if (ruta.path === '/reportes' && portal.reportes)
    return (
      <Suspense fallback={carga}>
        {path === '/reportes/ranking' ? (
          <Ranking servicio={portal.reportes} />
        ) : (
          <Reportes servicio={portal.reportes} path={path} />
        )}
      </Suspense>
    )
  if (path === '/') return <OwnerHome estado={estado} servicio={portal.reportes} />
  if (path === '/modulos')
    return (
      <ModulosOwner
        servicio={portal.suscripcion}
        modulos={estado.modulos}
        onActualizar={() => portal.revalidar()}
      />
    )
  if (ruta.path === '/cosecha' && portal.cosecha)
    return (
      <Suspense fallback={carga}>
        <Cosecha
          servicio={portal.cosecha}
          appCosecha={portal.appCosecha}
          reportes={portal.reportes}
          cultivos={portal.cultivosCosecha}
          trabajadores={portal.trabajadores}
          puedeTrabajadores={
            evaluarRuta('/cosecha/trabajadores', estado.contexto, estado.modulos)
              .estado === 'permitida'
          }
          path={path}
          contexto={estado.contexto}
        />
      </Suspense>
    )
  if (path === '/configuracion' || path.startsWith('/configuracion/'))
    return (
      <Suspense fallback={carga}>
        <Configuracion portal={portal} path={path} />
      </Suspense>
    )
  return (
    <>
      <section className="page-heading">
        <span className="eyebrow">{estado.contexto.empresa}</span>
        <h1>{ruta.nombre}</h1>
        <p>{ruta.descripcion}</p>
      </section>
      <section className="content-card shell">
        <span className="area-mark" aria-hidden="true">
          <Icon name={routeIcon(ruta.path)} />
        </span>
        <h2>Espacio de {ruta.nombre.toLowerCase()}</h2>
        <p>
          Esta sección está preparada para incorporar sus herramientas de gestión en la
          siguiente etapa.
        </p>
        <p className="muted">
          La operación actual continúa disponible en sus herramientas habituales.
        </p>
        <button className="secondary" onClick={() => portal.revalidar()}>
          Actualizar acceso
        </button>
      </section>
    </>
  )
}

function Layout({ portal, estado }) {
  const location = useLocation(),
    navigate = useNavigate()
  const [menu, setMenu] = useState(false)
  const closeMenu = useCallback(() => setMenu(false), [])
  useEffect(() => {
    const desktop = window.matchMedia?.('(min-width: 1024px)')
    const closeDrawer = () => {
      if (desktop?.matches) closeMenu()
    }
    desktop?.addEventListener('change', closeDrawer)
    return () => desktop?.removeEventListener('change', closeDrawer)
  }, [closeMenu])
  const path = location.pathname.replace(/\/$/, '') || '/'
  const cosechaFigma =
    path === '/cosecha' ||
    /^\/cosecha\/(trabajadores|registros|tickets|generar|lotes|asignaciones|configurar|cosechadores|jaberos|supervisores|produccion|rendimiento|app|dispositivos)$/.test(
      path
    )
  const usuariosFigma = /^\/configuracion\/(usuarios(?:\/[^/]+)?|invitaciones)$/.test(
    path
  )
  const suscripcionPortal = path === '/configuracion/suscripcion'
  const campaniaFigma =
    (portal.cultivosCosecha || /\/cosecha\/(app|dispositivos)$/.test(path)) &&
    /^\/cosecha\/(generar|lotes|asignaciones|tickets|cosechadores|jaberos|supervisores|produccion|rendimiento|app|dispositivos)$/.test(
      path
    )
  const modulosOwner = path === '/modulos'
  const figmaShell =
    path === '/' || cosechaFigma || usuariosFigma || suscripcionPortal || modulosOwner
  useEffect(() => {
    if (!reportePublicado(path) && /^\/reportes(?:\/|$)/.test(path)) {
      navigate('/', { replace: true })
      return
    }
    if (['/aceptar-invitacion', '/login', '/registro'].includes(path)) {
      navigate('/', { replace: true })
      return
    }
    void portal.abrirRuta(path)
    setMenu(false)
  }, [portal, path, estado.scope, navigate])
  useEffect(() => {
    const refrescar = () => {
      if (document.visibilityState !== 'hidden') void portal.revalidar()
    }
    window.addEventListener('focus', refrescar)
    document.addEventListener('visibilitychange', refrescar)
    return () => {
      window.removeEventListener('focus', refrescar)
      document.removeEventListener('visibilitychange', refrescar)
    }
  }, [portal])
  async function cambiar(tenant) {
    if (await portal.seleccionarEmpresa(tenant)) navigate('/', { replace: true })
  }
  return (
    <div
      className={`portal-layout portal-shell owner-layout ${campaniaFigma ? 'campaign-workspace-layout' : ''} ${path === '/' ? 'owner-home-layout' : ''} ${modulosOwner ? 'owner-modules-layout' : ''} ${figmaShell ? 'home-layout' : ''} ${cosechaFigma ? 'records-layout' : ''} ${path === '/cosecha/configurar' ? 'crop-setup-layout' : ''} ${path === '/cosecha/trabajadores' ? 'workers-layout' : ''} ${usuariosFigma ? 'users-layout' : ''} ${suscripcionPortal ? 'subscription-layout' : ''}`}
    >
      <a href="#contenido" className="skip-link">
        Ir al contenido
      </a>
      <NavigationRail
        ownerDesign
        soloOwner={esOwnerSinOperacion(estado.contexto)}
        mostrarCatalogo={estado.contexto?.permite('company.manage') ?? false}
        puedeConsultarCosecha={
          estado.contexto?.permite('harvest.view') ||
          estado.contexto?.permite('harvest.manage') ||
          false
        }
        puedeGenerar={estado.contexto?.permite('harvest.manage') ?? false}
        key={estado.contexto?.tenantId ?? 'checking'}
        navegacion={estado.navegacion}
        path={path}
        mobileOpen={menu}
        onClose={closeMenu}
      />
      {menu && (
        <button
          className="nav-overlay"
          aria-label="Cerrar navegación"
          onClick={() => setMenu(false)}
        />
      )}
      <div className="workspace" inert={menu || undefined}>
        <header className="header">
          <button
            className="menu-button secondary icon-button"
            aria-label="Menú"
            aria-controls="portal-nav"
            aria-expanded={menu}
            onClick={() => setMenu(!menu)}
          >
            <Icon name="menu" />
          </button>
          <div className="header-actions">
            <UserMenu
              ownerDesign
              empresas={estado.empresas}
              empresaActiva={estado.contexto?.tenantId ?? ''}
              onEmpresa={cambiar}
              ocupado={estado.cargando}
              usuario={estado.usuario}
              homeDesign
              onLogout={() => portal.logout()}
            />
          </div>
        </header>
        <main
          id="contenido"
          className="content"
          tabIndex={-1}
          key={`${estado.scope}:${estado.contexto?.tenantId ?? 'checking'}`}
        >
          <ContenidoProtegido portal={portal} estado={estado} path={path} />
        </main>
        <footer className="workspace-footer">GesGROW · Portal Web de Gestión</footer>
      </div>
    </div>
  )
}

export function Portal({ portal }) {
  const location = useLocation()
  const estado = useSyncExternalStore(portal.suscribir, portal.estadoActual)
  useEffect(() => {
    void portal.iniciar()
    return () => portal.detener()
  }, [portal])
  if (estado.fase === 'listo') return <Layout portal={portal} estado={estado} />
  if (estado.fase === 'sin-empresas')
    return <CrearEmpresa portal={portal} estado={estado} />
  if (['invitacion', 'invitacion-error'].includes(estado.fase))
    return <ActivacionCuenta portal={portal} estado={estado} />
  if (
    location.pathname === '/registro' &&
    ['login', 'registro', 'registro-completo'].includes(estado.fase)
  )
    return <Registro portal={portal} estado={estado} />
  if (['login', 'registro', 'registro-completo'].includes(estado.fase))
    return (
      <Login
        portal={portal}
        estado={{ ...estado, mensaje: estado.fase === 'login' ? estado.mensaje : '' }}
      />
    )
  return (
    <SessionScreen>
      {estado.fase === 'restaurando' && (
        <div className="session-loading" role="status" aria-busy="true">
          <span className="session-loading-indicator" aria-hidden="true" />
          <p>Validando su acceso…</p>
        </div>
      )}
      {estado.fase === 'seleccion' && (
        <SeleccionEmpresa portal={portal} estado={estado} />
      )}
      {['sin-acceso', 'error', 'salida-fallida'].includes(estado.fase) && (
        <Estado
          titulo={
            estado.fase === 'salida-fallida'
              ? 'Cierre de sesión pendiente'
              : 'No se pudo validar el acceso'
          }
          mensaje={estado.mensaje}
          acciones={
            <>
              {estado.fase !== 'salida-fallida' && (
                <button className="secondary" onClick={() => portal.restaurar()}>
                  Reintentar
                </button>
              )}
              <button className="quiet" onClick={() => portal.logout()}>
                Cerrar sesión
              </button>
            </>
          }
        />
      )}
    </SessionScreen>
  )
}

export function ErrorConfiguracion({ mensaje }) {
  return (
    <SessionScreen>
      <Estado titulo="Portal pendiente de configuración" mensaje={mensaje} />
    </SessionScreen>
  )
}
