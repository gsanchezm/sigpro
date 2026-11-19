import type { Page } from '@playwright/test';
import { defineBrowserRows, type BrowserRowHandler, type Outcome } from '../../core/framework';
import { ACTION, quoted, safe, waitUntil } from '../../support/browser';
import { cell, check, preparationFailedWeb, strict, sleep, type Check } from '../../support/checks';
import { field } from '../../../story-runs/support/api';
import { ACCOUNT_OF, TENANT_A, act, loginAs, resetTenants, verdict } from '../api/common';
import { REQUISITOS_TESTIDS } from '../../../../packages/shared/src/testids';
import { ACCOUNT_BY_EMAIL, actionFailed, detailPanel, inOrder, interact, menuItem, newButton, newDialog, noOkToast, onWeb, openRequirements, rowMenuOf, signIn, stateCheck, toastShown, type AccountName, type WebAction } from './common';

// US-REQ-EDICION-008 — Dar de alta un requisito desde «Nuevo requisito» (web, escritorio 1440 px). Preparación de cada fila: reinicio
// de alumno01, inicio de sesión de la cuenta de la fila en /login?tenant=alumno01 y apertura de /programs/PRG-001/requirements.

const TITLE_FIELD = (page: Page) => newDialog(page).getByRole('textbox', { name: 'Título', exact: true }).or(page.getByTestId(REQUISITOS_TESTIDS.REQUIREMENT_NEW_TITLE));
const TITLE_ERROR = (page: Page) => page.getByTestId(REQUISITOS_TESTIDS.REQUIREMENT_NEW_TITLE_ERROR);

/** Escribe el título en el diálogo. */
const typeTitle = (text: string): WebAction => (page) => interact(TITLE_FIELD(page), `escribir «${text}» en «Título»`, (element) => element.fill(text, ACTION));

/** Elige una opción de un desplegable del diálogo por su texto visible («Requisito padre» o «Prioridad»). */
const chooseIn = (label: string, option: string): WebAction => (page) =>
  interact(newDialog(page).getByRole('combobox', { name: label, exact: true }), `elegir «${option}» en «${label}»`, (element) => element.selectOption({ label: option }, ACTION));

/** Pulsa un botón del diálogo («Crear requisito» o «Cancelar»). */
const dialogButton = (name: string): WebAction => (page) => interact(newDialog(page).getByRole('button', { name, exact: true }), `pulsar «${name}» en el diálogo`, (element) => element.click(ACTION));

/** Pulsa «Nuevo requisito» de la cabecera y espera a que aparezca el diálogo. */
const openDialog: WebAction = async (page) => {
  const clicked = await interact(newButton(page), 'pulsar «Nuevo requisito»', (element) => element.click(ACTION));
  if (clicked !== undefined) return clicked;
  return interact(newDialog(page), 'ver el diálogo «Nuevo requisito»', (element) => element.waitFor({ timeout: 10_000 }));
};

/** Título de la celda (vacío, espacios, texto corto o largo). */
const TITLE_OF: ReadonlyMap<string, string> = new Map<string, string>([
  ['(vacío)', ''],
  ['(tres espacios)', '   '],
  ['ab', 'ab'],
  ['(121 letras a)', 'a'.repeat(121)],
]);

/** Padre de la celda: la opción visible de «Requisito padre» y el `parentCode` que debe quedar guardado. */
const PARENT_OF: ReadonlyMap<string, { readonly option: string; readonly parentCode: string | null }> = new Map([
  ['«Ninguno (raíz)»', { option: 'Ninguno (raíz)', parentCode: null }],
  ['«REQ-001 · Disponibilidad del subsistema 001»', { option: 'REQ-001 · Disponibilidad del subsistema 001', parentCode: 'REQ-001' }],
]);

/** Prioridad de la celda: la opción visible y el valor que la API guarda. */
const PRIORITY_OF: ReadonlyMap<string, { readonly option: string; readonly value: string }> = new Map([
  ['«Alta»', { option: 'Alta', value: 'high' }],
  ['«Baja»', { option: 'Baja', value: 'low' }],
]);

/** Texto de la fila «ACCION» de la celda: cómo se abre el diálogo. */
const ACCION_OF: ReadonlyMap<string, 'key-n' | 'row-child'> = new Map([
  ['pulsa la tecla N con el foco fuera de los campos', 'key-n'],
  ['abre el menú de la fila de REQ-001 y elige «Añadir hijo»', 'row-child'],
]);

