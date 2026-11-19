import type { Page } from '@playwright/test';
import { cell, check, preparationFailedWeb, strict, type Check } from '../../support/checks';
import { ACTION, CEILING_MS, isVisible, quoted, runSteps, safe, waitUntil } from '../../support/browser';
import { defineBrowserRows, type BrowserRowHandler } from '../../core/framework';
import { resetTenants, TENANT_A } from '../../../story-runs/support/prepare';
import {
  codesBetween,
  countOf,
  delayGet,
  describeCodes,
  errorLeaves,
  errorOf,
  failGet,
  failFirstGet,
  leavesOf,
  oneText,
  onWeb,
  openVerification,
  pageOf,
  retryOf,
  rowOf,
  signIn,
  snapshotOf,
  sortOf,
  tableOf,
  VERIFICATION_PATH,
  waitForList,
  type FailTally,
  type FailureMode,
  type ListSnapshot,
  concluded,
} from './common';

/** Espera de las observaciones de la lista (la historia no fija plazos; es el techo de la prueba). */
const WAIT_MS = CEILING_MS;

// US-VER-CASOS-004 — Ver la tabla de casos de prueba y sus estados de carga, vacío y error (web). Preparación de cada fila:
// reinicio de alumno01 con el token de su administrador; después gestor@sigpro.test entra desde /login?tenant=alumno01 en un
// navegador sin sesión guardada y llega a /programs; luego se abre /verification. Escritorio 1440 px salvo que «ancho» diga otra cosa.

const STATE_LABELS: readonly string[] = ['Superado', 'Fallido', 'Bloqueado', 'Sin ejecutar'];
const PROGRAM_CODE = /^PRG-\d{3}$/;
const TITLE = /^Verificar .+ \(caso \d{3}\)$/;
const TABLE_HEADERS = ['code', 'title', 'program', 'result', 'runs'] as const;

/** Celda «ancho» → ancho de la ventana en px. */
const WIDTHS: ReadonlyMap<string, number> = new Map<string, number>([
  ['1440', 1440],
  ['1024', 1024],
  ['1023', 1023],
  ['390', 390],
]);

/** Celda «presentacion» → forma que debe verse. */
const SHAPES: ReadonlyMap<string, 'table' | 'cards'> = new Map<string, 'table' | 'cards'>([
  ['una tabla con las columnas «Código», «Título», «Programa», «Último resultado» y «Ejecuciones»', 'table'],
  ['tarjetas, una por caso, con su código, su resultado, su título, su programa y su número de ejecuciones', 'cards'],
]);

/** Celda «espera» → retraso de la respuesta de GET /api/test-cases. */
const DELAYS: ReadonlyMap<string, number> = new Map<string, number>([
  ['1 segundo', 1_000],
  ['3 segundos', 3_000],
]);

/** Celda «fallo» → cómo falla la petición. */
const FAILURES: ReadonlyMap<string, FailureMode> = new Map<string, FailureMode>([
  ['la prueba hace que GET /api/test-cases responda con error 500', 'status500'],
  ['la prueba corta GET /api/test-cases sin respuesta del servidor', 'noResponse'],
]);

/** Celda «detalle» → lo que debe verse en la traza del aviso. */
const TRACES: ReadonlyMap<string, 'trace' | 'text'> = new Map<string, 'trace' | 'text'>([
  ['la traza de la petición fallida', 'trace'],
  ['el texto «No se pudo contactar con el servidor»', 'text'],
]);

/** Celda «primero» del reintento: primer caso de la lista tras «Reintentar». */
const FIRST_AFTER_RETRY: ReadonlyMap<string, string> = new Map<string, string>([['TC-001', 'TC-001']]);

/** Cabeceras de la tabla, en el orden que dice la celda «presentacion» (los textos entre «…»). */
const headersOf = (text: string): readonly string[] => Array.from(text.matchAll(/«([^»]+)»/g), (match) => match[1] ?? '');

interface RowLike {
  readonly code: string;
  readonly leaves: readonly string[];
  /** Texto del badge de último resultado de la fila (su propio testid, dentro de la fila). */
  readonly badge: string | null;
}

