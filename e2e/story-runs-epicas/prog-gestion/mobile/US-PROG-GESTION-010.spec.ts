import type { Page } from '@playwright/test';
import { defineBrowserRows, type BrowserRowHandler } from '../../core/framework';
import { cell, check, conclude, preparationFailedWeb, strict, type Check } from '../../support/checks';
import { attrOf, isVisible, quoted, waitUntil } from '../../support/browser';
import { TENANT_A, resetTenants } from '../../../story-runs/support/prepare';
import { accountOf, actionFailed, firstToastAt, noOkToast, normalized, timingOf, toastShown, watchResponse, type WebAction } from '../web/common';
import {
  barAction,
  bulkBar,
  bulkCount,
  cardCheckbox,
  cardCodes,
  checkCard,
  confirmAction,
  confirmDialog,
  onExpoWeb,
  parseVisible,
  recountOf,
  reasonOf,
  selectAll,
  selectToggle,
  signIn,
  stateOfCard,
  tapCard,
  toggleSelectMode,
  visibleStateCheck,
} from './common';

// US-PROG-GESTION-010 — Selección de programas y acciones masivas en la app móvil (Expo web, 390 × 844; NO es nativo). Preparación de
// cada fila: reinicio de alumno01 con el token de su administrador; la app en /login con alumno01 en «Tenant de trabajo», la cuenta
// de la fila y llegada a /programs.

/** Programas que marca la fila en la lista (en orden). */
const MARKED: ReadonlyMap<string, readonly string[]> = new Map<string, readonly string[]>([
  ['PRG-002', ['PRG-002']],
  ['PRG-001 y PRG-002', ['PRG-001', 'PRG-002']],
  ['PRG-002 y PRG-003', ['PRG-002', 'PRG-003']],
]);

/** Casillas de selección que se ven (una por tarjeta con el modo activo). */
const selectionBoxes = (page: Page): Promise<number> => page.getByRole('checkbox', { name: /^Seleccionar PRG-\d{3}$/ }).count();

const BAR_TEN = '10 seleccionados';

// --- Esquema 1: el modo de selección marca programas al tocarlos -------------------------------------------------------------

/** Cada acción de la historia, en orden (la primera que falla corta la fila). */
const SELECTION_ACTIONS: ReadonlyMap<string, WebAction> = new Map<string, WebAction>([
  ['pulsa «Seleccionar»', toggleSelectMode],
  ['pulsa «Seleccionar» y toca la tarjeta de PRG-002', async (page) => (await toggleSelectMode(page)) ?? (await tapCard('PRG-002')(page))],
  ['pulsa «Seleccionar» y después «Seleccionar todos»', async (page) => (await toggleSelectMode(page)) ?? (await selectAll(page))],
  ['pulsa «Seleccionar», después «Seleccionar todos» y otra vez «Seleccionar todos»', async (page) => (await toggleSelectMode(page)) ?? (await selectAll(page)) ?? (await selectAll(page))],
]);

/** Lo que cada resultado de la historia exige ver, comprobado sobre el estado observado. */
const RESULTS: ReadonlyMap<string, (page: Page) => Promise<Check>> = new Map<string, (page: Page) => Promise<Check>>([
  [
    '«Seleccionar» queda pulsado y cada tarjeta muestra su casilla',
    async (page) => {
      const pressed = await attrOf(selectToggle(page), 'aria-pressed');
      const boxes = await selectionBoxes(page);
      return check(pressed === 'true' && boxes === 10, '«Seleccionar» pulsado y 10 casillas', `«Seleccionar» ${pressed ?? '(sin leer)'} y ${boxes} casillas`);
    },
  ],
  [
    'PRG-002 queda marcado, no se abre su detalle y la barra dice «1 seleccionados»',
    async (page) => {
      const marked = await attrOf(cardCheckbox(page, 'PRG-002'), 'aria-checked');
      const path = new URL(page.url()).pathname;
      const count = await normalized(bulkCount(page));
      return check(
        marked === 'true' && path === '/programs' && count === '1 seleccionados',
        'PRG-002 marcado, en /programs y la barra dice «1 seleccionados»',
        `PRG-002 aria-checked ${marked ?? '(sin leer)'}, ruta ${path}, la barra dice «${count ?? '(sin barra)'}»`,
      );
    },
  ],
  [
    'la barra dice «10 seleccionados»',
    async (page) => {
      const count = await normalized(bulkCount(page));
      return check(count === BAR_TEN, `la barra dice «${BAR_TEN}»`, `la barra dice «${count ?? '(sin barra)'}»`);
    },
  ],
  [
    'la barra de acciones masivas no aparece',
    async (page) => {
      const visible = await isVisible(bulkBar(page));
      return check(!visible, 'la barra de acciones masivas no aparece', visible ? 'la barra de acciones masivas aparece' : 'la barra de acciones masivas no aparece');
    },
  ],
]);