/** Estado esperado del botón «Nuevo requisito» (habilitado, o deshabilitado con su explicación). */
const BUTTON_STATE_OF: ReadonlyMap<string, { readonly enabled: boolean; readonly reason?: string }> = new Map([
  ['está habilitado', { enabled: true }],
  ['está deshabilitado y su explicación es «Tu rol no permite crear requisitos»', { enabled: false, reason: 'Tu rol no permite crear requisitos' }],
]);

/** Preparación común: reinicio, inicio de sesión y apertura del árbol. Devuelve el resultado de la preparación fallida, si lo hay. */
const prepare = async (page: Page, account: AccountName, expected: string): Promise<Outcome | undefined> => {
  await resetTenants([TENANT_A]);
  const failure = (await signIn(page, account)) ?? (await openRequirements(page));
  return failure === undefined ? undefined : preparationFailedWeb(expected, failure);
};

/** Cuenta el número de `POST /api/requirements` que la página envía desde que se llama. */
const countCreates = (page: Page): (() => number) => {
  let total = 0;
  page.on('request', (request) => {
    if (request.method() === 'POST' && new URL(request.url()).pathname.endsWith('/requirements')) total += 1;
  });
  return () => total;
};

/** Lectura del requisito REQ-041 por la API con la cuenta gestor (oráculo de persistencia). */
const storedRequirement = async (code: string) => {
  const session = await loginAs(strict('cuenta', ACCOUNT_OF, 'gestor@sigpro.test'));
  return session.token === undefined ? undefined : act('GET', `/requirements/${code}`, session.token);
};

// --- Esquema 1: un alta válida aparece en borrador y queda seleccionada -----------------------------------------------------

const createsValid: BrowserRowHandler = async (row, { page }) => {
  const expected = `aviso «Requisito creado» con «REQ-041 se añadió al árbol»; detalle de REQ-041 en «Borrador»; padre ${cell(row, 'padre')}; prioridad ${cell(row, 'prioridad')}`;
  const failure = await prepare(page, 'gestor', expected);
  if (failure !== undefined) return failure;
  const parent = strict('padre', PARENT_OF, cell(row, 'padre'));
  const priority = strict('prioridad', PRIORITY_OF, cell(row, 'prioridad'));
  const blocked = await inOrder(openDialog, typeTitle('Requisito de prueba'), chooseIn('Requisito padre', parent.option), chooseIn('Prioridad', priority.option), dialogButton('Crear requisito'))(page);
  if (blocked !== undefined) return actionFailed(expected, blocked);
  const toast = await toastShown(page, 'ok', 'Requisito creado', 'REQ-041 se añadió al árbol');
  const badge = await safe(() => page.getByTestId(REQUISITOS_TESTIDS.REQUIREMENT_STATE_BADGE).innerText({ timeout: 2_000 }), undefined);
  const detail = await safe(() => detailPanel(page).innerText({ timeout: 2_000 }), '');
  // Persistencia: el requisito creado se lee por la API (lo que la pantalla muestra no basta)
  const stored = await storedRequirement('REQ-041');
  const checks: Check[] = [
    check(toast.seen, '«Requisito creado» con «REQ-041 se añadió al árbol»', `aviso ${toast.observed}`),
    check(detail.includes('REQ-041') && badge?.trim() === 'Borrador', 'el detalle de REQ-041 abierto con el estado «Borrador»', `detalle ${detail.includes('REQ-041') ? 'de REQ-041' : '(sin REQ-041)'} con estado «${badge ?? '(sin leer)'}»`),
    check(stored?.status === 200 && field(stored.body, 'state') === 'draft', 'REQ-041 se guarda en borrador', `REQ-041 ${stored === undefined ? '(sin leer)' : `responde ${stored.status} con state ${String(field(stored.body, 'state'))}`}`),
    check(stored?.status === 200 && (field(stored.body, 'parentCode') ?? null) === parent.parentCode, `REQ-041 queda con padre ${parent.parentCode ?? 'null'}`, `REQ-041 queda con padre ${stored === undefined ? '(sin leer)' : String(field(stored.body, 'parentCode') ?? null)}`),
    check(stored?.status === 200 && field(stored.body, 'priority') === priority.value, `REQ-041 con prioridad ${priority.value}`, `REQ-041 con prioridad ${stored === undefined ? '(sin leer)' : String(field(stored.body, 'priority'))}`),
  ];
  return verdict(checks);
};

