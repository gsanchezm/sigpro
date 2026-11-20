import type { BrowserContext, Locator, Page, Request } from '@playwright/test';
import { PERFIL_TESTIDS, PROGRAMAS_DYNAMIC_TESTIDS } from '../../../../packages/shared/src/testids';
import { NO_CHAOS, field, readConfig, setChaos, type ApiResult, type ChaosFlags } from '../../../story-runs/support/api';
import { TENANT_A } from '../../../story-runs/support/prepare';
import { ACTION, CEILING_MS, isVisible, linesOf, pathOf, safe, waitUntil } from '../../support/browser';
import { check, conclude, preparationFailed, sleep, type Check } from '../../support/checks';
import { notExecutable, outcome, type BrowserRowHandler, type Outcome } from '../../core/framework';

// Piezas comunes de las filas de «Perfil» en la web (1440 px). Los localizadores van por rol y nombre accesible, acotados a la
// página «Perfil» (`profile-page`): la cabecera repite el avatar y tiene su propio selector de idioma. Donde la pantalla no ofrece
// otro rastro se usa el identificador de prueba de `testids.ts` (respaldo). Cada lectura espera con techo y nunca cuenta como
// cumplida si falla: un control ausente da «no aparece» (discrepancia), y ambiguo o no legible dan no ejecutable.

export const TENANT = TENANT_A;
export const LOGIN_PATH = `/login?tenant=${TENANT}`;
/** Código del segundo paso de admin@sigpro.test (lo dice la historia). */
export const MFA_CODE = '123456';
export const SAVED = 'Preferencias guardadas';
export const NO_CHANGES = 'No hay cambios que guardar';
export const TOAST_KEY = '__perfilToasts';
/** Ventana en la que se muestrean los textos alternos (el ciclo del modo caos es de 2,5 s). */
export const ALTERNATION_MS = 6_000;
export const SAMPLE_MS = 100;
/** Tolerancia de un intervalo del modo caos alrededor de sus 2,5 s. */
export const INTERVAL_MIN_MS = 2_000;
export const INTERVAL_MAX_MS = 3_000;

export const COOKIE_NOTE = 'La prueba fija solo la preferencia de cookies (sigpro.cookies = accepted) antes de abrir la app, como en el resto de épicas: el aviso de cookies no se ejerce aquí.';
export const PREP_NOTE = 'Preparación: el reinicio envía solo el token del administrador del tenant (el tenant sale del token; la cabecera x-tenant no cambia nada) y cada fila arranca con un contexto nuevo, sin preferencias ni sesión guardadas.';
/** Las preferencias no tienen endpoint: su persistencia se mira en la propia página (recarga o reapertura), no por la API. */
export const NO_ENDPOINT_NOTE = 'Las preferencias no tienen endpoint de API: su persistencia se comprueba por la recarga o la reapertura de la página, no por GET.';
export const TOOLTIP_NOTE = 'La explicación «al pasar el cursor» se lee del atributo title del botón: el tooltip nativo no es observable en el navegador headless.';
export const DIGEST_NOTE = 'El resumen semanal es simulado y no tiene endpoint: el oráculo de «no envía correo» es la ausencia de peticiones de escritura (no GET) durante el guardado.';
export const HEADER_OBSERVATION_NOTE = 'Observación sin veredicto (no es regla de la historia): cambiar idioma o tema desde la cabecera con /profile abierto no actualiza el borrador (ProfilePage.tsx:38-42).';
export const CHAOS_ORDER_NOTE = 'El caos de textos alternos se activa ANTES de iniciar sesión: la web lee la configuración al autenticarse (apps/web/src/state/config.tsx:37-40).';
export const NOT_APPLIED_NOTE = 'Regla «cambiar un control no aplica nada»: solo se mira el tema (html[data-theme] sigue «light» durante el borrador); el interruptor y la casilla no tienen fila que lo pruebe.';
export const RESET_VALUE_NOTE = 'Regla «si un control vuelve a su valor guardado, Guardar vuelve a deshabilitarse»: solo se prueba con el idioma (fila 002 E1 F3); tema, interruptor y casilla no tienen fila.';

// Envoltorios de notas: cada fila de la superficie añade su nota común (sin cambiar el veredicto).
export const withNote =
  (note: string) =>
  (handler: BrowserRowHandler): BrowserRowHandler =>
  async (row, fixtures) => {
    const result = await handler(row, fixtures);
    return { ...result, note: result.note === undefined ? note : `${result.note} ${note}` };
  };
export const withCookieNote = withNote(`${COOKIE_NOTE} ${PREP_NOTE}`);

/** Las tres secciones que la página «Perfil» tiene con su título. */
export const SECTIONS: readonly string[] = ['Cuenta', 'Qué puedes hacer con tu rol', 'Preferencias'];
/** Los seis permisos en el orden de la historia. */
export const PERMISSION_ORDER: readonly string[] = ['Abrir no conformidades', 'Mover no conformidades', 'Cerrar no conformidades', 'Editar hitos', 'Administrar usuarios', 'Ver la auditoría'];
/** Columna de la tabla → texto del permiso. */
export const PERMISSION_COLUMNS: ReadonlyMap<string, string> = new Map<string, string>([
  ['abrir_nc', 'Abrir no conformidades'],
  ['mover_nc', 'Mover no conformidades'],
  ['cerrar_nc', 'Cerrar no conformidades'],
  ['editar_hitos', 'Editar hitos'],
  ['administrar_usuarios', 'Administrar usuarios'],
  ['ver_auditoria', 'Ver la auditoría'],
]);

/** Celda de permiso → glifo y texto de estado que la historia espera (el texto de «Permitido» solo lo lee un lector de pantalla). */
export interface PermissionCell {
  readonly mark: string;
  readonly status: string;
}
export const PERMISSION_CELLS: ReadonlyMap<string, PermissionCell> = new Map<string, PermissionCell>([
  ['✓ «Permitido»', { mark: '✓', status: 'Permitido' }],
  ['— «No permitido»', { mark: '—', status: 'No permitido' }],
]);

/** Contraseñas que citan las historias (las de las cuentas del seed): una celda con otra contraseña lanza, nunca se ignora. */
export const PASSWORDS: ReadonlyMap<string, string> = new Map<string, string>([
  ['Admin1234!', 'Admin1234!'],
  ['Gestor1234!', 'Gestor1234!'],
  ['Consul1234!', 'Consul1234!'],
  ['Audit1234!', 'Audit1234!'],
  ['Alumno1234!', 'Alumno1234!'],
]);

