import type { Dialog, Locator, Page, Request as PlaywrightRequest, Response as PlaywrightResponse } from '@playwright/test';
import { programasEs } from '../../../../packages/shared/src/i18n/programas';
import { PROGRAMAS_DYNAMIC_TESTIDS, PROGRAMAS_TESTIDS } from '../../../../packages/shared/src/testids';
import { NO_CHAOS, adminToken, call, field, setChaos } from '../../../story-runs/support/api';
import { TENANT_A } from '../../../story-runs/support/prepare';
import { ACTION, CEILING_MS, pathOf, runSteps, safe, textOf, waitUntil, type Step } from '../../support/browser';
import { check, conclude as concludeChecks, sleep, type Check } from '../../support/checks';
import { notExecutable, outcome, type BrowserRowHandler, type Outcome } from '../../core/framework';

// Piezas comunes de las filas de AVISOS de EP-TOASTS (web; la app móvil reutiliza el registro y las comprobaciones).
// Criterio: el registro de avisos se instala ANTES de cargar la app; cada aparición y cada retirada se anota con la marca de tiempo
// de la página. «Se ve» se comprueba en el momento (DOM, opacidad y el punto central) y «qué dice» en el registro. Toda acción pasa
// por `clickAt`: si falla, distingue «la pantalla correcta no ofrece el elemento» (discrepa) de «error de localizador o de clic del
// arnés» (no ejecutable, con el error como evidencia).

export type ToastTone = 'ok' | 'danger' | 'info' | 'warn';
export interface Viewport {
  readonly width: number;
  readonly height: number;
}

export const DESKTOP: Viewport = { width: 1440, height: 900 };
export const NARROW: Viewport = { width: 390, height: 844 };
export const LOGIN_URL = `/login?tenant=${TENANT_A}`;
export const TOAST_KEY = '__sigproToasts';
export const COOKIE_NOTE = 'La prueba fija la preferencia de cookies (sigpro.cookies = accepted) antes de abrir la app, como el piloto; el aviso de cookies no se ejerce aquí.';
/** Historia transversal: solo la web la ejecuta; el apilado y el plazo de los avisos móviles no se miran con esta historia. */
export const TRANSVERSAL_NOTE =
  'Historia transversal: su fila se mira en la web (1440 px). Con esta historia no se ejecuta la app móvil: su apilado no se mira allí; la historia móvil (US-TOASTS-006) mira posición, tono, rol, retirada a 3 s y que el aviso quede por encima del contenido.';
/** Plazo de retirada: 3 s desde la aparición, con una tolerancia de la prueba (la historia lo fija como regla de producto). */
export const LIFETIME_MS = 3_000;
export const LIFETIME_TOLERANCE_MS = 500;
export const LIFETIME_NOTE = `Plazo de retirada: 3 s desde que aparece, con ${LIFETIME_TOLERANCE_MS} ms de tolerancia de la prueba; los instantes son los de la marca de la página.`;
/** Tolerancia de medida de las distancias de la historia (16 px web, 12 px móvil), declarada porque la historia no la fija. */
export const PLACEMENT_NOTE = 'Tolerancias de medida: ±1 px en las distancias que fija la historia (16 px en la web; 12 px en la app móvil) y 1 px de solape al decir «debajo».';
/** Reacción local de la pantalla (la entrada del aviso dura 180 ms y lo desplaza 6 px): se espera antes de medir o de leer su estado. */
const SETTLE_MS = 500;
const WRITE_METHODS: ReadonlySet<string> = new Set<string>(['POST', 'PUT', 'PATCH', 'DELETE']);

/** Texto de la historia para el tono (celda) → tono del registro (`data-testid="toast-<tono>"`). */
export const TONE_OF_CELL: ReadonlyMap<string, ToastTone> = new Map<string, ToastTone>([
  ['éxito', 'ok'],
  ['error', 'danger'],
  ['informativo', 'info'],
  ['advertencia', 'warn'],
]);
/** Tono → frase que usan las historias («aviso de éxito», «aviso informativo»…). */
const PHRASE_OF_TONE: ReadonlyMap<string, string> = new Map<string, string>([
  ['ok', 'aviso de éxito'],
  ['danger', 'aviso de error'],
  ['info', 'aviso informativo'],
  ['warn', 'aviso de advertencia'],
]);
/** Token del design system de cada tono (la franja del aviso se pinta con él). */
const TOKEN_OF_TONE: ReadonlyMap<string, string> = new Map<string, string>([
  ['ok', '--ok'],
  ['danger', '--danger'],
  ['info', '--info'],
  ['warn', '--warn'],
]);
/** Rol de la celda («estado» / «alerta») → atributo `role` que se espera. */
export const ROLE_OF_CELL: ReadonlyMap<string, string> = new Map<string, string>([
  ['estado', 'status'],
  ['alerta', 'alert'],
]);
const ROLE_NAME: ReadonlyMap<string, string> = new Map<string, string>([
  ['status', 'estado'],
  ['alert', 'alerta'],
]);

export const phraseOfTone = (tone: string): string => PHRASE_OF_TONE.get(tone) ?? `aviso (${tone})`;
export const nameOfRole = (role: string): string => (role === '' ? '(sin rol)' : (ROLE_NAME.get(role) ?? role));

