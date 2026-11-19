import type { Page } from '@playwright/test';
import { TENANT_A } from '../../../story-runs/support/prepare';
import { cell, check, preparationFailed, strict } from '../../support/checks';
import { isVisible, waitUntil } from '../../support/browser';
import { defineBrowserRows, type BrowserRowHandler, type Outcome } from '../../core/framework';
import { adminToken, stateOf, transition } from '../api/common';
import { ACCOUNT_CELLS, BUTTON_CELLS, STATE_CELLS, STATE_LABEL, TOAST_TOLERANCE_MS, armToasts, serverStateOf, toastLifeMs, toastLog, waitOkToast, webPrepFailed, type ToastEntry } from '../web/common';
import { confirmActions, confirmErrorOf, confirmOf, confirmShows, openConfirm, openRequirements, openSheet, pressConfirm, prepareMobile, quietMobile, sheetState, targetLabelOfButton, verdictMobile } from './common';

// US-REQ-FLUJO-011 — Confirmación del cambio de estado en la hoja (app móvil en Expo web). «Confirmar» aplica el paso: aparece «Estado actualizado»
// (3 s) y la hoja muestra el estado nuevo; «Cancelar» cierra sin cambiar nada; si el servidor rechaza el paso, la confirmación sigue abierta con
// un error. Preparación de cada fila: reinicio de alumno01, inicio de sesión en la app con alumno01 en «Tenant de trabajo» y hoja abierta.

const OK_TITLE = 'Estado actualizado';

/** Celda «aviso»: el texto exacto del aviso «Estado actualizado». */
const TOAST_BODY_CELLS: ReadonlyMap<string, string> = new Map<string, string>([
  ['«REQ-017 → Aprobado»', 'REQ-017 → Aprobado'],
  ['«REQ-002 → Validado»', 'REQ-002 → Validado'],
  ['«REQ-001 → Borrador»', 'REQ-001 → Borrador'],
]);

const REQUIREMENT_CELLS: ReadonlyMap<string, string> = new Map<string, string>([
  ['REQ-017', 'REQ-017'],
  ['REQ-001', 'REQ-001'],
  ['REQ-002', 'REQ-002'],
]);
const PROGRAM_CELLS: ReadonlyMap<string, string> = new Map<string, string>([
  ['PRG-002', 'PRG-002'],
  ['PRG-001', 'PRG-001'],
]);

/** Abre la hoja del requisito y comprueba que muestra el estado de partida; `failure` si la preparación no se cumple. */
const openPremise = async (page: Page, programCode: string, requirementCode: string, expectedLabel: string, expected: string): Promise<Outcome | undefined> => {
  const listed = await openRequirements(page, programCode);
  if (listed !== undefined) return webPrepFailed(expected, listed);
  const opened = await openSheet(page, requirementCode);
  if (opened !== undefined) return webPrepFailed(expected, opened);
  const premise = await sheetState(page);
  return premise.label === expectedLabel ? undefined : webPrepFailed(expected, `la hoja muestra ${premise.label ?? '(no legible)'} y no ${expectedLabel}`);
};

