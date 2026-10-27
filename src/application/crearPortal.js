import {
  crearAccesoAutenticado,
  AccesoDenegado
} from '@gesgrow/core/contexts/identity-access/index.js'
import {
  crearEntitlements,
  ModuloNoHabilitado
} from '@gesgrow/core/contexts/platform/index.js'
import { validarPuertosPortal } from '../ports/portal.js'
import {
  SesionExpirada,
  CredencialesInvalidas,
  ServicioNoDisponible
} from '../ports/errores.js'
import { evaluarRuta, navegacionPermitida } from './rutas.js'
import { crearConfiguracion } from './configuracion.js'
import { crearCosechaPortal } from './cosecha.js'
import { crearCultivosCosechaPortal } from './cultivosCosecha.js'
import { crearTrabajadoresPortal } from './trabajadores.js'
import { crearSuscripcionPortal } from './suscripcion.js'
import { crearReportesPortal } from './reportes.js'
import { crearAppCosechaPortal } from './appCosecha.js'

export function crearPortal(puertos) {
  validarPuertosPortal(puertos)
  const { identity } = puertos
  const acceso = crearAccesoAutenticado(puertos)
  const capacidades = crearEntitlements(puertos)
  const listeners = new Set()
  let version = 0,
    seleccion = null,
    colaAuth = Promise.resolve(),
    revalidacionEnCurso = null,
    observar = null,
    iniciada = false,
    salidaSolicitada = false
  const limpio = () => ({
    usuario: null,
    empresas: Object.freeze([]),
    contexto: null,
    modulos: Object.freeze([]),
    navegacion: Object.freeze([]),
    ruta: null,
    mensaje: '',
    confirmarCorreo: false,
    invitacion: null,
    cargando: false,
    initializingSession: false,
    backgroundRevalidation: false
  })
  let estado = Object.freeze({
    ...limpio(),
    fase: 'restaurando',
    scope: 0,
    cargando: true,
    initializingSession: true
  })
  const emitir = (cambios) => {
    estado = Object.freeze({ ...estado, ...cambios })
    for (const listener of listeners) listener()
  }
  const actual = (v) => v === version
  const reset = (fase, mensaje = '', cargando = false, indicadores = {}) =>
    emitir({
      ...limpio(),
      fase,
      mensaje,
      cargando,
      scope: estado.scope + 1,
      ...indicadores
    })
  const authEnOrden = (accion) => {
    const tarea = colaAuth.then(accion, accion)
    colaAuth = tarea.catch(() => {})
    return tarea
  }
  const perfilPublico = (p) => {
    const tenants = new Set(p.membresias.filter((m) => m.activo).map((m) => m.tenantId))
    return {
      usuario: p.usuario,
      empresas: Object.freeze(
        p.empresas
          .filter((e) => tenants.has(e.id))
          .map((e) => Object.freeze({ id: e.id, nombre: e.nombre }))
      )
    }
  }
  function invalidarSesion(
    mensaje = 'Su sesión ha expirado. Inicie sesión nuevamente.'
  ) {
    version++
    seleccion = null
    reset('login', mensaje)
  }
  async function contextoValidado(tenantId, v) {
    const c = await acceso.seleccionarEmpresa(tenantId)
    if (!actual(v)) return null
    if (c.usuarioId !== estado.usuario?.id)
      throw new SesionExpirada('La sesión cambió. Inicie sesión nuevamente.')
    const modulos = Object.freeze(await capacidades.modulosHabilitados(c.tenantId))
    return actual(v)
      ? { contexto: c, modulos, navegacion: navegacionPermitida(c, modulos) }
      : null
  }
  async function cargarPerfil(v, anterior = {}) {
    const invitacion = await identity.obtenerActivacionPendiente?.()
    if (!actual(v)) return false
    if (invitacion?.requiereActivacion) {
      reset('invitacion')
      emitir({ invitacion: Object.freeze(invitacion) })
      return true
    }
    const p = perfilPublico(await acceso.obtenerIdentidad())
    if (!actual(v)) return false
    if (anterior.altaEmpresa && p.usuario.id !== anterior.usuarioId)
      throw new SesionExpirada('La sesión cambió. Inicie sesión nuevamente.')
    emitir(p)
    if (!p.empresas.length) {
      seleccion = null
      emitir({
        fase: 'sin-empresas',
        cargando: false,
        initializingSession: false,
        backgroundRevalidation: false
      })
      return true
    }
    const hint =
      (anterior.usuarioId === p.usuario.id || anterior.desdeInvitacion === true) &&
      p.empresas.some((e) => e.id === anterior.tenantId)
        ? anterior.tenantId
        : p.empresas.length === 1
          ? p.empresas[0].id
          : null
    if (!hint) {
      seleccion = null
      emitir({
        fase: 'seleccion',
        cargando: false,
        initializingSession: false,
        backgroundRevalidation: false
      })
      return true
    }
    const recursos = await contextoValidado(hint, v)
    if (!recursos) return false
    seleccion = recursos.contexto.tenantId
    emitir({
      ...recursos,
      fase: 'listo',
      cargando: false,
      initializingSession: false,
      backgroundRevalidation: false
    })
    return true
  }
  async function fallo(error, v, modo) {
    if (!actual(v)) return false
    if (error instanceof SesionExpirada) {
      invalidarSesion(error.message)
      return false
    }
    if (error instanceof CredencialesInvalidas) {
      seleccion = null
      reset('login', error.message)
      return false
    }
    if (error instanceof AccesoDenegado) {
      try {
        if (!(await identity.obtenerSesion())) {
          if (actual(v)) invalidarSesion()
          return false
        }
        if (!actual(v)) return false
        if (modo === 'seleccion' || modo === 'ruta') {
          const p = perfilPublico(await acceso.obtenerIdentidad())
          if (!actual(v)) return false
          seleccion = null
          reset(p.empresas.length ? 'seleccion' : 'sin-empresas', error.message)
          emitir(p)
          return false
        }
      } catch (e) {
        if (!actual(v)) return false
        if (e instanceof SesionExpirada) {
          invalidarSesion(e.message)
          return false
        }
        if (e instanceof ServicioNoDisponible) {
          reset('error', e.message)
          return false
        }
      }
      seleccion = null
      reset('sin-acceso', error.message)
      return false
    }
    reset('error', error.message || 'No se pudo validar el acceso al Portal.')
    return false
  }
  async function falloRevalidacion(error, v, tenant) {
    if (!actual(v) || seleccion !== tenant) return false
    if (error instanceof SesionExpirada) {
      invalidarSesion(error.message)
      return false
    }
    if (error instanceof CredencialesInvalidas) {
      seleccion = null
      reset('login', error.message)
      return false
    }
    if (!(error instanceof AccesoDenegado)) return false
    try {
      if (!(await identity.obtenerSesion())) {
        if (actual(v) && seleccion === tenant) invalidarSesion()
        return false
      }
      if (!actual(v) || seleccion !== tenant) return false
      const p = perfilPublico(await acceso.obtenerIdentidad())
      if (!actual(v) || seleccion !== tenant) return false
      if (p.usuario.id !== estado.usuario?.id) {
        invalidarSesion('La sesión cambió. Inicie sesión nuevamente.')
        return false
      }
      if (!p.empresas.some((empresa) => empresa.id === tenant)) {
        seleccion = null
        reset(
          p.empresas.length ? 'seleccion' : 'sin-empresas',
          error.message || 'Su acceso a la empresa activa ya no está disponible.'
        )
        emitir(p)
        return false
      }
      seleccion = null
      reset('sin-acceso', error.message)
      emitir(p)
      return false
    } catch (e) {
      if (!actual(v) || seleccion !== tenant) return false
      if (e instanceof SesionExpirada) invalidarSesion(e.message)
      return false
    }
  }
  async function restaurar() {
    const previo = estado.invitacion?.tenantId
      ? { desdeInvitacion: true, tenantId: estado.invitacion.tenantId }
      : { usuarioId: estado.usuario?.id, tenantId: seleccion }
    const v = ++version
    reset('restaurando', '', true, { initializingSession: true })
    return authEnOrden(async () => {
      if (!actual(v)) return false
      try {
        if (identity.tieneInvitacion?.()) {
          try {
            const invitacion = (await identity.prepararInvitacion?.()) ?? {
              requiereActivacion: true
            }
            if (!actual(v)) return false
            if (!invitacion.requiereActivacion)
              return await cargarPerfil(v, {
                desdeInvitacion: true,
                tenantId: invitacion.tenantId
              })
            reset('invitacion')
            emitir({ invitacion: Object.freeze(invitacion) })
            return true
          } catch (e) {
            if (actual(v))
              reset(
                'invitacion-error',
                e.message || 'No se pudo verificar la invitación.'
              )
            return false
          }
        }
        if (!(await identity.obtenerSesion())) {
          if (actual(v)) {
            seleccion = null
            reset('login')
          }
          return false
        }
        return await cargarPerfil(v, previo)
      } catch (e) {
        return fallo(e, v, 'restaurar')
      }
    })
  }
  async function login({ email, password }) {
    const v = ++version
    salidaSolicitada = false
    seleccion = null
    reset('login', '', true)
    return authEnOrden(async () => {
      if (!actual(v)) return false
      try {
        await identity.iniciarSesion({ email, password })
        if (!actual(v)) return false
        return await cargarPerfil(v)
      } catch (e) {
        return fallo(e, v, 'login')
      }
    })
  }
  async function registrar({ email, password }) {
    if (
      estado.cargando ||
      !['login', 'registro', 'registro-completo'].includes(estado.fase)
    )
      return false
    const v = ++version
    seleccion = null
    salidaSolicitada = false
    reset('registro', '', true)
    return authEnOrden(async () => {
      if (!actual(v)) return false
      try {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
          throw new Error('Ingresa un correo electrónico válido.')
        if (!password || password.length < 8)
          throw new Error('Usa una contraseña de al menos 8 caracteres.')
        const resultado = await identity.registrarCuenta({
          email: email.trim(),
          password
        })
        if (!actual(v)) return false
        reset(
          'registro-completo',
          resultado.confirmarCorreo
            ? 'Si el correo puede registrarse, recibirás un enlace para confirmar tu cuenta. Revisa también la carpeta de spam.'
            : 'Tu cuenta se ha creado correctamente.'
        )
        emitir({ confirmarCorreo: resultado.confirmarCorreo })
        return true
      } catch (e) {
        if (actual(v))
          reset(
            'registro',
            e.message || 'No se pudo crear la cuenta. Inténtalo nuevamente.'
          )
        return false
      }
    })
  }
  async function seleccionarEmpresa(tenantId) {
    const v = ++version
    seleccion = null
    reset('seleccion', '', true)
    try {
      const p = perfilPublico(await acceso.obtenerIdentidad())
      if (!actual(v)) return false
      emitir(p)
      const recursos = await contextoValidado(tenantId, v)
      if (!recursos) return false
      seleccion = recursos.contexto.tenantId
      emitir({ ...recursos, fase: 'listo', cargando: false })
      return true
    } catch (e) {
      return fallo(e, v, 'seleccion')
    }
  }
  async function abrirRuta(path) {
    if (estado.fase !== 'listo' || !seleccion) return false
    const v = ++version,
      tenant = seleccion
    const dentroDeCosecha =
      ['permitida', 'cargando'].includes(estado.ruta?.estado) &&
      estado.ruta.ruta?.path === '/cosecha' &&
      /^\/cosecha(?:\/|$)/.test(path) &&
      estado.contexto?.tenantId === tenant
    const dentroDeUsuarios =
      ['permitida', 'cargando'].includes(estado.ruta?.estado) &&
      /^\/configuracion\/(usuarios|invitaciones)$/.test(estado.ruta.path) &&
      /^\/configuracion\/(usuarios|invitaciones)$/.test(path) &&
      estado.contexto?.tenantId === tenant
    const conservarVista = dentroDeCosecha || dentroDeUsuarios
    emitir({
      ...(conservarVista
        ? {}
        : {
            contexto: null,
            modulos: Object.freeze([]),
            navegacion: Object.freeze([])
          }),
      cargando: true,
      ruta: Object.freeze({
        path,
        estado: 'cargando',
        ...(conservarVista ? { ruta: estado.ruta.ruta } : {})
      })
    })
    try {
      const recursos = await contextoValidado(tenant, v)
      if (!recursos) return false
      const resultado = evaluarRuta(path, recursos.contexto, recursos.modulos)
      emitir({
        ...recursos,
        cargando: false,
        ruta: Object.freeze({ path, ...resultado })
      })
      return resultado.estado === 'permitida'
    } catch (e) {
      return fallo(e, v, 'ruta')
    }
  }
  async function logout() {
    const v = ++version
    salidaSolicitada = true
    identity.cancelarInvitacion?.()
    seleccion = null
    reset('login', '', true)
    return authEnOrden(async () => {
      try {
        await acceso.cerrarSesion()
        if (actual(v)) reset('login')
        return true
      } catch (e) {
        if (actual(v))
          reset('salida-fallida', 'No se pudo cerrar la sesión. Reintente el cierre.')
        return false
      }
    })
  }
  function revalidar() {
    if (estado.fase !== 'listo' || !seleccion || !estado.contexto)
      return Promise.resolve(false)
    if (
      revalidacionEnCurso?.version === version &&
      revalidacionEnCurso?.tenant === seleccion
    )
      return revalidacionEnCurso.promise
    const v = version,
      tenant = seleccion,
      path = estado.ruta?.path ?? '/'
    emitir({ backgroundRevalidation: true })
    const tarea = (async () => {
      try {
        const p = perfilPublico(await acceso.obtenerIdentidad())
        if (!actual(v) || seleccion !== tenant) return false
        if (p.usuario.id !== estado.usuario?.id)
          throw new SesionExpirada('La sesión cambió. Inicie sesión nuevamente.')
        if (!p.empresas.some((empresa) => empresa.id === tenant)) {
          seleccion = null
          reset(
            p.empresas.length ? 'seleccion' : 'sin-empresas',
            'Su acceso a la empresa activa ya no está disponible.'
          )
          emitir(p)
          return false
        }
        const recursos = await contextoValidado(tenant, v)
        if (!recursos || seleccion !== tenant) return false
        const resultado = evaluarRuta(path, recursos.contexto, recursos.modulos)
        emitir({
          ...p,
          ...recursos,
          fase: 'listo',
          cargando: false,
          initializingSession: false,
          backgroundRevalidation: false,
          ruta: Object.freeze({ path, ...resultado })
        })
        return resultado.estado === 'permitida'
      } catch (e) {
        return falloRevalidacion(e, v, tenant)
      } finally {
        if (
          actual(v) &&
          seleccion === tenant &&
          estado.fase === 'listo' &&
          estado.backgroundRevalidation
        )
          emitir({ backgroundRevalidation: false })
      }
    })()
    revalidacionEnCurso = { version: v, tenant, promise: tarea }
    void tarea.finally(() => {
      if (revalidacionEnCurso?.promise === tarea) revalidacionEnCurso = null
    })
    return tarea
  }
  async function completarInvitacion({ password, dni }) {
    if (estado.fase !== 'invitacion' || estado.cargando) return false
    const invitacion = estado.invitacion
    const v = ++version
    reset('invitacion', '', true)
    emitir({ invitacion })
    return authEnOrden(async () => {
      let activada = false
      try {
        if (!actual(v)) return false
        if (!password || password.length < 8)
          throw new Error('Use una contraseña de al menos 8 caracteres.')
        if (!/^[0-9]{8}$/.test(dni ?? ''))
          throw new Error('Ingresa un DNI de 8 dígitos.')
        await identity.completarInvitacion(password, dni)
        activada = true
        if (!actual(v)) return false
        return await cargarPerfil(v, {
          desdeInvitacion: true,
          tenantId: invitacion?.tenantId
        })
      } catch (e) {
        if (actual(v)) {
          reset(
            activada ? 'invitacion-error' : 'invitacion',
            activada
              ? 'Tu contraseña se guardó, pero no se pudo abrir la plataforma. Reintenta para continuar.'
              : e.message
          )
          emitir({ invitacion })
        }
        return false
      }
    })
  }
  async function crearEmpresa({ operacionId, nombreEmpresa, nombreOwner }) {
    if (estado.fase !== 'sin-empresas' || estado.cargando) return false
    const usuarioId = estado.usuario?.id
    const v = ++version
    emitir({ cargando: true, mensaje: '' })
    return authEnOrden(async () => {
      try {
        if (!actual(v)) return false
        const sesion = await identity.obtenerSesion()
        if (!sesion) throw new SesionExpirada()
        if (!actual(v)) return false
        const perfil = await acceso.obtenerIdentidad()
        if (perfil.usuario.id !== usuarioId)
          throw new SesionExpirada('La sesión cambió. Inicie sesión nuevamente.')
        if (!actual(v)) return false
        const resultado = await puertos.acceso.crearEmpresa({
          operacionId,
          nombreEmpresa: nombreEmpresa?.trim(),
          nombreOwner: nombreOwner?.trim()
        })
        if (!actual(v)) return false
        const vigente = await identity.obtenerSesion()
        if (
          !vigente ||
          vigente.sujeto !== sesion.sujeto ||
          resultado.usuarioId !== usuarioId
        )
          throw new SesionExpirada('La sesión cambió. Inicie sesión nuevamente.')
        if (!actual(v)) return false
        await cargarPerfil(v, {
          usuarioId,
          tenantId: resultado.tenantId,
          altaEmpresa: true
        })
        return actual(v) && estado.fase === 'listo'
      } catch (e) {
        if (!actual(v)) return false
        if (e instanceof SesionExpirada) invalidarSesion(e.message)
        else
          emitir({
            fase: 'sin-empresas',
            cargando: false,
            mensaje: e.message || 'No se pudo crear su empresa. Reintente.'
          })
        return false
      }
    })
  }
  const scopesAdministracion = new WeakMap()
  const autorizarScope = async (permiso, tenant) => {
    if (!Array.isArray(permiso)) return acceso.autorizar(permiso, tenant)
    const c = await acceso.seleccionarEmpresa(tenant)
    if (!permiso.some((p) => c.permite(p)))
      throw new AccesoDenegado('Permiso de consulta Harvest requerido.')
    return c
  }
  const scopePara = (permiso, modulo = null) => ({
    vigente: (c) =>
      estado.fase === 'listo' &&
      seleccion === c.tenantId &&
      estado.usuario?.id === c.usuarioId &&
      scopesAdministracion.get(c) === estado.scope,
    async onError(e) {
      if (e instanceof SesionExpirada) invalidarSesion(e.message)
      else if (e instanceof ModuloNoHabilitado) await revalidar()
      else if (e instanceof AccesoDenegado) {
        // Un recurso ajeno no invalida toda la sesión. Revalidar el permiso
        // sin remontar la vista evita repetir automáticamente la consulta.
        const v = version,
          tenant = seleccion
        try {
          await autorizarScope(permiso, tenant)
          if (modulo && !(await capacidades.puedeUsarModulo(tenant, modulo)))
            await revalidar()
        } catch (error) {
          await fallo(error, v, 'ruta')
        }
      }
    },
    tenantContext: {
      async obtener() {
        const tenant = seleccion,
          scope = estado.scope,
          v = version
        if (estado.fase !== 'listo' || !tenant)
          throw new AccesoDenegado('Seleccione una empresa autorizada.')
        try {
          const c = await autorizarScope(permiso, tenant)
          if (scope !== estado.scope || tenant !== seleccion)
            throw new AccesoDenegado('La empresa cambió.')
          scopesAdministracion.set(c, scope)
          return c
        } catch (e) {
          if (e instanceof SesionExpirada) invalidarSesion(e.message)
          else if (e instanceof AccesoDenegado && scope === estado.scope)
            await fallo(e, v, 'ruta')
          throw e
        }
      }
    }
  })
  const configuracion = puertos.administracion
    ? crearConfiguracion({
        administracion: puertos.administracion,
        entitlements: puertos.entitlements,
        ...scopePara('company.manage')
      })
    : null
  const cosecha = crearCosechaPortal({
    puerto: puertos.harvestAdmin,
    impresion: puertos.impresionTickets,
    scopePara,
    entitlements: puertos.entitlements
  })
  return Object.freeze({
    suscripcion: crearSuscripcionPortal({
      comercial: puertos.comercial,
      scope: scopePara('company.manage')
    }),
    reportes: crearReportesPortal({
      puerto: puertos.reportesHarvest,
      scope: scopePara('reports.view', 'HARVEST'),
      entitlements: puertos.entitlements,
      exportacion: puertos.exportacion
    }),
    configuracion,
    cosecha,
    appCosecha: crearAppCosechaPortal({
      puerto: puertos.pda,
      scopePara,
      entitlements: puertos.entitlements,
      enlaceApp: puertos.enlaceAppCosecha
    }),
    cultivosCosecha: crearCultivosCosechaPortal({
      puerto: puertos.harvestAdmin,
      scopePara,
      entitlements: puertos.entitlements
    }),
    trabajadores: crearTrabajadoresPortal({
      puerto: puertos.workforce,
      scope: scopePara('workforce.manage', 'WORKFORCE'),
      entitlements: puertos.entitlements
    }),
    completarInvitacion,
    crearEmpresa,
    estadoActual: () => estado,
    suscribir: (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    restaurar,
    login,
    registrar,
    logout,
    seleccionarEmpresa,
    abrirRuta,
    revalidar,
    invalidarSesion,
    iniciar() {
      if (iniciada) return Promise.resolve(false)
      iniciada = true
      observar = identity.observarSesion?.((evento) => {
        if (evento.tipo === 'cerrada') invalidarSesion('')
        else if (!salidaSolicitada && estado.fase === 'listo' && estado.contexto)
          void revalidar()
        else if (
          !salidaSolicitada &&
          !estado.cargando &&
          !['registro', 'registro-completo', 'invitacion', 'invitacion-error'].includes(
            estado.fase
          )
        )
          void restaurar()
      })
      return restaurar()
    },
    detener() {
      version++
      observar?.()
      observar = null
      iniciada = false
    }
  })
}
