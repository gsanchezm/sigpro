import { adminCredentials, call, field, type ApiResult } from '../../../story-runs/support/api';
import { DEMO, TENANT_A, TENANT_B, resetTenants, startSession, type Credentials } from '../../../story-runs/support/prepare';
import { check, preparationFailedWeb, type Check } from '../../support/checks';
import { pending, type Outcome } from '../../core/framework';
import { verdictOf } from '../verdict';

// Piezas comunes de las filas de API de EP-AUDITORIA: cuentas por su correo en la celda, lectura del registro por páginas,
// instantánea antes y después de una operación (total, primer evento y ventana de tiempo) y el envío de formularios multipart.
// Las celdas se traducen con mapas estrictos (en cada spec): una celda desconocida LANZA. Lo observado sale de lo medido.

export { TENANT_A, TENANT_B, resetTenants };

/** Cuentas que aparecen en las celdas por su correo. `alumno01@sigpro.lab` es el administrador de su tenant (sin segundo factor). */
export const ACCOUNT_BY_CELL: ReadonlyMap<string, Credentials> = new Map<string, Credentials>([
  ['alumno01@sigpro.lab', adminCredentials(TENANT_A)],
  ['auditor@sigpro.test', DEMO.auditor],
  ['gestor@sigpro.test', DEMO.gestor],
  ['consultor@sigpro.test', DEMO.consultor],
]);

/** Evento del registro tal como lo devuelve `GET /api/audit` (`AuditEntryDto`). */
export interface AuditEvent {
  readonly id: string;
  readonly at: string;
  readonly actorId: string | null;
  readonly actorName: string | null;
  readonly action: string;
  readonly entity: string;
  readonly entityId: string;
  readonly diff: Readonly<Record<string, unknown>> | null;
}

/** Entero de una celda («20», «130»); cualquier otro texto LANZA (la celda no se ignora). */
export const intCell = (text: string): number => {
  if (!/^\d+$/.test(text.trim())) throw new Error(`celda sin interpretación: número «${text}»`);
  return Number(text.trim());
};

/** Eventos de una respuesta de `GET /api/audit`; `undefined` si el cuerpo no trae `items` como lista. */
export const itemsOf = (result: ApiResult): readonly AuditEvent[] | undefined => {
  const items = field(result.body, 'items');
  return Array.isArray(items) ? (items as readonly AuditEvent[]) : undefined;
};

/** `total` de una respuesta de la auditoría; `undefined` si no es un número. */
export const totalOf = (result: ApiResult): number | undefined => {
  const total = field(result.body, 'total');
  return typeof total === 'number' ? total : undefined;
};

/** `nextCursor` de una respuesta: texto, `null` o `undefined` si la respuesta no lo trae. */
export const nextCursorOf = (result: ApiResult): string | null | undefined => {
  const cursor = field(result.body, 'nextCursor');
  return typeof cursor === 'string' || cursor === null ? cursor : undefined;
};

/** Sesión de una cuenta en su tenant: el accessToken (o `undefined`) y la respuesta cruda del inicio de sesión. */
export interface Login {
  readonly token: string | undefined;
  readonly refreshToken: string | undefined;
  readonly result: ApiResult;
}

/** `POST /api/auth/login` con la cabecera del tenant. Iniciar sesión no deja evento en el registro. */
export const loginAs = async (tenant: string, credentials: Credentials): Promise<Login> => {
  const started = await startSession(tenant, credentials);
  return { token: started.session?.accessToken, refreshToken: started.session?.refreshToken, result: started.result };
};

/** `GET /api/audit` con el token dado; sin token no se manda cabecera Authorization. `query` va sin `?`. */
export const readAudit = (token: string | undefined, query?: string, tenant?: string): Promise<ApiResult> =>
  call('GET', '/audit', { token, ...(query ? { query } : {}), ...(tenant ? { tenant } : {}) });

/** Une partes de consulta no vacías con `&`. */
export const joinQuery = (...parts: readonly (string | undefined)[]): string => parts.filter((part): part is string => part !== undefined && part !== '').join('&');

/** Reinicia alumno01 (con el token de su administrador) e inicia sesión como `auditor@sigpro.test`: así parte la mayoría de filas. */
export const freshAuditor = async (): Promise<Login> => {
  await resetTenants([TENANT_A]);
  return loginAs(TENANT_A, DEMO.auditor);
};

