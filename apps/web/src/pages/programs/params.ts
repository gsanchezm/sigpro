import { PROGRAM_SORT_COLUMNS, PROGRAM_STATUSES, type ProgramListQuery, type ProgramSortColumn, type ProgramStatus, type SortDir } from '@sigpro/shared';

/** Estado de la lista de programas. Vive en la URL (`/programs?status=active&page=2`) para poder compartirlo y recargarlo. */
export interface ListState {
  readonly q: string;
  readonly status: ProgramStatus | '';
  readonly from: string;
  readonly to: string;
  readonly owner: string;
  readonly sort: ProgramSortColumn;
  readonly dir: SortDir;
  readonly page: number;
}

export const DEFAULT_LIST_STATE: ListState = { q: '', status: '', from: '', to: '', owner: '', sort: 'code', dir: 'asc', page: 1 };

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const asEnum = <T extends string>(value: string | null, allowed: readonly T[], fallback: T): T => (allowed as readonly string[]).includes(value ?? '') ? (value as T) : fallback;

export const parseListParams = (params: URLSearchParams): ListState => {
  const page = Number.parseInt(params.get('page') ?? '', 10);
  const date = (key: string): string => (ISO_DATE.test(params.get(key) ?? '') ? (params.get(key) as string) : '');
  return {
    q: params.get('q')?.trim() ?? '',
    status: asEnum<ProgramStatus | ''>(params.get('status'), PROGRAM_STATUSES, ''),
    from: date('from'),
    to: date('to'),
    owner: params.get('owner')?.trim() ?? '',
    sort: asEnum(params.get('sort'), PROGRAM_SORT_COLUMNS, DEFAULT_LIST_STATE.sort),
    dir: asEnum<SortDir>(params.get('dir'), ['asc', 'desc'], DEFAULT_LIST_STATE.dir),
    page: Number.isInteger(page) && page > 0 ? page : 1,
  };
};

/** Solo escribe lo que se aparta del valor por defecto. */
export const toSearchString = (state: ListState): string => {
  const entries = (Object.keys(DEFAULT_LIST_STATE) as (keyof ListState)[])
    .filter((key) => state[key] !== DEFAULT_LIST_STATE[key])
    .map((key): [string, string] => [key, String(state[key])]);
  return entries.length ? `?${new URLSearchParams(entries).toString()}` : '';
};

/** Estado → query de la API (los vacíos se omiten). */
export const toListQuery = (state: ListState): ProgramListQuery => ({
  ...(state.q ? { q: state.q } : {}),
  ...(state.status ? { status: state.status } : {}),
  ...(state.from ? { from: state.from } : {}),
  ...(state.to ? { to: state.to } : {}),
  ...(state.owner ? { owner: state.owner } : {}),
  sort: state.sort,
  dir: state.dir,
  page: state.page,
});

/** Cambiar un filtro vuelve siempre a la página 1. */
export const withFilter = (state: ListState, change: Partial<Pick<ListState, 'q' | 'status' | 'from' | 'to' | 'owner'>>): ListState => ({ ...state, ...change, page: 1 });

export const nextSort = (state: ListState, column: ProgramSortColumn): ListState => ({
  ...state,
  sort: column,
  dir: state.sort === column && state.dir === 'asc' ? 'desc' : 'asc',
  page: 1,
});

export const hasActiveFilters = (state: ListState): boolean => Boolean(state.q || state.status || state.from || state.to || state.owner);