// --- Registro de avisos (se ejecuta en la página, antes de cargar la app) ----------------------------------------------------

/** Un aviso registrado: tono, título (primera línea), cuerpo (segunda), rol, franja, tamaños de letra y marcas de tiempo de la página. */
export interface ToastEntry {
  readonly tone: string;
  readonly title: string;
  readonly body: string;
  readonly role: string;
  /** Color de la franja izquierda, tal como lo pinta el navegador. */
  readonly border: string;
  readonly titleSize: number;
  /** -1 si el aviso no tiene cuerpo. */
  readonly bodySize: number;
  /** Instante en que el aviso entra en el DOM. */
  readonly at: number;
  /** Instante en que sale del DOM (undefined mientras sigue montado). */
  readonly removedAt?: number;
}

/**
 * Se ejecuta en el navegador: anota cada aparición (`data-testid="toast-<tono>"`) y cada retirada de un aviso, también los que se solapan.
 * Sin variables de fuera.
 */
export const recordToasts = (key: string): void => {
  const registry = window as unknown as Record<string, unknown>;
  if (Array.isArray(registry[key])) return;
  const log: Record<string, unknown>[] = [];
  registry[key] = log;
  const live = new Map<Element, Record<string, unknown>>();
  const toneOf = (element: Element): string | undefined => /^toast-(ok|danger|info|warn)$/.exec(element.getAttribute('data-testid') ?? '')?.[1];
  const sizeOf = (element: HTMLElement, text: string): number => {
    const node = Array.from(element.querySelectorAll('div')).find((div) => div.innerText.trim() === text);
    return node === undefined ? -1 : parseFloat(getComputedStyle(node).fontSize);
  };
  const record = (element: Element, tone: string): void => {
    const box = element as HTMLElement;
    const lines = box.innerText
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line !== '' && line !== '×');
    const title = lines[0] ?? '';
    const body = lines[1] ?? '';
    const entry: Record<string, unknown> = {
      tone,
      title,
      body,
      role: box.getAttribute('role') ?? '',
      border: getComputedStyle(box).borderLeftColor,
      titleSize: sizeOf(box, title),
      bodySize: body === '' ? -1 : sizeOf(box, body),
      at: Date.now(),
    };
    log.push(entry);
    live.set(element, entry);
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
  const forget = (node: Node): void => {
    if (!(node instanceof Element)) return;
    const gone = [node, ...Array.from(node.querySelectorAll('[data-testid^="toast-"]'))];
    gone.forEach((element) => {
      const entry = live.get(element);
      if (entry !== undefined) entry.removedAt = Date.now();
      live.delete(element);
    });
  };
  new MutationObserver((mutations) =>
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach(scan);
      mutation.removedNodes.forEach(forget);
    }),
  ).observe(document, { childList: true, subtree: true });
};

/** Se ejecuta en el navegador: pone la preferencia de cookies para que el aviso de cookies no tape controles. Sin variables de fuera. */
export const fixCookiePreference = (): void => {
  try {
    localStorage.setItem('sigpro.cookies', 'accepted');
  } catch {
    // sin almacenamiento: no hay preferencia que fijar
  }
};

/** Vacía el registro y marca el instante de la acción que se va a probar. `undefined` si la página no lo permite. */
export const armToasts = (page: Page): Promise<number | undefined> =>
  safe<number | undefined>(
    () =>
      page.evaluate((key: string) => {
        const registry = window as unknown as Record<string, unknown>;
        const log = registry[key];
        if (Array.isArray(log)) log.length = 0;
        const at = Date.now();
        registry.__sigproArmedAt = at;
        return at;
      }, TOAST_KEY),
    undefined,
  );

/** Motivo de preparación si no se pudo armar el registro (la fila no empieza); `undefined` si está armado. */
export const armOrFail = async (page: Page): Promise<string | undefined> => ((await armToasts(page)) === undefined ? 'no se pudo armar el registro de avisos' : undefined);

/** Hora de la página (la marca de los avisos y de las retiradas es la de la página). */
export const pageNow = (page: Page): Promise<number | undefined> => safe<number | undefined>(() => page.evaluate(() => Date.now()), undefined);

/** Registro de avisos desde la última «armada». `undefined` si la lectura falla (no es un registro vacío). */
export const toastLog = (page: Page): Promise<readonly ToastEntry[] | undefined> =>
  safe<readonly ToastEntry[] | undefined>(() => page.evaluate((key: string) => ((window as unknown as Record<string, unknown>)[key] as ToastEntry[] | undefined) ?? [], TOAST_KEY), undefined);

/** Lo que hay en el registro, en una frase derivada del estado leído. */
export const describeLog = (log: readonly ToastEntry[] | undefined): string => {
  if (log === undefined) return '(sin leer)';
  if (log.length === 0) return '(ningún aviso desde la acción)';
  return log.map((entry) => `${phraseOfTone(entry.tone)} «${entry.title}»${entry.body === '' ? '' : ` con «${entry.body}»`}`).join('; ');
};

