import type { Locator, Page } from '@playwright/test';
import { adminToken, call, field } from '../../../story-runs/support/api';
import { DEMO, resetTenants, TENANT_A, type Credentials } from '../../../story-runs/support/prepare';
import { ACCESO_DYNAMIC_TESTIDS, EDITAR_PROGRAMA_TESTIDS, PROGRAMAS_TESTIDS } from '../../../../packages/shared/src/testids';
import { ACTION, CEILING_MS, HOLD_MS, attrOf, holdsFor, isVisible, linesOf, pathOf, runSteps, safe, textOf, valueOf, waitUntil } from '../../support/browser';
import { check, type Check } from '../../support/checks';
import { outcome, type BrowserRowHandler, type Outcome } from '../../core/framework';

// Piezas comunes de las filas web de EP-PROG-ALTA (escritorio 1440 × 900). Los localizadores son de rol y de etiqueta; los ids de
// prueba de testids.ts solo donde la pantalla no ofrece otro rastro (avisos de campo, aviso del servidor, resumen).
// Tolerancias de la prueba (no son requisitos del producto): reacción local de la propia pantalla, 1 s; respuesta de red o cambio
// de pantalla, 5 s; aparición de un aviso emergente, 2 s. Toda acción sobre un elemento pasa por `interact`: si falla, la nota
// distingue «no existe» de «existe pero otro elemento lo tapa» (el mismo diagnóstico que prog-lista).

export const DESKTOP_WIDTH = 1440;
export const LOGIN_URL = `/login?tenant=${TENANT_A}`;
export const LOCAL_MS = 1_000;
export const NET_MS = 5_000;
export const TOAST_MS = 2_000;

/** Nota que se añade a cada fila web: la preferencia de cookies se fija por adelantado. */
export const COOKIE_NOTE = 'La prueba fija la preferencia de cookies (sigpro.cookies = accepted) antes de abrir la app, como el piloto; el aviso de cookies no se ejerce aquí.';

/**
 * Envuelve una fila web: antes de cada fila reinicia alumno01 (la historia lo exige: cada fila parte de la semilla) y añade la nota de
 * cookies. Un reinicio que no responde lanza, y el marco lo registra como error del arnés.
 */
export const onWeb =
  (handler: BrowserRowHandler): BrowserRowHandler =>
  async (row, fixtures) => {
    await resetTenants([TENANT_A]);
    const result = await handler(row, fixtures);
    return { ...result, note: result.note === undefined ? COOKIE_NOTE : `${result.note} ${COOKIE_NOTE}` };
  };

/** Fija SOLO la preferencia de cookies (no es una sesión): el aviso de cookies tapa zonas de la página. */
const fixCookiePreference = (): void => {
  try {
    localStorage.setItem('sigpro.cookies', 'accepted');
  } catch {
    // sin almacenamiento no hay preferencia que fijar
  }
};

// --- Diagnóstico de acciones ---------------------------------------------------------------------------------------------------

/** Resultado de una acción fallida: si el elemento existe, lo observado y la nota de la fila. */
export interface Blocked {
  readonly present: boolean;
  readonly message: string;
  readonly note: string;
}

interface Probe {
  readonly target: string;
  readonly center: readonly [number, number];
  readonly hit: string;
  readonly inside: boolean;
}

/** Se ejecuta en el navegador: describe el elemento y el que recibe el clic en su centro. No usa variables de fuera. */
const probeElement = (node: Element): Probe => {
  const describe = (element: Element): string => {
    const testid = element.getAttribute('data-testid');
    const aria = element.getAttribute('aria-label');
    const text = (element.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 40);
    return `${element.tagName.toLowerCase()}${testid === null ? '' : `[data-testid="${testid}"]`}${aria === null ? '' : ` aria-label="${aria}"`}${text === '' ? '' : ` «${text}»`}`;
  };
  const box = node.getBoundingClientRect();
  const cx = box.left + box.width / 2;
  const cy = box.top + box.height / 2;
  const hit = document.elementFromPoint(cx, cy);
  return { target: describe(node), center: [Math.round(cx), Math.round(cy)], hit: hit === null ? '(ninguno)' : describe(hit), inside: hit !== null && (hit === node || node.contains(hit)) };
};

