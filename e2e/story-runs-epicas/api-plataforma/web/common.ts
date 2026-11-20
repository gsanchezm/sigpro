import type { BrowserContext, Locator, Page } from '@playwright/test';
import { TENANT_A } from '../../../story-runs/support/prepare';
import { prepareAlumno } from '../api/common';
import { CEILING_MS, holdsFor, isFocused, noSessionCheck, pathOf, safe, waitUntil, type Step } from '../../support/browser';
import { check, type Check } from '../../support/checks';
import { outcome, type Outcome } from '../../core/framework';

// Piezas comunes de las filas de la web (1440 × 900) y de la app móvil servida como web de Expo (390 × 844, en el manejador móvil).
// Criterio: los localizadores son de rol, de etiqueta y de texto; el id de prueba solo donde la pantalla no ofrece otro rastro (la
// insignia de cada tarjeta). Una lectura que falla o es ambigua NO cuenta como cumplida ni como ausente: la comprobación falla con
// «lectura no legible» o «ambigua». Cuando una acción falla, el motivo registra las tres primeras líneas del error de Playwright, la
// línea «intercepts pointer events» si aparece y qué elemento hay en el centro del objetivo (elementFromPoint).

/** Texto de los avisos y títulos que citan las historias de esta épica. */
export const ALERT_LOGIN = 'Correo o contraseña incorrectos';
export const LOGIN_PATH = `/login?tenant=${TENANT_A}`;
export const REGISTER_PATH = `/register?tenant=${TENANT_A}`;
export const PANEL_NAME = /usuarios de prueba/i;

/** Nombres de las seis cuentas de demostración (el texto de la tabla de la historia). */
export const NOMBRES: ReadonlyMap<string, string> = new Map<string, string>([
  ['Marta Ruiz', 'Marta Ruiz'],
  ['Javier Ortega', 'Javier Ortega'],
  ['Lucía Fernández', 'Lucía Fernández'],
  ['Andrés Molina', 'Andrés Molina'],
  ['Carmen Vidal', 'Carmen Vidal'],
  ['Pablo Serrano', 'Pablo Serrano'],
]);

/** Nota de la preferencia de cookies: el banner de la web tapa la zona baja de la pantalla, donde está el panel. */
export const COOKIE_NOTE = 'La prueba fija la preferencia de cookies (sigpro.cookies = accepted) antes de abrir la app, como las filas de otras épicas: el aviso de cookies tapa la zona baja de la pantalla y no es una sesión; esta fila no ejerce el aviso.';
/** Nota de la app móvil: Expo web no es nativo. */
export const MOBILE_NOTE = 'El veredicto vale para Expo web (390 × 844): no se ha comprobado en iOS ni en Android nativo.';

/** Tolerancia de una reacción local de la pantalla y ventana para afirmar que algo NO ocurre (la historia no fija plazos). */
export const HOLD_MS = 2_000;

// --- Lecturas ----------------------------------------------------------------------------------------------------------------

export type Reading = 'visible' | 'oculto' | 'ambiguo' | 'no-legible';

/** Estado de un elemento: cero coincidencias es «oculto»; varias es «ambiguo»; un fallo de lectura es «no-legible». */
export const readingOf = async (target: Locator): Promise<Reading> => {
  try {
    const found = await target.count();
    if (found === 0) return 'oculto';
    if (found > 1) return 'ambiguo';
    return (await target.isVisible()) ? 'visible' : 'oculto';
  } catch {
    return 'no-legible';
  }
};

/** Lo que se observó de un elemento, en una frase, para la comprobación. */
export const readingText = (reading: Reading): string => {
  const words: Readonly<Record<Reading, string>> = { visible: 'visible', oculto: 'oculto', ambiguo: 'ambiguo (varios elementos)', 'no-legible': 'no legible' };
  return words[reading];
};

/** Texto de un elemento (`textContent`, con los espacios normalizados) o `undefined` si no se puede leer. */
export const textContentOf = (target: Locator): Promise<string | undefined> =>
  safe(
    () =>
      target.first().evaluate(
        (element) => (element.textContent ?? '').replace(/\s+/g, ' ').trim(),
        undefined,
        { timeout: 2000 },
      ),
    undefined,
  );

