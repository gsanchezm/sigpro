import type { Locator, Page } from '@playwright/test';
import { ACTION, CEILING_MS, attrOf, isVisible, pathOf, textOf, waitUntil } from '../../support/browser';
import { cell, check, preparationFailedWeb, strict, type Check } from '../../support/checks';
import { defineBrowserRows, notExecutable, type BrowserRowHandler, type Outcome } from '../../core/framework';
import {
  ADMIN_TESTIDS,
  AUDITORIA_TESTIDS,
  HITOS_DYNAMIC_TESTIDS,
  HITOS_TESTIDS,
  MOVIL_DOCUMENTS_TESTIDS,
  MOVIL_DYNAMIC_TESTIDS,
  MOVIL_NC_TESTIDS,
  MOVIL_TESTIDS,
  MOVIL_PROGRAMS_DYNAMIC_TESTIDS,
  MOVIL_REQUIREMENTS_DYNAMIC_TESTIDS,
  PROGRAMAS_DYNAMIC_TESTIDS,
  VERIFICACION_TESTIDS,
} from '../../../../packages/shared/src/testids';
import { ROLE_LOGIN, blocked, conclude as concludeWithNote, interact, resetAlumno01, type Diagnosis } from '../web/common';

// US-MULTITENANT-PERMISOS-009 — Acciones por rol en la app móvil (Expo web a 390 × 844; NO es nativo: el veredicto vale para la web de
// Expo). Preparación de cada fila: reinicio de alumno01 con el token de su administrador, contexto nuevo sin sesión, «alumno01» en
// «Tenant de trabajo» y la cuenta del rol. La app no pone `title` en los botones: un control deshabilitado se mide por su `aria-disabled`
// y su motivo se lee por su id de prueba, que debe aparecer una sola vez (si hay dos, la lectura es ambigua y no cuenta).

const EXPO_EVIDENCE = { plataforma: 'Expo web, 390 × 844 px (no nativo)' };
const EXPO_NOTE = 'Expo web a 390 × 844: no es la app nativa; el veredicto vale para la web de Expo (no se ha comprobado en iOS ni en Android).';

/** Veredicto de una fila móvil: lleva siempre la salvedad de Expo web (la preferencia de cookies de la web no aplica aquí). */
const conclude = (checks: readonly Check[], extra: Pick<Outcome, 'note' | 'evidence'> = {}): Outcome => concludeWithNote(checks, { note: EXPO_NOTE, ...extra });

const REASON_DELETE = 'Solo admin puede eliminar';
const REASON_APPROVE = 'Solo el gestor de programa o el admin pueden aprobar';
const REASON_RUN = 'Tu rol no permite registrar ejecuciones';
const REASON_PUBLISH = 'Solo admin y gestor pueden publicar versiones';
const REASON_CLOSE = 'Tu rol no permite cerrar no conformidades';
const REASON_MILESTONE = 'Tu rol no permite eliminar hitos';

/** Lo que la celda pide: habilitado (y sin el motivo de la acción), o deshabilitado con su motivo visible. */
interface Want {
  readonly enabled: boolean;
  readonly reason: string;
}

const parseWant = (text: string, denialReason: string): Want => {
  if (text === 'habilitada' || text === 'habilitado') return { enabled: true, reason: denialReason };
  const reason = /«([^»]+)»$/.exec(text.trim())?.[1];
  if (text.startsWith('deshabilitad') && reason !== undefined) return { enabled: false, reason };
  throw new Error(`celda sin interpretación: estado «${text}»`);
};

const tenantField = (page: Page): Locator => page.getByRole('textbox', { name: 'Tenant de trabajo', exact: true });
const emailField = (page: Page): Locator => page.getByRole('textbox', { name: 'Correo electrónico', exact: true });
const passwordField = (page: Page): Locator => page.getByRole('textbox', { name: 'Contraseña', exact: true });
const enterButton = (page: Page): Locator => page.getByRole('button', { name: 'Entrar', exact: true });
const title1 = (page: Page, name: string): Locator => page.getByRole('heading', { name, level: 1, exact: true });
const onPrograms = async (page: Page): Promise<boolean> => pathOf(page) === '/programs' && (await isVisible(title1(page, 'Programas')));

