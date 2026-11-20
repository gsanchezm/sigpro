import type { Page } from '@playwright/test';
import { DEMO, TENANT_A, type Credentials } from '../../../story-runs/support/prepare';
import { ACTION, CEILING_MS, isVisible, quoted, safe, waitUntil } from '../../support/browser';
import { cell, check, preparationFailedWeb, strict } from '../../support/checks';
import { defineBrowserRows, type BrowserRowHandler } from '../../core/framework';
import { markerKept, markerProgram, prepareTenant, studentAdmin, withToken } from '../api/common';
import { actionFailed, armToasts, controlCheck, describeLog, interact, noOkToast, onWeb, prepareBrowser, rowOutcome, signInWeb, TOOLTIP_NOTE, waitToast } from './common';

// US-CAOS-RESET-009 — Reiniciar los datos del tenant desde /lab y desde Administración (web). Los diálogos son los NATIVOS del navegador
// (`confirm()`): se registran con `page.once('dialog')` antes de cada clic y se aceptan o cancelan según la fila.

/** Pantalla de cada Esquema: la ruta y el texto exacto del diálogo nativo de confirmación. */
interface Screen {
  readonly path: string;
  readonly confirm: string;
}
const SCREENS: ReadonlyMap<string, Screen> = new Map<string, Screen>([
  ['/lab', { path: '/lab', confirm: '¿Reiniciar todos los datos del tenant al estado inicial del seed?' }],
  ['/admin?tab=data', { path: '/admin?tab=data', confirm: '¿Restaurar los datos del tenant al estado inicial? Se perderán los cambios que hayas hecho.' }],
]);

/** Quién mira el botón de /lab: nadie (sin sesión) o gestor@sigpro.test con sesión iniciada (Esquema 3). */
const WHO: ReadonlyMap<string, Credentials | undefined> = new Map<string, Credentials | undefined>([
  ['una persona sin sesión iniciada', undefined],
  ['gestor@sigpro.test con sesión iniciada', DEMO.gestor],
]);

const MOTIVE_NO_ADMIN = 'Inicia sesión como admin para reiniciar el tenant.';

/** Sesión de administración de alumno01 y apertura de la pantalla del Esquema. Devuelve el motivo si no se puede. */
const openAsAdmin = async (page: Page, screen: Screen): Promise<string | undefined> => {
  const login = await signInWeb(page, studentAdmin(TENANT_A));
  if (login) return `alumno01@sigpro.lab no inicia sesión: ${login}`;
  await page.goto(screen.path, { timeout: CEILING_MS });
  return undefined;
};

// --- Esquema 1: aceptar el diálogo reinicia el tenant y lo confirma con un aviso ---------------------------------------------

const acceptedDialogRestores: BrowserRowHandler = async (row, { page }) => {
  const screen = strict('pantalla', SCREENS, cell(row, 'pantalla'));
  const button = quoted(cell(row, 'boton'));
  const aviso = quoted(cell(row, 'aviso'));
  const expected = `pulsa «${button}», acepta el diálogo «${screen.confirm}» y ve el aviso ok «${aviso}» con el tenant alumno01 y los milisegundos del reinicio en el cuerpo`;
  await prepareTenant(TENANT_A);
  // Marca de datos: el reinicio debe borrar el programa dado de alta antes de aceptar el diálogo
  const marker = await markerProgram(TENANT_A);
  if (marker.token === undefined || marker.code === undefined) return preparationFailedWeb(expected, marker.error ?? 'sin marca de datos');
  await prepareBrowser(page);
  const opened = await openAsAdmin(page, screen);
  if (opened) return preparationFailedWeb(expected, opened);
  const target = page.getByRole('button', { name: button, exact: true });
  await waitUntil(() => isVisible(target));
  const dialog: { message?: string } = {};
  page.once('dialog', (open) => {
    dialog.message = open.message();
    void open.accept().catch(() => undefined);
  });
  await armToasts(page);
  const clicked = await interact(target, `pulsar «${button}»`, (element) => element.click(ACTION));
  if (clicked) return actionFailed(expected, clicked);
  await waitUntil(async () => dialog.message !== undefined);
  const toast = await waitToast(page, 'ok', aviso);
  const body = toast.found?.body;
  // El aviso llega cuando la API ya ha reiniciado: el programa de la marca debe haber desaparecido
  const gone = await withToken('GET', `/programs/${marker.code}`, TENANT_A, marker.token);
  return rowOutcome([
    check(dialog.message === screen.confirm, `el diálogo de confirmación dice «${screen.confirm}»`, `el diálogo dice «${dialog.message ?? '(no apareció)'}»`),
    check(toast.found !== undefined, `aviso ok «${aviso}»`, describeLog(toast.log)),
    check(
      body !== undefined && /alumno01/.test(body) && /\d+ ms/.test(body),
      'con el tenant alumno01 y los milisegundos del reinicio en el cuerpo',
      `cuerpo del aviso «${body ?? '(sin aviso)'}»`,
    ),
    check(gone.status !== 200, `el programa ${marker.code} dado de alta antes desaparece (el reinicio borra lo creado en la prueba)`, `GET /api/programs/${marker.code} responde ${gone.status}`),
  ]);
};