/** Cuentas que citan las historias. `mfa` dice si el seed pide segundo paso (solo admin@sigpro.test). */
export const ACCOUNTS: ReadonlyMap<string, { readonly mfa: boolean }> = new Map<string, { readonly mfa: boolean }>([
  ['admin@sigpro.test', { mfa: true }],
  ['gestor@sigpro.test', { mfa: false }],
  ['consultor@sigpro.test', { mfa: false }],
  ['auditor@sigpro.test', { mfa: false }],
  ['alumno01@sigpro.lab', { mfa: false }],
]);

/** Controles interactivos: no deben existir dentro de la sección «Cuenta» (que solo se lee). */
export const CONTROL_SELECTOR = 'input, select, textarea, button, a[href], summary, [tabindex], [role="button"], [role="combobox"], [role="textbox"], [role="switch"], [role="checkbox"], [role="radio"], [role="link"], [contenteditable="true"]';

// --- Resultado de una lectura -----------------------------------------------------------------------------------------------

export type Read<T> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly reason: string };

const firstLine = (error: unknown): string => (error instanceof Error ? error.message : String(error)).split('\n')[0] ?? 'error';

/** Lee un control: `ok` solo si existe exactamente uno y la lectura no falla; si no, el motivo (no aparece, ambiguo, no legible). */
export const readOne = async <T>(target: Locator, read: (found: Locator) => Promise<T>): Promise<Read<T>> => {
  try {
    const count = await target.count();
    if (count === 0) return { ok: false, reason: 'no aparece' };
    if (count > 1) return { ok: false, reason: `${count} elementos (ambiguo)` };
    return { ok: true, value: await read(target) };
  } catch (error) {
    return { ok: false, reason: `no legible (${firstLine(error)})` };
  }
};

export const visibleOf = (found: Locator): Promise<boolean> => found.isVisible({ timeout: 1000 });
export const disabledOf = (found: Locator): Promise<boolean> => found.isDisabled({ timeout: 1000 });
export const checkedOf = (found: Locator): Promise<boolean> => found.isChecked({ timeout: 1000 });
export const textNodeOf = (found: Locator): Promise<string> => found.innerText({ timeout: 1000 });
export const titleOf = (found: Locator): Promise<string | null> => found.getAttribute('title', { timeout: 1000 });

/** Lectura de un control de estado con espera: espera (con techo) a que esté como se pide y devuelve la última lectura. */
export const checkedSettled = async (target: Locator, want: boolean, ceilingMs: number = 3_000): Promise<Read<boolean>> => {
  await waitUntil(async () => {
    const current = await readOne(target, checkedOf);
    return current.ok && current.value === want;
  }, ceilingMs);
  return readOne(target, checkedOf);
};

// --- Localizadores --------------------------------------------------------------------------------------------------------

export const rootOf = (page: Page): Locator => page.getByTestId(PERFIL_TESTIDS.PROFILE_PAGE);
export const profileTitle = (page: Page, name: string = 'Perfil'): Locator => rootOf(page).getByRole('heading', { name, level: 1, exact: true });
export const sectionHeading = (page: Page, name: string): Locator => rootOf(page).getByRole('heading', { name, level: 2, exact: true });
/** La sección «Cuenta»: el padre de su encabezado (la sección en la web, la tarjeta en la app móvil). */
export const accountSection = (page: Page): Locator => sectionHeading(page, 'Cuenta').locator('xpath=..');
export const saveButton = (page: Page): Locator => rootOf(page).getByRole('button', { name: /^Guardar( cambios)?$/ });
/** Su nombre accesible («Idioma de la interfaz») cambia con el idioma guardado: se localiza por su identificador de prueba. */
export const langSelect = (page: Page): Locator => rootOf(page).getByTestId(PERFIL_TESTIDS.PROFILE_LANG);
export const themeRadio = (page: Page, name: string): Locator => rootOf(page).getByRole('radio', { name, exact: true });
export const liveSwitch = (page: Page): Locator => rootOf(page).getByRole('switch', { name: 'Notificaciones en tiempo real', exact: true });
export const digestBox = (page: Page): Locator => rootOf(page).getByRole('checkbox', { name: 'Recibir un resumen semanal por correo (simulado)', exact: true });
export const permissionItems = (page: Page): Locator => rootOf(page).getByTestId(PERFIL_TESTIDS.PROFILE_PERMISSIONS).getByRole('listitem');

export const loginHeading = (page: Page): Locator => page.getByRole('heading', { name: 'Iniciar sesión', exact: true });
const emailField = (page: Page): Locator => page.getByLabel('Correo electrónico', { exact: true });
const passwordField = (page: Page): Locator => page.getByLabel('Contraseña', { exact: true });
const enterButton = (page: Page): Locator => page.getByRole('button', { name: 'Entrar', exact: true });
const mfaHeading = (page: Page): Locator => page.getByRole('heading', { name: 'Verificación en dos pasos', exact: true });
const codeField = (page: Page): Locator => page.getByLabel('Código de verificación', { exact: true });
const verifyButton = (page: Page): Locator => page.getByRole('button', { name: 'Verificar', exact: true });
const userMenu = (page: Page): Locator => page.getByRole('button', { name: 'Menú de usuario', exact: true });
const menuProfile = (page: Page): Locator => page.getByRole('menuitem', { name: 'Perfil', exact: true });
const sidebarPrograms = (page: Page): Locator => page.getByRole('link', { name: 'Programas', exact: true }).or(page.getByTestId(PROGRAMAS_DYNAMIC_TESTIDS.NAV('programs')));

// --- Pantallas ------------------------------------------------------------------------------------------------------------

export const onProfile = async (page: Page): Promise<boolean> => pathOf(page) === '/profile' && (await isVisible(profileTitle(page)));
/** La app abierta con sesión: ruta /programs y el menú de usuario de la cabecera. */
export const isShell = async (page: Page): Promise<boolean> => pathOf(page) === '/programs' && (await isVisible(userMenu(page)));
const isMfa = (page: Page): Promise<boolean> => isVisible(mfaHeading(page));
const alertText = async (page: Page): Promise<string | undefined> => linesOf(await safe(() => page.getByRole('alert').first().innerText({ timeout: 1000 }), undefined))[0];