/** Entra como persona en la app de Expo web con la cuenta del rol. Devuelve el diagnóstico si no llega a /programs. */
const loginMobile = async (page: Page, credentials: { readonly email: string; readonly password: string }): Promise<Diagnosis | undefined> => {
  const failure = await interact([
    ['abrir /login', () => page.goto('/login', { timeout: CEILING_MS })],
    ['ver el título «Iniciar sesión»', () => title1(page, 'Iniciar sesión').waitFor({ timeout: CEILING_MS })],
    // Un solo `fill`: el campo vuelve a `demo` al quedar vacío, así que escribir carácter a carácter daría `demoalumno01`
    ['escribir el tenant en «Tenant de trabajo»', () => tenantField(page).fill('alumno01', ACTION)],
    ['escribir el correo', () => emailField(page).fill(credentials.email, ACTION)],
    ['escribir la contraseña', () => passwordField(page).fill(credentials.password, ACTION)],
    ['pulsar «Entrar»', () => enterButton(page).click(ACTION)],
  ]);
  if (failure) return failure;
  const arrived = await waitUntil(() => onPrograms(page));
  return arrived.reached ? undefined : { failure: `no se llegó a /programs tras «Entrar» (ruta ${pathOf(page)})`, evidence: { ruta: pathOf(page) } };
};

/** Estado de un control (aria-disabled) y de su motivo visible (un único elemento por id de prueba). */
const controlCheck = async (control: Locator, reason: Locator, label: string, want: Want): Promise<Check> => {
  // El control (y, si se espera deshabilitado, su motivo) pueden tardar: se espera a que aparezcan antes de leer su estado
  await waitUntil(() => isVisible(control));
  if (!want.enabled) await waitUntil(() => isVisible(reason));
  const visible = await isVisible(control);
  const disabled = visible ? (await attrOf(control, 'aria-disabled')) === 'true' : false;
  const count = await reason.count().catch(() => 0);
  const ambiguous = count > 1;
  const reasonShown = count === 1 && (await isVisible(reason));
  const shown = reasonShown ? await textOf(reason) : undefined;
  const ok = want.enabled ? visible && !disabled && !reasonShown : visible && disabled && shown === want.reason;
  const state = !visible ? 'no aparece' : disabled ? 'deshabilitada' : 'habilitada';
  const motive = ambiguous ? 'con varios motivos (lectura ambigua)' : shown === undefined ? 'sin motivo visible' : `y debajo aparece «${shown}»`;
  const wanted = want.enabled ? `«${label}» habilitada sin motivo` : `«${label}» deshabilitada y debajo aparece «${want.reason}»`;
  return check(ok, wanted, `«${label}» ${state}${visible ? ` ${motive}` : ''}`);
};

/** Espera la aparición del control de una pantalla ya abierta; si no aparece, la pantalla no se alcanzó. */
const screenMarker = async (page: Page, marker: string, expected: string, path: string): Promise<Outcome | undefined> => {
  const shown = await waitUntil(() => isVisible(page.getByText(marker).first()));
  return shown.reached ? undefined : notExecutable(expected, `no se ve «${marker}» en ${path}: la pantalla no se alcanzó`);
};

// --- Esquema 1: eliminar un programa desde su hoja de acciones -------------------------------------------------------------

const deleteFromList: BrowserRowHandler = async (row, { page }) => {
  const expected = cell(row, 'estado');
  const want = parseWant(expected, REASON_DELETE);
  await resetAlumno01();
  const login = await loginMobile(page, strict('rol', ROLE_LOGIN, cell(row, 'rol')));
  if (login) return blocked(expected, login);
  const menu = page.getByRole('button', { name: 'Acciones para PRG-001', exact: true });
  const listed = await waitUntil(() => isVisible(menu));
  if (!listed.reached) return preparationFailedWeb('ve la lista de programas con PRG-001', 'no aparece el botón de acciones de PRG-001 en la lista');
  const opened = await interact([['abrir las acciones de PRG-001', () => menu.click(ACTION)]]);
  if (opened) return blocked(expected, opened);
  const sheet = page.getByRole('dialog');
  const sheetUp = await waitUntil(() => isVisible(sheet));
  if (!sheetUp.reached) return notExecutable(expected, 'la hoja de acciones de PRG-001 no se abrió tras el clic: la pantalla no se alcanzó');
  const remove = sheet.getByRole('button', { name: 'Eliminar', exact: true });
  const reason = page.getByTestId(MOVIL_PROGRAMS_DYNAMIC_TESTIDS.ACTION_REASON('delete'));
  return conclude([await controlCheck(remove, reason, 'Eliminar', want)], { evidence: EXPO_EVIDENCE });
};

