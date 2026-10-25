import http from 'node:http';
import { createHash, timingSafeEqual } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { LIMITS, ServiceError, readConfig, validateConfig } from './config.mjs';
import { validatePrintJob } from './tspl.mjs';
import { createSpooler } from './spooler.mjs';

const hash = value => createHash('sha256').update(value).digest();
const errorResult = error => ({ status: error instanceof ServiceError ? error.status : 500,
  body: error instanceof ServiceError
    ? { error: error.message, codigo: error.code, ...error.details }
    : { error: 'No se pudo completar la operacion.', codigo: 'ERROR_INTERNO' } });

async function readJson(req) {
  if (!/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(req.headers['content-type'] || '')) {
    throw new ServiceError(415, 'TIPO_INVALIDO', 'Use Content-Type: application/json.');
  }
  if (req.headers['content-encoding'] && req.headers['content-encoding'] !== 'identity') {
    throw new ServiceError(415, 'CODIFICACION_INVALIDA', 'No se aceptan cuerpos comprimidos.');
  }
  if (Number(req.headers['content-length']) > LIMITS.bodyBytes) throw new ServiceError(413, 'CUERPO_GRANDE', 'Maximo 100 MiB de cuerpo JSON.');
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    const timer = setTimeout(() => finish(new ServiceError(408, 'CUERPO_TIMEOUT', 'Tiempo de recepcion agotado.')), LIMITS.bodyTimeoutMs);
    const cleanup = () => {
      clearTimeout(timer);
      req.off('data', onData);
      req.off('end', onEnd);
      req.off('error', onError);
      req.off('aborted', onError);
    };
    const finish = (error, value) => {
      cleanup();
      if (error) { req.resume(); reject(error); } else resolve(value);
    };
    const onData = chunk => {
      size += chunk.length;
      if (size > LIMITS.bodyBytes) finish(new ServiceError(413, 'CUERPO_GRANDE', 'Maximo 100 MiB de cuerpo JSON.'));
      else chunks.push(chunk);
    };
    const onError = () => finish(new ServiceError(400, 'CUERPO_INCOMPLETO', 'Recepcion incompleta.'));
    const onEnd = () => {
      let parsed;
      try { parsed = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks))); }
      catch { finish(new ServiceError(400, 'JSON_INVALIDO', 'JSON UTF-8 invalido.')); return; }
      finish(null, parsed);
    };
    req.on('data', onData);
    req.on('end', onEnd);
    req.on('error', onError);
    req.on('aborted', onError);
  });
}

