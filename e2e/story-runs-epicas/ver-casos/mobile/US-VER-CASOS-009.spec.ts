import type { Locator, Page } from '@playwright/test';
import { cell, check, preparationFailedWeb, strict } from '../../support/checks';
import { ACTION, CEILING_MS, quoted, runSteps, safe, waitUntil } from '../../support/browser';
import { defineBrowserRows, type BrowserRowHandler } from '../../core/framework';
import { resetTenants, TENANT_A } from '../../../story-runs/support/prepare';
import { failFirstGet, failGet, oneText, type FailTally } from '../web/common';
import { VERIFICACION_DYNAMIC_TESTIDS, VERIFICACION_TESTIDS } from '../../../../packages/shared/src/testids';
import {
  addressOf,
  backOf,
  countText,
  detailErrorOf,
  detailNotFoundOf,
  detailOf,
  detailPageOf,
  detailRetryOf,
  expectedOf,
  linkOf,
  loadMoreOf,
  mobileSettled,
  onExpoWeb,
  openFromTab,
  DIRECT_APPROXIMATION,
  openDirect,
  optionOf,
  requirementsOf,
  runsOf,
  selectOf,
  signIn,
  stepsOf,
  VERIFICATION_PATH, concluded } from './common';

// US-VER-CASOS-009 — Abrir el detalle de un caso y volver a la lista (app móvil, Expo web a 390 px). Preparación de cada fila: reinicio
// de alumno01 con el token de su administrador; la app en /login sin sesión guardada; gestor@sigpro.test inicia sesión y llega a /programs.
// Un caso que no está en la primera página se alcanza con «Cargar más» desde la lista (no se abre su dirección directamente).

const STEPS = ['Preparar el entorno de pruebas', 'Ejecutar el escenario nominal', 'Registrar las mediciones'];
const EXPECTED = 'Los valores medidos cumplen el umbral definido en el requisito.';
const NOT_FOUND = 'No se encontró el caso de prueba';
const UNEXPECTED = 'Ha ocurrido un error inesperado';
const EXECUTED_BY = 'Ejecutado por: Lucía Fernández';
const DATE_TOKEN = /\d{2}\/\d{2}\/\d{4}/;
/** «Título» de las pantallas de error: el texto de la alerta; la cabecera queda como «Verificación» cuando no hay caso. */
const TITLE_NOTE = 'El título leído es el texto de la alerta: la cabecera de la pantalla queda como «Verificación» cuando el caso no se encuentra o falla.';
const DIRECT_AND_TITLE = `${DIRECT_APPROXIMATION} ${TITLE_NOTE}`;

/** Celda «codigo» del Esquema de detalle (dos casos: uno en la primera página y otro que requiere «Cargar más»). */
const DETAIL_CODE: ReadonlyMap<string, string> = new Map<string, string>([
  ['TC-001', 'TC-001'],
  ['TC-024', 'TC-024'],
]);

/** Celda «codigo» de los Esquemas de error y reintento: el caso que se abre por dirección. */
const ERROR_CODE: ReadonlyMap<string, string> = new Map<string, string>([['TC-001', 'TC-001']]);

/** Celda «codigo» de «no encontrado»: códigos que no existen en el tenant. */
const MISSING_CODE: ReadonlyMap<string, string> = new Map<string, string>([
  ['TC-000', 'TC-000'],
  ['TC-026', 'TC-026'],
]);

/** Celda «posicion» → fila del historial (0 = la más reciente). */
const POSITION: ReadonlyMap<string, number> = new Map<string, number>([
  ['primera', 0],
  ['segunda', 1],
]);

/** Celda «resultado» → etiqueta del badge de la ejecución. */
const RESULT_LABEL: ReadonlyMap<string, string> = new Map<string, string>([
  ['«Bloqueado»', 'Bloqueado'],
  ['«Superado»', 'Superado'],
]);

/** Celda «evidencias» → lo que la tarjeta muestra. */
const EVIDENCE: ReadonlyMap<string, 'none' | 'one'> = new Map<string, 'none' | 'one'>([
  ['«Sin evidencias»', 'none'],
  ['una evidencia', 'one'],
]);

