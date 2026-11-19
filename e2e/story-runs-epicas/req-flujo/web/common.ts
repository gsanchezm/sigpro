import type { Locator, Page } from '@playwright/test';
import { ACCESO_DYNAMIC_TESTIDS, REQUISITOS_DYNAMIC_TESTIDS, REQUISITOS_TESTIDS } from '../../../../packages/shared/src/testids';
import { DEMO, TENANT_A, resetTenants, type Credentials } from '../../../story-runs/support/prepare';
import { ACTION, CEILING_MS, isVisible, runSteps, safe, waitUntil, type Step } from '../../support/browser';
import { check, preparationFailedWeb, sleep, type Check } from '../../support/checks';
import { outcome, type Outcome } from '../../core/framework';
import { adminToken, readRequirement, stateOf } from '../api/common';

// Piezas comunes de las filas web de EP-REQ-FLUJO (escritorio a 1440 px). Los localizadores son de rol y de nombre accesible dentro de la
// sección del flujo o del diálogo; los ids de prueba solo donde la pantalla no ofrece otro rastro (el detalle, el estado, las filas, el
// diálogo). Cada acción va en `runSteps` (si falla, la fila dice qué paso falló); cada lectura tiene plazo corto y su ausencia se distingue
// de la lectura fallida (`undefined`). Las esperas a la interfaz van con `waitUntil`.

/** Nota común de cada fila web: la preferencia de cookies se fija antes de abrir la app (como en el piloto). */
export const COOKIE_NOTE = 'La prueba fija la preferencia de cookies (sigpro.cookies = accepted) antes de abrir la app, como el piloto; el aviso de cookies no se ejerce aquí.';

export const LOGIN_URL = `/login?tenant=${TENANT_A}`;
/** Ventana de observación para afirmar que un aviso NO aparece: mayor que sus 3 s de vida (TOAST_MS). */
export const QUIET_MS = 4_000;
/** Tolerancia de la prueba para el cierre del aviso (la historia fija 3 s; se añade 1 s de reacción). */
export const TOAST_TOLERANCE_MS = 1_000;

/** Estado del requisito → texto de la interfaz. */
export const STATE_LABEL: ReadonlyMap<string, string> = new Map<string, string>([
  ['draft', 'Borrador'],
  ['approved', 'Aprobado'],
  ['verified', 'Verificado'],
  ['validated', 'Validado'],
]);

/** Estados del flujo en su orden (Redacción, Aprobación, Verificación, Validación). */
export const FLOW_STATES: readonly string[] = ['draft', 'approved', 'verified', 'validated'];

/** Texto de un estado en las celdas («Borrador» → draft). Cualquier otro texto LANZA con `strict`. */
export const STATE_CELLS: ReadonlyMap<string, string> = new Map<string, string>([
  ['Borrador', 'draft'],
  ['Aprobado', 'approved'],
  ['Verificado', 'verified'],
  ['Validado', 'validated'],
]);

/** Cuentas de las celdas «cuenta». alumno01 es la cuenta de administración del tenant (sin segundo factor). */
export const ACCOUNT_CELLS: ReadonlyMap<string, Credentials> = new Map<string, Credentials>([
  ['gestor@sigpro.test', DEMO.gestor],
  ['consultor@sigpro.test', DEMO.consultor],
  ['auditor@sigpro.test', DEMO.auditor],
  ['alumno01@sigpro.lab', { email: 'alumno01@sigpro.lab', password: 'Alumno1234!' }],
]);

/** Nombres de los botones de transición tal como los escribe la historia («Aprobar», «Validar»…). */
export const BUTTON_CELLS: ReadonlyMap<string, string> = new Map<string, string>([
  ['«Aprobar»', 'Aprobar'],
  ['«Marcar como verificado»', 'Marcar como verificado'],
  ['«Validar»', 'Validar'],
  ['«Volver a borrador»', 'Volver a borrador'],
]);

