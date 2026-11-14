// Reglas de lint de las historias de usuario. Cada regla es una función pura: recibe un archivo ya leído
// y el índice de todos los archivos, y devuelve mensajes; `lintStoryFiles` los convierte en hallazgos.
// El catálogo es `RULES`, un mapa de id estable → regla (el orden del mapa es el orden de los hallazgos).
import { extractGherkinBlocks, findEnglishKeywords, parseOutlines, placeholdersOf, splitCodeBlocks, type Outline } from './gherkin';
import { PLATFORM_LABELS, TITLE_PREFIX, type PlatformLabel, type StoryFile, type Verification } from './model';
import type { ParseResult } from './parse';

/** Un problema de un archivo. `id` va vacío cuando el archivo ni siquiera se pudo leer. */
export type Finding = { readonly path: string; readonly id: string; readonly rule: string; readonly message: string };

type StoryOnly = Extract<StoryFile, { kind: 'story' }>;

/** Lo que una regla necesita saber de los demás archivos: qué ids hay, dónde, y cuáles son de épica o de historia. */
type StoryIndex = {
  readonly pathsById: ReadonlyMap<string, readonly string[]>;
  readonly epicIds: ReadonlySet<string>;
  readonly storyIds: ReadonlySet<string>;
};

export type RuleContext = { readonly result: ParseResult; readonly index: StoryIndex };
export type Rule = (ctx: RuleContext) => readonly Finding[];

/** Comprobación de un archivo ya leído: devuelve un mensaje por cada problema. */
type Check<F extends StoryFile> = (file: F, index: StoryIndex) => readonly string[];

// ---------------------------------------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------------------------------------

/** `[]` si la condición se cumple; si no, el mensaje. Permite armar listas con `...unless(...)`. */
const unless = (ok: boolean, message: string): readonly string[] => (ok ? [] : [message]);

const unique = <T>(items: readonly T[]): readonly T[] => [...new Set(items)];

const splitLines = (text: string): readonly string[] => text.split(/\r\n|\r|\n/);

const cells = (count: number): string => `${count} ${count === 1 ? 'celda' : 'celdas'}`;

const outlinesOf = (body: string): readonly Outline[] => extractGherkinBlocks(body).flatMap((block) => parseOutlines(block));

// ---------------------------------------------------------------------------------------------------------
// Texto del cuerpo sin código (para las menciones) y secciones
// ---------------------------------------------------------------------------------------------------------

/** El texto sin los bloques de código (vallas incluidas): lo lee el mismo escáner que usan las reglas de Gherkin. */
const withoutFences = (text: string): string => splitCodeBlocks(text).prose.join('\n');

