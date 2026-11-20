import type { Locator, Page } from '@playwright/test';
import { ADMIN_TESTIDS, MOVIL_ADMIN_TESTIDS } from '../../../../packages/shared/src/testids';
import { TENANT_A } from '../../../story-runs/support/prepare';
import { ACTION, CEILING_MS, isVisible, textOf, waitUntil } from '../../support/browser';
import { cell, check, preparationFailedWeb, strict, type Check } from '../../support/checks';
import { defineBrowserRows, type BrowserRowHandler, type Outcome } from '../../core/framework';
import { markerKept, markerProgram, prepareTenant, studentAdmin } from '../api/common';
import { armToasts, describeLog, interact, noOkToast, waitToast } from '../web/common';
import { adminPath, closedCheck, mobileOutcome, onMobile, prepareMobile, signInMobile } from './common';

// US-CAOS-RESET-014 — Restaurar los datos del tenant desde Administración (app móvil, Expo web a 390 px). El diálogo es el de la app
// (`role="dialog"`), no el `confirm()` nativo. Cada fila reinicia alumno01, abre la pestaña «Datos» y deja el caos apagado al terminar.

const RESET_TITLE = 'Restaurar datos del tenant';
const RESET_MESSAGE = '¿Restaurar los datos del tenant al estado inicial? Se perderán los cambios que hayas hecho.';
const HELP_CONCEPTS = ['seed determinista', 'modo caos se conserva'] as const;
const TENANT_LINE = 'Tenant: alumno01';

const dialogOf = (page: Page): Locator => page.getByTestId(MOVIL_ADMIN_TESTIDS.RESET_DIALOG);
const resetButton = (page: Page): Locator => page.getByTestId(ADMIN_TESTIDS.ADMIN_RESET);
const dataPanel = (page: Page): Locator => page.getByTestId(ADMIN_TESTIDS.ADMIN_DATA_PANEL);

/** Lo que se ve al abrir «Datos»: título, línea del tenant, texto de ayuda y los dos botones (Reglas de la pestaña). */
const dataTabChecks = async (page: Page): Promise<readonly Check[]> => {
  const title = page.getByRole('heading', { name: 'Datos del tenant', exact: true });
  const tenantLine = await textOf(page.getByTestId(MOVIL_ADMIN_TESTIDS.DATA_TENANT));
  const help = (await textOf(dataPanel(page))) ?? '';
  const infoButton = page.getByRole('button', { name: 'Información del tenant', exact: true });
  const titleShown = await isVisible(title);
  const infoShown = await isVisible(infoButton);
  const resetShown = await isVisible(resetButton(page));
  return [
    check(titleShown, 'el título «Datos del tenant»', titleShown ? 'el título «Datos del tenant»' : 'no aparece el título «Datos del tenant»'),
    check(tenantLine === TENANT_LINE, `la línea «${TENANT_LINE}»`, `la línea «${tenantLine ?? '(no legible)'}»`),
    check(
      HELP_CONCEPTS.every((concept) => help.includes(concept)),
      'el texto de ayuda dice que restaura el seed determinista del tenant y que se conserva el modo caos',
      HELP_CONCEPTS.every((concept) => help.includes(concept)) ? 'el texto de ayuda dice ambas cosas' : `el texto de ayuda no dice ambas cosas («${help.slice(0, 160)}»)`,
    ),
    check(infoShown, 'el botón «Información del tenant»', infoShown ? 'el botón «Información del tenant»' : 'no aparece el botón «Información del tenant»'),
    check(resetShown, `el botón «${RESET_TITLE}»`, resetShown ? `el botón «${RESET_TITLE}»` : `no aparece el botón «${RESET_TITLE}»`),
  ];
};

/** Lo que se ve en el diálogo de la app: título, texto y los dos botones (Reglas de la historia). */
const dialogChecks = async (page: Page): Promise<readonly Check[]> => {
  const dialog = dialogOf(page);
  const text = (await textOf(dialog)) ?? '';
  const lines = text.split('\n').map((line) => line.trim()).filter((line) => line !== '');
  const confirmShown = await isVisible(dialog.getByRole('button', { name: RESET_TITLE, exact: true }));
  const cancelShown = await isVisible(dialog.getByRole('button', { name: 'Cancelar', exact: true }));
  return [
    check(lines.includes(RESET_TITLE), `el diálogo con el título «${RESET_TITLE}»`, lines.length === 0 ? 'no aparece el diálogo' : `el diálogo dice ${lines.map((line) => `«${line}»`).join(' ')}`),
    check(lines.includes(RESET_MESSAGE), `el texto «${RESET_MESSAGE}»`, lines.includes(RESET_MESSAGE) ? `el texto «${RESET_MESSAGE}»` : 'no aparece el texto del diálogo'),
    check(confirmShown, `el botón «${RESET_TITLE}» del diálogo`, confirmShown ? `el botón «${RESET_TITLE}» del diálogo` : 'no aparece el botón de confirmar'),
    check(cancelShown, 'el botón «Cancelar»', cancelShown ? 'el botón «Cancelar»' : 'no aparece el botón «Cancelar»'),
  ];
};

