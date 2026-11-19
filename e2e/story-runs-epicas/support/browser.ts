import type { Locator, Page } from '@playwright/test';
import { sleep, check, type Check } from './checks';

// Piezas comunes de las pruebas de navegador (web y app móvil servida como web) de las épicas posteriores al piloto: lecturas que
// no lanzan, esperas con techo, acciones que devuelven su fallo y la comprobación de «sin sesión» por comportamiento.
// Criterio (el del piloto): lo que la historia nombra y la app no ofrece es una DISCREPANCIA (la historia manda), no un error del
// arnés; por eso toda acción sobre un elemento de la historia pasa por `runSteps` y toda lectura es `safe`.

/** Techo de espera por observación. La historia no fija plazos: este límite es de la prueba, no del producto. */
export const CEILING_MS = 10_000;
/** Tiempo que se observa para afirmar que algo NO ocurre («sigue en /login»). */
export const HOLD_MS = 2_000;
const POLL_MS = 50;
export const ACTION = { timeout: CEILING_MS } as const;

export const safe = async <T>(read: () => Promise<T>, fallback: T): Promise<T> => {
  try {
    return await read();
  } catch {
    return fallback;
  }
};

export const isVisible = (target: Locator): Promise<boolean> => safe(() => target.first().isVisible(), false);
export const isEnabled = (target: Locator): Promise<boolean> => safe(() => target.first().isEnabled({ timeout: 500 }), false);
/** Una lectura fallida cuenta como «no deshabilitado»: ante la duda, la condición NO se da por cumplida. */
export const isDisabled = (target: Locator): Promise<boolean> => safe(() => target.first().isDisabled({ timeout: 500 }), false);
export const valueOf = (target: Locator): Promise<string | undefined> => safe(() => target.first().inputValue({ timeout: 500 }), undefined);
export const attrOf = (target: Locator, name: string): Promise<string | undefined> => safe(async () => (await target.first().getAttribute(name, { timeout: 500 })) ?? undefined, undefined);
export const textOf = (target: Locator): Promise<string | undefined> => safe(async () => (await target.first().innerText({ timeout: 500 })).trim(), undefined);
export const isFocused = (target: Locator): Promise<boolean> => safe(() => target.first().evaluate((element) => element === document.activeElement, undefined, { timeout: 500 }), false);

export const pathOf = (page: Page): string => {
  try {
    return new URL(page.url()).pathname;
  } catch {
    return page.url();
  }
};

export const linesOf = (text: string | undefined): readonly string[] => (text ?? '').split('\n').map((line) => line.trim()).filter((line) => line !== '');

export interface Waited {
  readonly reached: boolean;
  readonly elapsedMs: number;
}

/** Espera a que se cumpla `condition`, con un techo. Nunca lanza: devuelve si se llegó y cuánto se tardó. */
export const waitUntil = async (condition: () => Promise<boolean>, ceilingMs: number = CEILING_MS): Promise<Waited> => {
  const started = performance.now();
  let reached = await safe(condition, false);
  while (!reached && performance.now() - started < ceilingMs) {
    await sleep(POLL_MS);
    reached = await safe(condition, false);
  }
  return { reached, elapsedMs: Math.round(performance.now() - started) };
};

/** Observa durante `durationMs` que `condition` sigue cumpliéndose. */
export const holdsFor = async (condition: () => Promise<boolean>, durationMs: number = HOLD_MS): Promise<{ readonly held: boolean; readonly brokeAtMs?: number }> => {
  const started = performance.now();
  while (performance.now() - started < durationMs) {
    if (!(await safe(condition, false))) return { held: false, brokeAtMs: Math.round(performance.now() - started) };
    await sleep(POLL_MS);
  }
  return { held: true };
};

const shortError = (error: unknown): string => (error instanceof Error ? error.message : String(error)).split('\n')[0] ?? 'error';

export type Step = readonly [what: string, action: () => Promise<unknown>];

/** Ejecuta las acciones en orden y se detiene en la primera que falla; devuelve su descripción o `undefined` si todas salieron bien. */
export const runSteps = async (steps: readonly Step[]): Promise<string | undefined> => {
  for (const [what, action] of steps) {
    try {
      await action();
    } catch (error) {
      return `no se pudo ${what}: ${shortError(error)}`;
    }
  }
  return undefined;
};

/** Texto de la interfaz entre «…» en una celda («…» y un resto opcional se leen con `quotedParts`). */
export const quoted = (text: string): string => {
  const match = /^«(.+)»$/.exec(text.trim());
  if (!match?.[1]) throw new Error(`celda sin interpretación: texto de la interfaz «${text}» sin comillas «…»`);
  return match[1];
};

/** «Sin sesión», por comportamiento: abrir `/programs` en esta página acaba en `/login` y se queda ahí. Navega: va siempre el último paso. */
export const noSessionCheck = async (page: Page, onLoginForm: (page: Page) => Promise<boolean>, onPrograms: (page: Page) => Promise<boolean>): Promise<Check> => {
  // La carga de la ruta es fontanería: si falla, lanza (con el fallo tragado, una página que ya estaba en /login daría «sin sesión» en vacío)
  await page.goto('/programs', { timeout: CEILING_MS });
  await waitUntil(async () => (await onLoginForm(page)) || (await onPrograms(page)));
  const stays = await holdsFor(() => onLoginForm(page));
  return check(stays.held, 'sin sesión iniciada (abrir /programs acaba en /login)', stays.held ? 'sin sesión: abrir /programs acaba en /login' : `con sesión: abrir /programs acaba en ${pathOf(page)}`);
};