/** Celda «requisito» → requisito que se toca (su ruta va en la celda «ruta»). */
const REQUIREMENT: ReadonlyMap<string, string> = new Map<string, string>([
  ['REQ-001', 'REQ-001'],
  ['REQ-008', 'REQ-008'],
]);

/** Celda «llegada» → cómo se llega al detalle: desde la lista con el filtro puesto, o con una dirección directa. */
const ARRIVAL: ReadonlyMap<string, 'list' | 'direct'> = new Map<string, 'list' | 'direct'>([
  ['ha puesto el filtro «Último resultado» en «Bloqueado» y ha tocado el caso TC-001 en la lista', 'list'],
  ['ha abierto /verification/TC-001 con una dirección directa, sin pasar por la lista', 'direct'],
]);

/** Celda «vuelta» → lo que debe verse al volver a la lista. */
const RETURN: ReadonlyMap<string, 'filtered' | 'plain'> = new Map<string, 'filtered' | 'plain'>([
  ['la lista de Verificación con ese filtro aplicado y el recuento «1–6 de 6»', 'filtered'],
  ['la lista de Verificación sin filtros y con el recuento «1–10 de 25», y no la pantalla de Programas', 'plain'],
]);

const prepared = async (page: Page, expected: string): Promise<ReturnType<typeof preparationFailedWeb> | undefined> => {
  await resetTenants([TENANT_A]);
  const opened = await signIn(page);
  return opened ? preparationFailedWeb(expected, opened) : undefined;
};

/** Abre el caso desde la lista de Verificación: pasa por «Cargar más» si el caso no está en la primera página. */
const openFromList = async (page: Page, code: string): Promise<string | undefined> => {
  const opened = await openFromTab(page);
  if (opened) return opened;
  const pages = Math.ceil(Number(code.slice(3)) / 10);
  for (let index = 1; index < pages; index += 1) {
    const before = await countText(page);
    const pressed = await runSteps([[`pulsar «Cargar más» (${index})`, () => loadMoreOf(page).click(ACTION)]]);
    if (pressed) return pressed;
    await waitUntil(async () => (await countText(page)) !== before, CEILING_MS);
  }
  const tapped = await runSteps([[`abrir el caso ${code}`, () => linkOf(page, code).click(ACTION)]]);
  if (tapped) return tapped;
  const shown = await waitUntil(() => detailOf(page).isVisible(), CEILING_MS);
  return shown.reached ? undefined : 'el detalle del caso no apareció';
};

