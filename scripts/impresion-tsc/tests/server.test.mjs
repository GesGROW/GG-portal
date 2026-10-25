import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { createPrintService } from '../server.mjs';
import { LIMITS, ServiceError } from '../config.mjs';
import { HEADER, PAGE, ID, ORIGIN, PRINTER, TOKEN, TSPL, configuration, job } from './fixtures.mjs';

async function fixture(t, { dryRun = true, print, now } = {}) {
  let calls = 0;
  const server = createPrintService({ config: configuration({ dryRun }), now, spooler: {
    list: async () => [PRINTER, 'Microsoft Print to PDF'],
    print: async (...args) => { calls++; assert.equal(dryRun, false, 'dry-run nunca accede al spooler'); return print ? print(...args) : { bytesEscritos: args[1].length, idCola: 73 }; },
  } });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  const port = server.address().port;
  const request = (path, { method = 'GET', headers = {}, body } = {}) => new Promise((resolve, reject) => {
    const req = http.request({ hostname: '127.0.0.1', port, path, method,
      headers: { Origin: ORIGIN, 'X-Gesgrow-Print-Token': TOKEN, ...headers } }, res => {
      let text = '';
      res.setEncoding('utf8');
      res.on('data', part => text += part);
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: text ? JSON.parse(text) : null }));
    });
    req.on('error', reject);
    req.end(body);
  });
  return { request, calls: () => calls, server,
    post: (value = job(), headers = {}) => request('/imprimir', { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(value) }) };
}

test('health y listado autenticados; no revelan token ni TSPL', async t => {
  const f = await fixture(t);
  for (const path of ['/estado', '/health']) {
    const res = await f.request(path);
    assert.equal(res.status, 200);
    assert.equal(res.body.modo, 'dry-run');
    assert.equal(res.body.limites.cuerpoBytes, 104857600);
    assert.equal(JSON.stringify(res).includes(TOKEN), false);
    assert.equal(res.headers['cache-control'], 'no-store');
  }
  const res = await f.request('/impresoras');
  assert.equal(res.body.disponible, true);
  assert.deepEqual(res.body.impresoras, [PRINTER, 'Microsoft Print to PDF']);
  assert.equal(f.calls(), 0);
});

test('CORS allowlist, token y Host obligatorios en todos los endpoints', async t => {
  const f = await fixture(t);
  for (const path of ['/estado', '/impresoras', '/imprimir']) {
    for (const origin of ['', 'null', 'https://evil.example', ORIGIN + '/']) {
      const res = await f.request(path, { headers: { Origin: origin } });
      assert.equal(res.status, 403);
      assert.equal(typeof res.body.error, 'string');
      assert.equal(res.headers['access-control-allow-origin'], undefined);
    }
    assert.equal((await f.request(path, { headers: { 'X-Gesgrow-Print-Token': '' } })).status, 401);
    assert.equal((await f.request(path, { headers: { 'X-Gesgrow-Print-Token': 'wrong' } })).status, 401);
    assert.equal((await f.request(path, { headers: { Host: 'evil.example' } })).status, 403);
  }
});

test('preflight solo para origen, metodo y cabeceras permitidos; red privada', async t => {
  const f = await fixture(t);
  const res = await f.request('/imprimir', { method: 'OPTIONS', headers: {
    'X-Gesgrow-Print-Token': '', 'Access-Control-Request-Method': 'POST',
    'Access-Control-Request-Headers': 'content-type,x-gesgrow-print-token', 'Access-Control-Request-Private-Network': 'true' } });
  assert.equal(res.status, 204);
  assert.equal(res.headers['access-control-allow-origin'], ORIGIN);
  assert.equal(res.headers['access-control-allow-private-network'], 'true');
  assert.equal(res.headers['access-control-allow-credentials'], undefined);
  assert.equal((await f.request('/imprimir', { method: 'OPTIONS', headers: { 'Access-Control-Request-Method': 'DELETE' } })).status, 403);
  assert.equal((await f.request('/imprimir', { method: 'OPTIONS', headers: { 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'authorization' } })).status, 403);
});

