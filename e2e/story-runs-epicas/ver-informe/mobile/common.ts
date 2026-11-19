import type { Locator, Page } from '@playwright/test';
import { DEMO, TENANT_A } from '../../../story-runs/support/prepare';
import { MOVIL_VERIFICATION_TESTIDS, VERIFICACION_TESTIDS } from '../../../../packages/shared/src/testids';
import { ACTION, CEILING_MS, runSteps, safe, waitUntil, type Step } from '../../support/browser';
import { type Check } from '../../support/checks';
import { type BrowserRowHandler, type Outcome } from '../../core/framework';
import { isPdf } from '../api/pdf';
import { READ_MS, TOAST_KEY, WAIT_MS, armToasts, clickIn, inOrder, interact, recordToasts, type WebAction } from '../web/common';

// Piezas comunes de las filas de la app móvil de EP-VER-INFORME. La app móvil se prueba como web de Expo (390 × 844; NO es nativo):
// la entrega del PDF (iOS y Android abren la hoja de compartir) se observa en Expo web, donde la app abre el archivo en una pestaña
// nueva con `window.open`. Para leer lo que se entrega, un envoltorio de `window.open` registra la URL y los bytes del `blob:` en el
// momento de la llamada y después la deja pasar. Es un registro de la prueba, no cambia lo que hace la app.

export const EXPO_NOTE = 'El veredicto vale para Expo web (390 × 844): no se ha comprobado en iOS ni en Android nativo.';
/** Aproximación declarada de la entrega: se lee lo que la app abre (`window.open` con un `blob:`), no la hoja de compartir del sistema. */
export const DELIVERY_APPROXIMATION =
  'La entrega se aproxima en Expo web: la app abre el PDF en una pestaña nueva (Linking.openURL → window.open). Un envoltorio de window.open registra la URL y los bytes del blob; la hoja de compartir de iOS y Android no se comprueba.';
export const LOGIN_PATH = '/login';
export const TENANT_TEXT = 'Tenant de trabajo';
const DELIVERY_KEY = '__sigproDeliveries';
const REASON_TESTID = MOVIL_VERIFICATION_TESTIDS.REPORT_REASON;

/** Abrir una dirección de la app (/verification, /verification/TC-019) se aproxima con una carga completa de la página en Expo web. */
export const DIRECT_APPROXIMATION =
  'Abrir una dirección de la app se aproxima con una carga completa de la página en Expo web, que recupera la sesión guardada; en iOS o Android sería un enlace profundo.';

/** Añade a cada resultado de la fila la salvedad de plataforma y las aproximaciones de la entrega y de las direcciones. */
export const onExpoWeb =
  (handler: BrowserRowHandler): BrowserRowHandler =>
  async (row, fixtures) => {
    const result: Outcome = await handler(row, fixtures);
    const note = [result.note, EXPO_NOTE, DELIVERY_APPROXIMATION, DIRECT_APPROXIMATION].filter((part): part is string => part !== undefined && part !== '').join(' ');
    return { ...result, note };
  };

/** Se ejecuta en el navegador antes de cargar la app: registra cada `window.open` con un `blob:` y sus bytes. No usa variables de fuera. */
export const recordDeliveries = (key: string): void => {
  const registry = window as unknown as Record<string, unknown>;
  if (Array.isArray(registry[key])) return;
  const log: { url: string; at: number; base64?: string; error?: string }[] = [];
  registry[key] = log;
  const open = window.open.bind(window);
  window.open = (url?: string | URL, target?: string, features?: string) => {
    const address = String(url ?? '');
    const entry: { url: string; at: number; base64?: string; error?: string } = { url: address, at: Date.now() };
    log.push(entry);
    if (address.startsWith('blob:')) {
      fetch(address)
        .then((response) => response.arrayBuffer())
        .then((buffer) => {
          let binary = '';
          for (const byte of new Uint8Array(buffer)) binary += String.fromCharCode(byte);
          entry.base64 = btoa(binary);
        })
        .catch((error: unknown) => {
          entry.error = String(error);
        });
    }
    return open(url, target, features);
  };
};

