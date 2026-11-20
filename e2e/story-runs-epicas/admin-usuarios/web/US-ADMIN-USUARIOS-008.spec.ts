import type { Locator, Page } from '@playwright/test';
import { TENANT_A, requestAccount, resetTenants } from '../../../story-runs/support/prepare';
import { ACTION, CEILING_MS, isVisible, quoted, runSteps, safe, textOf, waitUntil } from '../../support/browser';
import { check, cell, preparationFailedWeb, sleep, strict } from '../../support/checks';
import { defineBrowserRows, type BrowserRowHandler } from '../../core/framework';
import { ADMIN_A, SEED_ID, patchUser, signIn, sessionOfResult } from '../api/common';
import {
  ADMIN_PATH,
  activeSwitchOf,
  armToasts,
  chooseRoleOption,
  corsFor,
  disabledWithTitle,
  errorBody,
  isApiPath,
  onWeb,
  resetAlumno,
  roleSelectOf,
  roleValueOf,
  rowOf,
  selectedRoleLabel,
  signInWeb,
  statusBadgeOf,
  switchChecked,
  toastBodyOf,
  toastLog,
  toastShown,
  verdict,
  waitTableReady,
} from './common';

// US-ADMIN-USUARIOS-008 — Cambiar el rol o el estado de un usuario desde su fila (web, escritorio 1440 × 900).
// Preparación de cada fila: reinicio de alumno01; alumno01@sigpro.lab inicia sesión en la web y abre «Usuarios» de Administración. Si una
// fila necesita que auditor@sigpro.test esté desactivada, la desactiva alumno01 con PATCH /api/admin/users/u4 tras reiniciar el tenant.

const ROLE_OF_LABEL: ReadonlyMap<string, string> = new Map<string, string>([
  ['Auditor', 'auditor'],
  ['Admin', 'admin'],
  ['Gestor de programas', 'program_manager'],
  ['Consultor', 'consultant'],
]);

const ACTIVE_BEFORE: ReadonlyMap<string, string> = new Map<string, string>([
  ['sí', 'true'],
  ['no', 'false'],
]);

const DELAYS: ReadonlyMap<string, number> = new Map<string, number>([
  ['1 segundo', 1_000],
  ['3 segundos', 3_000],
]);

const TOAST_UPDATED = 'Usuario actualizado';
const TOAST_FAILED = 'No se pudo guardar el cambio';
const OWN_DENIED = 'No puedes modificar tu propia cuenta';

/** Qué se elige en la fila: el selector de rol (con su valor técnico) o el interruptor de «Activo». */
type Action = { readonly kind: 'role'; readonly label: string; readonly value: string } | { readonly kind: 'switch' };

const ACTION_CELLS: ReadonlyMap<string, Action> = new Map<string, Action>([
  ['elige el rol «Auditor»', { kind: 'role', label: 'Auditor', value: 'auditor' }],
  ['pulsa el interruptor de la columna «Activo»', { kind: 'switch' }],
]);

/** Lo que vuelve a mostrar la fila tras el rechazo: el rol anterior (su etiqueta) o el interruptor encendido. */
type Before = { readonly kind: 'role'; readonly label: string } | { readonly kind: 'switch'; readonly on: boolean };

const BEFORE_CELLS: ReadonlyMap<string, Before> = new Map<string, Before>([
  ['el rol «Consultor»', { kind: 'role', label: 'Consultor' }],
  ['el interruptor encendido', { kind: 'switch', on: true }],
]);

/** Motivo del rechazo: el texto exacto del aviso, o la traza HTTP («una traza del error»). */
type Motive = { readonly kind: 'text'; readonly text: string } | { readonly kind: 'trace'; readonly status: number };

const MOTIVE_CELLS: ReadonlyMap<string, Motive> = new Map<string, Motive>([
  ['el texto «Debe quedar al menos un admin activo en el tenant»', { kind: 'text', text: 'Debe quedar al menos un admin activo en el tenant' }],
  ['el texto «No puedes desactivarte ni cambiar tu propio rol»', { kind: 'text', text: 'No puedes desactivarte ni cambiar tu propio rol' }],
  ['una traza del error', { kind: 'trace', status: 500 }],
]);

interface Rejection {
  readonly status: number;
  readonly code: string;
}

const REJECTION_CELLS: ReadonlyMap<string, Rejection> = new Map<string, Rejection>([
  ['409 last_admin', { status: 409, code: 'last_admin' }],
  ['409 self_change', { status: 409, code: 'self_change' }],
  ['500', { status: 500, code: 'internal_error' }],
]);

