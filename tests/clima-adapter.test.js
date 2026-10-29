import test from 'node:test'
import assert from 'node:assert/strict'
import { crearClimaAdapter } from '../src/infrastructure/supabase/climaAdapter.js'

function escenario() {
  let estado = 'prompt',
    usuario = 'A',
    reloj = 0,
    fallo = false,
    cambiar
  const calls = []
  const permiso = {
    get state() {
      return estado
    },
    addEventListener: (_, cb) => (cambiar = cb),
    removeEventListener: () => {}
  }
  const navegador = {
    permissions: { query: async () => permiso },
    geolocation: {
      getCurrentPosition(ok, error, opciones) {
        calls.push(['ubicacion', opciones])
        if (estado === 'denied') error({ code: 1 })
        else ok({ coords: { latitude: -12.051234, longitude: -77.041234 } })
      }
    }
  }
  const cliente = {
    auth: {
      getSession: async () => ({
        data: { session: usuario ? { user: { id: usuario } } : null }
      })
    },
    functions: {
      invoke: async (nombre, options) => {
        calls.push([nombre, options.body])
        return fallo
          ? { error: new Error('red') }
          : { data: { temperatura: 23, ubicacion: 'Lima' } }
      }
    }
  }
  return {
    calls,
    adapter: crearClimaAdapter(cliente, navegador, () => reloj),
    setEstado(s) {
      estado = s
      cambiar?.()
    },
    setUsuario(u) {
      usuario = u
    },
    avanzar() {
      reloj += 900_000
    },
    fallar() {
      fallo = true
    }
  }
}
test('geolocalización con permiso: redondea coordenadas y comparte caché entre consultas', async () => {
  const e = escenario()
  const [a, b] = await Promise.all([e.adapter.consultar(), e.adapter.consultar()])
  assert.equal(a.temperatura, 23)
  assert.deepEqual(a, b)
  assert.deepEqual(e.calls[1], ['clima', { latitud: -12.05, longitud: -77.04 }])
  await e.adapter.consultar()
  assert.equal(e.calls.length, 2)
  e.avanzar()
  await e.adapter.consultar()
  assert.equal(e.calls.length, 4)
})
test('rechazar o revocar el permiso deja de consultar y descarta datos previos', async () => {
  const e = escenario(),
    estados = []
  const dejar = e.adapter.observarPermiso((s) => estados.push(s))
  await e.adapter.consultar()
  e.setEstado('denied')
  assert.equal(await e.adapter.consultar(), null)
  assert.deepEqual(estados, ['denied'])
  assert.equal(e.calls.length, 2)
  e.setEstado('granted')
  await e.adapter.consultar()
  assert.equal(e.calls.length, 4)
  dejar()
})
test('sin sesión, API indisponible y sin geolocalización devuelven ausencia de clima', async () => {
  const e = escenario()
  e.setUsuario(null)
  assert.equal(await e.adapter.consultar(), null)
  assert.equal(e.calls.length, 0)
  e.setUsuario('B')
  e.fallar()
  assert.equal(await e.adapter.consultar(), null)
  assert.equal(await crearClimaAdapter({}, {}).consultar(), null)
})

test('el rechazo del aviso inicial no llega al proveedor y una revocación durante la respuesta descarta el clima', async () => {
  let resolver,
    cambiar,
    consultas = 0
  const permiso = {
    state: 'prompt',
    addEventListener: (_, cb) => (cambiar = cb),
    removeEventListener() {}
  }
  const navegador = {
    permissions: { query: async () => permiso },
    geolocation: { getCurrentPosition: (_ok, error) => error({ code: 1 }) }
  }
  const cliente = {
    auth: { getSession: async () => ({ data: { session: { user: { id: 'A' } } } }) },
    functions: {
      invoke: () => {
        consultas++
        return new Promise((r) => (resolver = r))
      }
    }
  }
  const adapter = crearClimaAdapter(cliente, navegador)
  assert.equal(await adapter.consultar(), null)
  assert.equal(consultas, 0)
  adapter.observarPermiso(() => {})
  navegador.geolocation.getCurrentPosition = (ok) =>
    ok({ coords: { latitude: 0, longitude: 0 } })
  const pendiente = adapter.consultar()
  while (!resolver) await new Promise((r) => setImmediate(r))
  permiso.state = 'denied'
  cambiar()
  resolver({ data: { temperatura: 23, ubicacion: 'Lima' } })
  assert.equal(await pendiente, null)
  assert.equal(await adapter.consultar(), null)
  assert.equal(consultas, 1)
})

