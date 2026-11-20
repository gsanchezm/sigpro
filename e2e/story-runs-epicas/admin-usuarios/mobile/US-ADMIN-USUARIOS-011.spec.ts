import type { Page } from '@playwright/test';
import { TENANT_A } from '../../../story-runs/support/prepare';
import { ACTION, attrOf, isVisible, quoted, runSteps, safe, textOf, waitUntil } from '../../support/browser';
import { check, cell, preparationFailedWeb, strict } from '../../support/checks';
import { defineBrowserRows, type BrowserRowHandler } from '../../core/framework';
import { SEED_ID } from '../api/common';
import { armToasts, corsFor, credentialsOf, errorBody, isApiPath, quietOk, resetAlumno, toastBodyOf, toastShown } from '../web/common';
import {
  activeSwitchOf,
  cardOf,
  comboLabel,
  onMobile,
  openAdminFromMore,
  pickRole,
  reasonOf,
  roleComboOf,
  signInMobile,
  statusBadgeOf,
  switchChecked,
  tabOf,
  verdict,
  waitUsersReady,
} from './common';

// US-ADMIN-USUARIOS-011 — Cambiar el rol o el estado de un usuario desde su tarjeta (app móvil, Expo web a 390 × 844; NO es nativo).
// Preparación de cada fila: reinicio de alumno01; la cuenta de alumno01 inicia sesión en la app con alumno01 en «Tenant de trabajo», va a
// «Más», abre «Administración» y elige «Usuarios». Si una fila necesita que auditor@sigpro.test esté desactivada, la desactiva alumno01
// con PATCH /api/admin/users/u4 tras reiniciar el tenant. Los rechazos se simulan en la app, una sola vez por fila.

const ROLE_OF_LABEL: ReadonlyMap<string, string> = new Map<string, string>([
  ['Auditor', 'auditor'],
  ['Gestor de programas', 'program_manager'],
  ['Consultor', 'consultant'],
  ['Admin', 'admin'],
]);

const ACTIVE_BEFORE: ReadonlyMap<string, string> = new Map<string, string>([['sí', 'true']]);

const TOAST_UPDATED = 'Usuario actualizado';
const TOAST_FAILED = 'No se pudo guardar el cambio';
const OWN_REASON = 'No puedes modificar tu propia cuenta';

/** Usuario por su correo: el id del seed, o `undefined` si no es del seed. */
const idOf = (email: string): string | undefined => SEED_ID.get(email);

/** Lo que vuelve a mostrar la tarjeta tras el rechazo: el rol anterior o el interruptor encendido. */
type Before = { readonly kind: 'role'; readonly label: string } | { readonly kind: 'switch'; readonly on: boolean };

const BEFORE_CELLS: ReadonlyMap<string, Before> = new Map<string, Before>([
  ['el rol Consultor', { kind: 'role', label: 'Consultor' }],
  ['el interruptor encendido', { kind: 'switch', on: true }],
]);

type Action = { readonly kind: 'role'; readonly label: string; readonly value: string } | { readonly kind: 'switch' };

const ACTION_CELLS: ReadonlyMap<string, Action> = new Map<string, Action>([
  ['elige el rol Auditor', { kind: 'role', label: 'Auditor', value: 'auditor' }],
  ['pulsa el interruptor', { kind: 'switch' }],
]);

/** Motivo del rechazo: el texto del aviso, o la traza HTTP. */
type Motive = { readonly kind: 'text'; readonly text: string } | { readonly kind: 'trace'; readonly status: number };

const MOTIVE_CELLS: ReadonlyMap<string, Motive> = new Map<string, Motive>([
  ['el texto «Debe quedar al menos un admin activo en el tenant»', { kind: 'text', text: 'Debe quedar al menos un admin activo en el tenant' }],
  ['una traza del error', { kind: 'trace', status: 500 }],
]);

interface Rejection {
  readonly status: number;
  readonly code: string;
}

const REJECTION_CELLS: ReadonlyMap<string, Rejection> = new Map<string, Rejection>([
  ['409 last_admin', { status: 409, code: 'last_admin' }],
  ['500', { status: 500, code: 'internal_error' }],
]);

