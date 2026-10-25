import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { win32 } from 'node:path';
import { createSpooler } from '../spooler.mjs';
import { ID, PRINTER, TSPL } from './fixtures.mjs';

// A process made entirely from in-memory streams. It cannot start PowerShell or print.
function fakeProcess(reply, { exit = 0, hang = false, startError = false } = {}) {
  const calls = [];
  let killed = false;
  const spawnProcess = (...args) => {
    const child = new EventEmitter();
    child.stdout = new PassThrough(); child.stderr = new PassThrough(); child.stdin = new PassThrough();
    child.kill = () => { killed = true; child.emit('close', 1); };
    const chunks = [];
    calls.push({ args, chunks });
    child.stdin.on('data', part => chunks.push(part));
    child.stdin.on('finish', () => queueMicrotask(() => {
      if (startError) { child.emit('error', new Error('private diagnostic')); return; }
      if (hang) return;
      child.stderr.write('sensitive diagnostics must never be returned');
      child.stdout.write(typeof reply === 'string' ? reply : JSON.stringify(reply));
      child.emit('close', exit);
    }));
    return child;
  };
  return { calls, spawnProcess, killed: () => killed };
}

test('RAW por stdin binario, proceso oculto, sin shell, ni datos del trabajo en argumentos', async () => {
  const bytes = Buffer.from(TSPL);
  const fake = fakeProcess({ ok: true, bytesRequested: bytes.length, bytesWritten: bytes.length, jobId: 87 });
  const spooler = createSpooler({ platform: 'win32', spawnProcess: fake.spawnProcess });
  assert.deepEqual(await spooler.print(PRINTER, bytes, ID), { bytesEscritos: bytes.length, idCola: 87 });
  const { args: [command, args, options], chunks } = fake.calls[0];
  assert.match(command, /System32\\WindowsPowerShell\\v1\.0\\powershell\.exe$/);
  assert.equal(options.shell, false); assert.equal(options.windowsHide, true);
  assert.equal(args.includes(PRINTER), false); assert.equal(args.includes(ID), false);
  assert.equal(args.at(-1), 'Print');
  const wire = Buffer.concat(chunks);
  const length = wire.readUInt32LE();
  assert.deepEqual(JSON.parse(wire.subarray(4, 4 + length).toString()), { printer: PRINTER, bytesRequested: bytes.length, jobId: ID });
  assert.deepEqual(wire.subarray(4 + length), bytes);
});

test('enumera impresoras con resultado vacio o varios nombres', async () => {
  for (const printers of [[], [PRINTER, 'Otra cola']]) {
    const fake = fakeProcess({ ok: true, printers });
    assert.deepEqual(await createSpooler({ platform: 'win32', spawnProcess: fake.spawnProcess }).list(), printers);
    assert.equal(fake.calls[0].args[1].at(-1), 'List');
  }
});

test('errores Win32 y escritura parcial preservan bytes, idCola e incertidumbre', async () => {
  const bytes = Buffer.from(TSPL);
  const fake = fakeProcess({ ok: false, stage: 'WritePrinter', win32: 5, bytesWritten: 10, jobId: 2,
    uncertain: true, abortAttempted: true, abortSucceeded: true }, { exit: 1 });
  await assert.rejects(createSpooler({ platform: 'win32', spawnProcess: fake.spawnProcess }).print(PRINTER, bytes, ID), error => {
    assert.equal(error.code, 'SPOOL_ERROR');
    assert.deepEqual(error.details, { etapa: 'WritePrinter', win32: 5, idCola: 2, bytesSolicitados: bytes.length,
      bytesEscritos: 10, resultadoIncierto: true, abortoIntentado: true, abortoConfirmado: true });
    assert.equal(error.message.includes('sensitive'), false);
    return true;
  });
});

test('no considera exito una escritura incompleta ni respuestas corruptas', async () => {
  const bytes = Buffer.from(TSPL);
  for (const reply of ['not JSON', 'null', { ok: true, jobId: 7, bytesRequested: bytes.length, bytesWritten: bytes.length - 1 },
    { ok: true, jobId: 0, bytesRequested: bytes.length, bytesWritten: bytes.length }]) {
    const fake = fakeProcess(reply);
    await assert.rejects(createSpooler({ platform: 'win32', spawnProcess: fake.spawnProcess }).print(PRINTER, bytes, ID), error => {
      assert.equal(error.status, 502); assert.equal(error.details.resultadoIncierto, true); return true;
    });
  }
});

test('timeout mata el helper, informa bytes desconocidos y nunca reintenta', async () => {
  const fake = fakeProcess(null, { hang: true });
  await assert.rejects(createSpooler({ platform: 'win32', spawnProcess: fake.spawnProcess, timeoutMs: 10 }).print(PRINTER, Buffer.from(TSPL), ID), error => {
    assert.equal(error.code, 'SPOOL_TIMEOUT'); assert.equal(error.details.bytesEscritos, null);
    assert.equal(error.details.resultadoIncierto, true); return true;
  });
  assert.equal(fake.killed(), true); assert.equal(fake.calls.length, 1);
});

test('helper inexistente y plataforma incompatible dan errores controlados', async () => {
  const fake = fakeProcess(null, { startError: true });
  await assert.rejects(createSpooler({ platform: 'win32', spawnProcess: fake.spawnProcess }).list(), { code: 'HELPER_NO_DISPONIBLE' });
  await assert.rejects(createSpooler({ platform: 'linux', spawnProcess: () => assert.fail('No debe ejecutar procesos') }).print(PRINTER, Buffer.from(TSPL), ID), { code: 'WINDOWS_REQUERIDO' });
});

test('PowerShell compila P/Invoke en SelfTest sin invocar winspool', { skip: process.platform !== 'win32' }, async () => {
  const command = win32.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
  const { stdout, stderr } = await promisify(execFile)(command, ['-NoLogo', '-NoProfile', '-NonInteractive',
    '-ExecutionPolicy', 'Bypass', '-File', fileURLToPath(new URL('../winspool.ps1', import.meta.url)), '-Action', 'SelfTest'], { windowsHide: true, timeout: 30000 });
  assert.deepEqual(JSON.parse(stdout.trim()), { ok: true, compiled: true });
  assert.equal(stderr, '');
});