/** Filas o tarjetas que se ven (código y hojas de texto), leídas en una sola evaluación. Sin lectura, `undefined`. */
const rowsShown = (page: Page): Promise<readonly RowLike[] | undefined> =>
  safe(
    () =>
      pageOf(page).evaluate(
        (root: Element) =>
          Array.from(root.querySelectorAll('[data-testid]'))
            .filter((node) => /^testcase-row-TC-\d{3}$/.test(node.getAttribute('data-testid') ?? ''))
            .map((node) => ({
              code: (node.getAttribute('data-testid') ?? '').slice('testcase-row-'.length),
              leaves: Array.from(node.querySelectorAll('*'))
                .filter((leaf) => leaf.children.length === 0)
                .map((leaf) => (leaf.textContent ?? '').trim())
                .filter((text) => text !== ''),
              badge: node.querySelector('[data-testid="testcase-result-badge"]')?.textContent?.trim() ?? null,
            })),
        undefined,
        { timeout: 2000 },
      ),
    undefined,
  );

/** Una fila (o tarjeta) trae su código, su resultado, su título, su programa y su número de ejecuciones. */
const hasOwnData = (entry: RowLike, shape: 'table' | 'cards'): boolean => {
  // Valores, no solo forma: el código, el resultado del badge, el título de ese número de caso, el programa del caso y ≥ 1 ejecución
  const caseNumber = entry.code.slice(3);
  const runsLeaf = shape === 'cards' ? entry.leaves.find((leaf) => /^\d+ ejecuciones$/.test(leaf)) : entry.leaves.filter((leaf) => /^\d+$/.test(leaf)).at(-1);
  const runs = runsLeaf === undefined ? 0 : Number(runsLeaf.split(' ')[0]);
  const title = entry.leaves.find((leaf) => TITLE.test(leaf) && leaf.endsWith(`(caso ${caseNumber})`));
  return entry.leaves.includes(entry.code) && STATE_LABELS.includes(entry.badge ?? '') && title !== undefined && entry.leaves.includes(programOfCode(entry.code)) && runs >= 1;
};

/** Programa de un caso según la agrupación del seed (9 casos por programa): TC-001 PRG-001, TC-010 PRG-002, TC-024 PRG-003 (Ejemplos de 003 y 006). */
const programOfCode = (code: string): string => `PRG-${String(Math.floor((Number(code.slice(3)) - 1) / 9) + 1).padStart(3, '0')}`;

// --- Esquema 1: la lista se presenta como tabla en escritorio y como tarjetas por debajo de 1024 px ----------------------

const presentation: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const width = strict('ancho', WIDTHS, cell(row, 'ancho'));
  const shape = strict('presentacion', SHAPES, cell(row, 'presentacion'));
  const expected = `${cell(row, 'presentacion')} con 10 casos en la primera página`;
  const opened = await signIn(page, width);
  if (opened) return preparationFailedWeb(expected, opened);
  const loaded = await openVerification(page);
  if (loaded) return preparationFailedWeb(expected, loaded);
  const rows = await rowsShown(page);
  const tables = await tableOf(page).count();
  const checks: Check[] = [];
  if (shape === 'table') {
    const headers = await Promise.all(TABLE_HEADERS.map((key) => oneText(sortOf(page, key))));
    const expectedHeaders = headersOf(cell(row, 'presentacion'));
    const same = tables === 1 && headers.join('|') === expectedHeaders.join('|');
    checks.push(check(same, `una tabla con las cabeceras ${expectedHeaders.join(', ')}`, `${tables} tabla(s) con las cabeceras ${headers.map((header) => header ?? '(sin leer)').join(', ')}`));
  } else {
    checks.push(check(tables === 0, 'sin tabla (tarjetas)', `${tables} tabla(s)`));
  }
  const codes = rows?.map((entry) => entry.code);
  checks.push(check(rows?.length === 10 && codes?.[0] === 'TC-001', '10 casos en la primera página, empezando por TC-001', `${rows?.length ?? '(sin leer)'} casos, empezando por ${codes?.[0] ?? '(ninguno)'}`));
  const ok = (rows ?? []).filter((entry) => hasOwnData(entry, shape)).length;
  checks.push(check(rows !== undefined && rows.length > 0 && ok === rows.length, `cada ${shape === 'table' ? 'fila' : 'tarjeta'} con su código, su resultado, su título, su programa y sus ejecuciones`, `${ok} de ${rows?.length ?? 0} con sus datos`));
  return concluded(checks);
};

// --- Esquema 2: cada caso muestra su programa, su título, su último resultado y sus ejecuciones ---------------------------