// --- Diagnóstico de acciones que fallan ----------------------------------------------------------------------------------

/** Lo que se registra de una acción que falla: primeras líneas del error, la llamada «intercepts pointer events» y qué recibe el clic. */
export interface Failure {
  readonly message: string;
  readonly note: string;
}

/** Se ejecuta en el navegador: describe el elemento y el que recibe el clic en su centro. No usa variables de fuera. */
const probeElement = (node: Element): { readonly target: string; readonly inside: boolean; readonly hit: string } => {
  const describe = (element: Element): string => {
    const testid = element.getAttribute('data-testid');
    const aria = element.getAttribute('aria-label');
    const text = (element.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 40);
    return `${element.tagName.toLowerCase()}${testid === null ? '' : `[data-testid="${testid}"]`}${aria === null ? '' : ` aria-label="${aria}"`}${text === '' ? '' : ` «${text}»`}`;
  };
  const box = node.getBoundingClientRect();
  const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
  return { target: describe(node), inside: hit !== null && (hit === node || node.contains(hit)), hit: hit === null ? '(ninguno)' : describe(hit) };
};

/** Diagnóstico de un fallo: tres primeras líneas del error, la llamada que lo bloquea y lo que recibe el clic en el centro del elemento. */
export const describeFailure = async (target: Locator | undefined, what: string, error: unknown): Promise<Failure> => {
  const text = error instanceof Error ? error.message : String(error);
  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '');
  const intercept = lines.find((line) => line.includes('intercepts pointer events'));
  const message = `no se pudo ${what}: ${lines.slice(0, 3).join(' · ')}${intercept === undefined ? '' : ` · llamada: ${intercept}`}`;
  if (target === undefined) return { message, note: 'La acción no tenía un elemento localizado (navegación o teclado).' };
  const present = await safe(() => target.count(), 0);
  if (present === 0) return { message: `${message} · el elemento no está en la página`, note: 'El elemento no está en el DOM en el momento del fallo.' };
  const probe = await safe(() => target.first().evaluate(probeElement), undefined);
  if (probe === undefined) return { message: `${message} · no se pudo leer la geometría del elemento`, note: 'No se pudo comprobar qué tapa el elemento.' };
  return {
    message: `${message} · ${probe.target} recibe el clic en su centro: ${probe.hit}`,
    note: probe.inside ? 'El elemento recibe el clic en su centro, pero la acción no se completó (ver el mensaje de Playwright).' : `Otro elemento tapa el control: ${probe.hit}.`,
  };
};

export interface DiagnosedStep {
  readonly what: string;
  readonly act: () => Promise<unknown>;
  readonly target?: Locator;
}

/** Ejecuta los pasos en orden y se detiene en el primero que falla, con su diagnóstico. Nunca lanza por un fallo de acción. */
export const runDiagnosed = async (steps: readonly DiagnosedStep[]): Promise<Failure | undefined> => {
  for (const step of steps) {
    try {
      await step.act();
    } catch (error) {
      return describeFailure(step.target, step.what, error);
    }
  }
  return undefined;
};

// --- Resultados de una fila -----------------------------------------------------------------------------------------------

/**
 * Fila no ejecutable: la pantalla no se alcanzó o un localizador, un clic o una lectura no se pudieron hacer (el motivo y el
 * diagnóstico van como evidencia). No es un hallazgo sobre la app.
 */
export const notReached = (expected: string, failure: string | Failure): Outcome => {
  const message = typeof failure === 'string' ? failure : failure.message;
  const note = typeof failure === 'string' ? '' : ` ${failure.note}`;
  return { ...notExecutable(expected, `pantalla no alcanzada o error del arnés: ${message}.${note}`), evidence: { error: message } };
};

/** La app no ofrece lo que la historia da por hecho, con la pantalla correcta visible: es una discrepancia con su motivo. */
export const notOffered = (expected: string, observed: string, note: string): Outcome => outcome(false, expected, observed, { note });

/**
 * Veredicto de una fila a partir de sus comprobaciones. Una lectura que no se pudo hacer («no legible», «ambiguo») no cuenta como
 * cumplida ni como incumplida: la fila es no ejecutable. Una discrepancia lleva en `note` en qué difiere de la historia.
 */
export const concluded = (checks: readonly Check[], extra: Pick<Outcome, 'note' | 'evidence'> = {}): Outcome => {
  const expected = checks.map((entry) => entry.expected).join('; ');
  const unreadable = checks.filter((entry) => !entry.ok && /no legible|ambiguo/.test(entry.observed));
  if (unreadable.length > 0) return notReached(expected, `lectura no fiable: ${unreadable.map((entry) => `«${entry.expected}» (${entry.observed})`).join(' · ')}`);
  const failed = checks.filter((entry) => !entry.ok);
  const differs = failed.length === 0 ? undefined : `En qué difiere de la historia: ${failed.map((entry) => `«${entry.expected}» (observado: ${entry.observed})`).join('; ')}.`;
  const note = [differs, extra.note].filter((part) => part !== undefined && part !== '').join(' ');
  return conclude(checks, { ...extra, ...(note === '' ? {} : { note }) });
};

// --- Preparación común ----------------------------------------------------------------------------------------------------

/** Fija SOLO la preferencia de cookies antes de abrir la app: el aviso tapa zonas de la página y no es una sesión. */
export const fixCookiePreference = (): void => {
  try {
    localStorage.setItem('sigpro.cookies', 'accepted');
  } catch {
    // sin almacenamiento no hay preferencia que fijar
  }
};

/** Registro de avisos de la página (`toast-ok|danger|info|warn`), armado antes de cualquier acción por un script de inicio. */
export const recordToasts = (key: string): void => {
  const registry = window as unknown as Record<string, unknown>;
  if (Array.isArray(registry[key])) return;
  const log: { tone: string; title: string; body: string; at: number }[] = [];
  registry[key] = log;
  const toneOf = (element: Element): string | undefined => /^toast-(ok|danger|info|warn)$/.exec(element.getAttribute('data-testid') ?? '')?.[1];
  const record = (element: Element, tone: string): void => {
    // El «×» de cierre no forma parte del mensaje
    const lines = (element as HTMLElement).innerText
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line !== '' && line !== '×');
    log.push({ tone, title: lines[0] ?? '', body: lines[1] ?? '', at: Date.now() });
  };
  const scan = (node: Node): void => {
    if (!(node instanceof Element)) return;
    const own = toneOf(node);
    if (own !== undefined) record(node, own);
    node.querySelectorAll('[data-testid^="toast-"]').forEach((element) => {
      const tone = toneOf(element);
      if (tone !== undefined) record(element, tone);
    });
  };
  new MutationObserver((mutations) => mutations.forEach((mutation) => mutation.addedNodes.forEach(scan))).observe(document, { childList: true, subtree: true });
};

