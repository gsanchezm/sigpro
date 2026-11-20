import type { Locator, Page } from '@playwright/test';
import { DEMO, TENANT_A } from '../../../story-runs/support/prepare';
import { ACTION, CEILING_MS, attrOf, isDisabled, quoted, safe, waitUntil, type Step } from '../../support/browser';
import { check, cell, conclude, strict, type Check } from '../../support/checks';
import { defineBrowserRows, notExecutable, type BrowserRowHandler, type Outcome } from '../../core/framework';
import { VERIFICACION_TESTIDS } from '../../../../packages/shared/src/testids';
import {
  ALUMNO_ADMIN,
  COOKIE_NOTE,
  NETWORK_MS,
  PASSWORDS,
  browserOf,
  countVisible,
  delayPost,
  describedByText,
  enterButton,
  failedAction,
  filterState,
  heading1,
  isBlockingReason,
  missingControlOutcome,
  MOBILE_URL,
  openLogin,
  phoneContext,
  prepFailed,
  quietCookies,
  reachable,
  releaseContextRoutes,
  resetAlumno,
  runStepsLogged,
  settle,
  signInToPrograms,
  submitLogin,
  typeCredentials,
  verticalGap,
  withRoutesReleased,
} from './common';
import { MOBILE_NOTE, expoNotRunning, mobileButton, mobileField, mobileSignInSteps } from './mobile';

// US-A11Y-003 — Botones deshabilitados con el motivo a la vista (web de 1440 px y, en las filas de la app móvil, Expo web a 390 px).
// Preparación de cada fila: reinicio de alumno01; cada fila inicia la sesión de su cuenta en un navegador sin sesión guardada.
// Un botón de la web se lee por su `disabled` y su motivo por el `title` (o la descripción accesible) que escribe al pasar el puntero;
// la tooltip nativa no es observable en el DOM. En la app móvil el botón se lee por `aria-disabled` y el motivo como texto visible.

const CREATE_DENIED = 'Tu rol no permite crear programas';
const EXPORT_EMPTY = 'No hay programas para exportar';
const CODE_INCOMPLETE = 'Introduce los 6 dígitos del código';
const RUN_DENIED = 'Tu rol no permite registrar ejecuciones';
const PROCESSING = 'Procesando…';
/** «Junto al botón»: el texto se ve a 80 px o menos del borde del control (criterio de esta prueba; la historia no fija distancia). */
const NEAR_PX = 80;

const WEB_NOTE = `${COOKIE_NOTE} El motivo de la web se lee en el atributo title del botón y, si no lo tiene, en su descripción accesible (aria-description o aria-describedby).`;
/** Lo que la app móvil escribe cuando el botón está deshabilitado: el nombre del campo, no la frase de la historia. */
const PHONE_REASON_NOTE = 'La app móvil no tiene `title`: su motivo va en el atributo de descripción del botón y el texto visible es el nombre del campo. Se compara el texto visible junto al botón.';
const PHONE_SURFACE_NOTE = 'Fila de Expo web (390 × 844) dentro de web/: la cabecera de superficie dice «web»; el veredicto vale para Expo web, no para iOS ni Android nativos.';
const NOT_EVALUATED_NOTE = 'Reglas sin fila (no evaluadas): que el motivo se pueda leer con el teclado (decisión pendiente de la historia).';

/** Cuentas de las filas (la contraseña sale de la celda, validada con el mapa de contraseñas). */
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

/**
 * Filas que da la semilla para «Responsable» = Marta Ruiz (u1): es propietaria de PRG-001, PRG-007, PRG-013 y PRG-019 (estados activo,
 * activo, activo y borrador). Cancelado: 0 filas; Activo: 3 (PRG-001, PRG-007 y PRG-013).
 */
