import type { Locator, Page } from '@playwright/test';
import { ADMIN_TESTIDS, LAB_TESTIDS } from '../../../../packages/shared/src/testids';
import { TENANT_A, type Credentials } from '../../../story-runs/support/prepare';
import { ACTION, CEILING_MS, attrOf, isVisible, runSteps, safe, textOf, waitUntil } from '../../support/browser';
import { check, sleep, type Check } from '../../support/checks';
import { notExecutable, outcome, type BrowserRowHandler, type Outcome } from '../../core/framework';
import { restoreTenants, withDifference } from '../api/common';

// Piezas comunes de las filas WEB de EP-CAOS-RESET (escritorio 1440 × 900). Los localizadores son de rol y de nombre; los ids de
// prueba solo donde la pantalla no ofrece otro rastro. Los avisos se leen de un REGISTRO instalado ANTES de la acción (`recordToasts`):
// un registro ausente o no legible NUNCA cuenta como «ningún aviso». Toda acción pasa por `interact`, que clasifica el fallo: si el
// elemento no existe, la app no lo ofrece (discrepa); si hay error de localizador o de clic, la fila no es ejecutable (con el error).

export const WEB_VIEWPORT = { width: 1440, height: 900 } as const;
export const LOGIN_URL = `/login?tenant=${TENANT_A}`;
export const COOKIE_NOTE = 'La prueba fija la preferencia de cookies (sigpro.cookies = accepted) antes de abrir la app, como el piloto; el aviso de cookies no se ejerce aquí.';

/** Añade la nota de cookies (preferencia fijada por la prueba, no una sesión) al resultado de cada fila web. */
export const onWeb = (handler: BrowserRowHandler, tenants: readonly string[] = [TENANT_A]): BrowserRowHandler =>
  restoringAfter(tenants, async (row, fixtures) => {
    const result = await handler(row, fixtures);
    return { ...result, note: result.note === undefined ? COOKIE_NOTE : `${result.note} ${COOKIE_NOTE}` };
  });

/**
 * Deja cada tenant de la fila como lo pide la historia al terminar, pase lo que pase (también si la fila lanza): reinicio y caos
 * apagado. Si la limpieza falla, LANZA: el marco la registra como error de prueba (no es un hallazgo sobre la app).
 */
export const restoringAfter =
  (tenants: readonly string[], handler: BrowserRowHandler): BrowserRowHandler =>
  async (row, fixtures) => {
    let result: Outcome;
    try {
      result = await handler(row, fixtures);
    } catch (error) {
      await restoreTenants(tenants).catch(() => undefined);
      throw error;
    }
    await restoreTenants(tenants);
    return result;
  };

/** Fija SOLO la preferencia de cookies: el aviso tapa zonas de la página y no es una sesión. */
const fixCookiePreference = (): void => {
  try {
    localStorage.setItem('sigpro.cookies', 'accepted');
  } catch {
    // sin almacenamiento: no hay preferencia que fijar
  }
};

// --- Registro de avisos instalado antes de la acción -------------------------------------------------------------------------------

/** Clave del registro de avisos en la ventana del navegador. */
export const TOAST_KEY = '__sigproToasts';
/** Ventana que se observa tras una acción para afirmar que NO aparece un aviso de éxito: mayor que la vida del aviso (3 s). */
export const QUIET_WINDOW_MS = 4_000;

/** Un aviso registrado: tono, título (primera línea), cuerpo (segunda) y marca de tiempo del navegador. */
export interface ToastEntry {
  readonly tone: string;
  readonly title: string;
  readonly body: string;
  readonly at: number;
}

export type ToneName = 'ok' | 'danger' | 'info' | 'warn';

/** Se ejecuta en el navegador antes de cargar la app: registra cada aparición de un aviso, sin la cruz de cierre. No usa variables de fuera. */
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

/** Instala en el contexto la preferencia de cookies y el registro de avisos, y fija la ventana de escritorio. Antes de cualquier `goto`. */
export const prepareBrowser = async (page: Page): Promise<void> => {
  await page.context().addInitScript(fixCookiePreference);
  await page.context().addInitScript(recordToasts, TOAST_KEY);
  await page.setViewportSize(WEB_VIEWPORT);
};

/**
 * Registro de avisos de la página desde la última «armada». `undefined` = NO LEGIBLE (el registro no existe en la página o la lectura
 * falla): nunca equivale a «ningún aviso».
 */
