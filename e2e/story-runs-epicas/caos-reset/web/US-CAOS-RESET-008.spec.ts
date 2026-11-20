import { LAB_TESTIDS } from '../../../../packages/shared/src/testids';
import { DEMO, TENANT_A, TENANT_B, type Credentials } from '../../../story-runs/support/prepare';
import { ACTION, CEILING_MS, holdsFor, isVisible, pathOf, quoted, textOf, waitUntil } from '../../support/browser';
import { cell, check, preparationFailedWeb, strict } from '../../support/checks';
import { defineBrowserRows, type BrowserRowHandler } from '../../core/framework';
import { prepareTenant } from '../api/common';
import { actionFailed, armToasts, credentialRows, describeLog, interact, onWeb, prepareBrowser, rowOutcome, signInWeb, textCheck, toastCheck, waitForValue, waitToast } from './common';

// US-CAOS-RESET-008 — Credenciales de demo y tenant de trabajo en /lab (web). Cada fila reinicia alumno01 y alumno02 con su
// administrador y deja el caos apagado; la fila empieza sin sesión salvo que la historia diga otra cosa.

/** Tenant de trabajo que elige la fila (Esquemas 2 y 3): solo alumno02 aparece en la tabla. */
const WORK_TENANTS: ReadonlyMap<string, string> = new Map<string, string>([['alumno02', TENANT_B]]);
/** Correo de alumno que muestra la línea de su tenant (Esquema 2). */
const STUDENT_EMAILS: ReadonlyMap<string, string> = new Map<string, string>([['alumno02@sigpro.lab', 'alumno02@sigpro.lab']]);
/** Cuentas que inician sesión antes de abrir /lab (Esquema 3). */
const SESSION_ACCOUNTS: ReadonlyMap<string, Credentials> = new Map<string, Credentials>([
  ['gestor@sigpro.test', DEMO.gestor],
  ['consultor@sigpro.test', DEMO.consultor],
]);

/** Todas las filas de la tabla de credenciales llevan la contraseña del seed (Esquema 1). */
const CONTRASENA_ALUMNO = 'Alumno1234!';

// --- Esquema 1: la tabla de credenciales muestra cada usuario de demostración con su nota ------------------------------------

const credentialsShown: BrowserRowHandler = async (row, { page }) => {
  const name = cell(row, 'nombre');
  const email = cell(row, 'correo');
  const password = cell(row, 'contraseña');
  const role = cell(row, 'rol');
  const note = quoted(cell(row, 'nota'));
  const expected = `ve la fila de ${name} con el correo ${email}, la contraseña ${password}, el rol ${role} y la nota ${note}`;
  await prepareTenant(TENANT_A);
  await prepareBrowser(page);
  await page.goto(`/lab?tenant=${TENANT_A}`, { timeout: CEILING_MS });
  // La tabla llega de la API: se espera (con techo) a que aparezca la fila antes de juzgar
  await waitUntil(async () => (await credentialRows(page)).some((cells) => cells[0] === name));
  const rows = await credentialRows(page);
  const found = rows.find((cells) => cells[0] === name);
  const wanted = [name, email, password, role, note];
  const same = found !== undefined && wanted.every((text, index) => found[index] === text);
  return rowOutcome(
    [check(same, expected, found === undefined ? `no hay fila de ${name} (filas leídas: ${rows.length})` : `fila: ${found.join(' · ')}`)],
    { evidence: { filasLeidas: rows.length } },
  );
};

// --- Esquema 2: elegir el tenant de trabajo cambia el aviso y la línea de alumno ----------------------------------------------

