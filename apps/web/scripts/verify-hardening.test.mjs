import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { createRenderLikeServer } from './serve-like-render.mjs';
import { parseArgs, verifyHardening } from './verify-hardening.mjs';

// El verificador contra una API y una web FALSAS que reproducen los tres estados que importan: completo, solo-noindex (lo que hay justo
// después de fusionar render.yaml) y abierto (el demo público de hoy). La API falsa anota cada petición para demostrar que es de solo lectura.

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), 'verify-hardening.mjs');
const ALLOWED = ['sigpro.lab', 'sigpro.test', 'example.com'];
const EXISTING_TENANTS = ['demo', 'alumno01-k4x9ab', 'alumno02-q2m5zz'];

const cleanups = [];
afterEach(() => cleanups.splice(0).forEach((fn) => fn()));
const listen = async (server) => {
  cleanups.push(() => server.close());
  await new Promise((done) => server.listen(0, '127.0.0.1', done));
  return server.address().port;
};

/** API falsa. `config`: noindex, privateTenants, labPublic, restrict, appEnv. */
const startApi = async (config) => {
  const calls = [];
  const created = [];
  const server = createServer((request, response) => {
    let raw = '';
    request.on('data', (chunk) => (raw += chunk));
    request.on('end', () => {
      const { pathname } = new URL(request.url ?? '/', 'http://x');
      const tenant = request.headers['x-tenant'];
      calls.push({ method: request.method, path: pathname, tenant });
      if (config.noindex) response.setHeader('x-robots-tag', 'noindex, nofollow');
      const reply = (status, body, type = 'application/json') => {
        response.writeHead(status, { 'content-type': type });
        response.end(typeof body === 'string' ? body : JSON.stringify(body));
      };
      const email = (() => {
        try {
          return JSON.parse(raw || '{}').email ?? '';
        } catch {
          return '';
        }
      })();
      const refused = config.restrict && !ALLOWED.includes(String(email).split('@').pop());
      // Tabla de despacho (el repo prohíbe `switch`): «MÉTODO ruta» → respuesta
      const routes = {
        'GET /robots.txt': () => (config.noindex ? reply(200, 'User-agent: *\nDisallow: /\n', 'text/plain') : reply(404, { statusCode: 404 })),
        'GET /api/health': () => reply(200, { status: 'ok' }),
        'GET /api/config/tenants': () => (config.privateTenants ? reply(403, { statusCode: 403, code: 'admin_key_required' }) : reply(200, EXISTING_TENANTS.map((id) => ({ id })))),
        'GET /api/config/test-users': () => reply(200, config.labPublic ? [{ email: 'admin@sigpro.test' }] : []),
        'GET /api/config': () => reply(200, { env: config.appEnv, tenant: tenant ?? 'demo', testUsers: config.labPublic }),
        'POST /api/auth/forgot': () => (refused ? reply(422, { statusCode: 422, code: 'email_domain_not_allowed' }) : reply(202, {})),
        'POST /api/auth/register': () => {
          if (refused) return reply(422, { statusCode: 422, code: 'email_domain_not_allowed' });
          if (!EXISTING_TENANTS.includes(String(tenant))) return reply(404, { statusCode: 404, code: 'tenant_not_found' });
          created.push({ tenant, email });
          return reply(201, { status: 'pending_approval' });
        },
      };
      return (routes[`${request.method} ${pathname}`] ?? (() => reply(404, { statusCode: 404 })))();
    });
  });
  const port = await listen(server);
  return { url: `http://127.0.0.1:${port}/api`, origin: `http://127.0.0.1:${port}`, calls, created };
};

/** Web falsa servida como Render (reescritura + cabeceras). `closed`: compilada con VITE_LAB_PUBLIC=false y VITE_NOINDEX=true. */
const startWeb = async ({ closed, headers = closed }) => {
  const dist = mkdtempSync(join(tmpdir(), 'sigpro-verify-web-'));
  cleanups.push(() => rmSync(dist, { recursive: true, force: true }));
  const files = {
    'index.html': `<html><head>${closed ? '<meta name="robots" content="noindex, nofollow" />' : ''}<script type="module" src="/assets/index-1.js"></script></head></html>`,
    'assets/index-1.js': closed ? 'console.log("sigpro")' : 'const demo={email:"admin@sigpro.test",password:"Admin1234!"}',
    ...(closed ? { 'robots.txt': 'User-agent: *\nDisallow: /\n' } : {}),
  };
  for (const [name, content] of Object.entries(files)) {
    mkdirSync(dirname(join(dist, name)), { recursive: true });
    writeFileSync(join(dist, name), content);
  }
  const server = createRenderLikeServer({
    dist,
    headers: headers ? [{ path: '/*', name: 'X-Robots-Tag', value: 'noindex, nofollow' }] : [],
    routes: [{ type: 'rewrite', source: '/*', destination: '/index.html' }],
  });
  const port = await listen(server);
  return { url: `http://127.0.0.1:${port}` };
};

