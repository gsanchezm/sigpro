import type { Locator, Page, Request } from '@playwright/test';
import { DEMO, TENANT_A } from '../../../story-runs/support/prepare';
import { ACCESO_DYNAMIC_TESTIDS, ACCESO_TESTIDS } from '../../../../packages/shared/src/testids';
import { ACTION, CEILING_MS, isVisible, linesOf, pathOf, runSteps, safe, textOf, type Step } from '../../support/browser';
import { uniqueEmail } from '../../../story-runs/support/api';
import { check, sleep, type Check } from '../../support/checks';
import { outcome, type Outcome } from '../../support/framework';

// Piezas comunes de las filas web de EP-REGISTRO (/register a 1440 px). Los localizadores son de rol y de etiqueta («Nombre»,
// «Enviar solicitud»…); los de prueba (testids de testids.ts) solo donde la pantalla no ofrece otro rastro: los avisos de cada
// campo, el medidor y la notificación de éxito («toast-ok»), que no tienen rol propio.

export const REGISTER_PATH = '/register';
export const LOGIN_PATH = '/login';
export const PROGRAMS_PATH = '/programs';
export const REGISTER_URL = `${REGISTER_PATH}?tenant=${TENANT_A}`;
export const LOGIN_URL = `${LOGIN_PATH}?tenant=${TENANT_A}`;

export const TERMS_SENTENCE = 'He leído y acepto las condiciones de uso y la política de privacidad.';
export const TITLE = 'Solicitar acceso';
export const HINT = 'Un administrador revisará la solicitud antes de activar la cuenta.';
export const SENT_TITLE = 'Solicitud enviada';
export const SENT_TEXT = 'Hemos enviado un correo de verificación a';
export const DUPLICATE_MESSAGE = 'Ya existe una cuenta con ese correo.';
export const RESENT_TITLE = 'Correo reenviado';
export const PROCESSING = 'Procesando…';
export const RULES = ['Al menos 10 caracteres', 'Una mayúscula y una minúscula', 'Un número', 'Un símbolo'] as const;
export const STRENGTHS: ReadonlyMap<string, string> = new Map([
  ['Débil', 'Débil'],
  ['Aceptable', 'Aceptable'],
  ['Buena', 'Buena'],
  ['Fuerte', 'Fuerte'],
]);

// --- Localizadores ----------------------------------------------------------------------------------------------------------

export const titleOf = (page: Page): Locator => page.getByRole('heading', { name: TITLE, level: 1, exact: true });
export const field = (page: Page, label: string): Locator => page.getByLabel(label, { exact: true });
export const roleSelect = (page: Page): Locator => page.getByLabel('Rol solicitado', { exact: true });
export const termsBox = (page: Page): Locator => page.getByRole('checkbox', { name: /He leído y acepto/ });
export const submitButton = (page: Page): Locator => page.getByRole('button', { name: 'Enviar solicitud', exact: true });
export const backButton = (page: Page): Locator => page.getByRole('button', { name: 'Volver al inicio de sesión', exact: true });
export const toggleButton = (page: Page): Locator => page.getByRole('button', { name: /^(Mostrar|Ocultar) contraseña$/ });
export const legalLink = (page: Page, name: string): Locator => page.getByRole('link', { name, exact: true });
export const meterOf = (page: Page): Locator => page.getByTestId(ACCESO_TESTIDS.REGISTER_PASSWORD_METER);
export const sentPanel = (page: Page): Locator => page.getByRole('status').filter({ has: page.getByRole('heading', { name: SENT_TITLE, exact: true }) });
export const resendButton = (page: Page): Locator => page.getByRole('button', { name: 'Reenviar correo de verificación', exact: true });
export const loginHeading = (page: Page): Locator => page.getByRole('heading', { name: 'Iniciar sesión', exact: true });
export const programsHeading = (page: Page): Locator => page.getByRole('heading', { name: 'Programas', exact: true }).or(page.getByRole('banner').getByText('Programas', { exact: true }));

/** Aviso de error de cada campo (el de la historia, entre «…»): la pantalla lo muestra bajo el campo con su propio testid. */
export const ERROR_TESTIDS: ReadonlyMap<string, string> = new Map([
  ['Nombre', ACCESO_TESTIDS.REGISTER_FIRST_NAME_ERROR],
  ['Apellidos', ACCESO_TESTIDS.REGISTER_LAST_NAME_ERROR],
  ['Correo corporativo', ACCESO_TESTIDS.REGISTER_EMAIL_ERROR],
  ['Organización / Unidad', ACCESO_TESTIDS.REGISTER_ORG_ERROR],
  ['Contraseña', ACCESO_TESTIDS.REGISTER_PASSWORD_ERROR],
  ['Confirmar contraseña', ACCESO_TESTIDS.REGISTER_PASSWORD_CONFIRM_ERROR],
  ['la casilla', ACCESO_TESTIDS.REGISTER_TERMS_ERROR],
]);

