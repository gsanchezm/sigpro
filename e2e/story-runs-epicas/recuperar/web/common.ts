import type { Locator, Page, Request, Route } from '@playwright/test';
import { uniqueEmail } from '../../../story-runs/support/api';
import { TENANT_A } from '../../../story-runs/support/prepare';
import { ACCESO_TESTIDS } from '../../../../packages/shared/src/testids';
import { ACTION, isVisible, linesOf, pathOf, safe, textOf, type Step } from '../../support/browser';
import { check, sleep, type Check } from '../../support/checks';
import { outcome, type Outcome } from '../../core/framework';

// Piezas comunes de las filas web (/forgot a 1440 px) y de las filas de la app móvil servida como web de Expo (EP-RECUPERAR). Los
// localizadores son de rol y de etiqueta; los de prueba solo donde no hay otro rastro (el aviso bajo el campo). Las lecturas no lanzan y
// distinguen visible, oculto y no legible: una lectura no legible nunca cuenta como «no visible» ni como cumplida. Cuando una acción de
// Playwright falla, la falla conserva las tres primeras líneas del error (la llamada y su motivo) para la nota: así se distingue un fallo
// de la app de uno del manejador. Las respuestas simuladas se fijan en la prueba; el resto de la red es real.

export const LOGIN_PATH = '/login';
export const FORGOT_PATH = '/forgot';
export const PROGRAMS_PATH = '/programs';
export const LOGIN_URL = `${LOGIN_PATH}?tenant=${TENANT_A}`;
export const FORGOT_URL = `${FORGOT_PATH}?tenant=${TENANT_A}`;

/** Textos de la interfaz (catálogo `acceso` y `common`): los mismos que cita la historia. */
export const SENT_NOTICE = 'Si el correo existe, recibirás un enlace en breve.';
export const REQUIRED = 'Campo obligatorio';
export const BAD_EMAIL = 'Introduce un correo válido';
export const PROCESSING = 'Procesando…';
export const FORGOT_LINK = '¿Olvidaste la contraseña?';
export const FORGOT_TITLE = 'Recuperar contraseña';
export const FORGOT_HINT = 'Te enviaremos un enlace de un solo uso válido durante 30 minutos.';
export const REMEMBER = 'Mantener la sesión en este equipo';
export const PLACEHOLDER = 'nombre@organizacion.es';

/** Tolerancia de la prueba para una reacción local de la pantalla (la historia no fija plazos). */
export const LOCAL_MS = 1_000;
/** Ventana ÚNICA con la que se observa que algo NO ocurre: una por fila, nunca varias en serie. */
export const OBSERVE_MS = 1_000;

/**
 * Limitación declarada: el campo de correo es de tipo correo, así que el navegador recorta los espacios de los extremos antes de que
 * la app los reciba. La fila NO prueba el recorte de la app; la evidencia guarda el tipo y el valor realmente leídos del campo.
 */
export const EMAIL_NOTE = 'el campo de correo es de tipo correo: el navegador recorta los espacios de los extremos antes de que la app los reciba, así que esta fila no prueba el recorte de la app (la evidencia guarda el tipo y el valor leídos del campo)';

/** Limitación equivalente en Expo web, donde el campo de correo puede convertirse en un campo de tipo correo. */
export const MOBILE_TRIM_NOTE = 'en Expo web el campo de correo puede ser de tipo correo: si lo es, el navegador recorta los espacios antes que la app y esta fila no prueba el recorte de la app (la evidencia guarda el tipo y el valor leídos del campo)';

// --- Localizadores ----------------------------------------------------------------------------------------------------------

export const emailField = (page: Page): Locator => page.getByLabel('Correo electrónico', { exact: true });
export const passwordField = (page: Page): Locator => page.getByLabel('Contraseña', { exact: true });
export const submitButton = (page: Page): Locator => page.getByRole('button', { name: 'Enviar enlace', exact: true });
export const backButton = (page: Page): Locator => page.getByRole('button', { name: 'Volver al inicio de sesión', exact: true });
export const forgotLink = (page: Page): Locator => page.getByRole('button', { name: FORGOT_LINK, exact: true });
export const enterButton = (page: Page): Locator => page.getByRole('button', { name: 'Entrar', exact: true });
export const loginHeading = (page: Page): Locator => page.getByRole('heading', { name: 'Iniciar sesión', exact: true });
export const programsHeading = (page: Page): Locator =>
  page.getByRole('heading', { name: 'Programas', exact: true }).or(page.getByRole('banner').getByText('Programas', { exact: true }));
