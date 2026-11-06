import { PAGE_SIZE, type TestCaseDto, type TestCaseListQuery, type TestCaseListResponse, type TestCaseSortColumn, type TestResult } from '@sigpro/shared';

// Filtros, orden y paginación de casos de prueba. Son 25 por tenant, así que se calculan en memoria sobre las filas ya
// resumidas (el último resultado y el nº de ejecuciones son derivados y no se pueden ordenar con una sola consulta simple).

const MAX_PAGE_SIZE = 100;

/** Orden del resultado ascendente: fallidos primero, sin ejecutar al final. */
const RESULT_RANK: Readonly<Record<TestResult | 'none', number>> = { fail: 0, blocked: 1, pass: 2, none: 3 };

export interface RunSummary {
  readonly id: string;
  readonly executedAt: Date;
  readonly result: TestResult;
}

/** Resumen de las ejecuciones de un caso: la última (por fecha y, a igualdad, por id) y el total. */
export const summarizeRuns = (runs: readonly RunSummary[]): Pick<TestCaseDto, 'runCount' | 'lastResult' | 'lastRunAt'> => {
  const last = [...runs].sort((a, b) => b.executedAt.getTime() - a.executedAt.getTime() || b.id.localeCompare(a.id))[0];
  return { runCount: runs.length, lastResult: last?.result ?? null, lastRunAt: last?.executedAt.toISOString() ?? null };
};

export const matchesQuery = (testCase: TestCaseDto, query: TestCaseListQuery): boolean => {
  const needle = query.q?.trim().toLowerCase() ?? '';
  const textOk = needle === '' || testCase.code.toLowerCase().includes(needle) || testCase.title.toLowerCase().includes(needle);
  const programOk = !query.program || testCase.programCode === query.program;
  const resultOk = !query.result || (query.result === 'none' ? testCase.lastResult === null : testCase.lastResult === query.result);
  return textOk && programOk && resultOk;
};

const COMPARATORS: Readonly<Record<TestCaseSortColumn, (a: TestCaseDto, b: TestCaseDto) => number>> = {
  code: (a, b) => a.code.localeCompare(b.code),
  title: (a, b) => a.title.localeCompare(b.title, 'es'),
  program: (a, b) => a.programCode.localeCompare(b.programCode),
  result: (a, b) => RESULT_RANK[a.lastResult ?? 'none'] - RESULT_RANK[b.lastResult ?? 'none'],
  runs: (a, b) => a.runCount - b.runCount,
};

export const sortCases = (cases: readonly TestCaseDto[], column: TestCaseSortColumn = 'code', dir: 'asc' | 'desc' = 'asc'): readonly TestCaseDto[] =>
  [...cases].sort((a, b) => (dir === 'desc' ? -1 : 1) * COMPARATORS[column](a, b) || a.code.localeCompare(b.code));

export const normalizePaging = (query: Pick<TestCaseListQuery, 'page' | 'pageSize'>): { page: number; pageSize: number } => ({
  page: Math.max(1, Math.floor(query.page ?? 1)),
  pageSize: Math.min(MAX_PAGE_SIZE, Math.max(1, Math.floor(query.pageSize ?? PAGE_SIZE))),
});

/** Lista final: filtra, ordena y corta la página (la página se acota al rango real, como en Programas). */
export const buildCaseList = (all: readonly TestCaseDto[], query: TestCaseListQuery): TestCaseListResponse => {
  const filtered = sortCases(all.filter((testCase) => matchesQuery(testCase, query)), query.sort, query.dir);
  const { page, pageSize } = normalizePaging(query);
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, pages);
  return {
    items: filtered.slice((safePage - 1) * pageSize, safePage * pageSize),
    total: filtered.length,
    totalRuns: filtered.reduce((sum, testCase) => sum + testCase.runCount, 0),
    totalAll: all.length,
    page: safePage,
    pageSize,
    pages,
  };
};