/** Todos los avisos de campo que pueden aparecer en el formulario. */
export const ALL_ERROR_TESTIDS: readonly string[] = [...ERROR_TESTIDS.values()];

export const errorOf = (page: Page, testId: string): Promise<string | undefined> => textOf(page.getByTestId(testId));

/** Primer renglón del aviso de un campo (el texto de la historia); `undefined` si no hay aviso visible. */
export const messageOf = async (page: Page, testId: string): Promise<string | undefined> => linesOf((await isVisible(page.getByTestId(testId))) ? await errorOf(page, testId) : undefined)[0];

/** Correo nuevo de la fila: `nueva-<marca>@organizacion.es`, distinto en cada llamada (el mismo generador que la API). */
export const newAccountEmail = (): string => uniqueEmail('nueva').replace(/@.*$/, '@organizacion.es');

/** La acción que la fila describe («pone … en …», «pulsa …») no se pudo hacer: la pantalla no ofrece lo que la historia nombra. */
export const actionMissing = (expected: string, failure: string): Outcome => outcome(false, expected, failure, { note: 'La historia nombra un elemento que la pantalla no ofrece.' });

/** Campo del formulario de solicitud, con su valor de la fila (cadena vacía para «(vacío)»). */
export interface FormValues {
  readonly first: string;
  readonly last: string;
  readonly email: string;
  readonly org: string;
  readonly role: string;
  readonly password: string;
  readonly confirm: string;
  readonly terms: boolean;
}

/** Datos válidos de la fila: Ana Prueba, «Unidad de pruebas», consultant, Abcdefghij1! y condiciones aceptadas. */
export const validValues = (email: string, role = 'consultant'): FormValues => ({
  first: 'Ana',
  last: 'Prueba',
  email,
  org: 'Unidad de pruebas',
  role,
  password: 'Abcdefghij1!',
  confirm: 'Abcdefghij1!',
  terms: true,
});

/** Escribe el formulario como una persona: campo a campo, y la casilla de condiciones si la fila la marca. */
export const fillForm = (page: Page, values: FormValues): Promise<string | undefined> => {
  const steps: Step[] = [
    ['escribir «Nombre»', () => field(page, 'Nombre').fill(values.first, ACTION)],
    ['escribir «Apellidos»', () => field(page, 'Apellidos').fill(values.last, ACTION)],
    ['escribir «Correo corporativo»', () => field(page, 'Correo corporativo').fill(values.email, ACTION)],
    ['escribir «Organización / Unidad»', () => field(page, 'Organización / Unidad').fill(values.org, ACTION)],
    ['elegir «Rol solicitado»', () => roleSelect(page).selectOption(values.role, ACTION)],
    ['escribir «Contraseña»', () => field(page, 'Contraseña').fill(values.password, ACTION)],
    ['escribir «Confirmar contraseña»', () => field(page, 'Confirmar contraseña').fill(values.confirm, ACTION)],
  ];
  if (values.terms) steps.push(['marcar la casilla de condiciones', () => termsBox(page).check(ACTION)]);
  return runSteps(steps);
};

/** Abre /register con el tenant de la fila en un navegador sin sesión; devuelve por qué no llegó, si no llegó. */
export const openRegister = (page: Page): Promise<string | undefined> =>
  runSteps([
    ['abrir /register?tenant=alumno01', () => page.goto(REGISTER_URL, { timeout: CEILING_MS })],
    ['ver el título «Solicitar acceso»', () => titleOf(page).waitFor({ timeout: CEILING_MS })],
  ]);

/** Envía el formulario tal cual lo deja la fila. */
export const submit = (page: Page): Promise<string | undefined> => runSteps([['pulsar «Enviar solicitud»', () => submitButton(page).click(ACTION)]]);

/** Inicia sesión como gestor@sigpro.test desde /login del tenant de la fila (en la propia pantalla, sin inyectar nada). */
export const signInAsManager = (page: Page): Promise<string | undefined> =>
  runSteps([
    ['abrir /login?tenant=alumno01', () => page.goto(LOGIN_URL, { timeout: CEILING_MS })],
    ['escribir el correo', () => page.getByLabel('Correo electrónico', { exact: true }).fill(DEMO.gestor.email, ACTION)],
    ['escribir la contraseña', () => page.getByLabel('Contraseña', { exact: true }).fill(DEMO.gestor.password, ACTION)],
    ['pulsar «Entrar»', () => page.getByRole('button', { name: 'Entrar', exact: true }).click(ACTION)],
    ['llegar a /programs', () => page.waitForURL(/\/programs/, { timeout: CEILING_MS })],
  ]);

