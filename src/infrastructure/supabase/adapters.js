import { AccesoDenegado } from '@gesgrow/core/contexts/identity-access/index.js'
import {
  SesionExpirada,
  CredencialesInvalidas,
  ServicioNoDisponible
} from '../../ports/errores.js'
import { crearAdministracionAdapter } from './administracionAdapter.js'
import { crearCosechaAdapter } from './cosechaAdapter.js'
import { crearPdaAdapter } from './pdaAdapter.js'
import { crearClimaAdapter } from './climaAdapter.js'
import { crearTrabajadoresAdapter } from './trabajadoresAdapter.js'
import { crearReportesAdapter } from './reportesAdapter.js'
import { exportacionCsv } from '../exportacionCsv.js'
import { impresionTickets } from '../impresionTickets.js'
import { crearSuscripcionAdapter } from './suscripcionAdapter.js'
import { ConflictoVersionComercial } from '@gesgrow/core/contexts/platform/index.js'

export function crearPuertosSupabase(cliente) {
  const verificar = async () => {
    let respuesta
    try {
      respuesta = await cliente.auth.getUser()
    } catch {
      throw new ServicioNoDisponible()
    }
    const { data, error } = respuesta
    if (error?.name === 'AuthSessionMissingError') return null
    if (error) {
      if ([401, 403].includes(error.status)) throw new SesionExpirada()
      throw new ServicioNoDisponible()
    }
    return data?.user ? { sujeto: data.user.id } : null
  }
  async function rpc(nombre, parametros) {
    let respuesta
    try {
      respuesta = await cliente.rpc(nombre, parametros)
    } catch {
      throw new ServicioNoDisponible()
    }
    if (respuesta.error) {
      const e = respuesta.error
      if (
        [
          'workforce_cosecha_listar',
          'iam_crear_empresa_inicial',
          'harvest_admin_trabajadores',
          'harvest_admin_tickets_lote',
          'harvest_admin_trabajador_campania',
          'harvest_admin_editar_trabajador_campania',
          'harvest_admin_previsualizar',
          'harvest_admin_confirmar_impresion',
          'harvest_admin_reservar_impresion',
          'harvest_admin_resolver_impresion',
          'harvest_reportes_campania',
          'pda_administrar_dispositivos',
          'pda_generar_vinculacion',
          'pda_revocar_dispositivo',
          'pda_renovar_dispositivo'
        ].includes(nombre) &&
        e.code === 'PGRST202'
      )
        throw new ServicioNoDisponible(
          'Esta consulta aún no está habilitada en la base de datos. Falta aplicar su actualización. Contacte al administrador.'
        )
      if (e.code === '40001') throw new ConflictoVersionComercial(e.message)
      if (e.status === 401 || ['PGRST301', 'PGRST303'].includes(e.code))
        throw new SesionExpirada()
      if (e.code === '42501') {
        if (!(await verificar())) throw new SesionExpirada()
        throw new AccesoDenegado(e.message)
      }
      if (
        ['P0001', '23505', '23503', '23514', '22007', '22008', '22P02'].includes(e.code)
      ) {
        const mensaje =
          e.code === '23505'
            ? 'Código, DNI o nombre duplicado, o ya existe una campaña activa para este cultivo.'
            : ['23503', '23514'].includes(e.code)
              ? 'La relación o los datos no son válidos para esta empresa.'
              : e.code === 'P0001'
                ? e.message
                : 'Revise las fechas y los datos indicados.'
        throw new Error(mensaje)
      }
      throw new ServicioNoDisponible()
    }
    return respuesta.data
  }
  return Object.freeze({
    clima: crearClimaAdapter(cliente),
    harvestAdmin: crearCosechaAdapter(rpc),
    pda: crearPdaAdapter(rpc),
    workforce: crearTrabajadoresAdapter(rpc),
    comercial: crearSuscripcionAdapter(rpc),
    reportesHarvest: crearReportesAdapter(rpc),
    exportacion: exportacionCsv,
    impresionTickets,
    administracion: crearAdministracionAdapter({
      consultar: rpc,
      async invocar(nombre, body) {
        let respuesta
        try {
          respuesta = await cliente.functions.invoke(nombre, { body })
        } catch {
          throw new ServicioNoDisponible()
        }
        const { data, error } = respuesta
        if (error) {
          if (error.context?.status === 401) throw new SesionExpirada()
          if (error.context?.status === 403)
            throw new AccesoDenegado('Autorización de administración revocada.')
          throw new Error(
            'No se pudo completar el alta. Reintente con la misma solicitud.'
          )
        }
        return data
      }
    }),
    identity: Object.freeze({
      obtenerSesion: verificar,
      async registrarCuenta({ email, password }) {
        let respuesta
        try {
          respuesta = await cliente.auth.signUp({ email, password })
        } catch {
          throw new ServicioNoDisponible()
        }
        const { data, error } = respuesta
        if (error) {
          if (!error.status || error.status >= 500) throw new ServicioNoDisponible()
          const mensajes = {
            signup_disabled:
              'El registro de cuentas no está habilitado. Contacta con GesGROW.',
            weak_password:
              'La contraseña no cumple los requisitos de seguridad. Usa una más larga y combina letras, números y símbolos.',
            email_address_invalid: 'Ingresa un correo electrónico válido.',
            over_email_send_rate_limit:
              'Se han solicitado demasiados correos. Espera unos minutos antes de reintentar.',
            over_request_rate_limit:
              'Se han realizado demasiados intentos. Espera unos minutos antes de reintentar.',
            user_already_exists:
              'No se pudo registrar este correo. Prueba iniciar sesión o recuperar tu acceso.'
          }
          throw new Error(
            mensajes[error.code] ||
              'No se pudo crear la cuenta. Revisa tus datos e inténtalo nuevamente.'
          )
        }
        if (!data?.user) throw new ServicioNoDisponible()
        return { confirmarCorreo: !data.session }
      },
      async iniciarSesion({ email, password }) {
        let respuesta
        try {
          respuesta = await cliente.auth.signInWithPassword({ email, password })
        } catch {
          throw new ServicioNoDisponible()
        }
        if (respuesta.error) {
          if (!respuesta.error.status || respuesta.error.status >= 500)
            throw new ServicioNoDisponible()
          throw new CredencialesInvalidas()
        }
      },
      async cerrarSesion() {
        let respuesta
        try {
          respuesta = await cliente.auth.signOut({ scope: 'local' })
        } catch {
          throw new ServicioNoDisponible()
        }
        const { error } = respuesta
        if (error) throw new ServicioNoDisponible()
      },
      observarSesion(listener) {
        let activa = true
        const { data } = cliente.auth.onAuthStateChange((evento) => {
          if (evento === 'INITIAL_SESSION') return
          // No ejecutar llamadas Auth dentro del lock del callback del SDK.
          queueMicrotask(() => {
            if (activa)
              listener({
                tipo: evento === 'SIGNED_OUT' ? 'cerrada' : 'actualizada',
                evento
              })
          })
        })
        return () => {
          activa = false
          data.subscription.unsubscribe()
        }
      }
    }),
    acceso: Object.freeze({
      crearEmpresa: ({ operacionId, nombreEmpresa, nombreOwner }) =>
        rpc('iam_crear_empresa_inicial', {
          p_operacion_id: operacionId,
          p_nombre_empresa: nombreEmpresa,
          p_nombre_owner: nombreOwner
        }),
      obtenerIdentidad: () => rpc('iam_obtener_identidad'),
      resolverContexto: (tenantId) =>
        rpc('iam_resolver_tenant_context', { p_tenant_id: tenantId })
    }),
    entitlements: Object.freeze({
      puedeUsarModulo: async (tenantId, modulo) =>
        (await rpc('platform_puede_usar_modulo', {
          p_tenant_id: tenantId,
          p_modulo: modulo
        })) === true
    })
  })
}
