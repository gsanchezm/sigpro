import type { Locator, Page } from '@playwright/test';
import { DEMO, TENANT_A } from '../../../story-runs/support/prepare';
import { ACTION, CEILING_MS, attrOf, isDisabled, quoted, safe, waitUntil, type Step } from '../../support/browser';
import { check, cell, conclude, strict, type Check } from '../../support/checks';
import { defineBrowserRows, notExecutable, type BrowserRowHandler } from '../../core/framework';
import {
  ALUMNO_ADMIN,
  COOKIE_NOTE,
  PASSWORDS,
  browserOf,
  delayPost,
  enterButton,
  failedAction,
  heading1,
  isBlockingReason,
  MOBILE_URL,
  openLogin,
  phoneContext,
  prepFailed,
  quietCookies,
  reachable,
  resetAlumno,
  settle,
  signInToPrograms,
  submitLogin,
  typeCredentials,
  runStepsLogged,
} from './common';
import { MOBILE_NOTE, expoNotRunning, mobileButton, mobileField, mobileSignInSteps } from './mobile';

// US-A11Y-003 — Botones deshabilitados con el motivo a la vista (web de 1440 px y, en las filas de la app móvil, Expo web a 390 px).
// Preparación de cada fila: reinicio de alumno01; cada fila inicia la sesión de su cuenta en un navegador sin sesión guardada.
// Un botón de la web se lee por su `disabled` y su motivo por el `title` que escribe al pasar el puntero (la tooltip nativa no es
// observable en el DOM). En la app móvil el botón se lee por `aria-disabled` y el motivo como texto visible.

const CREATE_DENIED = 'Tu rol no permite crear programas';
const EXPORT_EMPTY = 'No hay programas para exportar';
const CODE_INCOMPLETE = 'Introduce los 6 dígitos del código';
const RUN_DENIED = 'Tu rol no permite registrar ejecuciones';
const PROCESSING = 'Procesando…';

const WEB_NOTE = `${COOKIE_NOTE} El motivo de la web se lee en el atributo title del botón.`;
/** Lo que la app móvil escribe cuando el botón está deshabilitado: el nombre del campo, no la frase de la historia. */
const PHONE_REASON_NOTE = 'La app móvil no tiene `title`: su motivo va en el atributo de descripción del botón. Se compara lo que se ve como texto.';

/** Cuentas de las filas (la contraseña sale del seed por su correo). */
const ACCOUNTS: ReadonlyMap<string, { readonly email: string; readonly password: string }> = new Map<string, { readonly email: string; readonly password: string }>([
  [DEMO.consultor.email, DEMO.consultor],
  [DEMO.auditor.email, DEMO.auditor],
  [DEMO.gestor.email, DEMO.gestor],
  [DEMO.admin.email, DEMO.admin],
  [ALUMNO_ADMIN.email, ALUMNO_ADMIN],
]);

/** Estado de un botón según la celda «boton» o «estado»: `true` = deshabilitado. */
const BUTTON_STATE: ReadonlyMap<string, boolean> = new Map<string, boolean>([
  ['deshabilitado', true],
  ['habilitado', false],
]);

const WAITS: ReadonlyMap<string, number> = new Map([
  ['1 segundo', 1_000],
  ['3 segundos', 3_000],
]);

/** Motivo que espera cada celda «motivo» (`undefined` = no debe haber motivo de bloqueo). */
const MOTIVOS: ReadonlyMap<string, string | undefined> = new Map<string, string | undefined>([
  ['se ve el motivo «No hay programas para exportar»', EXPORT_EMPTY],
  ['se ve el motivo «Introduce los 6 dígitos del código»', CODE_INCOMPLETE],
  ['se ve el motivo «Tu rol no permite registrar ejecuciones»', RUN_DENIED],
  ['no aparece ningún motivo que explique un bloqueo', undefined],
]);

/** Pasar el puntero sobre un control (la tooltip nativa no se lee: el motivo está en `title`). */
const hoverStep = (locator: Locator, label: string): Step => [`pasar el puntero sobre «${label}»`, () => locator.hover(ACTION)];

