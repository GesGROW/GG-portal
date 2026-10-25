import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { win32 } from 'node:path';
import { LIMITS, ServiceError } from './config.mjs';

const helper = fileURLToPath(new URL('./winspool.ps1', import.meta.url));
const failed = (code, details = {}) => new ServiceError(502, code, 'Fallo del spooler de Windows; revise etapa, codigo Win32 y bytes. No reintente automaticamente.', details);

export function createSpooler({ platform = process.platform, spawnProcess = spawn,
  systemRoot = process.env.SystemRoot || 'C:\\Windows', timeoutMs = LIMITS.helperTimeoutMs } = {}) {
  async function invoke(action, input) {
    if (platform !== 'win32') throw new ServiceError(503, 'WINDOWS_REQUERIDO', 'El spooler RAW requiere Windows.');
    const printing = action === 'Print';
    return new Promise((resolve, reject) => {
      const child = spawnProcess(win32.join(systemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe'),
        ['-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', helper, '-Action', action],
        { shell: false, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
      let stdout = '';
      child.stdout.setEncoding('utf8');
      let settled = false;
      const uncertain = { resultadoIncierto: printing, bytesEscritos: null, bytesSolicitados: input?.bytesRequested ?? 0 };
      const finish = (error, value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (error) reject(error); else resolve(value);
      };
      const timer = setTimeout(() => {
        finish(failed('SPOOL_TIMEOUT', uncertain));
        child.kill();
      }, timeoutMs);
      child.stdout.on('data', chunk => {
        stdout += chunk.toString('utf8');
        if (Buffer.byteLength(stdout) > 262144) {
          finish(failed('HELPER_RESPUESTA_INVALIDA', uncertain));
          child.kill();
        }
      });
      // Never relay stderr: PowerShell diagnostics can include input or local paths.
      child.stderr.on('data', () => {});
      child.stdin.on('error', () => {});
      child.on('error', () => finish(failed('HELPER_NO_DISPONIBLE', { ...uncertain, resultadoIncierto: false })));
      child.on('close', exitCode => {
        if (settled) return;
        let result;
        try { result = JSON.parse(stdout.replace(/^\uFEFF/, '').trim()); }
        catch { finish(failed('HELPER_RESPUESTA_INVALIDA', uncertain)); return; }
        if (!result || typeof result !== 'object' || typeof result.ok !== 'boolean') {
          finish(failed('HELPER_RESPUESTA_INVALIDA', uncertain)); return;
        }
        if (!result.ok) {
          const stages = ['Validate', 'OpenPrinter', 'StartDocPrinter', 'StartPagePrinter', 'WritePrinter', 'EndPagePrinter', 'EndDocPrinter', 'ClosePrinter', 'EnumPrinters', 'Helper'];
          finish(failed('SPOOL_ERROR', {
            etapa: stages.includes(result.stage) ? result.stage : 'Helper',
            win32: Number.isInteger(result.win32) && result.win32 >= 0 ? result.win32 : null,
            idCola: Number.isInteger(result.jobId) && result.jobId > 0 ? result.jobId : null,
            bytesSolicitados: input?.bytesRequested ?? 0,
            bytesEscritos: Number.isInteger(result.bytesWritten) && result.bytesWritten >= 0 && result.bytesWritten <= (input?.bytesRequested ?? 0) ? result.bytesWritten : null,
            resultadoIncierto: printing && result.uncertain !== false,
            abortoIntentado: result.abortAttempted === true,
            abortoConfirmado: result.abortSucceeded === true,
          }));
          return;
        }
        if (exitCode !== 0) { finish(failed('HELPER_RESPUESTA_INVALIDA', uncertain)); return; }
        if (printing) {
          if (result.bytesWritten !== input.bytesRequested || result.bytesRequested !== input.bytesRequested || !Number.isInteger(result.jobId) || result.jobId < 1) {
            finish(failed('ESCRITURA_INCOMPLETA', { ...uncertain, bytesEscritos: Number.isInteger(result.bytesWritten) ? result.bytesWritten : null }));
          } else finish(null, { bytesEscritos: result.bytesWritten, idCola: result.jobId });
        } else if (Array.isArray(result.printers) && result.printers.every(p => typeof p === 'string' && p.length <= 200 && !/[\x00-\x1f\x7f]/.test(p))) {
          finish(null, result.printers);
        } else finish(failed('HELPER_RESPUESTA_INVALIDA', uncertain));
      });
      if (input) {
        // Small length-prefixed UTF-8 metadata followed by exact RAW bytes, without base64.
        const metadata = Buffer.from(JSON.stringify({ printer: input.printer, bytesRequested: input.bytesRequested, jobId: input.jobId }), 'utf8');
        const prefix = Buffer.alloc(4);
        prefix.writeUInt32LE(metadata.length);
        child.stdin.write(prefix);
        child.stdin.write(metadata);
        child.stdin.end(input.bytes);
      } else child.stdin.end();
    });
  }
  return {
    list: () => invoke('List'),
    print: (printer, bytes, jobId) => invoke('Print', { printer, bytes, bytesRequested: bytes.length, jobId }),
  };
}