/** Aviso de éxito: un `role="status"` cuyo texto es el de la historia. */
export const sentNotice = (page: Page): Locator => page.getByRole('status').filter({ hasText: SENT_NOTICE });
/** Aviso de error bajo el campo «Correo electrónico» (sin rol propio: su id de prueba es el rastro fiable). */
export const fieldError = (page: Page): Locator => page.getByTestId(ACCESO_TESTIDS.FORGOT_EMAIL_ERROR);

// --- Lecturas que no mienten ------------------------------------------------------------------------------------------------

/** Visible, oculto (o ausente) y no legible (ambiguo o con error de lectura). Una lectura no legible no es «oculto». */
export type Reading = 'visible' | 'hidden' | 'unreadable';

export const visibilityOf = async (target: Locator): Promise<Reading> => {
  try {
    const found = await target.count();
    if (found === 0) return 'hidden';
    if (found > 1) return 'unreadable';
    return (await target.isVisible({ timeout: 500 })) ? 'visible' : 'hidden';
  } catch {
    return 'unreadable';
  }
};

/** Valor de un campo; `undefined` si la lectura es ambigua o falla (nunca cuenta como cadena vacía). */
export const fieldValue = async (target: Locator): Promise<string | undefined> => {
  try {
    if ((await target.count()) !== 1) return undefined;
    return await target.inputValue({ timeout: 500 });
  } catch {
    return undefined;
  }
};

/** Primer renglón del texto de un elemento visible; `undefined` si no está visible o no se puede leer. */
export const messageOf = async (target: Locator): Promise<string | undefined> => ((await visibilityOf(target)) === 'visible' ? linesOf(await textOf(target))[0] : undefined);

/** Si un control está habilitado; `undefined` si la lectura no es fiable. */
export const enabledOf = async (target: Locator): Promise<boolean | undefined> => {
  try {
    if ((await target.count()) !== 1) return undefined;
    return await target.isEnabled({ timeout: 500 });
  } catch {
    return undefined;
  }
};

/** Tipo EFECTIVO de un campo (propiedad del elemento); en un campo de correo es `email`. */
export const effectiveType = (target: Locator): Promise<string | undefined> =>
  safe(() => target.evaluate((element) => (element instanceof HTMLInputElement ? element.type : 'no es un campo de entrada'), undefined, { timeout: 500 }), undefined);