interface WebButtonRead {
  readonly disabled: boolean;
  readonly title: string | undefined;
}

const readWebButton = async (button: Locator): Promise<WebButtonRead> => ({ disabled: await isDisabled(button), title: await attrOf(button, 'title') });

/** Comprobaciones de un botón de la web frente a lo que dice la historia: estado, y motivo (o ausencia de motivo). */
const judgeWeb = (label: string, expectedDisabled: boolean, expectedReason: string | undefined, measured: WebButtonRead): Check[] => [
  check(measured.disabled === expectedDisabled, `«${label}» ${expectedDisabled ? 'deshabilitado' : 'habilitado'}`, `«${label}» ${measured.disabled ? 'deshabilitado' : 'habilitado'}`),
  expectedReason === undefined
    ? check(!isBlockingReason(measured.title), 'no aparece ningún motivo que explique un bloqueo', measured.title === undefined ? 'no aparece ningún motivo' : `aparece «${measured.title}», que no explica un bloqueo`)
    : check(measured.title === expectedReason, `se ve el motivo «${expectedReason}»`, measured.title === undefined ? 'sin motivo (sin atributo title)' : `motivo «${measured.title}»`),
];

/** Lee el botón cuando ya tiene el estado que describe la historia (la reacción local tarda ~1 s); si no llega, lee lo que hay. */
const settledButton = async (button: Locator, expectedDisabled: boolean, expectedReason: string | undefined): Promise<WebButtonRead> =>
  (
    await settle(
      () => readWebButton(button),
      (read) => read.disabled === expectedDisabled && (expectedReason === undefined ? !isBlockingReason(read.title) : read.title === expectedReason),
    )
  ).value;

/** Lectura de un botón de la app móvil: `aria-disabled` (react-native-web) o el atributo `disabled`. */
const mobileDisabled = async (button: Locator): Promise<boolean> => (await attrOf(button, 'aria-disabled')) === 'true' || (await isDisabled(button));

/** Cuenta de texto visible y exacto en la página (-1 si la lectura falla). */
const visibleTextCount = (page: Page, text: string): Promise<number> => safe(() => page.getByText(text, { exact: true }).filter({ visible: true }).count(), -1);

// --- Esquema 1: el botón de crear programa explica el rol -----------------------------------------------------------------------

const newProgramButton = (page: Page): Locator => page.getByRole('button', { name: '+ Nuevo programa', exact: true });

const roleDenied: BrowserRowHandler = async (row, { page, context }) => {
  const account = strict('correo', ACCOUNTS, cell(row, 'correo'));
  const password = strict('contraseña', PASSWORDS, cell(row, 'contraseña'));
  const expected = `«+ Nuevo programa» deshabilitado con motivo «${CREATE_DENIED}»`;
  await quietCookies(context);
  await resetAlumno();
  const signed = await signInToPrograms(page, account.email, password);
  if (signed) return prepFailed(expected, signed);
  const hovered = await runStepsLogged([hoverStep(newProgramButton(page), '+ Nuevo programa')]);
  if (hovered) return failedAction(expected, hovered);
  return conclude(judgeWeb('+ Nuevo programa', true, CREATE_DENIED, await settledButton(newProgramButton(page), true, CREATE_DENIED)), { note: WEB_NOTE });
};

// --- Esquema 2: un botón habilitado no muestra motivo ---------------------------------------------------------------------------

const enabledNoReason: BrowserRowHandler = async (row, { page, context }) => {
  const account = strict('correo', ACCOUNTS, cell(row, 'correo'));
  const password = strict('contraseña', PASSWORDS, cell(row, 'contraseña'));
  const expected = '«+ Nuevo programa» habilitado y sin motivo de bloqueo';
  await quietCookies(context);
  await resetAlumno();
  const signed = await signInToPrograms(page, account.email, password);
  if (signed) return prepFailed(expected, signed);
  const hovered = await runStepsLogged([hoverStep(newProgramButton(page), '+ Nuevo programa')]);
  if (hovered) return failedAction(expected, hovered);
  return conclude(judgeWeb('+ Nuevo programa', false, undefined, await settledButton(newProgramButton(page), false, undefined)), {
    note: `${WEB_NOTE} El title «Nuevo programa (N)» es el nombre con el atajo de teclado: el criterio es que no explica un bloqueo.`,
  });
};