const describeFailure = async (target: Locator, label: string, error: unknown): Promise<Blocked> => {
  const text = error instanceof Error ? error.message : String(error);
  const lines = text.split('\n').map((line) => line.trim()).filter((line) => line !== '');
  const head = lines.slice(0, 3).join(' · ');
  const intercept = lines.find((line) => line.includes('intercepts pointer events'));
  const present = (await safe(() => target.count(), 0)) > 0;
  const message = `no se pudo ${label}: ${head}${intercept === undefined ? '' : ` · llamada: ${intercept}`}`;
  if (!present) return { present, message, note: 'La historia nombra un elemento que la pantalla no ofrece.' };
  const probe = await safe<Probe | undefined>(() => target.first().evaluate(probeElement), undefined);
  if (probe === undefined) return { present, message: `${message} · no se pudo leer su geometría`, note: 'el elemento existe pero no se pudo comprobar qué lo tapa' };
  const note = probe.inside
    ? 'el elemento existe y recibe el clic en su centro, pero la acción no se completó (ver el mensaje de Playwright)'
    : `el elemento existe pero otro lo tapa: ${probe.hit}`;
  return { present, message: `${message} · elemento ${probe.target} · centro (${probe.center[0]}, ${probe.center[1]}) recibe: ${probe.hit}`, note };
};

/** Ejecuta una acción sobre un elemento de la historia; si falla, devuelve el diagnóstico (no lanza). */
export const interact = async (target: Locator, label: string, run: (element: Locator) => Promise<unknown>): Promise<Blocked | undefined> => {
  try {
    await run(target);
    return undefined;
  } catch (error) {
    return describeFailure(target, label, error);
  }
};

/** Una acción fallida con su diagnóstico, como resultado de la fila. */
export const actionFailed = (expected: string, blocked: Blocked): Outcome => outcome(false, expected, blocked.message, { note: blocked.note });

/** Un paso que no es una acción sobre un elemento (navegación, teclado): fallo genérico con su mensaje. */
export const stepFailed = (expected: string, failure: string): Outcome => outcome(false, expected, failure, { note: 'La historia nombra un elemento que la pantalla no ofrece, o la acción no se completó (ver el mensaje).' });

// --- Sesión y espera -----------------------------------------------------------------------------------------------------------

export const programsHeading = (page: Page): Locator => page.getByRole('heading', { name: 'Programas', level: 1, exact: true });

/** Preparación de cada fila: entra desde /login de alumno01 y llega a /programs (escritorio). */
export const signIn = (page: Page, credentials: Credentials = DEMO.gestor): Promise<string | undefined> =>
  runSteps([
    ['fijar la preferencia de cookies', () => page.context().addInitScript(fixCookiePreference)],
    ['fijar el ancho de la ventana', () => page.setViewportSize({ width: DESKTOP_WIDTH, height: 900 })],
    ['abrir /login?tenant=alumno01', () => page.goto(LOGIN_URL, { timeout: CEILING_MS })],
    ['escribir el correo', () => page.getByLabel('Correo electrónico', { exact: true }).fill(credentials.email, ACTION)],
    ['escribir la contraseña', () => page.getByLabel('Contraseña', { exact: true }).fill(credentials.password, ACTION)],
    ['pulsar «Entrar»', () => page.getByRole('button', { name: 'Entrar', exact: true }).click(ACTION)],
    ['llegar a /programs', () => page.waitForURL(/\/programs/, { timeout: CEILING_MS })],
    ['ver la pantalla de Programas', async () => {
      if (!(await waitUntil(() => isVisible(programsHeading(page)), CEILING_MS)).reached) throw new Error('la pantalla de Programas no aparece');
    }],
  ]);