export interface Seen {
  /** Primer aviso del registro con ese título (cualquier tono), si apareció. */
  readonly entry: ToastEntry | undefined;
  readonly observed: string;
  readonly log: readonly ToastEntry[];
  /** Milisegundos desde la acción (la «armada») hasta la aparición. */
  readonly delayMs: number | undefined;
}

/** Espera (con techo de 10 s) a que aparezca un aviso con ese título y devuelve el primero, el registro y el tiempo hasta la aparición. */
export const awaitTitle = async (page: Page, title: string): Promise<Seen> => {
  await waitUntil(async () => ((await toastLog(page)) ?? []).some((entry) => entry.title === title));
  const read = await toastLog(page);
  const log = read ?? [];
  const entry = log.find((candidate) => candidate.title === title);
  const armed = await safe<number | undefined>(() => page.evaluate(() => Number((window as unknown as Record<string, unknown>).__sigproArmedAt ?? 0)), undefined);
  const delayMs = entry === undefined || armed === undefined ? undefined : entry.at - armed;
  return { entry, observed: describeLog(read), log, delayMs };
};

/** Evidencia de tiempos de la fila: cuánto tardó en aparecer el aviso (el techo de espera es de 10 s). */
export const appearance = (seen: Seen): Record<string, unknown> => ({ msHastaAparicion: seen.delayMs ?? '(no apareció)' });

/** El aviso del tono y título dados que está en el DOM ahora (filtro por texto exacto de su título). */
export const toastOf = (page: Page, tone: ToastTone, title: string): Locator =>
  page.locator(`[data-testid="toast-${tone}"]`).filter({ has: page.getByText(title, { exact: true }) });