/** Caja de texto medida: el texto completo del elemento y si el CSS lo recorta (overflow + puntos suspensivos). */
export interface TextBox {
  readonly text: string;
  readonly scrollWidth: number;
  readonly clientWidth: number;
  readonly clipped: boolean;
}

/**
 * Texto completo (solo sin espacios de los extremos) y anchura del elemento. La historia dice «ve el correo y la contraseña en esa
 * tarjeta»: si la clase `truncate` recorta el texto, la persona no lo ve entero aunque esté en el DOM.
 */
export const textBoxOf = async (target: Locator): Promise<TextBox | undefined> => {
  const measured = await safe(
    () =>
      target.first().evaluate(
        (element) => ({ text: (element.textContent ?? '').trim(), scrollWidth: element.scrollWidth, clientWidth: element.clientWidth }),
        undefined,
        { timeout: 2000 },
      ),
    undefined,
  );
  return measured === undefined ? undefined : { ...measured, clipped: measured.scrollWidth > measured.clientWidth };
};

/** Referencia de la prueba para una reacción local de la pantalla (README, Tolerancias: 1 s). Es un dato aparte, no un veredicto. */
export const LOCAL_REFERENCE_MS = 1_000;

/** Tiempo observado hasta que algo desaparece, como dato aparte, con la referencia de la prueba. */
export const timingData = (elapsedMs: number): { readonly tiempoObservadoMs: number; readonly referenciaLocalMs: number; readonly superaReferencia: boolean } => ({
  tiempoObservadoMs: elapsedMs,
  referenciaLocalMs: LOCAL_REFERENCE_MS,
  superaReferencia: elapsedMs > LOCAL_REFERENCE_MS,
});

// --- Diagnóstico de acciones ---------------------------------------------------------------------------------------------------

const linesOfError = (error: unknown): string[] =>
  (error instanceof Error ? error.message : String(error))
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '');

/** Qué elemento hay en el centro del objetivo (si hay alguno): distingue «tapado» de «no recibe la acción». */
const hitAt = (target: Locator): Promise<string | undefined> =>
  safe(
    () =>
      target.first().evaluate(
        (element) => {
          const box = element.getBoundingClientRect();
          const top = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
          if (top === null) return '(nada)';
          return `${top.tagName.toLowerCase()} ${top.getAttribute('data-testid') ?? (top.textContent ?? '').trim().slice(0, 40)}`;
        },
        undefined,
        { timeout: 2000 },
      ),
    undefined,
  );

/** Ejecuta las acciones en orden; si una falla, devuelve el motivo con el diagnóstico (no lanza). */
export const runStepsLogged = async (steps: readonly Step[], target?: Locator): Promise<string | undefined> => {
  for (const [what, action] of steps) {
    try {
      await action();
    } catch (error) {
      const lines = linesOfError(error);
      const head = lines.slice(0, 3);
      const intercept = lines.find((line) => line.includes('intercepts pointer events'));
      const hit = target === undefined ? undefined : await hitAt(target);
      const parts = [`no se pudo ${what}: ${head.join(' | ')}`];
      if (intercept !== undefined && !head.includes(intercept)) parts.push(intercept);
      if (hit !== undefined) parts.push(`elementFromPoint: ${hit}`);
      return parts.join(' | ');
    }
  }
  return undefined;
};

// --- Preparación ---------------------------------------------------------------------------------------------------------------

/** La preferencia de cookies se fija antes de abrir la app (el banner no es una sesión). */
const fixCookiePreference = (): void => {
  try {
    window.localStorage.setItem('sigpro.cookies', 'accepted');
  } catch {
    // sin almacenamiento: el aviso aparecerá y la fila no lo ejerce
  }
};

/** Reinicia alumno01 y abre `path` en un contexto limpio. Devuelve por qué no se abrió, si no se abrió. */
export const openPage = async (page: Page, context: BrowserContext, path: string): Promise<string | undefined> => {
  await prepareAlumno();
  await context.addInitScript(fixCookiePreference);
  return runStepsLogged([[`abrir ${path}`, () => page.goto(path, { timeout: CEILING_MS })]]);
};

// --- Localizadores de la web ---------------------------------------------------------------------------------------------------

