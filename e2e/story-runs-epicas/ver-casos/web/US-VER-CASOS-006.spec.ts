import type { Page } from '@playwright/test';
import { cell, check, preparationFailedWeb, strict, type Check } from '../../support/checks';
import { ACTION, CEILING_MS, isVisible, quoted, runSteps, safe, waitUntil } from '../../support/browser';
import { defineBrowserRows, type BrowserRowHandler } from '../../core/framework';
import { adminToken, call } from '../../../story-runs/support/api';
import { resetTenants, TENANT_A } from '../../../story-runs/support/prepare';
import { VERIFICACION_DYNAMIC_TESTIDS, VERIFICACION_TESTIDS } from '../../../../packages/shared/src/testids';
import {
  backOf,
  detailOf,
  failGet,
  notFoundOf,
  oneText,
  onWeb,
  openCaseFromList,
  signIn,
  VERIFICATION_PATH,
  type FailureMode, concluded } from './common';

// US-VER-CASOS-006 — Abrir el detalle de un caso: pasos, requisitos, historial y volver (web). Preparación de cada fila: reinicio de
// alumno01 con el token de su administrador; gestor@sigpro.test entra desde /login?tenant=alumno01 y llega a /programs. El caso se
// abre desde la lista (con «Página siguiente» cuando no está en la primera página) o con su dirección cuando la historia lo dice.

const STEPS = ['Preparar el entorno de pruebas', 'Ejecutar el escenario nominal', 'Registrar las mediciones'];
const EXPECTED = 'Los valores medidos cumplen el umbral definido en el requisito.';
const NOT_FOUND = 'No se encontró el caso de prueba';
const UNEXPECTED = 'Ha ocurrido un error inesperado';
const EXECUTED_BY = 'Lucía Fernández';

/** Celda «posicion» → fila del historial (0 = la más reciente). */
const POSITION: ReadonlyMap<string, number> = new Map<string, number>([
  ['primera', 0],
  ['segunda', 1],
]);

/** Celda «resultado» → etiqueta del badge. */
const RESULT_LABEL: ReadonlyMap<string, string> = new Map<string, string>([
  ['«Bloqueado»', 'Bloqueado'],
  ['«Superado»', 'Superado'],
]);

/** Celda «evidencias» → lo que la fila muestra. */
const EVIDENCE: ReadonlyMap<string, 'none' | 'one'> = new Map<string, 'none' | 'one'>([
  ['«Sin evidencias»', 'none'],
  ['una evidencia', 'one'],
]);

/** Celda «fallo» → cómo falla la petición del detalle. */
const FAILURES: ReadonlyMap<string, FailureMode> = new Map<string, FailureMode>([
  ['responde con error 500', 'status500'],
  ['no obtiene respuesta del servidor', 'noResponse'],
]);

/** Fecha dd/mm/aaaa dentro de la celda de fecha y hora de una ejecución (la hora no se afirma: decisión pendiente en la historia). */
/** Celda «codigo» del Esquema de caso sin requisitos: el único caso que queda sin enlace en la preparación. */
const UNLINKED_CASE: ReadonlyMap<string, string> = new Map<string, string>([['TC-007', 'TC-007']]);

const DATE_TOKEN = /\d{2}\/\d{2}\/\d{4}/;

/** Ruta y query de la página actual. */
const currentAddress = (url: string): string => {
  try {
    const parsed = new URL(url);
    return `${parsed.pathname}${parsed.search}`;
  } catch {
    return url;
  }
};

/** Preparación común: reinicio de alumno01 y inicio de sesión de gestor (1440 px). Devuelve el fallo o `undefined`. */
const prepared = async (page: Page, expected: string): Promise<ReturnType<typeof preparationFailedWeb> | undefined> => {
  await resetTenants([TENANT_A]);
  const opened = await signIn(page, 1440);
  return opened ? preparationFailedWeb(expected, opened) : undefined;
};

/** Textos hoja del detalle (fragmentos visibles), o `undefined` si no se pudo leer. */
const detailLeaves = (page: Page): Promise<readonly string[] | undefined> =>
  safe(
    () =>
      detailOf(page).evaluate(
        (element: Element) =>
          Array.from(element.querySelectorAll('*'))
            .filter((node) => node.children.length === 0)
            .map((node) => (node.textContent ?? '').trim())
            .filter((text) => text !== ''),
        undefined,
        { timeout: 2000 },
      ),
    undefined,
  );

