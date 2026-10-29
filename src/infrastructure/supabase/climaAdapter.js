export function crearClimaAdapter(
  cliente,
  navegador = globalThis.navigator,
  ahora = Date.now
) {
  let cache = null,
    pendiente = null,
    revision = 0
  const limpiar = () => {
    revision++
    cache = null
  }
  async function permiso() {
    try {
      return await navegador?.permissions?.query({ name: 'geolocation' })
    } catch {
      return null
    }
  }
  async function consultar() {
    if (!navegador?.geolocation) return null
    const estado = await permiso()
    if (estado?.state === 'denied') {
      limpiar()
      return null
    }
    const { data } = await cliente.auth.getSession()
    const usuario = data?.session?.user?.id
    if (!usuario) {
      limpiar()
      return null
    }
    if (cache?.usuario === usuario && cache.hasta > ahora()) return cache.datos
    const version = revision
    const resultado = await new Promise((resolve) => {
      const terminar = (resultado) => {
        clearTimeout(limite)
        resolve(resultado)
      }
      // Algunos navegadores no invocan ni el callback de error al agotar su
      // timeout. Este límite permite continuar con permiso ya concedido.
      const limite = setTimeout(() => terminar({ error: 3 }), 12000)
      try {
        navegador.geolocation.getCurrentPosition(
          (posicion) => terminar({ posicion }),
          (error) => terminar({ error: error.code }),
          { enableHighAccuracy: false, timeout: 8000, maximumAge: 15 * 60_000 }
        )
      } catch {
        terminar({ error: 2 })
      }
    })
    if (version !== revision) return null
    let body
    if (resultado.posicion) {
      const latitud = resultado.posicion.coords.latitude,
        longitud = resultado.posicion.coords.longitude
      if (
        !Number.isFinite(latitud) || Math.abs(latitud) > 90 ||
        !Number.isFinite(longitud) || Math.abs(longitud) > 180
      ) return null
      body = {
        latitud: Number(latitud.toFixed(2)),
        longitud: Number(longitud.toFixed(2))
      }
    } else {
      if (
        resultado.error === 1 ||
        (await permiso())?.state !== 'granted' ||
        version !== revision
      ) return null
      body = { ubicacionAproximada: true }
    }
    const r = await cliente.functions.invoke('clima', {
      body
    })
    if (
      version !== revision ||
      r.error ||
      !r.data ||
      !Number.isFinite(r.data.temperatura) ||
      !r.data.ubicacion
    )
      return null
    // Volver a verificar si la cuenta cambió mientras respondía el proveedor.
    const sesion = await cliente.auth.getSession()
    if (version !== revision || sesion.data?.session?.user?.id !== usuario) return null
    cache = { usuario, datos: r.data, hasta: ahora() + 15 * 60_000 }
    return r.data
  }
  return Object.freeze({
    async consultar() {
      if (pendiente) return pendiente
      pendiente = consultar().catch(() => null)
      try {
        return await pendiente
      } finally {
        pendiente = null
      }
    },
    observarPermiso(callback) {
      let activo = true,
        estado
      const cambiar = () => {
        // Al conceder el permiso, getCurrentPosition sigue resolviendo la
        // solicitud inicial. Invalidarla aquí descartaba su propia respuesta.
        if (estado.state !== 'granted') limpiar()
        callback(estado.state)
      }
      void permiso().then((p) => {
        if (!activo || !p) return
        estado = p
        estado.addEventListener?.('change', cambiar)
      })
      return () => {
        activo = false
        estado?.removeEventListener?.('change', cambiar)
      }
    }
  })
}