const workTenantSwitch: BrowserRowHandler = async (row, { page }) => {
  const tenant = strict('tenant', WORK_TENANTS, cell(row, 'tenant'));
  const email = strict('correo', STUDENT_EMAILS, cell(row, 'correo'));
  const toastText = `Tenant activo: ${tenant}`;
  const expected = `aviso informativo «${toastText}»; la línea de alumno muestra ${email} con la contraseña ${CONTRASENA_ALUMNO}; la línea «Tenant activo» de la cabecera muestra ${toastText}`;
  await prepareTenant(TENANT_A);
  await prepareTenant(TENANT_B);
  await prepareBrowser(page);
  await page.goto(`/lab?tenant=${TENANT_A}`, { timeout: CEILING_MS });
  const select = page.getByRole('combobox', { name: 'Tenant de trabajo', exact: true });
  const use = page.getByRole('button', { name: 'Usar este tenant', exact: true });
  await waitUntil(() => isVisible(use));
  const picked = await interact(select, `elegir ${tenant} en «Tenant de trabajo»`, (element) => element.selectOption({ label: tenant }, ACTION));
  if (picked) return actionFailed(expected, picked);
  await armToasts(page);
  const pressed = await interact(use, 'pulsar «Usar este tenant»', (element) => element.click(ACTION));
  if (pressed) return actionFailed(expected, pressed);
  const toast = await toastCheck(page, 'info', toastText);
  const header = await waitForValue(() => textOf(page.getByTestId(LAB_TESTIDS.LAB_TENANT_INFO)), (value) => value === toastText);
  const line = await waitForValue(() => textOf(page.getByTestId(LAB_TESTIDS.LAB_STUDENT_USER)), (value) => value !== undefined && value.includes(email));
  // El correo se lee del texto visible de la línea; la contraseña debe aparecer en esa misma línea
  const shownEmail = /([^\s:·]+@[^\s·]+)/.exec(line ?? '')?.[1];
  const shownPassword = (line ?? '').includes(CONTRASENA_ALUMNO);
  // Regla de la historia: la línea empieza por «Tu usuario de alumno:» y va seguida de la ayuda de la cuenta de alumno
  const hint = 'Administrador de tu tenant y sin MFA. Es la cuenta con la que el proyecto de ejemplo reinicia tus datos.';
  return rowOutcome([
    toast,
    textCheck(header, toastText, 'la línea «Tenant activo» de la cabecera'),
    check(
      shownEmail === email && shownPassword,
      `la línea de alumno muestra ${email} con la contraseña ${CONTRASENA_ALUMNO}`,
      line === undefined ? 'la línea de alumno (no legible)' : `la línea de alumno muestra ${shownEmail ?? '(sin correo)'} ${shownPassword ? 'con' : 'sin'} la contraseña ${CONTRASENA_ALUMNO}`,
    ),
    check(
      (line ?? '').startsWith('Tu usuario de alumno:'),
      'la línea empieza por «Tu usuario de alumno:»',
      line === undefined ? 'la línea (no legible)' : `la línea empieza por «${line.slice(0, 22)}»`,
    ),
    check((line ?? '').includes(hint), `la ayuda «${hint}»`, (line ?? '').includes(hint) ? `la ayuda «${hint}»` : 'no aparece la ayuda de la cuenta de alumno'),
  ]);
};

// --- Esquema 3: elegir otro tenant con una sesión iniciada cierra la sesión ---------------------------------------------------

const workTenantSwitchEndsSession: BrowserRowHandler = async (row, { page }) => {
  const account = strict('cuenta', SESSION_ACCOUNTS, cell(row, 'cuenta'));
  const toastText = 'Tenant activo: alumno02';
  const expected = `aviso informativo «${toastText}» y llega a /login sin sesión iniciada`;
  await prepareTenant(TENANT_A);
  await prepareTenant(TENANT_B);
  await prepareBrowser(page);
  const login = await signInWeb(page, account);
  if (login) return preparationFailedWeb(expected, `${cell(row, 'cuenta')} no inicia sesión en alumno01: ${login}`);
  await page.goto('/lab', { timeout: CEILING_MS });
  const select = page.getByRole('combobox', { name: 'Tenant de trabajo', exact: true });
  const use = page.getByRole('button', { name: 'Usar este tenant', exact: true });
  await waitUntil(() => isVisible(use));
  const picked = await interact(select, 'elegir alumno02 en «Tenant de trabajo»', (element) => element.selectOption({ label: 'alumno02' }, ACTION));
  if (picked) return actionFailed(expected, picked);
  await armToasts(page);
  const pressed = await interact(use, 'pulsar «Usar este tenant»', (element) => element.click(ACTION));
  if (pressed) return actionFailed(expected, pressed);
  const toast = await toastCheck(page, 'info', toastText);
  const atLogin = await waitUntil(async () => pathOf(page) === '/login' && (await isVisible(page.getByRole('button', { name: 'Entrar', exact: true }))));
  // «Sin sesión»: abrir /programs desde aquí debe acabar en /login y quedarse ahí
  await page.goto('/programs', { timeout: CEILING_MS });
  const entrar = page.getByRole('button', { name: 'Entrar', exact: true });
  await waitUntil(() => isVisible(entrar));
  const stays = await holdsFor(() => isVisible(entrar));
  const logs = await waitToast(page, 'info', toastText);
  return rowOutcome([
    toast,
    check(atLogin.reached, 'llega a /login', atLogin.reached ? 'llega a /login' : `no llega a /login (ruta ${pathOf(page)})`),
    check(stays.held, 'sin sesión iniciada: abrir /programs acaba en /login y se queda ahí', stays.held ? 'sin sesión: abrir /programs acaba en /login' : `con sesión: abrir /programs muestra ${pathOf(page)}`),
  ], { evidence: { avisos: describeLog(logs.log) } });
};

defineBrowserRows({
  story: 'US-CAOS-RESET-008',
  surface: 'web',
  tenants: [TENANT_A, TENANT_B],
  handlers: new Map<number, BrowserRowHandler>([
    [1, onWeb(credentialsShown, [TENANT_A, TENANT_B])],
    [2, onWeb(workTenantSwitch, [TENANT_A, TENANT_B])],
    [3, onWeb(workTenantSwitchEndsSession, [TENANT_A, TENANT_B])],
  ]),
});