/** Abre una dirección de la app (carga completa, que recupera la sesión guardada). */
export const openPath = (page: Page, path: string): Promise<string | undefined> =>
  runSteps([[`abrir ${path}`, () => page.goto(path, { timeout: CEILING_MS })]]);

// --- Asistente de alta ---------------------------------------------------------------------------------------------------------

/** Diálogo del asistente «Nuevo programa» (su nombre accesible es el título). */
export const wizardOf = (page: Page): Locator => page.getByRole('dialog', { name: 'Nuevo programa', exact: true });
/** Botón «+ Nuevo programa» de la cabecera de Programas (el atajo N va aparte). */
export const newProgramButton = (page: Page): Locator => page.getByRole('button', { name: /Nuevo programa/ }).first();

export const wizardNameField = (page: Page): Locator => wizardOf(page).getByLabel('Nombre');
export const wizardDescriptionField = (page: Page): Locator => wizardOf(page).getByLabel('Descripción');
export const wizardOwnerField = (page: Page): Locator => wizardOf(page).getByRole('combobox', { name: 'Responsable' });
export const wizardStartField = (page: Page): Locator => wizardOf(page).getByLabel('Fecha de inicio');
export const wizardEndField = (page: Page): Locator => wizardOf(page).getByLabel('Fecha de fin');
export const wizardBudgetField = (page: Page): Locator => wizardOf(page).getByLabel('Presupuesto');
export const wizardCodeField = (page: Page): Locator => wizardOf(page).getByLabel('Código');
export const wizardNotifySwitch = (page: Page): Locator => wizardOf(page).getByRole('switch', { name: 'Notificar al equipo por correo', exact: true });
export const wizardButton = (page: Page, name: string): Locator => wizardOf(page).getByRole('button', { name, exact: true });
export const wizardStepText = (page: Page): Promise<string | undefined> => textOf(wizardOf(page).getByText(/^Paso \d de 3$/));

/** Espera (con techo local) a que el asistente muestre el paso indicado. */
export const waitForStep = async (page: Page, step: number): Promise<boolean> => (await waitUntil(async () => (await wizardStepText(page)) === `Paso ${step} de 3`, NET_MS)).reached;

/** Abre el asistente desde «+ Nuevo programa» y espera a su primer paso y al código siguiente (PRG-025). */
export const openWizard = async (page: Page): Promise<Blocked | undefined> => {
  const clicked = await interact(newProgramButton(page), 'pulsar «Nuevo programa»', (element) => element.click(ACTION));
  if (clicked !== undefined) return clicked;
  await waitUntil(() => isVisible(wizardOf(page)), NET_MS);
  return undefined;
};

/** Escribe en un campo del asistente o de la edición; si falla, devuelve el diagnóstico. */
export const fillField = (field: Locator, text: string, label: string): Promise<Blocked | undefined> => interact(field, `escribir «${text}» en ${label}`, (element) => element.fill(text, ACTION));

/** Elige una persona en «Responsable» (abre la lista con el foco, luego pulsa la opción por su nombre). */
export const pickOwner = async (owner: Locator, scope: Locator, persona: string): Promise<Blocked | undefined> => {
  const opened = await interact(owner, 'abrir «Responsable»', (element) => element.click(ACTION));
  if (opened !== undefined) return opened;
  return interact(scope.getByRole('option', { name: persona, exact: true }), `elegir «${persona}»`, (element) => element.click(ACTION));
};

/** Pulsa un botón del asistente por su nombre exacto. */
export const clickWizardButton = (page: Page, name: string): Promise<Blocked | undefined> => interact(wizardButton(page, name), `pulsar «${name}»`, (element) => element.click(ACTION));