export interface Box {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** Caja de un elemento visible; `undefined` si no se puede leer. */
export const boxOf = async (target: Locator): Promise<Box | undefined> => {
  try {
    if ((await target.count()) !== 1) return undefined;
    return (await target.boundingBox({ timeout: 500 })) ?? undefined;
  } catch {
    return undefined;
  }
};

/** `upper` queda por encima de `lower`: su borde inferior no pasa del superior de `lower`. */
export const isAbove = (upper: Box | undefined, lower: Box | undefined): boolean => upper !== undefined && lower !== undefined && upper.y + upper.height <= lower.y + 1;

/** `lower` queda por debajo de `upper`: su borde superior no sube por encima del inferior de `upper`. */
export const isBelow = (lower: Box | undefined, upper: Box | undefined): boolean => lower !== undefined && upper !== undefined && lower.y >= upper.y + upper.height - 1;

/** Las cajas van en el orden dado de arriba abajo; si alguna no se puede leer, no se cumple. */
export const inOrder = (...boxes: readonly (Box | undefined)[]): boolean => {
  const defined = boxes.filter((box): box is Box => box !== undefined);
  return defined.length === boxes.length && defined.every((box, index) => index === 0 || (defined[index - 1]?.y ?? Number.POSITIVE_INFINITY) < box.y);
};

// --- Peticiones POST a /api/auth/forgot ------------------------------------------------------------------------------------

const bodyOf = (request: Request): unknown => {
  try {
    return request.postDataJSON() as unknown;
  } catch {
    return undefined;
  }
};

const isForgotPost = (request: Request): boolean => {
  try {
    return request.method() === 'POST' && new URL(request.url()).pathname.endsWith('/auth/forgot');
  } catch {
    return false;
  }
};

export interface ForgotWatch {
  readonly count: () => number;
  /** Peticiones POST que fallaron en red (CORS o conexión cortada). */
  readonly failures: () => number;
  readonly bodies: () => readonly unknown[];
}

/** Cuenta los POST a /api/auth/forgot que salen de la página. Hay que llamarla ANTES de la acción observada. */
export const watchForgot = (page: Page): ForgotWatch => {
  const bodies: unknown[] = [];
  let failures = 0;
  page.on('request', (request) => {
    if (isForgotPost(request)) bodies.push(bodyOf(request));
  });
  page.on('requestfailed', (request) => {
    if (isForgotPost(request)) failures += 1;
  });
  return { count: () => bodies.length, failures: () => failures, bodies: () => [...bodies] };
};

/** Qué hace la prueba con el POST: retrasarlo, responder un error del servidor o cortarlo. */
export type ForgotPlan = { readonly kind: 'delay'; readonly ms: number } | { readonly kind: 'status'; readonly status: number } | { readonly kind: 'abort' };

export interface Gate {
  /** La respuesta retrasada ya se ha dejado pasar (las lecturas posteriores ya no son «durante la espera»). */
  readonly released: () => boolean;
  /** La respuesta (la real, la simulada o el corte) ya se ha entregado al navegador. */
  readonly answered: () => boolean;
}

const answerWith = (route: Route, plan: ForgotPlan): Promise<void> => {
  if (plan.kind === 'abort') return route.abort('failed');
  if (plan.kind === 'status') {
    // Se refleja el origen para que el navegador acepte la respuesta simulada (CORS); el cuerpo no trae ningún `code` del catálogo
    const origin = route.request().headers()['origin'] ?? '*';
    return route.fulfill({
      status: plan.status,
      headers: { 'access-control-allow-origin': origin },
      contentType: 'application/json',
      body: JSON.stringify({ message: 'respuesta simulada por la prueba' }),
    });
  }
  return route.continue();
};

/** Intercepta solo el POST de /api/auth/forgot (las comprobaciones previas del navegador siguen su curso). */
export const interceptForgot = async (page: Page, plan: ForgotPlan): Promise<Gate> => {
  let released = false;
  let answered = false;
  await page.route(
    (url) => url.pathname.endsWith('/auth/forgot'),
    async (route) => {
      if (route.request().method() !== 'POST') return route.continue();
      if (plan.kind === 'delay') await sleep(plan.ms);
      released = true;
      await answerWith(route, plan);
      answered = true;
    },
  );
  return { released: () => released, answered: () => answered };
};

/** Lo que se observa mientras la respuesta está retenida: el control ocupado y el aviso de éxito todavía sin aparecer. */
export interface BusyReading {
  readonly busy: boolean;
  readonly noticeHidden: boolean;
}

/**
 * Muestrea `read` mientras la respuesta retrasada no se ha liberado. «Durante la espera» es una condición mantenida: una lectura que
 * cruza la liberación no cuenta. `onFirst` se ejecuta una vez, tras la primera muestra válida (pulsaciones forzadas o Enter en el campo).
 */
export const sampleUntilReleased = async <T>(gate: Gate, read: () => Promise<T>, fallback: T, maxMs: number, onFirst: () => Promise<void>): Promise<readonly T[]> => {
  const samples: T[] = [];
  const started = performance.now();
  while (!gate.released() && performance.now() - started < maxMs) {
    const waiting = !gate.released();
    const reading = await safe(read, fallback);
    if (waiting && !gate.released()) {
      samples.push(reading);
      if (samples.length === 1) await onFirst();
    }
    await sleep(50);
  }
  return samples;
};

// --- Pasos con la llamada de Playwright en la nota ----------------------------------------------------------------------------

/** Las tres primeras líneas no vacías del error de Playwright (la llamada y su motivo). */
const callLogOf = (error: unknown): string =>
  (error instanceof Error ? error.message : String(error))
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '')
    .slice(0, 3)
    .join(' | ');

/** Como `runSteps` de support/browser (que no se toca), pero la falla conserva las tres primeras líneas del error de Playwright. */
export const runStepsLogged = async (steps: readonly Step[]): Promise<string | undefined> => {
  for (const [what, action] of steps) {
    try {
      await action();
    } catch (error) {
      return `no se pudo ${what}: ${callLogOf(error)}`;
    }
  }
  return undefined;
};

// --- Resultados -----------------------------------------------------------------------------------------------------------

/** La acción de la fila no se pudo hacer: la pantalla no ofrece lo que la historia nombra; la llamada de Playwright va en la nota. */
export const actionMissing = (expected: string, failure: string): Outcome =>
  outcome(false, expected, failure, { note: `La historia nombra un elemento que la pantalla no ofrece. Llamada de Playwright: ${failure}` });

/** La preparación de la fila no produjo lo que la historia da por hecho: discrepa con el motivo en la nota (no es error del arnés). */
export const preparationMissedWeb = (expected: string, reason: string): Outcome =>
  outcome(false, expected, `la preparación no se cumplió: ${reason}`, {
    note: `No se pudo reproducir el estado inicial que da por hecho la historia; la app no hace lo que la preparación describe. Detalle: ${reason}`,
  });