/** Hojas de texto de un elemento (fragmentos visibles), o `undefined` si no se pudo leer. */
const leavesOf = (target: Locator): Promise<readonly string[] | undefined> =>
  safe(
    () =>
      target.evaluate(
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

// --- Esquema 1: el detalle muestra el título, los requisitos y los pasos del caso ----------------------------------------------

const detailData: BrowserRowHandler = async (row, { page }) => {
  const code = strict('codigo', DETAIL_CODE, cell(row, 'codigo'));
  const expected = `el título ${cell(row, 'titulo')}, el programa ${cell(row, 'programa')}, los requisitos ${cell(row, 'requisitos')} como enlaces, los pasos numerados y el resultado esperado`;
  const failed = await prepared(page, expected);
  if (failed) return failed;
  const opening = await openFromList(page, code);
  if (opening) return preparationFailedWeb(expected, opening);
  const title = await oneText(detailPageOf(page).getByRole('heading', { level: 1 }));
  const leaves = await leavesOf(detailOf(page));
  const links = await safe(
    () =>
      detailOf(page).evaluate(
        (element: Element) =>
          Array.from(element.querySelectorAll('[data-testid]'))
            .filter((node) => /^testcase-requirement-REQ-\d{3}$/.test(node.getAttribute('data-testid') ?? ''))
            .map((node) => ({ code: (node.getAttribute('data-testid') ?? '').slice('testcase-requirement-'.length), role: node.getAttribute('role') })),
        undefined,
        { timeout: 2000 },
      ),
    undefined,
  );
  const items = await safe(
    () =>
      stepsOf(page).evaluate(
        (root: Element) =>
          Array.from(root.querySelectorAll('[role="listitem"]')).map((item) =>
            Array.from(item.querySelectorAll('*'))
              .filter((node) => node.children.length === 0)
              .map((node) => (node.textContent ?? '').trim())
              .filter((text) => text !== ''),
          ),
        undefined,
        { timeout: 2000 },
      ),
    undefined,
  );
  const stepsOk = items !== undefined && items.length === 3 && items.every((item, index) => item.join('|') === [`${index + 1}.`, STEPS[index] ?? ''].join('|'));
  const linkCodes = links?.map((link) => link.code).join(', ');
  const linksOk = links !== undefined && linkCodes === cell(row, 'requisitos') && links.every((link) => link.role === 'link');
  const expectedText = await oneText(expectedOf(page));
  return concluded([
    check(title === cell(row, 'titulo'), `el título ${cell(row, 'titulo')}`, `el título ${title ?? '(sin leer)'}`),
    check(leaves?.includes(cell(row, 'programa')) === true, `el programa ${cell(row, 'programa')}`, `el programa ${leaves?.find((leaf) => /^PRG-\d{3}$/.test(leaf)) ?? '(sin leer)'}`),
    check(linksOk, `los requisitos ${cell(row, 'requisitos')} como enlaces`, `los requisitos ${linkCodes ?? '(sin leer)'}${links?.every((link) => link.role === 'link') ? ' como enlaces' : ' (sin enlace)'}`),
    check(stepsOk, `los pasos numerados 1., 2., 3.: «${STEPS.join('», «')}»`, `los pasos ${items === undefined ? '(sin leer)' : items.map((item) => item.join(' ')).join(' · ')}`),
    check(expectedText === EXPECTED, `el resultado esperado «${EXPECTED}»`, `el resultado esperado «${expectedText ?? '(sin leer)'}»`),
  ], Number(code.slice(3)) > 10 ? { note: `${code} no está en la primera página: se llega con «Cargar más» desde la lista; no se abre su dirección directamente.` } : {});
};

// --- Esquema 2: el historial muestra la fecha, el resultado, las notas y quién lo registró --------------------------------

interface RunCard {
  readonly leaves: readonly string[];
  readonly thumbs: number;
  readonly badge: string | null;
  readonly text: string;
}

/** Tarjetas del historial, en orden: hojas de texto (incluido el código visible), miniaturas de evidencia y badge del resultado. */
const runCards = (page: Page): Promise<readonly RunCard[] | undefined> =>
  safe(
    () =>
      runsOf(page).evaluate(
        (root: Element) =>
          Array.from(root.querySelectorAll('[role="listitem"]')).map((item) => ({
            // Texto visible de la tarjeta (innerText; si no existe, textContent): de ahí sale el código de la ejecución
            text: (item as HTMLElement).innerText || (item.textContent ?? ''),
            leaves: Array.from(item.querySelectorAll('*'))
              .filter((node) => node.children.length === 0)
              .map((node) => (node.textContent ?? '').trim())
              .filter((text) => text !== ''),
            thumbs: item.querySelectorAll('[data-testid^="evidence-thumb-"]').length,
            badge: item.querySelector('[data-testid^="run-result-badge-"]')?.textContent?.trim() ?? null,
          })),
        undefined,
        { timeout: 2000 },
      ),
    undefined,
  );

const runHistory: BrowserRowHandler = async (row, { page }) => {
  const position = strict('posicion', POSITION, cell(row, 'posicion'));
  const result = strict('resultado', RESULT_LABEL, cell(row, 'resultado'));
  const evidence = strict('evidencias', EVIDENCE, cell(row, 'evidencias'));
  const expected = `la ${cell(row, 'posicion')} ejecución es ${cell(row, 'ejecucion')}, con la fecha ${cell(row, 'fecha')}, el resultado ${cell(row, 'resultado')}, las notas ${cell(row, 'notas')}, ${cell(row, 'evidencias')} y «${EXECUTED_BY}»`;
  const failed = await prepared(page, expected);
  if (failed) return failed;
  const opening = await openFromList(page, 'TC-001');
  if (opening) return preparationFailedWeb(expected, opening);
  const card = (await runCards(page))?.[position];
  // Código visible de la ejecución: su texto dentro de la tarjeta (RunsHistory.tsx:38), no el aria-label
  const visibleId = /^\s*(RUN-\d{3})/.exec(card?.text ?? '')?.[1];
  const dateLeaf = card?.leaves.find((leaf) => DATE_TOKEN.test(leaf));
  const date = dateLeaf === undefined ? undefined : DATE_TOKEN.exec(dateLeaf)?.[0];
  const label = card?.badge ?? undefined;
  const notes = quoted(cell(row, 'notas'));
  const evidenceOk = evidence === 'none' ? card?.leaves.includes('Sin evidencias') === true && card.thumbs === 0 : card?.thumbs === 1;
  return concluded(
    [
      check(visibleId === cell(row, 'ejecucion'), `la ${cell(row, 'posicion')} ejecución ${cell(row, 'ejecucion')}`, `la ${cell(row, 'posicion')} ejecución ${visibleId ?? '(ninguna)'}`),
      check(date === cell(row, 'fecha'), `la fecha ${cell(row, 'fecha')}`, `la fecha ${date ?? '(sin leer)'}`),
      check(label === result, `el resultado ${result}`, `el resultado «${label ?? '(sin leer)'}»`),
      check(card?.leaves.includes(notes) === true, `las notas ${cell(row, 'notas')}`, `las notas ${card?.leaves.join(' · ') ?? '(sin leer)'}`),
      check(evidenceOk === true, cell(row, 'evidencias'), evidence === 'none' ? `sin evidencias: ${card?.leaves.includes('Sin evidencias') ? 'sí' : 'no'}, miniaturas ${card?.thumbs ?? '(sin leer)'}` : `${card?.thumbs ?? '(sin leer)'} miniatura(s)`),
      check(card?.leaves.includes(EXECUTED_BY) === true, `«${EXECUTED_BY}»`, `«${card?.leaves.find((leaf) => leaf.startsWith('Ejecutado por')) ?? '(sin leer)'}»`),
    ],
    { note: 'La hora de cada ejecución no se afirma: la historia la deja en «Decisiones pendientes» (hora local o UTC); solo se compara la fecha dd/mm/aaaa.', evidence: { horaDeLaFecha: dateLeaf ?? null } },
  );
};

// --- Esquema 3: tocar un requisito abre su programa con ese requisito seleccionado ----------------------------------------

const requirementTap: BrowserRowHandler = async (row, { page }) => {
  const requirement = strict('requisito', REQUIREMENT, cell(row, 'requisito'));
  const expected = `llega a ${cell(row, 'ruta')}`;
  const failed = await prepared(page, expected);
  if (failed) return failed;
  const opening = await openFromList(page, 'TC-001');
  if (opening) return preparationFailedWeb(expected, opening);
  const tapped = await runSteps([
    [`tocar el requisito ${requirement}`, () => requirementsOf(page).getByTestId(VERIFICACION_DYNAMIC_TESTIDS.TESTCASE_REQUIREMENT_LINK(requirement)).click(ACTION)],
  ]);
  if (tapped) return preparationFailedWeb(expected, tapped);
  await waitUntil(async () => addressOf(page.url()) === cell(row, 'ruta'), CEILING_MS);
  const reached = addressOf(page.url());
  return concluded([check(reached === cell(row, 'ruta'), `llega a ${cell(row, 'ruta')}`, `llega a ${reached}`)]);
};

// --- Esquema 4: «Volver a Verificación» devuelve a la lista según cómo se llegó al detalle -----------------------------

const backToList: BrowserRowHandler = async (row, { page }) => {
  const arrival = strict('llegada', ARRIVAL, cell(row, 'llegada'));
  const back = strict('vuelta', RETURN, cell(row, 'vuelta'));
  const expected = `tras «Volver a Verificación»: ${cell(row, 'vuelta')}`;
  const failed = await prepared(page, expected);
  if (failed) return failed;
  if (arrival === 'list') {
    const opened = await openFromTab(page);
    if (opened) return preparationFailedWeb(expected, opened);
    const chosen = await runSteps([
      ['abrir «Último resultado»', () => selectOf(page, VERIFICACION_TESTIDS.VERIFICATION_FILTER_RESULT).click(ACTION)],
      ['elegir «Bloqueado»', () => optionOf(page, VERIFICACION_TESTIDS.VERIFICATION_FILTER_RESULT, 'blocked').click(ACTION)],
    ]);
    if (chosen) return preparationFailedWeb(expected, chosen);
    await waitUntil(async () => (await countText(page)) === '1–6 de 6', CEILING_MS);
    const tapped = await runSteps([['abrir el caso TC-001', () => linkOf(page, 'TC-001').click(ACTION)]]);
    if (tapped) return preparationFailedWeb(expected, tapped);
  } else {
    const opened = await openDirect(page, `${VERIFICATION_PATH}/TC-001`);
    if (opened) return preparationFailedWeb(expected, opened);
  }
  const shown = await waitUntil(() => detailOf(page).isVisible(), CEILING_MS);
  if (!shown.reached) return preparationFailedWeb(expected, 'el detalle del caso no apareció');
  const clicked = await runSteps([['pulsar «Volver a Verificación»', () => backOf(page).click(ACTION)]]);
  if (clicked) return preparationFailedWeb(expected, clicked);
  await waitUntil(async () => new URL(page.url()).pathname === VERIFICATION_PATH, CEILING_MS);
  await mobileSettled(page);
  const address = addressOf(page.url());
  const count = await countText(page);
  const inPrograms = new URL(page.url()).pathname === '/programs';
  if (back === 'filtered') {
    return concluded([
      check(address.includes('result=blocked') && count === '1–6 de 6', 'la lista de Verificación con «Último resultado» en «Bloqueado» y el recuento «1–6 de 6»', `la dirección ${address} con el recuento «${count ?? '(sin leer)'}»`),
    ]);
  }
  return concluded([
    check(address === VERIFICATION_PATH && count === '1–10 de 25' && !inPrograms, 'la lista de Verificación sin filtros, con el recuento «1–10 de 25» y no Programas', `la dirección ${address}, el recuento «${count ?? '(sin leer)'}»${inPrograms ? ', en Programas' : ''}`),
  ], { note: DIRECT_APPROXIMATION });
};

// --- Esquema 5: un código que no existe en el tenant muestra que el caso no se encontró ---------------------------------

const notFound: BrowserRowHandler = async (row, { page }) => {
  const code = strict('codigo', MISSING_CODE, cell(row, 'codigo'));
  const expected = `el título «${NOT_FOUND}», el botón «Volver a Verificación» y ni pasos ni historial`;
  const failed = await prepared(page, expected);
  if (failed) return failed;
  const opened = await openDirect(page, `${VERIFICATION_PATH}/${code}`);
  if (opened) return preparationFailedWeb(expected, opened);
  const shown = await waitUntil(() => detailNotFoundOf(page).isVisible(), CEILING_MS);
  if (!shown.reached) return preparationFailedWeb(expected, 'la pantalla de caso no encontrado no apareció');
  const leaves = await leavesOf(detailNotFoundOf(page));
  const back = await safe(() => backOf(page).count(), -1);
  const steps = await safe(() => stepsOf(page).count(), -1);
  const history = await safe(() => runsOf(page).count(), -1);
  return concluded([
    check(leaves?.includes(NOT_FOUND) === true, `el título «${NOT_FOUND}»`, `fragmentos ${leaves?.join(' · ') ?? '(sin leer)'}`),
    check(back === 1, 'el botón «Volver a Verificación»', `botones de vuelta: ${back}`),
    check(steps === 0 && history === 0, 'ni pasos ni historial de ejecuciones', `pasos ${steps}, historial ${history}`),
  ], { note: DIRECT_AND_TITLE });
};

// --- Esquema 6: un fallo que no es de caso no encontrado muestra el aviso de error inesperado ---------------------------

const unexpectedFailure: BrowserRowHandler = async (row, { page }) => {
  const code = strict('codigo', ERROR_CODE, cell(row, 'codigo'));
  const expected = `el título «${UNEXPECTED}» y el botón «Reintentar»`;
  const failed = await prepared(page, expected);
  if (failed) return failed;
  await failGet(page, `/api/test-cases/${code}`, 'status500', 'always');
  const opened = await openDirect(page, `${VERIFICATION_PATH}/${code}`);
  if (opened) return preparationFailedWeb(expected, opened);
  const shown = await waitUntil(() => detailErrorOf(page).isVisible(), CEILING_MS);
  if (!shown.reached) return preparationFailedWeb(expected, 'la pantalla de error no apareció');
  const leaves = await leavesOf(detailErrorOf(page));
  const retry = await safe(() => detailRetryOf(page).count(), -1);
  return concluded([
    check(leaves?.includes(UNEXPECTED) === true, `el título «${UNEXPECTED}»`, `fragmentos ${leaves?.join(' · ') ?? '(sin leer)'}`),
    check(retry === 1, 'el botón «Reintentar»', `botones «Reintentar»: ${retry}`),
  ], { note: DIRECT_AND_TITLE });
};

// --- Esquema 7: «Reintentar» vuelve a pedir el caso y lo muestra cuando llega -----------------------------------------------

const retryCase: BrowserRowHandler = async (row, { page }) => {
  const code = strict('codigo', ERROR_CODE, cell(row, 'codigo'));
  const expected = `tras «Reintentar», el título ${cell(row, 'titulo')} y los pasos del caso`;
  const failed = await prepared(page, expected);
  if (failed) return failed;
  // Solo la primera petición del caso falla («la primera petición»); las siguientes pasan. El recuento va a la evidencia.
  const tally: FailTally = { failed: 0, passed: 0 };
  await failFirstGet(page, `/api/test-cases/${code}`, 'status500', tally);
  const opened = await openDirect(page, `${VERIFICATION_PATH}/${code}`);
  if (opened) return preparationFailedWeb(expected, opened);
  const shown = await waitUntil(() => detailErrorOf(page).isVisible(), CEILING_MS);
  if (!shown.reached) return preparationFailedWeb(expected, 'la primera petición no mostró el aviso de error');
  const tapped = await runSteps([['tocar «Reintentar»', () => detailRetryOf(page).click(ACTION)]]);
  if (tapped) return preparationFailedWeb(expected, tapped);
  const back = await waitUntil(() => detailOf(page).isVisible(), CEILING_MS);
  const title = await oneText(detailPageOf(page).getByRole('heading', { level: 1 }));
  // Los pasos se comparan por su texto y su número (no por cuántos elementos hay)
  const steps = await safe(() => stepsOf(page).evaluate((root: Element) => Array.from(root.querySelectorAll('[role="listitem"]')).map((item) => Array.from(item.querySelectorAll('*')).filter((node) => node.children.length === 0).map((node) => (node.textContent ?? '').trim()).filter((text) => text !== '')), undefined, { timeout: 2000 }), undefined);
  const errorLeft = await safe(() => detailErrorOf(page).count(), -1);
  return concluded([
    check(back.reached && title === cell(row, 'titulo'), `el título ${cell(row, 'titulo')}`, `el título ${title ?? '(sin leer)'}`),
    check(steps !== undefined && steps.length === 3 && steps.every((item, index) => item.join('|') === [`${index + 1}.`, STEPS[index] ?? ''].join('|')), 'los tres pasos numerados 1., 2., 3. con sus textos', `pasos ${steps === undefined ? '(sin leer)' : steps.map((item) => item.join(' ')).join(' · ')}`),
    check(errorLeft === 0, 'sin aviso de error', `avisos de error ${errorLeft}`),
  ], { note: `${DIRECT_AND_TITLE} Peticiones del caso: falladas ${tally.failed}, dejadas pasar ${tally.passed}.` });
};

defineBrowserRows({
  story: 'US-VER-CASOS-009',
  surface: 'expo-web',
  tenants: [TENANT_A],
  handlers: new Map<number, BrowserRowHandler>([
    [1, onExpoWeb(detailData)],
    [2, onExpoWeb(runHistory)],
    [3, onExpoWeb(requirementTap)],
    [4, onExpoWeb(backToList)],
    [5, onExpoWeb(notFound)],
    [6, onExpoWeb(unexpectedFailure)],
    [7, onExpoWeb(retryCase)],
  ]),
});