/** Una entrega registrada: la URL que abrió la app, los bytes en base64 (cuando se leen) o el error de leerlos. */
export interface Delivery {
  readonly url: string;
  readonly base64?: string;
  readonly error?: string;
}

/** Entregas registradas desde la última armada, en orden. */
export const deliveriesOf = (page: Page): Promise<readonly Delivery[]> =>
  safe(() => page.evaluate((key: string) => (((window as unknown as Record<string, unknown>)[key] as Delivery[] | undefined) ?? []), DELIVERY_KEY), []);

/** Vacía el registro de entregas justo antes de la acción que se prueba. */
export const armDeliveries = (page: Page): Promise<void> =>
  safe(
    () =>
      page.evaluate((key: string) => {
        const log = (window as unknown as Record<string, unknown>)[key];
        if (Array.isArray(log)) log.length = 0;
      }, DELIVERY_KEY),
    undefined,
  );

/** Espera (con techo de red) a la primera entrega y a que se lean sus bytes. Devuelve la entrega, o `undefined` si no hay. */
export const firstDelivery = async (page: Page): Promise<Delivery | undefined> => {
  await waitUntil(async () => {
    const log = await deliveriesOf(page);
    const first = log[0];
    return first !== undefined && (first.base64 !== undefined || first.error !== undefined);
  }, WAIT_MS);
  return (await deliveriesOf(page))[0];
};

/** Bytes de una entrega como texto PDF (latin1, sin decodificar UTF-8). `undefined` si no hay bytes legibles. */
export const bytesOf = (delivery: Delivery | undefined): Buffer | undefined => (delivery?.base64 === undefined ? undefined : Buffer.from(delivery.base64, 'base64'));

/** Un PDF entregado: sus bytes empiezan por la cabecera `%PDF-`. */
export const isDeliveredPdf = (delivery: Delivery | undefined): boolean => {
  const bytes = bytesOf(delivery);
  return bytes !== undefined && isPdf(bytes);
};

// --- Sesión y navegación ---------------------------------------------------------------------------------------------------------

/** Preparación de cada fila: la app en /login con alumno01 en «Tenant de trabajo», gestor@sigpro.test y «Entrar». Termina en /programs. */
export const signIn = (page: Page): Promise<string | undefined> => {
  const steps: Step[] = [
    ['instalar el registro de avisos', () => page.context().addInitScript(recordToasts, TOAST_KEY)],
    ['instalar el registro de entregas', () => page.context().addInitScript(recordDeliveries, DELIVERY_KEY)],
    ['fijar el ancho de la ventana', () => page.setViewportSize({ width: 390, height: 844 })],
    ['abrir /login', () => page.goto(LOGIN_PATH, { timeout: CEILING_MS })],
    ['ver el título «Iniciar sesión»', () => page.getByRole('heading', { name: 'Iniciar sesión', level: 1, exact: true }).waitFor({ timeout: CEILING_MS })],
    [`escribir alumno01 en «${TENANT_TEXT}»`, () => page.getByRole('textbox', { name: TENANT_TEXT, exact: true }).fill(TENANT_A, ACTION)],
    ['escribir el correo', () => page.getByRole('textbox', { name: 'Correo electrónico', exact: true }).fill(DEMO.gestor.email, ACTION)],
    ['escribir la contraseña', () => page.getByRole('textbox', { name: 'Contraseña', exact: true }).fill(DEMO.gestor.password, ACTION)],
    ['pulsar «Entrar»', () => page.getByRole('button', { name: 'Entrar', exact: true }).click(ACTION)],
    ['llegar a /programs', () => page.waitForURL(/\/programs/, { timeout: CEILING_MS })],
    ['ver la pantalla de Programas', () => page.getByRole('heading', { name: 'Programas', level: 1, exact: true }).waitFor({ timeout: CEILING_MS })],
  ];
  return runSteps(steps);
};

