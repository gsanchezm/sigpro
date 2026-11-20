import type { Locator, Page } from '@playwright/test';
import { MOVIL_AUDIT_TESTIDS } from '../../../../packages/shared/src/testids';
import { TENANT_A } from '../../../story-runs/support/prepare';
import { ACTION, CEILING_MS, pathOf, runSteps, safe, valueOf, waitUntil, type Step } from '../../support/browser';
import { sleep } from '../../support/checks';
import type { BrowserRowHandler } from '../../core/framework';
import { act, feedOf, rowsOf, type Blocked } from '../web/common';

// Piezas comunes de las filas de la app móvil de EP-AUDITORIA, servida como web de Expo (390 × 844). NO es iOS ni Android nativo.
// Las lecturas, los recuentos y las peticiones son los de la web (misma pantalla y mismos ids); aquí están la entrada por «Tenant de
// trabajo», la apertura de rutas con comprobación de llegada, el control «Entidad» (hoja con opciones como `radio`), la escritura de
// fechas con retardo por tecla y relectura del valor, el desplazamiento del contenedor real y la espera a que el recuento asiente.

export const EXPO_NOTE = 'El veredicto vale para Expo web (390 × 844): no se ha comprobado en iOS ni en Android nativo.';
export const LOGIN_PATH = '/login';
export const AUDIT_PATH = '/audit';
export const ADMIN_AUDIT_PATH = '/admin?tab=audit';
const TENANT_TEXT = 'Tenant de trabajo';

/** Envuelve una fila móvil para añadir la salvedad de plataforma (Expo web no es nativo). */
export const onExpoWeb =
  (handler: BrowserRowHandler): BrowserRowHandler =>
  async (row, fixtures) => {
    const result = await handler(row, fixtures);
    return { ...result, note: result.note === undefined ? EXPO_NOTE : `${result.note} ${EXPO_NOTE}` };
  };

const fixCookiePreference = (): void => {
  try {
    localStorage.setItem('sigpro.cookies', 'accepted');
  } catch {
    // sin almacenamiento no hay preferencia que fijar
  }
};

/**
 * Entra en /login con alumno01 en «Tenant de trabajo», la cuenta y su contraseña, y pulsa «Entrar». Estas cuentas no piden MFA.
 * Devuelve el motivo del fallo, o `undefined` si la app sale de /login.
 */
export const signIn = (page: Page, email: string, password: string): Promise<string | undefined> => {
  const steps: Step[] = [
    ['fijar la preferencia de cookies', () => page.context().addInitScript(fixCookiePreference)],
    ['fijar el ancho de la ventana', () => page.setViewportSize({ width: 390, height: 844 })],
    ['abrir /login', () => page.goto(LOGIN_PATH, { timeout: CEILING_MS })],
    ['ver el título «Iniciar sesión»', () => page.getByRole('heading', { name: 'Iniciar sesión', level: 1, exact: true }).waitFor({ timeout: CEILING_MS })],
    [`escribir ${TENANT_A} en «${TENANT_TEXT}»`, () => page.getByRole('textbox', { name: TENANT_TEXT, exact: true }).fill(TENANT_A, ACTION)],
    [`escribir el correo ${email}`, () => page.getByRole('textbox', { name: 'Correo electrónico', exact: true }).fill(email, ACTION)],
    ['escribir la contraseña', () => page.getByRole('textbox', { name: 'Contraseña', exact: true }).fill(password, ACTION)],
    ['pulsar «Entrar»', () => page.getByRole('button', { name: 'Entrar', exact: true }).click(ACTION)],
    ['salir de /login', () => page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: CEILING_MS })],
  ];
  return runSteps(steps);
};

/**
 * Abre una ruta de la app con la sesión ya iniciada (como las referencias móviles de las épicas anteriores, con `goto`). Comprueba
 * que la app llega y se queda en esa ruta: si vuelve a /login, la sesión no sobrevive a la carga.
 */
export const openPath = async (page: Page, path: string): Promise<string | undefined> => {
  const opened = await runSteps([[`abrir ${path}`, () => page.goto(path, { timeout: CEILING_MS })]]);
  if (opened !== undefined) return opened;
  const wanted = path.split('?')[0] ?? path;
  const arrived = await waitUntil(async () => pathOf(page) === wanted);
  return arrived.reached ? undefined : `la app no se queda en ${wanted} (está en ${pathOf(page)}): la sesión no sobrevive a la carga`;
};

// --- Localizadores propios de la pantalla móvil -----------------------------------------------------------------------------