const SEEDED_ROWS: ReadonlyMap<string, number> = new Map<string, number>([
  ['«Cancelado»', 0],
  ['«Activo»', 3],
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

/** Pasar el puntero sobre un control: en la web es lo que muestra el motivo (el `title` y la descripción se leen después). */
const hoverStep = (locator: Locator, label: string): Step => [`pasar el puntero sobre «${label}»`, () => locator.hover(ACTION)];

interface WebButtonRead {
  readonly disabled: boolean;
  readonly title: string | undefined;
  readonly description: string | undefined;
}

/** Motivo de un botón de la web: su `title` o, si no lo tiene, su descripción accesible. */
const reasonOf = (read: WebButtonRead): string | undefined => read.title ?? read.description;

const readWebButton = async (button: Locator): Promise<WebButtonRead> => {
  const ariaDescription = await attrOf(button, 'aria-description');
  return {
    disabled: await isDisabled(button),
    title: await attrOf(button, 'title'),
    description: ariaDescription ?? (await describedByText(button)),
  };
};

/** Comprobaciones de un botón de la web frente a lo que dice la historia: estado, y motivo (o ausencia de motivo). */
const judgeWeb = (label: string, expectedDisabled: boolean, expectedReason: string | undefined, measured: WebButtonRead): Check[] => {
  const reason = reasonOf(measured);
  return [
    check(measured.disabled === expectedDisabled, `«${label}» ${expectedDisabled ? 'deshabilitado' : 'habilitado'}`, `«${label}» ${measured.disabled ? 'deshabilitado' : 'habilitado'}`),
    expectedReason === undefined
      ? check(!isBlockingReason(reason), 'no aparece ningún motivo que explique un bloqueo', reason === undefined ? 'no aparece ningún motivo' : `aparece «${reason}», que no explica un bloqueo`)
      : check(reason === expectedReason, `se ve el motivo «${expectedReason}»`, reason === undefined ? 'sin motivo (sin title ni descripción accesible)' : `motivo «${reason}»`),
  ];
};

/** Lee el botón cuando ya tiene el estado que describe la historia (la reacción local tarda ~1 s); si no llega, lee lo que hay. */
const settledButton = async (button: Locator, expectedDisabled: boolean, expectedReason: string | undefined): Promise<WebButtonRead> =>
  (
    await settle(
      () => readWebButton(button),
      (read) => read.disabled === expectedDisabled && (expectedReason === undefined ? !isBlockingReason(reasonOf(read)) : reasonOf(read) === expectedReason),
    )
  ).value;

/** Lectura de un botón de la app móvil: `aria-disabled` (react-native-web) o el atributo `disabled`. */
const mobileDisabled = async (button: Locator): Promise<boolean> => (await attrOf(button, 'aria-disabled')) === 'true' || (await isDisabled(button));

/** Cuenta de texto visible y exacto en la página (-1 si la lectura falla). */
const visibleTextCount = (page: Page, text: string): Promise<number> => safe(() => page.getByText(text, { exact: true }).filter({ visible: true }).count(), -1);

/**
 * «Junto al botón»: el texto visible y único del motivo está a NEAR_PX o menos del borde del control. Se mide con las cajas, no con
 * la presencia del texto en cualquier parte de la página.
 */
const nearControl = async (page: Page, text: string, control: Locator, label: string): Promise<Check[]> => {
  const visible = await visibleTextCount(page, text);
  const gap = visible === 1 ? await verticalGap(page.getByText(text, { exact: true }).filter({ visible: true }), control) : undefined;
  const near = gap !== undefined && gap <= NEAR_PX;
  return [
    check(
      visible === 1 && near,
      `se ve el texto «${text}» ${label} (a ${NEAR_PX} px o menos del control)`,
      visible !== 1 ? `no se ve el texto «${text}» (${visible} visibles)` : gap === undefined ? 'el texto o el control no tienen caja visible' : `el texto se ve a ${Math.round(gap)} px del control`,
    ),
  ];
};

/** Fallo de la sección de registro (web) o del botón (móvil) en la preparación: discrepancia si la pantalla correcta está visible y el control no tiene ningún nodo. */
const missingRunControl = async (page: Page, expected: string, reason: string, control: Locator): Promise<Outcome> =>
  missingControlOutcome(expected, reason, (await countVisible(page.getByRole('heading', { level: 1 }))) === 1, await safe(() => control.count(), 0));

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
  return conclude(judgeWeb('+ Nuevo programa', true, CREATE_DENIED, await settledButton(newProgramButton(page), true, CREATE_DENIED)), {
    note: `${WEB_NOTE} ${NOT_EVALUATED_NOTE}`,
  });
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
  const expectedRows = strict('estado', SEEDED_ROWS, estado);
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
  const listed = page
    .waitForResponse((response) => new URL(response.url()).pathname === '/api/programs' && response.request().method() === 'GET', { timeout: CEILING_MS })
    .then(
      () => true,
      () => false,
    );
  const status = await runStepsLogged([[`elegir ${estado} en «Estado»`, () => page.getByRole('combobox', { name: 'Estado', exact: true }).selectOption(quoted(estado), ACTION)]]);
  if (status) return prepFailed(expected, status);
  if (!(await listed)) return prepFailed(expected, 'la lista no pidió la respuesta filtrada tras elegir el estado');
  const ready = await waitUntil(async () => (await attrOf(page.getByRole('table'), 'aria-busy')) === 'false', CEILING_MS);
  if (!ready.reached) return prepFailed(expected, 'la tabla sigue marcada como ocupada tras el plazo');
  // El filtro debe estar aplicado (con su valor y con las filas que da la semilla) antes de leer el botón: si no, la fila no prueba nada
  const filter = await settle(
    () => filterState(page),
    (state) => state.owner === 'Marta Ruiz' && state.status === quoted(estado) && state.rows === expectedRows,
    NETWORK_MS,
  );
  if (!filter.ok) {
    return prepFailed(
      expected,
      `el filtro no quedó aplicado: «Responsable» ${filter.value.owner === undefined ? '(ilegible)' : `«${filter.value.owner}»`}, «Estado» ${filter.value.status === undefined ? '(ilegible)' : `«${filter.value.status}»`}, ${filter.value.rows} filas (la semilla da ${expectedRows})`,
    );
  }
  const hovered = await runStepsLogged([hoverStep(exportButton(page), 'Exportar CSV')]);
  if (hovered) return failedAction(expected, hovered);
  return conclude(judgeWeb('Exportar CSV', expectDisabled, expectedReason, await settledButton(exportButton(page), expectDisabled, expectedReason)), {
    note: `${WEB_NOTE} La historia dice «… solo cuando la lista está vacía»: la app muestra el mismo motivo también durante la carga y con error (ProgramsPage.tsx:213); esa nota de texto no se juzga aquí.`,
  });
};

// --- Esquema 4: el botón de entrar explica que se está procesando ---------------------------------------------------------------

const enterWhileProcessing: BrowserRowHandler = async (row, { page, context }) => {
  const ms = strict('espera', WAITS, cell(row, 'espera'));
  const expected = `«Entrar» deshabilitado con motivo «${PROCESSING}» mientras espera la respuesta`;
  await quietCookies(context);
  await resetAlumno();
  const released = { at: 0, intercepted: false };
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
  // Control positivo de la retención: sin una petición de inicio de sesión retenida, la lectura de «Procesando…» no prueba nada
  if (!released.intercepted) return notExecutable(expected, 'La retención de la respuesta no se activó: ninguna petición de inicio de sesión casó con la ruta (sin control positivo, la lectura no vale).');
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

// --- Esquema 6: en la app móvil, el motivo de verificar se ve como texto junto al botón ----------------------------------------

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
    return conclude(
      [
        check(disabled.reached, '«Verificar» deshabilitado', disabled.reached ? '«Verificar» deshabilitado' : '«Verificar» habilitado'),
        ...(await nearControl(page, CODE_INCOMPLETE, button, 'junto al botón')),
      ],
      { note: `${MOBILE_NOTE} ${PHONE_REASON_NOTE} ${PHONE_SURFACE_NOTE}` },
    );
  } finally {
    await releaseContextRoutes(phone);
    await phone.close();
  }
};

