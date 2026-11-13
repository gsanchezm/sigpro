// Lectura del Gherkin en español que va dentro del cuerpo de una historia. Todo es puro: recibe texto y
// devuelve datos, sin tocar el disco. Las reglas de lint (`rules.ts`) construyen sus hallazgos sobre esto.

/** Cualquier salto de línea (LF, CRLF o CR): el texto llega de archivos de Windows y de Unix. */
const LINE_BREAK = /\r\n|\r|\n/;

const splitLines = (text: string): readonly string[] => text.split(LINE_BREAK);

// ---------------------------------------------------------------------------------------------------------
// Bloques de código del cuerpo
// ---------------------------------------------------------------------------------------------------------

/** Valla abierta: con qué carácter y cuántos se abrió (el cierre debe igualarlos) y el lenguaje de su cadena de información. */
type Fence = { char: string; length: number; language: string };

/** Bloque de código del cuerpo: su lenguaje (en minúsculas, vacío si no lo declara) y las líneas de dentro, sin las vallas. */
export type CodeBlock = { language: string; lines: readonly string[] };

/** El cuerpo partido en dos: las líneas que no son código (sin las vallas) y los bloques de código, en orden. */
export type SplitBody = { prose: readonly string[]; blocks: readonly CodeBlock[] };

/** Estado del recorrido: la valla abierta (si la hay) más lo recogido hasta ahora. */
type Scan = SplitBody & { fence: Fence | null };

/** Apertura de valla: tres o más `` ` `` o `~`, con sangría opcional, y el resto de la línea es la cadena de información. */
const FENCE_OPEN = /^[ \t]*(`{3,}|~{3,})(.*)$/;

/** Cierre de valla: solo la valla, sin nada más en la línea. */
const FENCE_CLOSE = /^[ \t]*(`{3,}|~{3,})[ \t]*$/;

/** Lenguaje de la valla: la primera palabra de la cadena de información, en minúsculas. */
const languageOf = (info: string): string => (info.trim().split(/\s+/)[0] ?? '').toLowerCase();

const openFence = (line: string): Fence | null => {
  const match = FENCE_OPEN.exec(line);
  if (match === null) return null;
  const marker = match[1] ?? '';
  const info = match[2] ?? '';
  // Una línea como ```` ```gherkin``` ```` es código en línea, no una valla (solo se exige con `` ` ``).
  if (marker.startsWith('`') && info.includes('`')) return null;
  return { char: marker.charAt(0), length: marker.length, language: languageOf(info) };
};

/** El cierre tiene que usar el mismo carácter y ser al menos tan largo como la apertura. */
const closesFence = (fence: Fence, line: string): boolean => {
  const marker = FENCE_CLOSE.exec(line)?.[1];
  return marker !== undefined && marker.charAt(0) === fence.char && marker.length >= fence.length;
};

const scanLine = (scan: Scan, line: string): Scan => {
  if (scan.fence === null) {
    const fence = openFence(line);
    if (fence === null) return { ...scan, prose: [...scan.prose, line] };
    return { ...scan, fence, blocks: [...scan.blocks, { language: fence.language, lines: [] }] };
  }
  if (closesFence(scan.fence, line)) return { ...scan, fence: null };
  // Dentro de una valla todo es contenido del último bloque, también las líneas que parecen otra valla.
  const last = scan.blocks.length - 1;
  return { ...scan, blocks: scan.blocks.map((block, index) => (index === last ? { ...block, lines: [...block.lines, line] } : block)) };
};

/**
 * Parte el cuerpo en prosa y bloques de código. Es el único lector de vallas: `extractGherkinBlocks` y el lint de
 * menciones (`rules.ts`) se apoyan en él, así que ambos coinciden en qué es código. Se recorre línea a línea
 * llevando la valla abierta, de modo que una valla que aparece como texto dentro de otro bloque más largo (una
 * plantilla en ```` ````md ````) no abre nada. Un bloque sin cierre llega hasta el final del cuerpo.
 */
export const splitCodeBlocks = (body: string): SplitBody => {
  const { prose, blocks } = splitLines(body).reduce<Scan>(scanLine, { fence: null, prose: [], blocks: [] });
  return { prose, blocks };
};