/** Nota de plataforma solo si el texto escrito tiene espacios en los extremos. */
export const typedNote = (typed: string): { readonly note?: string } => (typed === typed.trim() ? {} : { note: EMAIL_NOTE });

/** Correo nuevo de «(correo sin cuenta)»: `nadie-<marca>@sigpro.test`, distinto en cada llamada. */
export const unknownEmail = (): string => uniqueEmail('nadie');

/** Pasos para escribir en «Correo electrónico» y pulsar «Enviar enlace». */
export const submitSteps = (page: Page, typed: string): Step[] => [
  ['escribir «Correo electrónico»', () => emailField(page).fill(typed, ACTION)],
  ['pulsar «Enviar enlace»', () => submitButton(page).click(ACTION)],
];

// --- Reglas de la pantalla /forgot (web) --------------------------------------------------------------------------------------

/** Lo que la historia dice de la pantalla: título, texto, orden de campo y botones, y sin contraseña ni «Mantener la sesión». */
export const screenChecksWeb = async (page: Page): Promise<readonly Check[]> => {
  const title = await visibilityOf(page.getByRole('heading', { name: FORGOT_TITLE, exact: true }));
  const hint = await visibilityOf(page.getByText(FORGOT_HINT, { exact: true }));
  const order = inOrder(await boxOf(emailField(page)), await boxOf(submitButton(page)), await boxOf(backButton(page)));
  const password = await visibilityOf(passwordField(page));
  const remember = await visibilityOf(page.getByText(REMEMBER, { exact: true }));
  return [
    check(title === 'visible', `título «${FORGOT_TITLE}»`, `título ${title}`),
    check(hint === 'visible', `texto «${FORGOT_HINT}»`, `texto ${hint}`),
    check(order, 'el formulario tiene, en orden, «Correo electrónico», «Enviar enlace» y «Volver al inicio de sesión»', order ? 'en ese orden' : 'otro orden o algún elemento ausente o ilegible'),
    check(password === 'hidden', 'no pide la contraseña', `campo de contraseña ${password}`),
    check(remember === 'hidden', 'no muestra la casilla «Mantener la sesión en este equipo»', `casilla ${remember}`),
  ];
};

// --- Navegación y estado de la pantalla -------------------------------------------------------------------------------------

export const onLoginForm = async (page: Page): Promise<boolean> => pathOf(page) === LOGIN_PATH && (await visibilityOf(loginHeading(page))) === 'visible';
/** En /forgot el campo de correo es único (el de /login no está en la página). */
export const onForgot = async (page: Page): Promise<boolean> => pathOf(page) === FORGOT_PATH && (await visibilityOf(emailField(page))) === 'visible';
export const onPrograms = async (page: Page): Promise<boolean> => pathOf(page) === PROGRAMS_PATH && (await isVisible(programsHeading(page)));

export const openLogin = (page: Page): Promise<string | undefined> =>
  runStepsLogged([
    ['abrir /login?tenant=alumno01', () => page.goto(LOGIN_URL, ACTION)],
    ['ver el título «Iniciar sesión»', () => loginHeading(page).waitFor(ACTION)],
  ]);

export const openForgot = (page: Page): Promise<string | undefined> =>
  runStepsLogged([
    ['abrir /forgot?tenant=alumno01', () => page.goto(FORGOT_URL, ACTION)],
    ['ver el campo «Correo electrónico»', () => emailField(page).waitFor(ACTION)],
  ]);

/** Inicia sesión en la propia pantalla de acceso (con la cuenta y la contraseña de la fila) y espera la llegada a /programs. */
export const signInFromLogin = (page: Page, email: string, password: string): Promise<string | undefined> =>
  runStepsLogged([
    ['abrir /login?tenant=alumno01', () => page.goto(LOGIN_URL, ACTION)],
    ['ver el título «Iniciar sesión»', () => loginHeading(page).waitFor(ACTION)],
    ['escribir el correo', () => emailField(page).fill(email, ACTION)],
    ['escribir la contraseña', () => passwordField(page).fill(password, ACTION)],
    ['pulsar «Entrar»', () => enterButton(page).click(ACTION)],
    // Como en REGISTRO: la llegada se espera por la ruta (el encabezado y el banner pueden coincidir y el `waitFor` estricto lanzaría)
    ['llegar a /programs', () => page.waitForURL(/\/programs/, ACTION)],
  ]);