export function createPrintService({ config: input, spooler = createSpooler(), now = Date.now }) {
  const config = validateConfig(input);
  const secretHash = hash(config.token);
  const origins = new Set(config.origins);
  const jobs = new Map();
  let busy = false;
  let receiving = false;
  const routes = new Map([['/estado', 'GET'], ['/health', 'GET'], ['/impresoras', 'GET'], ['/imprimir', 'POST']]);

  const server = http.createServer({ maxHeaderSize: 8192 }, async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Vary', 'Origin');
    const send = ({ status, body }, replay = false) => {
      if (res.destroyed) return;
      if (replay) res.setHeader('X-Idempotent-Replay', 'true');
      res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(body));
    };
    try {
      // Explicit Origin is mandatory even for scripts. No wildcard, null or Referer fallback.
      const origin = req.headers.origin;
      if (typeof origin !== 'string' || !origins.has(origin)) throw new ServiceError(403, 'ORIGIN_NO_PERMITIDO', 'Origin ausente o no permitido.');
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Expose-Headers', 'X-Idempotent-Replay');
      const port = server.address()?.port ?? config.port;
      if (![`${config.host}:${port}`, `localhost:${port}`].includes(req.headers.host)) {
        throw new ServiceError(403, 'HOST_NO_PERMITIDO', 'Host local invalido.');
      }
      const method = routes.get(req.url);
      if (req.method === 'OPTIONS') {
        if (!method) throw new ServiceError(404, 'RUTA_NO_ENCONTRADA', 'Ruta no encontrada.');
        const headers = (req.headers['access-control-request-headers'] || '').toLowerCase().split(',').map(h => h.trim()).filter(Boolean);
        if (req.headers['access-control-request-method'] !== method || headers.some(h => !['content-type', 'x-gesgrow-print-token'].includes(h))) {
          throw new ServiceError(403, 'PREFLIGHT_INVALIDO', 'Preflight no permitido.');
        }
        res.setHeader('Access-Control-Allow-Methods', method);
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Gesgrow-Print-Token');
        res.setHeader('Access-Control-Max-Age', '600');
        if (req.headers['access-control-request-private-network'] === 'true') res.setHeader('Access-Control-Allow-Private-Network', 'true');
        res.writeHead(204);
        res.end();
        return;
      }
      const token = req.headers['x-gesgrow-print-token'];
      if (typeof token !== 'string' || token.length > 128 || !timingSafeEqual(hash(token), secretHash)) {
        throw new ServiceError(401, 'TOKEN_INVALIDO', 'Token ausente o invalido.');
      }
      if (!method) throw new ServiceError(404, 'RUTA_NO_ENCONTRADA', 'Ruta no encontrada.');
      if (req.method !== method) {
        res.setHeader('Allow', `${method}, OPTIONS`);
        throw new ServiceError(405, 'METODO_NO_PERMITIDO', 'Metodo no permitido.');
      }
      if (req.url === '/estado' || req.url === '/health') {
        send({ status: 200, body: { ok: true, servicio: 'gesgrow-impresion-tsc', version: 1,
          modo: config.dryRun ? 'dry-run' : 'raw', impresora: config.printer, ocupado: busy || receiving,
          limites: { paginas: LIMITS.pages, cuerpoBytes: LIMITS.bodyBytes, tsplBytes: LIMITS.tsplBytes,
            retencionJobMs: LIMITS.retentionMs } } });
        return;
      }
      if (req.url === '/impresoras') {
        const printers = await spooler.list();
        send({ status: 200, body: { ok: true, impresoras: printers,
          impresoraConfigurada: config.printer, disponible: printers.includes(config.printer) } });
        return;
      }
      if (receiving) throw new ServiceError(429, 'SERVICIO_OCUPADO', 'Ya se esta recibiendo otro trabajo.');
      let validated;
      receiving = true;
      try { validated = validatePrintJob(await readJson(req), config.printer); }
      finally { receiving = false; }
      const { trabajoId, bytes, pages } = validated;
      const digest = createHash('sha256').update(bytes).digest('hex');
      const fingerprint = digest;
      for (const [id, record] of jobs) if (record.expires !== null && record.expires <= now()) jobs.delete(id);
      const previous = jobs.get(trabajoId);
      if (previous) {
        if (previous.fingerprint !== fingerprint) throw new ServiceError(409, 'JOB_CONFLICTO', 'El trabajoId ya se uso con otro contenido.');
        send(await previous.promise, true);
        return;
      }
      if (busy || jobs.size >= LIMITS.jobs) throw new ServiceError(429, 'SERVICIO_OCUPADO', 'Espere antes de enviar otro trabajo.');
      busy = true;
      const record = { fingerprint, expires: null, promise: null };
      record.promise = (async () => {
        try {
          const result = config.dryRun ? { bytesEscritos: 0, idCola: null } : await spooler.print(config.printer, bytes, trabajoId);
          return { status: config.dryRun ? 200 : 202, body: { enviado: true, trabajoId,
            estado: config.dryRun ? 'simulado' : 'encolado', modo: config.dryRun ? 'dry-run' : 'raw',
            simulado: config.dryRun, impresora: config.printer, paginas: pages, bytesSolicitados: bytes.length,
            bytesEscritos: result.bytesEscritos, idCola: result.idCola, sha256: digest } };
        } catch (error) {
          const result = errorResult(error);
          result.body.trabajoId = trabajoId;
          return result;
        } finally {
          busy = false;
          record.expires = now() + LIMITS.retentionMs;
        }
      })();
      jobs.set(trabajoId, record);
      send(await record.promise);
    } catch (error) {
      if (!req.complete) res.setHeader('Connection', 'close');
      req.resume();
      send(errorResult(error));
    }
  });
  server.requestTimeout = LIMITS.bodyTimeoutMs;
  server.headersTimeout = 10000;
  server.keepAliveTimeout = 5000;
  server.maxHeadersCount = 50;
  server.maxConnections = 32;
  server.maxRequestsPerSocket = 100;
  return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const args = process.argv.slice(2);
    if (args.length && (args.length !== 2 || args[0] !== '--config')) throw new Error('Uso: node server.mjs [--config ruta.json]');
    const config = readConfig(args[1]);
    const server = createPrintService({ config });
    server.on('error', () => { console.error('No se pudo abrir el servicio local; compruebe el puerto y la configuracion.'); process.exitCode = 1; });
    server.listen(config.port, config.host, () => console.log(`Servicio TSC en http://${config.host}:${config.port} (${config.dryRun ? 'dry-run' : 'raw'}).`));
    for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close());
  } catch {
    console.error('No se pudo iniciar. Revise la configuracion o ejecute setup.mjs. No registre el token.');
    process.exitCode = 1;
  }
}