/** Enlaces de requisito del detalle, en orden (código y etiqueta de elemento). */
const requirementLinks = (page: Page): Promise<readonly { readonly code: string; readonly tag: string }[] | undefined> =>
  safe(
    () =>
      detailOf(page).evaluate(
        (element: Element) =>
          Array.from(element.querySelectorAll('[data-testid]'))
            .filter((node) => /^testcase-requirement-REQ-\d{3}$/.test(node.getAttribute('data-testid') ?? ''))
            .map((node) => ({ code: (node.getAttribute('data-testid') ?? '').slice('testcase-requirement-'.length), tag: node.tagName.toLowerCase() })),
        undefined,
        { timeout: 2000 },
      ),
    undefined,
  );

// --- Esquema 1: el detalle muestra el título, el programa, los requisitos y los pasos del caso ---------------------------

const detailData: BrowserRowHandler = async (row, { page }) => {
  const expected = `el título ${cell(row, 'titulo')}, el programa ${cell(row, 'programa')}, los requisitos ${cell(row, 'requisitos')} como enlaces, los pasos y el resultado esperado`;
  const failed = await prepared(page, expected);
  if (failed) return failed;
  const code = cell(row, 'codigo');
  const opening = await openCaseFromList(page, code);
  if (opening) return preparationFailedWeb(expected, opening);
  const title = await oneText(detailOf(page).locator('h1'));
  const leaves = await detailLeaves(page);
  const links = await requirementLinks(page);
  const steps = await safe(() => detailOf(page).getByTestId(VERIFICACION_TESTIDS.TESTCASE_STEPS).locator('li').allTextContents(), undefined);
  const expectedText = await oneText(detailOf(page).getByTestId(VERIFICACION_TESTIDS.TESTCASE_EXPECTED));
  const linkCodes = links?.map((link) => link.code).join(', ');
  const note = Number(code.slice(3)) > 10 ? `${code} no está en la primera página: se llega con «Página siguiente» desde la lista; no se abre su dirección directamente.` : undefined;
  return concluded(
    [
      check(title === cell(row, 'titulo'), `el título ${cell(row, 'titulo')}`, `el título ${title ?? '(sin leer)'}`),
      check(leaves?.includes(cell(row, 'programa')) === true, `el programa ${cell(row, 'programa')}`, `el programa ${leaves?.find((leaf) => /^PRG-\d{3}$/.test(leaf)) ?? '(sin leer)'}`),
      check(linkCodes === cell(row, 'requisitos') && (links ?? []).every((link) => link.tag === 'a'), `los requisitos ${cell(row, 'requisitos')} como enlaces`, `los requisitos ${linkCodes ?? '(sin leer)'} ${(links ?? []).every((link) => link.tag === 'a') ? 'como enlaces' : 'sin enlace'}`),
      check(steps !== undefined && steps.length === 3 && steps.every((step, index) => step === STEPS[index]), `los pasos «${STEPS.join('», «')}» en ese orden`, `los pasos ${steps?.join(' · ') ?? '(sin leer)'}`),
      check(expectedText === EXPECTED, `el resultado esperado «${EXPECTED}»`, `el resultado esperado «${expectedText ?? '(sin leer)'}»`),
    ],
    note === undefined ? {} : { note },
  );
};

// --- Esquema 2: el requisito enlazado abre su programa con ese requisito seleccionado ------------------------------------

const requirementLink: BrowserRowHandler = async (row, { page }) => {
  const expected = `llega a ${cell(row, 'ruta')}`;
  const failed = await prepared(page, expected);
  if (failed) return failed;
  const opening = await openCaseFromList(page, cell(row, 'codigo'));
  if (opening) return preparationFailedWeb(expected, opening);
  const clicked = await runSteps([[`pulsar el requisito ${cell(row, 'requisito')}`, () => detailOf(page).getByTestId(VERIFICACION_TESTIDS.TESTCASE_REQUIREMENTS).getByTestId(VERIFICACION_DYNAMIC_TESTIDS.TESTCASE_REQUIREMENT_LINK(cell(row, 'requisito'))).click(ACTION)]]);
  if (clicked) return preparationFailedWeb(expected, clicked);
  await waitUntil(async () => currentAddress(page.url()) === cell(row, 'ruta'), CEILING_MS);
  const reached = currentAddress(page.url());
  return concluded([check(reached === cell(row, 'ruta'), `la ruta ${cell(row, 'ruta')}`, `la ruta ${reached}`)]);
};

// --- Esquema 3: cada ejecución del historial muestra su fecha, su resultado, sus notas y quién la registró -------------