export const onLoginForm = async (page: Page): Promise<boolean> => pathOf(page) === LOGIN_PATH && (await isVisible(loginHeading(page)));
export const onPrograms = async (page: Page): Promise<boolean> => pathOf(page) === PROGRAMS_PATH && (await isVisible(programsHeading(page)));

// --- Solicitudes que sale del navegador --------------------------------------------------------------------------------------

const pathEndsWith = (url: string, suffix: string): boolean => {
  try {
    return new URL(url).pathname.endsWith(suffix);
  } catch {
    return false;
  }
};

/** Cuerpo JSON de una petición POST, si lo tiene (`undefined` si no es JSON). */
const bodyOf = (request: Request): unknown => {
  try {
    return request.postDataJSON() as unknown;
  } catch {
    return undefined;
  }
};

/** Lo que sale del navegador en cada POST observado: la cabecera `x-tenant` y el cuerpo JSON. */
export interface PostReading {
  readonly tenant: string | undefined;
  readonly body: unknown;
}

export interface PostWatch {
  readonly count: () => number;
  readonly posts: () => readonly PostReading[];
}

/** Observa los POST de la página cuyo camino termina en `suffix`. Hay que llamarla ANTES de la acción observada. */
export const watchPosts = (page: Page, suffix: string): PostWatch => {
  const posts: PostReading[] = [];
  page.on('request', (request) => {
    if (request.method() !== 'POST' || !pathEndsWith(request.url(), suffix)) return;
    posts.push({ tenant: request.headers()['x-tenant'], body: bodyOf(request) });
  });
  return { count: () => posts.length, posts: () => [...posts] };
};

/** Cuenta las solicitudes POST de la página a `/auth/register`. Hay que llamarla ANTES de la acción observada. */
export const watchSubmissions = (page: Page): (() => number) => watchPosts(page, '/auth/register').count;

/** Retrasa la respuesta de `POST /api/auth/register` en el navegador (la prueba fija el retardo; la historia lo da como dato). */
export const delayRegister = async (page: Page, ms: number): Promise<void> => {
  await page.route(
    (url) => url.pathname.endsWith('/auth/register'),
    async (route) => {
      if (route.request().method() !== 'POST') return route.continue();
      await sleep(ms);
      return route.continue();
    },
  );
};

// --- Avisos emergentes (toasts) ----------------------------------------------------------------------------------------------

/** Títulos de los avisos «ok» que están en pantalla (el primer renglón de cada uno). */
export const okToastTitles = async (page: Page): Promise<readonly string[]> => {
  const toasts = page.getByTestId(ACCESO_DYNAMIC_TESTIDS.TOAST('ok'));
  const total = await safe(() => toasts.count(), 0);
  const titles: string[] = [];
  for (let index = 0; index < total; index += 1) titles.push(linesOf(await textOf(toasts.nth(index)))[0] ?? '');
  return titles;
};

// --- Panel «Solicitud enviada» ------------------------------------------------------------------------------------------------

export interface SentReading {
  readonly visible: boolean;
  readonly text: string;
  readonly lines: readonly string[];
}

export const readSent = async (page: Page): Promise<SentReading> => {
  const panel = sentPanel(page);
  const visible = await isVisible(panel);
  const text = (await textOf(panel)) ?? '';
  return { visible, text, lines: linesOf(text) };
};

/** Renglón del panel que tiene la forma del identificador de solicitud, si lo hay. */
export const requestIdLine = (lines: readonly string[]): string | undefined => lines.find((line) => /^REQ-\d{4}-\d{4}$/.test(line));

/** Año en curso en el servidor (UTC) o en el navegador (local): el identificador lleva uno de los dos. */
export const currentYears = (): readonly string[] => [String(new Date().getFullYear()), String(new Date().getUTCFullYear())];

// --- Medidor de contraseña ----------------------------------------------------------------------------------------------------

/** Estado de cada una de las cuatro reglas del medidor (`data-ok` de cada elemento de la lista). */
export const ruleStates = async (meter: Locator): Promise<readonly (string | undefined)[]> => {
  const states: (string | undefined)[] = [];
  for (const rule of RULES) {
    const item = meter.getByRole('listitem').filter({ hasText: rule });
    states.push(await safe(async () => (await item.first().getAttribute('data-ok', { timeout: 500 })) ?? undefined, undefined));
  }
  return states;
};

/** Palabras de fuerza presentes en el medidor (la de la web va en un texto oculto a la vista, no en un atributo). */
export const strengthWordsIn = async (meter: Locator): Promise<readonly string[]> => {
  const present: string[] = [];
  for (const word of STRENGTHS.keys()) {
    if ((await safe(() => meter.getByText(word, { exact: true }).count(), 0)) > 0) present.push(word);
  }
  return present;
};

