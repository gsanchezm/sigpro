import type { Locator, Page } from '@playwright/test';
import { TENANT_A, type Credentials } from '../../../story-runs/support/prepare';
import { MOVIL_PROGRAMS_TESTIDS } from '../../../../packages/shared/src/testids';
import { ACTION, CEILING_MS, safe, waitUntil } from '../../support/browser';
import { check, type Check } from '../../support/checks';
import type { BrowserRowHandler } from '../../core/framework';
import { afterSummaryResponse, runSteps, type StepFailure } from '../web/common';

// Piezas comunes de las filas de la app móvil de EP-PROG-METRICAS. La app se ejecuta como web de Expo a 390 × 844: NO es iOS ni
// Android nativo. Las tarjetas, el subtítulo y el menú ⋯ se leen por rol y nombre accesible; la cifra y la línea auxiliar de cada
// tarjeta se leen de sus hijos (igual que en la web), porque la tarjeta móvil no tiene más rastro propio. Los pasos, la espera con
// techo y el diagnóstico del fallo (las tres primeras líneas y el registro de llamada) son los de web/common.ts.

/** Salvedad de plataforma: el veredicto de una fila móvil vale para Expo web, no para iOS ni Android nativo. */
export const EXPO_NOTE = 'El veredicto vale para Expo web (390 × 844): no se ha comprobado en iOS ni en Android nativo.';

/** Añade a cada resultado de la fila la salvedad de plataforma. */
export const onExpoWeb =
  (handler: BrowserRowHandler): BrowserRowHandler =>
  async (row, fixtures) => {
    const result = await handler(row, fixtures);
    return { ...result, note: result.note === undefined ? EXPO_NOTE : `${result.note} ${EXPO_NOTE}` };
  };

export const LOGIN_PATH = '/login';
export const TENANT_TEXT = 'Tenant de trabajo';

// --- Localizadores de rol ---------------------------------------------------------------------------------------------------

export const textbox = (page: Page, name: string): Locator => page.getByRole('textbox', { name, exact: true });
export const buttonNamed = (page: Page, name: string): Locator => page.getByRole('button', { name, exact: true });
export const loginHeading = (page: Page): Locator => page.getByRole('heading', { name: 'Iniciar sesión', level: 1, exact: true });
export const programsHeading = (page: Page): Locator => page.getByRole('heading', { name: 'Programas', level: 1, exact: true });
/** Cabecera de métricas: el grupo con nombre «Resumen de programas» (las cuatro tarjetas son grupos dentro de él). */
export const summaryBlock = (page: Page): Locator => page.getByRole('group', { name: 'Resumen de programas', exact: true });
/** Buscador de la lista («Buscar programas»). */
export const searchBox = (page: Page): Locator => textbox(page, 'Buscar programas');
/** Opción del grupo «Estado» (chips de selección única con rol de radio). */
export const statusChoice = (page: Page, label: string): Locator => page.getByRole('radio', { name: label, exact: true });
/** Botón ⋯ de la tarjeta de un programa («Acciones para PRG-001»). */
export const rowActionsButton = (page: Page, code: string): Locator => buttonNamed(page, `Acciones para ${code}`);
/** Estado de carga de la lista (id de prueba: el indicador «Cargando…» no tiene otro rastro). */
export const listLoading = (page: Page): Locator => page.getByTestId(MOVIL_PROGRAMS_TESTIDS.PROGRAMS_LOADING);

// --- Sesión y espera ------------------------------------------------------------------------------------------------------------

/**
 * Inicio de sesión en la app (sin inyectar nada): escribe alumno01 en «Tenant de trabajo», la cuenta de la fila, y llega a
 * /programs. NO espera a que la lista ni las tarjetas se carguen: cada fila decide qué observa y cuándo.
 */
