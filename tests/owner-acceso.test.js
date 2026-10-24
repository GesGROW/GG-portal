import assert from 'node:assert/strict'
import test from 'node:test'
import {
  ROLES_APLICACION,
  RolAplicacion,
  MembresiaEmpresa,
  TenantContext
} from '@gesgrow/core/contexts/identity-access/index.js'
import { evaluarRuta, navegacionPermitida } from '../src/application/rutas.js'

const contexto = (permisos) =>
  new TenantContext({
    usuarioId: 'U',
    membresiaId: 'M',
    tenantId: 'A',
    empresa: 'Empresa A',
    permisos
  })
test('el rol organizacional del owner permite administración y resumen, sin operación', () => {
  const owner = contexto(ROLES_APLICACION.ADMIN_EMPRESA)
  assert.deepEqual(owner.permisos, ['company.manage', 'reports.view'])
  assert.deepEqual(
    navegacionPermitida(owner, ['HARVEST']).map((r) => r.path),
    ['/', '/modulos', '/configuracion']
  )
  for (const path of [
    '/cosecha',
    '/cosecha/registros',
    '/cosecha/trabajadores',
    '/cosecha/generar',
    '/reportes',
    '/reportes/ranking'
  ])
    assert.equal(
      evaluarRuta(path, owner, ['HARVEST', 'WORKFORCE']).estado,
      'denegada',
      path
    )
})
test('un rol operativo separado conserva sus permisos al combinarse con owner', () => {
  const membresia = new MembresiaEmpresa({ id: 'M', usuarioId: 'U', tenantId: 'A' })
  const roles = ['ADMIN_EMPRESA', 'CONSULTA'].map(
    (codigo) =>
      new RolAplicacion({
        id: codigo,
        tenantId: 'A',
        codigo,
        permisos: ROLES_APLICACION[codigo]
      })
  )
  assert.equal(
    evaluarRuta('/cosecha/registros', contexto(membresia.permisosEfectivos(roles)), [
      'HARVEST'
    ]).estado,
    'permitida'
  )
})
