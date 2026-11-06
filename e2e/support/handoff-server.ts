import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const MIME: Readonly<Record<string, string>> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
};

export const HANDOFF_DIR = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..', 'docs', 'design-handoff');

/** Sirve docs/design-handoff por HTTP (equivale a `npx serve docs/design-handoff`) para comparar los prototipos. */
export const startHandoffServer = (port: number): Promise<Server> =>
  new Promise((resolve) => {
    const server = createServer((request, response) => {
      const path = normalize(decodeURIComponent((request.url ?? '/').split('?')[0] ?? '/')).replace(/^([/\\])+/, '');
      const file = join(HANDOFF_DIR, path);
      if (!file.startsWith(HANDOFF_DIR) || !existsSync(file) || !statSync(file).isFile()) {
        response.writeHead(404).end('not found');
        return;
      }
      response.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' });
      createReadStream(file).pipe(response);
    });
    server.listen(port, '127.0.0.1', () => resolve(server));
  });
