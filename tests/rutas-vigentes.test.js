import assert from 'node:assert/strict'
import test from 'node:test'
import { evaluarRuta, navegacionPermitida } from '../src/application/rutas.js'
import { crearPortal } from '../src/application/crearPortal.js'
import { fakePorts } from './support/fakePorts.js'

const contexto = { permite: () => true }
const modulos = ['HARVEST', 'CAMPAIGN', 'WORKFORCE', 'FARM_STRUCTURE']

test('la consulta de trabajadores por campaña sólo requiere acceso a Cosecha', () => {
  const supervisor = { permite: (p) => ['harvest.view', 'harvest.manage'].includes(p) }
  for (const tab of ['cosechadores', 'jaberos', 'supervisores']) {
    assert.equal(
      evaluarRuta('/cosecha/' + tab, supervisor, ['HARVEST']).estado,
      'permitida'
    )
    assert.equal(evaluarRuta('/cosecha/' + tab, supervisor, []).estado, 'denegada')
    assert.equal(
      evaluarRuta('/cosecha/' + tab, { permite: () => false }, ['HARVEST']).estado,
      'denegada'
    )
  }
  assert.equal(
    evaluarRuta('/cosecha/trabajadores', supervisor, ['HARVEST']).estado,
    'denegada'
  )
})

test('solo se publican las áreas vigentes aunque el usuario tenga todos los permisos y módulos', () => {
  assert.deepEqual(
    navegacionPermitida(contexto, modulos).map((r) => r.path),
    ['/', '/modulos', '/cosecha', '/reportes', '/configuracion']
  )
  for (const base of ['/campanias', '/personal', '/estructura']) {
    for (const path of [base, base + '/nuevo', base + '/id-anterior'])
      assert.equal(evaluarRuta(path, contexto, modulos).estado, 'no-encontrada', path)
  }
  for (const path of [
    '/configuracion/empresa',
    '/configuracion/roles',
    '/configuracion/modulos'
  ])
    assert.equal(evaluarRuta(path, contexto, modulos).estado, 'no-encontrada', path)
})

test('se conservan inventario y detalles relacionados con las pantallas actuales', () => {
  for (const path of [
    '/',
    '/cosecha',
    '/cosecha/registros',
    '/cosecha/generar',
    '/cosecha/lotes',
    '/cosecha/asignaciones',
    '/cosecha/tickets',
    '/configuracion',
    '/configuracion/usuarios',
    '/configuracion/usuarios/usuario-id',
    '/configuracion/invitaciones',
    '/configuracion/suscripcion',
    '/reportes',
    '/reportes/resumen',
    '/reportes/ranking',
    '/reportes/diaria',
    '/reportes/lotes',
    ...['registros', 'tickets', 'lotes', 'asignaciones'].map(
      (tipo) => `/cosecha/${tipo}/recurso-id`
    )
  ])
    assert.equal(evaluarRuta(path, contexto, modulos).estado, 'permitida', path)
})

test('el portal no compone servicios exclusivos de las pantallas eliminadas', () => {
  const portal = crearPortal(fakePorts())
  for (const nombre of [
    'campanias',
    'personal',
    'estructuraAgricola',
    'parcelasCampania',
    'cutoverAdministrativo'
  ])
    assert.equal(portal[nombre], undefined, nombre)
})