const FULL_API = { noindex: true, privateTenants: true, labPublic: false, restrict: true, appEnv: 'qa' };
const OPEN_API = { noindex: false, privateTenants: false, labPublic: true, restrict: false, appEnv: 'qa' };
const failedIds = (results) => results.filter((result) => !result.ok).map((result) => result.id);

describe('un despliegue completo', () => {
  it('pasa las 11 comprobaciones de --expect=full', async () => {
    const api = await startApi(FULL_API);
    const web = await startWeb({ closed: true });
    const results = await verifyHardening({ api: api.url, web: web.url, expect: 'full', appEnv: 'qa' });
    expect(results.filter((result) => !result.ok)).toEqual([]);
    expect(results).toHaveLength(11);
  });

  it('con --expect=noindex corre solo las 6 de noindex', async () => {
    const api = await startApi(FULL_API);
    const web = await startWeb({ closed: true });
    const results = await verifyHardening({ api: api.url, web: web.url, expect: 'noindex' });
    expect(results.map((result) => result.id)).toEqual(['api-x-robots-tag', 'api-robots-txt', 'web-x-robots-tag', 'web-robots-txt', 'web-meta-noindex', 'api-tenants-privado']);
    expect(failedIds(results)).toEqual([]);
  });

  it('acepta la URL de la API con o sin el /api final y con o sin barra', async () => {
    const api = await startApi(FULL_API);
    const web = await startWeb({ closed: true });
    for (const variant of [api.origin, `${api.origin}/`, `${api.origin}/api/`]) {
      expect(failedIds(await verifyHardening({ api: variant, web: `${web.url}/`, expect: 'noindex' })), variant).toEqual([]);
    }
  });
});

describe('solo noindex (lo que hay justo después de fusionar render.yaml, sin activar nada a mano)', () => {
  it('--expect=noindex falla ÚNICAMENTE en la lista de tenants pública', async () => {
    const api = await startApi({ ...OPEN_API, noindex: true });
    const web = await startWeb({ closed: false, headers: true });
    // Esta web no es «cerrada» (sin meta ni robots.txt propios): para noindex hace falta que la compilación lleve VITE_NOINDEX
    const noindexWeb = await startWeb({ closed: true });
    const results = await verifyHardening({ api: api.url, web: noindexWeb.url, expect: 'noindex' });
    expect(failedIds(results)).toEqual(['api-tenants-privado']);
    expect(results.find((result) => result.id === 'api-tenants-privado')?.detail).toMatch(/PÚBLICA.*TENANT_SUFFIX_SEED/);
    expect(web.url).toBeTruthy();
  });
});

describe('el despliegue abierto de hoy', () => {
  it('--expect=full falla en todo lo que debe y lo explica', async () => {
    const api = await startApi(OPEN_API);
    const web = await startWeb({ closed: false });
    const results = await verifyHardening({ api: api.url, web: web.url, expect: 'full', appEnv: 'qa' });
    expect(failedIds(results)).toEqual([
      'api-x-robots-tag',
      'api-robots-txt',
      'web-x-robots-tag',
      'web-robots-txt',
      'web-meta-noindex',
      'api-tenants-privado',
      'api-registro-dominio',
      'api-forgot-dominio',
      'api-sin-credenciales-anonimas',
      'web-bundle', // api-app-env sí pasa: la API abierta devuelve qa
    ]);
    const detail = (id) => results.find((result) => result.id === id)?.detail ?? '';
    expect(detail('api-registro-dominio')).toContain('APAGADA');
    expect(detail('api-forgot-dominio')).toContain('APAGADA');
    expect(detail('web-robots-txt')).toContain('index.html');
    expect(detail('web-bundle')).toMatch(/contraseña de demo/);
  });

  it('es de SOLO LECTURA: ni una escritura, y los dos POST de register apuntan a un tenant que no existe', async () => {
    const api = await startApi(OPEN_API); // sin restricción: un register «de verdad» crearía un usuario
    const web = await startWeb({ closed: false });
    await verifyHardening({ api: api.url, web: web.url, expect: 'full', appEnv: 'qa' });
    expect(api.created).toEqual([]);
    const posts = api.calls.filter((call) => call.method === 'POST');
    expect(posts.length).toBeGreaterThan(0);
    expect(posts.every((call) => ['/api/auth/register', '/api/auth/forgot'].includes(call.path))).toBe(true);
    for (const call of posts.filter((item) => item.path === '/api/auth/register')) expect(EXISTING_TENANTS, `tenant «${call.tenant}»`).not.toContain(call.tenant);
    expect(api.calls.filter((call) => !['GET', 'POST'].includes(call.method ?? ''))).toEqual([]);
  });
});