export interface Box {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** Caja de un elemento solo si se ve (un elemento montado pero oculto no tiene caja). */
export const boxOf = (target: Locator): Promise<Box | undefined> =>
  safe(async () => {
    const first = target.first();
    if (!(await first.isVisible())) return undefined;
    const box = await first.boundingBox({ timeout: 2_000 });
    return box === null ? undefined : box;
  }, undefined);

/** Tamaño de la zona visible de la ventana (sin barras de desplazamiento): los avisos fijos se miden frente a ella. */
export const viewportOf = (page: Page): Promise<Viewport | undefined> =>
  safe(() => page.evaluate(() => ({ width: document.documentElement.clientWidth, height: document.documentElement.clientHeight })), undefined);

/** Color de un token del design system tal como lo pinta el navegador (para comparar con la franja de un aviso). */
export const tokenColor = (page: Page, token: string): Promise<string | undefined> =>
  safe(
    () =>
      page.evaluate((name: string) => {
        const probe = document.createElement('span');
        probe.style.color = `var(${name})`;
        document.body.append(probe);
        const color = getComputedStyle(probe).color;
        probe.remove();
        return color;
      }, token),
    undefined,
  );

/** Espera la reacción local de la pantalla (500 ms de la prueba): la entrada del aviso dura 180 ms. */
export const settle = (): Promise<void> => sleep(SETTLE_MS);

/** ¿Se ve ahora el aviso? `false` si no está en el DOM; `undefined` si la lectura falla (una lectura fallida no cuenta como cumplida). */
export const shownNow = async (target: Locator): Promise<boolean | undefined> => {
  const count = await safe(() => target.count(), -1);
  if (count < 0) return undefined;
  if (count === 0) return false;
  return safe<boolean | undefined>(() => target.first().isVisible(), undefined);
};

// --- Comprobaciones del aviso --------------------------------------------------------------------------------------------------

/** Se ve en pantalla en este momento: montado, visible, opaco y con el propio aviso en su punto central («por encima del contenido»). */
export const liveCheck = async (page: Page, tone: ToastTone, title: string): Promise<Check> => {
  await settle();
  const read = await safe<{ readonly shown: boolean; readonly why: string } | undefined>(
    () =>
      page.evaluate(
        ({ testid, text }: { testid: string; text: string }) => {
          const candidates = Array.from(document.querySelectorAll<HTMLElement>(`[data-testid="${testid}"]`)).filter((element) => element.innerText.split('\n').some((line) => line.trim() === text));
          const element = candidates[0];
          if (element === undefined) return { shown: false, why: 'no está en el DOM' };
          const style = getComputedStyle(element);
          if (style.display === 'none' || style.visibility === 'hidden') return { shown: false, why: `oculto (display ${style.display}, visibility ${style.visibility})` };
          if (Number(style.opacity) < 0.99) return { shown: false, why: `opacidad ${style.opacity}` };
          const box = element.getBoundingClientRect();
          if (box.width <= 0 || box.height <= 0) return { shown: false, why: 'sin tamaño' };
          const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
          if (hit === null || !element.contains(hit)) return { shown: false, why: `lo tapa otro elemento: ${hit === null ? '(ninguno)' : hit.tagName.toLowerCase()}` };
          return { shown: true, why: 'visible, opaco, y su punto central lo recibe el propio aviso' };
        },
        { testid: `toast-${tone}`, text: title },
      ),
    undefined,
  );
  return check(read?.shown === true, `el aviso «${title}» se ve en pantalla`, read === undefined ? '(lectura no disponible)' : read.why);
};

/** Tono y título del aviso (y su cuerpo si la fila lo da: `(sin cuerpo)` es la cadena vacía), más que se ve en pantalla. */
export const toastChecks = async (page: Page, seen: Seen, tone: ToastTone, title: string, body?: string): Promise<Check[]> => {
  const entry = seen.entry;
  const checks: Check[] = [
    check(entry !== undefined && entry.tone === tone, `${phraseOfTone(tone)} con el título «${title}»`, entry === undefined ? seen.observed : `${phraseOfTone(entry.tone)} con el título «${entry.title}»`),
    await liveCheck(page, tone, title),
  ];
  if (body !== undefined) {
    const expected = body === '' ? 'el aviso no tiene cuerpo' : `el aviso tiene el cuerpo «${body}»`;
    const observed = entry === undefined ? '(sin aviso)' : entry.body === '' ? 'el aviso no tiene cuerpo' : `el aviso tiene el cuerpo «${entry.body}»`;
    checks.push(check(entry !== undefined && entry.body === body, expected, observed));
  }
  return checks;
};

/** Rol con el que se anuncia el aviso (atributo `role`), frente al que dice la historia. */
export const roleCheck = (seen: Seen, role: string): Check => {
  const entry = seen.entry;
  return check(entry !== undefined && entry.role === role, `se anuncia con el rol de ${nameOfRole(role)}`, entry === undefined ? seen.observed : `se anuncia con el rol de ${nameOfRole(entry.role)}`);
};

/** La franja izquierda del aviso tiene el color de su tono (regla de la historia de tonos). */
export const franjaCheck = async (page: Page, seen: Seen, tone: ToastTone): Promise<Check> => {
  const token = TOKEN_OF_TONE.get(tone) ?? '';
  const color = await tokenColor(page, token);
  const entry = seen.entry;
  const ok = entry !== undefined && color !== undefined && entry.border === color;
  return check(ok, `la franja del borde izquierdo con el color del tono (${token})`, entry === undefined ? '(sin aviso)' : `franja ${entry.border}, color del tono ${color ?? '(no leído)'}`);
};

/** El cuerpo, si lo hay, va con letra más pequeña que el título (regla de la historia de tonos). */
export const bodySmallerCheck = (seen: Seen): Check => {
  const entry = seen.entry;
  const ok = entry !== undefined && entry.bodySize > 0 && entry.titleSize > 0 && entry.bodySize < entry.titleSize;
  return check(ok, 'el cuerpo con letra más pequeña que el título', entry === undefined ? '(sin aviso)' : `letra del cuerpo ${entry.bodySize} px y del título ${entry.titleSize} px`);
};

export interface Lifetime {
  readonly check: Check;
  /** Milisegundos desde la aparición hasta la retirada (undefined si no se retiró en 5 s). */
  readonly ms: number | undefined;
}

/** El aviso se retira a los 3 s de aparecer, con la tolerancia declarada: espera (con techo de 5 s) a su retirada del DOM. */
export const lifetimeOf = async (page: Page, entry: ToastEntry | undefined, label: string): Promise<Lifetime> => {
  if (entry === undefined) return { check: check(false, `el ${label} se retira a los 3 s de aparecer`, `el ${label} no llegó a aparecer`), ms: undefined };
  const at = entry.at;
  await waitUntil(async () => ((await toastLog(page)) ?? []).some((candidate) => candidate.at === at && candidate.removedAt !== undefined), 5_000);
  const removedAt = ((await toastLog(page)) ?? []).find((candidate) => candidate.at === at)?.removedAt;
  const ms = removedAt === undefined ? undefined : removedAt - at;
  const ok = ms !== undefined && Math.abs(ms - LIFETIME_MS) <= LIFETIME_TOLERANCE_MS;
  return {
    check: check(ok, `el ${label} se retira a los 3 s de aparecer (±${LIFETIME_TOLERANCE_MS} ms)`, ms === undefined ? `el ${label} no se retiró en 5 s` : `el ${label} se retiró a los ${ms} ms de aparecer`),
    ms,
  };
};

// --- Respuestas de la API a las escrituras de la fila ---------------------------------------------------------------------------

export interface WriteReply {
  readonly method: string;
  readonly path: string;
  readonly status: number;
  readonly body: string;
}

/** Anota las respuestas de la API a las escrituras (POST, PUT, PATCH, DELETE) desde que se llama. `collect` las espera (con techo). */
export const watchReplies = (page: Page): { readonly collect: () => Promise<readonly WriteReply[]>; readonly stop: () => void } => {
  const pending: Promise<WriteReply>[] = [];
  const listener = (response: PlaywrightResponse): void => {
    const method = response.request().method();
    if (!response.url().includes('/api/') || !WRITE_METHODS.has(method)) return;
    const path = new URL(response.url()).pathname;
    const status = response.status();
    pending.push(response.text().then(
      (body) => ({ method, path, status, body }),
      () => ({ method, path, status, body: '' }),
    ));
  };
  page.on('response', listener);
  return {
    collect: () => Promise.race([Promise.all(pending), sleep(4_000).then((): WriteReply[] => [])]),
    stop: () => page.off('response', listener),
  };
};

/** La respuesta a la escritura de ese método sobre una ruta que contiene `pathPart`. */
export const replyOf = (replies: readonly WriteReply[], method: string, pathPart: string): WriteReply | undefined => replies.find((reply) => reply.method === method && reply.path.includes(pathPart));

/** El servidor confirma la escritura (2xx). */
export const confirmedReplyCheck = (reply: WriteReply | undefined, what: string): Check =>
  check(reply !== undefined && reply.status >= 200 && reply.status < 300, `el servidor confirma ${what} (2xx)`, reply === undefined ? 'no llegó la respuesta de la escritura' : `el servidor responde ${reply.status}`);

/** La escritura falla por el caos: 500 con `chaos_error` en el cuerpo (así el aviso de error se atribuye al caos y no a otra cosa). */
const isChaosReply = (reply: WriteReply | undefined): boolean => reply !== undefined && reply.status === 500 && reply.body.includes('chaos_error');
export const chaosReplyCheck = (reply: WriteReply | undefined): Check =>
  check(isChaosReply(reply), 'el servidor responde 500 chaos_error a la escritura (lo provoca el caos)', reply === undefined ? 'no llegó la respuesta de la escritura' : `el servidor responde ${reply.status}${reply.body.includes('chaos_error') ? ' con chaos_error' : ' sin chaos_error'}`);
/** Todas las escrituras de archivado de la fila (una o dos) fallan por el caos. */
export const chaosArchivesCheck = (replies: readonly WriteReply[], count: number): Check => {
  const archives = replies.filter((reply) => reply.method === 'POST' && reply.path.includes('/archive'));
  return check(archives.length === count && archives.every(isChaosReply), `las ${count} escrituras de archivado responden 500 chaos_error`, `${archives.length} escritura(s) de archivado: ${archives.map((reply) => `${reply.status}${reply.body.includes('chaos_error') ? ' chaos_error' : ''}`).join(', ') || '(ninguna)'}`);
};

// --- Datos leídos por API ---------------------------------------------------------------------------------------------------------

export interface ProgramRead {
  readonly found: boolean;
  readonly status?: string;
  readonly name?: string;
}

/** Un programa tal como lo devuelve la API (`GET /programs/<código>`) con el administrador del tenant. */
export const programOf = async (code: string): Promise<ProgramRead> => {
  const token = await adminToken(TENANT_A);
  const result = await call('GET', `/programs/${code}`, { tenant: TENANT_A, token });
  if (result.status !== 200) return { found: false };
  const status = field(result.body, 'status');
  const name = field(result.body, 'name');
  return { found: true, ...(typeof status === 'string' ? { status } : {}), ...(typeof name === 'string' ? { name } : {}) };
};

/** Estado de un programa tal como lo muestra la app (etiqueta del catálogo), a partir del estado de la API. */
const STATUS_LABEL: ReadonlyMap<string, string> = new Map<string, string>([
  ['active', programasEs.st_active],
  ['closed', programasEs.st_closed],
  ['draft', programasEs.st_draft],
  ['on_hold', programasEs.st_on_hold],
  ['cancelled', programasEs.st_cancelled],
]);

export const programStateLabel = async (code: string): Promise<string | undefined> => {
  const program = await programOf(code);
  if (!program.found || program.status === undefined) return undefined;
  return STATUS_LABEL.get(program.status) ?? `(estado ${program.status})`;
};

/** Identificadores de los comentarios de una no conformidad, leídos por API. */
export const ncCommentIds = async (code: string): Promise<readonly string[] | undefined> => {
  const token = await adminToken(TENANT_A);
  const result = await call('GET', `/nc/${code}`, { tenant: TENANT_A, token });
  const comments = field(result.body, 'comments');
  if (result.status !== 200 || !Array.isArray(comments)) return undefined;
  return comments.map((comment: unknown) => String(field(comment, 'id')));
};

/** Comprobaciones de «archivar» (estado en la API y respuesta del servidor): lo que la historia llama «el servidor confirmó el cambio». */
export const archiveVerify = async (replies: readonly WriteReply[]): Promise<Check[]> => {
  const state = await programStateLabel('PRG-001');
  return [
    check(state === 'Cerrado', 'PRG-001 queda con el estado «Cerrado» en la API', `PRG-001 queda con el estado «${state ?? '(sin leer)'}» en la API`),
    confirmedReplyCheck(replyOf(replies, 'POST', 'PRG-001/archive'), 'el archivado'),
  ];
};

/** Comprobaciones de «duplicar»: la copia PRG-025 existe en la API como borrador, con el nombre del original y «(copia)». */
export const duplicateVerify = async (replies: readonly WriteReply[]): Promise<Check[]> => {
  const copy = await programOf('PRG-025');
  const source = await programOf('PRG-001');
  const expectedName = `${source.name ?? '(sin leer)'} (copia)`;
  return [
    check(copy.found, 'PRG-025 existe en la API', copy.found ? 'PRG-025 existe en la API' : 'PRG-025 no existe en la API'),
    check(copy.status === 'draft', 'PRG-025 queda como borrador en la API', `PRG-025 queda como ${copy.status ?? '(sin leer)'} en la API`),
    check(copy.name !== undefined && copy.name === expectedName, `PRG-025 se llama «${expectedName}»`, `PRG-025 se llama «${copy.name ?? '(sin leer)'}»`),
    confirmedReplyCheck(replyOf(replies, 'POST', 'PRG-001/duplicate'), 'la copia'),
  ];
};

// --- Acciones con diagnóstico ----------------------------------------------------------------------------------------------------

export interface Blocked {
  /** `missing`: la pantalla correcta no ofrece el elemento. `covered`: lo tapa otro. `harness`: error de localizador/clic o pantalla no alcanzada. */
  readonly kind: 'missing' | 'covered' | 'harness';
  readonly message: string;
  readonly hit?: string;
}

export type Act = (page: Page) => Promise<Blocked | undefined>;

const errorLines = (error: unknown): readonly string[] =>
  (error instanceof Error ? error.message : String(error))
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '');

