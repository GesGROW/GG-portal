import assert from 'node:assert/strict'
import test from 'node:test'
import { crearPuertosSupabase } from '../src/infrastructure/supabase/adapters.js'
import {
  SesionExpirada,
  CredencialesInvalidas,
  ServicioNoDisponible
} from '../src/ports/errores.js'
import { AccesoDenegado } from '@gesgrow/core/contexts/identity-access/index.js'

test('adapter usa sesión verificada y RPC autorizados, sin exponer JWT ni aceptar actor/permisos de UI', async () => {
  const llamadas = [],
    cliente = {
      auth: {
        getUser: async () => ({ data: { user: { id: 'SUB' } } }),
        signInWithPassword: async (datos) => {
          llamadas.push(['login', datos])
          return { data: { session: { access_token: 'NO-EXPONER' } } }
        },
        signOut: async (options) => {
          llamadas.push(['logout', options])
          return {}
        }
      },
      rpc: async (nombre, parametros) => {
        llamadas.push([nombre, parametros])
        return { data: nombre === 'platform_puede_usar_modulo' ? true : { ok: true } }
      }
    }
  const ports = crearPuertosSupabase(cliente)
  await ports.identity.iniciarSesion({
    email: 'a@test',
    password: 'clave',
    dni: 'IGNORADO',
    tenantId: 'FALSO'
  })
  assert.deepEqual(llamadas[0], ['login', { email: 'a@test', password: 'clave' }])
  assert.deepEqual(await ports.identity.obtenerSesion(), { sujeto: 'SUB' })
  await ports.acceso.obtenerIdentidad()
  await ports.acceso.resolverContexto('A')
  assert.deepEqual(llamadas[2], ['iam_resolver_tenant_context', { p_tenant_id: 'A' }])
  assert.equal(await ports.entitlements.puedeUsarModulo('A', 'HARVEST'), true)
  assert.deepEqual(llamadas[3], [
    'platform_puede_usar_modulo',
    { p_tenant_id: 'A', p_modulo: 'HARVEST' }
  ])
  await ports.identity.cerrarSesion()
  assert.deepEqual(llamadas[4], ['logout', { scope: 'local' }])
})

test('adapter distingue sesión inválida, permiso denegado y fallo de red; datos truthy no conceden módulo', async () => {
  let errorAuth = null,
    errorRpc = null
  const cliente = {
    auth: {
      getUser: async () => ({
        data: errorAuth ? null : { user: { id: 'U' } },
        error: errorAuth
      }),
      signInWithPassword: async () => ({ error: { status: 400 } }),
      signOut: async () => ({ error: null })
    },
    rpc: async () => ({ data: { habilitado: true }, error: errorRpc })
  }
  const p = crearPuertosSupabase(cliente)
  assert.equal(await p.entitlements.puedeUsarModulo('A', 'HARVEST'), false)
  await assert.rejects(p.identity.iniciarSesion({}), CredencialesInvalidas)
  errorAuth = { name: 'AuthSessionMissingError' }
  assert.equal(await p.identity.obtenerSesion(), null)
  errorRpc = { code: '42501', message: 'Permiso denegado' }
  await assert.rejects(p.acceso.resolverContexto('B'), SesionExpirada)
  errorAuth = null
  await assert.rejects(p.acceso.resolverContexto('B'), AccesoDenegado)
  errorRpc = { code: 'PGRST301' }
  await assert.rejects(p.acceso.obtenerIdentidad(), SesionExpirada)
  errorAuth = { status: 503 }
  await assert.rejects(p.identity.obtenerSesion(), ServicioNoDisponible)
  errorAuth = { status: 401 }
  await assert.rejects(p.identity.obtenerSesion(), SesionExpirada)
  cliente.rpc = async () => {
    throw new Error('Network')
  }
  await assert.rejects(p.acceso.obtenerIdentidad(), ServicioNoDisponible)
})

test('consulta de trabajadores sin migración no se presenta como fallo de conexión', async () => {
  let codigo = 'PGRST202'
  const puertos = crearPuertosSupabase({
    rpc: async () => ({ error: { code: codigo } })
  })
  await assert.rejects(puertos.workforce.listarCosecha('A', {}), (error) => {
    assert.ok(error instanceof ServicioNoDisponible)
    assert.match(error.message, /Falta aplicar su actualización/)
    assert.doesNotMatch(error.message, /Compruebe su conexión/)
    return true
  })
  await assert.rejects(
    puertos.harvestAdmin.trabajadoresCampania('A', 'camp', 'COSECHADOR'),
    (error) => {
      assert.ok(error instanceof ServicioNoDisponible)
      assert.match(error.message, /Falta aplicar su actualización/)
      return true
    }
  )
  codigo = 'PGRST000'
  await assert.rejects(puertos.workforce.listarCosecha('A', {}), (error) => {
    assert.match(error.message, /Compruebe su conexión/)
    return true
  })
})

test('eventos Auth se notifican fuera del callback del SDK y la suscripción se libera', async () => {
  let callback,
    unsubscribe = false
  const events = [],
    p = crearPuertosSupabase({
      auth: {
        onAuthStateChange(fn) {
          callback = fn
          return {
            data: {
              subscription: {
                unsubscribe: () => {
                  unsubscribe = true
                }
              }
            }
          }
        }
      }
    })
  const stop = p.identity.observarSesion((e) => events.push(e))
  callback('INITIAL_SESSION')
  callback('SIGNED_OUT')
  assert.deepEqual(events, [])
  await Promise.resolve()
  assert.deepEqual(events, [{ tipo: 'cerrada', evento: 'SIGNED_OUT' }])
  callback('TOKEN_REFRESHED')
  await Promise.resolve()
  assert.deepEqual(events[1], { tipo: 'actualizada', evento: 'TOKEN_REFRESHED' })
  callback('SIGNED_IN')
  await Promise.resolve()
  assert.deepEqual(events[2], { tipo: 'actualizada', evento: 'SIGNED_IN' })
  stop()
  callback('TOKEN_REFRESHED')
  await Promise.resolve()
  assert.equal(events.length, 3)
  assert.equal(unsubscribe, true)
})
