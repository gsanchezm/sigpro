// Comprueba que un build de la web (`dist/`) no publica lo que un despliegue «cerrado» quiere ocultar.
//
//   node apps/web/scripts/check-bundle.mjs <dist> [--closed] [--noindex]
//
// Un sitio estático no puede esconder nada que viaje en su JavaScript: lo único que oculta es lo que NO está en `dist/`. Por eso
// esto se comprueba sobre los archivos publicados y no sobre el comportamiento de la página.
//
//   --closed    compilado con VITE_LAB_PUBLIC=false: ni las contraseñas de demo, ni el código MFA, ni los correos de prueba, ni el
//               correo del alumno aparecen en ningún archivo, y no existe `downloads/sigpro-examples.zip` (lleva la guía).
//   --noindex   compilado con VITE_NOINDEX=true: hay `robots.txt` con Disallow total y `<meta name="robots" content="noindex…">`.
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

const filesUnder = (directory) =>
  readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    return statSync(path).isDirectory() ? filesUnder(path) : [path];
  });

/** Problemas de un `dist` (lista vacía = correcto). */
export const checkDist = (dist, { closed = false, noindex = false, seedSource = readFileSync(SEED_SOURCE, 'utf8') } = {}) => {
  const problems = [];
  if (!existsSync(dist)) return [`No existe ${dist}: compila la web antes (pnpm --filter web exec vite build --outDir …).`];
  const files = filesUnder(dist);
  const relativeName = (file) => relative(dist, file).split('\\').join('/');

  if (closed) {
    for (const file of files) {
      if (relativeName(file).endsWith('.zip')) problems.push(`${relativeName(file)}: un zip publicado (el del material lleva la guía con las credenciales de demo)`);
    }
    const forbidden = forbiddenFromSeed(seedSource);
    for (const file of files.filter((path) => TEXT_FILE.test(path))) {
      const text = readFileSync(file, 'utf8');
      for (const { label, test } of forbidden) if (test(text)) problems.push(`${relativeName(file)}: contiene ${label}`);
    }
  }

  if (noindex) {
    const robots = join(dist, 'robots.txt');
    if (!existsSync(robots)) problems.push('robots.txt: no existe');
    else if (!/^Disallow:\s*\/\s*$/m.test(readFileSync(robots, 'utf8'))) problems.push('robots.txt: no prohíbe todo el rastreo (falta «Disallow: /»)');
    const index = join(dist, 'index.html');
    if (!existsSync(index) || !/<meta\s+name="robots"\s+content="[^"]*noindex/i.test(readFileSync(index, 'utf8'))) problems.push('index.html: falta <meta name="robots" content="noindex…">');
  }
  return problems;
};

const main = () => {
  const args = process.argv.slice(2);
  const dist = args.find((arg) => !arg.startsWith('--'));
  if (!dist) {
    console.error('Uso: node apps/web/scripts/check-bundle.mjs <dist> [--closed] [--noindex]');
    process.exit(2);
  }
  const options = { closed: args.includes('--closed'), noindex: args.includes('--noindex') };
  const problems = checkDist(resolve(dist), options);
  const mode = [options.closed ? 'cerrado' : 'abierto', options.noindex ? 'noindex' : null].filter(Boolean).join(' + ');
  if (problems.length === 0) return console.log(`OK (${mode}): ${dist} no publica lo que oculta este despliegue.`);
  console.error(`FALLO (${mode}): ${problems.length} problema(s) en ${dist}`);
  problems.forEach((problem) => console.error(`  - ${problem}`));
  process.exit(1);
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