export interface ToastEntry {
  readonly tone: string;
  readonly title: string;
  readonly body: string;
  readonly at: number;
}

/** Instala en el contexto los dos scripts de inicio: la preferencia de cookies y el registro de avisos. Antes de cualquier navegación. */
export const installInitScripts = async (context: BrowserContext): Promise<void> => {
  await context.addInitScript(fixCookiePreference);
  await context.addInitScript(recordToasts, TOAST_KEY);
};

/** Registro de avisos de la página: `undefined` si no se puede leer (un error no es «ningún aviso»). */
export const toastLog = (page: Page): Promise<readonly ToastEntry[] | undefined> =>
  safe<readonly ToastEntry[] | undefined>(() => page.evaluate((key: string) => ((window as unknown as Record<string, unknown>)[key] as ToastEntry[] | undefined) ?? [], TOAST_KEY), undefined);

/** Espera (con techo) a que aparezca en el registro un aviso con ese texto. Devuelve el aviso y si el registro se pudo leer. */
export const awaitToast = async (page: Page, title: string): Promise<{ readonly entry: ToastEntry | undefined; readonly reached: boolean; readonly log: readonly ToastEntry[] | undefined }> => {
  const waited = await waitUntil(async () => ((await toastLog(page)) ?? []).some((item) => item.title === title), CEILING_MS);
  const log = await toastLog(page);
  return { entry: log?.find((item) => item.title === title), reached: waited.reached, log };
};

/** Registro de escrituras de red (no GET) desde que se llama hasta `stop()`: sirve para «no envía ningún correo». */
export const watchWrites = (page: Page): { readonly writes: string[]; readonly stop: () => void } => {
  const writes: string[] = [];
  const listener = (request: Request): void => {
    if (request.method() !== 'GET') writes.push(`${request.method()} ${new URL(request.url()).pathname}`);
  };
  page.on('request', listener);
  return { writes, stop: () => page.off('request', listener) };
};

// --- Entrar y llegar a «Perfil» --------------------------------------------------------------------------------------------

/**
 * Inicia sesión con el formulario de la propia app (nunca inyectando una sesión) y, si la cuenta pide segundo paso, lo completa con
 * el código de la historia. Devuelve el resultado de la fila si no se llega a /programs, o `undefined` si se llega.
 */
export const signInWeb = async (page: Page, expected: string, email: string, password: string, mfa: boolean): Promise<Outcome | undefined> => {
  const opened = await runDiagnosed([
    { what: `abrir ${LOGIN_PATH}`, act: () => page.goto(LOGIN_PATH, { timeout: CEILING_MS }) },
    { what: 'ver el título «Iniciar sesión»', act: () => loginHeading(page).waitFor({ timeout: CEILING_MS }), target: loginHeading(page) },
    { what: 'escribir el correo', act: () => emailField(page).fill(email, ACTION), target: emailField(page) },
    { what: 'escribir la contraseña', act: () => passwordField(page).fill(password, ACTION), target: passwordField(page) },
    { what: 'pulsar «Entrar»', act: () => enterButton(page).click(ACTION), target: enterButton(page) },
  ]);
  if (opened) return notReached(expected, opened);
  // Espera primero a la verificación o a la app; el aviso de error solo se lee si ninguna de las dos llega
  await waitUntil(async () => (await isMfa(page)) || (await isShell(page)), CEILING_MS);
  if (await isMfa(page)) return completeSecondStep(page, expected, mfa);
  if (await isShell(page)) return mfa ? outcome(false, expected, `entra sin segundo paso (ruta ${pathOf(page)})`, { note: 'La historia da por hecho el segundo paso de esta cuenta.' }) : undefined;
  const alert = await alertText(page);
  if (alert !== undefined) return outcome(false, expected, `la app rechaza la cuenta: «${alert}»`, { note: 'La cuenta no inicia sesión como dice la historia.' });
  return outcome(false, expected, `tras «Entrar» sigue en ${pathOf(page)} sin aviso`, { note: 'La cuenta no inicia sesión como dice la historia.' });
};

/** El segundo paso de la cuenta: el código de la historia (tecla a tecla, como una persona), «Verificar» y llegar a /programs. */
const completeSecondStep = async (page: Page, expected: string, mfa: boolean): Promise<Outcome | undefined> => {
  if (!mfa) return outcome(false, expected, 'pide un segundo paso', { note: 'La historia no pide segundo paso a esta cuenta.' });
  const sent = await runDiagnosed([
    { what: 'limpiar «Código de verificación»', act: () => codeField(page).fill('', ACTION), target: codeField(page) },
    { what: 'escribir el código 123456', act: () => codeField(page).pressSequentially(MFA_CODE, { delay: 0 }), target: codeField(page) },
    { what: 'pulsar «Verificar»', act: () => verifyButton(page).click(ACTION), target: verifyButton(page) },
  ]);
  if (sent) return notReached(expected, sent);
  const arrived = await waitUntil(() => isShell(page));
  return arrived.reached ? undefined : outcome(false, expected, `tras «Verificar» no llega a /programs (ruta ${pathOf(page)})`, { note: 'El segundo paso no deja la sesión abierta.' });
};

/** Desde la app abierta, «Menú de usuario» → «Perfil». La app debe ofrecer «Perfil» con /programs visible. */
export const openProfileWeb = async (page: Page, expected: string): Promise<Outcome | undefined> => {
  const opened = await runDiagnosed([{ what: 'abrir el menú de usuario', act: () => userMenu(page).click(ACTION), target: userMenu(page) }]);
  if (opened) return notReached(expected, opened);
  const offered = await waitUntil(() => isVisible(menuProfile(page)), 3_500);
  if (!offered.reached) return notOffered(expected, `con «Programas» visible, el menú de usuario no ofrece «Perfil» (ruta ${pathOf(page)})`, 'La app no ofrece «Perfil» en el menú de usuario.');
  const clicked = await runDiagnosed([{ what: 'pulsar «Perfil»', act: () => menuProfile(page).click(ACTION), target: menuProfile(page) }]);
  if (clicked) return notReached(expected, clicked);
  const arrived = await waitUntil(() => onProfile(page));
  return arrived.reached ? undefined : outcome(false, expected, `tras «Perfil» la ruta es ${pathOf(page)}`, { note: 'No se llega a /profile desde el menú de usuario.' });
};

