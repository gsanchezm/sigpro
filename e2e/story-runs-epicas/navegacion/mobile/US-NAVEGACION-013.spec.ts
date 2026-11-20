import type { Locator, Page } from '@playwright/test';
import { MOVIL_TESTIDS, MOVIL_VERIFICATION_TESTIDS, NC_TESTIDS, REQUISITOS_TESTIDS } from '../../../../packages/shared/src/testids';
import { DEMO, TENANT_A, resetTenants } from '../../../story-runs/support/prepare';
import { isVisible, pathOf, runSteps, safe, textOf, valueOf, waitUntil } from '../../support/browser';
import { cell, check, conclude, preparationFailedWeb, strict, type Check } from '../../support/checks';
import { defineBrowserRows, type BrowserRowHandler } from '../../core/framework';
import { actionFailed, clickAction, prepareWeb, type Diagnosed } from '../web/common';
import { MOBILE, MORE, expo, moreRow, openFromMore, resultLink, resultOf, searchField, searchStatus, signInMobile, tapTab } from './common';

// US-NAVEGACION-013 — Abrir cada resultado de la búsqueda en su pantalla móvil. Preparación de cada fila: reinicio de alumno01,
// inicio de sesión de gestor@sigpro.test con «alumno01» en «Tenant de trabajo» y «Búsqueda global» abierta desde «Más».

/** Lo que muestra cada destino: su ruta y su marca (un elemento de la pantalla y el texto que debe contener). */
interface Destination {
  readonly route: string;
  readonly marker: (page: Page) => Locator;
  /** Línea exacta que la ficha debe mostrar (`undefined` = basta con el elemento de la pantalla). */
  readonly line?: string;
  /** Texto exacto del propio elemento marcado (`undefined` = no se compara). */
  readonly exact?: string;
  readonly describe: string;
}

const DESTINATIONS: ReadonlyMap<string, Destination> = new Map<string, Destination>([
  [
    'la ficha del programa PRG-001',
    { route: '/programs/PRG-001', marker: (page) => page.getByTestId(MOVIL_TESTIDS.PROGRAM_DETAIL_PAGE), line: 'Sistema de mando táctico Ártemis', describe: 'la ficha del programa PRG-001' },
  ],
  [
    'la pantalla de requisitos de PRG-001 con el detalle de REQ-001 abierto',
    { route: '/programs/PRG-001/requirements', marker: (page) => page.getByTestId(REQUISITOS_TESTIDS.REQUIREMENT_CODE), exact: 'REQ-001', describe: 'los requisitos de PRG-001 con el detalle de REQ-001' },
  ],
  [
    'la ficha del caso de prueba TC-001',
    { route: '/verification/TC-001', marker: (page) => page.getByTestId(MOVIL_VERIFICATION_TESTIDS.DETAIL_PAGE), line: 'Verificar disponibilidad (caso 001)', describe: 'la ficha del caso de prueba TC-001' },
  ],
  [
    'la ficha del documento DOC-001',
    { route: '/documents/DOC-001', marker: (page) => page.getByTestId(MOVIL_TESTIDS.DOCUMENT_DETAIL_PAGE), line: 'DOC-001', describe: 'la ficha del documento DOC-001' },
  ],
  [
    'el tablero de no conformidades con el detalle de NC-001 abierto',
    { route: '/nc', marker: (page) => page.getByTestId(NC_TESTIDS.NC_DETAIL_CODE), exact: 'NC-001', describe: 'el tablero de no conformidades con el detalle de NC-001' },
  ],
]);

/** Tipo de resultado (grupo) de cada código que toca la fila: el prefijo del código. */
const KIND_OF_CODE: ReadonlyMap<string, string> = new Map<string, string>([
  ['PRG', 'program'],
  ['REQ', 'requirement'],
  ['TC', 'testcase'],
  ['DOC', 'document'],
  ['NC', 'nc'],
]);

const kindOf = (code: string): string => strict('tipo del código', KIND_OF_CODE, code.split('-')[0] ?? '');

/** Abre la búsqueda desde «Más» con una sesión de gestor en la app móvil. */
const enterSearch = async (page: Page): Promise<string | undefined> => {
  await prepareWeb(page, MOBILE);
  await resetTenants([TENANT_A]);
  const signed = await signInMobile(page, DEMO.gestor);
  if (signed) return signed;
  const opened = await openFromMore(page, 'search', 'Búsqueda global');
  if (opened) return opened;
  const ready = await waitUntil(() => isVisible(searchField(page)));
  return ready.reached ? undefined : 'no se abre la pantalla «Búsqueda global»';
};

/** Escribe el texto del resultado y espera a que aparezca UNA sola vez por testid (la búsqueda de la pantalla). */
const typeAndWaitResult = async (page: Page, text: string, code: string): Promise<{ readonly diagnosis?: Diagnosed }> => {
  const typed = await runSteps([[`escribir ${text} en «Búsqueda global»`, () => searchField(page).fill(text)]]);
  if (typed) return { diagnosis: { message: typed, note: 'El campo no recibe el texto.' } };
  const item = resultOf(page, kindOf(code), code);
  const listed = await waitUntil(async () => (await item.count()) === 1 && (await isVisible(item)), 10_000);
  return listed.reached ? {} : { diagnosis: await missingResult(page, code) };
};

/**
 * Diagnóstico de un resultado que no aparece con una sola coincidencia. Cero nodos por testid Y por rol (con la búsqueda en
 * pantalla) es discrepancia; el modo estricto o un nodo presente que no se ve es fallo del localizador o del arnés.
 */