// --- Esquema 2: aprobar un requisito en borrador -------------------------------------------------------------------------

const approveDraft: BrowserRowHandler = async (row, { page }) => {
  const expected = cell(row, 'estado');
  const want = parseWant(expected, REASON_APPROVE);
  await resetAlumno01();
  const login = await loginMobile(page, strict('rol', ROLE_LOGIN, cell(row, 'rol')));
  if (login) return blocked(expected, login);
  const opened = await interact([
    ['abrir /programs/PRG-002/requirements', () => page.goto('/programs/PRG-002/requirements', { timeout: CEILING_MS })],
    ['abrir el detalle de REQ-017', () => page.getByRole('button', { name: 'Abrir detalle de REQ-017', exact: true }).click(ACTION)],
  ]);
  if (opened) return blocked(expected, opened);
  const sheet = page.getByRole('dialog', { name: 'Detalle del requisito', exact: true });
  const sheetUp = await waitUntil(() => isVisible(sheet));
  if (!sheetUp.reached) return notExecutable(expected, 'el detalle de REQ-017 no se abrió tras el clic: la pantalla no se alcanzó');
  const approve = sheet.getByRole('button', { name: 'Aprobar', exact: true });
  const reason = page.getByTestId(MOVIL_REQUIREMENTS_DYNAMIC_TESTIDS.TRANSITION_REASON('approved'));
  return conclude([await controlCheck(approve, reason, 'Aprobar', want)], { evidence: EXPO_EVIDENCE });
};

// --- Esquema 3: registrar una ejecución de TC-001 -------------------------------------------------------------------------

const runForm: BrowserRowHandler = async (row, { page }) => {
  const expected = cell(row, 'estado');
  const want = parseWant(expected, REASON_RUN);
  await resetAlumno01();
  const login = await loginMobile(page, strict('rol', ROLE_LOGIN, cell(row, 'rol')));
  if (login) return blocked(expected, login);
  const opened = await interact([['abrir /verification/TC-001', () => page.goto('/verification/TC-001', { timeout: CEILING_MS })]]);
  if (opened) return blocked(expected, opened);
  const screen = await screenMarker(page, 'TC-001', expected, '/verification/TC-001');
  if (screen) return screen;
  const submit = page.getByRole('button', { name: 'Registrar ejecución', exact: true });
  const reason = page.getByTestId(VERIFICACION_TESTIDS.RUN_DENIED);
  return conclude([await controlCheck(submit, reason, 'Registrar ejecución', want)], { evidence: EXPO_EVIDENCE });
};

// --- Esquema 4: publicar una versión de DOC-001 ----------------------------------------------------------------------------

const publishVersion: BrowserRowHandler = async (row, { page }) => {
  const expected = cell(row, 'estado');
  const want = parseWant(expected, REASON_PUBLISH);
  await resetAlumno01();
  const login = await loginMobile(page, strict('rol', ROLE_LOGIN, cell(row, 'rol')));
  if (login) return blocked(expected, login);
  const opened = await interact([['abrir /documents/DOC-001', () => page.goto('/documents/DOC-001', { timeout: CEILING_MS })]]);
  if (opened) return blocked(expected, opened);
  const screen = await screenMarker(page, 'DOC-001', expected, '/documents/DOC-001');
  if (screen) return screen;
  const publish = page.getByRole('button', { name: 'Publicar nueva versión', exact: true });
  const reason = page.getByTestId(MOVIL_DOCUMENTS_TESTIDS.PUBLISH_REASON);
  return conclude([await controlCheck(publish, reason, 'Publicar nueva versión', want)], { evidence: EXPO_EVIDENCE });
};

// --- Esquema 5: mover NC-003 a «Cerrada» ----------------------------------------------------------------------------------