// --- Esquema 2: un título no válido se rechaza en el diálogo sin enviar nada --------------------------------------------------

const rejectsTitle: BrowserRowHandler = async (row, { page }) => {
  const notice = quoted(cell(row, 'aviso'));
  const expected = `bajo «Título» el aviso «${notice}»; el diálogo sigue abierto; no aparece «Requisito creado»; no se envía ninguna alta`;
  const failure = await prepare(page, 'gestor', expected);
  if (failure !== undefined) return failure;
  const title = strict('título', TITLE_OF, cell(row, 'titulo'));
  const creates = countCreates(page);
  const blocked = await inOrder(openDialog, typeTitle(title), dialogButton('Crear requisito'))(page);
  if (blocked !== undefined) return actionFailed(expected, blocked);
  const endedAt = Date.now();
  const shown = await waitUntil(async () => (await safe(() => TITLE_ERROR(page).innerText({ timeout: 500 }), '')).trim() === notice);
  const observedNotice = (await safe(() => TITLE_ERROR(page).innerText({ timeout: 500 }), '')).trim();
  const dialogOpen = await safe(() => newDialog(page).isVisible(), false);
  const quiet = await noOkToast(page, endedAt);
  const checks: Check[] = [
    check(shown.reached, `bajo «Título» el aviso «${notice}»`, `bajo «Título» ${observedNotice === '' ? '(ningún aviso)' : `«${observedNotice}»`}`),
    check(dialogOpen, 'el diálogo sigue abierto', dialogOpen ? 'el diálogo sigue abierto' : 'el diálogo se cerró'),
    check(quiet.held, 'no aparece «Requisito creado»', quiet.held ? 'no aparece «Requisito creado»' : `aparece ${quiet.seen}`),
    check(creates() === 0, 'no se envía ninguna alta', `se envían ${creates()} altas`),
  ];
  return verdict(checks);
};

// --- Esquema 3: el aviso del título desaparece al corregirlo ----------------------------------------------------------------

const TITLE_FIX_OF: ReadonlyMap<string, string> = new Map([
  ['abc', 'abc'],
  ['(vacío)', ''],
]);

const clearsNotice: BrowserRowHandler = async (row, { page }) => {
  const notice = 'El título debe tener al menos 3 caracteres';
  const corrected = strict('título corregido', TITLE_FIX_OF, cell(row, 'titulo_corregido'));
  const expected = `tras cambiar «Título» a «${corrected}» deja de verse el aviso «${notice}»`;
  const failure = await prepare(page, 'gestor', expected);
  if (failure !== undefined) return failure;
  const blocked = await inOrder(openDialog, typeTitle('ab'), dialogButton('Crear requisito'))(page);
  if (blocked !== undefined) return actionFailed(expected, blocked);
  const shown = await waitUntil(async () => (await safe(() => TITLE_ERROR(page).innerText({ timeout: 500 }), '')).trim() === notice);
  if (!shown.reached) return verdict([check(false, `preparación: el aviso «${notice}» aparece con «ab»`, 'el aviso no aparece con «ab»')], 'No se pudo reproducir el aviso inicial que da por hecha la fila.');
  const typed = await interact(TITLE_FIELD(page), `cambiar «Título» a «${corrected}»`, (element) => element.fill(corrected, ACTION));
  if (typed !== undefined) return actionFailed(expected, typed);
  const gone = await waitUntil(async () => (await safe(() => TITLE_ERROR(page).count(), 1)) === 0);
  const current = await safe(() => TITLE_FIELD(page).inputValue({ timeout: 500 }), undefined);
  return verdict([
    check(gone.reached, `deja de verse «${notice}»`, gone.reached ? `deja de verse «${notice}»` : `sigue viéndose «${notice}»`),
    check(current === corrected, `«Título» vale «${corrected}»`, `«Título» vale «${current ?? '(sin leer)'}»`),
  ]);
};

// --- Esquema 4: el padre que muestra el diálogo depende de cómo se abre ------------------------------------------------------