// --- Esquema 7: en la web, registrar una ejecución sin permiso muestra el motivo ----------------------------------------------

/** El botón de enviar de la sección «Registrar ejecución» (la sección se nombra por su título). */
const runSection = (page: Page): Locator => page.getByRole('region', { name: 'Registrar ejecución', exact: true });
const runSubmit = (page: Page): Locator => runSection(page).getByRole('button', { name: 'Registrar ejecución', exact: true });

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
    ['ver la sección «Registrar ejecución»', () => runSection(page).waitFor({ timeout: CEILING_MS })],
  ]);
  if (shown) {
    // La sección falta: es un hallazgo si la pantalla del caso está visible y no hay ningún nodo de la sección; si no, el arnés no llegó
    const nodes = (await runSection(page).count()) + (await page.getByTestId(VERIFICACION_TESTIDS.RUN_FORM).count());
    return missingControlOutcome(expected, shown, (await countVisible(page.getByRole('heading', { level: 1 }))) === 1, nodes);
  }
  const hovered = await runStepsLogged([hoverStep(runSubmit(page), 'Registrar ejecución')]);
  if (hovered) return failedAction(expected, hovered);
  return conclude(judgeWeb('Registrar ejecución', true, RUN_DENIED, await settledButton(runSubmit(page), true, RUN_DENIED)), { note: WEB_NOTE });
};

// --- Esquema 8: en la app móvil, registrar una ejecución sin permiso muestra el motivo como texto junto al formulario ------

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
    if (shown) return missingRunControl(page, expected, shown, button);
    const disabled = await waitUntil(() => mobileDisabled(button), 2_000);
    return conclude(
      [
        check(disabled.reached, '«Registrar ejecución» deshabilitado', disabled.reached ? '«Registrar ejecución» deshabilitado' : '«Registrar ejecución» habilitado'),
        ...(await nearControl(page, RUN_DENIED, button, 'junto al formulario')),
      ],
      { note: `${MOBILE_NOTE} ${PHONE_SURFACE_NOTE}` },
    );
  } finally {
    await releaseContextRoutes(phone);
    await phone.close();
  }
};

defineBrowserRows({
  story: 'US-A11Y-003',
  surface: 'web',
  tenants: [TENANT_A],
  handlers: new Map<number, BrowserRowHandler>([
    [1, withRoutesReleased(roleDenied)],
    [2, withRoutesReleased(enabledNoReason)],
    [3, withRoutesReleased(exportState)],
    [4, withRoutesReleased(enterWhileProcessing)],
    [5, withRoutesReleased(verifyCode)],
    [6, withRoutesReleased(verifyOnPhone)],
    [7, withRoutesReleased(runDeniedWeb)],
    [8, withRoutesReleased(runDeniedPhone)],
  ]),
});