/** Lo que muestra el selector de rol o el interruptor de la fila ahora mismo, leído del DOM. */
const rowRole = (page: Page, id: string): Promise<string | undefined> => selectedRoleLabel(roleSelectOf(page, id));
const rowSwitchOn = async (page: Page, id: string): Promise<boolean | undefined> => {
  const value = await switchChecked(activeSwitchOf(page, id));
  return value === undefined ? undefined : value === 'true';
};

/** Id de la fila de un correo en la tabla visible (su `data-testid`), o `undefined`. */
const idOfRowByEmail = (page: Page, email: string): Promise<string | undefined> =>
  safe(
    () =>
      page.evaluate((target: string) => {
        const rows = Array.from(document.querySelectorAll('tbody tr'));
        const row = rows.find((element) => (element.querySelectorAll('td')[1]?.textContent ?? '').trim() === target);
        const testid = row?.getAttribute('data-testid') ?? '';
        return testid.startsWith('admin-user-row-') ? testid.slice('admin-user-row-'.length) : undefined;
      }, email),
    undefined,
  );

/** Abre sesión en alumno01, abre «Usuarios» y deja la tabla lista. Devuelve el motivo del fallo de preparación, si lo hay. */
const openUsersTable = async (page: Page, expected: string): Promise<string | undefined> => {
  const signed = await signInWeb(page, 'alumno01@sigpro.lab');
  if (signed !== undefined) return `iniciar sesión como alumno01@sigpro.lab: ${signed}`;
  const opened = await runSteps([['abrir /admin', () => page.goto(ADMIN_PATH, { timeout: CEILING_MS })]]);
  if (opened !== undefined) return opened;
  return (await waitTableReady(page)) ? undefined : `la tabla de usuarios no asienta su lista (${expected})`;
};

/** Token de alumno01 para preparar estados con la API (null si no inicia sesión). */
const adminToken = async (): Promise<string | undefined> => sessionOfResult(await signIn(ADMIN_A, TENANT_A))?.accessToken;

// --- Esquema 1: un cambio de rol se guarda, lo confirma un aviso y persiste al recargar ---------------------------------------

const roleSaved: BrowserRowHandler = async (row, { page }) => {
  const email = cell(row, 'correo');
  const id = strict('correo', SEED_ID, email);
  // La celda es la ETIQUETA visible («Auditor»); el valor técnico que ofrece el <select> sale del mapa (auditor)
  const roleLabel = cell(row, 'rol_nuevo');
  const roleValue = strict('rol_nuevo', ROLE_OF_LABEL, roleLabel);
  const aviso = quoted(cell(row, 'aviso'));
  const expected = `aviso «${TOAST_UPDATED}» con «${aviso}» y, tras recargar, la fila de ${email} muestra «${roleLabel}»`;
  await resetAlumno();
  const preparation = await openUsersTable(page, expected);
  if (preparation !== undefined) return preparationFailedWeb(expected, preparation);
  if (!(await armToasts(page))) throw new Error('registro de avisos no instalado en la página: fallo del arnés');
  const choice = await chooseRoleOption(roleSelectOf(page, id), roleLabel, roleValue);
  if (choice.problem !== undefined) return verdict([check(false, `se puede elegir «${roleLabel}» en el selector de la fila de ${email}`, `${choice.problem}; opciones del selector: ${choice.offered}`)], undefined, { opciones: choice.offered });
  const toast = await toastShown(page, 'ok', TOAST_UPDATED, aviso);
  const reloaded = await runSteps([['recargar la página', () => page.reload({ timeout: CEILING_MS })]]);
  const ready = await waitTableReady(page);
  const roleAfter = await rowRole(page, id);
  return verdict([
    check(toast.seen, `aparece el aviso «${TOAST_UPDATED}» con «${aviso}»`, `el registro dice: ${toast.observed}`),
    check(reloaded === undefined && ready && roleAfter === roleLabel, `tras recargar, la fila de ${email} muestra «${roleLabel}»`, reloaded ?? `tras recargar, la fila muestra «${roleAfter ?? '(sin leer)'}»`),
  ]);
};

// --- Esquema 2: un cambio de activo se guarda, lo confirma un aviso y actualiza la insignia ---------------------------------

