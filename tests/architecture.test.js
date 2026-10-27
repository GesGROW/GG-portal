import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))
const src = path.join(root, 'src')
const sources = new Map(
  readdirSync(src, { recursive: true })
    .filter((f) => /\.(js|jsx)$/.test(f))
    .map((f) => [path.join(src, f), readFileSync(path.join(src, f), 'utf8')])
)
const imports = (s) =>
  [
    ...s.matchAll(
      /(?:\b(?:import|export)\s+(?:[^'";]*?\s+from\s*)?|\bimport\s*\(\s*)['"]([^'"]+)['"]/g
    )
  ].map((m) => m[1])

test('Presentation y Application no importan SDK, RPC ni infraestructura', () => {
  for (const [file, source] of sources) {
    if (
      !file.includes(path.sep + 'presentation' + path.sep) &&
      !file.includes(path.sep + 'application' + path.sep)
    )
      continue
    assert.doesNotMatch(
      source,
      /supabase|\.rpc\(|\.auth\.|localStorage|sessionStorage/,
      file
    )
    for (const spec of imports(source)) {
      assert.ok(
        !spec.includes('infrastructure') && !spec.includes('bootstrap'),
        file + ' -> ' + spec
      )
      if (file.includes(path.sep + 'presentation' + path.sep))
        assert.ok(!spec.includes('/contexts/'), file)
    }
  }
})

test('dependencias transitivas de Application alcanzan sólo lógica pública y puertos puros', () => {
  const visited = new Set()
  function visit(file) {
    if (visited.has(file)) return
    visited.add(file)
    const source = readFileSync(file, 'utf8')
    assert.doesNotMatch(
      file.replaceAll('\\', '/'),
      /\/(infrastructure|presentation|offline|modules)\//
    )
    assert.doesNotMatch(
      source,
      /@supabase|\bdocument\b|\bwindow\b|indexedDB|\.rpc\(|localStorage/
    )
    for (const spec of imports(source)) {
      assert.ok(
        spec.startsWith('.') || spec.startsWith('@gesgrow/core/'),
        file + ': ' + spec
      )
      visit(
        spec.startsWith('@gesgrow/core/')
          ? fileURLToPath(import.meta.resolve(spec))
          : path.resolve(path.dirname(file), spec)
      )
    }
  }
  for (const file of sources.keys())
    if (file.includes(path.sep + 'application' + path.sep)) visit(file)
})

test('Portal comparte sólo APIs públicas de BC y no importa aplicación de campo', () => {
  for (const [file, source] of sources)
    for (const spec of imports(source)) {
      if (spec.startsWith('@gesgrow/core/')) {
        if (spec === '@gesgrow/core/presentation/select.js')
          assert.ok(file.includes(path.sep + 'presentation' + path.sep), file)
        else
          assert.match(
            spec,
            /^@gesgrow\/core\/contexts\/(identity-access|platform|campaign-management|workforce|harvest|farm-structure)\/index\.js$/
          )
        continue
      }
      if (!spec.startsWith('.')) continue
      const resolved = path.resolve(path.dirname(file), spec)
      if (resolved.startsWith(src)) continue
      // Native select enhancement is shared UI, never an Application dependency.
      if (
        resolved.replaceAll('\\', '/').endsWith('/shared/src/presentation/select.js')
      ) {
        assert.ok(file.includes(path.sep + 'presentation' + path.sep), file)
        continue
      }
      assert.match(
        resolved.replaceAll('\\', '/'),
        /\/shared\/src\/contexts\/(identity-access|platform|campaign-management|workforce|harvest|farm-structure)\/index\.js$/
      )
    }
  const conexion = readFileSync(
    path.join(src, 'infrastructure/supabase/crearConexion.js'),
    'utf8'
  )
  assert.match(conexion, /gesgrow\.portal\.auth\.v1/)
  const packagePortal = JSON.parse(
    readFileSync(path.join(root, 'package.json'), 'utf8')
  )
  assert.ok(packagePortal.dependencies.react)
  assert.ok(packagePortal.dependencies['@gesgrow/core'])
  assert.doesNotMatch(
    readFileSync(path.join(root, 'vite.config.js'), 'utf8'),
    /VitePWA|registerSW/
  )
})

test('ninguna credencial o API administrativa de proveedor se incluye en el Portal', () => {
  for (const [file, source] of sources)
    assert.doesNotMatch(
      source,
      /SERVICE_ROLE|SECRET_KEY|service_role|\.auth\.admin|inviteUserByEmail|createUser\(/,
      file
    )
  const entorno = readFileSync(path.join(root, '.env.example'), 'utf8')
  assert.doesNotMatch(entorno, /SERVICE_ROLE|SECRET_KEY|PASSWORD|PRIVATE_KEY/)
  assert.deepEqual(
    entorno
      .trim()
      .split(/\r?\n/)
      .map((line) => line.split('=')[0]),
    ['VITE_SUPABASE_URL', 'VITE_SUPABASE_PUBLISHABLE_KEY', 'VITE_COSECHA_APP_URL']
  )
})
