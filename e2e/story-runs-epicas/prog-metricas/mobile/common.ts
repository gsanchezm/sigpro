import type { Locator, Page } from '@playwright/test';
import { TENANT_A, type Credentials } from '../../../story-runs/support/prepare';
import { MOVIL_PROGRAMS_TESTIDS, MOVIL_TESTIDS } from '../../../../packages/shared/src/testids';
import { ACTION, CEILING_MS, safe, waitUntil } from '../../support/browser';
import { check, type Check } from '../../support/checks';
import type { BrowserRowHandler } from '../../core/framework';
import { runSteps, strictlyVisible, summaryReply, type StepFailure, type SummaryReply } from '../web/common';

// Piezas comunes de las filas de la app móvil de EP-PROG-METRICAS. La app se ejecuta como web de Expo a 390 × 844: NO es iOS ni
// Android nativo. Las tarjetas, el subtítulo y el menú ⋯ se leen por rol y nombre accesible; la cifra y la línea auxiliar de cada
// tarjeta se leen de sus hijos (igual que en la web). Los pasos, la espera con techo y el diagnóstico del fallo son los de
// web/common.ts. Ninguna espera de lista se traga: si la petición de lista que una fila necesita no llega, la fila lo dice.

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
/** Contenedor de las tarjetas de la lista (id de prueba: la lista no tiene nombre accesible). */
export const cardsContainer = (page: Page): Locator => page.getByTestId(MOVIL_TESTIDS.PROGRAMS_CARDS);
/** Enlace de la tarjeta de un programa («PRG-001 · nombre»). */
export const cardLink = (page: Page, code: string): Locator => page.getByRole('link', { name: new RegExp(`^${code} · `) });

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

/** La lista de programas está montada y ya no muestra «Cargando…» (la primera página llegó). Devuelve si llegó. */
export const waitListSettled = async (page: Page): Promise<boolean> =>
  (await waitUntil(async () => (await safe(() => programsHeading(page).isVisible(), false)) && !(await safe(() => listLoading(page).isVisible(), true)), CEILING_MS)).reached;

/** Subtítulo «N programas · M activo»: segundo texto del contenedor del título «Programas». Undefined si no es una lectura limpia. */
export const mobileSubtitle = (page: Page): Promise<string | undefined> =>
  safe(
    async () => {
      const heading = programsHeading(page);
      if ((await heading.count()) !== 1) return undefined;
      const texts = await heading.locator('xpath=..').evaluate((parent) => Array.from(parent.children, (child) => (child.textContent ?? '').trim()).filter((text) => text !== ''), undefined, {
        timeout: 500,
      });
      return texts[1];
    },
    undefined,
  );

/** Códigos de las tarjetas que se ven, en orden (el enlace de cada tarjeta empieza por el código). */
const CARD_LINK = /^PRG-\d{3} · /;
const CODE = /^PRG-\d{3}/;
export const listedCodes = (page: Page): Promise<readonly string[]> =>
  safe(async () => {
    const texts = await page.getByRole('link', { name: CARD_LINK }).allTextContents();
    return texts.map((text) => CODE.exec(text.trim())?.[0]).filter((code): code is string => code !== undefined);
  }, []);

export const sameCodes = (actual: readonly string[], expected: readonly string[]): boolean => actual.length === expected.length && actual.every((code, index) => code === expected[index]);

/**
 * Ejecuta la acción y devuelve si llegó la petición de LISTA (GET /api/programs) que provoca. Si no llega en el techo, devuelve
 * `false`: quien llama lo convierte en un fallo con motivo (no se traga el timeout).
 */
export const afterListResponse = async (page: Page, act: () => Promise<unknown>): Promise<boolean> => {
  const reply = page
    .waitForResponse((response) => new URL(response.url()).pathname === '/api/programs' && response.request().method() === 'GET', { timeout: CEILING_MS })
    .then(
      () => true,
      () => false,
    );
  await act();
  return reply;
};

/**
 * Acción del menú ⋯ de la tarjeta de un programa: se abre la hoja «Acciones para PRG-001», se pulsa la opción y, si pide confirmar,
 * el diálogo «Eliminar programa» con «Eliminar». Devuelve la respuesta del resumen que provoca (o `undefined` si no llegó).
 */
export const cardAction = async (page: Page, code: string, item: string, confirm: boolean): Promise<SummaryReply | undefined> => {
  const reply = summaryReply(page);
  await rowActionsButton(page, code).click(ACTION);
  await page.getByRole('dialog', { name: `Acciones para ${code}`, exact: true }).getByRole('button', { name: item, exact: true }).click(ACTION);
  if (confirm) await page.getByRole('dialog', { name: 'Eliminar programa', exact: true }).getByRole('button', { name: 'Eliminar', exact: true }).click(ACTION);
  return reply;
};

/**
 * La lista se ve de verdad: su contenedor de tarjetas se ve (lectura estricta) y la tarjeta del programa indicado también.
 * Un «count() === 1» no basta: el elemento tiene que estar visible.
 */
export const listVisibleWith = async (page: Page, code: string): Promise<Check> => {
  const container = await strictlyVisible(cardsContainer(page));
  const card = await strictlyVisible(cardLink(page, code));
  return check(container && card, `la lista de programas sigue visible y muestra ${code}`, `contenedor de tarjetas ${container ? 'visible' : 'no visible'}; tarjeta ${code} ${card ? 'visible' : 'no visible'}`);
};
