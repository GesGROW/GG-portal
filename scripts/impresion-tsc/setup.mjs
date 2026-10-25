import { randomBytes } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { DEFAULT_CONFIG, validateConfig } from './config.mjs';

try {
  const args = process.argv.slice(2);
  if (args.length !== 4 || args[0] !== '--origin' || args[2] !== '--printer') {
    throw new Error('Uso: node setup.mjs --origin http://localhost:5174 --printer "TSC TTP-247"');
  }
  const { host, ...config } = validateConfig({ origins: [args[1]], printer: args[3], token: randomBytes(32).toString('base64url') });
  writeFileSync(DEFAULT_CONFIG, `${JSON.stringify(config, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
  console.log('Configuracion local creada en modo seco. El token solo esta en config.local.json.');
} catch (error) {
  console.error(error.code === 'EEXIST' ? 'config.local.json ya existe; no se sobrescribio.' : 'No se creo la configuracion. Uso: node setup.mjs --origin http://localhost:5174 --printer "TSC TTP-247"');
  process.exitCode = 1;
}