const rowRole = (page: Page, id: string): Promise<string | undefined> => comboLabel(page, id);
const rowSwitchOn = async (page: Page, id: string): Promise<boolean | undefined> => {
  const value = await switchChecked(page, id);
  return value === undefined ? undefined : value === 'true';
};

/** Abre la app, sigue hasta «Administración» → «Usuarios» y deja la lista asentada. Devuelve el motivo del fallo de preparación, si lo hay. */
const openUsers = async (page: Page, email: string, expected: string): Promise<string | undefined> => {
  await resetAlumno();
  const signed = await signInMobile(page, email, credentialsOf(email).password);
  if (signed !== undefined) return `iniciar sesión como ${email}: ${signed}`;
  const entered = await openAdminFromMore(page);
  if (entered !== undefined) return entered;
  return (await waitUsersReady(page)) ? undefined : `la lista de tarjetas no asienta (${expected})`;
};

const ensureArmed = async (page: Page): Promise<void> => {
  if (!(await armToasts(page))) throw new Error('registro de avisos no instalado en la página móvil: fallo del arnés');
};

// --- Esquema 1: un cambio de rol se guarda y lo confirma un aviso -------------------------------------------------------------

const roleSaved: BrowserRowHandler = async (row, { page }) => {
  const email = cell(row, 'correo');
  const id = strict('correo', SEED_ID, email);
  // La celda es la ETIQUETA visible de la opción («Auditor»); el valor técnico (auditor) sale del mapa
  const roleLabel = cell(row, 'rol_nuevo');
  const roleValue = strict('rol_nuevo', ROLE_OF_LABEL, roleLabel);
  const aviso = quoted(cell(row, 'aviso'));
  const expected = `aviso «${TOAST_UPDATED}» con «${aviso}» y, tras volver a abrir «Usuarios», la tarjeta de ${email} muestra «${roleLabel}»`;
  const preparation = await openUsers(page, 'alumno01@sigpro.lab', expected);
  if (preparation !== undefined) return preparationFailedWeb(expected, preparation);
  await ensureArmed(page);
  const picked = await pickRole(page, id, roleLabel, roleValue);
  if (picked.problem !== undefined) return verdict([check(false, `se puede elegir «${roleLabel}» en la tarjeta de ${email}`, `${picked.problem}; opciones visibles: ${picked.offered}`)], undefined, { opciones: picked.offered });
  const toast = await toastShown(page, 'ok', TOAST_UPDATED, aviso);
  const back = await runSteps([
    ['abrir «Auditoría»', () => tabOf(page, 'audit').click(ACTION)],
    ['volver a abrir «Usuarios»', () => tabOf(page, 'users').click(ACTION)],
  ]);
  const ready = await waitUsersReady(page);
  const roleAfter = await rowRole(page, id);
  return verdict([
    check(toast.seen, `aparece el aviso «${TOAST_UPDATED}» con «${aviso}»`, `el registro dice: ${toast.observed}`),
    check(back === undefined && ready && roleAfter === roleLabel, `tras volver a abrir «Usuarios», la tarjeta de ${email} muestra «${roleLabel}»`, back ?? `la tarjeta muestra «${roleAfter ?? '(sin leer)'}»`),
  ]);
};

// --- Esquema 2: elegir el rol que la cuenta ya tiene no cambia nada ----------------------------------------------------------

const sameRoleNoChange: BrowserRowHandler = async (row, { page }) => {
  const email = cell(row, 'correo');
  const id = strict('correo', SEED_ID, email);
  const current = cell(row, 'rol_actual');
  const currentValue = strict('rol_actual', ROLE_OF_LABEL, current);
  const expected = `ningún aviso «${TOAST_UPDATED}» y la tarjeta de ${email} sigue mostrando «${current}»`;
  const preparation = await openUsers(page, 'alumno01@sigpro.lab', expected);
  if (preparation !== undefined) return preparationFailedWeb(expected, preparation);
  await ensureArmed(page);
  const picked = await pickRole(page, id, current, currentValue);
  if (picked.problem !== undefined) return verdict([check(false, `se puede elegir «${current}» en la tarjeta de ${email}`, `${picked.problem}; opciones visibles: ${picked.offered}`)], undefined, { opciones: picked.offered });
  const quiet = await quietOk(page);
  const roleAfter = await rowRole(page, id);
  return verdict([
    check(quiet !== undefined && quiet.held, `no aparece ningún aviso «${TOAST_UPDATED}»`, quiet === undefined ? 'el registro de avisos no se puede leer' : quiet.held ? 'no apareció ningún aviso «Usuario actualizado»' : `apareció ${quiet.seen}`),
    check(roleAfter === current, `la tarjeta sigue mostrando «${current}»`, `la tarjeta muestra «${roleAfter ?? '(sin leer)'}»`),
  ]);
};

