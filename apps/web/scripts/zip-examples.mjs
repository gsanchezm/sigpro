// Empaqueta `examples/` (el proyecto Playwright de referencia) en `public/downloads/sigpro-examples.zip`.
// Se ejecuta en `build` y al arrancar `dev`; la página /lab enlaza el resultado. El zip es una plantilla lista para usar:
//   - lleva el workflow de GitHub Actions de la sesión 12 con `PROJECT_DIR: .` (el proyecto queda en la raíz del repo del alumno);
//   - lleva la guía del alumno si existe;
//   - deja fuera lo que no se comparte: node_modules, sesiones guardadas (.auth), informes, `.env` y las líneas base de capturas
//     (dependen del sistema operativo: cada alumno genera las suyas).
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createZip } from './zip.mjs';

const ROOT_FOLDER = 'sigpro-examples';
const EXCLUDED_DIRS = new Set(['node_modules', '.auth', 'playwright-report', 'blob-report', 'test-results']);
const EXCLUDED_FILES = new Set(['.env', '.DS_Store', 'Thumbs.db']);

/** ¿Se deja fuera esta ruta relativa (con `/`)? Una carpeta `*-snapshots` son líneas base de capturas. */
export const isExcluded = (relativePath) => {
  const parts = relativePath.split('/');
  const file = parts[parts.length - 1] ?? '';
  return EXCLUDED_FILES.has(file) || parts.slice(0, -1).some(isExcludedDir);
};

const isExcludedDir = (name) => EXCLUDED_DIRS.has(name) || name.endsWith('-snapshots');

/** Recorre el árbol sin entrar en las carpetas excluidas (node_modules tiene miles de archivos). */
const walk = (directory) =>
  readdirSync(directory)
    .sort()
    .flatMap((name) => {
      const path = join(directory, name);
      if (!statSync(path).isDirectory()) return [path];
      return isExcludedDir(name) ? [] : walk(path);
    });

/** Entradas del zip: todo `examples/` + el workflow de alumnos + la guía. Orden estable. */
export const buildExamplesEntries = (repoRoot) => {
  const examples = join(repoRoot, 'examples');
  if (!existsSync(examples)) return [];

  const files = walk(examples)
    .map((path) => ({ path, name: relative(examples, path).split('\\').join('/') }))
    .filter(({ name }) => !isExcluded(name))
    .map(({ path, name }) => ({ name: `${ROOT_FOLDER}/${name}`, data: readFileSync(path) }));

  const extras = [];
  const workflow = join(repoRoot, '.github', 'workflows', 'students-e2e.yml');
  if (existsSync(workflow)) {
    // En el repo del alumno el proyecto está en la raíz, no en `examples/`
    const text = readFileSync(workflow, 'utf8').replace(/^(\s*PROJECT_DIR:\s*)examples\s*$/m, '$1.');
    extras.push({ name: `${ROOT_FOLDER}/.github/workflows/students-e2e.yml`, data: Buffer.from(text, 'utf8') });
  }
  const guide = join(repoRoot, 'docs', 'GUIA-ALUMNO.md');
  if (existsSync(guide)) extras.push({ name: `${ROOT_FOLDER}/GUIA-ALUMNO.md`, data: readFileSync(guide) });

  return [...files, ...extras].sort((a, b) => a.name.localeCompare(b.name));
};

const main = () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const repoRoot = resolve(here, '..', '..', '..');
  const entries = buildExamplesEntries(repoRoot);
  if (entries.length === 0) {
    console.warn('[zip-examples] no hay carpeta examples/: no se genera el zip (el enlace de /lab dará 404)');
    return;
  }
  const output = resolve(here, '..', 'public', 'downloads', 'sigpro-examples.zip');
  mkdirSync(dirname(output), { recursive: true });
  const zip = createZip(entries);
  writeFileSync(output, zip);
  console.log(`[zip-examples] ${entries.length} archivos · ${(zip.length / 1024).toFixed(1)} KB → ${relative(repoRoot, output).split('\\').join('/')}`);
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