/** Cuerpo base de los ejemplos web (la historia lo fija): nombre, responsable, fechas y presupuesto. */
export const BASE = { name: 'Programa de prueba alfa', owner: 'Javier Ortega', start: '2027-03-01', end: '2027-03-02', budget: '900000' } as const;

/** Escribe el paso 1 (nombre y responsable opcionales: `undefined` = no tocar ese campo). */
export const fillStep1 = async (page: Page, name: string | undefined, owner: string | undefined): Promise<Blocked | undefined> => {
  if (name !== undefined) {
    const typed = await fillField(wizardNameField(page), name, 'Nombre');
    if (typed !== undefined) return typed;
  }
  if (owner !== undefined) return pickOwner(wizardOwnerField(page), wizardOf(page), owner);
  return undefined;
};

/** Escribe el paso 2: fechas, presupuesto y prioridad (`undefined` = no tocar; la prioridad se elige por su nombre). */
export const fillStep2 = async (page: Page, start: string | undefined, end: string | undefined, budget: string | undefined, priority?: string): Promise<Blocked | undefined> => {
  if (start !== undefined) {
    const typed = await fillField(wizardStartField(page), start, 'Fecha de inicio');
    if (typed !== undefined) return typed;
  }
  if (end !== undefined) {
    const typed = await fillField(wizardEndField(page), end, 'Fecha de fin');
    if (typed !== undefined) return typed;
  }
  if (budget !== undefined) {
    const typed = await fillField(wizardBudgetField(page), budget, 'Presupuesto (€)');
    if (typed !== undefined) return typed;
  }
  if (priority !== undefined) return interact(wizardOf(page).getByRole('radio', { name: priority, exact: true }), `elegir la prioridad «${priority}»`, (element) => element.check(ACTION));
  return undefined;
};

/** Deja el asistente en el paso 2 con el nombre y el responsable del cuerpo base (desde «Nuevo programa» abierto en el paso 1). */
export const completeStep1 = async (page: Page): Promise<Blocked | undefined> => {
  const filled = await fillStep1(page, BASE.name, BASE.owner);
  if (filled !== undefined) return filled;
  return clickWizardButton(page, 'Siguiente');
};

/** Deja el asistente en el paso 3 con el cuerpo base completo (prioridad Alta y sin clasificar). */
export const completeToStep3 = async (page: Page): Promise<Blocked | undefined> => {
  const first = await completeStep1(page);
  if (first !== undefined) return first;
  const second = await fillStep2(page, BASE.start, BASE.end, BASE.budget, 'Alta');
  if (second !== undefined) return second;
  return clickWizardButton(page, 'Siguiente');
};

/**
 * Un aviso de campo o del servidor con su texto exacto. Espera (con el techo local de 1 s) a que aparezca el texto antes de
 * juzgar: la reacción a un clic no es instantánea. Una lectura que falla no cuenta como cumplida.
 */
export const alertCheck = async (target: Locator, expected: string, what: string, ceiling: number = LOCAL_MS): Promise<Check> => {
  const waited = await waitUntil(async () => (await isVisible(target)) && (await textOf(target)) === expected, ceiling);
  const seen = await isVisible(target);
  const text = seen ? await textOf(target) : undefined;
  return check(waited.reached, `${what} «${expected}»`, seen ? `${what} «${text ?? '(sin leer)'}»` : `no se ve ${what}`);
};

/** «Sigue en» o «pasa a» un paso del asistente: espera (con el techo local) al paso indicado. */
export const stepCheck = async (page: Page, step: number, verb: 'sigue en' | 'pasa a' | 'vuelve a'): Promise<Check> => {
  const expected = `Paso ${step} de 3`;
  const reached = await waitUntil(async () => (await wizardStepText(page)) === expected, LOCAL_MS);
  const observed = await wizardStepText(page);
  return check(reached.reached, `${verb} «${expected}»`, `el asistente muestra «${observed ?? '(sin leer)'}»`);
};

