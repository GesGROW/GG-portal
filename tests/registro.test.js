import assert from 'node:assert/strict'
import test from 'node:test'
import { crearPuertosSupabase } from '../src/infrastructure/supabase/adapters.js'
import { crearPortal } from '../src/application/crearPortal.js'
import { fakePorts } from './support/fakePorts.js'
import { ServicioNoDisponible } from '../src/ports/errores.js'

test('registro usa Auth público sin aceptar roles, permisos ni empresa suministrados por el navegador', async () => {
  const llamadas = []
  const puertos = crearPuertosSupabase({
    auth: {
      signUp: async (datos) => {
        llamadas.push(datos)
        return { data: { user: { id: 'U' }, session: null } }
      }
    }
  })
  assert.deepEqual(
    await puertos.identity.registrarCuenta({
      email: 'owner@example.test',
      password: 'Clave123',
      rol: 'OWNER',
      tenantId: 'AJENO',
      permisos: ['company.manage']
    }),
    { confirmarCorreo: true }
  )
  assert.deepEqual(llamadas, [{ email: 'owner@example.test', password: 'Clave123' }])
})

test('registro distingue confirmación, errores de seguridad, límite de intentos y red', async () => {
  let respuesta = { data: { user: { id: 'U' }, session: { access_token: 'privado' } } }
  const p = crearPuertosSupabase({ auth: { signUp: async () => respuesta } })
  assert.deepEqual(await p.identity.registrarCuenta({}), { confirmarCorreo: false })
  respuesta = { error: { status: 422, code: 'weak_password' } }
  await assert.rejects(p.identity.registrarCuenta({}), /requisitos de seguridad/)
  respuesta = { error: { status: 429, code: 'over_email_send_rate_limit' } }
  await assert.rejects(p.identity.registrarCuenta({}), /demasiados correos/)
  respuesta = { error: { status: 503, message: 'mensaje interno' } }
  await assert.rejects(p.identity.registrarCuenta({}), ServicioNoDisponible)
})

test('registro valida credenciales antes de invocar el puerto y descarta respuestas tras cerrar sesión', async () => {
  const p = fakePorts({ autenticado: false })
  let terminar,
    llamadas = 0
  p.identity.registrarCuenta = () => {
    llamadas++
    return new Promise((resolve) => {
      terminar = resolve
    })
  }
  const portal = crearPortal(p)
  await portal.iniciar()
  await portal.registrar({ email: 'mal', password: 'Clave123' })
  assert.equal(llamadas, 0)
  assert.match(portal.estadoActual().mensaje, /correo electrónico válido/)
  await portal.registrar({ email: 'owner@example.test', password: 'corta' })
  assert.equal(llamadas, 0)
  const pendiente = portal.registrar({
    email: 'owner@example.test',
    password: 'Clave123'
  })
  await Promise.resolve()
  const salida = portal.logout()
  terminar({ confirmarCorreo: true })
  assert.equal(await pendiente, false)
  await salida
  assert.equal(portal.estadoActual().fase, 'login')
  assert.equal(portal.estadoActual().confirmarCorreo, false)
  portal.detener()
})