const closeNc: BrowserRowHandler = async (row, { page }) => {
  const expected = cell(row, 'estado');
  const want = parseWant(expected, REASON_CLOSE);
  await resetAlumno01();
  const login = await loginMobile(page, strict('rol', ROLE_LOGIN, cell(row, 'rol')));
  if (login) return blocked(expected, login);
  const opened = await interact([
    ['abrir /nc', () => page.goto('/nc', { timeout: CEILING_MS })],
    ['abrir la tarjeta NC-003', () => page.getByRole('button', { name: 'Abrir NC-003', exact: true }).click(ACTION)],
  ]);
  if (opened) return blocked(expected, opened);
  const sheet = page.getByRole('dialog', { name: 'Detalle de NC-003', exact: true });
  const sheetUp = await waitUntil(() => isVisible(sheet));
  if (!sheetUp.reached) return notExecutable(expected, 'el detalle de NC-003 no se abrió tras el clic: la pantalla no se alcanzó');
  const toClosed = sheet.getByRole('button', { name: 'Mover a «Cerrada»', exact: true });
  // El motivo de la sección de transiciones es uno solo, el de la primera opción denegada
  const reason = page.getByTestId(MOVIL_NC_TESTIDS.TRANSITION_REASON);
  return conclude([await controlCheck(toClosed, reason, 'Mover a «Cerrada»', want)], { evidence: EXPO_EVIDENCE });
};

// --- Esquema 6: eliminar un hito del programa ------------------------------------------------------------------------------

const deleteMilestone: BrowserRowHandler = async (row, { page }) => {
  const expected = cell(row, 'estado');
  const want = parseWant(expected, REASON_MILESTONE);
  await resetAlumno01();
  const login = await loginMobile(page, strict('rol', ROLE_LOGIN, cell(row, 'rol')));
  if (login) return blocked(expected, login);
  const opened = await interact([
    ['abrir PRG-001', () => page.goto('/programs/PRG-001', { timeout: CEILING_MS })],
    ['abrir la sección de hitos', () => page.getByRole('radio', { name: 'Hitos', exact: true }).click(ACTION)],
  ]);
  if (opened) return blocked(expected, opened);
  // El hito PRG-001-M01 se muestra con su nombre del seed («SRR»): el ⋯ se localiza por ese nombre o por su id de prueba
  const menu = page.getByRole('button', { name: 'Acciones para el hito SRR', exact: true }).or(page.getByTestId(HITOS_DYNAMIC_TESTIDS.MILESTONE_ROW_MENU('PRG-001-M01')));
  const menuUp = await waitUntil(() => isVisible(menu));
  if (!menuUp.reached) return notExecutable(expected, 'el ⋯ del hito PRG-001-M01 no aparece en la sección de hitos: la pantalla no se alcanzó');
  const clicked = await interact([['abrir las acciones del hito PRG-001-M01', () => menu.click(ACTION)]]);
  if (clicked) return blocked(expected, clicked);
  const sheet = page.getByRole('dialog');
  const sheetUp = await waitUntil(() => isVisible(sheet));
  if (!sheetUp.reached) return notExecutable(expected, 'la hoja de acciones del hito PRG-001-M01 no se abrió tras el clic: la pantalla no se alcanzó');
  const remove = sheet.getByRole('button', { name: 'Eliminar', exact: true }).or(page.getByTestId(HITOS_TESTIDS.MILESTONE_MENU_DELETE));
  const reason = page.getByTestId(MOVIL_PROGRAMS_DYNAMIC_TESTIDS.ACTION_REASON('milestone-delete'));
  return conclude([await controlCheck(remove, reason, 'Eliminar', want)], { evidence: EXPO_EVIDENCE });
};

// --- Esquemas 7 y 8: accesos de la pestaña Más (Auditoría y Administración) -------------------------------------------------

const MORE_ENTRY = /^(aparece|no aparece) «(.+)»$/;

/** Abre la pestaña «Más» y comprueba la entrada de la clave. */
const moreTab = (page: Page): Locator => page.getByTestId(PROGRAMAS_DYNAMIC_TESTIDS.MOBILE_TAB('more')).or(page.getByRole('tab', { name: 'Más', exact: true }));

