import assert from 'node:assert/strict'
import test from 'node:test'
import { crearInvitacionAdapter } from '../src/infrastructure/supabase/invitacionAdapter.js'
import { crearPuertosSupabase } from '../src/infrastructure/supabase/adapters.js'
import { SesionExpirada, ServicioNoDisponible } from '../src/ports/errores.js'
import { AccesoDenegado } from '@gesgrow/core/contexts/identity-access/index.js'

test('el enlace de acceso de una cuenta existente verifica sesión y no modifica su contraseña', async () => {
  const calls = []
  const adapter = crearInvitacionAdapter(
    {
      auth: {
        verifyOtp: async (datos) => {
          calls.push(datos)
          return {}
        },
        getUser: async () => ({ data: { user: { id: 'u' } } }),
        updateUser: async () => {
          throw new Error('No debe solicitar contraseña')
        }
      },
      rpc: async (nombre, args) => {
        if (
          ['iam_aceptar_invitacion', 'iam_completar_activacion_cuenta'].includes(nombre)
        )
          return { data: { estado: 'ACEPTADA' } }
        assert.equal(nombre, 'iam_obtener_activacion_cuenta')
        assert.equal(args.p_invitacion_id, '11111111-1111-1111-1111-111111111111')
        return {
          data: {
            tenantId: 'B',
            empresa: 'Empresa B',
            roles: ['CONSULTA'],
            modulos: ['HARVEST'],
            requiereActivacion: false
          }
        }
      }
    },
    'https://portal.test/aceptar-invitacion?type=magiclink&token_hash=privado&invitacion=11111111-1111-1111-1111-111111111111',
    (path) => calls.push(path)
  )
  const datos = await adapter.prepararInvitacion()
  assert.equal(datos.requiereActivacion, false)
  assert.equal(adapter.tieneInvitacion(), false)
  assert.deepEqual(calls, [
    '/aceptar-invitacion?invitacion=11111111-1111-1111-1111-111111111111',
    { token_hash: 'privado', type: 'magiclink' },
    '/'
  ])
  await assert.rejects(
    adapter.completarInvitacion('nueva-clave', '01234567'),
    /caducado|válido/
  )
})

test('puede recuperar una sesión invitada al recargar y bloquea cambios sobre una cuenta distinta', async () => {
  let sujeto = 'invitado',
    cambios = 0
  const adapter = crearInvitacionAdapter(
    {
      auth: {
        getUser: async () => ({ data: { user: { id: sujeto } } }),
        updateUser: async () => {
          cambios++
          return {}
        }
      },
      rpc: async (nombre) =>
        ['iam_aceptar_invitacion', 'iam_completar_activacion_cuenta'].includes(nombre)
          ? { data: { estado: 'ACEPTADA' } }
          : {
              data: {
                tenantId: 'A',
                empresa: 'Empresa A',
                roles: [],
                modulos: [],
                requiereActivacion: true
              }
            }
    },
    'https://portal.test/aceptar-invitacion',
    () => {}
  )
  await adapter.prepararInvitacion()
  sujeto = 'otra-cuenta'
  await assert.rejects(
    adapter.completarInvitacion('clave-segura', '01234567'),
    /sesión cambió/
  )
  assert.equal(cambios, 0)
})

test('una consulta temporalmente fallida no vuelve a consumir el token verificado', async () => {
  let consultas = 0,
    verificaciones = 0
  const adapter = crearInvitacionAdapter(
    {
      auth: {
        verifyOtp: async () => {
          verificaciones++
          return {}
        },
        getUser: async () => ({ data: { user: { id: 'u' } } })
      },
      rpc: async (nombre) =>
        ['iam_aceptar_invitacion', 'iam_completar_activacion_cuenta'].includes(nombre)
          ? { data: { estado: 'ACEPTADA' } }
          : ++consultas === 1
            ? { error: { code: 'PGRST000' } }
            : {
                data: {
                  tenantId: 'A',
                  empresa: 'Empresa A',
                  roles: [],
                  modulos: [],
                  requiereActivacion: true
                }
              }
    },
    'https://portal.test/aceptar-invitacion?type=invite&token_hash=un-solo-uso',
    () => {}
  )
  await assert.rejects(adapter.prepararInvitacion(), /no está disponible/)
  assert.equal((await adapter.prepararInvitacion()).requiereActivacion, true)
  assert.equal(verificaciones, 1)
})

