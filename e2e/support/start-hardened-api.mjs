// Tercera instancia de la API: el despliegue «endurecido» del curso (sufijos de tenant, laboratorio cerrado, solo correos ficticios y
// sin indexar), para los specs de e2e/tests/hardened. La API principal (:3000) sigue sin ninguna de estas variables: es la prueba de
// que, sin ellas, todo funciona como hoy.
//
//  - Usa su PROPIO schema de Postgres (`e2e_hardened`): así sembrar tenants con sufijo no ensucia la base que usan los demás specs.
//  - Se niega a arrancar si la base de datos no es local: estos specs reinician y crean datos y NUNCA deben tocar QA ni Render.
//  - Escribe su salida en un archivo (E2E_HARDENED_LOG) que lee hardened/logs.spec.ts para comprobar que el log no lleva datos sensibles.
//
// Espera a que la API principal responda (así `dist` ya está compilado) y arranca la suya en el puerto 3200.
import { spawn, spawnSync } from 'node:child_process';
import { createWriteStream, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const MAIN_API = process.env.E2E_API_URL ?? 'http://localhost:3000/api';
const PORT = process.env.E2E_HARDENED_API_PORT ?? '3200';
const WEB_PORT = process.env.E2E_HARDENED_WEB_PORT ?? '5199';
const LOG_FILE = process.env.E2E_HARDENED_LOG ?? join(tmpdir(), 'sigpro-e2e-hardened-api.log');
const SCHEMA = 'e2e_hardened';

// Misma `DATABASE_URL` que usa la API principal: la del entorno o, si no, la del `.env` de la raíz (como `run-with-env.mjs`)
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
if (!process.env.DATABASE_URL && existsSync(join(root, '.env'))) process.loadEnvFile(join(root, '.env'));
const baseUrl = process.env.DATABASE_URL;
if (!baseUrl) {
  console.error('[hardened-api] falta DATABASE_URL');
  process.exit(1);
}

const database = new URL(baseUrl);
if (!['localhost', '127.0.0.1', '::1', '[::1]'].includes(database.hostname)) {
  console.error(`[hardened-api] la base de datos no es local (host «${database.hostname}»): estos e2e solo se ejecutan contra una base local. Abortado.`);
  process.exit(1);
}
database.searchParams.set('schema', SCHEMA);
const databaseUrl = database.toString();

const sleep = (ms) => new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
const mainIsUp = async () => fetch(`${MAIN_API}/health`).then((response) => response.ok, () => false);
const deadline = Date.now() + 110_000;
while (Date.now() < deadline && !(await mainIsUp())) await sleep(1000);

// Crea el schema y aplica las migraciones en él (no toca el schema `public`)
const migrate = spawnSync('pnpm', ['--filter', 'api', 'prisma:deploy'], { stdio: 'inherit', shell: true, env: { ...process.env, DATABASE_URL: databaseUrl } });
if (migrate.status !== 0) process.exit(migrate.status ?? 1);

const log = createWriteStream(LOG_FILE, { flags: 'w' });
const child = spawn('pnpm', ['--filter', 'api', 'start'], {
  stdio: ['ignore', 'pipe', 'pipe'],
  shell: true,
  env: {
    ...process.env,
    PORT,
    DATABASE_URL: databaseUrl,
    JWT_SECRET: 'e2e-endurecido-jwt-secret',
    ADMIN_KEY: 'e2e-endurecido-admin-key',
    CORS_ORIGIN: `http://localhost:${WEB_PORT}`,
    APP_ENV: 'staging',
    SEED_ON_BOOT: 'true',
    SEED_STUDENT_TENANTS: '2',
    SIMULATOR_MS: '0',
    // Las medidas de endurecimiento
    TENANT_SUFFIX_SEED: 'e2e-semilla-endurecida-0123456789',
    TENANT_SUFFIX_LENGTH: '4',
    LAB_PUBLIC: 'false',
    RESTRICT_EMAIL_DOMAINS: 'true',
    ALLOWED_EMAIL_DOMAINS: 'sigpro.test,example.com',
    ROBOTS_NOINDEX: 'true',
  },
});
child.stdout.pipe(log, { end: false });
child.stderr.pipe(log, { end: false });
child.on('exit', (code) => {
  log.end();
  process.exit(code ?? 0);
});
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill());
