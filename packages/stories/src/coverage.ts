// Matriz de cobertura: qué endpoints, rutas y permisos de la app tienen al menos una historia. Es puro: recibe el
// texto de los controladores, de `App.tsx` y la lista de archivos de la app móvil como datos; quien lee el repositorio
// es el comando (`cli.ts`). No hay forma de excluir un elemento: un hueco se cierra escribiendo la historia.
import type { StoryFile } from './model';

/** Un elemento de la app y las historias que lo cubren (vacío si es un hueco). */
export type CoverageRow = { readonly item: string; readonly storyIds: readonly string[] };

export type Coverage = {
  readonly endpoints: readonly CoverageRow[];
  readonly webRoutes: readonly CoverageRow[];
  readonly mobileRoutes: readonly CoverageRow[];
  readonly permissions: readonly CoverageRow[];
};

/** Lo que hay en la app, por tipo de elemento: la entrada de `buildCoverage`. */
export type CoverageSources = {
  readonly endpoints: readonly string[];
  readonly webRoutes: readonly string[];
  readonly mobileRoutes: readonly string[];
  readonly permissions: readonly string[];
};

// ───────────────────────────── Endpoints de la API ─────────────────────────────

/**
 * Decoradores de NestJS con un argumento de cadena opcional: `@Controller('admin')`, `@Post('reset')`, `@Get()`.
 * Admite el decorador partido en varias líneas y la coma final. Solo reconoce literales (`'…'`, `"…"` o `` `…` ``): todos los controladores de la API los usan así; un argumento
 * que fuera una constante o un objeto no se vería (y la comprobación de humo contra el recuento de decoradores lo delataría).
 */