/** Esquema 1: «Confirmar» aplica el paso, muestra el aviso de éxito y la hoja queda con el estado nuevo. */
const confirmApplies: BrowserRowHandler = async (row, { page }) => {
  const account = strict('cuenta', ACCOUNT_CELLS, cell(row, 'cuenta'));
  const requirementCode = strict('requisito', REQUIREMENT_CELLS, cell(row, 'requisito'));
  const programCode = strict('programa', PROGRAM_CELLS, cell(row, 'programa'));
  const expectedState = strict('estado', STATE_CELLS, cell(row, 'estado'));
  const buttonName = strict('boton', BUTTON_CELLS, cell(row, 'boton'));
  const toastBody = strict('aviso', TOAST_BODY_CELLS, cell(row, 'aviso'));
  const newState = strict('nuevo', STATE_CELLS, cell(row, 'nuevo'));
  const expectedLabel = STATE_LABEL.get(expectedState) ?? cell(row, 'estado');
  const expected = `pulsa ${cell(row, 'boton')} y «Confirmar»: aparece «${OK_TITLE}» con ${cell(row, 'aviso')} y la hoja muestra ${cell(row, 'nuevo')}`;

  const failure = await prepareMobile(page, account);
  if (failure !== undefined) return webPrepFailed(expected, failure);
  const premise = await openPremise(page, programCode, requirementCode, expectedLabel, expected);
  if (premise !== undefined) return premise;

  await armToasts(page);
  const dialog = await openConfirm(page, buttonName);
  if (dialog.failure !== undefined) return verdictMobile([check(false, expected, dialog.failure)]);
  const shows = await confirmShows(page, requirementCode, expectedLabel, targetLabelOfButton(buttonName));
  const actions = await confirmActions(page);
  const confirmFailure = await pressConfirm(page, 'Confirmar');
  if (confirmFailure !== undefined) return verdictMobile([check(false, expected, confirmFailure)]);
  const toast = await waitOkToast(page, OK_TITLE, toastBody);
  const life = toast.at === undefined ? undefined : await toastLifeMs(page, toast.at, toastBody);
  const closed = await waitUntil(async () => !(await isVisible(confirmOf(page))));
  const sheetNew = await waitUntil(async () => (await sheetState(page)).label === STATE_LABEL.get(newState));
  const sheetAfter = await sheetState(page);
  const server = await serverStateOf(requirementCode);

  return verdictMobile([
    check(dialog.shown, `se abre la confirmación «Cambiar el estado de ${requirementCode}»`, dialog.shown ? 'se abre la confirmación' : 'no se abre la confirmación'),
    check(shows.title === 1 && shows.body === 1, `la confirmación dice «${requirementCode} pasará de ${expectedLabel} a ${targetLabelOfButton(buttonName)}.»`, shows.title === 1 && shows.body === 1 ? 'la confirmación dice el título y el texto de la historia' : `título ${shows.title} y texto ${shows.body} encontrados`),
    check(actions.cancel === 1 && actions.confirm === 1, 'la confirmación tiene «Cancelar» y «Confirmar»', `«Cancelar»: ${actions.cancel} y «Confirmar»: ${actions.confirm} en la confirmación`),
    check(toast.found, `ve «${OK_TITLE}» con «${toastBody}»`, toast.observed),
    check(
      life !== undefined && Math.abs(life - 3_000) <= TOAST_TOLERANCE_MS,
      'el aviso se cierra solo a los 3 s (tolerancia de 0,5 s)',
      life === undefined ? 'el aviso no se cierra en el plazo de observación' : `el aviso se cierra a los ${life} ms desde que aparece`,
    ),
    check(closed.reached, 'la confirmación se cierra', closed.reached ? 'la confirmación se cierra' : 'la confirmación sigue abierta'),
    check(sheetNew.reached && sheetAfter.label === STATE_LABEL.get(newState), `la hoja muestra ${cell(row, 'nuevo')}`, `la hoja muestra ${sheetAfter.label ?? '(no legible)'}`),
    check(server === newState, `la API devuelve ${newState}`, `la API devuelve ${server ?? '(sin estado)'}`),
  ]);
};

/** Esquema 2: «Cancelar» cierra la confirmación; la hoja conserva el estado y no aparece «Estado actualizado». */
const cancelKeepsState: BrowserRowHandler = async (row, { page }) => {
  const account = strict('cuenta', ACCOUNT_CELLS, cell(row, 'cuenta'));
  const requirementCode = strict('requisito', REQUIREMENT_CELLS, cell(row, 'requisito'));
  const programCode = strict('programa', PROGRAM_CELLS, cell(row, 'programa'));
  const expectedState = strict('estado', STATE_CELLS, cell(row, 'estado'));
  const buttonName = strict('boton', BUTTON_CELLS, cell(row, 'boton'));
  const expectedLabel = cell(row, 'estado');
  const expected = `pulsa ${cell(row, 'boton')} y «Cancelar»: la confirmación se cierra, la hoja sigue mostrando ${expectedLabel} y no aparece «${OK_TITLE}»`;

  const failure = await prepareMobile(page, account);
  if (failure !== undefined) return webPrepFailed(expected, failure);
  const premise = await openPremise(page, programCode, requirementCode, expectedLabel, expected);
  if (premise !== undefined) return premise;

  await armToasts(page);
  const dialog = await openConfirm(page, buttonName);
  if (dialog.failure !== undefined) return verdictMobile([check(false, expected, dialog.failure)]);
  const shows = await confirmShows(page, requirementCode, expectedLabel, targetLabelOfButton(buttonName));
  const actions = await confirmActions(page);
  const cancelFailure = await pressConfirm(page, 'Cancelar');
  if (cancelFailure !== undefined) return verdictMobile([check(false, expected, cancelFailure)]);
  const closed = await waitUntil(async () => !(await isVisible(confirmOf(page))));
  await quietMobile();
  const sheetAfter = await sheetState(page);
  const toasts = await toastLog(page);
  const okShown = toasts === undefined ? undefined : toasts.some((entry: ToastEntry) => entry.tone === 'ok' && entry.title === OK_TITLE);
  const server = await serverStateOf(requirementCode);

  return verdictMobile([
    check(dialog.shown, `se abre la confirmación «Cambiar el estado de ${requirementCode}»`, dialog.shown ? 'se abre la confirmación' : 'no se abre la confirmación'),
    check(shows.title === 1 && shows.body === 1, `la confirmación dice «${requirementCode} pasará de ${expectedLabel} a ${targetLabelOfButton(buttonName)}.»`, shows.title === 1 && shows.body === 1 ? 'la confirmación dice el título y el texto de la historia' : `título ${shows.title} y texto ${shows.body} encontrados`),
    check(actions.cancel === 1 && actions.confirm === 1, 'la confirmación tiene «Cancelar» y «Confirmar»', `«Cancelar»: ${actions.cancel} y «Confirmar»: ${actions.confirm} en la confirmación`),
    check(closed.reached, 'la confirmación se cierra', closed.reached ? 'la confirmación se cierra' : 'la confirmación sigue abierta'),
    check(sheetAfter.label === expectedLabel, `la hoja sigue mostrando ${expectedLabel}`, `la hoja muestra ${sheetAfter.label ?? '(no legible)'}`),
    check(okShown === false, `no aparece el aviso «${OK_TITLE}»`, okShown === undefined ? 'el registro de avisos no se puede leer' : okShown ? `aparece el aviso «${OK_TITLE}»` : `ningún aviso «${OK_TITLE}» tras la ventana de observación`),
    check(server === expectedState, `la API sigue en ${expectedState}`, `la API devuelve ${server ?? '(sin estado)'}`),
  ]);
};

