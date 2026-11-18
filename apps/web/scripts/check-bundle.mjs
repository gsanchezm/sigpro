// Comprueba que la web publicada no lleva lo que un despliegue «cerrado» quiere ocultar. Sirve para una carpeta `dist/` y para una URL:
//
//   node apps/web/scripts/check-bundle.mjs <dist>  [--closed] [--noindex]
//   node apps/web/scripts/check-bundle.mjs <https://…> [--closed] [--noindex]      (solo lectura: únicamente peticiones GET)
//
// Un sitio estático no puede esconder nada que viaje en su JavaScript: lo único que oculta es lo que NO está en lo publicado. Por eso
// esto se comprueba sobre los ARCHIVOS publicados y no sobre el comportamiento de la página.
//
//   --closed    compilado con VITE_LAB_PUBLIC=false: ni las contraseñas de demo, ni el código MFA, ni los correos de prueba, ni el
//               correo del alumno aparecen en ningún archivo, y no se publica `downloads/sigpro-examples.zip` (lleva la guía).
//   --noindex   compilado con VITE_NOINDEX=true: hay `robots.txt` con Disallow total y `<meta name="robots" content="noindex…">`.
//
// Con una URL se descarga `index.html` y se SIGUEN las referencias a otros archivos (scripts, hojas de estilo, trozos que carga el código
// bajo demanda, el service worker y su lista de precarga), porque una compilación reparte el código en varios archivos y los de las pantallas
// poco usadas no aparecen en el HTML. Un sitio con reescritura `/* → /index.html` contesta 200 con el `index.html` a cualquier ruta que no
// exista: por eso `robots.txt` y el zip se comprueban por su CONTENIDO (no por el estado HTTP).
//
// Sale con código 1 y lista qué archivo contiene qué (por etiqueta; nunca imprime el valor).
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SEED_SOURCE = resolve(HERE, '..', '..', 'api', 'src', 'seed', 'data.ts');

/** Archivos de texto del build: el resto (imágenes, fuentes) no puede llevar literales de código. */
const TEXT_FILE = /\.(js|mjs|css|html|json|webmanifest|txt|map|svg|xml)$/i;

/** Correo del usuario administrador de cada tenant de alumno: lo escribe el código de la web y el del seed. */
const STUDENT_EMAIL_DOMAIN = '@sigpro.lab';

/** Dónde publica `zip-examples.mjs` el material del curso. */
export const ZIP_PATH = 'downloads/sigpro-examples.zip';

/** Archivos que un build con PWA publica aunque el HTML no los enlace con una etiqueta. */
const WELL_KNOWN = ['manifest.webmanifest', 'sw.js', 'registerSW.js'];

/** Tope de archivos que sigue un rastreo (una web de este tamaño tiene decenas): evita bucles ante un sitio que invente rutas. */
const MAX_CRAWLED_FILES = 400;

const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Lo que un despliegue cerrado no debe publicar, leído del PROPIO seed de la API: así, si alguien cambia una contraseña o añade un
 * usuario de demo, el comprobador lo sigue sin tocarlo. Devuelve `{ label, test }`; `label` nunca contiene el valor.
 */
export const forbiddenFromSeed = (seedSource) => {
  const passwords = [...seedSource.matchAll(/(?:password:|STUDENT_PASSWORD\s*=)\s*'([^']+)'/g)].map((match) => match[1]);
  const emails = [...seedSource.matchAll(/email:\s*'([^'@]+@sigpro\.test)'/g)].map((match) => match[1]);
  const mfa = seedSource.match(/MFA_CODE\s*=\s*'(\d+)'/)?.[1];
  return [
    ...[...new Set(passwords)].map((value, index) => ({ label: `contraseña de demo #${index + 1}`, test: (text) => text.includes(value) })),
    ...[...new Set(emails)].map((value, index) => ({ label: `correo de demo #${index + 1}`, test: (text) => text.includes(value) })),
    // El código MFA solo cuenta como número AISLADO: `0123456789+/` (alfabeto base64 de una librería) contiene 123456 y no es el código
    ...(mfa ? [{ label: 'código MFA de demo', test: (text) => new RegExp(`(?<![0-9])${escapeRegExp(mfa)}(?![0-9])`).test(text) }] : []),
    { label: `correo del alumno (${STUDENT_EMAIL_DOMAIN})`, test: (text) => text.includes(STUDENT_EMAIL_DOMAIN) },
  ];
};

/**
 * Problemas de un conjunto de archivos publicados (lista vacía = correcto).
 * `files`: `{ name, text }` con `name` relativo a la raíz del sitio (`assets/index-ab.js`) y `text` = contenido (`null` si no es texto).
 */
