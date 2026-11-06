// Ejecuta un comando cargando antes el `.env` de la raíz del monorepo (si existe).
// Las variables ya definidas en el entorno (CI, Render) tienen prioridad.
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const envFile = resolve(root, '.env');

const before = new Set(Object.keys(process.env));
if (existsSync(envFile)) {
  // process.loadEnvFile no pisa variables ya definidas
  process.loadEnvFile(envFile);
}
const loaded = Object.keys(process.env).filter((key) => !before.has(key));
if (loaded.length > 0 && process.env.SIGPRO_VERBOSE) console.log(`[env] cargadas desde .env: ${loaded.join(', ')}`);

const [command, ...args] = process.argv.slice(2);
if (!command) {
  console.error('Uso: node scripts/run-with-env.mjs <comando> [args…]');
  process.exit(1);
}

// pnpm añade node_modules/.bin al PATH al ejecutar scripts; `shell: true` resuelve .cmd en Windows
const result = spawnSync(command, args, { stdio: 'inherit', shell: true, env: process.env });
process.exit(result.status ?? 1);