test('contrato del portal: dry-run devuelve enviado=true, bytes completos y nunca imprime', async t => {
  const f = await fixture(t);
  const first = await f.post();
  assert.equal(first.status, 200);
  assert.equal(first.body.enviado, true);
  assert.equal(first.body.simulado, true);
  assert.equal(first.body.trabajoId, ID);
  assert.equal(first.body.bytesSolicitados, Buffer.byteLength(TSPL));
  assert.equal(first.body.bytesEscritos, 0);
  assert.equal(first.body.idCola, null);
  assert.match(first.body.sha256, /^[a-f0-9]{64}$/);
  assert.equal(f.calls(), 0);
  const replay = await f.post();
  assert.deepEqual(replay.body, first.body);
  assert.equal(replay.headers['x-idempotent-replay'], 'true');
  assert.equal((await f.post(job({ tspl: TSPL.replace('GG-000001', 'GG-000002') }))).status, 409);
});

test('RAW con spooler simulado verifica bytes y devuelve 202/idCola', async t => {
  const f = await fixture(t, { dryRun: false, print: async (printer, bytes, id) => {
    assert.equal(printer, PRINTER); assert.equal(bytes.toString(), TSPL); assert.equal(id, ID);
    return { bytesEscritos: bytes.length, idCola: 123 };
  } });
  const res = await f.post();
  assert.equal(res.status, 202);
  assert.equal(res.body.estado, 'encolado');
  assert.equal(res.body.simulado, false);
  assert.equal(res.body.bytesEscritos, res.body.bytesSolicitados);
  assert.equal(res.body.idCola, 123);
  await f.post();
  assert.equal(f.calls(), 1);
});

test('HTTP recibe 100000 paginas completas en un job sin truncar ni dividirlo', async t => {
  const f = await fixture(t);
  const tspl = HEADER + PAGE.repeat(100000);
  const response = await f.post(job({ tspl }));
  assert.equal(response.status, 200);
  assert.equal(response.body.paginas, 100000);
  assert.equal(response.body.bytesSolicitados, tspl.length);
  assert.equal(f.calls(), 0);
});

test('duplicados simultaneos esperan el mismo resultado y otros trabajos reciben 429', async t => {
  let release, started;
  const wait = new Promise(resolve => release = resolve);
  const ready = new Promise(resolve => started = resolve);
  const f = await fixture(t, { dryRun: false, print: async (_, bytes) => { started(); await wait; return { bytesEscritos: bytes.length, idCola: 44 }; } });
  const first = f.post();
  await ready;
  const replay = f.post();
  const other = await f.post(job({ trabajoId: randomUUID() }));
  assert.equal(other.status, 429);
  assert.equal((await f.request('/estado')).body.ocupado, true);
  release();
  const [a, b] = await Promise.all([first, replay]);
  assert.deepEqual(a.body, b.body);
  assert.equal(f.calls(), 1);
});

test('error parcial del spool se conserva y expone bytes/Win32 sin repetir WritePrinter', async t => {
  const f = await fixture(t, { dryRun: false, print: async () => {
    throw new ServiceError(502, 'SPOOL_ERROR', 'Fallo del spooler.', { etapa: 'WritePrinter', win32: 5,
      bytesSolicitados: TSPL.length, bytesEscritos: 10, idCola: 66, resultadoIncierto: true });
  } });
  const a = await f.post();
  const b = await f.post();
  assert.equal(a.status, 502);
  assert.equal(typeof a.body.error, 'string');
  assert.equal(a.body.bytesEscritos, 10);
  assert.equal(a.body.trabajoId, ID);
  assert.deepEqual(b.body, a.body);
  assert.equal(f.calls(), 1);
});

test('retencion de idempotencia acotada a una hora', async t => {
  let time = 0;
  const f = await fixture(t, { dryRun: false, now: () => time });
  await f.post(); time = LIMITS.retentionMs - 1; await f.post();
  assert.equal(f.calls(), 1);
  time++; await f.post();
  assert.equal(f.calls(), 2);
});

test('errores JSON, tipo, limites HTTP, comandos y rutas no llaman spooler', async t => {
  const f = await fixture(t);
  assert.equal((await f.post(job({ tspl: TSPL + 'RUN "bad"\r\n' }))).status, 400);
  assert.equal((await f.post(job(), { 'Content-Type': 'text/plain' })).status, 415);
  assert.equal((await f.post(job(), { 'Content-Encoding': 'gzip' })).status, 415);
  assert.equal((await f.request('/imprimir', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{' })).status, 400);
  assert.equal((await f.request('/imprimir', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': LIMITS.bodyBytes + 1 } })).status, 413);
  assert.equal((await f.request('/imprimir')).status, 405);
  assert.equal((await f.request('/estado?token=secret')).status, 404);
  assert.equal((await f.request('/comando')).status, 404);
  assert.equal(f.calls(), 0);
});