/** Recorrido completo del registro con el cursor: cada página pide la misma consulta base más `cursor=<nextCursor>`. */
export interface Walk {
  /** Páginas pedidas con respuesta 200. */
  readonly pages: number;
  /** Todos los eventos recibidos, en el orden de llegada (con repetidos si los hay). */
  readonly received: readonly AuditEvent[];
  /** `total` que devolvió cada página. */
  readonly totals: readonly (number | undefined)[];
  /** Estado HTTP de cada petición. */
  readonly statuses: readonly number[];
  /** `true` si se llegó a `nextCursor: null` antes del límite de páginas. */
  readonly ended: boolean;
}

/** Pide páginas hasta que `nextCursor` es `null` (o hasta `maxPages`, o hasta un estado que no sea 200). */
export const walkAll = async (token: string, baseQuery: string, maxPages = 40): Promise<Walk> => {
  const received: AuditEvent[] = [];
  const totals: (number | undefined)[] = [];
  const statuses: number[] = [];
  let cursor: string | undefined;
  let ended = false;
  for (let page = 0; page < maxPages; page += 1) {
    const result = await readAudit(token, joinQuery(baseQuery, cursor === undefined ? undefined : `cursor=${encodeURIComponent(cursor)}`));
    statuses.push(result.status);
    if (result.status !== 200) break;
    totals.push(totalOf(result));
    received.push(...(itemsOf(result) ?? []));
    const next = nextCursorOf(result);
    if (next === null) {
      ended = true;
      break;
    }
    if (next === undefined) break;
    cursor = next;
  }
  return { pages: statuses.filter((status) => status === 200).length, received, totals, statuses, ended };
};

/** Estado del registro en un instante: lo necesario para decir qué cambió con una operación. */
export interface Snapshot {
  readonly status: number;
  readonly total: number | undefined;
  readonly first: AuditEvent | undefined;
  readonly ids: ReadonlySet<string>;
}

/** Total, primer evento y los ids de la primera página sin filtros, leídos con el token dado. */
export const snapshot = async (token: string): Promise<Snapshot> => {
  const result = await readAudit(token);
  const items = itemsOf(result) ?? [];
  return { status: result.status, total: totalOf(result), first: items[0], ids: new Set(items.map((item) => item.id)) };
};

/** Comprobación de la «línea base» de la semilla: 130 eventos y el primero es AL-130 (la fila parte de un tenant recién reiniciado). */
export const seedBaselineCheck = (base: Snapshot): Check =>
  check(base.status === 200 && base.total === 130 && base.first?.id === 'AL-130', 'registro recién reiniciado: total 130 y primero AL-130', `registro: respuesta ${base.status}, total ${String(base.total)}, primero ${base.first?.id ?? '(ninguno)'}`);

/** Lo que una operación de escritura deja en el registro: exactamente un evento nuevo, el primero, y con `at` dentro de su ventana. */
export const writeChecks = (before: Snapshot, after: Snapshot, window: { readonly startMs: number; readonly endMs: number }, accepted: boolean): { readonly checks: Check[]; readonly event: AuditEvent | undefined } => {
  const first = after.first;
  const at = first === undefined ? Number.NaN : Date.parse(first.at);
  const grew = before.total !== undefined && after.total !== undefined ? after.total - before.total : undefined;
  if (!accepted) {
    return {
      event: first,
      checks: [check(grew === 0 && first?.id === before.first?.id, 'ningún evento nuevo: el total no cambia y el primero sigue igual', `total ${String(before.total)} → ${String(after.total)}; primero ${first?.id ?? '(ninguno)'}`)],
    };
  }
  const inWindow = !Number.isNaN(at) && at >= window.startMs && at <= window.endMs;
  const fresh = first !== undefined && !before.ids.has(first.id);
  return {
    event: first,
    checks: [
      check(grew === 1, 'el total crece exactamente en 1 (un solo evento)', `el total pasa de ${String(before.total)} a ${String(after.total)} (${grew === undefined ? 'sin leer' : `+${grew}`})`),
      check(fresh, 'el primer evento es nuevo (no estaba en el registro antes)', fresh ? `primero ${first.id} es nuevo` : `primero ${first?.id ?? '(ninguno)'} ya estaba`),
      check(inWindow, 'el instante del evento cae dentro de la petición', inWindow ? 'dentro de la ventana de la petición' : `instante ${first?.at ?? '(ninguno)'} fuera de la ventana`),
    ],
  };
};