// --- Esquema 3: «Exportar CSV» explica que no hay nada que exportar solo con la lista vacía -------------------------------

const exportButton = (page: Page): Locator => page.getByRole('button', { name: 'Exportar CSV', exact: true });

const exportState: BrowserRowHandler = async (row, { page, context }) => {
  const estado = cell(row, 'estado');
  const boton = cell(row, 'boton');
  const expectDisabled = strict('boton', BUTTON_STATE, boton);
  const expectedReason = strict('motivo', MOTIVOS, cell(row, 'motivo'));
  const expected = `«Exportar CSV» ${boton} con «Responsable» «Marta Ruiz» y «Estado» ${estado}`;
  await quietCookies(context);
  await resetAlumno();
  const signed = await signInToPrograms(page, DEMO.gestor.email, DEMO.gestor.password);
  if (signed) return prepFailed(expected, signed);
  const applied = await runStepsLogged([
    ['escribir «Marta Ruiz» en «Responsable»', () => page.getByRole('combobox', { name: 'Responsable', exact: true }).fill('Marta Ruiz', ACTION)],
    ['elegir «Marta Ruiz»', () => page.getByRole('option', { name: /^Marta Ruiz/ }).click(ACTION)],
  ]);
  if (applied) return prepFailed(expected, applied);
  // La última respuesta de la lista corresponde al filtro completo: se espera a ella antes de leer el botón (que se deshabilita al cargar)
  const listed = page.waitForResponse((response) => new URL(response.url()).pathname === '/api/programs' && response.request().method() === 'GET', { timeout: CEILING_MS }).then(
    () => true,
    () => false,
  );
  const status = await runStepsLogged([[`elegir ${estado} en «Estado»`, () => page.getByRole('combobox', { name: 'Estado', exact: true }).selectOption(quoted(estado), ACTION)]]);
  if (status) return prepFailed(expected, status);
  if (!(await listed)) return prepFailed(expected, 'la lista no pidió la respuesta filtrada tras elegir el estado');
  const ready = await waitUntil(async () => (await attrOf(page.getByRole('table'), 'aria-busy')) === 'false', CEILING_MS);
  if (!ready.reached) return prepFailed(expected, 'la tabla sigue marcada como ocupada tras el plazo');
  const hovered = await runStepsLogged([hoverStep(exportButton(page), 'Exportar CSV')]);
  if (hovered) return failedAction(expected, hovered);
  return conclude(judgeWeb('Exportar CSV', expectDisabled, expectedReason, await settledButton(exportButton(page), expectDisabled, expectedReason)), { note: WEB_NOTE });
};

// --- Esquema 4: el botón de entrar explica que se está procesando ---------------------------------------------------------------

const enterWhileProcessing: BrowserRowHandler = async (row, { page, context }) => {
  const ms = strict('espera', WAITS, cell(row, 'espera'));
  const expected = `«Entrar» deshabilitado con motivo «${PROCESSING}» mientras espera la respuesta`;
  await quietCookies(context);
  await resetAlumno();
  const released = { at: 0 };
  await delayPost(page, '/api/auth/login', ms, released);
  const prepared = await runStepsLogged([
    openLogin(page),
    ['ver el título «Iniciar sesión»', () => heading1(page, 'Iniciar sesión').waitFor({ timeout: CEILING_MS })],
    ...typeCredentials(page, DEMO.gestor.email, DEMO.gestor.password),
  ]);
  if (prepared) return prepFailed(expected, prepared);
  const clicked = await runStepsLogged([['pulsar «Entrar»', () => enterButton(page).click(ACTION)]]);
  if (clicked) return failedAction(expected, clicked);
  const hovered = await runStepsLogged([hoverStep(enterButton(page), 'Entrar')]);
  if (hovered) return failedAction(expected, hovered);
  // Si la respuesta ya se liberó al leer, la lectura llegó tarde: un fallo del arnés, no un hallazgo
  if (released.at !== 0) return notExecutable(expected, `Lectura tardía: la respuesta se liberó antes de leer el motivo (plazo de ${ms} ms); fallo del arnés, no de la app.`);
  return conclude(judgeWeb('Entrar', true, PROCESSING, await settledButton(enterButton(page), true, PROCESSING)), { note: WEB_NOTE });
};

