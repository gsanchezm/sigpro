import { PAGE_SIZE, PROGRAM_STATUSES, type ProgramListQuery, type ProgramStatus } from '@sigpro/shared';

// Filtros de la lista de programas. Viven en la URL (`/programs?status=on_hold&q=gestión`), igual que en la web.
// Sin react-native: todo esto se prueba con Vitest.

/** Espera tras la última pulsación del buscador antes de llevar el texto a la URL. */
export const SEARCH_DEBOUNCE_MS = 250;

export interface ProgramsFilters {
  /** Texto del buscador (sin espacios sobrantes). Vacío = sin filtro. */
  readonly q: string;
  /** Estado de programa, o vacío para todos. */
  readonly status: ProgramStatus | '';
}

export const NO_FILTERS: ProgramsFilters = { q: '', status: '' };

/** Valor de un parámetro de ruta: texto o, si se repite, el primero. */
export const firstParam = (value: string | readonly string[] | undefined): string | undefined => (typeof value === 'string' ? value : value?.[0]);

const isStatus = (value: string): value is ProgramStatus => (PROGRAM_STATUSES as readonly string[]).includes(value);

/** Parámetros de ruta → filtros válidos. Un estado desconocido se ignora (equivale a «Todos»). */
export const parseProgramsFilters = (q: string, status: string): ProgramsFilters => ({
  q: q.trim(),
  status: isStatus(status) ? status : '',
});

/** Filtros → parámetros de ruta. Lo que vale lo mismo que el valor por defecto no aparece en la URL. */
export const filtersToParams = (filters: ProgramsFilters): { readonly status: string | undefined; readonly q: string | undefined } => ({
  status: filters.status || undefined,
  q: filters.q.trim() || undefined,
});

/** Filtros → consulta de la API. La página la decide la lista («Cargar más» añade la siguiente). */
export const toProgramsQuery = (filters: ProgramsFilters, page: number): ProgramListQuery => ({
  ...(filters.q ? { q: filters.q } : {}),
  ...(filters.status ? { status: filters.status } : {}),
  sort: 'code',
  dir: 'asc',
  page,
  pageSize: PAGE_SIZE,
});

export const hasActiveFilters = (filters: ProgramsFilters): boolean => Boolean(filters.q || filters.status);

/** Opciones del selector de estado: «Todos» y los cinco estados, en el orden del dominio. */
export const STATUS_CHOICES = ['all', ...PROGRAM_STATUSES] as const;
export type StatusChoice = (typeof STATUS_CHOICES)[number];

/** Opción seleccionada para los filtros activos. */
export const choiceOf = (filters: ProgramsFilters): StatusChoice => filters.status || 'all';

/** Opción del selector → estado del filtro (`all` = sin filtro). */
export const choiceToStatus = (choice: StatusChoice): ProgramStatus | '' => (choice === 'all' ? '' : choice);

/** «1–10 de 24»: del primer resultado al último cargado (con «Cargar más» crece) sobre el total. Vacío si no hay nada. */
export const rangeLabel = (loaded: number, total: number, shownWord: string): string => (loaded === 0 || total === 0 ? '' : `1–${loaded} ${shownWord} ${total}`);

/** Queda al menos una página por pedir. */
export const hasMorePages = (page: number, pages: number): boolean => page < pages;