const caseData: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const code = cell(row, 'codigo');
  const expected = `el caso ${code} con programa ${cell(row, 'programa')}, título ${cell(row, 'titulo')}, resultado ${cell(row, 'resultado')} y ${cell(row, 'ejecuciones')} ejecuciones`;
  const opened = await signIn(page, 1440);
  if (opened) return preparationFailedWeb(expected, opened);
  const loaded = await openVerification(page);
  if (loaded) return preparationFailedWeb(expected, loaded);
  const leaves = await leavesOf(rowOf(page, code));
  const entry = (await rowsShown(page))?.find((item) => item.code === code);
  const program = leaves?.find((leaf) => PROGRAM_CODE.test(leaf));
  const title = leaves?.find((leaf) => TITLE.test(leaf));
  const state = entry?.badge ?? undefined;
  const runs = leaves?.filter((leaf) => /^\d+$/.test(leaf)).at(-1);
  return concluded([
    check(program === cell(row, 'programa'), `el programa ${cell(row, 'programa')}`, `el programa ${program ?? '(sin leer)'}`),
    check(title === cell(row, 'titulo'), `el título ${cell(row, 'titulo')}`, `el título ${title ?? '(sin leer)'}`),
    check(state === quoted(cell(row, 'resultado')), `el resultado ${cell(row, 'resultado')}`, `el resultado ${state ?? '(sin leer)'}`),
    check(runs === cell(row, 'ejecuciones'), `${cell(row, 'ejecuciones')} ejecuciones (columna «Ejecuciones»)`, `${runs ?? '(sin leer)'} en la columna «Ejecuciones»`),
  ]);
};

// --- Esquema 3: el resumen y el recuento describen la lista completa ----------------------------------------------------

const summaryAndCount: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const expected = `el resumen ${cell(row, 'resumen')} y el recuento ${cell(row, 'recuento')}`;
  const opened = await signIn(page, 1440);
  if (opened) return preparationFailedWeb(expected, opened);
  const loaded = await openVerification(page);
  if (loaded) return preparationFailedWeb(expected, loaded);
  const subtitle = await oneText(pageOf(page).getByText(/ casos de prueba · /));
  const count = await oneText(countOf(page));
  return concluded([
    check(subtitle === quoted(cell(row, 'resumen')), `el resumen ${cell(row, 'resumen')}`, `el resumen «${subtitle ?? '(sin leer)'}»`),
    check(count === quoted(cell(row, 'recuento')), `el recuento ${cell(row, 'recuento')}`, `el recuento «${count ?? '(sin leer)'}»`),
  ]);
};

// --- Esquema 4: mientras llega la lista se ven filas de carga y después los casos ---------------------------------------

const loadingRows: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const ms = strict('espera', DELAYS, cell(row, 'espera'));
  const expected = `mientras espera, filas de carga y ningún caso; al llegar, 10 casos empezando por TC-001 (espera ${cell(row, 'espera')})`;
  const opened = await signIn(page, 1440);
  if (opened) return preparationFailedWeb(expected, opened);
  await delayGet(page, '/api/test-cases', ms);
  const navigated = await runSteps([['abrir /verification', () => page.goto(VERIFICATION_PATH, { timeout: CEILING_MS })]]);
  if (navigated) return preparationFailedWeb(expected, navigated);
  // La primera foto con algo en pantalla es la observación (filas de carga, filas o aviso, leídos en una sola evaluación)
  const seen: { snapshot?: ListSnapshot } = {};
  await waitUntil(async () => {
    const snapshot = await snapshotOf(page);
    if (snapshot === undefined || (snapshot.skeleton === 0 && snapshot.rows === 0 && snapshot.errors === 0)) return false;
    seen.snapshot = snapshot;
    return true;
  }, WAIT_MS);
  const during = seen.snapshot;
  const arrived = await waitForList(page, codesBetween('TC-001', 'TC-010'), undefined, WAIT_MS);
  return concluded([
    check(during !== undefined && during.skeleton > 0 && during.rows === 0, 'filas de carga y ningún caso mientras espera', during === undefined ? 'no se vio nada mientras espera (sin leer)' : `${during.skeleton} filas de carga y ${during.rows} casos`),
    check(describeCodes(arrived.codes) === describeCodes(codesBetween('TC-001', 'TC-010')), '10 casos, empezando por TC-001', describeCodes(arrived.codes)),
  ]);
};

// --- Esquema 5: si la lista no llega, el aviso dice qué ha pasado y ofrece volver a pedirla ------------------------------

