import { TEST_RESULT_TONE, can, formatDate, type Lang, type Role, type TestCaseDto, type TestResult, type Tone } from '@sigpro/shared';

// Lógica pura de la pantalla de Verificación: tono de los resultados, permisos, selección, páginas y fechas. Sin imports de
// react-native: se prueba con Vitest en Node (`view.test.ts`).

/** Tono del badge de un resultado: el mismo vocabulario que la web (`TEST_RESULT_TONE`). */
export const resultTone = (result: TestResult): Tone => TEST_RESULT_TONE[result];

/** `data-state` de una tarjeta: el último resultado o «none» si nunca se ejecutó (como la fila de la web). */
export const rowState = (lastResult: TestResult | null): string => lastResult ?? 'none';

/** Si el rol puede registrar ejecuciones (`testrun.execute`). */
export const canExecute = (role: Role): boolean => can(role, 'testrun.execute');

/** Añade la página siguiente sin repetir casos: si un caso ya estaba (la lista cambió entre peticiones), se conserva el primero. */
export const appendCases = (current: readonly TestCaseDto[], incoming: readonly TestCaseDto[]): readonly TestCaseDto[] => {
  const known = new Set(current.map((testCase) => testCase.code));
  return [...current, ...incoming.filter((testCase) => !known.has(testCase.code))];
};

/** Marca o desmarca un código de la selección. */
export const toggleSelection = (selected: readonly string[], code: string): readonly string[] =>
  selected.includes(code) ? selected.filter((candidate) => candidate !== code) : [...selected, code];

/** Todos los visibles marcados → los quita de la selección; si falta alguno → los añade todos (como «Seleccionar todos» de la web). */
export const toggleAllSelection = (selected: readonly string[], visible: readonly string[]): readonly string[] =>
  visible.every((code) => selected.includes(code)) ? selected.filter((code) => !visible.includes(code)) : Array.from(new Set([...selected, ...visible]));

export const allSelected = (selected: readonly string[], visible: readonly string[]): boolean => visible.length > 0 && visible.every((code) => selected.includes(code));

/** Quita de la selección lo que ya no está en la lista (tras filtrar o recargar). */
export const pruneSelection = (selected: readonly string[], visible: readonly string[]): readonly string[] => selected.filter((code) => visible.includes(code));

/** Fecha y hora de una ejecución: `12/11/2026 09:30` (la fecha en el formato del idioma y la hora del ISO, como la web). */
export const dateTime = (iso: string, lang: Lang): string => `${formatDate(iso.slice(0, 10), lang)} ${iso.slice(11, 16)}`;

/** Nombre del informe cuando el servidor no manda `Content-Disposition`. */
export const REPORT_FALLBACK_NAME = 'informe-verificacion.pdf';

/** Ámbito del informe de la lista: el programa filtrado o todo el tenant (la web no envía búsqueda ni resultado). */
export const reportScope = (program: string): { readonly program?: string } => (program ? { program } : {});

/** El botón de informe se deshabilita mientras carga, si falla o si no hay casos. */
export const reportDisabled = (phase: 'loading' | 'ready' | 'error', total: number): boolean => phase !== 'ready' || total === 0;