test('aceptar el permiso inicial conserva la ubicación en curso y muestra el clima', async () => {
  let entregarUbicacion,
    notificarPermiso,
    segundaConsulta,
    consultas = 0
  const permiso = {
    state: 'prompt',
    addEventListener: (_, cb) => (notificarPermiso = cb),
    removeEventListener() {}
  }
  const navegador = {
    permissions: { query: async () => permiso },
    geolocation: { getCurrentPosition: (ok) => (entregarUbicacion = ok) }
  }
  const cliente = {
    auth: { getSession: async () => ({ data: { session: { user: { id: 'A' } } } }) },
    functions: {
      invoke: async () => {
        consultas++
        return { data: { temperatura: 23, ubicacion: 'Lima' } }
      }
    }
  }
  const adapter = crearClimaAdapter(cliente, navegador)
  const dejar = adapter.observarPermiso(() => (segundaConsulta = adapter.consultar()))
  const primeraConsulta = adapter.consultar()
  while (!entregarUbicacion || !notificarPermiso)
    await new Promise((r) => setImmediate(r))
  permiso.state = 'granted'
  notificarPermiso()
  entregarUbicacion({ coords: { latitude: -12.05, longitude: -77.04 } })
  assert.deepEqual(await primeraConsulta, { temperatura: 23, ubicacion: 'Lima' })
  assert.deepEqual(await segundaConsulta, { temperatura: 23, ubicacion: 'Lima' })
  assert.equal(consultas, 1)
  dejar()
})

test('si no hay coordenadas sólo aproxima con permiso concedido; rechazo nunca consulta', async () => {
  const calls = []
  const permiso = { state: 'granted' }
  let codigo = 3
  const cliente = {
    auth: { getSession: async () => ({ data: { session: { user: { id: 'A' } } } }) },
    functions: { invoke: async (_, { body }) => {
      calls.push(body)
      return { data: { temperatura: 23, ubicacion: 'Lima', ubicacionAproximada: true } }
    } }
  }
  const navegador = {
    permissions: { query: async () => permiso },
    geolocation: { getCurrentPosition: (_, error) => error({ code: codigo }) }
  }
  assert.equal((await crearClimaAdapter(cliente, navegador).consultar()).ubicacionAproximada, true)
  assert.deepEqual(calls, [{ ubicacionAproximada: true }])
  codigo = 1
  assert.equal(await crearClimaAdapter(cliente, navegador).consultar(), null)
  codigo = 2
  permiso.state = 'prompt'
  assert.equal(await crearClimaAdapter(cliente, navegador).consultar(), null)
  permiso.state = 'denied'
  assert.equal(await crearClimaAdapter(cliente, navegador).consultar(), null)
  assert.equal(calls.length, 1)
})

test('el navegador que nunca responde no deja la consulta esperando indefinidamente', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  let solicitarUbicacion = false
  let consultas = 0
  const cliente = {
    auth: { getSession: async () => ({ data: { session: { user: { id: 'A' } } } }) },
    functions: { invoke: async (_, { body }) => {
      consultas++
      assert.deepEqual(body, { ubicacionAproximada: true })
      return { data: { temperatura: 23, ubicacion: 'Lima' } }
    } }
  }
  const navegador = {
    permissions: { query: async () => ({ state: 'granted' }) },
    geolocation: { getCurrentPosition: () => { solicitarUbicacion = true } }
  }
  const pendiente = crearClimaAdapter(cliente, navegador).consultar()
  while (!solicitarUbicacion) await new Promise((r) => setImmediate(r))
  t.mock.timers.tick(12000)
  assert.equal((await pendiente).temperatura, 23)
  assert.equal(consultas, 1)
})