/** Abre una ruta de la app con la sesión ya iniciada y espera a la lista o al detalle. */
export const openRoute = (page: Page, path: string, ready: 'list' | 'detail'): Promise<string | undefined> =>
  runSteps([
    [`abrir ${path}`, () => page.goto(path, { timeout: CEILING_MS })],
    [
      ready === 'list' ? 'ver la lista de casos' : 'ver el detalle del caso',
      async () => {
        const shown = ready === 'list' ? await waitUntil(async () => COUNT_PATTERN.test((await countText(page)) ?? ''), WAIT_MS) : await waitUntil(async () => (await safe(() => caseDetail(page).isVisible(), false)) === true, WAIT_MS);
        if (!shown.reached) throw new Error(ready === 'list' ? 'la lista de casos no aparece' : 'el detalle del caso no aparece');
      },
    ],
  ]);

/** Contador de la lista con el mismo formato que la web: «a–b de n» (con guion largo). */
const COUNT_PATTERN = /^\d+–\d+ de \d+$/;
export const countText = (page: Page): Promise<string | undefined> => safe(async () => ((await page.getByTestId(VERIFICACION_TESTIDS.VERIFICATION_COUNT).innerText({ timeout: READ_MS })).trim()), undefined);

// --- Localizadores -----------------------------------------------------------------------------------------------------------------

export const listRoot = (page: Page): Locator => page.getByTestId(VERIFICACION_TESTIDS.VERIFICATION_PAGE);
export const reportButton = (page: Page): Locator => listRoot(page).getByRole('button', { name: 'Descargar informe PDF', exact: true }).or(listRoot(page).getByTestId(VERIFICACION_TESTIDS.VERIFICATION_REPORT));
export const programSelect = (page: Page): Locator => page.getByRole('combobox', { name: 'Programa', exact: true });
export const programOption = (page: Page, code: string): Locator => page.getByRole('dialog', { name: 'Programa', exact: true }).getByRole('radio', { name: code, exact: true });
export const selectToggle = (page: Page): Locator => page.getByRole('button', { name: 'Seleccionar', exact: true });
export const cardCheckbox = (page: Page, code: string): Locator => page.getByRole('checkbox', { name: `Seleccionar ${code}`, exact: true });
export const selectAllButton = (page: Page): Locator => page.getByRole('button', { name: 'Seleccionar todos los casos de la página', exact: true });
export const bulkReportButton = (page: Page): Locator =>
  page.getByRole('toolbar', { name: 'Acciones masivas', exact: true }).getByRole('button', { name: 'Informe de la selección', exact: true }).or(page.getByTestId(VERIFICACION_TESTIDS.VERIFICATION_BULK_REPORT));
export const cardMenuButton = (page: Page, code: string): Locator => page.getByRole('button', { name: `Acciones para ${code}`, exact: true });
export const sheetOf = (page: Page, code: string): Locator => page.getByRole('dialog', { name: `Acciones para ${code}`, exact: true });
export const sheetReportItem = (page: Page, code: string): Locator => sheetOf(page, code).getByRole('button', { name: 'Informe PDF', exact: true });
export const caseDetail = (page: Page): Locator => page.getByTestId(VERIFICACION_TESTIDS.TESTCASE_DETAIL);
export const caseReportButton = (page: Page): Locator =>
  caseDetail(page).getByRole('button', { name: 'Descargar informe PDF', exact: true }).or(caseDetail(page).getByTestId(VERIFICACION_TESTIDS.TESTCASE_REPORT));
export const emptyBlock = (page: Page): Locator => page.getByTestId(VERIFICACION_TESTIDS.VERIFICATION_EMPTY);

/** Lectura de un botón deshabilitado en móvil en UNA sola evaluación: `aria-disabled`/`disabled`, `data-reason` y el texto visible del motivo. */
export interface MobileReason {
  readonly disabled: boolean;
  /** Texto del elemento del motivo, solo si se ve de verdad (ni él ni sus ancestros ocultos). */
  readonly visibleReason: string | undefined;
  /** Motivo que el botón lleva en `data-reason` (el texto visible no siempre lo repite). */
  readonly dataReason: string | undefined;
}

