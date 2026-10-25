import { LIMITS, ServiceError } from './config.mjs';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const NUMBER = '(?:[0-9]{1,3})(?:\\.[0-9]{1,3})?';
const SIZE = new RegExp(`^SIZE (${NUMBER}) mm, *20 mm$`);
const GAP = new RegExp(`^GAP (${NUMBER}) mm, *0 mm$`);
const BAR = /^BAR ([0-9]{1,4}), *([0-9]{1,3}), *([0-9]{1,4}), *([0-9]{1,3})$/;
const TEXT = /^TEXT ([0-9]{1,4}), *([0-9]{1,3}), *"1", *0, *1, *1, *"([\x20-\x21\x23-\x5b\x5d-\x7e]{1,108})"$/;
const invalid = line => { throw new ServiceError(400, 'TSPL_INVALIDO', 'TSPL fuera de la plantilla permitida o de los limites del papel.', line ? { linea: line } : {}); };

// Exact grammar, order and geometry; the caller's JSBarcode encoder supplies Code128 bars.
export function validatePrintJob(input, printer) {
  if (!input || typeof input !== 'object' || Array.isArray(input)
    || Object.keys(input).some(k => !['trabajoId', 'impresora', 'tspl'].includes(k))
    || typeof input.trabajoId !== 'string' || !UUID.test(input.trabajoId)
    || typeof input.impresora !== 'string' || typeof input.tspl !== 'string') {
    throw new ServiceError(400, 'JOB_INVALIDO', 'Use {trabajoId: UUID, impresora: string, tspl: string}.');
  }
  if (input.impresora !== printer) throw new ServiceError(400, 'IMPRESORA_NO_PERMITIDA', 'La impresora debe coincidir con la configurada localmente.');
  if (!input.tspl.length || input.tspl.length > LIMITS.tsplBytes) throw new ServiceError(413, 'TSPL_GRANDE', 'TSPL vacio o mayor a 100 MiB.');
  let position = 0, lineNumber = 0, header = 0, width = 0, pages = 0, bars = 0, texts = 0, active = false;
  const fixedHeader = ['DIRECTION 1', 'REFERENCE 0,0', 'OFFSET 0 mm', 'SET TEAR ON'];
  while (position < input.tspl.length) {
    let end = input.tspl.indexOf('\n', position);
    if (end === -1) end = input.tspl.length;
    let line = input.tspl.slice(position, end);
    if (line.endsWith('\r')) line = line.slice(0, -1);
    position = end + 1;
    lineNumber++;
    if (!line || line.length > 256) invalid(lineNumber);
    if (header === 0) {
      const match = SIZE.exec(line);
      if (!match || Number(match[1]) < 10 || Number(match[1]) > 108) invalid(lineNumber);
      width = Math.floor(Number(match[1]) * 8);
      header++;
    } else if (header === 1) {
      const match = GAP.exec(line);
      if (!match || Number(match[1]) > 10) invalid(lineNumber);
      header++;
    } else if (header < 6) {
      if (line !== fixedHeader[header - 2]) invalid(lineNumber);
      header++;
    } else if (line === 'CLS') {
      if (active) invalid(lineNumber);
      active = true; bars = 0; texts = 0;
    } else if (line === 'PRINT 1,1') {
      if (!active || !bars || ++pages > LIMITS.pages) invalid(lineNumber);
      active = false;
    } else {
      if (!active) invalid(lineNumber);
      const bar = BAR.exec(line);
      const text = bar ? null : TEXT.exec(line);
      if (bar) {
        const [, x, y, w, h] = bar.map(Number);
        if (w < 1 || h < 1 || x + w > width || y + h > 160 || ++bars > 1024) invalid(lineNumber);
      } else if (text) {
        const x = Number(text[1]), y = Number(text[2]);
        if (x + text[3].length * 8 > width || y + 12 > 160 || ++texts > 16) invalid(lineNumber);
      } else invalid(lineNumber);
    }
  }
  if (active || !pages || header !== 6) invalid(lineNumber);
  const terminated = input.tspl.endsWith('\n') ? input.tspl : `${input.tspl}\r\n`;
  if (terminated.length > LIMITS.tsplBytes) throw new ServiceError(413, 'TSPL_GRANDE', 'Maximo 100 MiB de TSPL incluyendo terminador.');
  return { trabajoId: input.trabajoId.toLowerCase(), bytes: Buffer.from(terminated, 'ascii'), pages };
}
