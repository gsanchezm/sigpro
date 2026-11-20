import type { Locator, Page } from '@playwright/test';
import { TENANT_A } from '../../../story-runs/support/prepare';
import { ACTION, CEILING_MS, runSteps, safe, type Step } from '../../support/browser';
import { check, type Check } from '../../support/checks';
import { outcome, type BrowserRowHandler, type Outcome } from '../../core/framework';
import { recordToasts, restoringAfter, TOAST_KEY } from '../web/common';
import { withDifference } from '../api/common';

// Piezas comunes de las filas MÓVILES de EP-CAOS-RESET: la app móvil servida como web de Expo a 390 × 844. NO es iOS ni Android nativo:
// el veredicto vale para Expo web. Las lecturas de texto van acotadas a su elemento y las esperas, con techo (`waitUntil`).

export const MOBILE_VIEWPORT = { width: 390, height: 844 } as const;
export const EXPO_NOTE = 'El veredicto vale para Expo web (390 × 844): no se ha comprobado en iOS ni en Android nativo.';

/** Añade la salvedad de plataforma (Expo web no es nativo) al resultado de cada fila móvil. */
export const onMobile = (handler: BrowserRowHandler, tenants: readonly string[] = [TENANT_A]): BrowserRowHandler =>
  restoringAfter(tenants, async (row, fixtures) => {
    const result = await handler(row, fixtures);
    return { ...result, note: result.note === undefined ? EXPO_NOTE : `${result.note} ${EXPO_NOTE}` };
  });

/** Resultado de una fila móvil a partir de sus comprobaciones (coincide solo si todas se cumplen). */
export const mobileOutcome = (checks: readonly Check[], extra: Pick<Outcome, 'note' | 'evidence'> = {}): Outcome =>
  outcome(
    checks.every((entry) => entry.ok),
    checks.map((entry) => entry.expected).join('; '),
    checks.map((entry) => entry.observed).join('; '),
    withDifference(checks, extra),
  );

/** Instala el registro de avisos (antes de cargar la app) y fija la ventana del móvil. Antes de cualquier `goto`. */
export const prepareMobile = async (page: Page): Promise<void> => {
  await page.context().addInitScript(recordToasts, TOAST_KEY);
  await page.setViewportSize(MOBILE_VIEWPORT);
};

/** Inicio de sesión en la app móvil con el tenant de la fila: «Tenant de trabajo», correo, contraseña y «Entrar». Termina en «Programas». */
export const signInMobile = (page: Page, email: string, password: string): Promise<string | undefined> => {
  const steps: Step[] = [
    ['abrir /login', () => page.goto('/login', { timeout: CEILING_MS })],
    ['ver el título «Iniciar sesión»', () => page.getByRole('heading', { name: 'Iniciar sesión', level: 1, exact: true }).waitFor({ timeout: CEILING_MS })],
    [`escribir ${TENANT_A} en «Tenant de trabajo»`, () => page.getByRole('textbox', { name: 'Tenant de trabajo', exact: true }).fill(TENANT_A, ACTION)],
    ['escribir el correo', () => page.getByRole('textbox', { name: 'Correo electrónico', exact: true }).fill(email, ACTION)],
    ['escribir la contraseña', () => page.getByRole('textbox', { name: 'Contraseña', exact: true }).fill(password, ACTION)],
    ['pulsar «Entrar»', () => page.getByRole('button', { name: 'Entrar', exact: true }).click(ACTION)],
    ['llegar a «Programas»', () => page.getByRole('heading', { name: 'Programas', level: 1, exact: true }).waitFor({ timeout: CEILING_MS })],
  ];
  return runSteps(steps);
};

/** Ruta de Administración con su pestaña (la historia la escribe así; la app la lee de la URL). */
export const adminPath = (tab: 'chaos' | 'data'): string => `/admin?tab=${tab}`;

/** Valor de `aria-disabled` de un control (RN-web lo pone solo en los deshabilitados): `undefined` si no se puede leer. */
export const ariaDisabled = (target: Locator): Promise<boolean | undefined> =>
  safe(async () => (await target.first().getAttribute('aria-disabled', { timeout: 1_000 })) === 'true', undefined);

/** Estado `checked` de un interruptor (`role="switch"`): `undefined` si no se puede leer. */
export const switchOn = (target: Locator): Promise<boolean | undefined> =>
  safe(() => target.first().isChecked({ timeout: 1_000 }), undefined);

/** ¿Está el diálogo cerrado? Positivo solo si la lectura de visibilidad responde «no visible»; una lectura fallida NO cumple. */
export const closedCheck = async (dialog: Locator, what: string): Promise<Check> => {
  const visible = await safe<boolean | undefined>(() => dialog.first().isVisible({ timeout: 1_000 }), undefined);
  return check(visible === false, `${what} cerrado`, visible === undefined ? `${what}: (sin leer)` : visible ? `${what} sigue abierto` : `${what} cerrado`);
};

/** Pulsa `count` veces un control con ese nombre accesible. Devuelve el motivo del primer clic que no se pueda hacer. */
export const pressTimes = async (page: Page, name: string, count: number): Promise<string | undefined> => {
  for (let index = 0; index < count; index += 1) {
    const failed = await runSteps([[`pulsar «${name}» (${index + 1} de ${count})`, () => page.getByRole('button', { name, exact: true }).click(ACTION)]]);
    if (failed !== undefined) return failed;
  }
  return undefined;
};