/** Estado al que lleva cada botón de transición (el que aparece en el atributo `data-testid`). */
export const TARGET_OF_BUTTON: ReadonlyMap<string, string> = new Map<string, string>([
  ['Aprobar', 'approved'],
  ['Marcar como verificado', 'verified'],
  ['Validar', 'validated'],
  ['Volver a borrador', 'draft'],
]);

/** Texto normalizado: los espacios tipográficos (U+00A0, U+202F) cuentan como espacio; nada más se toca. */
export const norm = (text: string | undefined): string | undefined => text?.replace(/[\u00A0\u202F]/g, ' ').trim();

// --- Registro de avisos (instalado antes de la app; se arma justo antes de la acción) -----------------------------------------------------

export const TOAST_KEY = '__sigproToasts';

/** Se ejecuta en el navegador antes de cargar la app: registra cada aparición de un aviso, con su tono, título, cuerpo e instante. */
export const recordToasts = (key: string): void => {
  const registry = window as unknown as Record<string, unknown>;
  if (Array.isArray(registry[key])) return;
  const log: { tone: string; title: string; body: string; at: number }[] = [];
  registry[key] = log;
  const toneOf = (element: Element): string | undefined => /^toast-(ok|danger|info|warn)$/.exec(element.getAttribute('data-testid') ?? '')?.[1];
  const record = (element: Element, tone: string): void => {
    const lines = (element as HTMLElement).innerText
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line !== '' && line !== '×');
    log.push({ tone, title: lines[0] ?? '', body: lines[1] ?? '', at: Date.now() });
  };
  const scan = (node: Node): void => {
    if (!(node instanceof Element)) return;
    const own = toneOf(node);
    if (own !== undefined) record(node, own);
    node.querySelectorAll('[data-testid^="toast-"]').forEach((element) => {
      const tone = toneOf(element);
      if (tone !== undefined) record(element, tone);
    });
  };
  new MutationObserver((mutations) => mutations.forEach((mutation) => mutation.addedNodes.forEach(scan))).observe(document, { childList: true, subtree: true });
};

export interface ToastEntry {
  readonly tone: string;
  readonly title: string;
  readonly body: string;
  readonly at: number;
}

/** Avisos registrados desde la última «armada». */
export const toastLog = (page: Page): Promise<readonly ToastEntry[]> =>
  safe(() => page.evaluate((key: string) => ((window as unknown as Record<string, unknown>)[key] as ToastEntry[] | undefined) ?? [], TOAST_KEY), []);

/** Vacía el registro justo antes de la acción que se prueba. */
export const armToasts = (page: Page): Promise<void> =>
  safe(
    () =>
      page.evaluate((key: string) => {
        const log = (window as unknown as Record<string, unknown>)[key];
        if (Array.isArray(log)) log.length = 0;
      }, TOAST_KEY),
    undefined,
  );

/** Lo que hay en el registro, en una frase («ningún aviso» si está vacío). */
export const describeToasts = (log: readonly ToastEntry[]): string =>
  log.length === 0 ? 'ningún aviso' : log.map((entry) => `${entry.tone} «${entry.title}» / «${entry.body}»`).join(' | ');

/** ¿Hay un aviso de éxito con ese título y cuerpo? Espera con techo; devuelve lo que se registró. */
export const waitOkToast = async (page: Page, title: string, body: string): Promise<{ readonly found: boolean; readonly observed: string; readonly at?: number }> => {
  const matches = (entries: readonly ToastEntry[]): ToastEntry | undefined => entries.find((entry) => entry.tone === 'ok' && entry.title === title && entry.body === body);
  const waited = await waitUntil(async () => matches(await toastLog(page)) !== undefined);
  const log = await toastLog(page);
  const hit = matches(log);
  return { found: waited.reached, observed: describeToasts(log), ...(hit === undefined ? {} : { at: hit.at }) };
};

/** Tras aparecer, el aviso debe cerrarse solo (3 s de vida): se mide hasta que desaparece el elemento. `undefined` si no se cierra. */
export const toastLifeMs = async (page: Page, appearedAt: number): Promise<number | undefined> => {
  const closed = await waitUntil(async () => (await safe(() => page.getByTestId(ACCESO_DYNAMIC_TESTIDS.TOAST('ok')).count(), 1)) === 0, 6_000);
  return closed.reached ? Date.now() - appearedAt : undefined;
};