/** Se ejecuta en el navegador: qué recibe el clic en el centro del elemento. Sin variables de fuera. */
const hitAtCenter = (node: Element): string => {
  const box = node.getBoundingClientRect();
  const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
  if (hit === null) return '(ninguno)';
  const testid = hit.getAttribute('data-testid');
  return `${hit.tagName.toLowerCase()}${testid === null ? '' : `[data-testid="${testid}"]`}`;
};

/** Pulsa un elemento; si falla, clasifica el fallo. `screen` dice si la pantalla es la que la fila necesita. */
export const clickAt =
  (locate: (page: Page) => Locator, label: string, screen: (page: Page) => boolean): Act =>
  async (page) => {
    const target = locate(page);
    try {
      await target.click(ACTION);
      return undefined;
    } catch (error) {
      const lines = errorLines(error);
      if (!screen(page)) return { kind: 'harness', message: `no se pudo ${label}: la pantalla no es la esperada (ruta ${pathOf(page)}): ${lines[0] ?? ''}` };
      const count = await safe(() => target.count(), -1);
      if (count === 0) {
        // «La pantalla no ofrece el elemento» solo si la lista de la pantalla ya cargó (si no, el fallo es de carga, no de la app)
        const rowMenus = await safe(() => page.getByRole('button', { name: /^Acciones para / }).count(), 0);
        if (rowMenus === 0) return { kind: 'harness', message: `no se pudo ${label}: la lista de la pantalla no ha cargado` };
        return { kind: 'missing', message: `no se pudo ${label}: no hay ningún elemento que lo cumpla` };
      }
      const covered = lines.find((line) => line.includes('intercepts pointer events'));
      if (covered !== undefined) {
        const hit = await safe(() => target.first().evaluate(hitAtCenter, undefined, { timeout: 2_000 }), undefined);
        return { kind: 'covered', message: `no se pudo ${label}: ${covered}`, hit: hit ?? '(no leído)' };
      }
      return { kind: 'harness', message: `no se pudo ${label}: ${lines.slice(0, 3).join(' · ')}` };
    }
  };

