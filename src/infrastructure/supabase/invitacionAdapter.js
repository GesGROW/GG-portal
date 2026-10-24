// Sólo infraestructura procesa los enlaces del proveedor; React recibe datos
// de presentación verificados, nunca tokens ni atributos de autorización del URL.
export function crearInvitacionAdapter(cliente, href, limpiarUrl) {
  const url = new URL(href)
  const hash = new URLSearchParams(url.hash.slice(1))
  const enRuta = url.pathname === '/aceptar-invitacion'
  const tipo = url.searchParams.get('type') ?? hash.get('type')
  const permitido = ['invite', 'magiclink', 'email'].includes(tipo)
  let token = permitido ? url.searchParams.get('token_hash') : null
  let access = permitido ? hash.get('access_token') : null
  let refresh = permitido ? hash.get('refresh_token') : null
  let id = url.searchParams.get('invitacion')
  const errorEnlace =
    url.searchParams.has('error') ||
    hash.has('error') ||
    (tipo && !permitido) ||
    (id && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))
  let pendiente = enRuta
  let verificada = false
  let enlaceVerificado = false
  let sujetoVerificado = null
  let datos = null
  let preparacion = null
  let passwordEstablecida = false
  let revision = 0
  async function aceptar(dni) {
    let respuesta
    try {
      respuesta = await cliente.rpc(
        dni === undefined
          ? 'iam_aceptar_invitacion'
          : 'iam_completar_activacion_cuenta',
        { p_invitacion_id: id ?? null, ...(dni === undefined ? {} : { p_dni: dni }) }
      )
    } catch {
      throw new Error(
        'No se pudo confirmar la aceptación. Comprueba tu conexión y reintenta.'
      )
    }
    if (dni !== undefined && respuesta.error?.code === 'P0001')
      throw new Error(respuesta.error.message)
    if (respuesta.error || respuesta.data?.estado !== 'ACEPTADA')
      throw new Error(
        'No se pudo confirmar la aceptación de la invitación. Reintenta para continuar.'
      )
  }
  if (enRuta)
    limpiarUrl(
      '/aceptar-invitacion' +
        (id && !errorEnlace ? '?invitacion=' + encodeURIComponent(id) : '')
    )

  async function verificar() {
    if (!pendiente || errorEnlace)
      throw new Error(
        'El enlace de invitación ha caducado o no es válido. Solicita una nueva invitación.'
      )
    if (verificada) return
    if (token || (access && refresh)) {
      let respuesta
      try {
        respuesta = token
          ? await cliente.auth.verifyOtp({ token_hash: token, type: tipo })
          : await cliente.auth.setSession({
              access_token: access,
              refresh_token: refresh
            })
      } catch {
        throw new Error(
          'No se pudo verificar la invitación. Comprueba tu conexión y reintenta.'
        )
      }
      if (respuesta.error)
        throw new Error(
          'El enlace de invitación ha caducado o no es válido. Solicita una nueva invitación.'
        )
      token = access = refresh = null
      enlaceVerificado = true
    } else if (tipo && !enlaceVerificado) {
      throw new Error(
        'El enlace de invitación está incompleto. Solicita una nueva invitación.'
      )
    }
    let respuesta
    try {
      respuesta = await cliente.auth.getUser()
    } catch {
      throw new Error(
        'No se pudo verificar la cuenta invitada. Comprueba tu conexión y reintenta.'
      )
    }
    if (respuesta.error || !respuesta.data?.user)
      throw new Error(
        'El enlace de invitación ha caducado o no es válido. Solicita una nueva invitación.'
      )
    verificada = true
    sujetoVerificado = respuesta.data.user.id
  }

  async function preparar() {
    await verificar()
    if (!datos) {
      let respuesta
      try {
        respuesta = await cliente.rpc('iam_obtener_activacion_cuenta', {
          p_invitacion_id: id ?? null
        })
      } catch {
        throw new Error(
          'No se pudo consultar la invitación. Comprueba tu conexión y reintenta.'
        )
      }
      if (respuesta.error?.code === 'PGRST202')
        throw new Error(
          'La activación de cuentas está pendiente de actualización. Contacta con el administrador.'
        )
      if (respuesta.error || !respuesta.data?.tenantId || !respuesta.data?.empresa)
        throw new Error(
          'La invitación no está disponible para esta cuenta. Solicita una nueva invitación.'
        )
      const d = respuesta.data
      datos = Object.freeze({
        tenantId: d.tenantId,
        empresa: d.empresa,
        roles: Object.freeze(
          Array.isArray(d.roles) ? d.roles.filter((r) => typeof r === 'string') : []
        ),
        modulos: Object.freeze(
          Array.isArray(d.modulos) ? d.modulos.filter((m) => typeof m === 'string') : []
        ),
        requiereActivacion: d.requiereActivacion === true
      })
    }
    if (!datos.requiereActivacion) {
      await aceptar()
      pendiente = false
      limpiarUrl('/')
    }
    return datos
  }

  return {
    tieneInvitacion: () => pendiente,
    cancelarInvitacion() {
      revision++
      pendiente = false
      datos = preparacion = null
      token = access = refresh = null
      verificada = enlaceVerificado = passwordEstablecida = false
      sujetoVerificado = null
    },
    async obtenerActivacionPendiente() {
      const actual = revision
      let respuesta
      try {
        respuesta = await cliente.rpc('iam_obtener_activacion_pendiente')
      } catch {
        throw new Error('No se pudo comprobar la activación de tu cuenta. Reintenta.')
      }
      if (actual !== revision) return null
      if (respuesta.error)
        throw new Error('No se pudo comprobar la activación de tu cuenta. Reintenta.')
      if (!respuesta.data?.requiereActivacion) return null
      if (!respuesta.data.invitacionId)
        throw new Error('No se pudo recuperar la invitación de tu cuenta.')
      id = respuesta.data.invitacionId
      pendiente = true
      verificada = false
      datos = preparacion = null
      limpiarUrl('/aceptar-invitacion?invitacion=' + encodeURIComponent(id))
      return preparar()
    },
    prepararInvitacion() {
      if (!preparacion)
        preparacion = preparar().catch((error) => {
          preparacion = null
          throw error
        })
      return preparacion
    },
    async completarInvitacion(password, dni) {
      await verificar()
      const invitacion = datos ?? (await preparar())
      if (!invitacion.requiereActivacion)
        throw new Error('Tu cuenta ya está activa. Inicia sesión para continuar.')
      if (!/^[0-9]{8}$/.test(dni ?? '')) throw new Error('Ingresa un DNI de 8 dígitos.')
      const actual = await cliente.auth.getUser()
      if (actual.error || actual.data?.user?.id !== sujetoVerificado)
        throw new Error(
          'La sesión cambió. Abre nuevamente tu invitación para activar la cuenta correcta.'
        )
      if (!passwordEstablecida) {
        let respuesta
        try {
          respuesta = await cliente.auth.updateUser({ password })
        } catch {
          throw new Error(
            'No se pudo establecer la contraseña. Comprueba tu conexión y reintenta.'
          )
        }
        if (respuesta.error)
          throw new Error(
            'No se pudo establecer la contraseña. Revisa la política de contraseñas del servicio.'
          )
        passwordEstablecida = true
      }
      await aceptar(dni)
      pendiente = false
      limpiarUrl('/')
    }
  }
}