const missingResult = async (page: Page, code: string): Promise<Diagnosed> => {
  const byTestId = await safe(() => resultOf(page, kindOf(code), code).count(), -1);
  const byRole = await safe(() => resultLink(page, code).count(), -1);
  const status = (await searchStatus(page)) ?? '(sin aviso)';
  const value = (await valueOf(searchField(page))) ?? '(no legible)';
  const kind = byTestId >= 2 || byRole >= 2 ? 'strict' : byTestId === 0 && byRole === 0 ? 'absent' : 'timeout';
  return {
    message: `no aparece el resultado ${code} tras escribir el texto`,
    note: `nodos por testid ${String(byTestId)} y por rol ${String(byRole)}; campo «${value}»; aviso «${status}»`,
    kind,
    evidence: { porTestId: byTestId, porRol: byRole, aviso: status, campo: value },
  };
};

/** Lo que la fila comprueba en el destino: ruta, marca visible y texto (línea exacta o texto propio). */
const destinationChecks = async (page: Page, destination: Destination, expected: string): Promise<readonly Check[]> => {
  const arrived = await waitUntil(async () => pathOf(page) === destination.route);
  const shown = await waitUntil(() => isVisible(destination.marker(page)));
  const content = await textOf(destination.marker(page));
  const lines = (content ?? '').split('\n').map((line) => line.trim());
  const lineOk = destination.line === undefined || lines.includes(destination.line);
  const exactOk = destination.exact === undefined || (await textOf(destination.marker(page))) === destination.exact;
  return [
    check(arrived.reached, `llega a ${destination.route}`, arrived.reached ? `llega a ${destination.route}` : `llega a ${pathOf(page)}`),
    check(shown.reached, `ve ${destination.describe}`, shown.reached ? `ve ${destination.describe}` : `no ve ${destination.describe} (${expected})`),
    check(lineOk && exactOk, `muestra ${destination.line ?? destination.exact ?? 'su contenido'}`, lineOk && exactOk ? `muestra ${destination.line ?? destination.exact ?? 'su contenido'}` : `contenido: ${lines.filter((line) => line !== '').slice(0, 3).join(' / ') || '(vacío)'}`),
  ];
};

// --- Esquema 1: tocar un resultado abre su pantalla en la app móvil ---------------------------------------------------------

const opens: BrowserRowHandler = async (row, { page }) => {
  const text = cell(row, 'texto');
  const code = cell(row, 'codigo');
  const destination = strict('destino', DESTINATIONS, cell(row, 'destino'));
  const expected = `ve ${cell(row, 'destino')}`;
  const entered = await enterSearch(page);
  if (entered) return preparationFailedWeb(expected, entered);
  const typed = await typeAndWaitResult(page, text, code);
  if (typed.diagnosis) return actionFailed(expected, typed.diagnosis);
  const tapped = await clickAction(page, resultOf(page, kindOf(code), code), `tocar el resultado ${code}`);
  if (tapped) return actionFailed(expected, tapped);
  return conclude(await destinationChecks(page, destination, expected));
};

// --- Esquema 2: al volver a la búsqueda el campo está vacío -----------------------------------------------------------------

const comesBack: BrowserRowHandler = async (row, { page }) => {
  const text = cell(row, 'texto');
  const code = cell(row, 'codigo');
  const expected = `vuelve a «Más» y toca «Búsqueda global»: el campo está vacío y ve «Escribe al menos 2 caracteres»`;
  const entered = await enterSearch(page);
  if (entered) return preparationFailedWeb(expected, entered);
  const typed = await typeAndWaitResult(page, text, code);
  if (typed.diagnosis) return actionFailed(expected, typed.diagnosis);
  const tapped = await clickAction(page, resultOf(page, kindOf(code), code), `tocar el resultado ${code}`);
  if (tapped) return actionFailed(expected, tapped);
  await waitUntil(async () => pathOf(page) !== '/search');
  const back = await runSteps([tapTab(page, MORE)]);
  if (back) return actionFailed(expected, { message: back, note: 'La pestaña «Más» no se toca.' });
  const reopened = await clickAction(page, moreRow(page, 'search'), 'tocar «Búsqueda global» en Más');
  if (reopened) return actionFailed(expected, reopened);
  const arrived = await waitUntil(async () => pathOf(page) === '/search');
  const empty = await waitUntil(async () => (await valueOf(searchField(page))) === '');
  const hint = await waitUntil(async () => (await textOf(page.getByText('Escribe al menos 2 caracteres', { exact: true }))) === 'Escribe al menos 2 caracteres');
  return conclude([
    check(arrived.reached, 'llega a /search', arrived.reached ? 'llega a /search' : `llega a ${pathOf(page)}`),
    check(empty.reached, 'el campo «Búsqueda global» está vacío', empty.reached ? 'el campo «Búsqueda global» está vacío' : `el campo contiene «${(await valueOf(searchField(page))) ?? '(no legible)'}»`),
    check(hint.reached, 've el aviso «Escribe al menos 2 caracteres»', hint.reached ? 've el aviso «Escribe al menos 2 caracteres»' : 'no ve el aviso «Escribe al menos 2 caracteres»'),
  ]);
};

defineBrowserRows({
  story: 'US-NAVEGACION-013',
  surface: 'expo-web',
  tenants: [TENANT_A],
  handlers: new Map<number, BrowserRowHandler>([
    [1, expo(opens, 'Regla sin fila (no comprobada): cada resultado abre la pantalla móvil y no la de la web.')],
    [2, expo(comesBack, 'Regla sin fila (no comprobada): el aviso de mínimo de caracteres se muestra con el campo vacío; la cuenta exacta de la fila es gestor@sigpro.test.')],
  ]),
});