/** Ejecuta las acciones en orden y devuelve el primer fallo. */
export const inOrder =
  (...acts: readonly Act[]): Act =>
  async (page) => {
    for (const act of acts) {
      const blocked = await act(page);
      if (blocked !== undefined) return blocked;
    }
    return undefined;
  };

/** Una navegación con su llegada: la ruta debe quedar en `path` (si no, la pantalla no se alcanzó). */
export const goTo = (locate: (page: Page) => Locator, label: string, path: string): Act =>
  inOrder(clickAt(locate, label, () => true), async (page) => {
    const arrived = await waitUntil(async () => pathOf(page) === path);
    return arrived.reached ? undefined : { kind: 'harness', message: `no se llegó a ${path} tras «${label}» (ruta ${pathOf(page)})` };
  });

/** Un fallo de acción convertido en resultado de la fila (discrepa, o no ejecutable con el error como evidencia). */
export const actionFailed = (expected: string, blocked: Blocked): Outcome => {
  const evidence = { error: blocked.message, ...(blocked.hit === undefined ? {} : { recibeElClic: blocked.hit }) };
  if (blocked.kind === 'missing')
    return outcome(false, expected, blocked.message, { note: 'La historia nombra un elemento que la pantalla no ofrece (la pantalla correcta está visible).', evidence });
  if (blocked.kind === 'covered') return outcome(false, expected, blocked.message, { note: `el elemento existe, pero lo tapa otro: ${blocked.hit ?? '(no leído)'}`, evidence });
  return { ...notExecutable(expected, 'error de localizador o de clic del arnés (o pantalla no alcanzada): la fila no llegó a la acción; no es un hallazgo sobre la app'), evidence };
};

/** Resultado de una fila a partir de sus comprobaciones; si alguna falla, la nota dice en qué difiere (lo que la historia espera frente a lo observado). */
export const conclude = (checks: readonly Check[], extra: Pick<Outcome, 'note' | 'evidence'> = {}): Outcome => {
  const failing = checks.filter((entry) => !entry.ok);
  const difference = failing.length === 0 ? undefined : `difiere en: ${failing.map((entry) => `${entry.expected} (observado: ${entry.observed})`).join('; ')}`;
  const note = [extra.note, difference].filter((part): part is string => part !== undefined).join(' ');
  return concludeChecks(checks, { ...extra, ...(note === '' ? {} : { note }) });
};

