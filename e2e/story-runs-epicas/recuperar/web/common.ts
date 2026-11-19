import type { Locator, Page, Request, Route } from '@playwright/test';
import { uniqueEmail } from '../../../story-runs/support/api';
import { TENANT_A } from '../../../story-runs/support/prepare';
import { ACCESO_TESTIDS } from '../../../../packages/shared/src/testids';
import { ACTION, isVisible, linesOf, pathOf, runSteps, safe, textOf, type Step } from '../../support/browser';
import { sleep } from '../../support/checks';
import { outcome, type Outcome } from '../../core/framework';

// Piezas comunes de las filas web (/forgot a 1440 px) y de las filas de la app móvil servida como web de Expo (EP-RECUPERAR). Los
// localizadores son de rol y de etiqueta («Correo electrónico», «Enviar enlace»…). Los de prueba (testids de testids.ts) solo donde la
// pantalla no ofrece otro rastro: el aviso bajo el campo, que no tiene rol propio. Las lecturas no lanzan y distinguen tres casos:
// visible, oculto y no legible; una lectura no legible nunca cuenta como «no visible» ni como cumplida.

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

/** Tolerancia de la prueba para una reacción local de la pantalla (la historia no fija plazos). */
export const LOCAL_MS = 1_000;
/** Ventana ÚNICA con la que se observa que algo NO ocurre: una por fila, nunca varias en serie. */
export const OBSERVE_MS = 1_000;

/** Salvedad de plataforma: el campo de correo de la web es de tipo correo y el navegador recorta los espacios antes de la app. */
export const EMAIL_NOTE = 'el campo de correo es de tipo correo y el navegador recorta los espacios de los extremos: la app solo recibe el texto ya recortado (en un teclado nativo no ocurre)';

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

/** Si un botón está habilitado; `undefined` si la lectura no es fiable. */
export const enabledOf = async (target: Locator): Promise<boolean | undefined> => {
  try {
    if ((await target.count()) !== 1) return undefined;
    return await target.isEnabled({ timeout: 500 });
  } catch {
    return undefined;
  }
};

/** Tipo EFECTIVO de un campo (propiedad del elemento): en la web, el del campo de correo es `email`. */
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

// --- Peticiones POST a /api/auth/forgot ---------------------------------------------------------------------------------------

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
  /** La respuesta retrasada ya se ha dejado pasar (la lectura posterior ya no es «durante la espera»). */
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

/**
 * Muestrea `read` mientras la respuesta retrasada no se ha liberado. «Durante la espera» es una condición mantenida: una lectura que
 * cruza la liberación no cuenta. `onFirst` se ejecuta una vez, tras la primera muestra válida (p. ej. un intento de pulsación forzada).
 */
export const sampleUntilReleased = async (gate: Gate, read: () => Promise<boolean>, maxMs: number, onFirst: () => Promise<void>): Promise<readonly boolean[]> => {
  const samples: boolean[] = [];
  const started = performance.now();
  while (!gate.released() && performance.now() - started < maxMs) {
    const waiting = !gate.released();
    const reading = await safe(read, false);
    if (waiting && !gate.released()) {
      samples.push(reading);
      if (samples.length === 1) await onFirst();
    }
    await sleep(50);
  }
  return samples;
};

// --- Navegación y estado de la pantalla -------------------------------------------------------------------------------------

export const onLoginForm = async (page: Page): Promise<boolean> => pathOf(page) === LOGIN_PATH && (await visibilityOf(loginHeading(page))) === 'visible';
/** En /forgot el campo de correo es único (el de /login no está en la página). */
export const onForgot = async (page: Page): Promise<boolean> => pathOf(page) === FORGOT_PATH && (await visibilityOf(emailField(page))) === 'visible';
export const onPrograms = async (page: Page): Promise<boolean> => pathOf(page) === PROGRAMS_PATH && (await isVisible(programsHeading(page)));

export const openLogin = (page: Page): Promise<string | undefined> =>
  runSteps([
    ['abrir /login?tenant=alumno01', () => page.goto(LOGIN_URL, ACTION)],
    ['ver el título «Iniciar sesión»', () => loginHeading(page).waitFor(ACTION)],
  ]);

export const openForgot = (page: Page): Promise<string | undefined> =>
  runSteps([
    ['abrir /forgot?tenant=alumno01', () => page.goto(FORGOT_URL, ACTION)],
    ['ver el campo «Correo electrónico»', () => emailField(page).waitFor(ACTION)],
  ]);

/** Inicia sesión en la propia pantalla de acceso (con la cuenta y la contraseña de la fila) y espera a /programs. */
export const signInFromLogin = (page: Page, email: string, password: string): Promise<string | undefined> =>
  runSteps([
    ['abrir /login?tenant=alumno01', () => page.goto(LOGIN_URL, ACTION)],
    ['ver el título «Iniciar sesión»', () => loginHeading(page).waitFor(ACTION)],
    ['escribir el correo', () => emailField(page).fill(email, ACTION)],
    ['escribir la contraseña', () => passwordField(page).fill(password, ACTION)],
    ['pulsar «Entrar»', () => enterButton(page).click(ACTION)],
    // Como en REGISTRO: la llegada se espera por la ruta (el encabezado y el banner pueden coincidir y el `waitFor` estricto lanzaría)
    ['llegar a /programs', () => page.waitForURL(/\/programs/, ACTION)],
  ]);

/** La salida prevista de la historia no se pudo hacer: la pantalla no ofrece lo que la historia nombra. */
export const actionMissing = (expected: string, failure: string): Outcome =>
  outcome(false, expected, failure, { note: 'La historia nombra un elemento que la pantalla no ofrece.' });

/** Nota de plataforma solo si el texto escrito tiene espacios en los extremos (el navegador los recorta en el campo de tipo correo). */
export const typedNote = (typed: string): { readonly note?: string } => (typed === typed.trim() ? {} : { note: EMAIL_NOTE });

/** Correo nuevo de «(correo sin cuenta)»: `nadie-<marca>@sigpro.test`, distinto en cada llamada. */
export const unknownEmail = (): string => uniqueEmail('nadie');

/** Pasos para escribir en un campo de correo y pulsar «Enviar enlace»; la fila añade lo que espera. */
export const submitSteps = (page: Page, typed: string): Step[] => [
  ['escribir «Correo electrónico»', () => emailField(page).fill(typed, ACTION)],
  ['pulsar «Enviar enlace»', () => submitButton(page).click(ACTION)],
];