const moreRow = (key: 'audit' | 'admin', forbiddenTestId: string, pageTestId: string, label: string): BrowserRowHandler => {
  return async (row, { page }) => {
    const menu = MORE_ENTRY.exec(cell(row, 'menu'));
    if (!menu || menu[2] !== label) throw new Error(`celda sin interpretación: menú «${cell(row, 'menu')}» para «${label}»`);
    const wantShown = menu[1] === 'aparece';
    const view = cell(row, 'vista');
    const expected = `${cell(row, 'menu')}; ${view}`;
    await resetAlumno01();
    const login = await loginMobile(page, strict('rol', ROLE_LOGIN, cell(row, 'rol')));
    if (login) return blocked(expected, login);
    const tabOpened = await interact([['abrir la pestaña «Más»', () => moreTab(page).first().click(ACTION)]]);
    if (tabOpened) return blocked(expected, tabOpened);
    // Antes de mirar las entradas, la página «Más» debe estar montada
    const moreUp = await waitUntil(() => isVisible(page.getByTestId(MOVIL_TESTIDS.MORE_PAGE)));
    if (!moreUp.reached) return notExecutable(expected, 'la página «Más» no se abrió tras pulsar la pestaña: la pantalla no se alcanzó');
    const entry = page.getByTestId(MOVIL_DYNAMIC_TESTIDS.MORE_ITEM(key)).or(page.getByRole('link', { name: label, exact: true }));
    const shown = await isVisible(entry);
    const checks: Check[] = [check(shown === wantShown, cell(row, 'menu'), `«${label}» ${shown ? 'aparece' : 'no aparece'} en la pestaña Más`)];
    if (shown) {
      const followed = await interact([[`abrir «${label}» desde Más`, () => entry.first().click(ACTION)]]);
      if (followed) return blocked(expected, followed);
    } else {
      // Sin entrada no hay forma de llegar desde Más: la página se abre por su dirección para ver lo que muestra
      const direct = await interact([[`abrir la dirección de «${label}»`, () => page.goto(`/${key === 'audit' ? 'audit' : 'admin'}`, { timeout: CEILING_MS })]]);
      if (direct) return blocked(expected, direct);
    }
    if (view === 'el registro de auditoría' || view === 'la pantalla de administración del tenant') {
      const landed = await waitUntil(() => isVisible(page.getByTestId(pageTestId)));
      checks.push(check(landed.reached, view, landed.reached ? view : `no se ve ${view} (ruta ${pathOf(page)})`));
      return conclude(checks, { evidence: EXPO_EVIDENCE });
    }
    const alert = page.getByTestId(forbiddenTestId);
    const shownAlert = await waitUntil(() => isVisible(alert));
    checks.push(check(shownAlert.reached, 'el aviso de permiso denegado', shownAlert.reached ? 'se ve el aviso de permiso denegado' : `no se ve el aviso (ruta ${pathOf(page)})`));
    for (const text of Array.from(view.matchAll(/«([^»]+)»/g), (match) => match[1] ?? '')) {
      const seen = await isVisible(alert.getByText(text, { exact: true }));
      checks.push(check(seen, `el aviso muestra «${text}»`, seen ? `muestra «${text}»` : `no muestra «${text}»`));
    }
    return conclude(checks, { evidence: EXPO_EVIDENCE });
  };
};

const auditMore = moreRow('audit', AUDITORIA_TESTIDS.AUDIT_FORBIDDEN, AUDITORIA_TESTIDS.AUDIT_PAGE, 'Auditoría');
const adminMore = moreRow('admin', ADMIN_TESTIDS.ADMIN_FORBIDDEN, ADMIN_TESTIDS.ADMIN_PAGE, 'Administración');

defineBrowserRows({
  story: 'US-MULTITENANT-PERMISOS-009',
  surface: 'expo-web',
  tenants: ['alumno01'],
  handlers: new Map<number, BrowserRowHandler>([
    [1, deleteFromList],
    [2, approveDraft],
    [3, runForm],
    [4, publishVersion],
    [5, closeNc],
    [6, deleteMilestone],
    [7, auditMore],
    [8, adminMore],
  ]),
});