export const signInTo = (page: Page, credentials: Credentials): Promise<StepFailure | undefined> =>
  runSteps([
    ['abrir /login', () => page.goto(LOGIN_PATH, { timeout: CEILING_MS })],
    ['ver el título «Iniciar sesión»', () => loginHeading(page).waitFor({ timeout: CEILING_MS })],
    [`escribir ${TENANT_A} en «${TENANT_TEXT}»`, () => textbox(page, TENANT_TEXT).fill(TENANT_A, ACTION)],
    ['escribir el correo', () => textbox(page, 'Correo electrónico').fill(credentials.email, ACTION)],
    ['escribir la contraseña', () => textbox(page, 'Contraseña').fill(credentials.password, ACTION)],
    ['pulsar «Entrar»', () => buttonNamed(page, 'Entrar').click(ACTION)],
    ['llegar a /programs', () => programsHeading(page).waitFor({ timeout: CEILING_MS })],
  ]);

/** La lista de programas está montada y ya no muestra «Cargando…» (la primera página llegó). */
export const waitListSettled = async (page: Page): Promise<boolean> =>
  (await waitUntil(async () => (await safe(() => programsHeading(page).isVisible(), false)) && !(await safe(() => listLoading(page).isVisible(), true)))).reached;

/** Subtítulo «N programas · M activo»: segundo texto del contenedor del título «Programas». Undefined si no es una lectura limpia. */
export const mobileSubtitle = (page: Page): Promise<string | undefined> =>
  safe(
    async () => {
      const heading = programsHeading(page);
      if ((await heading.count()) !== 1) return undefined;
      const texts = await heading.locator('xpath=..').evaluate((parent) => Array.from(parent.children, (child) => (child.textContent ?? '').trim()).filter((text) => text !== ''));
      return texts[1];
    },
    undefined,
  );

/** Códigos de las tarjetas que se ven, en orden (el enlace de cada tarjeta empieza por el código). */
const CARD_LINK = /^PRG-\d{3} · /;
const CODE = /^PRG-\d{3}/;
export const listedCodes = async (page: Page): Promise<readonly string[]> => {
  const texts = await page.getByRole('link', { name: CARD_LINK }).allTextContents();
  return texts.map((text) => CODE.exec(text.trim())?.[0]).filter((code): code is string => code !== undefined);
};

/** Espera la respuesta de la lista que provoca la acción (búsqueda, estado). */
export const afterListResponse = async (page: Page, act: () => Promise<unknown>): Promise<void> => {
  const response = page
    .waitForResponse((reply) => new URL(reply.url()).pathname === '/api/programs' && reply.request().method() === 'GET', { timeout: CEILING_MS })
    .catch(() => undefined);
  await act();
  await response;
};

/**
 * Acción del menú ⋯ de la tarjeta de un programa: se abre la hoja «Acciones para PRG-001», se pulsa la opción y, si pide confirmar,
 * el diálogo «Eliminar programa» con «Eliminar». Espera la respuesta del resumen que provoca la acción.
 */
export const cardAction = (page: Page, code: string, item: string, confirm: boolean): Promise<unknown> =>
  afterSummaryResponse(page, async () => {
    await rowActionsButton(page, code).click(ACTION);
    await page.getByRole('dialog', { name: `Acciones para ${code}`, exact: true }).getByRole('button', { name: item, exact: true }).click(ACTION);
    if (confirm) await page.getByRole('dialog', { name: 'Eliminar programa', exact: true }).getByRole('button', { name: 'Eliminar', exact: true }).click(ACTION);
  });

/** Lectura de presencia de la lista: la tarjeta de un programa se ve (o no) en ese momento. */
export const cardSeen = async (page: Page, code: string): Promise<Check> => {
  const seen = (await safe(() => page.getByRole('link', { name: new RegExp(`^${code} · `) }).count(), -1)) === 1;
  return check(seen, `la lista muestra ${code}`, seen ? `la lista muestra ${code}` : `la lista no muestra ${code}`);
};

