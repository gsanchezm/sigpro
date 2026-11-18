import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { checkUrl, collectSite, referencesIn } from './check-bundle.mjs';
import { createRenderLikeServer } from './serve-like-render.mjs';

// Modo URL de check-bundle: se sirve un dist temporal COMO RENDER (reescritura /* → /index.html) y se rastrea por HTTP.

// Un seed de mentira con la misma forma que apps/api/src/seed/data.ts
const SEED = `
export const MFA_CODE = '654321';
export const DEMO_USERS = [
  { id: 'u1', email: 'admin@sigpro.test', password: 'Secreta-Admin-1!', role: 'admin' },
];
export const STUDENT_PASSWORD = 'Secreta-Alumno-3!';
`;

const cleanups = [];
afterEach(() => cleanups.splice(0).forEach((fn) => fn()));

/** Sirve `files` (nombre → contenido) como un sitio estático con la reescritura de Render y devuelve su URL. */
const serve = async (files, options = {}) => {
  const dist = mkdtempSync(join(tmpdir(), 'sigpro-site-'));
  for (const [name, content] of Object.entries(files)) {
    const path = join(dist, name);
    mkdirSync(join(path, '..'), { recursive: true });
    writeFileSync(path, content);
  }
  const server = createRenderLikeServer({ dist, headers: [], routes: options.rewrite === false ? [] : [{ type: 'rewrite', source: '/*', destination: '/index.html' }] });
  cleanups.push(() => server.close(), () => rmSync(dist, { recursive: true, force: true }));
  await new Promise((done) => server.listen(0, '127.0.0.1', done));
  return `http://127.0.0.1:${server.address().port}`;
};

const PAGE = '<html><head><meta name="robots" content="noindex, nofollow" /><script type="module" src="/assets/index-1.js"></script></head></html>';
const ROBOTS = 'User-agent: *\nDisallow: /\n';
const CLEAN = { 'index.html': PAGE, 'robots.txt': ROBOTS, 'assets/index-1.js': 'import("./Lab-2.js")', 'assets/Lab-2.js': 'console.log("laboratorio")' };

describe('referencesIn', () => {
  it('encuentra scripts, trozos cargados bajo demanda y la lista de precarga del service worker', () => {
    expect(referencesIn('index.html', PAGE)).toContain('/assets/index-1.js');
    expect(referencesIn('assets/index-1.js', 'import("./Lab-2.js");x=["assets/Otro-3.css"]')).toEqual(expect.arrayContaining(['assets/Lab-2.js', 'assets/Otro-3.css']));
    expect(referencesIn('sw.js', 'precacheAndRoute([{url:"assets/Extra-4.js",revision:null}]);importScripts("./workbox-ab.js")')).toEqual(expect.arrayContaining(['assets/Extra-4.js', 'workbox-ab.js']));
  });

  it('encuentra el runtime de workbox que el service worker carga como módulo AMD, sin extensión', () => {
    expect(referencesIn('sw.js', 'define(["./workbox-9c191d2f"],(function(e){"use strict"}))')).toContain('workbox-9c191d2f.js');
  });
});

describe('checkUrl (web publicada)', () => {
  it('una web cerrada y limpia pasa, y el rastreo sigue los trozos que carga bajo demanda', async () => {
    const url = await serve(CLEAN);
    const result = await checkUrl(url, { closed: true, noindex: true, seedSource: SEED });
    expect(result.problems).toEqual([]);
    expect(result.scanned).toBe(4); // index.html, robots.txt, index-1.js y Lab-2.js (este último solo lo cita el JavaScript)
  });

  it('encuentra una contraseña de demo escondida en un trozo que NO aparece en el HTML', async () => {
    const url = await serve({ ...CLEAN, 'assets/Lab-2.js': 'const p="Secreta-Alumno-3!"' });
    const { problems } = await checkUrl(url, { closed: true, seedSource: SEED });
    expect(problems).toEqual([expect.stringMatching(/^assets\/Lab-2\.js: contiene contraseña de demo/)]);
    expect(problems.join('\n')).not.toContain('Secreta');
  });

  it('encuentra un archivo que solo cita la lista de precarga del service worker', async () => {
    const url = await serve({ ...CLEAN, 'sw.js': 'precacheAndRoute([{url:"assets/Extra-4.js",revision:null}])', 'assets/Extra-4.js': 'const e="admin@sigpro.test"' });
    const { problems } = await checkUrl(url, { closed: true, seedSource: SEED });
    expect(problems).toEqual([expect.stringContaining('assets/Extra-4.js: contiene correo de demo')]);
  });

  it('robots.txt tapado por la reescritura (el sitio contesta con index.html) es un fallo de noindex', async () => {
    const url = await serve({ 'index.html': PAGE, 'assets/index-1.js': '' });
    const { problems, notes } = await checkUrl(url, { noindex: true, seedSource: SEED });
    expect(problems).toEqual([expect.stringContaining('robots.txt: no existe')]);
    expect(notes.join(' ')).toContain('robots.txt: el sitio contesta con index.html');
  });

  it('un zip publicado es un fallo; si no existe (la reescritura devuelve index.html), no lo es', async () => {
    const withZip = await serve({ ...CLEAN, 'downloads/sigpro-examples.zip': 'PK\u0003\u0004resto' });
    expect((await checkUrl(withZip, { closed: true, seedSource: SEED })).problems).toEqual([expect.stringContaining('sigpro-examples.zip: un zip publicado')]);
    const without = await serve(CLEAN);
    expect((await checkUrl(without, { closed: true, seedSource: SEED })).problems).toEqual([]);
  });

  it('una web abierta (sin --closed) no exige nada de esto', async () => {
    const url = await serve({ 'index.html': '<html><script src="/assets/a.js"></script></html>', 'assets/a.js': 'const p="Secreta-Alumno-3!"' });
    expect((await checkUrl(url, { seedSource: SEED })).problems).toEqual([]);
  });

  it('si la raíz no responde 200, lo dice en lugar de dar por bueno el sitio', async () => {
    const url = await serve({ 'otra.html': '<html></html>' }, { rewrite: false }); // sin index.html y sin reescritura: / da 404
    await expect(collectSite(url)).rejects.toThrow(/no respondió 200/);
  });
});