/** Contenido de cada bloque ```` ```gherkin ```` del cuerpo, en orden y sin las vallas. */
export const extractGherkinBlocks = (body: string): readonly string[] =>
  splitCodeBlocks(body)
    .blocks.filter((block) => block.language === 'gherkin')
    .map((block) => block.lines.join('\n'));

// ---------------------------------------------------------------------------------------------------------
// Esquemas del escenario
// ---------------------------------------------------------------------------------------------------------

/** Tabla de un Esquema: la primera línea es la cabecera y el resto, filas de datos (cada una con las celdas que tenga). */
export type OutlineTable = { header: readonly string[]; rows: readonly (readonly string[])[] };

/** Un `Esquema del escenario`: su nombre, sus pasos (línea completa, con la palabra clave) y sus tablas en orden. */
export type Outline = { name: string; steps: readonly string[]; tables: readonly OutlineTable[] };

/** Una celda: texto hasta la próxima `|` sin escapar; `\|` y `\\` (cualquier `\x`) viajan como par dentro de ella. */
const TABLE_CELL = /((?:\\.|[^\\|])*)\|/g;

/** Quita el escape de `\|` y `\\`; cualquier otra barra invertida se deja como está. */
const unescapeCell = (cell: string): string => cell.trim().replace(/\\([|\\])/g, '$1');

/**
 * Celdas de una fila `| a | b |`: se parte por las `|` sin escapar. Solo se descartan lo que hay antes de la
 * primera `|` y lo que sigue a la última (no una celda vacía del medio: `| a |  | c |` tiene tres celdas).
 */
const splitRow = (row: string): readonly string[] =>
  [...row.trim().slice(1).matchAll(TABLE_CELL)].map((match) => unescapeCell(match[1] ?? ''));

/** Qué es cada línea del Gherkin a efectos de armar los Esquemas. */
type Token =
  | { kind: 'outline'; name: string }
  | { kind: 'boundary' }
  | { kind: 'examples' }
  | { kind: 'step'; text: string }
  | { kind: 'row'; cells: readonly string[] }
  | { kind: 'skip' }
  | { kind: 'other' };

const BOUNDARY: Token = { kind: 'boundary' };
const EXAMPLES: Token = { kind: 'examples' };
const SKIP: Token = { kind: 'skip' };
const OTHER: Token = { kind: 'other' };

/** Línea de un Esquema: el nombre es lo que sigue a los dos puntos. */
const OUTLINE_LINE = /^Esquema del escenario:\s*(.*)$/;

/** Cabeceras que terminan el Esquema abierto: lo que venga después ya no es suyo. */
const BOUNDARY_LINE = /^(?:Característica|Antecedentes|Regla|Escenario|Ejemplo):/;

const EXAMPLES_LINE = /^Ejemplos:/;

/** Palabra clave de paso (con su espacio y algo de texto detrás) o `*`. */
const STEP_LINE = /^(?:Dados?|Dadas?|Cuando|Entonces|Y|E|Pero|\*)\s+\S/;

/** Regla de clasificación: patrón de la línea ya recortada y cómo construir su token. */
type LineRule = readonly [pattern: RegExp, toToken: (match: RegExpExecArray, line: string) => Token];

/** En orden: la primera regla cuyo patrón encaje decide el token. */
const LINE_RULES: readonly LineRule[] = [
  [OUTLINE_LINE, (match) => ({ kind: 'outline', name: match[1] ?? '' })],
  [BOUNDARY_LINE, () => BOUNDARY],
  [EXAMPLES_LINE, () => EXAMPLES],
  [STEP_LINE, (_match, line) => ({ kind: 'step', text: line })],
];

const classify = (raw: string): Token => {
  const line = raw.trim();
  // Las líneas en blanco y los comentarios no cierran una tabla ni un Esquema.
  if (line === '' || line.startsWith('#')) return SKIP;
  if (line.startsWith('|')) return { kind: 'row', cells: splitRow(line) };
  for (const [pattern, toToken] of LINE_RULES) {
    const match = pattern.exec(line);
    if (match !== null) return toToken(match, line);
  }
  return OTHER;
};

/** Esquema en construcción; `inTable` indica que la última línea con contenido fue una fila (la siguiente la continúa). */
type Draft = { name: string; steps: readonly string[]; tables: readonly OutlineTable[]; inTable: boolean };

type State = { closed: readonly Outline[]; open: Draft | null };

const toOutline = ({ name, steps, tables }: Draft): Outline => ({ name, steps, tables });

