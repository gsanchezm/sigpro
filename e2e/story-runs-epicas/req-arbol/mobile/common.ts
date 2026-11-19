import type { Locator, Page } from '@playwright/test';
import { DEMO, resetTenants, TENANT_A, type Credentials } from '../../../story-runs/support/prepare';
import { MOVIL_REQUIREMENTS_TESTIDS, REQUISITOS_DYNAMIC_TESTIDS, REQUISITOS_TESTIDS } from '../../../../packages/shared/src/testids';
import { ACTION, CEILING_MS, isVisible, runSteps, safe, waitUntil } from '../../support/browser';
import { check, preparationFailedWeb, sleep, type Check } from '../../support/checks';
import type { BrowserRowHandler, Outcome } from '../../core/framework';
import { norm, openFailures, textOf, withNotes } from '../web/common';

// Piezas comunes de las filas de la app móvil de EP-REQ-ARBOL. La app se ejecuta como web de Expo a 390 × 844: NO es iOS ni Android nativo.
// Los localizadores son de rol (lista, fila, botón con nombre accesible) y, donde la app no tiene nombre accesible, de su id de prueba
// (buscador, recuento, cifras, documento, hoja de detalle). Lectura y acción pasan por los mismos envoltorios que la web.

export { actionFailed, boxOf, delayList, eq, failList, interact, listOf, norm, textOf } from '../web/common';

/** Salvedad de plataforma: el veredicto de una fila móvil vale para Expo web, no para iOS ni Android nativo. */
export const EXPO_NOTE =
  'El veredicto vale para Expo web (390 × 844): no se ha comprobado en iOS ni en Android nativo. La prueba fija la preferencia de cookies y abre las direcciones por carga completa (aproximación de la app móvil, como en el piloto).';

/** Añade a cada resultado de la fila la salvedad de plataforma; si la pantalla no se asentó al abrirla, la fila es una preparación fallida. */
export const onExpoWeb =
  (handler: BrowserRowHandler): BrowserRowHandler =>
  async (row, fixtures) => {
    const result: Outcome = await handler(row, fixtures);
    const opened = fixtures === undefined ? undefined : openFailures.get(fixtures.page);
    if (opened !== undefined) return preparationFailedWeb(expectedOfRow(row.resolvedSteps), opened);
    return withNotes(result, EXPO_NOTE);
  };

/** Una fila no ejecutable de la app móvil: el motivo va en la nota con la salvedad de plataforma. */
export const NOT_IMPLEMENTED = 'capacidad futura, no se prueba contra la app';

/** Lo que la historia espera en la fila: sus pasos «Entonces» y «Y», tal como se resuelven con las celdas. */
export const expectedOfRow = (steps: readonly string[]): string => steps.filter((step) => /^(Entonces|Y) /.test(step)).join('; ');

/** Fija la preferencia de cookies (no es una sesión): el aviso tapa zonas de la pantalla. */
const fixCookies = (): void => {
  try {
    localStorage.setItem('sigpro.cookies', 'accepted');
  } catch {
    // sin almacenamiento: no hay preferencia que fijar
  }
};

// --- Sesión y apertura ----------------------------------------------------------------------------------------------------------------

/** Reinicia alumno01, abre la app sin sesión, escribe alumno01 en «Tenant de trabajo», la cuenta y pulsa «Entrar»; termina en Programas. */
export const prepareMobile = async (page: Page, credentials: Credentials = DEMO.gestor): Promise<string | undefined> => {
  await resetTenants([TENANT_A]);
  return runSteps([
    ['fijar el ancho de la ventana', () => page.setViewportSize({ width: 390, height: 844 })],
    ['fijar la preferencia de cookies', () => page.context().addInitScript(fixCookies)],
    ['abrir /login', () => page.goto('/login', { timeout: CEILING_MS })],
    ['ver el título «Iniciar sesión»', () => page.getByRole('heading', { name: 'Iniciar sesión', level: 1, exact: true }).waitFor({ timeout: CEILING_MS })],
    ['escribir alumno01 en «Tenant de trabajo»', () => page.getByRole('textbox', { name: 'Tenant de trabajo', exact: true }).fill(TENANT_A, ACTION)],
    ['escribir el correo', () => page.getByRole('textbox', { name: 'Correo electrónico', exact: true }).fill(credentials.email, ACTION)],
    ['escribir la contraseña', () => page.getByRole('textbox', { name: 'Contraseña', exact: true }).fill(credentials.password, ACTION)],
    ['pulsar «Entrar»', () => page.getByRole('button', { name: 'Entrar', exact: true }).click(ACTION)],
    ['llegar a Programas', () => page.getByRole('heading', { name: 'Programas', level: 1, exact: true }).waitFor({ timeout: CEILING_MS })],
  ]);
};