export const toastLog = async (page: Page): Promise<readonly ToastEntry[] | undefined> => {
  const raw = await safe<ToastEntry[] | null | undefined>(
    () =>
      page.evaluate((key: string) => {
        const value = (window as unknown as Record<string, unknown>)[key];
        return Array.isArray(value) ? (value as { tone: string; title: string; body: string; at: number }[]) : null;
      }, TOAST_KEY),
    undefined,
  );
  return raw === null || raw === undefined ? undefined : raw;
};

/**
 * Vacía el registro justo antes de la acción que se va a observar. Devuelve `true` si el registro existe (control positivo de que está
 * armado); `false` si no existe y las lecturas posteriores darán «no legible».
 */
export const armToasts = (page: Page): Promise<boolean> =>
  safe(
    () =>
      page.evaluate((key: string) => {
        const registry = window as unknown as Record<string, unknown>;
        const log = registry[key];
        if (!Array.isArray(log)) return false;
        log.length = 0;
        return true;
      }, TOAST_KEY),
    false,
  );

/** Espera (con techo) a que aparezca un aviso del tono y título dados en el registro. `log` es `undefined` si el registro no es legible. */
export const waitToast = async (page: Page, tone: ToneName, title: string): Promise<{ readonly found?: ToastEntry; readonly log: readonly ToastEntry[] | undefined }> => {
  const matches = (entry: ToastEntry): boolean => entry.tone === tone && entry.title === title;
  await waitUntil(async () => ((await toastLog(page)) ?? []).some(matches));
  const log = await toastLog(page);
  const found = log?.find(matches);
  return found === undefined ? { log } : { found, log };
};

/** Lo que hay en el registro, en una frase: «ningún aviso» solo si el registro es legible y está vacío. */
export const describeLog = (log: readonly ToastEntry[] | undefined): string => {
  if (log === undefined) return '(registro de avisos no legible)';
  return log.length === 0 ? 'ningún aviso' : log.map((entry) => `${entry.tone} «${entry.title}»${entry.body === '' ? '' : ` / «${entry.body}»`}`).join(' | ');
};

/** Comprobación de un aviso del tono y título dados, con su cuerpo exacto si se da. */
export const toastCheck = async (page: Page, tone: ToneName, title: string, body?: string): Promise<Check> => {
  const seen = await waitToast(page, tone, title);
  const exact = seen.found !== undefined && (body === undefined || seen.found.body === body);
  const expected = `aviso ${tone} «${title}»${body === undefined ? '' : ` con el cuerpo «${body}»`}`;
  return check(exact, expected, exact ? `aviso ${tone} «${title}» con el cuerpo «${seen.found?.body ?? ''}»` : describeLog(seen.log));
};

/**
 * Tras una acción que termina en `endedAt`, espera la ventana de observación (mayor que la vida del aviso) y dice si NO apareció
 * ningún aviso de éxito desde la última «armada». `held` es `undefined` si el registro no es legible (no cumple, no es «ningún aviso»).
 */
export const noOkToast = async (page: Page, endedAt: number): Promise<{ readonly held: boolean | undefined; readonly seen: string }> => {
  const remaining = endedAt + QUIET_WINDOW_MS - Date.now();
  if (remaining > 0) await sleep(remaining);
  const log = await toastLog(page);
  if (log === undefined) return { held: undefined, seen: '(registro de avisos no legible)' };
  const ok = log.filter((entry) => entry.tone === 'ok');
  return { held: ok.length === 0, seen: ok.map((entry) => `«${entry.title}»`).join(', ') };
};

// --- Sesión por el formulario y lecturas acotadas ----------------------------------------------------------------------------------

/** Inicio de sesión por el formulario de /login?tenant=alumno01 (sin segundo paso: las cuentas de esta épica no lo tienen). Termina en /programs. */
export const signInWeb = (page: Page, credentials: Credentials): Promise<string | undefined> =>
  runSteps([
    ['abrir /login?tenant=alumno01', () => page.goto(LOGIN_URL, { timeout: CEILING_MS })],
    ['escribir el correo', () => page.getByLabel('Correo electrónico', { exact: true }).fill(credentials.email, ACTION)],
    ['escribir la contraseña', () => page.getByLabel('Contraseña', { exact: true }).fill(credentials.password, ACTION)],
    ['pulsar «Entrar»', () => page.getByRole('button', { name: 'Entrar', exact: true }).click(ACTION)],
    ['llegar a /programs', () => page.waitForURL(/\/programs/, { timeout: CEILING_MS })],
  ]);

