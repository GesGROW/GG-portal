import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validatePrintJob } from '../tspl.mjs';
import { validateConfig, LIMITS } from '../config.mjs';
import { HEADER, PAGE, PRINTER, TSPL, configuration, job } from './fixtures.mjs';

test('preserva barras Code128 del encoder sin recodificar; termina el ultimo comando', () => {
  const result = validatePrintJob(job(), PRINTER);
  assert.equal(result.bytes.toString('ascii'), TSPL);
  assert.equal(result.pages, 1);
  assert.equal(validatePrintJob(job({ tspl: TSPL.trimEnd() }), PRINTER).bytes.toString(), TSPL);
  assert.equal(validatePrintJob(job({ tspl: TSPL.replaceAll('\r\n', '\n') }), PRINTER).pages, 1);
});

test('rechaza comandos, escapes y expresiones aunque aparezcan despues de un trabajo valido', () => {
  for (const command of ['BARCODE 0,0,"128",80,1,0,2,2,"123"', 'QRCODE 1,1,M,4,A,0,"123"',
    'RUN "evil.bas"', 'DOWNLOAD "evil.bas",1,X', 'KILL "*"', 'FEED 10', 'PRINT 2,1',
    'BAR -1,0,2,2', 'BAR 1+1,0,2,2', 'BAR 0,0,1e2,10', 'BAR 0,0,0,1',
    'TEXT 1,1,"1",0,1,1,"abc"+CHR$(10)', 'TEXT 1,1,"1",0,1,1,"abc\\ndef"',
    'TEXT 1,1,"1",0,1,1,"caf\u00e9"', 'TEXT 1,1,"1",0,1,1,"a\u001bb"',
    'BAR 0,0,1,10\rRUN "evil"', '~JA']) {
    assert.throws(() => validatePrintJob(job({ tspl: HEADER + PAGE.replace('PRINT 1,1', command + '\r\nPRINT 1,1') }), PRINTER), /TSPL/);
  }
  assert.throws(() => validatePrintJob(job({ tspl: TSPL + 'RUN "evil"\r\n' }), PRINTER), /TSPL/);
});

test('valida orden, ancho maximo 108mm, altura 20mm, limites fisicos y cantidad por pagina', () => {
  for (const tspl of [TSPL.replace('96 mm', '109 mm'), TSPL.replace('96 mm', '9 mm'),
    TSPL.replace('20 mm', '21 mm'), TSPL.replace('GAP 2', 'GAP 11'), TSPL.replace('OFFSET 0 mm\r\n', ''),
    TSPL.replace('SET TEAR ON', 'SET TEAR OFF'), TSPL.replace('DIRECTION 1', 'DIRECTION 0'),
    TSPL.replace('BAR 16,16,2,80', 'BAR 767,16,2,80'), TSPL.replace('BAR 16,16,2,80', 'BAR 0,159,2,2'),
    TSPL.replace('TEXT 16,112', 'TEXT 760,112'), TSPL.replace('TEXT 16,112', 'TEXT 16,150'),
    HEADER + 'PRINT 1,1\r\n', HEADER + 'CLS\r\nPRINT 1,1\r\n', HEADER + 'CLS\r\nBAR 0,0,1,1\r\n',
    TSPL.replace('CLS\r\n', 'CLS\r\nCLS\r\n'),
    HEADER + 'CLS\r\n' + 'BAR 0,0,1,1\r\n'.repeat(1025) + 'PRINT 1,1\r\n']) {
    assert.throws(() => validatePrintJob(job({ tspl }), PRINTER), /TSPL/);
  }
  assert.equal(validatePrintJob(job({ tspl: TSPL.replace('96 mm', '108 mm') }), PRINTER).pages, 1);
});

test('soporta 100000 paginas con 50 barras por pagina sin truncar (~77 MiB)', () => {
  const page = 'CLS\r\n' + Array.from({ length: 50 }, (_, i) => `BAR ${16 + i * 3},16,2,80\r\n`).join('')
    + 'TEXT 16,112,"1",0,1,1,"GG-000001"\r\nPRINT 1,1\r\n';
  const tspl = HEADER + page.repeat(100000);
  const result = validatePrintJob(job({ tspl }), PRINTER);
  assert.equal(result.pages, 100000);
  assert.equal(result.bytes.length, tspl.length);
  assert.equal(result.bytes.subarray(-page.length).toString('ascii'), page);
  assert.ok(Buffer.byteLength(JSON.stringify(job({ tspl }))) < LIMITS.bodyBytes);
});

test('rechaza 100001 paginas y TSPL mayor a 100MiB, sin enviar un prefijo', () => {
  assert.throws(() => validatePrintJob(job({ tspl: HEADER + PAGE.repeat(100001) }), PRINTER), /TSPL/);
  assert.throws(() => validatePrintJob(job({ tspl: 'x'.repeat(LIMITS.tsplBytes + 1) }), PRINTER), e => e.status === 413);
});

test('trabajo cerrado y cola configurada: no acepta scripts, propiedades extra o UUID invalido', () => {
  for (const value of [null, [], {}, job({ trabajoId: 'bad' }), job({ impresora: 'otra' }), job({ copias: 2 }), job({ comando: 'cmd /c calc' })]) {
    assert.throws(() => validatePrintJob(value, PRINTER));
  }
});

test('configuracion exige token fuerte, origen exacto y nunca admite host publico', () => {
  assert.equal(validateConfig(configuration()).host, '127.0.0.1');
  assert.equal(validateConfig(configuration()).port, 18191);
  for (const extra of [{ origins: [] }, { origins: ['*'] }, { origins: ['null'] }, { origins: ['https://example.com/'] },
    { origins: ['file:///tmp'] }, { token: 'short' }, { token: 'REEMPLAZAR_CON_TOKEN_ALEATORIO_DE_AL_MENOS_32_CARACTERES' },
    { host: '0.0.0.0' }, { port: 0 }, { dryRun: 'false' }, { printer: 'queue\ncommand' }]) {
    assert.throws(() => validateConfig(configuration(extra)), /Configuracion/);
  }
});