// --- Preparación, inicio de sesión y apertura del detalle --------------------------------------------------------------------------------

const fixCookiePreference = (): void => {
  try {
    localStorage.setItem('sigpro.cookies', 'accepted');
  } catch {
    // sin almacenamiento: no hay preferencia que fijar
  }
};

/** Reinicio de alumno01 (con su administrador) y acceso desde /login?tenant=alumno01 en un contexto sin sesión; termina en /programs. */
export const prepareWeb = async (page: Page, credentials: Credentials): Promise<string | undefined> => {
  await resetTenants([TENANT_A]);
  const steps: Step[] = [
    ['fijar la preferencia de cookies', () => page.context().addInitScript(fixCookiePreference)],
    ['instalar el registro de avisos', () => page.context().addInitScript(recordToasts, TOAST_KEY)],
    ['fijar la ventana de escritorio (1440 px)', () => page.setViewportSize({ width: 1440, height: 900 })],
    ['abrir /login?tenant=alumno01', () => page.goto(LOGIN_URL, { timeout: CEILING_MS })],
    ['escribir el correo', () => page.getByLabel('Correo electrónico', { exact: true }).fill(credentials.email, ACTION)],
    ['escribir la contraseña', () => page.getByLabel('Contraseña', { exact: true }).fill(credentials.password, ACTION)],
    ['pulsar «Entrar»', () => page.getByRole('button', { name: 'Entrar', exact: true }).click(ACTION)],
    ['llegar a /programs', () => page.waitForURL(/\/programs/, { timeout: CEILING_MS })],
  ];
  return runSteps(steps);
};

/** La lista de requisitos ya no carga: un recuento real («N de M requisitos»), o un estado de error o de no encontrado. */
const settled = async (page: Page): Promise<boolean> =>
  (
    await waitUntil(async () => {
      const count = norm(await textOf(page.getByTestId(REQUISITOS_TESTIDS.REQUIREMENTS_COUNT)));
      return /^\d+ de \d+ requisitos$/.test(count ?? '') || (await isVisible(page.getByTestId(REQUISITOS_TESTIDS.REQUIREMENTS_ERROR))) || (await isVisible(page.getByTestId(REQUISITOS_TESTIDS.REQUIREMENTS_NOT_FOUND)));
    })
  ).reached;

/** Abre /programs/<programa>/requirements y el detalle del requisito desde su título en el árbol. Devuelve el motivo si no se consigue. */
export const openDetail = (page: Page, programCode: string, code: string): Promise<string | undefined> =>
  runSteps([
    [`abrir /programs/${programCode}/requirements`, () => page.goto(`/programs/${programCode}/requirements`, { timeout: CEILING_MS })],
    [
      'ver el árbol de requisitos',
      async () => {
        if (!(await settled(page))) throw new Error('la pantalla de requisitos no se asienta');
      },
    ],
    [`pulsar el título de ${code} en el árbol`, () => page.getByTestId(REQUISITOS_DYNAMIC_TESTIDS.REQUIREMENT_OPEN(code)).click(ACTION)],
    [
      `ver el detalle de ${code}`,
      async () => {
        if (!(await waitUntil(() => isVisible(detailOf(page)))).reached) throw new Error('el panel de detalle no aparece');
      },
    ],
  ]);

// --- Lecturas (localizadores de la pantalla) ---------------------------------------------------------------------------------------------

/** Texto visible de un elemento (o `undefined` si no se puede leer en el plazo). */
export const textOf = (target: Locator): Promise<string | undefined> => safe(async () => (await target.first().innerText({ timeout: 2000 })).trim(), undefined);

/** Atributo de un elemento (`null` o ausente → `undefined`; lectura fallida → `undefined`). */
export const attrOf = (target: Locator, name: string): Promise<string | undefined> =>
  safe(async () => (await target.first().getAttribute(name, { timeout: 2000 })) ?? undefined, undefined);