/** Valor de un control de entrada (`inputValue`), o `undefined` si no se puede leer. */
export const inputOf = (target: Locator): Promise<string | undefined> => safe(() => target.first().inputValue({ timeout: 1_000 }), undefined);

/** ¿Está marcada la casilla? `undefined` si no se puede leer. */
export const checkedOf = (target: Locator): Promise<boolean | undefined> => safe(() => target.first().isChecked({ timeout: 1_000 }), undefined);

/** ¿Está deshabilitado el control? `undefined` si no se puede leer (ante la duda, NO está deshabilitado a efectos de cumplir). */
export const disabledOf = (target: Locator): Promise<boolean | undefined> => safe(() => target.first().isDisabled({ timeout: 1_000 }), undefined);

/** Texto visible acotado al primer elemento que casa, o `undefined`. */
export const visibleText = (target: Locator): Promise<string | undefined> => textOf(target);

/** Muestrea el texto de un elemento durante `ms` milisegundos (cada 200 ms) y devuelve cuántas veces se vio cada texto. */
export const observeTexts = async (target: Locator, ms: number): Promise<ReadonlyMap<string, number>> => {
  const seen = new Map<string, number>();
  const started = Date.now();
  while (Date.now() - started < ms) {
    const text = await textOf(target);
    if (text !== undefined) seen.set(text, (seen.get(text) ?? 0) + 1);
    await sleep(200);
  }
  return seen;
};

/** Resumen de lo muestreado: «Guardar» (n veces), «Guardar cambios» (m veces), o «(sin lectura)». */
export const describeSeen = (seen: ReadonlyMap<string, number>): string =>
  seen.size === 0 ? '(sin lectura)' : [...seen.entries()].map(([text, count]) => `«${text}» (${count} veces)`).join(', ');

// --- Acciones con diagnóstico ------------------------------------------------------------------------------------------------------

/**
 * Fallo de una acción. `kind`: «ausente» = 0 coincidencias (la app no ofrece el elemento → discrepa); «localizador» = más de una
 * coincidencia o lectura imposible (error del arnés → no ejecutable); «clic» = el elemento existe y la acción falla (no ejecutable).
 */
export interface Blocked {
  readonly kind: 'ausente' | 'localizador' | 'clic';
  readonly message: string;
  readonly note: string;
  readonly evidence?: Readonly<Record<string, unknown>>;
}

interface Hit {
  readonly hit: string;
  readonly inside: boolean;
}

/** Se ejecuta en el navegador: qué recibe el clic en el centro del elemento. No usa variables de fuera. */
const hitAtCenter = (node: Element): Hit => {
  const box = node.getBoundingClientRect();
  const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
  if (hit === null) return { hit: '(ninguno)', inside: false };
  const testid = hit.getAttribute('data-testid');
  const name = `${hit.tagName.toLowerCase()}${testid === null ? '' : `[data-testid="${testid}"]`}`;
  return { hit: name, inside: hit === node || node.contains(hit) };
};

/** Lo que se registra de una acción fallida: clase del fallo, primeras líneas del error y quién recibe el clic. */
const describeFailure = async (target: Locator, label: string, error: unknown): Promise<Blocked> => {
  const lines = (error instanceof Error ? error.message : String(error))
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '');
  const intercept = lines.find((line) => line.includes('intercepts pointer events'));
  const count = await safe<number | undefined>(() => target.count(), undefined);
  const message = `no se pudo ${label}: ${lines.slice(0, 3).join(' · ')}${intercept === undefined ? '' : ` · ${intercept}`}`;
  if (count === 0) return { kind: 'ausente', message, note: 'La historia nombra un elemento que la pantalla no ofrece (no existe con ese nombre).' };
  if (count === undefined || count > 1) {
    return { kind: 'localizador', message: `${message} · coincidencias: ${count ?? '(no legible)'}`, note: 'Error de localizador (no es un hallazgo sobre la app): el nombre no identifica un único elemento.' };
  }
  const probe = await safe<Hit | undefined>(() => target.first().evaluate(hitAtCenter, undefined, { timeout: 2_000 }), undefined);
  if (probe === undefined) return { kind: 'clic', message: `${message} · recibe el clic: (no se pudo leer)`, note: 'el elemento existe pero no se pudo comprobar qué lo tapa' };
  const note = probe.inside
    ? 'el elemento existe y recibe el clic en su centro, pero la acción no se completó (ver el mensaje de Playwright)'
    : `el elemento existe pero otro lo tapa: ${probe.hit}`;
  return { kind: 'clic', message: `${message} · recibe el clic: ${probe.hit}`, note, evidence: { recibeElClic: probe.hit, dentroDelElemento: probe.inside } };
};