/** Abre la pestaña «Datos» con la sesión de alumno01 y la espera. */
const openData = async (page: Page): Promise<void> => {
  await page.goto(adminPath('data'), { timeout: CEILING_MS });
  await waitUntil(() => isVisible(page.getByRole('heading', { name: 'Datos del tenant', exact: true })));
};

/** Resultado de una fila móvil que no pudo ejecutar su paso: el motivo queda en la comprobación. */
const stepFailed = (expected: string, reason: string): Outcome => mobileOutcome([check(false, expected, reason)]);

// --- Esquema 1: cancelar el diálogo no reinicia nada ----------------------------------------------------------------------------

const cancelDoesNothing: BrowserRowHandler = async (_row, { page }) => {
  const expected = `pulsa «${RESET_TITLE}» y después «Cancelar»: el diálogo se cierra, no aparece ningún aviso de éxito y los datos no cambian`;
  await prepareTenant(TENANT_A);
  // Marca de datos: si el reinicio se ejecutara, el programa dado de alta desaparecería
  const marker = await markerProgram(TENANT_A);
  if (marker.token === undefined || marker.code === undefined) return preparationFailedWeb(expected, marker.error ?? 'sin marca de datos');
  await prepareMobile(page);
  const account = studentAdmin(TENANT_A);
  const login = await signInMobile(page, account.email, account.password);
  if (login) return preparationFailedWeb(expected, `alumno01@sigpro.lab no inicia sesión en la app móvil: ${login}`);
  await openData(page);
  const dataChecks = await dataTabChecks(page);
  await armToasts(page);
  const opened = await interact(resetButton(page), `pulsar «${RESET_TITLE}»`, (element) => element.click(ACTION));
  if (opened) return stepFailed(expected, `no se pudo pulsar «${RESET_TITLE}»: ${opened.message}`);
  await waitUntil(() => isVisible(dialogOf(page)));
  const shown = await dialogChecks(page);
  const cancelled = await interact(dialogOf(page).getByRole('button', { name: 'Cancelar', exact: true }), 'pulsar «Cancelar» del diálogo', (element) => element.click(ACTION));
  if (cancelled) return stepFailed(expected, `no se pudo pulsar «Cancelar»: ${cancelled.message}`);
  const closed = await closedCheck(dialogOf(page), 'el diálogo');
  const quiet = await noOkToast(page, Date.now());
  const kept = await markerKept(TENANT_A, marker.token, marker.code);
  return mobileOutcome([
    ...dataChecks,
    ...shown,
    closed,
    check(quiet.held, 'no aparece ningún aviso de éxito', quiet.held ? 'no aparece ningún aviso de éxito' : `aparece el aviso ok ${quiet.seen}`),
    kept,
  ]);
};

// --- Esquema 2: confirmar el diálogo reinicia el tenant y lo confirma con un aviso ----------------------------------------

const confirmRestores: BrowserRowHandler = async (row, { page }) => {
  const tenant = strict('tenant', new Map([['alumno01', TENANT_A]]), cell(row, 'tenant'));
  const expected = `pulsa «${RESET_TITLE}», confirma con el botón «${RESET_TITLE}» del diálogo: el diálogo se cierra y aparece el aviso ok «Datos restaurados» con el tenant ${tenant} y los milisegundos del reinicio en el cuerpo`;
  await prepareTenant(TENANT_A);
  await prepareMobile(page);
  const account = studentAdmin(TENANT_A);
  const login = await signInMobile(page, account.email, account.password);
  if (login) return preparationFailedWeb(expected, `alumno01@sigpro.lab no inicia sesión en la app móvil: ${login}`);
  await openData(page);
  const dataChecks = await dataTabChecks(page);
  await armToasts(page);
  const opened = await interact(resetButton(page), `pulsar «${RESET_TITLE}»`, (element) => element.click(ACTION));
  if (opened) return stepFailed(expected, `no se pudo pulsar «${RESET_TITLE}»: ${opened.message}`);
  await waitUntil(() => isVisible(dialogOf(page)));
  const shown = await dialogChecks(page);
  const confirmed = await interact(dialogOf(page).getByRole('button', { name: RESET_TITLE, exact: true }), `pulsar «${RESET_TITLE}» del diálogo`, (element) => element.click(ACTION));
  if (confirmed) return stepFailed(expected, `no se pudo confirmar el diálogo: ${confirmed.message}`);
  const closed = await closedCheck(dialogOf(page), 'el diálogo');
  const toast = await waitToast(page, 'ok', 'Datos restaurados');
  const body = toast.found?.body ?? '';
  return mobileOutcome([
    ...dataChecks,
    ...shown,
    closed,
    check(toast.found !== undefined, 'aviso ok «Datos restaurados»', toast.found === undefined ? describeLog(toast.log) : 'aviso ok «Datos restaurados»'),
    check(body.includes(tenant) && /\d+ ms/.test(body), `con el tenant ${tenant} y los milisegundos del reinicio en el cuerpo`, `cuerpo del aviso «${body === '' ? '(sin aviso)' : body}»`),
  ]);
};

defineBrowserRows({
  story: 'US-CAOS-RESET-014',
  surface: 'expo-web',
  tenants: [TENANT_A],
  handlers: new Map<number, BrowserRowHandler>([
    [1, onMobile(cancelDoesNothing)],
    [2, onMobile(confirmRestores)],
  ]),
});

