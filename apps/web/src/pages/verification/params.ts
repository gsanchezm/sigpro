import { TEST_CASE_SORT_COLUMNS, TEST_RESULTS, type SortDir, type TestCaseListQuery, type TestCaseSortColumn, type TestResult } from '@sigpro/shared';

/** Estado de la lista de casos de prueba; vive en la URL (`/verification?result=fail&page=2`) para compartirlo y recargarlo. */
export interface VerificationState {
  readonly q: string;
  readonly program: string;
  readonly result: TestResult | 'none' | '';
  readonly sort: TestCaseSortColumn;
  readonly dir: SortDir;
  readonly page: number;
}

export const DEFAULT_STATE: VerificationState = { q: '', program: '', result: '', sort: 'code', dir: 'asc', page: 1 };

const asEnum = <T extends string>(value: string | null, allowed: readonly T[], fallback: T): T => ((allowed as readonly string[]).includes(value ?? '') ? (value as T) : fallback);

export const parseState = (params: URLSearchParams): VerificationState => {
  const page = Number.parseInt(params.get('page') ?? '', 10);
  return {
    q: params.get('q')?.trim() ?? '',
    program: params.get('program')?.trim() ?? '',
    result: asEnum<TestResult | 'none' | ''>(params.get('result'), [...TEST_RESULTS, 'none'], ''),
    sort: asEnum(params.get('sort'), TEST_CASE_SORT_COLUMNS, DEFAULT_STATE.sort),
    dir: asEnum<SortDir>(params.get('dir'), ['asc', 'desc'], DEFAULT_STATE.dir),
    page: Number.isInteger(page) && page > 0 ? page : 1,
  };
};

/** Solo escribe lo que se aparta del valor por defecto. */
export const toSearchString = (state: VerificationState): string => {
  const entries = (Object.keys(DEFAULT_STATE) as (keyof VerificationState)[]).filter((key) => state[key] !== DEFAULT_STATE[key]).map((key): [string, string] => [key, String(state[key])]);
  return entries.length ? `?${new URLSearchParams(entries).toString()}` : '';
};

export const toQuery = (state: VerificationState): TestCaseListQuery => ({
  ...(state.q ? { q: state.q } : {}),
  ...(state.program ? { program: state.program } : {}),
  ...(state.result ? { result: state.result } : {}),
  sort: state.sort,
  dir: state.dir,
  page: state.page,
});

export const nextSort = (state: VerificationState, column: TestCaseSortColumn): VerificationState => ({
  ...state,
  sort: column,
  dir: state.sort === column && state.dir === 'asc' ? 'desc' : 'asc',
  page: 1,
});

export const hasActiveFilters = (state: VerificationState): boolean => Boolean(state.q || state.program || state.result);