const switchSaved: BrowserRowHandler = async (row, { page }) => {
  const email = cell(row, 'correo');
  const id = strict('correo', SEED_ID, email);
  const before = strict('activo_antes', ACTIVE_BEFORE, cell(row, 'activo_antes'));
  const aviso = quoted(cell(row, 'aviso'));
  const status = quoted(cell(row, 'estado'));
  const expected = `aviso «${TOAST_UPDATED}» con «${aviso}» y la insignia de «Estado» muestra «${status}»`;
  await resetAlumno();
  if (before === 'false') {
    // Preparación: auditor@sigpro.test desactivada tras reiniciar el tenant (PATCH /api/admin/users/u4 con active falso)
    const token = await adminToken();
    if (token === undefined) return preparationFailedWeb(expected, 'alumno01@sigpro.lab no inicia sesión para desactivar la cuenta');
    const off = await patchUser(token, id, { active: false });
    if (off.status !== 200) return preparationFailedWeb(expected, `desactivar ${email} con PATCH /api/admin/users/${id} responde ${off.status}`);
  }
  const preparation = await openUsersTable(page, expected);
  if (preparation !== undefined) return preparationFailedWeb(expected, preparation);
  const initial = await rowSwitchOn(page, id);
  if (initial !== (before === 'true')) return preparationFailedWeb(expected, `el interruptor de «Activo» de ${email} está ${String(initial)} y no ${before}`);
  if (!(await armToasts(page))) throw new Error('registro de avisos no instalado en la página: fallo del arnés');
  const clicked = await runSteps([[`pulsar el interruptor de «Activo» de ${email}`, () => activeSwitchOf(page, id).click(ACTION)]]);
  if (clicked !== undefined) {
    const exists = (await safe(() => activeSwitchOf(page, id).count(), 0)) > 0;
    return verdict([check(false, `se puede pulsar el interruptor de «Activo» de ${email}`, `${clicked}; el interruptor ${exists ? 'existe' : 'no existe'} en la fila`)]);
  }
  const toast = await toastShown(page, 'ok', TOAST_UPDATED, aviso);
  const badge = await waitUntil(async () => (await textOf(statusBadgeOf(page, id))) === status);
  const badgeNow = await textOf(statusBadgeOf(page, id));
  return verdict([
    check(toast.seen, `aparece el aviso «${TOAST_UPDATED}» con «${aviso}»`, `el registro dice: ${toast.observed}`),
    check(badge.reached, `la insignia de «Estado» muestra «${status}»`, `la insignia de «Estado» muestra «${badgeNow ?? '(sin texto)'}»`),
  ]);
};

// --- Esquema 3: mientras la API responde, la fila ya muestra el cambio -----------------------------------------------------------

const optimisticRole: BrowserRowHandler = async (row, { page }) => {
  const delay = strict('espera', DELAYS, cell(row, 'espera'));
  const expected = `antes de la respuesta el selector de la fila de consultor@sigpro.test muestra «Auditor»; al llegar la respuesta, aviso «${TOAST_UPDATED}» con «Lucía Fernández: rol = Auditor»`;
  await resetAlumno();
  // La respuesta de PATCH /api/admin/users/u3 llega tras la espera de la prueba (la historia no la fija; es la de la prueba)
  await page.route(
    (url) => isApiPath(url, '/admin/users/u3'),
    async (route) => {
      if (route.request().method() !== 'PATCH') return route.continue();
      await sleep(delay);
      return route.continue();
    },
  );
  const preparation = await openUsersTable(page, expected);
  if (preparation !== undefined) return preparationFailedWeb(expected, preparation);
  if (!(await armToasts(page))) throw new Error('registro de avisos no instalado en la página: fallo del arnés');
  const choice = await chooseRoleOption(roleSelectOf(page, 'u3'), 'Auditor', 'auditor');
  if (choice.problem !== undefined) return verdict([check(false, 'se puede elegir «Auditor» en el selector de la fila de consultor@sigpro.test', `${choice.problem}; opciones del selector: ${choice.offered}`)], undefined, { opciones: choice.offered });
  const optimistic = await waitUntil(async () => (await roleValueOf(roleSelectOf(page, 'u3'))) === 'auditor');
  const shownNow = await roleValueOf(roleSelectOf(page, 'u3'));
  const earlyToasts = ((await toastLog(page)) ?? []).filter((entry) => entry.tone === 'ok').length;
  const toast = await toastShown(page, 'ok', TOAST_UPDATED, 'Lucía Fernández: rol = Auditor');
  return verdict([
    check(optimistic.reached && earlyToasts === 0, 'antes de la respuesta el selector ya muestra «Auditor» y aún no hay aviso', `antes de la respuesta: selector con valor «${shownNow ?? '(sin leer)'}», avisos ok ${earlyToasts}`),
    check(toast.seen, `al llegar la respuesta, aparece «${TOAST_UPDATED}» con «Lucía Fernández: rol = Auditor»`, `el registro dice: ${toast.observed}`),
  ]);
};