export const checkFiles = (files, { closed = false, noindex = false, seedSource = readFileSync(SEED_SOURCE, 'utf8') } = {}) => {
  const problems = [];
  const byName = new Map(files.map((file) => [file.name, file]));

  if (closed) {
    for (const { name } of files) {
      if (name.endsWith('.zip')) problems.push(`${name}: un zip publicado (el del material lleva la guía con las credenciales de demo)`);
    }
    const forbidden = forbiddenFromSeed(seedSource);
    for (const { name, text } of files) {
      if (text === null || !TEXT_FILE.test(name)) continue;
      for (const { label, test } of forbidden) if (test(text)) problems.push(`${name}: contiene ${label}`);
    }
  }

  if (noindex) {
    const robots = byName.get('robots.txt');
    if (!robots) problems.push('robots.txt: no existe (o el sitio contesta con index.html en su lugar)');
    else if (!/^Disallow:\s*\/\s*$/m.test(robots.text ?? '')) problems.push('robots.txt: no prohíbe todo el rastreo (falta «Disallow: /»)');
    const index = byName.get('index.html');
    if (!index || !/<meta\s+name="robots"\s+content="[^"]*noindex/i.test(index.text ?? '')) problems.push('index.html: falta <meta name="robots" content="noindex…">');
  }
  return problems;
};

const filesUnder = (directory) =>
  readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    return statSync(path).isDirectory() ? filesUnder(path) : [path];
  });

/** Archivos de una carpeta `dist/` como `{ name, text }`. */
export const collectDist = (dist) =>
  filesUnder(dist).map((file) => {
    const name = relative(dist, file).split('\\').join('/');
    return { name, text: TEXT_FILE.test(name) ? readFileSync(file, 'utf8') : null };
  });

/** Problemas de un `dist` (lista vacía = correcto). */
export const checkDist = (dist, options = {}) => {
  if (!existsSync(dist)) return [`No existe ${dist}: compila la web antes (pnpm --filter web exec vite build --outDir …).`];
  return checkFiles(collectDist(dist), options);
};

// ---- Sitio publicado (URL) ---------------------------------------------------------------------------------------------------------

const looksLikeHtml = (contentType, body) => /text\/html/i.test(contentType ?? '') || /^\s*<(!doctype|html)\b/i.test(body.slice(0, 200));

/**
 * Referencias a otros archivos dentro de un HTML, un JS o un CSS: `./Lab-ab12.js` (relativo al archivo que lo cita), `assets/Lab-ab12.js`
 * o `/assets/…` (relativos a la raíz), y las entradas `url:"…"` de la lista de precarga del service worker (`sw.js`).
 */