const runRow = (page: Page, index: number): Promise<{ readonly id: string | null; readonly cells: readonly string[]; readonly thumbs: number } | undefined> =>
  safe(
    () =>
      detailOf(page)
        .getByTestId(VERIFICACION_TESTIDS.TESTCASE_RUNS)
        .locator('tbody tr')
        .nth(index)
        .evaluate(
          (row: Element) => ({
            id: row.getAttribute('data-testid')?.replace(/^run-row-/, '') ?? null,
            cells: Array.from(row.querySelectorAll('td')).map((cellNode) => (cellNode.textContent ?? '').trim()),
            thumbs: row.querySelectorAll('td')[3]?.querySelectorAll('[data-testid^="evidence-thumb-"]').length ?? 0,
          }),
          undefined,
          { timeout: 2000 },
        ),
    undefined,
  );

const runHistory: BrowserRowHandler = async (row, { page }) => {
  const position = strict('posicion', POSITION, cell(row, 'posicion'));
  const result = strict('resultado', RESULT_LABEL, cell(row, 'resultado'));
  const evidence = strict('evidencias', EVIDENCE, cell(row, 'evidencias'));
  const expected = `la ${cell(row, 'posicion')} fila es ${cell(row, 'ejecucion')}, con la fecha ${cell(row, 'fecha')}, el resultado ${cell(row, 'resultado')}, las notas ${cell(row, 'notas')} y ${cell(row, 'evidencias')}; la registró ${EXECUTED_BY}`;
  const failed = await prepared(page, expected);
  if (failed) return failed;
  const opening = await openCaseFromList(page, 'TC-001');
  if (opening) return preparationFailedWeb(expected, opening);
  const read = await runRow(page, position);
  const cells = read?.cells ?? [];
  const date = DATE_TOKEN.exec(cells[0] ?? '')?.[0];
  const evidenceOk = evidence === 'none' ? cells[3] === 'Sin evidencias' : read?.thumbs === 1;
  return concluded(
    [
      check(read?.id === cell(row, 'ejecucion'), `la ${cell(row, 'posicion')} fila ${cell(row, 'ejecucion')}`, `la ${cell(row, 'posicion')} fila ${read?.id ?? '(ninguna)'}`),
      check(date === cell(row, 'fecha'), `la fecha ${cell(row, 'fecha')}`, `la fecha ${date ?? '(sin leer)'}`),
      check(cells[1] === result, `el resultado ${result}`, `el resultado «${cells[1] ?? '(sin leer)'}»`),
      check(cells[2] === quoted(cell(row, 'notas')), `las notas ${cell(row, 'notas')}`, `las notas «${cells[2] ?? '(sin leer)'}»`),
      check(evidenceOk, `${cell(row, 'evidencias')}`, evidence === 'none' ? `evidencias «${cells[3] ?? '(sin leer)'}»` : `${read?.thumbs ?? '(sin leer)'} miniatura(s)`),
      check(cells[4] === EXECUTED_BY, `la ejecución la registró ${EXECUTED_BY}`, `la registró «${cells[4] ?? '(sin leer)'}»`),
    ],
    { note: 'La hora de cada ejecución no se afirma: la historia la deja en «Decisiones pendientes» (hora local o UTC); solo se compara la fecha dd/mm/aaaa.', evidence: { celdaFechaYHora: cells[0] ?? null, resultadoEsperado: result } },
  );
};

// --- Esquema 4: un código que no existe en el tenant muestra que el caso no se encontró -----------------------------------

const notFound: BrowserRowHandler = async (row, { page }) => {
  const expected = `el título «${NOT_FOUND}», el enlace «Volver a Verificación» y ni pasos ni historial`;
  const failed = await prepared(page, expected);
  if (failed) return failed;
  await runSteps([['abrir la dirección del caso', () => page.goto(`${VERIFICATION_PATH}/${cell(row, 'codigo')}`, { timeout: CEILING_MS })]]);
  const shown = await waitUntil(() => isVisible(notFoundOf(page)), CEILING_MS);
  if (!shown.reached) return preparationFailedWeb(expected, 'la pantalla de caso no encontrado no apareció');
  const title = await oneText(notFoundOf(page).locator('h1'));
  const back = await safe(() => backOf(page).count(), -1);
  const steps = await safe(() => page.getByTestId(VERIFICACION_TESTIDS.TESTCASE_STEPS).count(), -1);
  const runs = await safe(() => page.getByTestId(VERIFICACION_TESTIDS.TESTCASE_RUNS).count(), -1);
  return concluded([
    check(title === NOT_FOUND, `el título «${NOT_FOUND}»`, `el título «${title ?? '(sin leer)'}»`),
    check(back === 1, 'el enlace «Volver a Verificación»', `enlaces de vuelta: ${back}`),
    check(steps === 0 && runs === 0, 'ni pasos ni historial de ejecuciones', `pasos ${steps}, historial ${runs}`),
  ]);
};

