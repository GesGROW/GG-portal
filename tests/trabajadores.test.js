import assert from 'node:assert/strict'
import test from 'node:test'
import { evaluarRuta } from '../src/application/rutas.js'
import { crearPortal } from '../src/application/crearPortal.js'
import { crearTrabajadoresAdapter } from '../src/infrastructure/supabase/trabajadoresAdapter.js'
import { fakePorts } from './support/fakePorts.js'
import { fakeTrabajadores } from './support/fakeTrabajadores.js'

test('trabajadores requiere su permiso y ambos módulos sin conceder permisos de cuentas', () => {
  const contexto = { permite: (p) => p === 'workforce.manage' }
  assert.equal(
    evaluarRuta('/cosecha/trabajadores', contexto, ['HARVEST', 'WORKFORCE']).estado,
    'permitida'
  )
  assert.equal(
    evaluarRuta('/cosecha', contexto, ['HARVEST', 'WORKFORCE']).estado,
    'permitida'
  )
  assert.equal(
    evaluarRuta('/cosecha/registros', contexto, ['HARVEST', 'WORKFORCE']).estado,
    'denegada'
  )
  assert.equal(
    evaluarRuta('/configuracion/usuarios', contexto, ['HARVEST', 'WORKFORCE']).estado,
    'denegada'
  )
  assert.equal(
    evaluarRuta('/cosecha/trabajadores', contexto, ['HARVEST']).estado,
    'denegada'
  )
  assert.equal(
    evaluarRuta('/cosecha/trabajadores', { permite: () => false }, [
      'HARVEST',
      'WORKFORCE'
    ]).estado,
    'denegada'
  )
})
test('aplicación valida datos, exige módulos y descarta respuestas de otra empresa', async () => {
  const ports = fakePorts({
    autenticado: true,
    empresas: ['A', 'B'],
    permisos: { A: ['workforce.manage'], B: ['workforce.manage'] },
    modulos: { A: ['HARVEST', 'WORKFORCE'], B: ['HARVEST', 'WORKFORCE'] }
  })
  fakeTrabajadores(ports)
  const portal = crearPortal(ports)
  await portal.restaurar()
  await portal.seleccionarEmpresa('A')
  await assert.rejects(
    portal.trabajadores.crear({ dni: '123', nombres: 'Ana', apellidos: 'Campos' }),
    /ocho dígitos/
  )
  let devolver
  ports.workforce.listarCosecha = () =>
    new Promise((resolve) => {
      devolver = resolve
    })
  const solicitud = portal.trabajadores.listarCosecha({})
  while (!devolver) await new Promise((r) => setTimeout(r, 0))
  await portal.seleccionarEmpresa('B')
  devolver({ trabajadores: [{ dni: '74851236' }] })
  await assert.rejects(solicitud, (e) => e.name === 'SolicitudObsoleta')
  ports.modulos.B = ['HARVEST']
  await assert.rejects(portal.trabajadores.listarCosecha({}), /WORKFORCE|módulo/i)
})
test('adapter conserva contratos de identidad, participación y jornada diaria', async () => {
  const llamadas = []
  const adapter = crearTrabajadoresAdapter(async (...args) => llamadas.push(args))
  await adapter.listarCosecha('A', { campania: 'C', offset: 50 })
  await adapter.editar('A', 'W', {
    dni: '74851236',
    nombres: 'Ana',
    apellidos: 'Campos',
    tenantId: 'B',
    activo: false
  })
  await adapter.habilitarJaberoDelDia('A', 'W', 'C')
  assert.deepEqual(llamadas, [
    [
      'workforce_cosecha_listar',
      { p_tenant_id: 'A', p_filtros: { campania: 'C', offset: 50 } }
    ],
    [
      'workforce_admin_editar',
      {
        p_tenant_id: 'A',
        p_id: 'W',
        p_dni: '74851236',
        p_nombres: 'Ana',
        p_apellidos: 'Campos'
      }
    ],
    [
      'workforce_admin_jornada_jabero',
      { p_tenant_id: 'A', p_trabajador_id: 'W', p_campania_id: 'C', p_habilitar: true }
    ]
  ])
})
