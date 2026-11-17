import type { BrowserContext, Locator, Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { uniqueEmail, usersByEmail } from '../../support/api';
import { RESULTS_ROOT } from '../../support/evidence';
import { NEW_ACCOUNT_PASSWORD, type Credentials } from '../../support/prepare';
import { type BrowserRowHandler, type ManifestRow, type Outcome } from '../../support/rows';
import { ACTION, CEILING_MS, check, holdsFor, linesOf, pathOf, requirePrepared, runSteps, safe, waitUntil, type Check } from '../web/common';
// Los ids de prueba salen del fichero compartido (se amplía, nunca se renombra): un cambio de id no deja un sensor mudo
import { ACCESO_TESTIDS, PERFIL_TESTIDS } from '../../../../packages/shared/src/testids';

// Piezas comunes de las historias móviles de EP-LOGIN (US-LOGIN-011 a 016). La app móvil se ejecuta AQUÍ como web de Expo
// (390 × 844, táctil): NO es iOS ni Android nativo. De la web solo se reutilizan las piezas sin pantalla (esperas con techo,
// observación de lo que NO ocurre, lectura de celdas, `check`/`conclude`); las pantallas de la app móvil se localizan aquí.
//
// Criterio de localización: la app móvil conserva en el DOM pantallas que ya no se ven (la pila deja /login bajo /register y la
// pestaña de Programas bajo /profile), así que todo localizador es de ROL (excluye lo oculto) y toda lectura es ESTRICTA: si hay
// más de un elemento, la lectura falla en lugar de coger «el primero». «Estar en una pantalla» = ruta + un elemento propio de ella.

export { cell, fromSteps, strict, quoted, noticeOf, emailOf, passwordOf, ACTION, CEILING_MS, HOLD_MS, REFERENCE_MS, check, conclude, holdsFor, lengthOf, linesOf, pathOf, requirePrepared, runSteps, safe, slowNote, sleep, waitUntil } from '../web/common';
export type { Check } from '../web/common';

export const TENANT = 'alumno01';
export const LOGIN_PATH = '/login';
export const PROGRAMS_PATH = '/programs';
export const PROFILE_PATH = '/profile';

// ---------------------------------------------------------------------------------------------------------------------
// Aproximaciones al sistema nativo (se dicen en `evidence.approximation` y en la nota de la fila)
// ---------------------------------------------------------------------------------------------------------------------

export const VALID_FOR_EXPO_WEB = 'El veredicto vale para Expo web (390 × 844): no se ha comprobado en iOS ni en Android nativo.';

/** «Cierra la app y la vuelve a abrir»: no hay cierre y arranque real de la app en Expo web. */
export const REOPEN_APPROXIMATION =
  'Cerrar la app y volver a abrirla se aproxima cerrando la página y abriendo una página nueva en el MISMO contexto de Playwright, que conserva el almacenamiento (en Expo web, localStorage hace de AsyncStorage); no es un cierre y arranque real de iOS ni de Android, ni se borra la memoria del proceso nativo ni el almacenamiento seguro del dispositivo.';

/** «Pulsa la tecla de envío del teclado»: el teclado nativo no existe en Expo web. */
export const KEYBOARD_APPROXIMATION =
  'La tecla de envío del teclado se aproxima con la tecla Enter pulsada en el campo «Contraseña» de Expo web (dispara el mismo onSubmitEditing); no es el teclado del sistema.';

/** «Abre /login», «abre /programs», «abre /nc»: en Expo web se abre la dirección (carga completa de la página); en nativo sería un enlace profundo o una navegación interna. */
export const URL_APPROXIMATION =
  'Abrir una ruta de la app se aproxima cargando su dirección en Expo web (carga completa de la página, que vuelve a arrancar la app y recupera la sesión guardada); en iOS o Android sería un enlace profundo o una navegación interna, sin recarga.';

/** El campo de correo de Expo web recorta los espacios de los extremos: la parte de la regla sobre esos espacios no se ejercita. */
export const EMAIL_TRIM_APPROXIMATION =
  'El campo de correo de Expo web es de tipo correo: el navegador recorta los espacios de los extremos antes de que lleguen a la app, así que la parte de la regla que dice que la app ignora esos espacios no se ejercita (en un teclado nativo el texto llega con los espacios).';

/** El campo de correo de Expo web es de tipo correo y el navegador recorta los espacios de los extremos antes de que lleguen a la app. */
export const EMAIL_TRIM_NOTE =
  'el campo de correo es de tipo correo y el navegador recorta los espacios de los extremos: la app solo recibe el texto ya recortado (en un teclado nativo no ocurre)';

// ---------------------------------------------------------------------------------------------------------------------
// Lecturas estrictas y sin excepciones
// ---------------------------------------------------------------------------------------------------------------------

/**
 * Hay exactamente un elemento y se ve. Si hay varios la lectura es ambigua y LANZA (no se coge «el primero»), y un fallo del propio
 * navegador también lanza: «no hay» y «no se pudo leer» no se confunden. Dentro de una espera (`waitUntil`/`holdsFor`) la excepción cuenta
 * como «aún no», y fuera de ella la fila queda como `error-de-prueba`.
 */
export const seen = async (target: Locator): Promise<boolean> => {
  const found = await target.count();
  if (found > 1) throw new Error(`lectura ambigua: ${found} elementos para ${String(target)}`);
  return found === 1 && (await target.isVisible());
};
export const countOf = (target: Locator): Promise<number> => target.count();
export const valueOf = (target: Locator): Promise<string | undefined> => safe(() => target.inputValue({ timeout: 500 }), undefined);
export const attrOf = (target: Locator, name: string): Promise<string | undefined> => safe(async () => (await target.getAttribute(name, { timeout: 500 })) ?? undefined, undefined);
export const textOf = (target: Locator): Promise<string | undefined> => safe(async () => (await target.innerText({ timeout: 500 })).trim(), undefined);
export const isEnabled = (target: Locator): Promise<boolean> => safe(() => target.isEnabled({ timeout: 500 }), false);
/** Ante la duda (lectura fallida o más de un elemento), NO está deshabilitado: la condición no se da por cumplida. */
export const isDisabled = (target: Locator): Promise<boolean> => safe(() => target.isDisabled({ timeout: 500 }), false);
export const isChecked = (target: Locator): Promise<boolean> => target.isChecked({ timeout: 500 });

export const yesNo = (value: boolean): string => (value ? 'sí' : 'no');

// ---------------------------------------------------------------------------------------------------------------------
// Localizadores de la app móvil: por rol y nombre accesible (los textos de la interfaz que cita la historia)
// ---------------------------------------------------------------------------------------------------------------------

const textbox = (page: Page, name: string): Locator => page.getByRole('textbox', { name, exact: true });
const buttonNamed = (page: Page, name: string): Locator => page.getByRole('button', { name, exact: true });
const heading1 = (page: Page, name: string): Locator => page.getByRole('heading', { name, level: 1, exact: true });

export const emailField = (page: Page): Locator => textbox(page, 'Correo electrónico');
export const passwordField = (page: Page): Locator => textbox(page, 'Contraseña');
export const tenantField = (page: Page): Locator => textbox(page, 'Tenant de trabajo');
export const enterButton = (page: Page): Locator => buttonNamed(page, 'Entrar');
export const optionButton = (page: Page, name: string): Locator => buttonNamed(page, name);
export const loginHeading = (page: Page): Locator => heading1(page, 'Iniciar sesión');
export const programsHeading = (page: Page): Locator => heading1(page, 'Programas');
export const profileHeading = (page: Page): Locator => heading1(page, 'Perfil');
export const headingNamed = (page: Page, name: string): Locator => heading1(page, name);
export const moreTab = (page: Page): Locator => page.getByRole('tab', { name: 'Más', exact: true });
export const profileLink = (page: Page): Locator => page.getByRole('link', { name: 'Perfil', exact: true });
export const signOutButton = (page: Page): Locator => buttonNamed(page, 'Cerrar sesión');
/** El valor del tenant en la página «Perfil» no tiene nombre accesible propio: se lee por su identificador de prueba (respaldo). */
export const profileTenantValue = (page: Page): Locator => page.getByTestId(PERFIL_TESTIDS.PROFILE_TENANT);
/** Aviso de error del servidor. Los avisos de campo también son `role="alert"`, así que este se lee por su identificador de prueba (respaldo). */
export const serverAlert = (page: Page): Locator => page.getByTestId(ACCESO_TESTIDS.LOGIN_ERROR);
/** Aviso bajo un campo: el `role="alert"` que cuelga del mismo contenedor que el campo. */
export const noticeUnder = (field: Locator): Locator => field.locator('xpath=..').getByRole('alert');

/** Texto del aviso bajo el campo, o `undefined` si no hay ninguno. */
export const noticeText = async (field: Locator): Promise<string | undefined> => {
  const notice = noticeUnder(field);
  return (await countOf(notice)) === 0 ? undefined : textOf(notice);
};

/** Primera línea del aviso de error del servidor, o `undefined` si no hay. */
export const alertMessage = async (page: Page): Promise<string | undefined> => ((await seen(serverAlert(page))) ? linesOf(await textOf(serverAlert(page)))[0] : undefined);

export const quotedNotice = (text: string | undefined): string => (text === undefined ? '(ninguno)' : `«${text}»`);

export const onLoginForm = async (page: Page): Promise<boolean> => pathOf(page) === LOGIN_PATH && (await seen(loginHeading(page)));
export const onPrograms = async (page: Page): Promise<boolean> => pathOf(page) === PROGRAMS_PATH && (await seen(programsHeading(page)));
export const onProfile = async (page: Page): Promise<boolean> => pathOf(page) === PROFILE_PATH && (await seen(profileHeading(page)));

// ---------------------------------------------------------------------------------------------------------------------
// Sondas del navegador: peticiones de acceso y «el formulario llegó a pintarse»
// ---------------------------------------------------------------------------------------------------------------------

/** Anota en la propia página si el formulario de acceso llegó a pintarse en este documento (un destello no se ve en el estado final). */
const recordLoginForm = (formTestId: string): void => {
  const holder = window as unknown as { __loginFormSeen?: boolean };
  holder.__loginFormSeen = false;
  const mark = (): void => {
    if (document.querySelector(`[data-testid="${formTestId}"]`)) holder.__loginFormSeen = true;
  };
  new MutationObserver(mark).observe(document, { childList: true, subtree: true });
  mark();
};

export const loginFormEverSeen = (page: Page): Promise<boolean> => safe(() => page.evaluate(() => (window as unknown as { __loginFormSeen?: boolean }).__loginFormSeen === true), true);

/** Control positivo del registrador: en un documento donde el formulario SÍ se pintó, la sonda lo ha visto (si no, estaría ciega y su «no» no mediría nada). */
export const recorderSeesForm = (page: Page): Promise<boolean> => safe(() => page.evaluate(() => (window as unknown as { __loginFormSeen?: boolean }).__loginFormSeen === true), false);

/** Solo si hay sesión guardada o no (nunca su contenido: es un token). */
export const sessionStored = (page: Page): Promise<boolean | undefined> => safe(() => page.evaluate(() => localStorage.getItem('sigpro.session') !== null), undefined);
export const storedTenant = (page: Page): Promise<string | undefined> => safe(async () => (await page.evaluate(() => localStorage.getItem('sigpro.tenant'))) ?? undefined, undefined);

export interface LoginRequest {
  readonly tenantHeader: string | undefined;
  readonly status?: number;
}

export interface LoginRequests {
  readonly count: () => number;
  readonly list: () => readonly LoginRequest[];
}

const isLoginPost = (method: string, url: string): boolean => {
  try {
    return method === 'POST' && new URL(url).pathname === '/api/auth/login';
  } catch {
    return false;
  }
};

/** Registra las peticiones `POST /api/auth/login` de todas las páginas del contexto, con su cabecera `x-tenant` y su estado. */
const trackLoginRequests = (context: BrowserContext): LoginRequests => {
  const entries = new Map<unknown, { tenantHeader: string | undefined; status?: number }>();
  context.on('request', (request) => {
    if (isLoginPost(request.method(), request.url())) entries.set(request, { tenantHeader: request.headers()['x-tenant'] });
  });
  context.on('response', (response) => {
    const entry = entries.get(response.request());
    if (entry) entry.status = response.status();
  });
  return { count: () => entries.size, list: () => [...entries.values()].map((entry) => ({ ...entry })) };
};

// ---------------------------------------------------------------------------------------------------------------------
// Resultado de la fila
// ---------------------------------------------------------------------------------------------------------------------

/** Lo que el manejador recibe además de la página y el contexto. */
export interface MobileRun {
  readonly page: Page;
  readonly context: BrowserContext;
  readonly requests: LoginRequests;
  /** Guarda la pantalla final de la fila (de `target`, por defecto la página principal) ANTES de cualquier sonda que navegue. */
  readonly snapshot: (target?: Page) => Promise<void>;
}

export type MobileHandler = (row: ManifestRow, run: MobileRun) => Promise<Outcome>;

const PREPARATION_EVIDENCE =
  'App móvil servida como web de Expo a 390 × 844, con un contexto táctil pero con pulsaciones de RATÓN (click de Playwright), no toques de dedo (NO es iOS ni Android nativo). Contexto limpio por fila (almacenamiento vacío). El tenant se escribe en el campo «Tenant de trabajo» (la app móvil no usa ?tenant=); las sesiones que pide la fila se inician con el formulario de la propia app, nunca sembradas en el almacenamiento.';

const captureName = (rowId: string): string => `${rowId.replaceAll('/', '_')}.png`;

const saveCapture = (rowId: string, image: Buffer): string => {
  const relative = `docs/story-runs/EP-LOGIN/captures/${captureName(rowId)}`;
  const target = resolve(RESULTS_ROOT, 'EP-LOGIN', 'captures', captureName(rowId));
  mkdirSync(resolve(target, '..'), { recursive: true });
  writeFileSync(target, image);
  return relative;
};

/** Envuelve el manejador de un Esquema: prepara las sondas del contexto y, si la fila discrepa, guarda la captura de la pantalla final. */
export const mobileRow =
  (handler: MobileHandler): BrowserRowHandler =>
  async (row, { page, context }) => {
    await context.addInitScript(recordLoginForm, ACCESO_TESTIDS.LOGIN_FORM);
    const requests = trackLoginRequests(context);
    const shots: { final?: Buffer } = {};
    const snapshot = async (target: Page = page): Promise<void> => {
      shots.final = await safe(() => target.screenshot(), undefined);
    };
    const result = await handler(row, { page, context, requests, snapshot });
    const log = requests.list();
    const evidence = { preparation: PREPARATION_EVIDENCE, ...(log.length === 0 ? {} : { loginRequests: log }), ...result.evidence };
    if (result.verdict !== 'discrepa') return { ...result, evidence };
    const last = context.pages().at(-1) ?? page;
    const image = shots.final ?? (await safe(() => last.screenshot(), undefined));
    return { ...result, evidence: { ...evidence, ...(image ? { capture: saveCapture(row.rowId, image) } : {}) } };
  };

/** Una fila con aproximación web: la comprobación vale para Expo web y la nota lo dice. */
export const withApproximation = (outcome: Outcome, approximation: string): Outcome => ({
  ...outcome,
  note: [...(outcome.note === undefined ? [] : [outcome.note]), VALID_FOR_EXPO_WEB].join('. '),
  evidence: { ...outcome.evidence, approximation },
});

// ---------------------------------------------------------------------------------------------------------------------
// Acciones compuestas de la app (cada una devuelve el motivo del fallo o `undefined`; nunca lanza)
// ---------------------------------------------------------------------------------------------------------------------

/** Abre una ruta de la app y espera al título «Iniciar sesión». */
export const openLogin = (page: Page, path: string = LOGIN_PATH): Promise<string | undefined> =>
  runSteps([
    [`abrir ${path}`, () => page.goto(path, { timeout: CEILING_MS })],
    ['ver el título «Iniciar sesión»', () => loginHeading(page).waitFor({ timeout: CEILING_MS })],
  ]);

/**
 * Escribe el tenant en «Tenant de trabajo» con UN `fill` (el campo vuelve a `demo` al quedar vacío, así que escribir carácter a
 * carácter tras borrar daría `demoalumno01`) y lo lee de vuelta: lo que la fila da por hecho tiene que verse en el campo.
 */
export const typeTenant = async (page: Page, tenant: string): Promise<string | undefined> => {
  const failure = await runSteps([['escribir el tenant en «Tenant de trabajo»', () => tenantField(page).fill(tenant, ACTION)]]);
  if (failure) return failure;
  const value = await valueOf(tenantField(page));
  return value === tenant ? undefined : `se escribió «${tenant}» en «Tenant de trabajo» y el campo quedó en «${value ?? 'no legible'}»`;
};

/** La app abierta en /login, sin sesión y con `tenant` en «Tenant de trabajo». */
export const openLoginWithTenant = async (page: Page, tenant: string = TENANT): Promise<string | undefined> => (await openLogin(page)) ?? (await typeTenant(page, tenant));

export const fillCredentials = (page: Page, email: string, password: string): Promise<string | undefined> =>
  runSteps([
    ['escribir el correo', () => emailField(page).fill(email, ACTION)],
    ['escribir la contraseña', () => passwordField(page).fill(password, ACTION)],
  ]);

export const pressEnter = (page: Page): Promise<string | undefined> => runSteps([['pulsar «Entrar»', () => enterButton(page).click(ACTION)]]);

/** «Pulsa la tecla de envío del teclado en la contraseña»: se aproxima con Enter en el campo (ver `KEYBOARD_APPROXIMATION`). */
export const pressSubmitKey = (page: Page): Promise<string | undefined> => runSteps([['pulsar Enter en «Contraseña»', () => passwordField(page).press('Enter', ACTION)]]);

export interface SignedIn {
  readonly ok: boolean;
  readonly observed: string;
  readonly elapsedMs: number;
}

/** Inicia sesión con el formulario de la propia fila (nunca inyectando una sesión) y espera a /programs. */
export const signInThroughApp = async (page: Page, credentials: Credentials, tenant: string = TENANT): Promise<SignedIn> => {
  const failure = (await openLoginWithTenant(page, tenant)) ?? (await fillCredentials(page, credentials.email, credentials.password)) ?? (await pressEnter(page));
  if (failure) return { ok: false, observed: failure, elapsedMs: 0 };
  const arrived = await waitUntil(() => onPrograms(page));
  return { ok: arrived.reached, observed: arrived.reached ? `en /programs (${arrived.elapsedMs} ms)` : `no llegó a /programs: ruta ${pathOf(page)}`, elapsedMs: arrived.elapsedMs };
};

/** «Más» → «Perfil», como lo hace una persona desde las pestañas. */
export const goToProfile = async (page: Page): Promise<string | undefined> =>
  (await runSteps([
    ['abrir la pestaña «Más»', () => moreTab(page).click(ACTION)],
    ['pulsar «Perfil»', () => profileLink(page).click(ACTION)],
    ['ver el título «Perfil»', () => profileHeading(page).waitFor({ timeout: CEILING_MS })],
  ])) ?? ((await waitUntil(() => onProfile(page))).reached ? undefined : `no llegó a /profile (ruta ${pathOf(page)})`);

/** Pulsa «Cerrar sesión» en la página «Perfil» y espera a /login. */
export const signOutFromProfile = async (page: Page): Promise<string | undefined> =>
  (await runSteps([['pulsar «Cerrar sesión»', () => signOutButton(page).click(ACTION)]])) ?? ((await waitUntil(() => onLoginForm(page))).reached ? undefined : `no llegó a /login (ruta ${pathOf(page)})`);

/** Inicia sesión, abre «Perfil» y pulsa «Cerrar sesión»: deja la app en /login. Devuelve las comprobaciones de lo que la fila da por hecho. */
export const signedInAndOut = async (page: Page, credentials: Credentials, tenant: string = TENANT): Promise<readonly Check[]> => {
  const session = await signInThroughApp(page, credentials, tenant);
  const before = check(session.ok, `Antes: ${credentials.email} ha iniciado sesión en ${tenant}`, session.observed);
  if (!session.ok) return [before];
  const toProfile = await goToProfile(page);
  const profile = check(toProfile === undefined, 'Antes: está en la página «Perfil»', toProfile ?? `en /profile (ruta ${pathOf(page)})`);
  if (toProfile !== undefined) return [before, profile];
  const out = await signOutFromProfile(page);
  return [before, profile, check(out === undefined, 'Antes: pulsa «Cerrar sesión» y llega a /login', out ?? `en /login (ruta ${pathOf(page)})`)];
};

/**
 * «Cierra la app y la vuelve a abrir»: cierra la página y abre otra en el mismo contexto (ver `REOPEN_APPROXIMATION`). Cerrar, abrir la
 * página y cargar la ruta son fontanería del arnés: si fallan, lanza (la fila queda como `error-de-prueba`, no como discrepancia de la app).
 */
export const reopenApp = async (context: BrowserContext, page: Page, path: string): Promise<Page> => {
  await page.close();
  const fresh = await context.newPage();
  await fresh.goto(path, { timeout: CEILING_MS });
  return fresh;
};

/** «Sin sesión», por comportamiento: abrir `path` en esta página acaba en /login y se queda ahí. Navega: va siempre el último paso de la fila. */
export const landsOnLogin = async (page: Page, path: string, what = `abrir ${path} en esta página`): Promise<Check> => {
  // La carga de la ruta es fontanería: si falla, lanza (con el fallo tragado, una página que ya estaba en /login daría «sin sesión» en vacío)
  await page.goto(path, { timeout: CEILING_MS });
  await waitUntil(async () => (await onLoginForm(page)) || (await onPrograms(page)));
  const stays = await holdsFor(() => onLoginForm(page));
  return check(stays.held, `al ${what}, llega a /login`, stays.held ? `al ${what} acaba en /login (observado 2 s)` : `al ${what} acaba en ${pathOf(page)}`);
};

export const hasNoSession = async (page: Page): Promise<Check> => {
  const landed = await landsOnLogin(page, PROGRAMS_PATH);
  return check(landed.ok, 'sin sesión iniciada (abrir /programs acaba en /login)', landed.ok ? 'sin sesión: abrir /programs acaba en /login' : `con sesión: ${landed.observed}`);
};

// ---------------------------------------------------------------------------------------------------------------------
// Resultado de un envío del formulario
// ---------------------------------------------------------------------------------------------------------------------

export interface LoginResult {
  readonly kind: 'alert' | 'programs' | 'mfa' | 'timeout';
  readonly message?: string;
  readonly detail?: string;
  readonly elapsedMs: number;
}

const MFA_TITLE = 'Verificación en dos pasos';

/** La línea de detalle técnico es una decisión de producto pendiente: se anota cruda en `evidence.detailLine`, sin comparar. */
export const detailEvidence = (detail: string | undefined): Readonly<Record<string, unknown>> => (detail === undefined ? {} : { detailLine: detail });

/** Espera, con techo, a lo primero que aparezca tras pulsar «Entrar»: el aviso del servidor, /programs o el paso de verificación. */
export const awaitLoginResult = async (page: Page): Promise<LoginResult> => {
  let found: Omit<LoginResult, 'elapsedMs'> = { kind: 'timeout' };
  const waited = await waitUntil(async () => {
    if (await seen(serverAlert(page))) {
      const lines = linesOf(await textOf(serverAlert(page)));
      const detail = lines.slice(1).join('\n');
      found = { kind: 'alert', ...(lines[0] === undefined ? {} : { message: lines[0] }), ...(detail === '' ? {} : { detail }) };
      return true;
    }
    if (await onPrograms(page)) {
      found = { kind: 'programs' };
      return true;
    }
    if (pathOf(page) === LOGIN_PATH && (await seen(headingNamed(page, MFA_TITLE)))) {
      found = { kind: 'mfa', message: MFA_TITLE };
      return true;
    }
    return false;
  });
  return { ...found, elapsedMs: waited.elapsedMs };
};

export const describeResult = (result: LoginResult, page: Page): string => {
  const shown: Readonly<Record<LoginResult['kind'], string>> = {
    alert: `ve el aviso de error «${result.message ?? ''}»`,
    programs: 'llegó a /programs',
    mfa: `ve el título «${MFA_TITLE}»`,
    timeout: `no apareció ningún aviso ni cambió de pantalla en ${CEILING_MS} ms (ruta ${pathOf(page)})`,
  };
  return shown[result.kind];
};

/** El mensaje que dice la historia coincide con lo observado: un aviso de error con ese texto. */
export const messageMatches = (expected: string, result: LoginResult): boolean => result.kind === 'alert' && result.message === expected;

// ---------------------------------------------------------------------------------------------------------------------
// Cuentas de la fila
// ---------------------------------------------------------------------------------------------------------------------

/** Una cuenta del tenant tal como la ve el administrador (lectura HTTP): la historia da por hecho su estado antes de actuar. */
export const accountIs = async (tenant: string, label: string, email: string, key: 'locked' | 'pending' | 'active', value: boolean): Promise<Check> => {
  const user = (await usersByEmail(tenant)).get(email);
  return check(user !== undefined && user[key] === value, `Antes: ${label}`, user === undefined ? `${email} no está en el listado de usuarios` : `${key} ${String(user[key])}`);
};

export interface RequestedThroughApp {
  readonly email: string;
  readonly check: Check;
}

/**
 * Solicita una cuenta con «Solicitar acceso» de la propia app, con el tenant que haya en el campo, un correo nuevo
 * (`nueva-…@organizacion.es`) y la contraseña de la historia (Ana Prueba, «Unidad de pruebas»; el rol queda con su valor por
 * defecto, que la historia no fija). Deja la app otra vez en /login.
 */
export const requestAccountThroughApp = async (page: Page): Promise<RequestedThroughApp> => {
  const email = uniqueEmail('nueva').replace(/@.*$/, '@organizacion.es');
  const textbox = (name: string): Locator => page.getByRole('textbox', { name, exact: true });
  const failure = await runSteps([
    ['pulsar «Solicitar acceso»', () => optionButton(page, 'Solicitar acceso').click(ACTION)],
    ['ver el título «Solicitar acceso»', () => headingNamed(page, 'Solicitar acceso').waitFor({ timeout: CEILING_MS })],
    ['escribir el nombre', () => textbox('Nombre').fill('Ana', ACTION)],
    ['escribir los apellidos', () => textbox('Apellidos').fill('Prueba', ACTION)],
    ['escribir el correo corporativo', () => textbox('Correo corporativo').fill(email, ACTION)],
    ['escribir la organización', () => textbox('Organización / Unidad').fill('Unidad de pruebas', ACTION)],
    ['escribir la contraseña', () => textbox('Contraseña').fill(NEW_ACCOUNT_PASSWORD, ACTION)],
    ['confirmar la contraseña', () => textbox('Confirmar contraseña').fill(NEW_ACCOUNT_PASSWORD, ACTION)],
    ['aceptar las condiciones', () => page.getByRole('checkbox', { name: /He leído y acepto/ }).click(ACTION)],
    ['pulsar «Enviar solicitud»', () => optionButton(page, 'Enviar solicitud').click(ACTION)],
    ['ver «Solicitud enviada»', () => page.getByText('Solicitud enviada', { exact: true }).first().waitFor({ timeout: CEILING_MS })],
    ['pulsar «Volver al inicio de sesión»', () => optionButton(page, 'Volver al inicio de sesión').click(ACTION)],
    ['ver el título «Iniciar sesión»', () => loginHeading(page).waitFor({ timeout: CEILING_MS })],
  ]);
  return { email, check: check(failure === undefined, 'Antes: solicita la cuenta con «Solicitar acceso» de la app', failure ?? 'solicitud enviada con el formulario de la app («Solicitud enviada») y de vuelta en /login') };
};

/** Espera a que `condition` se cumpla y se mantenga el tiempo de observación: devuelve si llegó, cuánto tardó y si se mantuvo. */
export const reachedAndHeld = async (condition: () => Promise<boolean>): Promise<{ readonly reached: boolean; readonly held: boolean; readonly elapsedMs: number }> => {
  const waited = await waitUntil(condition);
  const stays = waited.reached ? await holdsFor(condition) : { held: false };
  return { reached: waited.reached, held: stays.held, elapsedMs: waited.elapsedMs };
};

/**
 * Una acción de PREPARACIÓN (abrir /login, escribir el tenant, escribir un dato del «Dado»): si falla, lanza y la fila queda como
 * `error-de-prueba`, no como discrepancia de la app. Solo lo que la fila evalúa (el «Cuando» y el «Entonces») puede discrepar.
 */
export const mustPrepare = (row: ManifestRow, what: string, failure: string | undefined): void => {
  requirePrepared(row, [check(failure === undefined, `Antes: ${what}`, failure ?? 'hecho')]);
};