export const fromField = (page: Page): Locator => page.getByRole('textbox', { name: 'Desde', exact: true });
export const toField = (page: Page): Locator => page.getByRole('textbox', { name: 'Hasta', exact: true });
export const searchField = (page: Page): Locator => page.getByRole('textbox', { name: 'Buscar en la auditoría', exact: true });
export const entityCombo = (page: Page): Locator => page.getByRole('combobox', { name: 'Entidad', exact: true });
export const clearFilters = (page: Page): Locator => page.getByRole('button', { name: 'Limpiar filtros', exact: true });
export const fromError = (page: Page): Locator => page.getByTestId(MOVIL_AUDIT_TESTIDS.FILTER_FROM_ERROR);
export const toError = (page: Page): Locator => page.getByTestId(MOVIL_AUDIT_TESTIDS.FILTER_TO_ERROR);
export const moreErrorBox = (page: Page): Locator => page.getByTestId(MOVIL_AUDIT_TESTIDS.MORE_ERROR);
export const loadingMoreBox = (page: Page): Locator => page.getByTestId(MOVIL_AUDIT_TESTIDS.LOADING_MORE);
export const titleHeading = (page: Page): Locator => page.getByRole('heading', { name: 'Auditoría', level: 1, exact: true });
export const adminTitle = (page: Page): Locator => page.getByText('Registro de auditoría', { exact: true });
export { feedOf, rowsOf };

/** Resultado de escribir en un campo: el valor que se releyó y, si las teclas se perdieron, la nota; o el bloqueo de la acción. */
export interface Typed {
  readonly blocked?: Blocked;
  readonly value?: string;
  readonly lost: boolean;
}

/**
 * Escribe en un campo de texto con retardo por tecla (40 ms) y relee el valor. Si lo releído no es lo escrito, las teclas se
 * perdieron: `lost` con lo leído, que la fila registra como hallazgo con evidencia (no se corrige).
 */
export const typeInto = async (target: Locator, text: string): Promise<Typed> => {
  const blocked = await act(target, `escribir «${text}»`, async (element) => {
    await element.click(ACTION);
    await element.pressSequentially(text, { delay: 40 });
  });
  if (blocked !== undefined) return { blocked, lost: false };
  const value = await valueOf(target);
  return { value, lost: value !== text };
};

/** Borra un campo de texto (para escribir otra vez en él). El resultado es el bloqueo de la acción, si lo hubo. */
export const clearField = (target: Locator): Promise<Blocked | undefined> => act(target, 'borrar el campo', (element) => element.fill('', ACTION));

/** Elige una opción de «Entidad» (la hoja con las opciones como `radio`): abre el campo y toca la opción por su nombre. */
export const pickEntity = async (page: Page, label: string): Promise<Blocked | undefined> => {
  const opened = await act(entityCombo(page), 'abrir «Entidad»', (element) => element.click(ACTION));
  if (opened !== undefined) return opened;
  return act(page.getByRole('radio', { name: label, exact: true }), `elegir «${label}»`, (element) => element.click(ACTION));
};

/** Texto visible del campo «Entidad» (su valor actual), o `undefined` si no se puede leer. */
export const entityValue = (page: Page): Promise<string | undefined> => safe(async () => (await entityCombo(page).innerText({ timeout: 1_000 })).trim(), undefined);

/**
 * Desplaza el contenedor con scroll que contiene el feed hasta su final (la pantalla de Expo web scrollea el ScrollView, no el feed).
 * Devuelve `true` si encontró el contenedor y lo desplazó; `false` si no hay contenedor desplazable (la lectura no es posible).
 */
export const scrollListToEnd = (page: Page): Promise<boolean> =>
  safe(
    () =>
      feedOf(page).evaluate(
        (feed) => {
          let node: HTMLElement | null = feed as HTMLElement;
          while (node !== null) {
            const style = getComputedStyle(node);
            if ((style.overflowY === 'auto' || style.overflowY === 'scroll') && node.scrollHeight > node.clientHeight) {
              node.scrollTop = node.scrollHeight;
              return true;
            }
            node = node.parentElement;
          }
          return false;
        },
        undefined,
        { timeout: 2_000 },
      ),
    false,
  );

/** Espera a que el recuento deje de cambiar (dos lecturas iguales separadas por 500 ms), con techo. Devuelve el último valor leído. */
export const settleCount = async (read: () => Promise<string | undefined>): Promise<string | undefined> => {
  let last = await read();
  let stable = 0;
  const started = Date.now();
  while (stable < 2 && Date.now() - started < CEILING_MS) {
    await sleep(500);
    const now = await read();
    if (now === last) stable += 1;
    else {
      stable = 0;
      last = now;
    }
  }
  return last;
};
