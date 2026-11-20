import type { Locator, Page } from '@playwright/test';
import { DEMO, TENANT_A, resetTenants } from '../../../story-runs/support/prepare';
import { ACTION, CEILING_MS, holdsFor, isVisible, pathOf, waitUntil, type Step } from '../../support/browser';
import { check, conclude as concludeChecks, type Check } from '../../support/checks';
import { notExecutable, type Outcome } from '../../core/framework';
import type { Credentials } from '../../../story-runs/support/prepare';

// Piezas comunes de las pruebas de navegador de EP-MULTITENANT-PERMISOS (web a 1440 px). Criterio: una persona entra con la cuenta de su rol
// en /login?tenant=alumno01 y actúa con clics y escritura. Un fallo de localizador, de clic o de navegación NO es un hallazgo: se devuelve
// con su diagnóstico (`interact`) y la fila sale `no-ejecutable`. Una lectura que no se puede hacer (error, elemento ambiguo) tampoco se da
// por cumplida: sale `no-ejecutable` con «lectura no legible», nunca «habilitado».

/** Cuentas que usa cada rol en las filas de la web (las del seed; el admin es la cuenta de administración del alumno). */
export const ROLE_LOGIN: ReadonlyMap<string, Credentials> = new Map<string, Credentials>([
  ['admin', { email: `${TENANT_A}@sigpro.lab`, password: 'Alumno1234!' }],
  ['program_manager', DEMO.gestor],
  ['consultant', DEMO.consultor],
  ['auditor', DEMO.auditor],
]);

/** Reinicio de alumno01 con el token de su administrador: antes de cada fila, como dice la regla de preparación. */
export const resetAlumno01 = (): Promise<void> => resetTenants([TENANT_A]);

export const loginField = (page: Page): Locator => page.getByLabel('Correo electrónico', { exact: true });
export const passwordField = (page: Page): Locator => page.getByLabel('Contraseña', { exact: true });
export const enterButton = (page: Page): Locator => page.getByRole('button', { name: 'Entrar', exact: true });
export const programsHeading = (page: Page): Locator => page.getByRole('heading', { name: 'Programas', exact: true }).or(page.getByRole('banner').getByText('Programas', { exact: true }));

const onPrograms = async (page: Page): Promise<boolean> => pathOf(page) === '/programs' && (await isVisible(programsHeading(page)));

/** Diagnóstico de un fallo de acción: las tres primeras líneas del error y la de «intercepts pointer events» si aparece. */
export interface Diagnosis {
  readonly failure: string;
  readonly evidence: Readonly<Record<string, unknown>>;
}

const firstLines = (error: unknown): string => (error instanceof Error ? error.message : String(error)).split('\n').slice(0, 3).join(' | ');
const interceptLine = (error: unknown): string | undefined => (error instanceof Error ? error.message : String(error)).split('\n').find((line) => line.includes('intercepts pointer events'));

/** Preferencia de cookies fijada antes de abrir la app (sigpro.cookies = accepted), para que el aviso no tape los controles. Solo en la web. */
export const acceptCookiesFirst = async (page: Page): Promise<void> => {
  await page.addInitScript(() => {
    try {
      if (window.localStorage.getItem('sigpro.cookies') === null) window.localStorage.setItem('sigpro.cookies', 'accepted');
    } catch {
      // Sin almacenamiento disponible el aviso aparece y la fila lo refleja
    }
  });
};

/** Salvedad de la prueba web: la preferencia de cookies se fija antes de abrir la app (la historia no lo dice). */
export const COOKIE_NOTE = 'La prueba fija la preferencia de cookies (sigpro.cookies = accepted) antes de abrir la app para que el aviso no tape los controles; la historia no lo dice.';

/**
 * Ejecuta los pasos en orden. Ante un fallo devuelve el diagnóstico (no lanza): el manejador decide si es `no-ejecutable`
 * (localizador, clic o pantalla no alcanzada) o un hallazgo (la pantalla es la correcta y la app no ofrece el elemento).
 */
export const interact = async (steps: readonly Step[]): Promise<Diagnosis | undefined> => {
  for (const [what, action] of steps) {
    try {
      await action();
    } catch (error) {
      const intercept = interceptLine(error);
      return {
        failure: `no se pudo ${what}: ${firstLines(error)}`,
        evidence: { paso: what, error: firstLines(error), ...(intercept ? { intercepta: intercept } : {}) },
      };
    }
  }
  return undefined;
};

/** Entra con la cuenta del rol en /login?tenant=alumno01 con un contexto sin sesión. Devuelve el fallo (no lanza) si no llega a /programs. */
export const loginAs = async (page: Page, credentials: Credentials): Promise<Diagnosis | undefined> => {
  await acceptCookiesFirst(page);
  const failure = await interact([
    ['abrir /login?tenant=alumno01', () => page.goto('/login?tenant=alumno01', { timeout: CEILING_MS })],
    ['escribir el correo', () => loginField(page).fill(credentials.email, ACTION)],
    ['escribir la contraseña', () => passwordField(page).fill(credentials.password, ACTION)],
    ['pulsar «Entrar»', () => enterButton(page).click(ACTION)],
  ]);
  if (failure) return failure;
  const arrived = await waitUntil(() => onPrograms(page));
  return arrived.reached ? undefined : { failure: `no se llegó a /programs tras «Entrar» (ruta ${pathOf(page)})`, evidence: { ruta: pathOf(page) } };
};