/** Pulsa la opción de prioridad (label de la radio), sin llegar a fallar la fila por ello. */
export const wizardPriority = (page: Page, label: string): Locator => wizardOf(page).getByRole('radio', { name: label, exact: true });

// --- Edición -------------------------------------------------------------------------------------------------------------------

export const editPath = (code: string): string => `/programs/${code}/edit`;
export const editForm = (page: Page): Locator => page.getByTestId(EDITAR_PROGRAMA_TESTIDS.PROGRAM_EDIT_FORM);
export const editDenied = (page: Page): Locator => page.getByTestId(EDITAR_PROGRAMA_TESTIDS.PROGRAM_EDIT_DENIED);
export const editNotFound = (page: Page): Locator => page.getByTestId(EDITAR_PROGRAMA_TESTIDS.PROGRAM_EDIT_NOT_FOUND);
// Las etiquetas de los campos obligatorios llevan un asterisco aria-hidden: se busca por el texto sin él (coincidencia parcial).
export const editNameField = (page: Page): Locator => page.getByLabel('Nombre');
export const editOwnerField = (page: Page): Locator => page.getByRole('combobox', { name: 'Responsable' });
export const editStatusField = (page: Page): Locator => page.getByLabel('Estado', { exact: true });
export const editStartField = (page: Page): Locator => page.getByLabel('Fecha de inicio');
export const editEndField = (page: Page): Locator => page.getByLabel('Fecha de fin');
export const editBudgetField = (page: Page): Locator => page.getByLabel('Presupuesto');
export const editClassifiedField = (page: Page): Locator => page.getByRole('checkbox', { name: 'Programa clasificado', exact: true });
export const editSaveButton = (page: Page): Locator => page.getByRole('button', { name: 'Guardar', exact: true });
export const editSaveCloseButton = (page: Page): Locator => page.getByRole('button', { name: 'Guardar y cerrar', exact: true });

/** Espera a que la edición muestre el formulario, el aviso de permiso o el de no encontrado (lo que corresponda). */
export const editSettled = async (page: Page): Promise<boolean> =>
  (await waitUntil(async () => (await isVisible(editForm(page))) || (await isVisible(editDenied(page))) || (await isVisible(editNotFound(page))), NET_MS)).reached;

// --- Avisos emergentes ---------------------------------------------------------------------------------------------------------

/** Cada aviso «ok» en pantalla como sus renglones (título y cuerpo). */
export const okToasts = async (page: Page): Promise<readonly (readonly string[])[]> => {
  const toasts = page.getByTestId(ACCESO_DYNAMIC_TESTIDS.TOAST('ok'));
  const total = await safe(() => toasts.count(), 0);
  const all: string[][] = [];
  for (let index = 0; index < total; index += 1) all.push([...linesOf(await textOf(toasts.nth(index)))]);
  return all;
};

/** Espera (con el techo indicado; por defecto el de un aviso) a que aparezca un aviso «ok» con ese título y ese cuerpo. */
export const waitForOkToast = async (page: Page, title: string, body: string, ceiling: number = TOAST_MS): Promise<boolean> =>
  (await waitUntil(async () => (await okToasts(page)).some((lines) => lines[0] === title && lines[1] === body), ceiling)).reached;

// --- Oráculo por API: lo que quedó en el tenant (la pantalla no es la fuente) ----------------------------------------------------

/** Código HTTP de `GET /api/programs/<code>` con el administrador del tenant (lectura independiente de la sesión del navegador). */
export const programStatus = async (code: string): Promise<number> => (await call('GET', `/programs/${code}`, { tenant: TENANT_A, token: await adminToken(TENANT_A) })).status;

