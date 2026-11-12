import { PAGE_SIZE, TEST_CASE_SORT_COLUMNS, TEST_RESULTS, type SortDir, type TestCaseListQuery, type TestCaseSortColumn, type TestResult } from '@sigpro/shared';

// Filtros de la lista de casos de prueba. Viven en la URL (`/verification?result=fail&sort=runs&dir=desc`), con los mismos
// nombres que la web. La página no va en la URL: en el móvil «Cargar más» añade la siguiente.
// Sin react-native: todo esto se prueba con Vitest.

/** Espera tras la última pulsación del buscador antes de llevar el texto a la URL. */
export const SEARCH_DEBOUNCE_MS = 250;

/** Valor del filtro de resultado: un resultado, «none» (sin ejecuciones) o vacío (todos). */
export type ResultFilter = TestResult | 'none' | '';

export interface VerificationFilters {
  /** Texto del buscador (sin espacios sobrantes). Vacío = sin filtro. */
  readonly q: string;
  /** Código del programa, o vacío para todos. */
  readonly program: string;
  readonly result: ResultFilter;
  readonly sort: TestCaseSortColumn;
  readonly dir: SortDir;
}

export const DEFAULT_FILTERS: VerificationFilters = { q: '', program: '', result: '', sort: 'code', dir: 'asc' };

/** Valor de un parámetro de ruta: texto o, si se repite, el primero. */
export const firstParam = (value: string | readonly string[] | undefined): string | undefined => (typeof value === 'string' ? value : value?.[0]);

const asEnum = <T extends string>(value: string | undefined, allowed: readonly T[], fallback: T): T => (allowed.find((candidate) => candidate === value) ?? fallback);

/** Parámetros de ruta → filtros válidos. Un valor desconocido se ignora (equivale al de por defecto), como la web. */
export const parseFilters = (params: { readonly q?: string; readonly program?: string; readonly result?: string; readonly sort?: string; readonly dir?: string }): VerificationFilters => ({
  q: (params.q ?? '').trim(),
  program: (params.program ?? '').trim(),
  result: asEnum<ResultFilter>(params.result, [...TEST_RESULTS, 'none'], ''),
  sort: asEnum(params.sort, TEST_CASE_SORT_COLUMNS, DEFAULT_FILTERS.sort),
  dir: asEnum<SortDir>(params.dir, ['asc', 'desc'], DEFAULT_FILTERS.dir),
});

/** Filtros → parámetros de ruta. Lo que vale lo mismo que el valor por defecto no aparece en la URL (`undefined` lo quita). */
export const filtersToParams = (filters: VerificationFilters): Readonly<Record<keyof VerificationFilters, string | undefined>> => ({
  q: filters.q.trim() || undefined,
  program: filters.program || undefined,
  result: filters.result || undefined,
  sort: filters.sort === DEFAULT_FILTERS.sort ? undefined : filters.sort,
  dir: filters.dir === DEFAULT_FILTERS.dir ? undefined : filters.dir,
});

/** Filtros → consulta de la API (misma forma que la web; la página la decide la lista). */
export const toQuery = (filters: VerificationFilters, page: number): TestCaseListQuery => ({
  ...(filters.q ? { q: filters.q } : {}),
  ...(filters.program ? { program: filters.program } : {}),
  ...(filters.result ? { result: filters.result } : {}),
  sort: filters.sort,
  dir: filters.dir,
  page,
  pageSize: PAGE_SIZE,
});

/** Pulsar una columna la elige en ascendente; pulsar la activa invierte el sentido (como la cabecera de la tabla de la web). */
export const nextSort = (filters: VerificationFilters, column: TestCaseSortColumn): VerificationFilters => ({
  ...filters,
  sort: column,
  dir: filters.sort === column && filters.dir === 'asc' ? 'desc' : 'asc',
});

/** Hay búsqueda, programa o resultado aplicados (el orden no cuenta). */
export const hasActiveFilters = (filters: VerificationFilters): boolean => Boolean(filters.q || filters.program || filters.result);

/** «Limpiar filtros» conserva el orden elegido, como la web. */
export const clearedFilters = (filters: VerificationFilters): VerificationFilters => ({ ...DEFAULT_FILTERS, sort: filters.sort, dir: filters.dir });

/** Opción «todos» de un selector (el valor de la opción no puede ser vacío: forma parte de su `testID`). */
export const ALL = 'all';

/** Valor del filtro → opción del selector, y al revés. */
export const toChoice = (value: string): string => value || ALL;
export const fromChoice = (choice: string): string => (choice === ALL ? '' : choice);

/** Opciones del filtro de resultado: todos, los tres resultados y «sin ejecutar». */
export const RESULT_CHOICES = [ALL, ...TEST_RESULTS, 'none'] as const;
export type ResultChoice = (typeof RESULT_CHOICES)[number];

/** Narrowing de la opción elegida a un valor de filtro (cualquier otra cosa equivale a «todos»). */
export const resultFromChoice = (choice: string): ResultFilter => asEnum<ResultFilter>(fromChoice(choice), [...TEST_RESULTS, 'none'], '');

/** Columnas de orden en el orden de la tabla de la web. */
export const SORT_COLUMNS = TEST_CASE_SORT_COLUMNS;

/** Queda al menos una página por pedir. */
export const hasMorePages = (page: number, pages: number): boolean => page < pages;

/** «1–10 de 25»: del primer resultado al último cargado (con «Cargar más» crece) sobre el total. */
export const rangeOf = (loaded: number, total: number): { readonly from: number; readonly to: number; readonly total: number } => ({
  from: loaded === 0 ? 0 : 1,
  to: loaded,
  total,
});