// --- Esquema 4: si la API rechaza el cambio, la fila vuelve a su valor y avisa del motivo ----------------------------------

const rejectedChange: BrowserRowHandler = async (row, { page }) => {
  const email = cell(row, 'correo');
  const id = strict('id', new Map<string, string>([['u3', 'u3'], ['u4', 'u4']]), cell(row, 'id'));
  const action = strict('accion', ACTION_CELLS, cell(row, 'accion'));
  const rejection = strict('codigo', REJECTION_CELLS, cell(row, 'codigo'));
  const before = strict('valor_anterior', BEFORE_CELLS, cell(row, 'valor_anterior'));
  const motive = strict('motivo', MOTIVE_CELLS, cell(row, 'motivo'));
  const expected = `la fila de ${email} vuelve a ${cell(row, 'valor_anterior')} y aviso «${TOAST_FAILED}» con ${cell(row, 'motivo')}`;
  await resetAlumno();
  // Respuesta de rechazo: se sirve una sola vez para el PATCH de esa cuenta; el resto del tráfico sigue su curso
  let served = 0;
  await page.route(
    (url) => isApiPath(url, `/admin/users/${id}`),
    (route) => {
      if (route.request().method() !== 'PATCH' || served > 0) return route.continue();
      served += 1;
      return route.fulfill({ status: rejection.status, contentType: 'application/json', headers: corsFor(route), body: errorBody(rejection.status, rejection.code) });
    },
  );
  const preparation = await openUsersTable(page, expected);
  if (preparation !== undefined) return preparationFailedWeb(expected, preparation);
  if (!(await armToasts(page))) throw new Error('registro de avisos no instalado en la página: fallo del arnés');
  const choice = action.kind === 'role' ? await chooseRoleOption(roleSelectOf(page, id), action.label, action.value) : undefined;
  const acted = action.kind === 'role' ? choice?.problem : await runSteps([[`pulsar el interruptor de «Activo» de ${email}`, () => activeSwitchOf(page, id).click(ACTION)]]);
  if (acted !== undefined) return verdict([check(false, `se puede ejecutar «${cell(row, 'accion')}» en la fila de ${email}`, `${acted}${choice === undefined ? '' : `; opciones del selector: ${choice.offered}`}`)], undefined, choice === undefined ? undefined : { opciones: choice.offered });
  const failed = await toastShown(page, 'danger', TOAST_FAILED, motive.kind === 'text' ? motive.text : undefined);
  const reverted = await waitUntil(async () => (before.kind === 'role' ? (await rowRole(page, id)) === before.label : (await rowSwitchOn(page, id)) === before.on));
  const revertedNow = before.kind === 'role' ? await rowRole(page, id) : await rowSwitchOn(page, id);
  const body = await toastBodyOf(page, 'danger', TOAST_FAILED);
  const motiveCheck =
    motive.kind === 'text'
      ? check(failed.seen, `el aviso «${TOAST_FAILED}» dice «${motive.text}»`, `el registro dice: ${failed.observed}`)
      : check(body !== undefined && body.startsWith(`PATCH /api/admin/users/${id} → ${motive.status}`), `el aviso «${TOAST_FAILED}» trae la traza PATCH /api/admin/users/${id} → ${motive.status}`, `el cuerpo del aviso es «${body ?? '(ninguno)'}»`);
  return verdict(
    [
      check(reverted.reached, `la fila vuelve a ${cell(row, 'valor_anterior')}`, `la fila muestra ${before.kind === 'role' ? `el rol «${String(revertedNow)}»` : `el interruptor ${String(revertedNow)}`}`),
      motiveCheck,
    ],
    `La API respondió ${rejection.status} una sola vez a PATCH /api/admin/users/${id}.`,
  );
};

// --- Esquema 5: una cuenta que el reinicio del tenant ha borrado no se puede cambiar ----------------------------------------