/** Código en línea: una tirada de comillas invertidas, texto y la misma tirada (ni más larga ni más corta). */
const INLINE_CODE = /(?<!`)(`+)(?!`).+?(?<!`)\1(?!`)/g;

/** El texto sin bloques ni código en línea: lo que GitHub interpretaría como prosa. */
const withoutCode = (text: string): string =>
  withoutFences(text)
    .split('\n')
    .map((line) => line.replace(INLINE_CODE, ' '))
    .join('\n');

/** Texto de la sección `## <title>`: hasta el siguiente encabezado de nivel 1 o 2. `null` si no existe. */
const sectionOf = (text: string, title: string): string | null => {
  const rows = splitLines(text);
  const start = rows.findIndex((row) => row.trim() === `## ${title}`);
  if (start === -1) return null;
  const rest = rows.slice(start + 1);
  const end = rest.findIndex((row) => /^#{1,2}\s/.test(row));
  return (end === -1 ? rest : rest.slice(0, end)).join('\n').trim();
};

// ---------------------------------------------------------------------------------------------------------
// Etiquetas y carpetas
// ---------------------------------------------------------------------------------------------------------

const PLATFORM_SET: ReadonlySet<string> = new Set(PLATFORM_LABELS);
const isPlatform = (label: string): label is PlatformLabel => PLATFORM_SET.has(label);

/** Verificaciones admitidas en una historia `ios`: iOS nunca se ha abierto en un Simulador. */
const IOS_VERIFICATIONS: ReadonlySet<Verification> = new Set<Verification>(['pendiente-nativo', 'no-ejecutable']);

const PATH_SEPARATOR = /[\\/]/;
const baseName = (path: string): string => path.split(PATH_SEPARATOR).at(-1) ?? path;
const folderName = (path: string): string => path.split(PATH_SEPARATOR).at(-2) ?? '';

/** Slug de una épica en mayúsculas: su id sin `EP-` (`EP-LOGIN` → `LOGIN`). La carpeta lo lleva en minúsculas. */
const slugOf = (epicId: string): string => epicId.replace(/^EP-/, '');

const STORY_NUMBER = /^\d{3}$/;

// ---------------------------------------------------------------------------------------------------------
// Comprobaciones (una por regla)
// ---------------------------------------------------------------------------------------------------------

const checkUniqueId: Check<StoryFile> = (file, { pathsById }) => {
  const paths = pathsById.get(file.fm.id) ?? [];
  return unless(paths.length <= 1, `el id ${file.fm.id} se repite en ${paths.length} archivos: ${paths.join(', ')}`);
};

const checkEpicExists: Check<StoryOnly> = ({ fm }, { epicIds }) =>
  unless(epicIds.has(fm.epica), `la épica ${fm.epica} no existe (ningún epic.md tiene ese id)`);

const checkPlatform: Check<StoryOnly> = ({ fm }) => {
  const platforms = fm.etiquetas.filter(isPlatform);
  const foreign = fm.etiquetas.filter((label) => !isPlatform(label) && label !== 'no-implementada');
  return [
    ...unless(platforms.length > 0, `falta la etiqueta de plataforma (${PLATFORM_LABELS.join(' | ')})`),
    ...unless(platforms.length <= 1, `lleva ${platforms.length} etiquetas de plataforma (${platforms.join(', ')}): debe llevar exactamente una`),
    ...unless(foreign.length === 0, `etiquetas no permitidas en una historia: ${foreign.join(', ')}`),
  ];
};

const checkTitlePrefix: Check<StoryOnly> = ({ fm }) => {
  const platforms = fm.etiquetas.filter(isPlatform);
  // Con cero o con varias plataformas el prefijo no tiene referencia: eso ya lo marca `plataforma-unica`.
  const platform = platforms.length === 1 ? platforms[0] : undefined;
  const prefix = platform === undefined ? undefined : TITLE_PREFIX.get(platform);
  if (prefix === undefined) return [];
  return unless(fm.titulo.startsWith(`${prefix} `), `el título debe empezar por «${prefix} » (plataforma ${platform}): «${fm.titulo}»`);
};

const checkFileId: Check<StoryFile> = (file) => {
  const name = baseName(file.path);
  const folder = folderName(file.path);
  if (file.kind === 'epic') {
    const slug = slugOf(file.fm.id).toLowerCase();
    return [
      ...unless(name === 'epic.md', `el archivo de una épica se llama epic.md (este se llama ${name})`),
      ...unless(folder === slug, `la carpeta de ${file.fm.id} debe llamarse «${slug}» (está en «${folder}»)`),
    ];
  }
  const slug = slugOf(file.fm.epica);
  const idPrefix = `US-${slug}-`;
  const wellFormed = file.fm.id.startsWith(idPrefix) && STORY_NUMBER.test(file.fm.id.slice(idPrefix.length));
  return [
    ...unless(name === `${file.fm.id}.md`, `el archivo se llama ${name} y su id es ${file.fm.id}: debe llamarse ${file.fm.id}.md`),
    ...unless(folder === slug.toLowerCase(), `la historia de ${file.fm.epica} debe estar en la carpeta «${slug.toLowerCase()}» (está en «${folder}»)`),
    ...unless(wellFormed, `el id ${file.fm.id} no cumple ${idPrefix}NNN (tres dígitos) para la épica ${file.fm.epica}`),
  ];
};

const checkRelated: Check<StoryOnly> = ({ fm }, { storyIds }) =>
  (fm.relacionadas ?? []).filter((id) => !storyIds.has(id)).map((id) => `la relacionada ${id} no es una historia existente`);

const checkStoryRole: Check<StoryOnly> = ({ body }) => {
  const section = sectionOf(withoutFences(body), 'Historia');
  if (section === null) return ['falta la sección «## Historia»'];
  if (!/^Como\s/.test(section)) return ['la sección «## Historia» debe empezar por «Como …»'];
  return unless(/\bquiero\b/i.test(section), 'la sección «## Historia» debe decir qué quiere el rol («… quiero …»)');
};

const checkOutlineRequired: Check<StoryOnly> = ({ body }) => {
  if (extractGherkinBlocks(body).length === 0) return ['falta el bloque ```gherkin con los criterios de aceptación'];
  const outlines = outlinesOf(body);
  if (outlines.length === 0) return ['el bloque gherkin no tiene ningún «Esquema del escenario»'];
  return outlines
    .filter((outline) => !outline.tables.some((table) => table.rows.length > 0))
    .map((outline) => `el Esquema «${outline.name}» no tiene una tabla de Ejemplos con filas`);
};

const checkPlaceholders: Check<StoryOnly> = ({ body }) =>
  outlinesOf(body)
    // Sin tabla ya lo marca `esquema-requerido`; aquí solo se comparan marcadores con columnas.
    .filter((outline) => outline.tables.length > 0)
    .flatMap((outline) => {
      const columns = new Set(outline.tables.flatMap((table) => table.header));
      return unique(outline.steps.flatMap((step) => placeholdersOf(step)))
        .filter((name) => !columns.has(name))
        .map((name) => `Esquema «${outline.name}»: el marcador <${name}> no es una columna de Ejemplos`);
    });

const checkRowCells: Check<StoryOnly> = ({ body }) =>
  outlinesOf(body).flatMap((outline) =>
    outline.tables.flatMap((table) =>
      table.rows.flatMap((row, position) =>
        unless(
          row.length === table.header.length,
          `Esquema «${outline.name}», fila ${position + 1} de Ejemplos: tiene ${cells(row.length)} y la cabecera ${cells(table.header.length)}`,
        ),
      ),
    ),
  );

const checkEnglishGherkin: Check<StoryOnly> = ({ body }) => {
  const found = unique(extractGherkinBlocks(body).flatMap((block) => findEnglishKeywords(block)));
  return unless(
    found.length === 0,
    `palabras clave de Gherkin en inglés (${found.join(', ')}): usa Característica, Esquema del escenario, Ejemplos, Dado, Cuando, Entonces y Y`,
  );
};

const checkNotExecutableLabel: Check<StoryOnly> = ({ fm }) => {
  const notExecutable = fm.verificacion === 'no-ejecutable';
  const tagged = fm.etiquetas.includes('no-implementada');
  return [
    ...unless(!notExecutable || tagged, 'verificacion: no-ejecutable exige la etiqueta no-implementada'),
    ...unless(notExecutable || !tagged, `la etiqueta no-implementada exige verificacion: no-ejecutable (hay «${fm.verificacion}»)`),
  ];
};

const checkIosVerification: Check<StoryOnly> = ({ fm }) =>
  unless(
    !fm.etiquetas.includes('ios') || IOS_VERIFICATIONS.has(fm.verificacion),
    `una historia ios no se puede ejecutar: verificacion debe ser pendiente-nativo o no-ejecutable (hay «${fm.verificacion}»)`,
  );

/**
 * Términos que no pueden aparecer ni en el título ni en el cuerpo (tampoco en los bloques de código): detalles de
 * implementación y los defectos del curso. `planted` va como subcadena (`PLANTED_BUGS`, `planted_bugs.md`);
 * `planted-bugs` y sus variantes tienen su propio término y `planted` no las repite. «plantado» a secas no se marca.
 */
const FORBIDDEN_TERMS: readonly RegExp[] = [
  /data-testid/gi,
  /(?<!data-)\btestid/gi,
  /\bget(?:All)?By[A-Z]\w*/g,
  /planted[-_]?bugs/gi,
  /planted(?![-_]?bugs)/gi,
  /\b(?:bugs?|defectos?|error|errores)\s+plantad[oa]s?\b/gi,
];

/** El título se publica tal cual como título del issue: es la misma superficie de fuga que el cuerpo. */
const checkForbiddenTerms: Check<StoryFile> = ({ fm, body }) => {
  const text = `${fm.titulo}\n${body}`;
  const found = unique(FORBIDDEN_TERMS.flatMap((term) => [...text.matchAll(term)].map((match) => match[0])));
  return unless(found.length === 0, `términos prohibidos en una historia: ${found.join(', ')}`);
};

/** `@usuario` (no un correo: antes de la `@` no hay letra, cifra ni `_`) y `#n` (no un ancla, un color ni una entidad HTML). */
const LOOSE_MENTION = /(?<!\w)@[A-Za-z0-9][\w-]*/g;
const LOOSE_REFERENCE = /(?<![\w&])#\d+(?!\w)/g;

const checkLooseMentions: Check<StoryFile> = ({ body }) => {
  const prose = withoutCode(body);
  const found = unique([...prose.matchAll(LOOSE_MENTION), ...prose.matchAll(LOOSE_REFERENCE)].map((match) => match[0]));
  return unless(
    found.length === 0,
    `menciones o referencias sueltas que GitHub convertiría en notificaciones o enlaces: ${found.join(', ')}; escríbelas entre comillas invertidas`,
  );
};

/** Viñeta de lista con texto (`- …` o `* …`); una viñeta vacía no cuenta. */
const BULLET = /^\s*[-*]\s+\S/;

/**
 * Una capacidad futura no puede afirmar lo que está sin decidir: toda historia `no-implementada` lleva
 * `## Decisiones pendientes` con al menos una viñeta («- Ninguna.» si de verdad no queda nada). Las viñetas
 * dentro de bloques de código no cuentan.
 */
const checkPendingDecisions: Check<StoryOnly> = ({ fm, body }) => {
  if (!fm.etiquetas.includes('no-implementada')) return [];
  const section = sectionOf(withoutFences(body), 'Decisiones pendientes');
  if (section === null) return ['una historia no-implementada debe tener la sección «## Decisiones pendientes» (con «- Ninguna.» si no queda nada)'];
  return unless(
    splitLines(section).some((row) => BULLET.test(row)),
    'la sección «## Decisiones pendientes» debe tener al menos una viñeta (con «- Ninguna.» si no queda nada)',
  );
};

// ---------------------------------------------------------------------------------------------------------
// Catálogo
// ---------------------------------------------------------------------------------------------------------

/** Comprobación que se aplica a todo archivo leído; los que no se pudieron leer los trata `frontmatter`. */
const forFiles =
  (check: Check<StoryFile>) =>
  ({ result, index }: RuleContext): readonly string[] =>
    result.ok ? check(result.file, index) : [];

/** Comprobación que solo se aplica a historias (la épica no lleva plataforma, Gherkin ni verificación). */
const forStories =
  (check: Check<StoryOnly>) =>
  ({ result, index }: RuleContext): readonly string[] =>
    result.ok && result.file.kind === 'story' ? check(result.file, index) : [];

const pathOf = (result: ParseResult): string => (result.ok ? result.file.path : result.path);
const idOf = (result: ParseResult): string => (result.ok ? result.file.fm.id : '');

/** Convierte los mensajes de una regla en hallazgos con su ruta, su id y el id de la regla. */
const defineRule = (id: string, messagesOf: (ctx: RuleContext) => readonly string[]): readonly [string, Rule] => [
  id,
  (ctx) => messagesOf(ctx).map((message) => ({ path: pathOf(ctx.result), id: idOf(ctx.result), rule: id, message })),
];

/** Las 17 reglas, con id estable. El orden de este mapa es el orden en que salen los hallazgos de cada archivo. */
export const RULES: ReadonlyMap<string, Rule> = new Map<string, Rule>([
  defineRule('frontmatter', ({ result }) => (result.ok ? [] : [result.error])),
  defineRule('id-unico', forFiles(checkUniqueId)),
  defineRule('epica-existe', forStories(checkEpicExists)),
  defineRule('plataforma-unica', forStories(checkPlatform)),
  defineRule('prefijo-titulo', forStories(checkTitlePrefix)),
  defineRule('archivo-id', forFiles(checkFileId)),
  defineRule('relacionadas-existen', forStories(checkRelated)),
  defineRule('historia-como', forStories(checkStoryRole)),
  defineRule('esquema-requerido', forStories(checkOutlineRequired)),
  defineRule('placeholder-columna', forStories(checkPlaceholders)),
  defineRule('fila-celdas', forStories(checkRowCells)),
  defineRule('gherkin-ingles', forStories(checkEnglishGherkin)),
  defineRule('no-ejecutable-etiqueta', forStories(checkNotExecutableLabel)),
  defineRule('ios-pendiente-nativo', forStories(checkIosVerification)),
  defineRule('terminos-prohibidos', forFiles(checkForbiddenTerms)),
  defineRule('mencion-suelta', forFiles(checkLooseMentions)),
  defineRule('decisiones-pendientes', forStories(checkPendingDecisions)),
]);

const buildIndex = (results: readonly ParseResult[]): StoryIndex => {
  const files = results.flatMap((result) => (result.ok ? [result.file] : []));
  const pathsById = files.reduce<ReadonlyMap<string, readonly string[]>>(
    (acc, file) => new Map(acc).set(file.fm.id, [...(acc.get(file.fm.id) ?? []), file.path]),
    new Map(),
  );
  const idsOfKind = (kind: StoryFile['kind']): ReadonlySet<string> => new Set(files.filter((file) => file.kind === kind).map((file) => file.fm.id));
  return { pathsById, epicIds: idsOfKind('epic'), storyIds: idsOfKind('story') };
};

/**
 * Pasa todas las reglas por todos los archivos. Los hallazgos salen en el orden de los archivos y, dentro de
 * cada uno, en el de `RULES`. No toca el disco: recibe lo que devuelve `loadStoryFiles`.
 */
export const lintStoryFiles = (results: readonly ParseResult[]): readonly Finding[] => {
  const index = buildIndex(results);
  const rules = [...RULES.values()];
  return results.flatMap((result) => rules.flatMap((rule) => rule({ result, index })));
};