/** Sale de «Perfil» a «Programas» por la barra lateral (en la app, sin recargar) y vuelve a «Perfil» por el menú de usuario. */
export const leaveAndReturnWeb = async (page: Page, expected: string): Promise<Outcome | undefined> => {
  const left = await runDiagnosed([{ what: 'pulsar «Programas» en la barra lateral', act: () => sidebarPrograms(page).click(ACTION), target: sidebarPrograms(page) }]);
  if (left) return notReached(expected, left);
  const inShell = await waitUntil(() => isShell(page));
  if (!inShell.reached) return outcome(false, expected, `tras «Programas» la ruta es ${pathOf(page)}`, { note: 'La barra lateral no lleva a /programs.' });
  return openProfileWeb(page, expected);
};

// --- Lecturas de la página ------------------------------------------------------------------------------------------------

/** Comprobaciones de llegada: la ruta, el título y las secciones que la historia nombra. */
export const arrivalChecks = async (page: Page, sections: readonly string[]): Promise<Check[]> => {
  const path = pathOf(page);
  const title = await readOne(profileTitle(page), visibleOf);
  const checks: Check[] = [
    check(path === '/profile', 'está en /profile', `está en ${path}`),
    check(title.ok && title.value, 'título «Perfil»', title.ok ? (title.value ? 'título «Perfil» visible' : 'título no visible') : `título: ${title.reason}`),
  ];
  for (const section of sections) {
    const heading = await readOne(sectionHeading(page, section), visibleOf);
    checks.push(check(heading.ok && heading.value, `tiene la sección «${section}»`, heading.ok ? (heading.value ? `sección «${section}» visible` : 'sección no visible') : `sección «${section}»: ${heading.reason}`));
  }
  return checks;
};

/** Comprobación del título de la página (con espera: el título cambia tras guardar en otro idioma). */
export const profileTitleCheck = async (page: Page, name: string): Promise<Check> => {
  await waitUntil(() => isVisible(profileTitle(page, name)), 3_000);
  const title = await readOne(profileTitle(page, name), visibleOf);
  return check(title.ok && title.value, `el título de la página es «${name}»`, title.ok ? (title.value ? `título «${name}» visible` : 'título no visible') : title.reason);
};

// --- La cuenta: pares etiqueta → valor, avatar e iniciales ---------------------------------------------------------------

/** Iniciales por la regla de la historia: la primera letra de las dos primeras palabras, en mayúsculas. */
export const initialsOf = (name: string): string =>
  name
    .split(/\s+/)
    .filter((word) => word !== '')
    .slice(0, 2)
    .map((word) => word.charAt(0))
    .join('')
    .toUpperCase();

/** Comprobaciones de un dato de la cuenta: la fila (etiqueta y valor, par `dt`/`dd` o Text de etiqueta y de valor) y el valor. */
const pairChecks = async (page: Page, testid: string, label: string, value: string): Promise<Check[]> => {
  const read = await readOne(rootOf(page).getByTestId(testid), (found) =>
    found.evaluate((node) => ({ label: (node.previousElementSibling?.textContent ?? '').trim(), value: (node.textContent ?? '').trim() })),
  );
  if (!read.ok) return [check(false, `ve el dato «${label}» con ${value}`, read.reason)];
  return [
    check(read.value.label === label, `la fila del dato se llama «${label}»`, `la etiqueta es «${read.value.label}»`),
    check(read.value.value === value, `ve el ${label.toLowerCase()} ${value}`, `ve el ${label.toLowerCase()} ${read.value.value}`),
  ];
};

/** Texto de iniciales del avatar: en la app móvil es el Text del avatar; en la web, el `<text>` del SVG del `data:` URI. */
export const avatarInitials = async (page: Page): Promise<Read<string>> => {
  const wrapper = rootOf(page).getByTestId(PERFIL_TESTIDS.PROFILE_AVATAR);
  const text = await readOne(wrapper, (found) => found.textContent({ timeout: 1000 }).then((value) => (value ?? '').trim()));
  if (!text.ok) return text;
  if (text.value !== '') return { ok: true, value: text.value };
  return readOne(wrapper.getByRole('img'), async (found) => {
    const src = (await found.getAttribute('src', { timeout: 1000 })) ?? '';
    const svg = decodeURIComponent(src.slice(src.indexOf(',') + 1));
    const captured = /<text[^>]*>([^<]*)<\/text>/.exec(svg)?.[1];
    if (captured === undefined) throw new Error('el SVG del avatar no lleva texto');
    return captured;
  });
};

/** Comprobaciones de la sección «Cuenta»: los cuatro datos (etiqueta y valor), el avatar con su nombre e iniciales, y ningún control. */
export const accountChecks = async (page: Page, correo: string, nombre: string, rol: string): Promise<Check[]> => {
  const rows: readonly (readonly [string, string, string])[] = [
    [PERFIL_TESTIDS.PROFILE_NAME, 'Nombre', nombre],
    [PERFIL_TESTIDS.PROFILE_EMAIL, 'Correo', correo],
    [PERFIL_TESTIDS.PROFILE_ROLE, 'Rol', rol],
    [PERFIL_TESTIDS.PROFILE_TENANT, 'Tenant', TENANT],
  ];
  const checks: Check[] = [];
  for (const [testid, label, value] of rows) {
    checks.push(...(await pairChecks(page, testid, label, value)));
  }
  const avatar = await avatarNamed(page, nombre);
  checks.push(check(avatar === 1, `el avatar tiene como nombre accesible ${nombre}`, avatar === undefined ? 'avatar no legible' : `${avatar} avatar(es) con ese nombre accesible`));
  const expectedInitials = initialsOf(nombre);
  const initials = await avatarInitials(page);
  checks.push(check(initials.ok && initials.value === expectedInitials, `el avatar muestra las iniciales «${expectedInitials}»`, initials.ok ? `el avatar muestra «${initials.value}»` : `avatar: ${initials.reason}`));
  const controls = await controlsInAccount(page);
  checks.push(check(controls === 0, 'ninguno de esos cuatro datos tiene un control para cambiarlo', controls === undefined ? 'controles de «Cuenta» no legibles' : `${controls} controles en la sección «Cuenta»`));
  return checks;
};