/** Deshabilitado por propiedad (`disabled`); `undefined` si no se puede leer. */
export const disabledOf = (target: Locator): Promise<boolean | undefined> => safe(() => target.first().isDisabled({ timeout: 2000 }), undefined);

/** Textos de una lista de elementos (`undefined` si la lectura falla; `[]` solo si no hay ninguno). */
export const textsOf = async (target: Locator): Promise<readonly string[] | undefined> => {
  try {
    return (await target.allInnerTexts()).map((text) => norm(text) ?? '');
  } catch {
    return undefined;
  }
};

/** La hoja de detalle (panel de escritorio). */
export const detailOf = (page: Page): Locator => page.getByTestId(REQUISITOS_TESTIDS.REQUIREMENT_DETAIL);

/** Estado mostrado por el detalle abierto: texto visible y `data-state` del badge del detalle. */
export const detailState = async (page: Page): Promise<{ readonly label: string | undefined; readonly state: string | undefined }> => ({
  label: norm(await textOf(detailOf(page).getByTestId(REQUISITOS_TESTIDS.REQUIREMENT_STATE_BADGE))),
  state: await attrOf(detailOf(page).getByTestId(REQUISITOS_TESTIDS.REQUIREMENT_STATE_BADGE), 'data-state'),
});

/** Estado mostrado por la fila del requisito en el árbol (texto visible del badge de la fila). */
export const rowLabel = async (page: Page, code: string): Promise<string | undefined> =>
  norm(await textOf(page.getByTestId(REQUISITOS_DYNAMIC_TESTIDS.REQUIREMENT_ROW(code)).getByTestId(REQUISITOS_TESTIDS.REQUIREMENT_STATE_BADGE)));

/** Sección del flujo de aprobación del detalle. */
export const flowOf = (page: Page): Locator => page.getByTestId(REQUISITOS_TESTIDS.REQUIREMENT_FLOW);
/** Paso del flujo por su estado. */
export const stepOf = (page: Page, state: string): Locator => page.getByTestId(REQUISITOS_DYNAMIC_TESTIDS.REQUIREMENT_FLOW_STEP(state));

/** Un paso del flujo leído: estado de la línea (`data-status`), texto del indicador (✓ o número) y botones de transición. */
export interface StepRead {
  readonly state: string;
  readonly status: string | undefined;
  readonly dot: string | undefined;
  readonly buttons: readonly string[] | undefined;
}

export const readFlow = (page: Page): Promise<readonly StepRead[]> =>
  Promise.all(
    FLOW_STATES.map(async (state): Promise<StepRead> => {
      const step = stepOf(page, state);
      return {
        state,
        status: await attrOf(step, 'data-status'),
        dot: norm(await textOf(step.locator('[aria-hidden="true"]').first())),
        buttons: await textsOf(step.getByRole('button')),
      };
    }),
  );

/** El diálogo de cambio de estado (`role="dialog"`). */
export const dialogOf = (page: Page): Locator => page.getByTestId(REQUISITOS_TESTIDS.REQUIREMENT_TRANSITION_DIALOG);

/** Botón de transición del paso actual por su nombre exacto (dentro de la sección del flujo). */
export const transitionButton = (page: Page, name: string): Locator => flowOf(page).getByRole('button', { name, exact: true });

/** Botones «Cancelar» y «Confirmar» dentro del diálogo (recuento; -1 si no se puede leer). */
export const dialogActions = async (page: Page): Promise<{ readonly cancel: number; readonly confirm: number }> => ({
  cancel: await safe(() => dialogOf(page).getByRole('button', { name: 'Cancelar', exact: true }).count(), -1),
  confirm: await safe(() => dialogOf(page).getByRole('button', { name: 'Confirmar', exact: true }).count(), -1),
});

