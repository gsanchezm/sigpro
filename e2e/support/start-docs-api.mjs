// Segunda instancia de la API con basic auth en /api/docs (`DOCS_BASIC_AUTH`) para el spec api-docs.spec.ts.
// Espera a que la API principal responda (así el build ya terminó y `dist` no se está escribiendo) y luego arranca
// otra en el puerto 3100 sin sembrar (SEED_ON_BOOT=false: los tenants ya los crea la principal).
import { spawn } from 'node:child_process';

const MAIN_API = process.env.E2E_API_URL ?? 'http://localhost:3000/api';
const DOCS_PORT = process.env.E2E_DOCS_PORT ?? '3100';
const DOCS_AUTH = process.env.E2E_DOCS_AUTH ?? 'curso:docs-2026';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const mainIsUp = async () => fetch(`${MAIN_API}/health`).then((response) => response.ok, () => false);

const deadline = Date.now() + 110_000;
while (Date.now() < deadline && !(await mainIsUp())) await sleep(1000);

const child = spawn('pnpm', ['--filter', 'api', 'start'], {
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, PORT: DOCS_PORT, DOCS_BASIC_AUTH: DOCS_AUTH, SEED_ON_BOOT: 'false' },
});
child.on('exit', (code) => process.exit(code ?? 0));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill());