/** Respuesta multipart de una ejecución de prueba (`POST /api/test-cases/:code/runs`): los campos de texto, sin archivos. */
export const postForm = async (path: string, token: string, tenant: string, fields: Readonly<Record<string, string>>): Promise<ApiResult> => {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) form.append(key, value);
  const started = performance.now();
  const response = await fetch(`${process.env.E2E_API_URL ?? 'http://localhost:3000/api'}${path}`, {
    method: 'POST',
    headers: { 'x-tenant': tenant, authorization: `Bearer ${token}` },
    body: form,
  });
  const text = await response.text();
  let body: unknown = null;
  if (text.length > 0) {
    try {
      body = JSON.parse(text) as unknown;
    } catch {
      body = text;
    }
  }
  return { status: response.status, body, ms: Math.round(performance.now() - started) };
};

/** Una fila de escritura: quién actúa, qué envía, qué se espera de la respuesta y del evento que deja (si lo deja). */
export interface WriteSpec {
  /** Cuenta que envía la operación (`undefined` si no la envía nadie: el registro de una solicitud de acceso). */
  readonly actor: Credentials | undefined;
  /** Texto de lo que se espera de la fila (para la preparación fallida). */
  readonly expected: string;
  /** Envía la operación con el token del actor (si lo hay) y devuelve la respuesta cruda. */
  readonly send: (token: string | undefined) => Promise<ApiResult>;
  /** Comprobaciones de la respuesta (código HTTP y `code` si lo hay). */
  readonly responseChecks: (result: ApiResult) => readonly Check[];
  /** `true` si la operación se acepta y debe dejar exactamente un evento; `false` si se rechaza y no debe dejar ninguno. */
  readonly accepted: boolean;
  /** Comprobaciones del primer evento del registro (solo si `accepted`). Reciben `undefined` si no hay evento nuevo. */
  readonly eventChecks: (event: AuditEvent | undefined, result: ApiResult) => readonly Check[];
  /** Si la fila depende de una «Decisión pendiente» de la historia: su veredicto queda en “pendiente” con esta nota (las medidas se anotan). */
  readonly pendingNote?: string;
}

/**
 * Ejecuta una fila de escritura: reinicia alumno01, inicia sesión del actor y del auditor (quien lee el registro), comprueba la
 * base (130 eventos, primero AL-130), envía la operación midiendo su ventana y compara el registro antes y después. Lo que deja la
 * operación se mide siempre; la respuesta y el evento se comparan con lo que dice la historia.
 */
export const runWrite = async (spec: WriteSpec): Promise<Outcome> => {
  await resetTenants([TENANT_A]);
  let token: string | undefined;
  if (spec.actor !== undefined) {
    const login = await loginAs(TENANT_A, spec.actor);
    if (login.token === undefined) return preparationFailedWeb(spec.expected, `${spec.actor.email} inicia sesión en alumno01 (${String(login.result.status)})`);
    token = login.token;
  }
  const reader = await loginAs(TENANT_A, DEMO.auditor);
  if (reader.token === undefined) return preparationFailedWeb(spec.expected, `auditor@sigpro.test inicia sesión en alumno01 (${String(reader.result.status)})`);
  const before = await snapshot(reader.token);
  const base = seedBaselineCheck(before);
  if (!base.ok) return preparationFailedWeb(spec.expected, base.observed);
  const startMs = Date.now();
  const result = await spec.send(token);
  const endMs = Date.now();
  const after = await snapshot(reader.token);
  const written = writeChecks(before, after, { startMs, endMs }, spec.accepted);
  const eventChecks = spec.accepted ? spec.eventChecks(written.event, result) : [];
  const verdict = verdictOf([...spec.responseChecks(result), ...written.checks, ...eventChecks], {
    evidence: { respuesta: result.status, primero: written.event?.id ?? null, total: { antes: before.total ?? null, despues: after.total ?? null } },
  });
  return spec.pendingNote === undefined ? verdict : pending(verdict.expected, verdict.observed, spec.pendingNote, verdict.evidence);
};