const selectsOnTap: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const resultado = cell(row, 'resultado');
  const accion = cell(row, 'accion');
  const prepared = await signIn(page, 'gestor');
  if (prepared !== undefined) return preparationFailedWeb(resultado, prepared);
  // La cuarta acción tiene un paso intermedio: la barra debe decir «10 seleccionados» tras el primer «Seleccionar todos»
  let between: string | undefined;
  if (accion === 'pulsa «Seleccionar», después «Seleccionar todos» y otra vez «Seleccionar todos»') {
    const first = (await toggleSelectMode(page)) ?? (await selectAll(page));
    if (first !== undefined) return actionFailed(resultado, first);
    await waitUntil(async () => (await normalized(bulkCount(page))) === BAR_TEN);
    between = await normalized(bulkCount(page));
    const second = await selectAll(page);
    if (second !== undefined) return actionFailed(resultado, second);
  } else {
    const acted = await strict('accion', SELECTION_ACTIONS, accion)(page);
    if (acted !== undefined) return actionFailed(resultado, acted);
  }
  const verify = strict('resultado', RESULTS, resultado);
  // La reacción es local: se espera a que el estado llegue (con el techo de la prueba) antes de juzgar
  await waitUntil(async () => (await verify(page)).ok);
  const observed = await verify(page);
  return conclude([observed], between === undefined ? {} : { evidence: { barraTrasPrimerSeleccionarTodos: between } });
};

// --- Esquema 2: archivar la selección cierra los programas marcados sin pedir confirmación ----------------------------------

const archivesSelection: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const marcados = cell(row, 'marcados');
  const codes = strict('marcados', MARKED, marcados);
  const aviso = quoted(cell(row, 'aviso'));
  const expected = `aviso de éxito «${aviso}»; la barra no aparece; las tarjetas de ${codes.join(', ')} muestran «Cerrado»`;
  const prepared = await signIn(page, 'gestor');
  if (prepared !== undefined) return preparationFailedWeb(expected, prepared);
  const marked = await toggleSelectMode(page);
  if (marked !== undefined) return actionFailed(expected, marked);
  for (const code of codes) {
    const tick = await checkCard(code, true)(page);
    if (tick !== undefined) return actionFailed(expected, tick);
  }
  const archived = await barAction('Archivar')(page);
  if (archived !== undefined) return actionFailed(expected, archived);
  const toast = await toastShown(page, 'ok', aviso);
  const gone = await waitUntil(async () => !(await isVisible(bulkBar(page))));
  const states: Check[] = [];
  for (const code of codes) {
    await waitUntil(async () => (await stateOfCard(page, code)) === 'Cerrado');
    const state = await stateOfCard(page, code);
    states.push(check(state === 'Cerrado', `la tarjeta de ${code} muestra «Cerrado»`, `la tarjeta de ${code} muestra «${state ?? '(sin estado)'}»`));
  }
  return conclude([
    check(toast.seen, `aviso de éxito «${aviso}»`, `avisos de éxito: ${toast.observed}`),
    check(gone.reached, 'la barra de acciones masivas no aparece', gone.reached ? 'la barra de acciones masivas no aparece' : 'la barra sigue visible'),
    ...states,
  ]);
};

// --- Esquema 3: eliminar la selección pide confirmación y solo al confirmar borra los programas --------------------------