export const referencesIn = (name, text) => {
  const found = new Set();
  const directory = name.includes('/') ? name.slice(0, name.lastIndexOf('/') + 1) : '';
  // etiquetas del HTML
  for (const match of text.matchAll(/\b(?:src|href)=["']([^"']+)["']/g)) found.add(match[1]);
  // trozos que el código carga bajo demanda: `import("./Lab-ab12.js")`, `"assets/Lab-ab12.js"`, `importScripts("./workbox-ab12.js")`
  for (const match of text.matchAll(/["'`(]\.\/([A-Za-z0-9_.-]+\.(?:js|css|mjs))\b/g)) found.add(directory + match[1]);
  // el service worker carga su runtime como módulo AMD, SIN extensión: `define(["./workbox-9c191d2f"], …)`
  for (const match of text.matchAll(/["'`]\.\/(workbox-[A-Za-z0-9]+)["'`]/g)) found.add(`${directory}${match[1]}.js`);
  for (const match of text.matchAll(/["'`(,]\/?(assets\/[A-Za-z0-9_.-]+\.(?:js|css|mjs|json|svg|webmanifest))\b/g)) found.add(match[1]);
  // lista de precarga del service worker
  for (const match of text.matchAll(/\burl:\s*["']([^"']+)["']/g)) found.add(match[1]);
  return [...found];
};

/** Normaliza una referencia a una ruta relativa a la raíz del sitio (`null` si apunta fuera, a un esquema o a un ancla). */
const toSitePath = (reference) => {
  if (/^(?:[a-z][a-z0-9+.-]*:|\/\/|#|data:)/i.test(reference)) return null;
  const clean = reference.split(/[?#]/)[0].replace(/^\.?\//, '');
  return clean === '' || clean.endsWith('/') ? null : clean;
};

/**
 * Descarga una web publicada y devuelve `{ files, notes }`: `files` como en `checkFiles`, y `notes` con lo que no se pudo seguir.
 * Solo hace GET. `fetchImpl` se puede sustituir (pruebas).
 */
export const collectSite = async (baseUrl, { fetchImpl = fetch, timeoutMs = 30_000 } = {}) => {
  const base = baseUrl.replace(/\/+$/, '');
  const notes = [];
  const files = new Map();
  const get = async (path) => {
    try {
      const response = await fetchImpl(`${base}/${path}`, { redirect: 'follow', signal: AbortSignal.timeout(timeoutMs), headers: { 'user-agent': 'sigpro-verify-hardening' } });
      const bytes = Buffer.from(await response.arrayBuffer());
      return { status: response.status, contentType: response.headers.get('content-type') ?? '', bytes };
    } catch (error) {
      notes.push(`${path}: no se pudo descargar (${error instanceof Error ? error.message : String(error)})`);
      return null;
    }
  };

  const index = await get('');
  if (!index || index.status !== 200) throw new Error(`${base}/ no respondió 200 (${index ? `estado ${index.status}` : 'sin respuesta'})`);
  const indexText = index.bytes.toString('utf8');
  if (!looksLikeHtml(index.contentType, indexText)) throw new Error(`${base}/ no devuelve HTML`);
  files.set('index.html', { name: 'index.html', text: indexText });

  // robots.txt y el zip: la reescritura de un sitio estático contesta con index.html a lo que no existe, así que se juzga el CONTENIDO
  const robots = await get('robots.txt');
  if (robots && robots.status === 200) {
    const text = robots.bytes.toString('utf8');
    if (!looksLikeHtml(robots.contentType, text)) files.set('robots.txt', { name: 'robots.txt', text });
    else notes.push('robots.txt: el sitio contesta con index.html (no existe un archivo real)');
  }
  const zip = await get(ZIP_PATH);
  if (zip && zip.status === 200 && (zip.bytes.subarray(0, 4).toString('latin1') === 'PK\u0003\u0004' || /zip/i.test(zip.contentType))) {
    files.set(ZIP_PATH, { name: ZIP_PATH, text: null });
  }

  const queue = [...referencesIn('index.html', indexText), ...WELL_KNOWN].map(toSitePath).filter(Boolean);
  const seen = new Set(['index.html', 'robots.txt', ZIP_PATH]);
  while (queue.length > 0) {
    const path = queue.shift();
    if (seen.has(path)) continue;
    seen.add(path);
    if (seen.size > MAX_CRAWLED_FILES) {
      notes.push(`se alcanzó el tope de ${MAX_CRAWLED_FILES} archivos: el rastreo está incompleto`);
      break;
    }
    const response = await get(path);
    if (!response || response.status !== 200) continue;
    const text = response.bytes.toString('utf8');
    // Un archivo que no existe vuelve como index.html (reescritura): no es un archivo del sitio
    if (looksLikeHtml(response.contentType, text) && !/\.html?$/i.test(path)) continue;
    const isText = TEXT_FILE.test(path);
    files.set(path, { name: path, text: isText ? text : null });
    if (isText) for (const reference of referencesIn(path, text).map(toSitePath).filter(Boolean)) if (!seen.has(reference)) queue.push(reference);
  }
  return { files: [...files.values()], notes };
};

/** Problemas de una web publicada: `{ problems, scanned, notes }`. */
export const checkUrl = async (baseUrl, options = {}) => {
  const { files, notes } = await collectSite(baseUrl, options);
  return { problems: checkFiles(files, options), scanned: files.length, notes };
};

const main = async () => {
  const args = process.argv.slice(2);
  const target = args.find((arg) => !arg.startsWith('--'));
  if (!target) {
    console.error('Uso: node apps/web/scripts/check-bundle.mjs <dist | https://…> [--closed] [--noindex]');
    process.exit(2);
  }
  const options = { closed: args.includes('--closed'), noindex: args.includes('--noindex') };
  const mode = [options.closed ? 'cerrado' : 'abierto', options.noindex ? 'noindex' : null].filter(Boolean).join(' + ');
  let problems;
  let detail = '';
  if (/^https?:\/\//i.test(target)) {
    const result = await checkUrl(target, options).catch((error) => ({ problems: [`no se pudo leer ${target}: ${error.message}`], scanned: 0, notes: [] }));
    problems = result.problems;
    detail = ` (${result.scanned} archivos descargados)`;
    result.notes.forEach((note) => console.error(`  · ${note}`));
  } else {
    problems = checkDist(resolve(target), options);
  }
  if (problems.length === 0) return console.log(`OK (${mode}): ${target}${detail} no publica lo que oculta este despliegue.`);
  console.error(`FALLO (${mode}): ${problems.length} problema(s) en ${target}${detail}`);
  problems.forEach((problem) => console.error(`  - ${problem}`));
  // `process.exitCode` y no `process.exit()`: en Windows, salir de golpe con conexiones de `fetch` abiertas aborta Node (0xC0000409)
  process.exitCode = 1;
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