// --- Esquema 5: el botón de verificar explica qué falta (web) -------------------------------------------------------------------

const mfaCode = (page: Page): Locator => page.getByLabel('Código de verificación', { exact: true });
const verifyButton = (page: Page): Locator => page.getByRole('button', { name: 'Verificar', exact: true });

const verifyCode: BrowserRowHandler = async (row, { page, context }) => {
  const codigo = cell(row, 'codigo');
  const estado = cell(row, 'estado');
  const expectDisabled = strict('estado', BUTTON_STATE, estado);
  const expectedReason = strict('motivo', MOTIVOS, cell(row, 'motivo'));
  const expected = `«Verificar» ${estado} con el código ${codigo}`;
  await quietCookies(context);
  await resetAlumno();
  const prepared = await runStepsLogged([
    openLogin(page),
    ...typeCredentials(page, DEMO.admin.email, DEMO.admin.password),
    submitLogin(page),
    ['ver «Verificación en dos pasos»', () => heading1(page, 'Verificación en dos pasos').waitFor({ timeout: CEILING_MS })],
  ]);
  if (prepared) return prepFailed(expected, prepared);
  const typed = await runStepsLogged([['escribir el código en «Código de verificación»', () => mfaCode(page).pressSequentially(codigo, { delay: 0 })]]);
  if (typed) return failedAction(expected, typed);
  const hovered = await runStepsLogged([hoverStep(verifyButton(page), 'Verificar')]);
  if (hovered) return failedAction(expected, hovered);
  return conclude(judgeWeb('Verificar', expectDisabled, expectedReason, await settledButton(verifyButton(page), expectDisabled, expectedReason)), { note: WEB_NOTE });
};

// --- Esquema 6: en la app móvil, el motivo de verificar se ve como texto -------------------------------------------------------

const verifyOnPhone: BrowserRowHandler = async (row, { context }) => {
  const codigo = cell(row, 'codigo');
  const expected = `«Verificar» deshabilitado y el texto «${CODE_INCOMPLETE}» junto al botón`;
  if (!(await reachable(MOBILE_URL))) return notExecutable(expected, expoNotRunning(MOBILE_URL));
  await resetAlumno();
  const phone = await phoneContext(browserOf(context));
  try {
    const page = await phone.newPage();
    const prepared = await runStepsLogged([
      ...mobileSignInSteps(page, DEMO.admin.email, DEMO.admin.password),
      ['ver «Verificación en dos pasos»', () => heading1(page, 'Verificación en dos pasos').waitFor({ timeout: CEILING_MS })],
    ]);
    if (prepared) return prepFailed(expected, prepared);
    const typed = await runStepsLogged([['escribir el código en «Código de verificación»', () => mobileField(page, 'Código de verificación').fill(codigo, ACTION)]]);
    if (typed) return failedAction(expected, typed);
    const button = mobileButton(page, 'Verificar');
    const disabled = await waitUntil(() => mobileDisabled(button), 2_000);
    const visible = await visibleTextCount(page, CODE_INCOMPLETE);
    return conclude(
      [
        check(disabled.reached, '«Verificar» deshabilitado', disabled.reached ? '«Verificar» deshabilitado' : '«Verificar» habilitado'),
        check(visible === 1, `se ve el texto «${CODE_INCOMPLETE}» junto al botón`, visible === 1 ? `se ve el texto «${CODE_INCOMPLETE}»` : `no se ve el texto «${CODE_INCOMPLETE}» (${visible} visibles)`),
      ],
      { note: `${MOBILE_NOTE} ${PHONE_REASON_NOTE}` },
    );
  } finally {
    await phone.close();
  }
};