const NEST_DECORATOR = /@(Controller|Get|Post|Put|Patch|Delete)\(\s*(?:(['"`])(.*?)\2\s*,?)?\s*\)/g;

/** `/api` (prefijo global de la API) más los tramos no vacíos de cada ruta, sin barras repetidas ni finales. */
const apiPath = (...parts: readonly string[]): string =>
  `/${['api', ...parts.flatMap((part) => part.split('/')).filter((segment) => segment !== '')].join('/')}`;

type ControllerScan = { readonly prefix: string; readonly endpoints: readonly string[] };

/** Endpoints de un archivo: cada método usa el prefijo del `@Controller` más cercano por encima. */
const endpointsOf = (text: string): readonly string[] =>
  [...text.matchAll(NEST_DECORATOR)].reduce<ControllerScan>(
    (scan, match) => {
      const decorator = match[1] ?? '';
      const path = match[3] ?? '';
      return decorator === 'Controller'
        ? { ...scan, prefix: path }
        : { ...scan, endpoints: [...scan.endpoints, `${decorator.toUpperCase()} ${apiPath(scan.prefix, path)}`] };
    },
    { prefix: '', endpoints: [] },
  ).endpoints;

/**
 * Endpoints (`"POST /api/auth/login"`) de los textos de los `*.controller.ts`, en el orden dado y sin deduplicar:
 * cada decorador de método es un endpoint, así el total es comparable con el recuento de decoradores en disco.
 */
export const extractEndpoints = (controllers: readonly string[]): readonly string[] => controllers.flatMap(endpointsOf);

// ───────────────────────────── Rutas web ─────────────────────────────

/** Rutas web que no se cubren: la raíz (redirige), el comodín y `/lab`, la pantalla del instructor. */
const EXCLUDED_WEB_ROUTES: ReadonlySet<string> = new Set(['/', '*', '/lab']);

/** Cuánto cambia la profundidad de llaves JSX con cada carácter. */
const BRACE_DEPTH: ReadonlyMap<string, number> = new Map([
  ['{', 1],
  ['}', -1],
]);

/**
 * Atributos de primer nivel de la etiqueta que empieza en `from`: lo que va entre llaves (`element={<Foo path="x" />}`)
 * se descarta y la etiqueta termina en el primer `>` fuera de ellas. Así un `path` de otro componente no cuenta, y
 * el `path` de la ruta se ve estén antes o después de `element`. Es un bucle con estado local: no escapa de la función.
 */
const topLevelAttributes = (text: string, from: number): string => {
  let depth = 0;
  let attributes = '';
  for (const char of text.slice(from)) {
    if (char === '>' && depth === 0) return attributes;
    const delta = BRACE_DEPTH.get(char);
    if (delta !== undefined) {
      depth = Math.max(0, depth + delta);
      continue;
    }
    if (depth === 0) attributes += char;
  }
  return attributes;
};

const ROUTE_OPEN = /<Route\b/g;
const PATH_ATTRIBUTE = /\spath=(?:"([^"]*)"|'([^']*)')/;

/** Atributos de primer nivel de cada `<Route …>` del archivo, en orden. */
const routeAttributes = (appTsx: string): readonly string[] =>
  [...appTsx.matchAll(ROUTE_OPEN)].map((match) => topLevelAttributes(appTsx, match.index + match[0].length));

/** Todos los `path="…"` literales de `App.tsx`, también los que se excluyen. */
const literalRoutePaths = (appTsx: string): readonly string[] =>
  routeAttributes(appTsx).flatMap((attributes) => {
    const found = PATH_ATTRIBUTE.exec(attributes);
    return found === null ? [] : [found[1] ?? found[2] ?? ''];
  });

/** Rutas absolutas (`<Route path="/programs/:code">`) de `App.tsx`, en el orden del archivo y sin `/`, `*` ni `/lab`. Las rutas de diseño sin `path` no cuentan. */
export const extractWebRoutes = (appTsx: string): readonly string[] => literalRoutePaths(appTsx).filter((path) => !EXCLUDED_WEB_ROUTES.has(path));

// ───────────────────────────── Lo que los extractores no leen ─────────────────────────────
// Los extractores son literales a propósito: no se añade soporte para otras formas, se detecta que existen. Un
// elemento que se pierde en silencio daría por «cubierto» algo que no se leyó, así que `extractionProblems` compara
// lo extraído con un recuento más amplio de las mismas construcciones.

/** Todos los decoradores de método HTTP de Nest, se extraigan o no (`@All`, `@Head` y `@Options` no se extraen). */
const HTTP_DECORATOR = /@(?:Get|Post|Put|Patch|Delete|All|Head|Options)\(/g;

/** Número de decoradores de método HTTP en los controladores, con cualquier argumento. Es el recuento del `grep` de la comprobación de humo. */
export const countHttpDecorators = (controllers: readonly string[]): number =>
  controllers.reduce((total, text) => total + [...text.matchAll(HTTP_DECORATOR)].length, 0);

const CONTROLLER_OPEN = /@Controller\(/g;
/** `@Controller()` o `@Controller('x')` con un literal de cadena sin interpolar (comillas simples, dobles o de plantilla), con coma final opcional. */
const LITERAL_CONTROLLER = /^@Controller\(\s*(?:(['"`])(?:(?!\1|\$\{).)*\1\s*,?)?\s*\)/;

/** Cuánto cambia la profundidad de paréntesis con cada carácter. */
const PAREN_DEPTH: ReadonlyMap<string, number> = new Map([
  ['(', 1],
  [')', -1],
]);

/** Texto de la llamada que empieza en `start` hasta su paréntesis de cierre, en una sola línea; si no cierra, hasta el fin de la línea. */
const callText = (text: string, start: number): string => {
  let depth = 0;
  for (let index = text.indexOf('(', start); index >= 0 && index < text.length; index += 1) {
    depth += PAREN_DEPTH.get(text.charAt(index)) ?? 0;
    if (depth === 0) return text.slice(start, index + 1).replace(/\s+/g, ' ');
  }
  return (text.slice(start).split('\n')[0] ?? '').trim();
};

/** Los `@Controller(…)` cuyo argumento no es vacío ni un literal de cadena (`{ path }`, una constante, una plantilla con `${}`), con su texto. */
export const nonLiteralControllerArgs = (controllers: readonly string[]): readonly string[] =>
  controllers.flatMap((text) =>
    [...text.matchAll(CONTROLLER_OPEN)]
      .filter((match) => !LITERAL_CONTROLLER.test(text.slice(match.index)))
      .map((match) => callText(text, match.index)),
  );

const PATH_OR_INDEX_ATTRIBUTE = /\s(?:path|index)(?=[\s=/]|$)/;
const QUOTED_VALUE = /"[^"]*"|'[^']*'/g;

/** Número de `<Route>` con atributo `path` (en cualquier forma: `"…"`, `{'…'}`, `{CONST}`) o `index`; las rutas de diseño sin ninguno no cuentan. */
export const countPathOrIndexRoutes = (appTsx: string): number =>
  routeAttributes(appTsx).filter((attributes) => PATH_OR_INDEX_ATTRIBUTE.test(attributes.replace(QUOTED_VALUE, '""'))).length;

/**
 * Avisos de lo que `extractEndpoints` y `extractWebRoutes` dejarían perder o leerían mal; vacío si no hay nada. Se
 * compara ANTES de cualquier deduplicación: (1) decoradores de método HTTP de cualquier verbo frente a endpoints
 * extraídos; (2) `@Controller` con argumento que no es un literal (el prefijo saldría mal sin que cambie ningún
 * recuento); (3) `<Route>` con `path` o `index` frente a rutas con `path` literal (las excluidas por regla cuentan como leídas).
 */
export const extractionProblems = (controllers: readonly string[], appTsx: string): readonly string[] => {
  const decorators = countHttpDecorators(controllers);
  const endpoints = extractEndpoints(controllers).length;
  const routeElements = countPathOrIndexRoutes(appTsx);
  const literalRoutes = literalRoutePaths(appTsx).length;
  return [
    ...(decorators === endpoints
      ? []
      : [`endpoints: decoradores de método HTTP ${decorators}, endpoints extraídos ${endpoints} (solo se extraen Get|Post|Put|Patch|Delete sin argumento o con un literal de cadena)`]),
    ...nonLiteralControllerArgs(controllers).map((call) => `endpoints: @Controller con un argumento que no es un literal de cadena, el prefijo de sus rutas no se leería bien: ${call}`),
    ...(routeElements === literalRoutes
      ? []
      : [`rutas web: elementos <Route> con path o index ${routeElements}, rutas con path literal ${literalRoutes} (solo se leen path="…" y path='…'; un path entre llaves, un index o rutas generadas con .map no se extraen)`]),
  ];
};

// ───────────────────────────── Rutas móviles (Expo Router) ─────────────────────────────

const MODULE_EXTENSION = /\.(?:tsx|ts|jsx|js)$/;
const TYPE_DECLARATION = /\.d\.ts$/;
const GROUP_SEGMENT = /^\(.*\)$/;
const PARAM_SEGMENT = /^\[([^\].]+)\]$/;

/** Ruta de un archivo del árbol `app` de Expo Router, o `null` si no es una pantalla (`_layout`, `+not-found`, estilos…). */
const mobileRouteOf = (file: string): string | null => {
  const path = file.replace(/\\/g, '/').replace(/^\.\//, '');
  if (!MODULE_EXTENSION.test(path) || TYPE_DECLARATION.test(path)) return null;
  const segments = path.replace(MODULE_EXTENSION, '').split('/').filter((segment) => segment !== '');
  if (segments.at(-1) === '_layout' || segments.some((segment) => segment.startsWith('+'))) return null;
  const visible = segments.filter((segment) => !GROUP_SEGMENT.test(segment));
  const routeSegments = visible.at(-1) === 'index' ? visible.slice(0, -1) : visible;
  return `/${routeSegments.map((segment) => segment.replace(PARAM_SEGMENT, ':$1')).join('/')}`;
};

/**
 * Rutas de la app móvil a partir de los archivos del árbol `app` (relativos a él, con `/` o `\`): las carpetas
 * `(grupo)` no aparecen, `[code]` es `:code`, `index` es la carpeta y se excluye `/` (la raíz redirige). Conserva el orden dado.
 */
export const mobileRoutesFromFiles = (files: readonly string[]): readonly string[] => {
  const routes = files.map(mobileRouteOf).filter((route): route is string => route !== null && route !== '/');
  return [...new Set(routes)];
};

// ───────────────────────────── Cobertura ─────────────────────────────

type Story = Extract<StoryFile, { kind: 'story' }>;
type ReferenceKind = 'endpoints' | 'webRoutes' | 'mobileRoutes';

/** Qué lista de elementos cubre una etiqueta de plataforma en `cubre`; `transversal` no cubre endpoints ni rutas. */
const KIND_BY_LABEL: ReadonlyMap<string, ReferenceKind> = new Map<string, ReferenceKind>([
  ['api', 'endpoints'],
  ['web', 'webRoutes'],
  ['movil', 'mobileRoutes'],
  ['ios', 'mobileRoutes'],
  ['android', 'mobileRoutes'],
]);

/** Lo que una historia declara en `cubre` para un tipo de elemento: nada si su plataforma no es la de ese tipo. */
const cubreFor =
  (kind: ReferenceKind) =>
  (story: Story): readonly string[] =>
    story.fm.etiquetas.some((label) => KIND_BY_LABEL.get(label) === kind) ? (story.fm.cubre ?? []) : [];

const permisosOf = (story: Story): readonly string[] => story.fm.permisos ?? [];

/** Una fila por elemento distinto, en el orden dado; los ids, ordenados por código y sin repetir. */
const rowsFor = (items: readonly string[], stories: readonly Story[], declared: (story: Story) => readonly string[]): readonly CoverageRow[] =>
  [...new Set(items)].map((item) => ({
    item,
    storyIds: [...new Set(stories.filter((story) => declared(story).includes(item)).map((story) => story.fm.id))].sort(),
  }));

/**
 * Cruza lo que hay en la app con lo que declaran las historias. Una historia cubre un endpoint o una ruta si su
 * plataforma encaja (`api` → endpoints, `web` → rutas web, `movil`/`ios`/`android` → rutas móviles) y lo lista en
 * `cubre`; cualquier historia cubre permisos con `permisos`. Las épicas no cubren nada.
 */
export const buildCoverage = (sources: CoverageSources, files: readonly StoryFile[]): Coverage => {
  const stories = files.filter((file): file is Story => file.kind === 'story');
  return {
    endpoints: rowsFor(sources.endpoints, stories, cubreFor('endpoints')),
    webRoutes: rowsFor(sources.webRoutes, stories, cubreFor('webRoutes')),
    mobileRoutes: rowsFor(sources.mobileRoutes, stories, cubreFor('mobileRoutes')),
    permissions: rowsFor(sources.permissions, stories, permisosOf),
  };
};

/** Cómo se nombra cada tipo de elemento: en un hueco, en el resumen, y en el título y la columna de su tabla. */
const SECTIONS: readonly { key: keyof Coverage; hole: string; plural: string; title: string; column: string; covered: string }[] = [
  { key: 'endpoints', hole: 'endpoint', plural: 'endpoints', title: 'Endpoints de la API', column: 'Endpoint', covered: 'cubiertos' },
  { key: 'webRoutes', hole: 'ruta web', plural: 'rutas web', title: 'Rutas web', column: 'Ruta', covered: 'cubiertas' },
  { key: 'mobileRoutes', hole: 'ruta móvil', plural: 'rutas móviles', title: 'Rutas móviles', column: 'Ruta', covered: 'cubiertas' },
  { key: 'permissions', hole: 'permiso', plural: 'permisos', title: 'Permisos', column: 'Permiso', covered: 'cubiertos' },
];

const holesOf = (rows: readonly CoverageRow[]): readonly CoverageRow[] => rows.filter((row) => row.storyIds.length === 0);

/** Elementos sin ninguna historia, legibles y con el tipo delante: `endpoint: POST /api/auth/login`. */
export const holes = (c: Coverage): readonly string[] =>
  SECTIONS.flatMap(({ key, hole }) => holesOf(c[key]).map((row) => `${hole}: ${row.item}`));

/** Resumen en una línea: `8 huecos (endpoints 2 de 2, rutas web 2 de 2, …)`, con los huecos de cada tipo sobre su total. */
export const summarizeHoles = (c: Coverage): string => {
  const total = holes(c).length;
  const perKind = SECTIONS.map(({ key, plural }) => `${plural} ${holesOf(c[key]).length} de ${c[key].length}`);
  return `${total} ${total === 1 ? 'hueco' : 'huecos'} (${perKind.join(', ')})`;
};

const EMPTY_CELL = '—';

const renderSection = (c: Coverage, section: (typeof SECTIONS)[number]): string => {
  const rows = c[section.key];
  const done = rows.filter((row) => row.storyIds.length > 0).length;
  return [
    `## ${section.title} (${done} de ${rows.length} ${section.covered})`,
    '',
    `| ${section.column} | Historias |`,
    '| --- | --- |',
    ...rows.map((row) => `| \`${row.item}\` | ${row.storyIds.length === 0 ? EMPTY_CELL : row.storyIds.join(', ')} |`),
  ].join('\n');
};

/** `COBERTURA.md`: una tabla por tipo con las historias de cada elemento y `—` en los huecos. Determinista: sin fechas y solo `\n`. */
export const renderCoverageMarkdown = (c: Coverage): string =>
  `${[
    '# Cobertura de historias de usuario',
    'Generado con `pnpm stories:coverage -- --write`; no se edita a mano. Un endpoint o una ruta queda cubierto cuando una historia de su plataforma lo lista en `cubre`, y un permiso cuando una historia lo lista en `permisos`. Las épicas no cubren nada.',
    ...SECTIONS.map((section) => renderSection(c, section)),
  ].join('\n\n')}\n`;
