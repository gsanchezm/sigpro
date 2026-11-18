// Sirve un `dist/` como lo haría un sitio estático de Render, según el blueprint (`headers` y `routes` de render.yaml), para ENSAYAR en
// local `pnpm verify:hardening` y `pnpm check:bundle <url>` antes de apuntarlos a Render:
//
//   node apps/web/scripts/serve-like-render.mjs apps/web/dist-closed [--port=5198] [--blueprint=render.yaml] [--service=sigpro-web]
//
// Reglas que reproduce (las de la documentación de Render sobre sitios estáticos):
//   - las cabeceras de `headers:` se añaden a TODAS las respuestas cuya ruta encaje con `path` (aquí, `/*`);
//   - la reescritura `/* → /index.html` solo se aplica a rutas en las que NO existe un archivo: un `robots.txt` real gana a la reescritura.
// ES UNA EMULACIÓN: sirve para que el verificador se ejercite con las cabeceras y la reescritura que declara el blueprint, no demuestra qué
// hace Render de verdad (eso solo se ve contra el sitio desplegado).
import { existsSync, readFileSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, extname, join, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { load } from 'js-yaml';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..', '..', '..');

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.zip': 'application/zip',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** `/*` encaja con todo; `/assets/*`, con lo que cuelga de assets. */
const globToRegExp = (glob) => new RegExp(`^${glob.split('*').map(escapeRegExp).join('.*')}$`);

/** `headers` y `routes` del sitio estático de un blueprint (por nombre, o el primero de tipo `static`). */
export const staticSiteFrom = (blueprintPath, serviceName) => {
  const document = load(readFileSync(blueprintPath, 'utf8'));
  const sites = (document.services ?? []).filter((service) => service.runtime === 'static' && (!serviceName || service.name === serviceName));
  if (sites.length === 0) throw new Error(`${blueprintPath}: no hay ningún sitio estático${serviceName ? ` llamado ${serviceName}` : ''}`);
  const [site] = sites;
  return { name: site.name, headers: site.headers ?? [], routes: site.routes ?? [] };
};

/** Servidor HTTP (sin arrancar) que sirve `dist` aplicando `headers` y `routes`. */
export const createRenderLikeServer = ({ dist, headers = [], routes = [] }) => {
  const root = resolve(dist);
  const rules = headers.map((rule) => ({ ...rule, matches: globToRegExp(rule.path) }));
  const rewrites = routes.filter((route) => route.type === 'rewrite').map((route) => ({ ...route, matches: globToRegExp(route.source) }));
  const fileFor = (path) => {
    const candidate = resolve(root, `.${path}`);
    if (candidate !== root && !candidate.startsWith(root + sep)) return null; // fuera de dist
    if (!existsSync(candidate)) return null;
    if (statSync(candidate).isDirectory()) return existsSync(join(candidate, 'index.html')) ? join(candidate, 'index.html') : null;
    return candidate;
  };

  return createServer((request, response) => {
    const path = decodeURIComponent(new URL(request.url ?? '/', 'http://localhost').pathname);
    for (const rule of rules) if (rule.matches.test(path)) response.setHeader(rule.name, rule.value);
    let file = fileFor(path);
    let status = 200;
    if (!file) {
      const rewrite = rewrites.find((route) => route.matches.test(path));
      file = rewrite ? fileFor(rewrite.destination) : null;
      if (!file) status = 404;
    }
    if (!file) return response.writeHead(status, { 'content-type': 'text/plain; charset=utf-8' }).end('Not Found');
    response.writeHead(status, { 'content-type': TYPES[extname(file).toLowerCase()] ?? 'application/octet-stream' });
    if (request.method === 'HEAD') return response.end();
    response.end(readFileSync(file));
  });
};

const main = async () => {
  const args = process.argv.slice(2);
  const option = (name, fallback) => args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
  const dist = args.find((arg) => !arg.startsWith('--'));
  if (!dist) {
    console.error('Uso: node apps/web/scripts/serve-like-render.mjs <dist> [--port=5198] [--blueprint=render.yaml] [--service=sigpro-web]');
    process.exit(2);
  }
  const site = staticSiteFrom(resolve(REPO_ROOT, option('blueprint', 'render.yaml')), option('service'));
  const port = Number(option('port', '5198'));
  const server = createRenderLikeServer({ dist, headers: site.headers, routes: site.routes });
  await new Promise((done) => server.listen(port, '127.0.0.1', done));
  console.log(`[serve-like-render] ${dist} como «${site.name}»: http://127.0.0.1:${port}  (cabeceras: ${site.headers.map((rule) => rule.name).join(', ') || 'ninguna'}; reescrituras: ${site.routes.length})`);
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