// --- Esquema 3: un cambio de activo se guarda, lo confirma un aviso y actualiza el estado -------------------------------------

const switchSaved: BrowserRowHandler = async (row, { page }) => {
  const email = cell(row, 'correo');
  const id = strict('correo', SEED_ID, email);
  const before = strict('activo_antes', ACTIVE_BEFORE, cell(row, 'activo_antes'));
  const aviso = quoted(cell(row, 'aviso'));
  const status = quoted(cell(row, 'estado'));
  const expected = `aviso «${TOAST_UPDATED}» con «${aviso}» y la tarjeta muestra «${status}»`;
  const preparation = await openUsers(page, 'alumno01@sigpro.lab', expected);
  if (preparation !== undefined) return preparationFailedWeb(expected, preparation);
  const initial = await rowSwitchOn(page, id);
  if (initial !== (before === 'true')) return preparationFailedWeb(expected, `el interruptor de «Activo» de ${email} está ${String(initial)} y no ${before}`);
  await ensureArmed(page);
  const clicked = await runSteps([[`pulsar el interruptor de la tarjeta de ${email}`, () => activeSwitchOf(page, id).click(ACTION)]]);
  if (clicked !== undefined) {
    const exists = (await safe(() => activeSwitchOf(page, id).count(), 0)) > 0;
    return verdict([check(false, `se puede pulsar el interruptor de la tarjeta de ${email}`, `${clicked}; el interruptor ${exists ? 'existe' : 'no existe'} en la tarjeta`)]);
  }
  const toast = await toastShown(page, 'ok', TOAST_UPDATED, aviso);
  const badge = await waitUntil(async () => (await textOf(statusBadgeOf(page, id))) === status);
  const badgeNow = await textOf(statusBadgeOf(page, id));
  return verdict([
    check(toast.seen, `aparece el aviso «${TOAST_UPDATED}» con «${aviso}»`, `el registro dice: ${toast.observed}`),
    check(badge.reached, `la tarjeta muestra el estado «${status}»`, `la tarjeta muestra el estado «${badgeNow ?? '(sin texto)'}»`),
  ]);
};

// --- Esquema 4: si la API rechaza el cambio, la tarjeta vuelve a su valor y avisa del motivo ----------------------------------