/**
 * «Mientras el aviso sigue a la vista» no se dio al pulsar la siguiente acción. Sin aparición, el aviso no llegó a salir. Si no se puede
 * leer si sigue, la condición no se da por cumplida ni incumplida (no ejecutable). Si ya pasaron 3 s, la prueba llegó tarde (no ejecutable,
 * con el tiempo como evidencia). Si no, la app lo retiró antes de su plazo (discrepa).
 */
export const premiseLost = async (page: Page, expected: string, title: string, seen: Seen, reading: boolean | undefined): Promise<Outcome> => {
  const entry = seen.entry;
  if (entry === undefined)
    return outcome(false, expected, `no apareció «${title}» tras la acción (${seen.observed})`, { note: 'El aviso no llegó a aparecer tras la acción; la condición «mientras sigue a la vista» no se pudo dar.' });
  if (reading === undefined) return notExecutable(expected, 'no se pudo leer si el aviso sigue a la vista; la condición no se da por cumplida ni incumplida');
  const now = (await pageNow(page)) ?? Date.now();
  const elapsed = now - entry.at;
  const evidence = { msDesdeAparicion: elapsed };
  if (elapsed >= LIFETIME_MS) return { ...notExecutable(expected, `el arnés llegó tarde: «${title}» llevaba ${elapsed} ms (más de 3 s) cuando debía seguir a la vista; no es un hallazgo sobre la app`), evidence };
  return outcome(false, expected, `«${title}» ya no está a la vista a los ${elapsed} ms de aparecer`, {
    note: 'El aviso se retiró antes de su plazo de 3 s, y la condición «mientras sigue a la vista» no se dio.',
    evidence,
  });
};

/** Espera hasta un instante del reloj de la página (el del aviso, medido desde que apareció). */
export const sleepUntilPage = async (page: Page, at: number): Promise<void> => {
  const now = (await pageNow(page)) ?? Date.now();
  const wait = at - now;
  if (wait > 0) await sleep(wait);
};

// --- Pantallas y menús (escritorio y ventana estrecha) -------------------------------------------------------------------------

export const onPrograms = (page: Page): boolean => pathOf(page) === '/programs';
export const onDocuments = (page: Page): boolean => pathOf(page) === '/documents';
export const onNc = (page: Page): boolean => pathOf(page) === '/nc';

/** Botón ⋯ de una fila (programa, documento o no conformidad): «Acciones para CODIGO». */
export const menuOf = (page: Page, code: string): Locator => page.getByRole('button', { name: `Acciones para ${code}`, exact: true });

/** Elemento de un menú de escritorio (`role="menu"`) con ese nombre. */
export const menuItemOf = (page: Page, code: string, item: string): Locator =>
  page.getByRole('menu', { name: `Acciones para ${code}`, exact: true }).getByRole('menuitem', { name: item, exact: true });

/** Botón de una hoja de acciones (ventana estrecha: `role="dialog"` con ese nombre). */
export const sheetItemOf = (page: Page, code: string, item: string): Locator =>
  page
    .getByRole('dialog', { name: `Acciones para ${code}`, exact: true })
    .getByRole('button', { name: item, exact: true })
    .or(page.getByRole('dialog', { name: `Acciones para ${code}`, exact: true }).getByRole('link', { name: item, exact: true }));

/** Abre el ⋯ de una fila y pulsa una de sus acciones. `sheet` si la ventana es estrecha. */
export const rowAction = (code: string, item: string, screen: (page: Page) => boolean, sheet = false): Act =>
  inOrder(
    clickAt((page) => menuOf(page, code), `abrir «Acciones para ${code}»`, screen),
    clickAt((page) => (sheet ? sheetItemOf(page, code, item) : menuItemOf(page, code, item)), `pulsar «${item}» en las acciones de ${code}`, screen),
  );

/** Pulsa «Cerrar» del aviso con ese título y tono (el botón con ese nombre dentro del aviso). */
export const closeToast = (title: string, tone: ToastTone = 'ok'): Act =>
  clickAt((page) => toastOf(page, tone, title).first().getByRole('button', { name: 'Cerrar', exact: true }), `pulsar «Cerrar» del aviso «${title}»`, onPrograms);

/** Enlace de la navegación lateral por su nombre o por su id de prueba (el de «No conformidades» trae además el contador de abiertas). */
export const sidebarLink = (page: Page, key: 'documents' | 'nc', name: RegExp): Locator => page.getByRole('link', { name }).or(page.getByTestId(PROGRAMAS_DYNAMIC_TESTIDS.NAV(key)));

/** Estado (insignia) de una fila de programa, tal como lo muestra la tabla de escritorio. */
export const badgeOf = (page: Page, code: string): Promise<string | undefined> =>
  textOf(page.getByTestId(PROGRAMAS_DYNAMIC_TESTIDS.PROGRAMS_ROW(code)).getByTestId(PROGRAMAS_TESTIDS.PROGRAMS_STATE_BADGE));

// --- Sesión y preparación ------------------------------------------------------------------------------------------------------