/** Número de controles interactivos dentro de la sección «Cuenta» (el encabezado y su sección). */
export const controlsInAccount = async (page: Page): Promise<number | undefined> => safe(() => accountSection(page).locator(CONTROL_SELECTOR).count(), undefined);

/** Cuántos avatares de la cuenta tienen ese nombre accesible. */
export const avatarNamed = async (page: Page, name: string): Promise<number | undefined> =>
  safe(() => rootOf(page).getByTestId(PERFIL_TESTIDS.PROFILE_AVATAR).getByRole('img', { name, exact: true }).count(), undefined);

// --- Permisos: glifo, nombre y estado, con lo que se ve de verdad --------------------------------------------------------

/** Una fila de «Qué puedes hacer con tu rol»: glifo, nombre y estado (tres hijos, en ese orden) y si cada parte se pinta. */
export interface PermissionReading {
  readonly label: string;
  readonly mark: string;
  readonly status: string;
  readonly painted: { readonly mark: boolean; readonly label: boolean; readonly status: boolean };
}

/** Se pinta si es visible y su caja mide más de 1 px (el texto de lector de pantalla tiene 1×1 px y no se ve). */
export const paintedOf = async (found: Locator): Promise<boolean> => {
  if (!(await found.isVisible({ timeout: 1000 }))) return false;
  const box = await found.boundingBox({ timeout: 1000 });
  return box !== null && box.width > 1 && box.height > 1;
};

/** Lee la fila del permiso `label`: texto de cada parte y si se pinta. */
export const readPermission = async (page: Page, label: string): Promise<Read<PermissionReading>> => {
  const read = await readOne(permissionItems(page).filter({ hasText: label }), async (found) => {
    const parts = found.locator('xpath=./*');
    const texts = await parts.allTextContents();
    const painted = [await paintedOf(parts.nth(0)), await paintedOf(parts.nth(1)), await paintedOf(parts.nth(2))];
    return { texts, painted };
  });
  if (!read.ok) return read;
  const [mark = '', name = '', status = ''] = read.value.texts.map((text) => text.trim());
  if (name !== label) return { ok: false, reason: `fila con otro nombre («${name}»)` };
  const [markPainted = false, namePainted = false, statusPainted = false] = read.value.painted;
  return { ok: true, value: { label: name, mark, status, painted: { mark: markPainted, label: namePainted, status: statusPainted } } };
};

/** Comprobaciones de una fila de permiso: el texto del glifo y del estado, que el glifo y el nombre se ven, y que el estado se ve o no (según la superficie). */
export const permissionChecks = (label: string, cellText: string, want: PermissionCell, read: Read<PermissionReading>, statusShownAsText: boolean): Check[] => {
  const expected = `${label} muestra ${cellText}`;
  if (!read.ok) return [check(false, expected, `${label}: ${read.reason}`), check(false, `${label}: el glifo y el nombre se ven`, `${label}: ${read.reason}`)];
  const value = read.value;
  return [
    check(value.mark === want.mark && value.status === want.status, expected, `${value.label} muestra ${value.mark} «${value.status}»`),
    check(value.painted.mark && value.painted.label, `${label}: el glifo y el nombre se ven`, `glifo ${value.painted.mark ? 'visible' : 'no visible'}, nombre ${value.painted.label ? 'visible' : 'no visible'}`),
    check(value.painted.status === statusShownAsText, `${label}: el texto «${want.status}» ${statusShownAsText ? 'se ve' : 'no se ve (solo lector de pantalla)'}`, `texto de estado ${value.painted.status ? 'visible' : 'no visible'}`),
  ];
};

/** Orden de los permisos tal como aparecen en la lista. */
export const permissionOrder = (page: Page): Promise<readonly string[] | undefined> =>
  safe(async () => permissionItems(page).evaluateAll((items) => items.map((item) => (item.children[1]?.textContent ?? '').trim())), undefined);

// --- Estado de «Guardar» y del borrador -----------------------------------------------------------------------------------

/** Estado de «Guardar» en palabras: deshabilitado (con su explicación) o habilitado; o el motivo si no se puede leer. */
export interface SaveState {
  readonly disabled: boolean;
  readonly title: string | null;
}
export const saveState = async (page: Page): Promise<Read<SaveState>> => {
  const disabled = await readOne(saveButton(page), disabledOf);
  if (!disabled.ok) return disabled;
  const title = await readOne(saveButton(page), titleOf);
  return title.ok ? { ok: true, value: { disabled: disabled.value, title: title.value } } : title;
};

export const describeSave = (read: Read<SaveState>): string => {
  if (!read.ok) return read.reason;
  if (!read.value.disabled) return 'habilitado';
  return read.value.title === null ? 'deshabilitado sin explicación' : `deshabilitado con la explicación «${read.value.title}»`;
};

/** Espera a que «Guardar» llegue al estado pedido y lo devuelve (cumpla o no). */
export const settledSave = async (page: Page, wanted: (state: SaveState) => boolean): Promise<Read<SaveState>> => {
  await waitUntil(async () => {
    const current = await saveState(page);
    return current.ok && wanted(current.value);
  }, 3_000);
  return saveState(page);
};

/** Idioma seleccionado en el selector del perfil (el texto de la opción, p. ej. «English»). */
export const selectedLang = (page: Page): Promise<Read<string>> =>
  readOne(langSelect(page), (found) => found.evaluate((element) => (element as HTMLSelectElement).selectedOptions[0]?.textContent ?? '', undefined, { timeout: 1000 }));

/** Idioma del selector con espera: tras guardar en otro idioma el selector cambia de texto un instante después. */
export const selectedLangCheck = async (page: Page, label: string): Promise<Check> => {
  await waitUntil(async () => {
    const current = await selectedLang(page);
    return current.ok && current.value === label;
  }, 3_000);
  const read = await selectedLang(page);
  return check(read.ok && read.value === label, `el selector muestra «${label}»`, read.ok ? `el selector muestra «${read.value}»` : read.reason);
};

