// Lectura de archivos de historias: separa el front matter, lo valida con los esquemas de `model.ts`
// y recorre el árbol `docs/user-stories`. `parseStoryFile` es puro; solo `loadStoryFiles` toca el disco.
import { readdir, readFile } from 'node:fs/promises';
import { join, sep } from 'node:path';
import { parse as parseYaml } from 'yaml';
import type { z } from 'zod';
import { epicFrontmatterSchema, storyFrontmatterSchema, type StoryFile } from './model';

export type ParseResult = { ok: true; file: StoryFile } | { ok: false; path: string; error: string };

/** Lo que cada tipo de archivo necesita para construir su `StoryFile` una vez validado el front matter. */
type Builder = (path: string, data: unknown, body: string) => ParseResult;

/**
 * Front matter: `---` en la primera línea, el contenido y otra línea `---`. Se aplica sobre texto ya
 * normalizado a `\n`. La bandera `m` hace que `^` marque el inicio de cualquier línea (así vale también el
 * front matter vacío). Como la expresión no está anclada al texto, quien la usa exige que el hallazgo empiece
 * en el índice 0: un par de `---` del cuerpo no es front matter.
 */
const FRONT_MATTER = /^---[ \t]*\n([\s\S]*?)^---[ \t]*(?:\n|$)/m;

/** Marca de orden de bytes UTF-8 (U+FEFF) con que Windows guarda muchos archivos; se escribe como código para no meter el carácter en el fuente. */
const BOM_CODE = 0xfeff;

/** Quita el BOM y unifica los saltos de línea (CRLF y CR) a `\n`: así Windows no rompe la expresión de arriba. */
const stripBom = (text: string): string => (text.charCodeAt(0) === BOM_CODE ? text.slice(1) : text);
const normalize = (text: string): string => stripBom(text).replace(/\r\n?/g, '\n');

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const fail = (path: string, error: string): ParseResult => ({ ok: false, path, error });

/** Texto corto con la ruta de cada campo que no cumple el esquema (`etiquetas.1: ...`). */
const describeIssues = (error: z.ZodError): string =>
  error.issues
    .map((issue) => `${issue.path.length > 0 ? issue.path.join('.') : '(raíz)'}: ${issue.message}`)
    .join('; ');

const build =
  <T>(schema: z.ZodType<T, z.ZodTypeDef, unknown>, toFile: (fm: T, path: string, body: string) => StoryFile): Builder =>
  (path, data, body) => {
    const result = schema.safeParse(data);
    return result.success ? { ok: true, file: toFile(result.data, path, body) } : fail(path, describeIssues(result.error));
  };

/** Valor de `tipo` → cómo validar y construir el archivo. */
const BUILDERS: ReadonlyMap<string, Builder> = new Map<string, Builder>([
  ['epica', build(epicFrontmatterSchema, (fm, path, body) => ({ kind: 'epic', path, fm, body }))],
  ['historia', build(storyFrontmatterSchema, (fm, path, body) => ({ kind: 'story', path, fm, body }))],
]);

const KNOWN_TYPES = [...BUILDERS.keys()].join(' | ');

type YamlResult = { ok: true; value: unknown } | { ok: false; error: string };

/** `yaml` lanza en el primer error (con `logLevel: 'error'` también calla los avisos); aquí se convierte en valor. */
const readYaml = (text: string): YamlResult => {
  try {
    return { ok: true, value: parseYaml(text, { logLevel: 'error' }) };
  } catch (error) {
    const reason = error instanceof Error ? (error.message.split('\n')[0] ?? error.message) : String(error);
    return { ok: false, error: `YAML inválido: ${reason}` };
  }
};

/** Valida el mapa YAML ya leído: elige el esquema por `tipo` y construye el `StoryFile`. */
const buildFile = (path: string, data: unknown, body: string): ParseResult => {
  if (!isRecord(data)) return fail(path, 'el front matter debe ser un mapa YAML (clave: valor)');
  const tipo = data['tipo'];
  if (typeof tipo !== 'string') return fail(path, `falta el campo tipo (${KNOWN_TYPES})`);
  const builder = BUILDERS.get(tipo);
  return builder ? builder(path, data, body) : fail(path, `tipo desconocido "${tipo}" (se esperaba ${KNOWN_TYPES})`);
};

/** Lee un archivo de épica o de historia a partir de su texto. Tolera BOM y saltos CRLF. */
export const parseStoryFile = (path: string, text: string): ParseResult => {
  const normalized = normalize(text);
  const match = FRONT_MATTER.exec(normalized);
  if (match?.index !== 0) return fail(path, 'sin front matter: el archivo debe empezar con una línea --- y cerrarlo con otra');
  const yaml = match[1] ?? '';
  if (yaml.trim() === '') return fail(path, 'front matter vacío');
  const parsed = readYaml(yaml);
  if (!parsed.ok) return fail(path, parsed.error);
  // El cuerpo es lo que queda tras el cierre, sin las líneas en blanco que lo separan del front matter.
  const body = normalized.slice(match[0].length).replace(/^\n+/, '');
  return buildFile(path, parsed.value, body);
};

const isStoryFileName = (name: string): boolean => name === 'epic.md' || (name.startsWith('US-') && name.endsWith('.md'));

const isMissing = (error: unknown): boolean => error instanceof Error && 'code' in error && error.code === 'ENOENT';

/** Rutas con `/` en cualquier sistema: las reglas de lint comparan carpetas y nombres de archivo. */
const toPosix = (path: string): string => path.split(sep).join('/');

/** Rutas de los `epic.md` y `US-*.md` bajo `dir`, en cualquier profundidad. Una carpeta que no existe cuenta como vacía. */
const walk = async (dir: string): Promise<readonly string[]> => {
  const entries = await readdir(dir, { withFileTypes: true }).catch((error: unknown) => {
    if (isMissing(error)) return [];
    throw error;
  });
  const nested = await Promise.all(
    entries.map(async (entry): Promise<readonly string[]> => {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) return walk(path);
      return entry.isFile() && isStoryFileName(entry.name) ? [path] : [];
    }),
  );
  return nested.flat();
};

/** Un fallo de lectura no aborta la carga: llega como un resultado `ok: false` más. */
const loadOne = async (path: string): Promise<ParseResult> => {
  const read = await readFile(path, 'utf8').then(
    (text) => ({ ok: true as const, text }),
    (error: unknown) => ({ ok: false as const, error: error instanceof Error ? error.message : String(error) }),
  );
  return read.ok ? parseStoryFile(path, read.text) : fail(path, `no se pudo leer el archivo: ${read.error}`);
};

/** Carga recursivamente `epic.md` y `US-*.md` bajo `root`, ordenados por ruta. Si `root` no existe devuelve `[]`. */
export const loadStoryFiles = async (root: string): Promise<readonly ParseResult[]> => {
  const paths = (await walk(root)).map(toPosix).sort();
  return Promise.all(paths.map(loadOne));
};