// --- Esquema 2: cancelar el diálogo no reinicia nada -------------------------------------------------------------------------

const cancelledDialogDoesNothing: BrowserRowHandler = async (row, { page }) => {
  const screen = strict('pantalla', SCREENS, cell(row, 'pantalla'));
  const button = quoted(cell(row, 'boton'));
  const expected = `pulsa «${button}», cancela el diálogo «${screen.confirm}», no aparece ningún aviso de éxito, el botón vuelve a estar disponible y los datos no cambian`;
  await prepareTenant(TENANT_A);
  // Marca de datos: si el reinicio se ejecutara, el programa dado de alta desaparecería
  const marker = await markerProgram(TENANT_A);
  if (marker.token === undefined || marker.code === undefined) return preparationFailedWeb(expected, marker.error ?? 'sin marca de datos');
  await prepareBrowser(page);
  const opened = await openAsAdmin(page, screen);
  if (opened) return preparationFailedWeb(expected, opened);
  const target = page.getByRole('button', { name: button, exact: true });
  await waitUntil(() => isVisible(target));
  const dialog: { message?: string; dismissed?: boolean } = {};
  page.once('dialog', (open) => {
    dialog.message = open.message();
    dialog.dismissed = true;
    void open.dismiss().catch(() => undefined);
  });
  await armToasts(page);
  const clicked = await interact(target, `pulsar «${button}»`, (element) => element.click(ACTION));
  if (clicked) return actionFailed(expected, clicked);
  // Se espera a que el diálogo se haya cerrado (la acción tuvo efecto) antes de mirar la ausencia de avisos
  await waitUntil(async () => dialog.dismissed === true);
  const quiet = await noOkToast(page, Date.now());
  const available = await controlCheck(target, `el botón «${button}»`, 'habilitado');
  const kept = await markerKept(TENANT_A, marker.token, marker.code);
  return rowOutcome([
    check(dialog.message === screen.confirm, `el diálogo de confirmación dice «${screen.confirm}»`, `el diálogo dice «${dialog.message ?? '(no apareció)'}»`),
    check(quiet.held === true, 'no aparece ningún aviso de éxito', quiet.held === true ? 'no aparece ningún aviso de éxito' : quiet.held === undefined ? 'registro de avisos no legible (no cumple)' : `aparece el aviso ok ${quiet.seen}`),
    available,
    kept,
  ]);
};

// --- Esquema 3: sin sesión de admin el botón de /lab no se puede pulsar --------------------------------------------------------

const labButtonNeedsAdmin: BrowserRowHandler = async (row, { page }) => {
  const who = strict('sesion', WHO, cell(row, 'sesion'));
  const expected = `el botón «Reiniciar datos» está deshabilitado, con el motivo «${MOTIVE_NO_ADMIN}», y no se puede pulsar`;
  await prepareTenant(TENANT_A);
  await prepareBrowser(page);
  if (who !== undefined) {
    const login = await signInWeb(page, who);
    if (login) return preparationFailedWeb(expected, `${cell(row, 'sesion')}: ${login}`);
  }
  await page.goto(`/lab?tenant=${TENANT_A}`, { timeout: CEILING_MS });
  await waitUntil(() => isVisible(page.getByRole('heading', { name: 'Laboratorio', exact: true })));
  const button = page.getByRole('button', { name: 'Reiniciar datos', exact: true });
  const shown = await controlCheck(button, 'el botón «Reiniciar datos»', 'deshabilitado', MOTIVE_NO_ADMIN);
  // «No se puede pulsar»: un intento de clic no abre el diálogo de confirmación
  const dialog = { opened: false };
  page.once('dialog', (open) => {
    dialog.opened = true;
    void open.dismiss().catch(() => undefined);
  });
  const attempted = await safe(() => button.click({ timeout: 1_000 }).then(() => true), false);
  const notPressed = check(!dialog.opened && !attempted, 'el clic no abre ningún diálogo de confirmación', attempted ? 'el clic se realizó' : `el clic no se realizó; ${dialog.opened ? 'se abrió un diálogo' : 'no se abrió diálogo'}`);
  return rowOutcome([shown, notPressed], { note: TOOLTIP_NOTE });
};

defineBrowserRows({
  story: 'US-CAOS-RESET-009',
  surface: 'web',
  tenants: [TENANT_A],
  handlers: new Map<number, BrowserRowHandler>([
    [1, onWeb(acceptedDialogRestores)],
    [2, onWeb(cancelledDialogDoesNothing)],
    [3, onWeb(labButtonNeedsAdmin)],
  ]),
});