/** Tema de la página (`html[data-theme]`): lo que el borrador no debe cambiar hasta «Guardar». Sin espera salvo que se pida. */
export const documentTheme = async (page: Page): Promise<Read<string | null>> => {
  try {
    return { ok: true, value: await page.evaluate(() => document.documentElement.getAttribute('data-theme')) };
  } catch (error) {
    return { ok: false, reason: `no legible (${firstLine(error)})` };
  }
};

export const documentThemeCheck = async (page: Page, want: 'light' | 'dark', expected: string, settle = false): Promise<Check> => {
  if (settle) {
    await waitUntil(async () => {
      const current = await documentTheme(page);
      return current.ok && current.value === want;
    }, 3_000);
  }
  const read = await documentTheme(page);
  return check(read.ok && read.value === want, expected, read.ok ? `html[data-theme] = «${read.value}»` : read.reason);
};

/**
 * Estado inicial «sin cambios» de la historia: idioma «Español», tema «Claro», interruptor activado, casilla desmarcada y «Guardar»
 * deshabilitado con su explicación. Se comprueba antes de cualquier acción de la fila.
 */
export const defaultsChecks = async (page: Page): Promise<Check[]> => {
  const lang = await selectedLang(page);
  const theme = await readOne(themeRadio(page, 'Claro'), checkedOf);
  const live = await readOne(liveSwitch(page), checkedOf);
  const digest = await readOne(digestBox(page), checkedOf);
  const save = await settledSave(page, (state) => state.disabled && state.title === NO_CHANGES);
  return [
    check(lang.ok && lang.value === 'Español', 'el idioma es «Español»', lang.ok ? `el idioma es «${lang.value}»` : lang.reason),
    checkedState(theme, true, 'el tema es «Claro» (marcado)', 'el tema «Claro» está marcado', '«Claro» sin marcar'),
    checkedState(live, true, 'el interruptor «Notificaciones en tiempo real» está activado', 'activado', 'desactivado'),
    checkedState(digest, false, 'la casilla del resumen semanal está desmarcada', 'marcada', 'sin marcar'),
    check(save.ok && save.value.disabled && save.value.title === NO_CHANGES, `«Guardar» está deshabilitado con la explicación «${NO_CHANGES}»`, describeSave(save)),
  ];
};

/** Comprobación de «Guardar» tras una acción: espera (con techo) al estado pedido y lo compara con el texto de la historia. */
export const saveCheck = async (page: Page, expected: string, wanted: (state: SaveState) => boolean): Promise<Check> => {
  const read = await settledSave(page, wanted);
  return check(read.ok && wanted(read.value), `«Guardar» está ${expected}`, describeSave(read));
};

/** Comprueba que el aviso «Preferencias guardadas» aparece en el registro (el «×» no forma parte del mensaje). Si no, muestra lo que hubo. */
export const toastCheck = async (page: Page, expected: string): Promise<Check> => {
  const toast = await awaitToast(page, SAVED);
  if (toast.entry !== undefined) return check(toast.reached, expected, `ve «${toast.entry.title}» (${toast.entry.tone})`);
  if (toast.log === undefined) return check(false, expected, 'sin leer el registro de avisos (no legible)');
  const seen = toast.log.map((entry) => `«${entry.title}» (${entry.tone})`);
  return check(false, expected, `no aparece «${SAVED}»; avisos registrados: ${seen.length === 0 ? 'ninguno' : seen.join(', ')}`);
};

/** Comprueba un control de estado (marcado o activado) frente al valor que dice la historia; una lectura fallida no cumple. */
export const checkedState = (read: Read<boolean>, want: boolean, expected: string, yesWords: string, noWords: string): Check =>
  check(read.ok && read.value === want, expected, read.ok ? (read.value ? yesWords : noWords) : read.reason);

// --- Caos: textos alternos del botón «Guardar» ------------------------------------------------------------------------------

/** Pone el caos del tenant con los textos alternos activados y lo comprueba con `GET /api/config`. Devuelve la fila si falla. */
export const enableFlakyLabels = async (expected: string): Promise<Outcome | undefined> => {
  const flags: ChaosFlags = { latencyMs: 0, errorRate: 0, flakyLabels: true };
  const set: ApiResult = await setChaos(TENANT, flags);
  if (set.status !== 200) return preparationFailed(expected, 'activar los textos alternos (PATCH /api/admin/chaos)', set);
  const config = await readConfig(TENANT);
  const flaky = field(field(config.body, 'chaos'), 'flakyLabels');
  return flaky === true ? undefined : preparationFailed(expected, 'GET /api/config no muestra los textos alternos', config);
};

/** Apaga el caos del tenant y comprueba el 2xx: si no se apaga es un error de la prueba, no una nota. */
export const restoreChaos = async (): Promise<void> => {
  const restored = await setChaos(TENANT, NO_CHAOS);
  if (restored.status !== 200) throw new Error(`No se pudo apagar el caos de ${TENANT}: respuesta ${restored.status} ${JSON.stringify(restored.body).slice(0, 200)}`);
};

/** Un cambio de texto observado en el botón «Guardar», con su instante. */
export interface LabelChange {
  readonly label: string;
  readonly at: number;
}
export interface LabelSample {
  readonly changes: readonly LabelChange[];
  readonly unreadable: number;
}

/** Muestrea el botón «Guardar» durante la ventana y registra las TRANSICIONES de su texto, con su marca de tiempo. */
export const sampleSaveTransitions = async (page: Page): Promise<LabelSample> => {
  const changes: LabelChange[] = [];
  let unreadable = 0;
  const started = Date.now();
  while (Date.now() - started < ALTERNATION_MS) {
    const label = await readOne(saveButton(page), (found) => found.innerText({ timeout: 500 }));
    if (!label.ok) unreadable += 1;
    else {
      const text = label.value.trim();
      const last = changes[changes.length - 1];
      if (last === undefined || last.label !== text) changes.push({ label: text, at: Date.now() });
    }
    await sleep(SAMPLE_MS);
  }
  return { changes, unreadable };
};

/**
 * La historia pide que el texto alterne. Con el modo caos el ciclo es de 2,5 s: se exigen al menos dos transiciones que alternen
 * entre «Guardar» y «Guardar cambios», con intervalos entre 2 y 3 s, y ninguna lectura fallida.
 */
