// Manifiesto de filas: la lista exacta de todas las filas de todos los Esquemas de las historias, con sus celdas y sus
// pasos ya resueltos. El arnés que ejecuta los ejemplos (`e2e/story-runs/`) parte de ella: no puede saltarse ni
// inventar una fila. Es puro: recibe archivos ya leídos y devuelve datos; `git` y el disco los toca `cli.ts`.
import { extractGherkinBlocks, parseOutlines, substitutePlaceholders, type Outline } from './gherkin';
import { PLATFORM_LABELS, type StoryFile } from './model';

/** Una fila de un `Esquema del escenario`, lista para ejecutarse. */
export type ManifestRow = {
  /** `US-LOGIN-004/E2/F3`: historia / Esquema (1..n en el orden del archivo) / fila (1..n sobre todas las tablas del Esquema). */
  rowId: string;
  story: string;
  /** Etiqueta de plataforma de la historia (`api`, `web`, `movil`, `ios`, `android` o `transversal`). */
  platform: string;
  verificacion: string;
  /** La historia lleva la etiqueta `no-implementada`. */
  noImplementada: boolean;
  esquemaIndex: number;
  esquema: string;
  rowIndex: number;
  /** Cabecera → texto de la celda, ya sin escapes. */
  cells: Readonly<Record<string, string>>;
  /** Los pasos del Esquema (con su palabra clave) con cada `<marcador>` sustituido por el texto de su celda. */
  resolvedSteps: readonly string[];
};

type Story = Extract<StoryFile, { kind: 'story' }>;

const NOT_IMPLEMENTED_LABEL = 'no-implementada';

const isStory = (file: StoryFile): file is Story => file.kind === 'story';

/** Orden por unidades de código: no depende del idioma del sistema, así que el manifiesto sale igual en cualquier máquina. */
const compareText = (a: string, b: string): number => Number(a > b) - Number(a < b);

/** La etiqueta de plataforma; una historia sin ninguna (el linter lo prohíbe) queda con cadena vacía en vez de lanzar. */
const platformOf = (labels: readonly string[]): string => PLATFORM_LABELS.find((label) => labels.includes(label)) ?? '';

/** Una fila de datos junto con la cabecera de su propia tabla: un Esquema puede tener varias tablas con columnas distintas. */
type TableRow = { header: readonly string[]; cells: readonly string[] };

/** Las filas de datos de todas las tablas del Esquema, seguidas y en orden. */
const tableRowsOf = (outline: Outline): readonly TableRow[] =>
  outline.tables.flatMap((table) => table.rows.map((cells) => ({ header: table.header, cells })));

/** Cabecera → celda de esa posición; una fila más corta que la cabecera no inventa las celdas que le faltan. */
const cellEntries = ({ header, cells }: TableRow): readonly (readonly [string, string])[] =>
  header.flatMap((name, position) => (position < cells.length ? [[name, cells[position] ?? ''] as const] : []));

const rowsOfOutline = (story: Story, outline: Outline, esquemaIndex: number): readonly ManifestRow[] =>
  tableRowsOf(outline).map((tableRow, position) => {
    const entries = cellEntries(tableRow);
    const values = new Map(entries);
    return {
      rowId: `${story.fm.id}/E${esquemaIndex}/F${position + 1}`,
      story: story.fm.id,
      platform: platformOf(story.fm.etiquetas),
      verificacion: story.fm.verificacion,
      noImplementada: story.fm.etiquetas.includes(NOT_IMPLEMENTED_LABEL),
      esquemaIndex,
      esquema: outline.name,
      rowIndex: position + 1,
      cells: Object.fromEntries(entries),
      resolvedSteps: outline.steps.map((step) => substitutePlaceholders(step, values)),
    };
  });

/** Los Esquemas de todos los bloques `gherkin` de la historia, en el orden del archivo. */
const outlinesOf = (story: Story): readonly Outline[] => extractGherkinBlocks(story.body).flatMap((block) => parseOutlines(block));

/**
 * Todas las filas de todos los Esquemas de las historias (las épicas no tienen), ordenadas por id de historia, luego
 * por Esquema y luego por fila: el orden es estable y no depende del de entrada. Un `<marcador>` de un paso que no
 * es cabecera de la tabla de su fila se deja tal cual; avisarlo es cosa del linter, no de aquí.
 */
export const buildManifestRows = (files: readonly StoryFile[]): readonly ManifestRow[] =>
  files
    .filter(isStory)
    .sort((a, b) => compareText(a.fm.id, b.fm.id))
    .flatMap((story) => outlinesOf(story).flatMap((outline, position) => rowsOfOutline(story, outline, position + 1)));

/** Cuántas filas tiene cada historia, en el orden del manifiesto (una historia sin filas no aparece). */
export const countRowsByStory = (rows: readonly ManifestRow[]): ReadonlyMap<string, number> =>
  new Map([...new Set(rows.map((row) => row.story))].map((id) => [id, rows.filter((row) => row.story === id).length]));