test('enlace de invitación se verifica sólo en adapter y limpia tokens de URL antes de React', async () => {
  const calls = [],
    cliente = {
      auth: {
        verifyOtp: async (d) => {
          calls.push(d)
          return {}
        },
        getUser: async () => ({ data: { user: { id: 'u' } } }),
        updateUser: async (d) => {
          calls.push(d)
          return {}
        }
      },
      rpc: async (nombre) =>
        ['iam_aceptar_invitacion', 'iam_completar_activacion_cuenta'].includes(nombre)
          ? { data: { estado: 'ACEPTADA' } }
          : {
              data: {
                tenantId: 'A',
                empresa: 'Empresa A',
                roles: ['GESTOR'],
                modulos: ['HARVEST'],
                requiereActivacion: true
              }
            }
    }
  const adapter = crearInvitacionAdapter(
    cliente,
    'https://portal.test/aceptar-invitacion?type=invite&token_hash=secreto',
    (path) => calls.push(path)
  )
  assert.deepEqual(calls, ['/aceptar-invitacion'])
  assert.equal(adapter.tieneInvitacion(), true)
  assert.equal(
    await adapter.completarInvitacion('contraseña-nueva', '01234567'),
    undefined
  )
  assert.deepEqual(calls.slice(1), [
    { token_hash: 'secreto', type: 'invite' },
    { password: 'contraseña-nueva' },
    '/'
  ])
  assert.equal(adapter.tieneInvitacion(), false)
  assert.doesNotMatch(JSON.stringify(adapter), /secreto/)
})
test('enlace Auth por fragmento se restaura y un fallo de contraseña no reutiliza token de un solo uso', async () => {
  let verificaciones = 0,
    cambios = 0
  const cliente = {
    auth: {
      setSession: async (d) => {
        verificaciones++
        assert.deepEqual(d, { access_token: 'access', refresh_token: 'refresh' })
        return {}
      },
      getUser: async () => ({ data: { user: { id: 'u' } } }),
      updateUser: async () => ({
        error: ++cambios === 1 ? new Error('Política del proveedor') : null
      })
    },
    rpc: async (nombre) =>
      ['iam_aceptar_invitacion', 'iam_completar_activacion_cuenta'].includes(nombre)
        ? { data: { estado: 'ACEPTADA' } }
        : {
            data: {
              tenantId: 'A',
              empresa: 'Empresa A',
              roles: [],
              modulos: [],
              requiereActivacion: true
            }
          }
  }
  const adapter = crearInvitacionAdapter(
    cliente,
    'https://portal.test/aceptar-invitacion#type=invite&access_token=access&refresh_token=refresh',
    () => {}
  )
  await assert.rejects(
    adapter.completarInvitacion('débil', '01234567'),
    /política de contraseñas/
  )
  await adapter.completarInvitacion('más-fuerte-123', '01234567')
  assert.equal(verificaciones, 1)
  assert.equal(cambios, 2)
})
test('enlace expirado o cuenta no verificada no permiten cambiar contraseña; errores no exponen tokens', async () => {
  for (const fallo of ['token', 'usuario']) {
    let cambios = 0
    const adapter = crearInvitacionAdapter(
      {
        auth: {
          verifyOtp: async () => ({
            error: fallo === 'token' ? new Error('token-super-secreto') : null
          }),
          getUser: async () => ({ data: { user: null } }),
          updateUser: async () => {
            cambios++
            return {}
          }
        }
      },
      'https://portal.test/aceptar-invitacion?type=invite&token_hash=token-super-secreto',
      () => {}
    )
    await assert.rejects(
      adapter.completarInvitacion('password', '01234567'),
      (error) => !error.message.includes('token-super-secreto')
    )
    assert.equal(cambios, 0)
  }
  const invalido = crearInvitacionAdapter(
    {},
    'https://portal.test/?type=invite&token_hash=otro',
    () => {}
  )
  assert.equal(invalido.tieneInvitacion(), false)
})
test('adapter de administración usa RPC específicos y backend de invitación sin credenciales privilegiadas', async () => {
  const calls = [],
    cliente = {
      rpc: async (name, args) => {
        calls.push([name, args])
        return { data: {} }
      },
      functions: {
        invoke: async (name, args) => {
          calls.push([name, args])
          return { data: { usuarioId: 'u' } }
        }
      }
    }
  const { administracion: a } = crearPuertosSupabase(cliente)
  await a.guardarMembresia('A', {
    usuarioId: 'u',
    nombre: 'Nombre',
    activo: false,
    roles: [],
    trabajadorId: null,
    tenantId: 'B',
    secreto: 'ignorar'
  })
  assert.deepEqual(calls[0], [
    'iam_admin_guardar_membresia',
    {
      p_tenant_id: 'A',
      p_usuario_id: 'u',
      p_nombre: 'Nombre',
      p_activo: false,
      p_roles: [],
      p_trabajador_id: null
    }
  ])
  await a.invitarUsuario('A', {
    operacionId: 'op',
    email: 'u@example.test',
    nombre: 'U',
    roles: [],
    trabajadorId: null,
    serviceKey: 'ignorar'
  })
  assert.deepEqual(calls[1], [
    'invitar-usuario',
    {
      body: {
        operacionId: 'op',
        tenantId: 'A',
        email: 'u@example.test',
        nombre: 'U',
        roles: [],
        trabajadorId: null
      }
    }
  ])
  for (const [status, tipo] of [
    [401, SesionExpirada],
    [403, AccesoDenegado]
  ]) {
    cliente.functions.invoke = async () => ({ error: { context: { status } } })
    await assert.rejects(a.invitarUsuario('A', {}), tipo)
  }
  cliente.functions.invoke = async () => {
    throw new Error('red')
  }
  await assert.rejects(a.invitarUsuario('A', {}), ServicioNoDisponible)
})