/** Ningún programa nuevo en el tenant: el total sigue en la semilla (24) y PRG-025 responde 404. */
export const noNewProgramChecks = async (): Promise<readonly Check[]> => {
  const token = await adminToken(TENANT_A);
  const list = await call('GET', '/programs', { tenant: TENANT_A, token });
  const total = field(list.body, 'totalAll');
  const next = await call('GET', '/programs/PRG-025', { tenant: TENANT_A, token });
  return [
    check(total === 24, 'ningún programa nuevo: el tenant sigue con 24 programas', `el tenant tiene ${String(total)} programas`),
    check(next.status === 404, 'no se asigna el código PRG-025', `PRG-025 responde ${next.status}`),
  ];
};

// --- Comprobaciones ------------------------------------------------------------------------------------------------------------

/** Un texto visible exacto (aviso, paso, valor de un campo). */
export const textCheck = (observed: string | undefined, expected: string, what: string): Check =>
  check(observed === expected, `${what} «${expected}»`, `${what} «${observed ?? '(sin leer)'}»`);

/** Un aviso de campo (role alerta con id de prueba): su texto exacto, o «no se ve». */
export const alertTextCheck = async (target: Locator, expected: string, what: string): Promise<Check> => {
  const seen = await isVisible(target);
  const text = seen ? await textOf(target) : undefined;
  return check(seen && text === expected, `${what} «${expected}»`, seen ? `${what} «${text ?? '(sin leer)'}»` : `no se ve ${what}`);
};

/** Un campo muestra el valor esperado: espera (con el techo local) a que lo muestre; una lectura fallida no cuenta. */
export const fieldValueCheck = async (target: Locator, expected: string, what: string, ceiling: number = LOCAL_MS): Promise<Check> => {
  const waited = await waitUntil(async () => (await valueOf(target)) === expected, ceiling);
  const observed = await valueOf(target);
  return check(waited.reached, `${what} muestra ${expected}`, `${what} muestra ${observed ?? '(sin leer)'}`);
};

/** Un `select` muestra la etiqueta de la opción esperada (lo que ve la persona, no el valor interno). Espera con el techo local. */
export const selectedLabelCheck = async (target: Locator, expected: string, what: string, ceiling: number = LOCAL_MS): Promise<Check> => {
  const read = (): Promise<string | undefined> => safe(() => target.evaluate((element: HTMLSelectElement) => element.options[element.selectedIndex]?.text ?? ''), undefined);
  const waited = await waitUntil(async () => (await read()) === expected, ceiling);
  return check(waited.reached, `${what} muestra «${expected}»`, `${what} muestra «${(await read()) ?? '(sin leer)'}»`);
};

/** Un elemento que NO debe existir en pantalla: cuenta 0 (una lectura fallida, con -1, no cuenta como ausente). */
export const absentCheck = async (target: Locator, what: string): Promise<Check> => {
  const count = await safe(() => target.count(), -1);
  return check(count === 0, `no hay ${what}`, count < 0 ? `no se pudo leer ${what}` : `hay ${count} ${what}`);
};

/** Un paso del asistente que NO avanza: se observa durante el tiempo de la prueba (2 s) y debe seguir en ese paso. */
export const stayedInStep = async (page: Page, step: number): Promise<Check> => {
  const expected = `Paso ${step} de 3`;
  const held = await holdsFor(async () => (await wizardStepText(page)) === expected, HOLD_MS);
  return check(held.held, `sigue en «${expected}» durante 2 s`, `cambió de paso a los ${held.brokeAtMs ?? '?'} ms`);
};

/** Valor de una fila del resumen del paso 3 (`dt` → `dd`), o `undefined` si no hay esa etiqueta. */
export const summaryValue = async (page: Page, label: string): Promise<string | undefined> => {
  const summary = wizardOf(page).getByTestId(PROGRAMAS_TESTIDS.PROGRAMS_WIZARD_SUMMARY);
  const labels = await safe(() => summary.locator('dt').allTextContents(), [] as string[]);
  const index = labels.findIndex((text) => text.trim() === label);
  if (index < 0) return undefined;
  return textOf(summary.locator('dd').nth(index));
};