export const alternationCheck = (sample: LabelSample, expected: string): Check => {
  const labels = sample.changes.map((item) => item.label);
  const intervals = sample.changes.slice(1).map((item, index) => item.at - (sample.changes[index]?.at ?? item.at));
  const alternates = labels.length >= 3 && labels.every((label) => label === 'Guardar' || label === 'Guardar cambios') && labels.every((label, index) => index === 0 || label !== labels[index - 1]);
  const timed = intervals.length >= 2 && intervals.every((ms) => ms >= INTERVAL_MIN_MS && ms <= INTERVAL_MAX_MS);
  const path = labels.length === 0 ? '(ninguno legible)' : labels.map((label) => `«${label}»`).join(' → ');
  const observed = `${path}; intervalos ${intervals.length === 0 ? '—' : intervals.map((ms) => `${ms} ms`).join(', ')}${sample.unreadable > 0 ? `; lecturas no legibles: ${sample.unreadable}` : ''}`;
  return check(alternates && timed && sample.unreadable === 0, expected, observed);
};

// --- Acciones de una persona sobre los controles ---------------------------------------------------------------------------

/**
 * Una acción sobre un control de «Perfil». Se hace solo si el control existe, se ve y está habilitado (si no, es una discrepancia).
 * Tras actuar, `applied` comprueba que el control refleja el cambio pedido (si no, la app no lo muestra: discrepancia).
 */
export interface Action {
  readonly what: string;
  readonly target: (page: Page) => Locator;
  /** Actúa sobre el control encontrado; recibe la página por si la acción abre otro elemento (p. ej. una hoja del móvil). */
  readonly act: (found: Locator, page: Page) => Promise<unknown>;
  readonly applied?: (page: Page) => Promise<Check>;
}

export const enabledOf = (found: Locator): Promise<boolean> => found.isEnabled({ timeout: 1000 });

export const chooseLang = (label: 'English' | 'Español'): Action => ({
  what: `cambiar el idioma a «${label}»`,
  target: langSelect,
  act: (found) => found.selectOption({ label }, ACTION),
  applied: (page) => selectedLangCheck(page, label),
});
export const chooseTheme = (name: 'Claro' | 'Oscuro'): Action => ({
  what: `marcar el tema «${name}»`,
  target: (page) => themeRadio(page, name),
  act: (found) => found.check(ACTION),
  applied: async (page) => checkedState(await checkedSettled(themeRadio(page, name), true), true, `la opción «${name}» queda marcada`, 'marcada', 'sin marcar'),
});
export const toggleLive: Action = {
  what: 'pulsar el interruptor «Notificaciones en tiempo real»',
  target: liveSwitch,
  act: (found) => found.click(ACTION),
  applied: async (page) => checkedState(await checkedSettled(liveSwitch(page), false), false, 'el interruptor «Notificaciones en tiempo real» queda desactivado', 'activado', 'desactivado'),
};
export const checkDigest: Action = {
  what: 'marcar la casilla del resumen semanal',
  target: digestBox,
  act: (found) => found.check(ACTION),
  applied: async (page) => checkedState(await checkedSettled(digestBox(page), true), true, 'la casilla del resumen semanal queda marcada', 'marcada', 'sin marcar'),
};
/** Pulsa «Guardar» con el texto que tenga en ese momento (vale «Guardar» o «Guardar cambios»). */
export const pressSave: Action = { what: 'pulsar «Guardar»', target: saveButton, act: (found) => found.click(ACTION) };

/**
 * Ejecuta las acciones en orden. Antes de cada una: si la pantalla no es «Perfil» o el control no se puede leer con exactitud es
 * no ejecutable; si el control no aparece (con «Perfil» visible), no se ve o está deshabilitado, la app no ofrece lo que la historia
 * nombra (discrepancia); si el localizador o el clic fallan, no ejecutable con el diagnóstico. Tras actuar, comprueba el cambio.
 */
export const runActions = async (page: Page, expected: string, actions: readonly Action[]): Promise<Outcome | undefined> => {
  for (const action of actions) {
    const failed = await runAction(page, expected, action);
    if (failed) return failed;
  }
  return undefined;
};

const runAction = async (page: Page, expected: string, action: Action): Promise<Outcome | undefined> => {
  if (!(await onProfile(page))) return notReached(expected, `no está en /profile antes de ${action.what} (ruta ${pathOf(page)})`);
  const target = action.target(page);
  const shown = await readOne(target, visibleOf);
  if (!shown.ok && shown.reason === 'no aparece') return notOffered(expected, `${action.what}: el control no aparece con «Perfil» visible`, 'La app no ofrece el control que la historia nombra.');
  if (!shown.ok) return notReached(expected, `${action.what}: ${shown.reason}`);
  if (!shown.value) return notOffered(expected, `${action.what}: el control existe pero no se ve`, 'La app no muestra el control que la historia nombra.');
  await waitUntil(async () => {
    const enabled = await readOne(target, enabledOf);
    return enabled.ok && enabled.value;
  }, 2_000);
  const enabled = await readOne(target, enabledOf);
  if (!enabled.ok) return notReached(expected, `${action.what}: ${enabled.reason}`);
  if (!enabled.value) return notOffered(expected, `${action.what}: el control está deshabilitado`, 'La app deja deshabilitado un control que la historia manda usar.');
  const failure = await runDiagnosed([{ what: action.what, act: () => action.act(target, page), target }]);
  if (failure) return notReached(expected, failure);
  if (action.applied === undefined) return undefined;
  const reflected = await action.applied(page);
  if (reflected.ok) return undefined;
  return reflected.observed.includes('no legible')
    ? notReached(expected, `${action.what}: ${reflected.observed}`)
    : outcome(false, expected, reflected.observed, { note: `El control no refleja el cambio que pide la historia (${action.what}).` });
};

/** Comprobación de un control de estado de la cuenta: se usa en filas que comprueban «Guardar» tras el cambio. */
export const liveDisabled = async (page: Page, expected: string): Promise<Check> => checkedState(await checkedSettled(liveSwitch(page), false), false, expected, 'activado', 'desactivado');
export const digestMarked = async (page: Page, expected: string): Promise<Check> => checkedState(await checkedSettled(digestBox(page), true), true, expected, 'marcada', 'sin marcar');
export const themeMarked = async (page: Page, name: string, expected: string): Promise<Check> => checkedState(await checkedSettled(themeRadio(page, name), true), true, expected, 'marcada', 'sin marcar');