const rejectedChange: BrowserRowHandler = async (row, { page }) => {
  const email = cell(row, 'correo');
  const id = strict('id', new Map<string, string>([['u3', 'u3'], ['u4', 'u4']]), cell(row, 'id'));
  const action = strict('accion', ACTION_CELLS, cell(row, 'accion'));
  const rejection = strict('codigo', REJECTION_CELLS, cell(row, 'codigo'));
  const before = strict('valor_anterior', BEFORE_CELLS, cell(row, 'valor_anterior'));
  const motive = strict('motivo', MOTIVE_CELLS, cell(row, 'motivo'));
  const expected = `la tarjeta de ${email} vuelve a ${cell(row, 'valor_anterior')} y aviso «${TOAST_FAILED}» con ${cell(row, 'motivo')}`;
  await resetAlumno();
  // Respuesta de rechazo: se sirve una sola vez para el PATCH de esa cuenta
  let served = 0;
  await page.route(
    (url) => isApiPath(url, `/admin/users/${id}`),
    (route) => {
      if (route.request().method() !== 'PATCH' || served > 0) return route.continue();
      served += 1;
      return route.fulfill({ status: rejection.status, contentType: 'application/json', headers: corsFor(route), body: errorBody(rejection.status, rejection.code) });
    },
  );
  const preparation = await openUsers(page, 'alumno01@sigpro.lab', expected);
  if (preparation !== undefined) return preparationFailedWeb(expected, preparation);
  await ensureArmed(page);
  const picked = action.kind === 'role' ? await pickRole(page, id, action.label, action.value) : undefined;
  const acted = action.kind === 'role' ? picked?.problem : await runSteps([[`pulsar el interruptor de la tarjeta de ${email}`, () => activeSwitchOf(page, id).click(ACTION)]]);
  if (acted !== undefined) return verdict([check(false, `se puede ejecutar «${cell(row, 'accion')}» en la tarjeta de ${email}`, `${acted}${picked === undefined ? '' : `; opciones visibles: ${picked.offered}`}`)], undefined, picked === undefined ? undefined : { opciones: picked.offered });
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
      check(reverted.reached, `la tarjeta vuelve a ${cell(row, 'valor_anterior')}`, `la tarjeta muestra ${before.kind === 'role' ? `el rol «${String(revertedNow)}»` : `el interruptor ${String(revertedNow)}`}`),
      motiveCheck,
    ],
    `La API respondió ${rejection.status} una sola vez a PATCH /api/admin/users/${id}.`,
  );
};

// --- Esquema 5: con su propia tarjeta los controles están deshabilitados y el motivo se ve -----------------------------------

const CONTROL_CELLS: ReadonlyMap<string, 'role' | 'switch'> = new Map<string, 'role' | 'switch'>([
  ['el selector de rol «Rol de Alumno 01»', 'role'],
  ['el interruptor «Activo: Alumno 01»', 'switch'],
]);

const ownCard: BrowserRowHandler = async (row, { page }) => {
  const control = strict('control', CONTROL_CELLS, cell(row, 'control'));
  const id = idOf('alumno01@sigpro.lab') ?? 'u7';
  const expected = `${cell(row, 'control')} está deshabilitado, debajo se ve «${OWN_REASON}» y junto al nombre la marca «tú»`;
  const preparation = await openUsers(page, 'alumno01@sigpro.lab', expected);
  if (preparation !== undefined) return preparationFailedWeb(expected, preparation);
  const target = control === 'role' ? roleComboOf(page, id) : activeSwitchOf(page, id);
  const disabledAttr = await attrOf(target, 'aria-disabled');
  const reason = await textOf(reasonOf(page, id));
  const mark = await isVisible(cardOf(page, id).getByText('tú', { exact: true }));
  // Estado efectivo: un clic de prueba sobre el control deshabilitado no debe cambiar nada ni avisar
  await ensureArmed(page);
  await safe(() => target.click({ force: true, timeout: 2_000 }), undefined);
  const quiet = await quietOk(page);
  const stillSelf = control === 'role' ? (await rowRole(page, id)) === 'Admin' : (await rowSwitchOn(page, id)) === true;
  return verdict([
    check(disabledAttr === 'true', `${cell(row, 'control')} está deshabilitado`, `aria-disabled ${disabledAttr ?? '(sin atributo)'}`),
    check(reason === OWN_REASON, `debajo se ve «${OWN_REASON}»`, `debajo se ve «${reason ?? '(sin texto)'}»`),
    check(mark, 'junto al nombre se ve la marca «tú»', `marca «tú» visible=${String(mark)}`),
    check(quiet !== undefined && quiet.held && stillSelf, 'el intento de cambio no cambia nada ni avisa', quiet === undefined ? 'el registro de avisos no se puede leer' : `avisos ok: ${quiet.seen || 'ninguno'}; estado ${stillSelf ? 'sin cambios' : 'cambiado'}`),
  ]);
};

defineBrowserRows({
  story: 'US-ADMIN-USUARIOS-011',
  surface: 'expo-web',
  tenants: [TENANT_A],
  handlers: new Map<number, BrowserRowHandler>([
    [1, onMobile(roleSaved)],
    [2, onMobile(sameRoleNoChange)],
    [3, onMobile(switchSaved)],
    [4, onMobile(rejectedChange)],
    [5, onMobile(ownCard)],
  ]),
});