describe('APP_ENV', () => {
  it('un valor distinto del esperado falla y dice ambos', async () => {
    const api = await startApi({ ...FULL_API, appEnv: 'staging' });
    const web = await startWeb({ closed: true });
    const results = await verifyHardening({ api: api.url, web: web.url, expect: 'full', appEnv: 'qa' });
    expect(failedIds(results)).toEqual(['api-app-env']);
    expect(results.find((result) => result.id === 'api-app-env')?.detail).toBe('env «staging» ≠ esperado «qa»');
  });
});

describe('robustez', () => {
  it('un fallo de red en la API no interrumpe las comprobaciones de la web', async () => {
    const web = await startWeb({ closed: true });
    const dead = createServer();
    const port = await listen(dead);
    await new Promise((done) => dead.close(done)); // ahora ese puerto no escucha
    const results = await verifyHardening({ api: `http://127.0.0.1:${port}/api`, web: web.url, expect: 'noindex', timeoutMs: 5000 });
    expect(failedIds(results)).toEqual(['api-x-robots-tag', 'api-robots-txt', 'api-tenants-privado']);
    expect(results.find((result) => result.id === 'api-x-robots-tag')?.detail).toMatch(/error de red/);
    expect(results.filter((result) => result.id.startsWith('web-')).every((result) => result.ok)).toBe(true);
  });

  it('un rastreo incompleto NO se da por limpio', async () => {
    const api = await startApi(FULL_API);
    const web = await startWeb({ closed: true });
    const flaky = async (url, init) => {
      if (String(url).endsWith('/assets/index-1.js')) throw new Error('reset de conexión');
      return fetch(url, init);
    };
    const results = await verifyHardening({ api: api.url, web: web.url, expect: 'full', appEnv: 'qa', fetchImpl: flaky });
    expect(failedIds(results)).toEqual(['web-bundle']);
    expect(results.find((result) => result.id === 'web-bundle')?.detail).toContain('rastreo incompleto');
  });
});

describe('parseArgs', () => {
  it('lee --clave=valor y --clave valor, y rechaza lo desconocido', () => {
    expect(parseArgs(['--api=http://a', '--web', 'http://w', '--expect=full']).values).toEqual({ api: 'http://a', web: 'http://w', expect: 'full' });
    expect(parseArgs(['suelto']).error).toContain('suelto');
  });
});

/** Ejecuta la CLI de verdad (otro proceso) y devuelve código y salida. */
const runCli = (args) =>
  new Promise((done) => {
    const child = spawn(process.execPath, [SCRIPT, ...args], { stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    child.stdout.on('data', (chunk) => (out += chunk));
    child.stderr.on('data', (chunk) => (out += chunk));
    child.on('close', (code) => done({ code, out }));
  });

describe('la CLI (código de salida)', () => {
  it('0 si todo cumple, y lo dice', async () => {
    const api = await startApi(FULL_API);
    const web = await startWeb({ closed: true });
    const { code, out } = await runCli([`--api=${api.url}`, `--web=${web.url}`, '--expect=full', '--app-env=qa']);
    expect(code, out).toBe(0);
    expect(out).toContain('11 comprobaciones · 11 correctas · 0 fallidas');
    expect(out).toContain('OK: este despliegue cumple lo esperado.');
  });

  it('1 si algo falla, y señala cuál', async () => {
    const api = await startApi(OPEN_API);
    const web = await startWeb({ closed: false });
    const { code, out } = await runCli([`--api=${api.url}`, `--web=${web.url}`, '--expect=noindex']);
    expect(code).toBe(1);
    expect(out).toContain('✗ api-x-robots-tag');
    expect(out).toContain('FALLO: este despliegue NO cumple lo esperado.');
  });

  it('2 si el uso es incorrecto (sin --expect, o --expect=full sin --app-env)', async () => {
    expect((await runCli(['--api=http://a', '--web=http://w'])).code).toBe(2);
    const noEnv = await runCli(['--api=http://a', '--web=http://w', '--expect=full']);
    expect(noEnv.code).toBe(2);
    expect(noEnv.out).toContain('--app-env');
  });

  it('no imprime el contenido de ninguna respuesta (ni las credenciales que la API abierta entrega)', async () => {
    const api = await startApi(OPEN_API);
    const web = await startWeb({ closed: false });
    const { out } = await runCli([`--api=${api.url}`, `--web=${web.url}`, '--expect=full', '--app-env=qa']);
    for (const secret of ['Admin1234!', 'admin@sigpro.test']) expect(out).not.toContain(secret);
  });
});