/** Abre una dirección de la app con la sesión guardada y espera a que el árbol o su estado se asienten (recuento real, error o no encontrado). */
export const openMobile = async (page: Page, path: string): Promise<string | undefined> => {
  const failure = await runSteps([
    [`abrir ${path}`, () => page.goto(path, { timeout: CEILING_MS })],
    [
      'ver el árbol o su estado',
      async () => {
        const settled = await waitUntil(
          async () => /^\d+ de \d+ requisitos$/.test(norm(await countText(page)) ?? '') || (await isVisible(page.getByTestId(REQUISITOS_TESTIDS.REQUIREMENTS_ERROR))) || (await isVisible(page.getByTestId(REQUISITOS_TESTIDS.REQUIREMENTS_NOT_FOUND))),
        );
        if (!settled.reached) throw new Error('la pantalla de requisitos no se asienta');
      },
    ],
  ]);
  if (failure !== undefined) openFailures.set(page, failure);
  return failure;
};

/** La hoja de detalle está abierta y visible (la hoja puede quedar montada cerrada: se mira su visibilidad). */
export const sheetOpen = async (page: Page): Promise<boolean> => (await sheet(page).count()) > 0 && (await sheet(page).first().isVisible({ timeout: 2000 }).catch(() => false));

// --- Lecturas (localizadores de la pantalla móvil) -------------------------------------------------------------------------------------

/** Recuento «N de M requisitos» (testid del recuento: el texto no tiene otro rastro propio). */
export const countText = (page: Page): Promise<string | undefined> => textOf(page.getByTestId(REQUISITOS_TESTIDS.REQUIREMENTS_COUNT));

/** Lista del árbol («Árbol de requisitos»). */
export const treeList = (page: Page): Locator => page.getByRole('list', { name: 'Árbol de requisitos', exact: true });

/** Fila del árbol por su código (nombre accesible «REQ-001 título»). */
export const rowOf = (page: Page, code: string): Locator => page.getByRole('listitem', { name: new RegExp(`^${code} `) });

/** Códigos de las filas visibles, en orden. */
export const rowCodes = async (page: Page): Promise<readonly string[]> => {
  const items = await safe(() => treeList(page).getByRole('listitem').all(), []);
  const labels = await Promise.all(items.map((item) => safe(() => item.getAttribute('aria-label', { timeout: 2000 }), null)));
  return labels.map((label) => /^(REQ-\d{3})/.exec(label ?? '')?.[1] ?? '').filter((code) => code !== '');
};

/** Nivel ARIA de una fila visible (`aria-level`), o `NaN`. */
export const levelOfRow = async (page: Page, code: string): Promise<number> => Number(await safe(() => rowOf(page, code).getAttribute('aria-level', { timeout: 2000 }), null));

/** Botón de plegar de una fila («Contraer REQ-003» / «Expandir REQ-003»). */
export const foldButton = (page: Page, label: string): Locator => page.getByRole('button', { name: label, exact: true });

/** Botón que abre la hoja de detalle de una fila. */
export const openButton = (page: Page, code: string): Locator => page.getByRole('button', { name: `Abrir detalle de ${code}`, exact: true });

/** Hoja de detalle abierta (su id de prueba: la hoja es un diálogo con el mismo nombre que el título de la sección). */
export const sheet = (page: Page): Locator => page.getByTestId(REQUISITOS_TESTIDS.REQUIREMENT_DETAIL);

/** Campo de búsqueda de la pantalla (su id de prueba: el campo solo tiene el texto de ayuda como nombre). */
export const searchField = (page: Page): Locator => page.getByTestId(REQUISITOS_TESTIDS.REQUIREMENTS_SEARCH);

/** Pestaña de la pantalla (su id de prueba). */
export const tab = (page: Page, key: 'tree' | 'document' | 'matrix'): Locator =>
  page.getByTestId(key === 'tree' ? REQUISITOS_TESTIDS.REQUIREMENTS_TAB_TREE : key === 'document' ? REQUISITOS_TESTIDS.REQUIREMENTS_TAB_DOCUMENT : REQUISITOS_TESTIDS.REQUIREMENTS_TAB_MATRIX);

/** Línea de una fila del árbol (prioridad, pruebas, etiquetas) por su id. */
export const rowLine = async (page: Page, testId: string): Promise<string | undefined> => textOf(page.getByTestId(testId));

/** Comprobación de presencia estricta: sin elemento, no se ve; con más de uno, la lectura es ambigua y LANZA. */
export const seen = async (target: Locator, label: string): Promise<Check> => {
  const found = await target.count();
  if (found > 1) throw new Error(`lectura ambigua de ${label}: ${found} elementos`);
  const visible = found === 1 && (await target.isVisible());
  return check(visible, `ve ${label}`, visible ? `ve ${label}` : `no ve ${label}`);
};

/** Pausa de reacción local (~1 s) antes de juzgar que algo no ocurre. */
export const REACTION = (): Promise<void> => sleep(1000);

/** Una fila móvil no ejecutable: el motivo y la nota con la salvedad de plataforma (la historia dice lo que espera). */
export const notRun = (expected: string, reason: string): Outcome => ({ verdict: 'no-ejecutable', expected, observed: '(no se ejecutó)', note: `${reason} ${EXPO_NOTE}` });

export { check, type Check };
export { MOVIL_REQUIREMENTS_TESTIDS, REQUISITOS_DYNAMIC_TESTIDS, REQUISITOS_TESTIDS };
export { quotedOr } from '../web/common';
