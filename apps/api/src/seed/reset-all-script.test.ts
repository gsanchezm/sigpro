import { spawnSync } from 'node:child_process';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

// Ejecuta el script REAL del cron (scripts/reset-all.mjs) contra un servidor HTTP local de mentira: sin base de datos y sin
// salir de esta máquina. Comprueba qué escribe el cron en su log (que se ve en el panel de Render).
const SCRIPT = resolve(__dirname, '..', '..', '..', '..', 'scripts', 'reset-all.mjs');

let server: Server | undefined;
afterEach(() => new Promise<void>((done) => (server ? server.close(() => done()) : done())));

const runCron = async (tenants: readonly string[]): Promise<{ status: number | null; stdout: string }> => {
  server = createServer((_request, response) => {
    response.setHeader('content-type', 'application/json');
    response.end(JSON.stringify(tenants.map((tenant) => ({ tenant, ms: 12 }))));
  });
  await new Promise<void>((ready) => server?.listen(0, '127.0.0.1', ready));
  const { port } = server.address() as AddressInfo;
  // spawnSync bloquearía el servidor de este mismo proceso: el script se lanza en un proceso aparte y asíncrono
  const { spawn } = await import('node:child_process');
  return new Promise((done) => {
    const child = spawn(process.execPath, [SCRIPT], { env: { PATH: process.env.PATH ?? '', API_URL: `http://127.0.0.1:${port}/api`, ADMIN_KEY: 'clave-de-prueba' } });
    let stdout = '';
    child.stdout.on('data', (chunk: Buffer) => (stdout += chunk.toString()));
    child.on('close', (status) => done({ status, stdout }));
  });
};

describe('scripts/reset-all.mjs', () => {
  it('con ids sin sufijo escribe el log de siempre', async () => {
    const { status, stdout } = await runCron(['demo', 'alumno01', 'alumno25']);
    expect(status).toBe(0);
    expect(stdout).toContain('✔ demo (12 ms)');
    expect(stdout).toContain('✔ alumno25 (12 ms)');
    expect(stdout).toContain('Reset completado: 3 tenant(s).');
  });

  it('con ids con sufijo oculta el sufijo secreto en el log del cron', async () => {
    const { status, stdout } = await runCron(['demo', 'alumno07-k4x9', 'alumno25-hfva']);
    expect(status).toBe(0);
    expect(stdout).toContain('✔ demo (12 ms)');
    expect(stdout).toContain('✔ alumno07-**** (12 ms)');
    expect(stdout).toContain('✔ alumno25-**** (12 ms)');
    expect(stdout).not.toContain('k4x9');
    expect(stdout).not.toContain('hfva');
    expect(stdout).toContain('Reset completado: 3 tenant(s).');
  });

  it('sin ADMIN_KEY no hace nada y avisa', () => {
    const result = spawnSync(process.execPath, [SCRIPT], { env: { PATH: process.env.PATH ?? '' }, encoding: 'utf8' });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Falta ADMIN_KEY');
  });
});