const deletedAccount: BrowserRowHandler = async (row, { page }) => {
  const action = strict('accion', ACTION_CELLS, cell(row, 'accion'));
  const before = strict('valor_anterior', BEFORE_CELLS, cell(row, 'valor_anterior'));
  const expected = `tras el reinicio, la fila vuelve a ${cell(row, 'valor_anterior')} y aviso «${TOAST_FAILED}» con «El usuario ya no existe»`;
  await resetAlumno();
  const requested = await requestAccount(TENANT_A);
  if (requested.result.status < 200 || requested.result.status > 299) return preparationFailedWeb(expected, `solicitar la cuenta en alumno01: respuesta ${requested.result.status}`);
  const preparation = await openUsersTable(page, expected);
  if (preparation !== undefined) return preparationFailedWeb(expected, preparation);
  const appeared = await waitUntil(async () => (await idOfRowByEmail(page, requested.email)) !== undefined);
  const id = await idOfRowByEmail(page, requested.email);
  if (!appeared.reached || id === undefined) return preparationFailedWeb(expected, `la cuenta recién solicitada no aparece en la tabla (${requested.email})`);
  const pendingBefore = await textOf(statusBadgeOf(page, id));
  // El reinicio se hace por la API, sin recargar la página: la fila sigue en pantalla
  await resetTenants([TENANT_A]);
  if (!(await armToasts(page))) throw new Error('registro de avisos no instalado en la página: fallo del arnés');
  const choice = action.kind === 'role' ? await chooseRoleOption(roleSelectOf(page, id), 'Auditor', 'auditor') : undefined;
  const acted = action.kind === 'role' ? choice?.problem : await runSteps([[`pulsar el interruptor de «Activo» de la cuenta recién solicitada`, () => activeSwitchOf(page, id).click(ACTION)]]);
  if (acted !== undefined) return verdict([check(false, `se puede ejecutar «${cell(row, 'accion')}» en la cuenta recién solicitada`, `${acted}${choice === undefined ? '' : `; opciones del selector: ${choice.offered}`}`)], undefined, choice === undefined ? undefined : { opciones: choice.offered });
  const failed = await toastShown(page, 'danger', TOAST_FAILED, 'El usuario ya no existe');
  const reverted = await waitUntil(async () => (before.kind === 'role' ? (await rowRole(page, id)) === before.label : (await rowSwitchOn(page, id)) === before.on));
  const revertedNow = before.kind === 'role' ? await rowRole(page, id) : await rowSwitchOn(page, id);
  return verdict([
    check(reverted.reached, `la fila vuelve a ${cell(row, 'valor_anterior')}`, `la fila muestra ${before.kind === 'role' ? `el rol «${String(revertedNow)}»` : `el interruptor ${String(revertedNow)}`}`),
    check(failed.seen, `aparece el aviso «${TOAST_FAILED}» con «El usuario ya no existe»`, `el registro dice: ${failed.observed}`),
    // Regla que la fila da por hecha: la cuenta recién solicitada aparece en la tabla como pendiente de aprobación
    check(pendingBefore === 'Pendiente', 'la cuenta recién solicitada aparece con la insignia «Pendiente»', `la insignia de la cuenta recién solicitada muestra «${pendingBefore ?? '(sin texto)'}»`),
  ]);
};

// --- Esquema 6: los controles de la propia cuenta están deshabilitados y explicados ----------------------------------------------

const CONTROL_CELLS: ReadonlyMap<string, 'role' | 'switch'> = new Map<string, 'role' | 'switch'>([
  ['el selector de la columna «Rol»', 'role'],
  ['el interruptor de la columna «Activo»', 'switch'],
]);

const ownControls: BrowserRowHandler = async (row, { page }) => {
  const control = strict('control', CONTROL_CELLS, cell(row, 'control'));
  const expected = `${cell(row, 'control')} está deshabilitado y su explicación es «${OWN_DENIED}»`;
  await resetAlumno();
  const preparation = await openUsersTable(page, expected);
  if (preparation !== undefined) return preparationFailedWeb(expected, preparation);
  const target: Locator = control === 'role' ? roleSelectOf(page, 'u7') : activeSwitchOf(page, 'u7');
  const state = await disabledWithTitle(target);
  const row7 = await isVisible(rowOf(page, 'u7'));
  return verdict([
    check(state.disabled === true, `${cell(row, 'control')} está deshabilitado`, `deshabilitado=${String(state.disabled)}`),
    check(state.title === OWN_DENIED, `la explicación es «${OWN_DENIED}»`, `la explicación (title) es «${state.title ?? '(sin explicación)'}»`),
    check(row7, 'la fila de alumno01@sigpro.lab está en la tabla', `fila u7 visible=${String(row7)}`),
  ]);
};

defineBrowserRows({
  story: 'US-ADMIN-USUARIOS-008',
  surface: 'web',
  tenants: [TENANT_A],
  handlers: new Map<number, BrowserRowHandler>([
    [1, onWeb(roleSaved)],
    [2, onWeb(switchSaved)],
    [3, onWeb(optimisticRole)],
    [4, onWeb(rejectedChange)],
    [5, onWeb(deletedAccount)],
    [6, onWeb(ownControls)],
  ]),
});