/** Un valor del resumen igual al esperado (tolerando solo la tipografía de los espacios de Intl). Espera con el techo de red. */
export const summaryCheck = async (page: Page, label: string, expected: string): Promise<Check> => {
  const waited = await waitUntil(async () => sameTypography(await summaryValue(page, label), expected), NET_MS);
  const observed = await summaryValue(page, label);
  return check(waited.reached, `el resumen muestra ${label} «${expected}»`, `el resumen muestra ${label} «${observed ?? '(sin leer)'}»`);
};

/** Un elemento visible o no, con lectura estricta (un fallo de lectura no cuenta como visible). */
export const visibleCheck = async (target: Locator, expected: string): Promise<Check> => {
  const seen = await isVisible(target);
  return check(seen, `ve ${expected}`, seen ? `ve ${expected}` : `no ve ${expected}`);
};

/** Un botón deshabilitado con su motivo en `title` (lectura fallida = no cumple). */
export const disabledWithReason = async (target: Locator, reason: string, label: string): Promise<Check> => {
  const disabled = await safe(() => target.first().isDisabled({ timeout: 500 }), undefined);
  const title = await attrOf(target, 'title');
  return check(disabled === true && title === reason, `«${label}» deshabilitado con motivo «${reason}»`, `«${label}» ${disabled === undefined ? '(sin leer)' : disabled ? 'deshabilitado' : 'habilitado'}, motivo «${title ?? '(sin motivo)'}»`);
};

/** Un botón habilitado o deshabilitado: espera (con el techo local) al estado pedido; una lectura fallida no cuenta. */
export const enabledCheck = async (target: Locator, expectEnabled: boolean, label: string): Promise<Check> => {
  const waited = await waitUntil(async () => (await safe(() => target.first().isDisabled({ timeout: 500 }), undefined)) === !expectEnabled, LOCAL_MS);
  const disabled = await safe(() => target.first().isDisabled({ timeout: 500 }), undefined);
  const wanted = expectEnabled ? 'habilitado' : 'deshabilitado';
  return check(waited.reached, `«${label}» ${wanted}`, `«${label}» ${disabled === undefined ? '(sin leer)' : disabled ? 'deshabilitado' : 'habilitado'}`);
};

/** Una casilla o un radio marcado (o no): lectura fallida = no cumple. */
export const checkedCheck = async (target: Locator, expected: boolean, what: string, ceiling: number = LOCAL_MS): Promise<Check> => {
  const waited = await waitUntil(async () => (await safe(() => target.first().isChecked({ timeout: 500 }), undefined)) === expected, ceiling);
  const observed = await safe(() => target.first().isChecked({ timeout: 500 }), undefined);
  return check(waited.reached, `${what} ${expected ? 'marcado' : 'sin marcar'}`, `${what} ${observed === undefined ? '(sin leer)' : observed ? 'marcado' : 'sin marcar'}`);
};

/** El programa tal como está en el tenant (oráculo por API con el administrador), o `undefined` si no existe. */
export const programNow = async (code: string): Promise<Record<string, unknown> | undefined> => {
  const result = await call('GET', `/programs/${code}`, { tenant: TENANT_A, token: await adminToken(TENANT_A) });
  return result.status === 200 && typeof result.body === 'object' && result.body !== null ? (result.body as Record<string, unknown>) : undefined;
};

/** Compara importes y fechas tolerando solo los espacios de no ruptura de Intl (tipografía, no texto distinto). */
export const sameTypography = (actual: string | undefined, expected: string): boolean => actual !== undefined && actual.replace(/[\u00a0\u202f]/g, ' ') === expected.replace(/[\u00a0\u202f]/g, ' ');

/** La URL de la página, sin el origen ni la cadena de consulta. */
export const currentPath = (page: Page): string => pathOf(page);