export const reportState = (page: Page): Promise<MobileReason | undefined> =>
  safe(
    () =>
      reportButton(page).first().evaluate(
        (button, reasonTestId: string) => {
          const reason = document.querySelector(`[data-testid="${reasonTestId}"]`);
          const visible = (node: Element | null): boolean => {
            let current: Element | null = node;
            while (current !== null) {
              const style = getComputedStyle(current);
              if (current.hasAttribute('hidden') || style.display === 'none' || style.visibility === 'hidden') return false;
              current = current.parentElement;
            }
            return node !== null;
          };
          const control = button as HTMLElement & { disabled?: boolean };
          return {
            disabled: control.disabled === true || button.getAttribute('aria-disabled') === 'true',
            visibleReason: reason !== null && visible(reason) ? (reason as HTMLElement).innerText.trim() : undefined,
            dataReason: button.getAttribute('data-reason') ?? undefined,
          };
        },
        REASON_TESTID,
        { timeout: READ_MS },
      ),
    undefined,
  );

// --- Acciones con diagnóstico -----------------------------------------------------------------------------------------------------

/** Elige un programa en el desplegable «Programa» (la hoja de opciones se abre y se cierra sola al elegir). */
export const chooseProgram = (option: string): WebAction =>
  inOrder(clickIn(programSelect, 'abrir el desplegable «Programa»'), (page) => interact(programOption(page, option), `elegir «${option}» en «Programa»`, (element) => element.click(ACTION)));

/** Pulsa «Seleccionar» (el modo de selección de la lista). */
export const toggleSelect: WebAction = clickIn(selectToggle, 'pulsar «Seleccionar»');

/** Marca una casilla de tarjeta (en modo de selección). */
export const markCard = (code: string): WebAction => clickIn((page) => cardCheckbox(page, code), `marcar «Seleccionar ${code}»`);

/** Abre el menú ⋯ de una tarjeta y pulsa su «Informe PDF» dentro de la hoja «Acciones para …». */
export const cardReport = (code: string): WebAction =>
  inOrder(clickIn((page) => cardMenuButton(page, code), `abrir «Acciones para ${code}»`), clickIn((page) => sheetReportItem(page, code), 'pulsar «Informe PDF»'));

// --- Comprobaciones de la entrega y los avisos ------------------------------------------------------------------------------------

/** Arma los registros de avisos y de entregas justo antes de la acción que se prueba. */
export const armAll = async (page: Page): Promise<void> => {
  await armToasts(page);
  await armDeliveries(page);
};

/** Comprobación de la entrega: un PDF abierto como blob, en una pestaña nueva. */
export const deliveredCheck = (delivery: Delivery | undefined): Check => {
  if (delivery === undefined) return { ok: false, expected: 'se entrega el informe (un PDF abierto en una pestaña nueva)', observed: 'no se abrió ninguna pestaña con el informe' };
  const bytes = bytesOf(delivery);
  const kind = delivery.url.startsWith('blob:') ? 'blob:' : 'otra dirección';
  const pdf = bytes !== undefined && isPdf(bytes);
  return {
    ok: kind === 'blob:' && pdf,
    expected: 'se entrega el informe (un PDF abierto en una pestaña nueva)',
    observed: `se abre una pestaña con ${kind}, ${bytes === undefined ? 'sin bytes legibles' : `${bytes.length} bytes, ${pdf ? 'PDF' : 'no es PDF'}`}${delivery.error === undefined ? '' : ` (error al leer: ${delivery.error})`}`,
  };
};

/** Ningún archivo entregado en la ventana de observación. */
export const notDelivered = async (page: Page): Promise<Check> => {
  const count = (await deliveriesOf(page)).length;
  return { ok: count === 0, expected: 'no se entrega ningún informe', observed: count === 0 ? 'no se entrega ningún informe' : `se abren ${count} pestaña(s) con un informe` };
};