/** Esquema 3: el servidor rechaza el paso; la confirmación sigue abierta con el error; no aparece «Estado actualizado»; la API conserva su estado. */
const serverRejects: BrowserRowHandler = async (row, { page }) => {
  const account = strict('cuenta', ACCOUNT_CELLS, cell(row, 'cuenta'));
  const requirementCode = strict('requisito', REQUIREMENT_CELLS, cell(row, 'requisito'));
  const programCode = strict('programa', PROGRAM_CELLS, cell(row, 'programa'));
  const shownState = strict('estado_mostrado', STATE_CELLS, cell(row, 'estado_mostrado'));
  const serverState = strict('estado_servidor', STATE_CELLS, cell(row, 'estado_servidor'));
  const buttonName = strict('boton', BUTTON_CELLS, cell(row, 'boton'));
  const expected = `pulsa ${cell(row, 'boton')} y «Confirmar»: aparece dentro de la confirmación un aviso de error y la confirmación sigue abierta; no aparece «${OK_TITLE}»; la API devuelve ${cell(row, 'estado_servidor')}`;

  const failure = await prepareMobile(page, account);
  if (failure !== undefined) return webPrepFailed(expected, failure);
  const premise = await openPremise(page, programCode, requirementCode, STATE_LABEL.get(shownState) ?? cell(row, 'estado_mostrado'), expected);
  if (premise !== undefined) return premise;

  // alumno01 cambia el requisito con la API después de abrir la hoja (la app no se actualiza sola).
  const changed = await transition(requirementCode, TENANT_A, await adminToken(TENANT_A), { to: serverState });
  if (changed.status !== 200 || stateOf(changed) !== serverState) return preparationFailed(expected, `alumno01 cambia ${requirementCode} a ${serverState} con la API`, changed);
  const stillShown = await sheetState(page);
  if (stillShown.label !== cell(row, 'estado_mostrado')) return webPrepFailed(expected, `la hoja cambió sola a ${stillShown.label ?? '(no legible)'} antes de pulsar`);

  await armToasts(page);
  const dialog = await openConfirm(page, buttonName);
  if (dialog.failure !== undefined) return verdictMobile([check(false, expected, dialog.failure)]);
  const confirmFailure = await pressConfirm(page, 'Confirmar');
  if (confirmFailure !== undefined) return verdictMobile([check(false, expected, confirmFailure)]);

  const errorShown = await waitUntil(() => isVisible(confirmErrorOf(page)));
  // Tras ver el error se espera la ventana de observación: un «Estado actualizado» tardío tendría tiempo de aparecer.
  await quietMobile();
  const stillOpen = await isVisible(confirmOf(page));
  const toasts = await toastLog(page);
  const okShown = toasts === undefined ? undefined : toasts.some((entry: ToastEntry) => entry.tone === 'ok' && entry.title === OK_TITLE);
  const server = await serverStateOf(requirementCode);

  return verdictMobile([
    check(errorShown.reached, 'aparece dentro de la confirmación un aviso de error', errorShown.reached ? 'aparece dentro de la confirmación un aviso de error' : 'no aparece un aviso de error en la confirmación'),
    check(stillOpen, 'la confirmación sigue abierta', stillOpen ? 'la confirmación sigue abierta' : 'la confirmación se cierra'),
    check(okShown === false, `no aparece el aviso «${OK_TITLE}»`, okShown === undefined ? 'el registro de avisos no se puede leer' : okShown ? `aparece el aviso «${OK_TITLE}»` : `ningún aviso «${OK_TITLE}» tras la ventana de observación`),
    check(server === serverState, `la API devuelve ${serverState}`, `la API devuelve ${server ?? '(sin estado)'}`),
  ]);
};

defineBrowserRows({
  story: 'US-REQ-FLUJO-011',
  surface: 'expo-web',
  tenants: [TENANT_A],
  handlers: new Map<number, BrowserRowHandler>([
    [1, confirmApplies],
    [2, cancelKeepsState],
    [3, serverRejects],
  ]),
});