/**
 * Veredicto de una fila. Si discrepa, la nota dice lo que se esperaba y lo que se observó en cada comprobación que no se cumplió.
 * Sin `extra.note`, la nota es la salvedad de cookies de la prueba web.
 */
export const conclude = (checks: readonly Check[], extra: Pick<Outcome, 'note' | 'evidence'> = {}): Outcome => {
  const note = extra.note ?? COOKIE_NOTE;
  const result = concludeChecks(checks, { ...extra, note });
  if (result.verdict !== 'discrepa') return result;
  const differs = checks
    .filter((entry) => !entry.ok)
    .map((entry) => `se esperaba ${entry.expected}; se observó ${entry.observed}`)
    .join(' | ');
  return { ...result, note: `${note} | ${differs}` };
};

/** Fila bloqueada por el arnés (pantalla no alcanzada, clic o localizador): `no-ejecutable` con el error como evidencia. */
export const blocked = (expected: string, diagnosis: Diagnosis): Outcome => ({ ...notExecutable(expected, diagnosis.failure), evidence: diagnosis.evidence });

/** Estado esperado de una celda web: «habilitada»/«habilitado», o «deshabilitada, con el motivo «…»». */
export const parseWebState = (text: string): { readonly enabled: true } | { readonly enabled: false; readonly reason: string } => {
  const trimmed = text.trim();
  if (trimmed === 'habilitada' || trimmed === 'habilitado') return { enabled: true };
  const reason = /con el motivo «([^»]+)»$/.exec(trimmed)?.[1];
  if (trimmed.startsWith('deshabilitad') && reason !== undefined) return { enabled: false, reason };
  throw new Error(`celda sin interpretación: estado «${text}»`);
};

/** Textos entre «…» de una celda (en orden). */
export const quotedItems = (text: string): readonly string[] => Array.from(text.matchAll(/«([^»]+)»/g), (match) => match[1] ?? '');

/**
 * Estado de un control. `readable` es falso si la lectura falla o el selector no es único: en ese caso la fila no se puede juzgar
 * (nunca cuenta como «habilitado» ni como «sin motivo»).
 */
export interface ControlState {
  readonly readable: boolean;
  readonly visible: boolean;
  readonly disabled: boolean;
  readonly title: string | undefined;
}

const UNREADABLE: ControlState = { readable: false, visible: false, disabled: false, title: undefined };

export const stateOf = async (target: Locator): Promise<ControlState> => {
  try {
    const found = await target.count();
    if (found > 1) return UNREADABLE;
    if (found === 0) return { readable: true, visible: false, disabled: false, title: undefined };
    const one = target.first();
    const visible = await one.isVisible();
    if (!visible) return { readable: true, visible: false, disabled: false, title: undefined };
    const disabled = await one.isDisabled({ timeout: 500 });
    const title = await one.getAttribute('title', { timeout: 500 });
    return { readable: true, visible: true, disabled, title: title === null || title === '' ? undefined : title };
  } catch {
    return UNREADABLE;
  }
};

/** Frase de lo observado para un control. */
export const describeState = (state: ControlState): string => {
  if (!state.visible) return 'no aparece en pantalla';
  const motive = state.title === undefined ? 'sin motivo' : `con el motivo «${state.title}»`;
  return state.disabled ? `deshabilitado ${motive}` : `habilitado ${motive}`;
};

/** Comprobación del estado esperado: habilitado sin motivo, o deshabilitado con un motivo exacto. Requiere una lectura legible. */
export const stateCheck = (state: ControlState, label: string, expected: 'habilitado' | { readonly disabledWith: string }): Check => {
  const wanted = expected === 'habilitado' ? `«${label}» habilitado sin motivo` : `«${label}» deshabilitado con el motivo «${expected.disabledWith}»`;
  const ok =
    expected === 'habilitado'
      ? state.visible && !state.disabled && state.title === undefined
      : state.visible && state.disabled && state.title === expected.disabledWith;
  return check(ok, wanted, `«${label}» ${describeState(state)}`);
};

/** Ausencia sostenida: durante `ms` no se ve el elemento. Un error de lectura cuenta como «no ausente» (la condición no se da por cumplida). */
export const absentFor = async (target: Locator, ms: number): Promise<boolean> => {
  const result = await holdsFor(async () => {
    try {
      return (await target.count()) === 0 || !(await target.first().isVisible());
    } catch {
      return false;
    }
  }, ms);
  return result.held;
};

/** Control positivo de que el menú lateral está montado (al menos tres enlaces visibles), antes de afirmar que un enlace no aparece. */
export const menuLoaded = async (page: Page): Promise<boolean> => {
  const loaded = await waitUntil(async () => {
    try {
      return (await page.getByRole('link').count()) >= 3 && (await page.getByRole('link').first().isVisible());
    } catch {
      return false;
    }
  });
  return loaded.reached;
};