/** Los Esquemas ya cerrados más el abierto, si lo hay. */
const withOpen = ({ closed, open }: State): readonly Outline[] => (open === null ? closed : [...closed, toOutline(open)]);

/** Una fila continúa la tabla en curso (la primera línea es la cabecera); si no hay tabla en curso, abre una. */
const addRow = (draft: Draft, cells: readonly string[]): Draft => {
  const last = draft.tables.length - 1;
  const tables = draft.inTable
    ? draft.tables.map((table, index) => (index === last ? { ...table, rows: [...table.rows, cells] } : table))
    : [...draft.tables, { header: cells, rows: [] }];
  return { ...draft, tables, inTable: true };
};

const fold = (state: State, token: Token): State => {
  if (token.kind === 'outline') return { closed: withOpen(state), open: { name: token.name, steps: [], tables: [], inTable: false } };
  if (token.kind === 'boundary') return { closed: withOpen(state), open: null };
  const { open } = state;
  if (open === null || token.kind === 'skip') return state;
  if (token.kind === 'row') return { ...state, open: addRow(open, token.cells) };
  // Cualquier otra línea con contenido corta la tabla en curso; si es un paso, además se anota.
  const steps = token.kind === 'step' ? [...open.steps, token.text] : open.steps;
  return { ...state, open: { ...open, steps, inTable: false } };
};

/**
 * Los `Esquema del escenario` de un bloque Gherkin. Un Esquema abarca hasta la siguiente cabecera
 * (`Característica`, `Antecedentes`, `Regla`, `Escenario`, `Ejemplo` u otro Esquema): los pasos y tablas
 * posteriores no se le atribuyen. Cada paso se guarda como línea completa, con su palabra clave. Toda tirada de
 * líneas que empiezan por `|` es una tabla (la primera línea, su cabecera); las líneas en blanco y los
 * comentarios entre filas no la parten, y el texto que sigue a la última `|` de una fila se ignora.
 */
export const parseOutlines = (gherkin: string): readonly Outline[] =>
  withOpen(splitLines(gherkin).map(classify).reduce<State>(fold, { closed: [], open: null }));

// ---------------------------------------------------------------------------------------------------------
// Marcadores y palabras clave
// ---------------------------------------------------------------------------------------------------------

/**
 * Marcador `<nombre>`: `<` seguido de algo que no sea espacio, contenido sin `<` ni `>`, y `>` precedido de algo
 * que no sea espacio. Así `valor < 5 y > 3` no tiene marcadores. No usa `\w`: los nombres llevan acentos y `ñ`.
 */
const PLACEHOLDER = /<([^\s<>](?:[^<>]*[^\s<>])?)>/g;

/** Nombres de los marcadores de un paso, en orden de aparición y con las repeticiones (quien necesite únicos usa un `Set`). */
export const placeholdersOf = (step: string): readonly string[] =>
  [...step.matchAll(PLACEHOLDER)].map((match) => match[1] ?? '');

/** Palabras clave de bloque en inglés (llevan `:` pegado) y de paso (van seguidas de espacio), de la más larga a la más corta. */
const ENGLISH_BLOCK_KEYWORDS = ['Scenario Outline', 'Scenario Template', 'Scenarios', 'Scenario', 'Examples', 'Example', 'Background', 'Feature', 'Rule'] as const;
const ENGLISH_STEP_KEYWORDS = ['Given', 'When', 'Then', 'And', 'But'] as const;

/** Al inicio de la línea recortada; el delimitador evita que prosa como «Andrés inicia…» cuente como `And`. */
const ENGLISH_KEYWORD = new RegExp(`^(?:(${ENGLISH_BLOCK_KEYWORDS.join('|')}):|(${ENGLISH_STEP_KEYWORDS.join('|')})(?=\\s|$))`);

/**
 * Palabras clave de Gherkin en inglés que abren una línea (sin los dos puntos), en orden y con las repeticiones.
 * Distingue mayúsculas, y no mira celdas de tabla, comentarios ni texto a mitad de línea.
 */
export const findEnglishKeywords = (gherkin: string): readonly string[] =>
  splitLines(gherkin).flatMap((line) => {
    const match = ENGLISH_KEYWORD.exec(line.trim());
    const keyword = match?.[1] ?? match?.[2];
    return keyword === undefined ? [] : [keyword];
  });