const errorNotice: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const mode = strict('fallo', FAILURES, cell(row, 'fallo'));
  const trace = strict('detalle', TRACES, cell(row, 'detalle'));
  const expected = `el aviso «No se pudieron cargar los casos de prueba», con ${cell(row, 'detalle')}, el botón «Reintentar» y ningún caso`;
  const opened = await signIn(page, 1440);
  if (opened) return preparationFailedWeb(expected, opened);
  await failGet(page, '/api/test-cases', mode, 'always');
  const navigated = await runSteps([['abrir /verification', () => page.goto(VERIFICATION_PATH, { timeout: CEILING_MS })]]);
  if (navigated) return preparationFailedWeb(expected, navigated);
  await waitUntil(() => isVisible(errorOf(page)), WAIT_MS);
  const shown = await errorLeaves(page);
  const snapshot = await snapshotOf(page);
  const fragments = shown.fragments ?? [];
  const traceOk = trace === 'trace' ? fragments.some((fragment) => fragment.startsWith('GET /api/test-cases → 500')) : fragments.includes('No se pudo contactar con el servidor');
  return concluded(
    [
      check(shown.title === 'No se pudieron cargar los casos de prueba', 'el aviso «No se pudieron cargar los casos de prueba»', `el aviso «${shown.title ?? '(sin leer)'}»`),
      check(traceOk, trace === 'trace' ? 'la traza de la petición fallida (GET /api/test-cases → 500…)' : 'el texto «No se pudo contactar con el servidor»', `con ${fragments.length === 0 ? '(sin traza)' : fragments.join(' · ')}`),
      check(shown.retry === 'Reintentar', 'el botón «Reintentar»', `el botón «${shown.retry ?? '(sin leer)'}»`),
      check(snapshot !== undefined && snapshot.rows === 0, 'ningún caso', snapshot === undefined ? '(sin leer)' : `${snapshot.rows} casos`),
    ],
    trace === 'text' && !traceOk ? { note: 'Sin respuesta del servidor, el aviso muestra la traza de la petición («GET /api/test-cases → network error») y no el texto «No se pudo contactar con el servidor»: la lista usa la traza para cualquier ApiError.' } : {},
  );
};

// --- Esquema 6: «Reintentar» vuelve a pedir la lista y la muestra cuando llega --------------------------------------------

const retryRecovers: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const first = strict('primero', FIRST_AFTER_RETRY, cell(row, 'primero'));
  const expected = `tras «Reintentar», 10 casos empezando por ${first}`;
  const opened = await signIn(page, 1440);
  if (opened) return preparationFailedWeb(expected, opened);
  // Solo la primera petición GET de la lista falla («la primera petición»); las demás pasan. El recuento va a la evidencia.
  const tally: FailTally = { failed: 0, passed: 0 };
  await failFirstGet(page, '/api/test-cases', 'status500', tally);
  const navigated = await runSteps([['abrir /verification', () => page.goto(VERIFICATION_PATH, { timeout: CEILING_MS })]]);
  if (navigated) return preparationFailedWeb(expected, navigated);
  const alerted = await waitUntil(() => isVisible(errorOf(page)), WAIT_MS);
  if (!alerted.reached) return preparationFailedWeb(expected, `la primera petición no mostró el aviso de error (peticiones falladas ${tally.failed}, dejadas pasar ${tally.passed})`);
  const clicked = await runSteps([['pulsar «Reintentar»', () => retryOf(page).click(ACTION)]]);
  if (clicked) return preparationFailedWeb(expected, clicked);
  const back = await waitForList(page, codesBetween(first, 'TC-010'), undefined, WAIT_MS);
  const alertLeft = await safe(() => errorOf(page).count(), -1);
  return concluded(
    [
      check(describeCodes(back.codes) === describeCodes(codesBetween(first, 'TC-010')), `10 casos empezando por ${first}`, describeCodes(back.codes)),
      check(alertLeft === 0, 'el aviso de error desaparece', alertLeft === 0 ? 'el aviso de error ya no está' : `el aviso de error sigue (${alertLeft})`),
    ],
    {
      evidence: { peticionesFalladas: tally.failed, peticionesDejadasPasar: tally.passed },
      note: 'Solo se falla la primera petición GET de la lista. Si con el doble efecto de React la pantalla hace otra petición antes de mostrar el aviso, la fila sale como preparación fallida y no como hallazgo.',
    },
  );
};

defineBrowserRows({
  story: 'US-VER-CASOS-004',
  surface: 'web',
  tenants: [TENANT_A],
  handlers: new Map<number, BrowserRowHandler>([
    [1, onWeb(presentation)],
    [2, onWeb(caseData)],
    [3, onWeb(summaryAndCount)],
    [4, onWeb(loadingRows)],
    [5, onWeb(errorNotice)],
    [6, onWeb(retryRecovers)],
  ]),
});