// --- Esquema 7: en la web, registrar una ejecución sin permiso muestra el motivo ----------------------------------------------

/** El botón de enviar de la sección «Registrar ejecución» (la sección se nombra por su título). */
const runSubmit = (page: Page): Locator => page.getByRole('region', { name: 'Registrar ejecución', exact: true }).getByRole('button', { name: 'Registrar ejecución', exact: true });

const runDeniedWeb: BrowserRowHandler = async (row, { page, context }) => {
  const account = strict('correo', ACCOUNTS, cell(row, 'correo'));
  const password = strict('contraseña', PASSWORDS, cell(row, 'contraseña'));
  const expected = `«Registrar ejecución» deshabilitado con motivo «${RUN_DENIED}»`;
  await quietCookies(context);
  await resetAlumno();
  const signed = await signInToPrograms(page, account.email, password);
  if (signed) return prepFailed(expected, signed);
  const shown = await runStepsLogged([
    ['abrir /verification/TC-001', () => page.goto('/verification/TC-001', { timeout: CEILING_MS })],
    ['ver la sección «Registrar ejecución»', () => runSubmit(page).waitFor({ timeout: CEILING_MS })],
  ]);
  if (shown) return prepFailed(expected, shown);
  const hovered = await runStepsLogged([hoverStep(runSubmit(page), 'Registrar ejecución')]);
  if (hovered) return failedAction(expected, hovered);
  return conclude(judgeWeb('Registrar ejecución', true, RUN_DENIED, await settledButton(runSubmit(page), true, RUN_DENIED)), { note: WEB_NOTE });
};

// --- Esquema 8: en la app móvil, registrar una ejecución sin permiso muestra el motivo como texto ------------------------

const runDeniedPhone: BrowserRowHandler = async (row, { context }) => {
  const account = strict('correo', ACCOUNTS, cell(row, 'correo'));
  const password = strict('contraseña', PASSWORDS, cell(row, 'contraseña'));
  const expected = `«Registrar ejecución» deshabilitado y el texto «${RUN_DENIED}» junto al formulario`;
  if (!(await reachable(MOBILE_URL))) return notExecutable(expected, expoNotRunning(MOBILE_URL));
  await resetAlumno();
  const phone = await phoneContext(browserOf(context));
  try {
    const page = await phone.newPage();
    const prepared = await runStepsLogged([
      ...mobileSignInSteps(page, account.email, password),
      ['llegar a la lista de programas', () => page.getByRole('region', { name: 'Filtros', exact: true }).waitFor({ timeout: CEILING_MS })],
      ['abrir /verification/TC-001', () => page.goto('/verification/TC-001', { timeout: CEILING_MS })],
    ]);
    if (prepared) return prepFailed(expected, prepared);
    const button = mobileButton(page, 'Registrar ejecución');
    const shown = await runStepsLogged([['ver el botón «Registrar ejecución»', () => button.waitFor({ timeout: CEILING_MS })]]);
    if (shown) return prepFailed(expected, shown);
    const disabled = await waitUntil(() => mobileDisabled(button), 2_000);
    const visible = await visibleTextCount(page, RUN_DENIED);
    return conclude(
      [
        check(disabled.reached, '«Registrar ejecución» deshabilitado', disabled.reached ? '«Registrar ejecución» deshabilitado' : '«Registrar ejecución» habilitado'),
        check(visible === 1, `se ve el texto «${RUN_DENIED}» junto al formulario`, visible === 1 ? `se ve el texto «${RUN_DENIED}»` : `no se ve el texto «${RUN_DENIED}» (${visible} visibles)`),
      ],
      { note: MOBILE_NOTE },
    );
  } finally {
    await phone.close();
  }
};

defineBrowserRows({
  story: 'US-A11Y-003',
  surface: 'web',
  tenants: [TENANT_A],
  handlers: new Map<number, BrowserRowHandler>([
    [1, roleDenied],
    [2, enabledNoReason],
    [3, exportState],
    [4, enterWhileProcessing],
    [5, verifyCode],
    [6, verifyOnPhone],
    [7, runDeniedWeb],
    [8, runDeniedPhone],
  ]),
});
