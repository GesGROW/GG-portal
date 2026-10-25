import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const DEFAULT_CONFIG = fileURLToPath(new URL('./config.local.json', import.meta.url));
export const LIMITS = Object.freeze({ bodyBytes: 100 * 1024 * 1024, pages: 100000, tsplBytes: 100 * 1024 * 1024,
  bodyTimeoutMs: 120000, helperTimeoutMs: 120000, retentionMs: 3600000, jobs: 1000 });

export class ServiceError extends Error {
  constructor(status, code, message, details = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function validateConfig(input) {
  const fail = () => { throw new Error('Configuracion invalida; revise config.example.json (no incluya secretos en logs).'); };
  if (!input || typeof input !== 'object' || Array.isArray(input)) fail();
  if (Object.keys(input).some(k => !['port', 'origins', 'token', 'printer', 'dryRun'].includes(k))) fail();
  const { port = 18191, origins, token, printer, dryRun = true } = input;
  if (!Number.isInteger(port) || port < 1024 || port > 65535) fail();
  if (!Array.isArray(origins) || origins.length < 1 || origins.length > 20) fail();
  for (const origin of origins) {
    try {
      const url = new URL(origin);
      if (!['http:', 'https:'].includes(url.protocol) || url.origin !== origin || url.username || url.password) fail();
    } catch { fail(); }
  }
  if (new Set(origins).size !== origins.length) fail();
  if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{32,128}$/.test(token) || token.startsWith('REEMPLAZAR')) fail();
  if (typeof printer !== 'string' || !printer.trim() || printer !== printer.trim() || printer.length > 200 || /[\x00-\x1f\x7f]/.test(printer)) fail();
  if (typeof dryRun !== 'boolean') fail();
  return Object.freeze({ host: '127.0.0.1', port, origins: Object.freeze([...origins]), token, printer, dryRun });
}

export function readConfig(path = DEFAULT_CONFIG) {
  let parsed;
  try { parsed = JSON.parse(readFileSync(path, 'utf8')); }
  catch { throw new Error('No se pudo leer la configuracion JSON; ejecute setup.mjs o revise --config.'); }
  return validateConfig(parsed);
}