const parentDependsOnOpening: BrowserRowHandler = async (row, { page }) => {
  const expectedParent = quoted(cell(row, 'padre'));
  const expected = `el campo «Requisito padre» muestra «${expectedParent}»`;
  const failure = await prepare(page, 'gestor', expected);
  if (failure !== undefined) return failure;
  const how = strict('acción', ACCION_OF, cell(row, 'accion'));
  const opened: WebAction =
    how === 'key-n'
      ? async (current) => {
          await current.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
          await current.keyboard.press('n');
          return undefined;
        }
      : inOrder(
          (current) => interact(rowMenuOf(current, 'REQ-001'), 'abrir «Acciones para REQ-001»', (element) => element.click(ACTION)),
          (current) => interact(menuItem(current, 'REQ-001', 'Añadir hijo'), 'elegir «Añadir hijo»', (element) => element.click(ACTION)),
        );
  const blocked = await opened(page);
  if (blocked !== undefined) return actionFailed(expected, blocked);
  const waited = await interact(newDialog(page), 'ver el diálogo «Nuevo requisito»', (element) => element.waitFor({ timeout: 10_000 }));
  if (waited !== undefined) return actionFailed(expected, waited);
  const shown = await safe(() => newDialog(page).getByRole('combobox', { name: 'Requisito padre', exact: true }).evaluate((element) => (element as HTMLSelectElement).selectedOptions[0]?.textContent ?? '', undefined, { timeout: 2_000 }), undefined);
  return verdict([check(shown === expectedParent, `«Requisito padre» muestra «${expectedParent}»`, `«Requisito padre» muestra «${shown ?? '(sin leer)'}»`)]);
};

// --- Esquema 5: cancelar cierra el diálogo y no crea nada -------------------------------------------------------------------

const cancelCreatesNothing: BrowserRowHandler = async (row, { page }) => {
  const expected = 'el diálogo se cierra; no aparece «Requisito creado»; no se envía ninguna alta; REQ-041 no existe';
  const account = strict('cuenta', ACCOUNT_BY_EMAIL, cell(row, 'cuenta'));
  const failure = await prepare(page, account, expected);
  if (failure !== undefined) return failure;
  const creates = countCreates(page);
  const blocked = await inOrder(openDialog, typeTitle('Requisito de prueba'), dialogButton('Cancelar'))(page);
  if (blocked !== undefined) return actionFailed(expected, blocked);
  const endedAt = Date.now();
  const closed = await waitUntil(async () => !(await safe(() => newDialog(page).isVisible(), false)));
  const quiet = await noOkToast(page, endedAt);
  const stored = await storedRequirement('REQ-041');
  return verdict([
    check(closed.reached, 'el diálogo «Nuevo requisito» está cerrado', closed.reached ? 'el diálogo está cerrado' : 'el diálogo sigue abierto'),
    check(quiet.held, 'no aparece «Requisito creado»', quiet.held ? 'no aparece «Requisito creado»' : `aparece ${quiet.seen}`),
    check(creates() === 0, 'no se envía ninguna alta', `se envían ${creates()} altas`),
    check(stored?.status === 404, 'REQ-041 no existe', `REQ-041 responde ${stored === undefined ? '(sin leer)' : stored.status}`),
  ]);
};

// --- Esquema 6: solo los roles con permiso de alta pueden abrir el diálogo --------------------------------------------------

const onlyCreatorsOpen: BrowserRowHandler = async (row, { page }) => {
  const want = strict('estado', BUTTON_STATE_OF, cell(row, 'estado'));
  const expected = want.enabled ? '«Nuevo requisito» está habilitado' : `«Nuevo requisito» está deshabilitado con «${want.reason ?? ''}»`;
  const failure = await prepare(page, strict('cuenta', ACCOUNT_BY_EMAIL, cell(row, 'cuenta')), expected);
  if (failure !== undefined) return failure;
  const checks: Check[] = [await stateCheck(newButton(page), want.enabled ? 'habilitado' : 'deshabilitado', want.reason)];
  if (!want.enabled) {
    // La tecla N tampoco abre el diálogo a un rol sin permiso de alta
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await page.keyboard.press('n');
    await sleep(500);
    const open = await safe(() => newDialog(page).isVisible(), false);
    checks.push(check(!open, 'la tecla N no abre el diálogo', open ? 'la tecla N abre el diálogo' : 'la tecla N no abre el diálogo'));
  }
  return verdict(checks);
};

defineBrowserRows({
  story: 'US-REQ-EDICION-008',
  surface: 'web',
  tenants: [TENANT_A],
  handlers: new Map<number, BrowserRowHandler>([
    [1, onWeb(createsValid)],
    [2, onWeb(rejectsTitle)],
    [3, onWeb(clearsNotice)],
    [4, onWeb(parentDependsOnOpening)],
    [5, onWeb(cancelCreatesNothing)],
    [6, onWeb(onlyCreatorsOpen)],
  ]),
});