export const loginHeading = (page: Page): Locator => page.getByRole('heading', { name: 'Iniciar sesión', exact: true });
export const programsHeading = (page: Page): Locator =>
  page.getByRole('heading', { name: 'Programas', exact: true }).or(page.getByRole('banner').getByText('Programas', { exact: true }));
export const emailField = (page: Page): Locator => page.getByLabel('Correo electrónico', { exact: true });
export const passwordField = (page: Page): Locator => page.getByLabel('Contraseña', { exact: true });
export const enterButton = (page: Page): Locator => page.getByRole('button', { name: 'Entrar', exact: true });
/** El panel «Usuarios de prueba» (una sección con su encabezado como nombre). */
export const panelOf = (page: Page): Locator => page.getByRole('region', { name: PANEL_NAME });
/** La tarjeta de una cuenta: un botón cuyo nombre accesible lleva su nombre. */
export const cardOf = (page: Page, nombre: string): Locator => page.getByRole('button', { name: new RegExp(nombre) });
/** Aviso de error del servidor con un texto dado (role="alert"). */
export const alertWith = (page: Page, text: string): Locator => page.getByRole('alert').filter({ hasText: text });

/** Peticiones de inicio de sesión que salen de la página: arma el registro ANTES de la acción. */
export const watchLogins = (page: Page): string[] => {
  const posts: string[] = [];
  page.on('request', (request) => {
    if (request.method() === 'POST' && request.url().includes('/auth/login')) posts.push(request.url());
  });
  return posts;
};

export const onLoginForm = async (page: Page): Promise<boolean> => pathOf(page) === '/login' && (await readingOf(loginHeading(page))) === 'visible';
export const onPrograms = async (page: Page): Promise<boolean> => pathOf(page) === '/programs' && (await readingOf(programsHeading(page))) === 'visible';

/** «Sin sesión iniciada»: abrir /programs acaba en /login y se queda ahí. Navega: va siempre el último paso de la fila. */
export const sessionCheck = (page: Page): Promise<Check> => noSessionCheck(page, onLoginForm, onPrograms);

/** ¿Sigue en /login durante la ventana de observación? */
export const stillOnLogin = async (page: Page): Promise<{ readonly held: boolean }> => holdsFor(() => onLoginForm(page), HOLD_MS);

/** Esperas con techo sobre lecturas de la pantalla (las reacciones locales no superan la tolerancia de la prueba). */
export const waitVisible = (target: Locator): Promise<{ readonly reached: boolean; readonly elapsedMs: number }> =>
  waitUntil(async () => (await readingOf(target)) === 'visible');

export const waitHidden = (target: Locator): Promise<{ readonly reached: boolean; readonly elapsedMs: number }> =>
  waitUntil(async () => (await readingOf(target)) === 'oculto');

/** El campo tiene el foco (espera con techo: la app lo mueve tras un tic). */
export const waitFocused = (target: Locator): Promise<{ readonly reached: boolean; readonly elapsedMs: number }> => waitUntil(() => isFocused(target));

/** Una acción que no se pudo completar: el diagnóstico (elemento inexistente, tapado o sin respuesta) va a la evidencia. */
export const actionFailed = (expected: string, failure: string): Outcome =>
  outcome(false, expected, failure, { note: 'la acción no se pudo completar: el diagnóstico está en la evidencia', evidence: { diagnostico: failure } });

/** Valor de un campo de texto en este instante (`undefined` si no se puede leer). */
export const valueText = (target: Locator): Promise<string | undefined> => safe(() => target.inputValue({ timeout: 1000 }), undefined);

/** Qué elemento tiene el foco en este instante, para «observado». */
export const focusedOf = (page: Page): Promise<string> =>
  safe(
    () =>
      page.evaluate(() => {
        const element = document.activeElement;
        if (element === null) return '(ninguno)';
        return `${element.tagName.toLowerCase()} «${element.getAttribute('aria-label') ?? element.id}»`;
      }),
    '(no legible)',
  );

/** Una comprobación de presencia de un elemento con su lectura: «ve X» o «no ve X». */
export const presence = (reading: Reading, shouldBeVisible: boolean, subject: string): Check =>
  check(shouldBeVisible ? reading === 'visible' : reading === 'oculto', shouldBeVisible ? `ve ${subject}` : `no ve ${subject}`, `${readingText(reading)}: ${subject}`);