test('aceptar después de guardar contraseña reintenta la confirmación sin volver a cambiarla', async () => {
  const calls = []
  let intentos = 0
  const adapter = crearInvitacionAdapter(
    {
      auth: {
        getUser: async () => ({ data: { user: { id: 'U' } } }),
        updateUser: async () => {
          calls.push('password')
          return {}
        }
      },
      rpc: async (nombre) => {
        if (nombre === 'iam_obtener_activacion_cuenta')
          return {
            data: { tenantId: 'A', empresa: 'Empresa A', requiereActivacion: true }
          }
        calls.push('aceptar')
        return ++intentos === 1
          ? { error: { code: 'RED' } }
          : { data: { estado: 'ACEPTADA' } }
      }
    },
    'https://portal.test/aceptar-invitacion',
    (path) => calls.push(path)
  )
  await assert.rejects(
    adapter.completarInvitacion('clave-segura', '01234567'),
    /confirmar la aceptación/
  )
  assert.equal(adapter.tieneInvitacion(), true)
  await adapter.completarInvitacion('clave-segura', '01234567')
  assert.deepEqual(calls, [
    '/aceptar-invitacion',
    'password',
    'aceptar',
    'aceptar',
    '/'
  ])
})

test('una cuenta existente registra la aceptación antes de entrar y conserva el enlace si falla', async () => {
  let aceptar = 0
  const paths = []
  const adapter = crearInvitacionAdapter(
    {
      auth: { getUser: async () => ({ data: { user: { id: 'U' } } }) },
      rpc: async (nombre) => {
        if (nombre === 'iam_obtener_activacion_cuenta')
          return {
            data: { tenantId: 'A', empresa: 'Empresa A', requiereActivacion: false }
          }
        return ++aceptar === 1
          ? { error: { code: 'RED' } }
          : { data: { estado: 'ACEPTADA' } }
      }
    },
    'https://portal.test/aceptar-invitacion',
    (path) => paths.push(path)
  )
  await assert.rejects(adapter.prepararInvitacion(), /confirmar la aceptación/)
  assert.equal(adapter.tieneInvitacion(), true)
  assert.deepEqual(paths, ['/aceptar-invitacion'])
  await adapter.prepararInvitacion()
  assert.equal(adapter.tieneInvitacion(), false)
  assert.deepEqual(paths, ['/aceptar-invitacion', '/'])
})

test('el alta pendiente se recupera desde Home, envía sólo DNI al servidor y se cancela al salir', async () => {
  const calls = []
  const id = '11111111-1111-1111-1111-111111111111'
  let activa = false
  const adapter = crearInvitacionAdapter(
    {
      auth: {
        getUser: async () => ({ data: { user: { id: 'U' } } }),
        updateUser: async (datos) => {
          calls.push(['password', datos])
          return {}
        }
      },
      rpc: async (nombre, args) => {
        calls.push([nombre, args])
        if (nombre === 'iam_completar_activacion_cuenta') {
          assert.deepEqual(args, { p_invitacion_id: id, p_dni: '01234567' })
          activa = true
          return { data: { estado: 'ACEPTADA' } }
        }
        return {
          data: activa
            ? null
            : {
                invitacionId: id,
                tenantId: 'A',
                empresa: 'Empresa A',
                requiereActivacion: true
              }
        }
      }
    },
    'https://portal.test/',
    () => {}
  )
  assert.equal(adapter.tieneInvitacion(), false)
  assert.equal((await adapter.obtenerActivacionPendiente()).requiereActivacion, true)
  assert.equal(adapter.tieneInvitacion(), true)
  await assert.rejects(adapter.completarInvitacion('clave-segura', 'abc'), /DNI de 8/)
  assert.equal(calls.filter((c) => c[0] === 'password').length, 0)
  await adapter.completarInvitacion('clave-segura', '01234567')
  assert.equal(adapter.tieneInvitacion(), false)
  assert.equal(await adapter.obtenerActivacionPendiente(), null)
  adapter.cancelarInvitacion()
  assert.equal(adapter.tieneInvitacion(), false)
})