/** Lo que cada resultado de la historia exige, comprobado sobre la lista y los avisos observados. */
const DELETE_RESULTS: ReadonlyMap<string, (page: Page, endedAt: number) => Promise<readonly Check[]>> = new Map<string, (page: Page, endedAt: number) => Promise<readonly Check[]>>([
  [
    'no aparece ningún aviso de éxito y los dos programas siguen en la lista',
    async (page, endedAt) => {
      const quiet = await noOkToast(page, endedAt);
      const codes = await cardCodes(page);
      const both = codes.includes('PRG-001') && codes.includes('PRG-002');
      return [
        check(quiet.held, 'no aparece ningún aviso de éxito', quiet.held ? 'no aparece ningún aviso de éxito' : 'aparece un aviso de éxito'),
        check(both, 'los dos programas siguen en la lista', `la lista es ${codes.join(', ') || '(vacía)'}`),
      ];
    },
  ],
  [
    'aparece el aviso de éxito «2 programas eliminados»',
    async (page) => {
      const toast = await toastShown(page, 'ok', '2 programas eliminados');
      const codes = await cardCodes(page);
      const gone = !codes.includes('PRG-001') && !codes.includes('PRG-002');
      return [
        check(toast.seen, 'aparece el aviso de éxito «2 programas eliminados»', `avisos de éxito: ${toast.observed}`),
        check(gone, 'PRG-001 y PRG-002 ya no están en la lista', `la lista es ${codes.join(', ') || '(vacía)'}`),
      ];
    },
  ],
]);

const deletesSelection: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const salida = quoted(cell(row, 'salida'));
  const recuento = quoted(cell(row, 'recuento'));
  const expected = `${cell(row, 'resultado')}; recuento «${recuento}»`;
  const prepared = await signIn(page, 'admin');
  if (prepared !== undefined) return preparationFailedWeb(expected, prepared);
  const marked = await toggleSelectMode(page);
  if (marked !== undefined) return actionFailed(expected, marked);
  for (const code of ['PRG-001', 'PRG-002']) {
    const tick = await checkCard(code, true)(page);
    if (tick !== undefined) return actionFailed(expected, tick);
  }
  const removing = await barAction('Eliminar')(page);
  if (removing !== undefined) return actionFailed(expected, removing);
  const dialog = await waitUntil(() => isVisible(confirmDialog(page)));
  if (!dialog.reached) return actionFailed(expected, { message: 'no se abrió la hoja «Eliminar programa»', note: 'Eliminar de la barra no abrió la hoja de confirmación.' });
  const deletedAt = watchResponse(page, 'DELETE', '/api/programs/');
  const clickAt = Date.now();
  const answered = await confirmAction(salida)(page);
  if (answered !== undefined) return actionFailed(expected, answered);
  const endedAt = Date.now();
  // Se espera al recuento de la historia: la lista se relee tras el borrado (o no, si se canceló)
  await waitUntil(async () => (await normalized(recountOf(page))) === recuento);
  const verify = strict('resultado', DELETE_RESULTS, cell(row, 'resultado'));
  const checks = await verify(page, endedAt);
  const firstAt = await firstToastAt(page, 'ok', '2 programas eliminados');
  const count = await normalized(recountOf(page));
  return conclude([...checks, check(count === recuento, `el recuento dice «${recuento}»`, `el recuento dice «${count ?? '(sin recuento)'}»`)], timingOf(clickAt, firstAt, deletedAt()));
};

// --- Esquema 4: cada rol ve habilitadas solo las acciones masivas que su permiso permite ----------------------------------

const barRoles: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const expected = `«Archivar» ${cell(row, 'archivar')}; «Eliminar» ${cell(row, 'eliminar')}`;
  const prepared = await signIn(page, accountOf(cell(row, 'cuenta')));
  if (prepared !== undefined) return preparationFailedWeb(expected, prepared);
  const marked = await toggleSelectMode(page);
  if (marked !== undefined) return actionFailed(expected, marked);
  const tick = await checkCard('PRG-002', true)(page);
  if (tick !== undefined) return actionFailed(expected, tick);
  await waitUntil(() => isVisible(bulkBar(page)));
  return conclude([
    await visibleStateCheck(bulkBar(page).getByRole('button', { name: 'Archivar', exact: true }), reasonOf(page, 'bulk-archive'), parseVisible(cell(row, 'archivar')), '«Archivar»'),
    await visibleStateCheck(bulkBar(page).getByRole('button', { name: 'Eliminar', exact: true }), reasonOf(page, 'bulk-delete'), parseVisible(cell(row, 'eliminar')), '«Eliminar»'),
  ]);
};

defineBrowserRows({
  story: 'US-PROG-GESTION-010',
  surface: 'expo-web',
  tenants: [TENANT_A],
  handlers: new Map<number, BrowserRowHandler>([
    [1, onExpoWeb(selectsOnTap)],
    [2, onExpoWeb(archivesSelection)],
    [3, onExpoWeb(deletesSelection)],
    [4, onExpoWeb(barRoles)],
  ]),
});