/** Ejecuta una acción sobre un elemento; si falla, devuelve el diagnóstico clasificado (no lanza). */
export const interact = async (target: Locator, label: string, run: (element: Locator) => Promise<unknown>): Promise<Blocked | undefined> => {
  try {
    await run(target);
    return undefined;
  } catch (error) {
    return describeFailure(target, label, error);
  }
};

/**
 * Resultado de una acción fallida. «ausente» discrepa (la app no ofrece el elemento que la historia nombra); localizador y clic son
 * errores del arnés o de la interacción, así que la fila NO es ejecutable, con el error como motivo.
 */
export const actionFailed = (expected: string, blocked: Blocked): Outcome => {
  const evidence = blocked.evidence === undefined ? {} : { evidence: blocked.evidence };
  if (blocked.kind === 'ausente') return outcome(false, expected, blocked.message, { note: blocked.note, ...evidence });
  return { ...notExecutable(expected, `${blocked.note}. ${blocked.message}`), ...evidence };
};

/**
 * Un control habilitado o deshabilitado con su motivo en `title`. Se hace `hover` antes de leer el motivo; el tooltip nativo no es
 * observable en el navegador de la prueba, así que el motivo se lee del atributo `title` (aproximación anotada en la fila).
 */
export const controlCheck = async (target: Locator, what: string, expected: 'habilitado' | 'deshabilitado', reason?: string): Promise<Check> => {
  await safe(() => target.first().hover({ timeout: 1_000 }), undefined);
  const disabled = await disabledOf(target);
  const title = await attrOf(target, 'title');
  const observed = disabled === undefined ? '(sin leer)' : disabled ? `deshabilitado${title === undefined ? '' : `, con el motivo «${title}»`}` : 'habilitado';
  const reasonOk = reason === undefined || title === reason;
  const ok = expected === 'habilitado' ? disabled === false : disabled === true && reasonOk;
  return check(ok, `${what} ${expected}${reason === undefined ? '' : `, con el motivo «${reason}»`}`, `${what} ${observed}`);
};

/** Nota de aproximación para las filas que miran un motivo en `title` (el tooltip nativo no es observable). */
export const TOOLTIP_NOTE = 'El motivo se lee del atributo title tras un hover: el tooltip nativo del navegador no es observable en la prueba, así que esta es una aproximación.';

/** Un texto visible igual al esperado (`undefined` = no legible = no cumplido). */
export const textCheck = (observed: string | undefined, expected: string, what: string): Check =>
  check(observed === expected, `${what} «${expected}»`, `${what} ${observed === undefined ? '(no legible)' : `«${observed}»`}`);

/** Un número de un control (valor leído) igual al esperado. */
export const numberCheck = (observed: string | undefined, expected: number, what: string): Check =>
  check(observed !== undefined && observed.trim() !== '' && Number(observed) === expected, `${what} ${expected}`, `${what} ${observed ?? '(no legible)'}`);

/** Espera (con techo) a que un valor leído cumpla `condition`, y devuelve el último valor leído (para la comprobación). */
export const waitForValue = async (read: () => Promise<string | undefined>, condition: (value: string | undefined) => boolean): Promise<string | undefined> => {
  await waitUntil(async () => condition(await read()));
  return read();
};

/** Vista de las filas de la tabla de credenciales: cada fila como lista de textos visibles de sus celdas. */
export const credentialRows = async (page: Page): Promise<readonly (readonly string[])[]> => {
  const texts = await safe(() => page.getByTestId(LAB_TESTIDS.LAB_CREDENTIALS).locator('tbody tr').allInnerTexts(), [] as string[]);
  return texts.map((text) => text.split('\t').map((piece) => piece.trim()));
};

/** Comprueba que algo NO aparece: se exige una lectura positiva (conteo 0); una lectura fallida NO cumple. */
export const absentCheck = async (target: Locator, what: string): Promise<Check> => {
  const count = await safe<number | undefined>(() => target.count(), undefined);
  return check(count === 0, `no aparece ${what}`, count === undefined ? `${what}: (sin leer)` : count === 0 ? `no aparece ${what}` : `aparece ${what} (${count})`);
};