// --- Esquema 5: un fallo que no es de caso no encontrado muestra el aviso de error inesperado ---------------------------

const unexpectedFailure: BrowserRowHandler = async (row, { page }) => {
  const mode = strict('fallo', FAILURES, cell(row, 'fallo'));
  const expected = `el título «${UNEXPECTED}»`;
  const failed = await prepared(page, expected);
  if (failed) return failed;
  await failGet(page, '/api/test-cases/TC-001', mode, 'always');
  await runSteps([['abrir /verification/TC-001', () => page.goto(`${VERIFICATION_PATH}/TC-001`, { timeout: CEILING_MS })]]);
  const shown = await waitUntil(() => isVisible(notFoundOf(page)), CEILING_MS);
  if (!shown.reached) return preparationFailedWeb(expected, 'la pantalla de error no apareció');
  const title = await oneText(notFoundOf(page).locator('h1'));
  return concluded([check(title === UNEXPECTED, `el título «${UNEXPECTED}»`, `el título «${title ?? '(sin leer)'}»`)]);
};

// --- Esquema 6: «Volver a Verificación» lleva a la lista de casos -------------------------------------------------------

const backToList: BrowserRowHandler = async (row, { page }) => {
  const code = cell(row, 'codigo');
  const expected = `tras «Volver a Verificación», la dirección ${VERIFICATION_PATH}`;
  const failed = await prepared(page, expected);
  if (failed) return failed;
  if (code === 'TC-001') {
    const opening = await openCaseFromList(page, code);
    if (opening) return preparationFailedWeb(expected, opening);
  } else {
    await runSteps([['abrir /verification/TC-026', () => page.goto(`${VERIFICATION_PATH}/${code}`, { timeout: CEILING_MS })]]);
    const shown = await waitUntil(() => isVisible(backOf(page)), CEILING_MS);
    if (!shown.reached) return preparationFailedWeb(expected, 'la pantalla de caso no encontrado no apareció');
  }
  const clicked = await runSteps([['pulsar «Volver a Verificación»', () => backOf(page).click(ACTION)]]);
  if (clicked) return preparationFailedWeb(expected, clicked);
  await waitUntil(async () => new URL(page.url()).pathname === VERIFICATION_PATH, CEILING_MS);
  const reached = new URL(page.url()).pathname;
  return concluded([check(reached === VERIFICATION_PATH, `llega a ${VERIFICATION_PATH}`, `llega a ${reached}`)]);
};

// --- Esquema 7: un caso sin requisitos enlazados lo dice en el lugar de los requisitos ----------------------------------

const noRequirements: BrowserRowHandler = async (row, { page }) => {
  const code = strict('codigo', UNLINKED_CASE, cell(row, 'codigo'));
  const expected = 'el texto «Sin requisitos enlazados» en el lugar de los requisitos';
  await resetTenants([TENANT_A]);
  const token = await adminToken(TENANT_A);
  const removed = await call('DELETE', '/requirements/REQ-007/tests/TC-007', { tenant: TENANT_A, token });
  if (removed.status !== 204) return preparationFailedWeb(expected, `quitar el enlace REQ-007 ↔ TC-007 respondió ${removed.status}`);
  const opened = await signIn(page, 1440);
  if (opened) return preparationFailedWeb(expected, opened);
  const opening = await openCaseFromList(page, code);
  if (opening) return preparationFailedWeb(expected, opening);
  const leaves = await detailLeaves(page);
  const links = await safe(() => detailOf(page).getByTestId(VERIFICACION_TESTIDS.TESTCASE_REQUIREMENTS).count(), -1);
  const checks: Check[] = [
    check(leaves?.includes('Sin requisitos enlazados') === true, 'el texto «Sin requisitos enlazados»', `fragmentos ${leaves === undefined ? '(sin leer)' : leaves.filter((leaf) => /requisitos/i.test(leaf)).join(' · ') || '(ninguno con «requisitos»)'}`),
    check(links === 0, 'ninguna lista de requisitos', `listas de requisitos: ${links}`),
  ];
  return concluded(checks, { note: `Preparación: el enlace REQ-007 ↔ ${code} se quitó en alumno01 con DELETE (solo prepara el estado).` });
};

defineBrowserRows({
  story: 'US-VER-CASOS-006',
  surface: 'web',
  tenants: [TENANT_A],
  handlers: new Map<number, BrowserRowHandler>([
    [1, onWeb(detailData)],
    [2, onWeb(requirementLink)],
    [3, onWeb(runHistory)],
    [4, onWeb(notFound)],
    [5, onWeb(unexpectedFailure)],
    [6, onWeb(backToList)],
    [7, onWeb(noRequirements)],
  ]),
});