/** Abre el diálogo pulsando el botón del paso actual; `failure` si el clic no se pudo hacer, y `shown` si el diálogo aparece. */
export const openDialog = async (page: Page, buttonName: string): Promise<{ readonly failure?: string; readonly shown: boolean }> => {
  const failure = await press(transitionButton(page, buttonName), `pulsar ${buttonName} en el paso actual`);
  if (failure !== undefined) return { failure, shown: false };
  return { shown: (await waitUntil(() => isVisible(dialogOf(page)))).reached };
};

// --- Acciones y estado del servidor ----------------------------------------------------------------------------------------------------

/**
 * Pulsa un elemento y devuelve el diagnóstico si el clic no se completa: qué dice el error de Playwright, si el elemento no existe, si otro lo
 * tapa o si recibe el clic en su centro pero la acción no ocurre. Así la nota de la fila dice en qué falló la acción.
 */
export const press = async (locator: Locator, label: string): Promise<string | undefined> => {
  try {
    await locator.click(ACTION);
    return undefined;
  } catch (error) {
    return describeClickFailure(locator, label, error);
  }
};

const describeClickFailure = async (locator: Locator, label: string, error: unknown): Promise<string> => {
  const lines = (error instanceof Error ? error.message : String(error))
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '');
  const intercept = lines.find((line) => line.includes('intercepts pointer events'));
  const head = `no se pudo ${label}: ${lines.slice(0, 3).join(' · ')}${intercept === undefined ? '' : ` · ${intercept}`}`;
  const present = (await safe(() => locator.count(), 0)) > 0;
  if (!present) return `${head} · el elemento no existe en la pantalla`;
  const probe = await safe<string | undefined>(
    () =>
      locator.first().evaluate(
        (node: Element) => {
          const box = node.getBoundingClientRect();
          const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
          if (hit === null) return 'nadie recibe el clic en su centro';
          if (hit === node || node.contains(hit)) return 'el elemento recibe el clic en su centro, pero la acción no se completa';
          const testid = hit.getAttribute('data-testid');
          return `otro elemento lo tapa: ${hit.tagName.toLowerCase()}${testid === null ? '' : `[data-testid="${testid}"]`}`;
        },
        undefined,
        { timeout: 2000 },
      ),
    undefined,
  );
  return `${head} · ${probe ?? '(no se pudo comprobar quién recibe el clic)'}`;
};

/** Estado del requisito según la API (lectura con el administrador de alumno01). */
export const serverStateOf = async (code: string): Promise<string | undefined> => stateOf(await readRequirement(TENANT_A, await adminToken(TENANT_A), code));

/** Espera (con techo) a que el detalle muestre ese estado. */
export const waitDetailState = async (page: Page, label: string): Promise<boolean> => (await waitUntil(async () => (await detailState(page)).label === label)).reached;

// --- Comprobaciones y veredicto -----------------------------------------------------------------------------------------------------------

/** Un valor observado frente a lo que la historia espera, en una frase cada uno. */
export const eqCheck = (label: string, actual: string | undefined, expected: string): Check =>
  check(actual === expected, `${label} «${expected}»`, `${label} «${actual ?? '(no legible)'}»`);

/** Veredicto de la fila: coincide si todas las comprobaciones se cumplen; la nota dice en qué difiere (de lo medido). */
export const verdictWeb = (checks: readonly Check[], extraNote: string = COOKIE_NOTE): Outcome => {
  const failed = checks.filter((entry) => !entry.ok).map((entry) => entry.observed);
  const note = failed.length === 0 ? extraNote : `difiere en: ${failed.join('; ')}. ${extraNote}`;
  return outcome(
    checks.every((entry) => entry.ok),
    checks.map((entry) => entry.expected).join('; '),
    checks.map((entry) => entry.observed).join('; '),
    { note },
  );
};

/** Una preparación de la pantalla que no se cumple (la historia da por hecho un estado que la app no muestra). */
export const webPrepFailed = (expected: string, reason: string): Outcome => preparationFailedWeb(expected, reason);

/** Espera (sin juzgar) el tiempo de reacción local de la pantalla antes de afirmar que algo NO ocurre. */
export const quietWindow = (): Promise<void> => sleep(QUIET_MS);