/** Palabras de fuerza VISIBLES en el medidor: cada una presente una sola vez y a la vista (la regla dice que el texto «se ve en la pantalla»). */
export const visibleStrengthWords = async (meter: Locator): Promise<readonly string[]> => {
  const visible: string[] = [];
  for (const word of STRENGTHS.keys()) {
    const target = meter.getByText(word, { exact: true });
    const found = await safe(() => target.count(), 0);
    if (found === 1 && (await isVisible(target))) visible.push(word);
  }
  return visible;
};

/** Color calculado de cada barra del medidor (las cuatro barras son el primer bloque oculto del medidor). */
export const barColors = async (meter: Locator): Promise<readonly string[]> => {
  const bars = meter.locator('xpath=./*[@aria-hidden="true"][1]/*');
  const total = await safe(() => bars.count(), 0);
  const colors: string[] = [];
  for (let index = 0; index < total; index += 1) {
    colors.push(await safe(() => bars.nth(index).evaluate((element) => getComputedStyle(element).backgroundColor), ''));
  }
  return colors;
};

/** Barras rellenas: las que cambian de color respecto a las de la contraseña vacía (medida antes de escribir). */
export const filledBars = (baseline: readonly string[], now: readonly string[]): number => now.filter((color, index) => color !== baseline[index]).length;

/** Reglas que la historia nombra en una celda: «» entre comillas, «las cuatro», o «(ninguna)». Un texto desconocido lanza. */
export const rulesNamed = (text: string): readonly string[] => {
  if (text === '(ninguna)') return [];
  if (text === 'las cuatro') return [...RULES];
  const named = [...text.matchAll(/«([^»]+)»/g)].map((match) => match[1] ?? '');
  for (const rule of named) if (!(RULES as readonly string[]).includes(rule)) throw new Error(`celda sin interpretación: regla «${rule}»`);
  return named;
};

/** Lo que la historia dice de cada regla en una fila del medidor: marcada (`true`) o sin marcar (`false`). */
export const expectedRuleStates = (named: readonly string[]): readonly boolean[] => RULES.map((rule) => named.includes(rule));

/** Un resultado de comprobación del medidor frente a lo que la historia nombra. */
export const ruleChecks = (states: readonly (string | undefined)[], expected: readonly boolean[]): Check[] =>
  RULES.map((rule, index) => {
    const observed = states[index];
    const marked = observed === 'true';
    return check(observed === String(expected[index]), `regla «${rule}» ${expected[index] ? 'marcada' : 'sin marcar'}`, `regla «${rule}» ${observed === undefined ? 'no localizada' : marked ? 'marcada' : 'sin marcar'}`);
  });

/** Tiempo que se observa para afirmar que una solicitud NO sale (una reacción local de la pantalla, no una espera del producto). */
export const OBSERVE_MS = 1_000;

/** Espera `OBSERVE_MS` y devuelve cuántas solicitudes de registro se han enviado desde que se creó el contador. */
export const afterObserving = async (count: () => number): Promise<number> => {
  await sleep(OBSERVE_MS);
  return count();
};

/** Valor de una celda para escribir: texto tal cual, «(vacío)», «(tres espacios)» o un marcador de `extra`; cualquier otro paréntesis lanza. */
export const plainValue = (text: string, extra: ReadonlyMap<string, string> = new Map()): string => {
  if (extra.has(text)) return extra.get(text) ?? '';
  if (text === '(vacío)') return '';
  if (text === '(tres espacios)') return '   ';
  if (text.startsWith('(')) throw new Error(`celda sin interpretación: «${text}»`);
  return text;
};

/** Lectura de la fuerza: palabra presente en el medidor, o ninguna si la historia dice «(ninguna)». */
export const expectedStrength = (text: string): string | undefined => {
  if (text === '(ninguna)') return undefined;
  const word = text.replace(/^«|»$/g, '');
  if (!STRENGTHS.has(word)) throw new Error(`celda sin interpretación: fuerza «${text}»`);
  return word;
};

/** Nota de plataforma: el campo de correo (tipo correo) recorta los espacios de los extremos antes de que los reciba la app. */
export const EMAIL_NOTE = 'el campo de correo es de tipo correo y el navegador recorta los espacios de los extremos: la app solo recibe el texto ya recortado (en un teclado nativo no ocurre)';

/** Lo que la historia dice de una regla del medidor según su `data-ok`. */
export const RULE_WORDS: ReadonlyMap<string, string> = new Map([
  ['true', 'marcada'],
  ['false', 'sin marcar'],
]);

/** Texto observado de una regla: marcada, sin marcar o no localizada. */
export const ruleWord = (state: string | undefined): string => RULE_WORDS.get(state ?? '') ?? 'no localizada';

/** Renglón del panel que trae el texto de verificación con el correo (lo que se observó). */
export const sentLine = (lines: readonly string[]): string | undefined => lines.find((line) => line.includes(SENT_TEXT));