/** Abre /login?tenant=alumno01 con la cuenta y espera a la lista de programas (el registro de avisos se instala antes de cargar). */
export const signInWeb = (page: Page, viewport: Viewport, email: string, password: string): Promise<string | undefined> => {
  const steps: Step[] = [
    ['fijar la preferencia de cookies', () => page.context().addInitScript(fixCookiePreference)],
    ['instalar el registro de avisos', () => page.context().addInitScript(recordToasts, TOAST_KEY)],
    ['fijar el tamaño de la ventana', () => page.setViewportSize(viewport)],
    ['abrir /login?tenant=alumno01', () => page.goto(LOGIN_URL, { timeout: CEILING_MS })],
    ['escribir el correo', () => page.getByLabel('Correo electrónico', { exact: true }).fill(email, ACTION)],
    ['escribir la contraseña', () => page.getByLabel('Contraseña', { exact: true }).fill(password, ACTION)],
    ['pulsar «Entrar»', () => page.getByRole('button', { name: 'Entrar', exact: true }).click(ACTION)],
    ['llegar a /programs', () => page.waitForURL(/\/programs/, { timeout: CEILING_MS })],
    ['ver la lista de programas', () => menuOf(page, 'PRG-001').waitFor({ state: 'visible', timeout: CEILING_MS })],
  ];
  return runSteps(steps);
};

/** Llega a /documents desde la navegación lateral y espera a la lista. */
export const openDocumentsList = async (page: Page): Promise<string | undefined> =>
  runSteps([
    ['ir a «Documentos» desde la navegación', () => sidebarLink(page, 'documents', /^Documentos/).click(ACTION)],
    ['llegar a /documents', () => page.waitForURL(/\/documents/, { timeout: CEILING_MS })],
    ['ver la lista de documentos', () => menuOf(page, 'DOC-001').waitFor({ state: 'visible', timeout: CEILING_MS })],
  ]);

/** Llega a /nc desde la navegación lateral y espera al tablero. */
export const openNcBoard = async (page: Page): Promise<string | undefined> =>
  runSteps([
    ['ir a «No conformidades» desde la navegación', () => sidebarLink(page, 'nc', /^No conformidades/).click(ACTION)],
    ['llegar a /nc', () => page.waitForURL(/\/nc/, { timeout: CEILING_MS })],
    ['ver la tarjeta NC-001', () => menuOf(page, 'NC-001').waitFor({ state: 'visible', timeout: CEILING_MS })],
  ]);

// --- Caos, descargas y escuchas --------------------------------------------------------------------------------------------------

/** Fija la tasa de error de las escrituras del tenant (latencia 0). Devuelve el estado de la respuesta. */
export const setErrorRate = async (rate: number): Promise<number> => (await setChaos(TENANT_A, { latencyMs: 0, errorRate: rate, flakyLabels: false })).status;

/**
 * Apaga el caos al terminar la fila, también si la fila falla. Si el PATCH de apagado no responde 200, es un error del arnés (no una nota):
 * el caos seguiría activo para la fila siguiente.
 */
export const restoringChaos =
  (handler: BrowserRowHandler): BrowserRowHandler =>
  async (row, fixtures) => {
    const result = await handler(row, fixtures).then(
      (value) => ({ value }),
      (error: unknown) => ({ error }),
    );
    const restored = await setChaos(TENANT_A, NO_CHAOS);
    if (restored.status !== 200) throw new Error(`no se pudo apagar el caos al terminar la fila (PATCH /api/admin/chaos respondió ${restored.status})`);
    if ('error' in result) throw result.error;
    return result.value;
  };

/** Añade una salvedad a la nota de la fila. */
export const withNote =
  (handler: BrowserRowHandler, note: string): BrowserRowHandler =>
  async (row, fixtures) => {
    const result = await handler(row, fixtures);
    return { ...result, note: result.note === undefined ? note : `${result.note} ${note}` };
  };

/**
 * Escucha la descarga que dispara la acción (se arma antes del clic). Devuelve el nombre sugerido por el navegador, o `undefined` si no
 * llegó ninguna descarga en 5 s.
 */
export const watchDownload = (page: Page): Promise<string | undefined> =>
  page.waitForEvent('download', { timeout: 5_000 }).then(
    (download) => download.suggestedFilename(),
    () => undefined,
  );

/** Peticiones de escritura (POST, PUT, PATCH, DELETE) a la API desde que se instala el escucha. */
export const writesTo = (page: Page): { readonly writes: string[]; readonly stop: () => void } => {
  const writes: string[] = [];
  const listener = (request: PlaywrightRequest): void => {
    if (request.url().includes('/api/') && WRITE_METHODS.has(request.method())) writes.push(`${request.method()} ${new URL(request.url()).pathname}`);
  };
  page.on('request', listener);
  return { writes, stop: () => page.off('request', listener) };
};

/** Responde al cuadro `prompt()` del navegador con este texto; devuelve los tipos de diálogo que llegaron y el escucha para retirarlo. */
export const answerPrompt = (page: Page, text: string): { readonly kinds: string[]; readonly stop: () => void } => {
  const kinds: string[] = [];
  const listener = (dialog: Dialog): void => {
    kinds.push(dialog.type());
    void dialog.accept(text);
  };
  page.on('dialog', listener);
  return { kinds, stop: () => page.off('dialog', listener) };
};