/** Resultado de una fila web a partir de sus comprobaciones (coincide solo si todas se cumplen). */
export const rowOutcome = (checks: readonly Check[], extra: Pick<Outcome, 'note' | 'evidence'> = {}): Outcome =>
  outcome(
    checks.every((entry) => entry.ok),
    checks.map((entry) => entry.expected).join('; '),
    checks.map((entry) => entry.observed).join('; '),
    withDifference(checks, extra),
  );

/**
 * Mueve un deslizador (`input type=range`) hasta `target` como lo haría una persona: foco y flechas, en pasos de `step`. Devuelve el
 * diagnóstico si no se puede leer, enfocar o pulsar (no lanza).
 */
export const moveSlider = async (slider: Locator, target: number, step: number): Promise<Blocked | undefined> => {
  const current = Number(await inputOf(slider));
  if (!Number.isFinite(current)) return { kind: 'localizador', message: 'no se pudo leer el valor del deslizador', note: 'el deslizador no expone su valor (input range)' };
  const presses = Math.round((target - current) / step);
  const key = presses >= 0 ? 'ArrowRight' : 'ArrowLeft';
  return interact(slider, `mover el deslizador a ${target}`, async (element) => {
    await element.focus({ timeout: CEILING_MS });
    for (let index = 0; index < Math.abs(presses); index += 1) await element.press(key, ACTION);
  });
};

/** Pausa de la prueba para una reacción local de la pantalla (1 s): tolerancia de la prueba, no un plazo del producto. */
export const settle = (): Promise<void> => sleep(1_000);

/** Espera (con techo) a que una casilla o un interruptor tenga el estado dado; devuelve el último leído. */
export const waitChecked = async (target: Locator, expected: boolean): Promise<boolean | undefined> => {
  await waitUntil(async () => (await checkedOf(target)) === expected);
  return checkedOf(target);
};

/** Estado `aria-checked` de un interruptor como booleano (`undefined` si no se puede leer). */
export const ariaChecked = async (target: Locator): Promise<boolean | undefined> => {
  const value = await attrOf(target, 'aria-checked');
  return value === undefined ? undefined : value === 'true';
};

/** Texto de un elemento tras normalizar espacios (o `undefined`). */
export const normalizedText = async (target: Locator): Promise<string | undefined> => {
  const text = await textOf(target);
  return text === undefined ? undefined : text.replace(/\s+/g, ' ').trim();
};

// --- Diagnóstico de la pantalla de la fila -----------------------------------------------------------------------------------------

/**
 * Lo que se ve de la pantalla en el momento de un fallo: URL, si hay aviso de rol, si el encabezado «Modo caos» está y cuántos elementos
 * de Administración hay en la página. Es la evidencia de por qué la prueba no encontró lo que buscaba (no contiene tokens).
 */
export const screenDiagnosis = async (page: Page): Promise<Readonly<Record<string, unknown>>> => ({
  url: page.url(),
  avisoDeRolVisible: await isVisible(page.getByTestId(ADMIN_TESTIDS.ADMIN_FORBIDDEN)),
  encabezadoModoCaosVisible: await isVisible(page.getByRole('heading', { name: 'Modo caos', exact: true })),
  elementosDeAdministracion: await safe<number | undefined>(() => page.locator('[data-testid^="admin-"]').count(), undefined),
});

/**
 * Como `actionFailed`, pero antes de declarar «la app no ofrece el elemento» (discrepa) comprueba que la pantalla de la fila está visible.
 * Si no lo está, la prueba no llegó a la pantalla: la fila NO es ejecutable, con la URL y lo que se ve como evidencia.
 */
export const actionFailedOn = async (page: Page, expected: string, blocked: Blocked, screen: Locator): Promise<Outcome> => {
  if (blocked.kind !== 'ausente') return actionFailed(expected, blocked);
  const diagnosis = await screenDiagnosis(page);
  if (await isVisible(screen)) return actionFailed(expected, { ...blocked, evidence: { ...(blocked.evidence ?? {}), ...diagnosis } });
  return { ...notExecutable(expected, `la prueba no llegó a la pantalla de la fila (no está visible): ${blocked.message}`), evidence: diagnosis };
};
