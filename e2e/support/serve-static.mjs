// Servidor estático mínimo para la exportación web de la app móvil (`expo export` → apps/mobile/dist), sin dependencias.
// Reproduce lo que hace un hosting de SPA: lo que no es un archivo (`/programs/PRG-001/requirements`) devuelve index.html.
// Uso: node support/serve-static.mjs <carpeta> <puerto>
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';

const [, , folder = '../apps/mobile/dist', portArg = '8081'] = process.argv;
const root = resolve(folder);
const port = Number(portArg);

const TYPES = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.svg', 'image/svg+xml'],
  ['.ico', 'image/x-icon'],
  ['.ttf', 'font/ttf'],
  ['.woff', 'font/woff'],
  ['.woff2', 'font/woff2'],
  ['.map', 'application/json'],
]);

/** Ruta pedida → archivo dentro de `root` (nunca fuera de él) o null. */
const fileFor = (urlPath) => {
  const target = normalize(join(root, decodeURIComponent(urlPath.split('?')[0] ?? '/')));
  if (!target.startsWith(root)) return null;
  return existsSync(target) && statSync(target).isFile() ? target : null;
};

createServer((request, response) => {
  const file = fileFor(request.url ?? '/') ?? join(root, 'index.html');
  if (!existsSync(file)) {
    response.writeHead(404).end('No existe la exportación: ejecuta `pnpm --filter mobile build`');
    return;
  }
  response.writeHead(200, { 'Content-Type': TYPES.get(extname(file)) ?? 'application/octet-stream', 'Cache-Control': 'no-store' });
  createReadStream(file).pipe(response);
}).listen(port, () => console.log(`Web móvil estática en http://localhost:${port} (${root})`));
