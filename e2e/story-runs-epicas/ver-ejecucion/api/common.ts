import { API_URL, call, errorCode, field, type ApiResult } from '../../../story-runs/support/api';
import { DEMO, TENANT_A, TENANT_B, startSession, type Credentials } from '../../../story-runs/support/prepare';
import { check, conclude, type Check } from '../../support/checks';
import type { Outcome } from '../../core/framework';
import { copyOf, type Upload } from './files';

// Piezas comunes de las filas de API de EP-VER-EJECUCION: cuentas con su sesión, envío de la ejecución como multipart (con su
// tenant y sus cabeceras a medida), lectura cruda de una evidencia (bytes y cabeceras), lectura del caso y de la auditoría, y las
// comprobaciones de una respuesta frente a lo que la historia dice. Lo observado sale de lo medido, nunca de un texto fijo. Si la
// conexión falla (p. ej. la subida de 5 MB se corta), la respuesta queda como observación (estado 0), no como error del arnés.

export { TENANT_A, TENANT_B } from '../../../story-runs/support/prepare';
export { call, field, errorCode, type ApiResult };

/** Cuenta de una celda: el tenant en el que inicia sesión y sus credenciales del seed. */
export interface Account {
  readonly tenant: string;
  readonly credentials: Credentials;
}

const ALUMNO01: Credentials = { email: 'alumno01@sigpro.lab', password: 'Alumno1234!' };
const ALUMNO02: Credentials = { email: 'alumno02@sigpro.lab', password: 'Alumno1234!' };

/** Correo de la celda → cuenta. Cualquier otro correo LANZA al usarse con `strict`. */
export const ACCOUNT_OF: ReadonlyMap<string, Account> = new Map<string, Account>([
  ['gestor@sigpro.test', { tenant: TENANT_A, credentials: DEMO.gestor }],
  ['consultor@sigpro.test', { tenant: TENANT_A, credentials: DEMO.consultor }],
  ['auditor@sigpro.test', { tenant: TENANT_A, credentials: DEMO.auditor }],
  ['alumno01@sigpro.lab', { tenant: TENANT_A, credentials: ALUMNO01 }],
  ['alumno02@sigpro.lab', { tenant: TENANT_B, credentials: ALUMNO02 }],
]);

/** Sesión de una cuenta: su access token (o `undefined` si el login no lo dio) y la última respuesta para explicar un fallo. */
export interface Session {
  readonly token: string | undefined;
  readonly last: ApiResult;
}

/** Inicia sesión con la cuenta y la cabecera `x-tenant` de su tenant. */
export const loginAs = async (account: Account): Promise<Session> => {
  const started = await startSession(account.tenant, account.credentials);
  return { token: started.session?.accessToken, last: started.result };
};

/** Cabecera `Authorization` de un token (vacía si no hay token). */
export const bearer = (token: string | undefined): Record<string, string> => (token === undefined ? {} : { authorization: `Bearer ${token}` });

/** Petición JSON a la API con el token dado (o sin él) y el tenant indicado. */
export const act = (method: 'GET' | 'POST' | 'PATCH' | 'DELETE', path: string, token: string | undefined, tenant: string = TENANT_A, body?: unknown): Promise<ApiResult> =>
  call(method, path, { tenant, ...(token === undefined ? {} : { token }), ...(body === undefined ? {} : { body }) });

/** Lectura de un cuerpo: JSON si lo es, texto si no, `null` si está vacío. */
const parseBody = (text: string): unknown => {
  if (text.length === 0) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
};

/** Motivo de un fallo de transporte (la conexión se corta o no responde): se observa como estado 0. */
const transportFailure = (error: unknown): { readonly status: 0; readonly body: unknown } => ({
  status: 0,
  body: { transporte: error instanceof Error ? error.message.split('\n')[0] ?? 'error' : String(error) },
});

// --- Envío de una ejecución (multipart) ---------------------------------------------------------------------------------------

/** Campos de texto de la ejecución: solo los que la fila envía (un campo ausente no va en la petición). */
export interface RunFields {
  readonly result?: string;
  readonly notes?: string;
}

export interface RunRequest {
  readonly tenant: string;
  readonly code: string;
  readonly fields: RunFields;
  readonly files?: readonly Upload[];
  /** Cabeceras de autorización: `bearer(token)`, una cabecera a medida (texto que no es un token) o ninguna. */
  readonly headers: Readonly<Record<string, string>>;
}

/** `POST /api/test-cases/:code/runs` como `multipart/form-data`. El tipo lo pone `FormData`; no se fija a mano. */
export const sendRun = async (request: RunRequest): Promise<ApiResult> => {
  const form = new FormData();
  if (request.fields.result !== undefined) form.append('result', request.fields.result);
  if (request.fields.notes !== undefined) form.append('notes', request.fields.notes);
  for (const file of request.files ?? []) form.append('files', new Blob([copyOf(file.bytes)], { type: file.type }), file.name);
  const started = performance.now();
  try {
    const response = await fetch(`${API_URL}/test-cases/${request.code}/runs`, { method: 'POST', headers: { 'x-tenant': request.tenant, ...request.headers }, body: form });
    const text = await response.text();
    return { status: response.status, body: parseBody(text), ms: Math.round(performance.now() - started) };
  } catch (error) {
    return { ...transportFailure(error), ms: Math.round(performance.now() - started) };
  }
};

// --- Lecturas crudas (evidencias: bytes y cabeceras) ---------------------------------------------------------------------------

/** Respuesta cruda: estado, cabeceras, bytes y cuerpo interpretado (JSON o texto). */
export interface Fetched {
  readonly status: number;
  readonly headers: Headers | undefined;
  readonly bytes: Buffer;
  readonly body: unknown;
}

/** `GET` sin interpretar el cuerpo como texto (las evidencias son binarias). */
export const getRaw = async (path: string, tenant: string, headers: Readonly<Record<string, string>>): Promise<Fetched> => {
  try {
    const response = await fetch(`${API_URL}${path}`, { headers: { 'x-tenant': tenant, ...headers } });
    const bytes = Buffer.from(await response.arrayBuffer());
    return { status: response.status, headers: response.headers, bytes, body: parseBody(bytes.toString('utf8')) };
  } catch (error) {
    return { status: 0, headers: undefined, bytes: Buffer.alloc(0), body: transportFailure(error).body };
  }
};

/** Tipo y nombres de una cabecera `Content-Disposition`: el parámetro `filename` (ASCII, entre comillas) y `filename*` (UTF-8). */
export const dispositionOf = (header: string | null | undefined): { readonly type: string | undefined; readonly plain: string | undefined; readonly encoded: string | undefined } => {
  if (header === null || header === undefined) return { type: undefined, plain: undefined, encoded: undefined };
  const type = (header.split(';')[0] ?? '').trim();
  const star = /filename\*=UTF-8''([^;]+)/i.exec(header);
  const plain = /filename="([^"]*)"/i.exec(header);
  const encoded = star?.[1];
  return { type, plain: plain?.[1], encoded: encoded === undefined ? undefined : decodeURIComponent(encoded) };
};

/** Comprobaciones de `Content-Disposition`: tipo `inline` y el nombre en `filename` Y en `filename*` (Regla 004:19). */
export const dispositionChecks = (header: string | null | undefined, name: string): Check[] => {
  const parts = dispositionOf(header);
  return [
    check(parts.type === 'inline', 'Content-Disposition inline', `Content-Disposition ${parts.type ?? '(sin cabecera)'}`),
    check(parts.plain === name, `filename ${name}`, `filename ${parts.plain ?? '(ausente)'}`),
    check(parts.encoded === name, `filename* ${name}`, `filename* ${parts.encoded ?? '(ausente)'}`),
  ];
};

/** Dimensiones de un PNG leídas de su cabecera IHDR (`undefined` si no empieza por la firma PNG ni trae IHDR). */
export const pngDimensions = (bytes: Buffer): { readonly width: number; readonly height: number } | undefined => {
  if (bytes.length < 24 || !bytes.subarray(12, 16).equals(Buffer.from('IHDR', 'ascii'))) return undefined;
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
};

/** ¿Termina el PNG con el fragmento IEND (4 bytes de longitud 0, «IEND» y su CRC)? Un archivo truncado no lo tiene. */
export const endsWithIend = (bytes: Buffer): boolean => bytes.length >= 12 && bytes.subarray(bytes.length - 12).equals(Buffer.from('0000000049454e44ae426082', 'hex'));

// --- Expectativas de una respuesta ----------------------------------------------------------------------------------------------

/** Una evidencia que la respuesta debe traer, en su posición: `id` siempre; lo demás solo si la historia lo dice. */
export interface EvidenceExpect {
  readonly id: string;
  readonly filename?: string;
  readonly mimeType?: string;
  readonly size?: number;
}

/** Lo que la historia dice de una respuesta: estado, `code`, campos del cuerpo, motivos por campo y, en una ejecución creada, su caso, su id y sus evidencias. */
export interface Expect {
  readonly status: number;
  /** `code` de error del cuerpo. */
  readonly code?: string;
  /** Respuesta sin `code` ni `errors` (p. ej. los 413 y 400 de la subida, que solo traen `message`). */
  readonly bare?: boolean;
  /** Campos del cuerpo que deben valer exactamente esto (comparación JSON). */
  readonly fields?: Readonly<Record<string, unknown>>;
  /** Motivos por campo (`errors`): cada clave debe tener exactamente este motivo. */
  readonly errors?: Readonly<Record<string, string>>;
  /** Caso de la ejecución creada (`testCaseCode`). */
  readonly caso?: string;
  /** Id de la ejecución creada (`id`). */
  readonly runId?: string;
  /** Evidencias de la ejecución creada, en orden; `[]` = sin evidencias. */
  readonly evidencias?: readonly EvidenceExpect[];
}

/** Lo que vuelve de una petición: estado y cuerpo (vale para la respuesta JSON y para la cruda). */
export type Answer = Pick<ApiResult, 'status' | 'body'>;

/** Código de error (`code`) del cuerpo de una respuesta, si lo trae (funciona con la respuesta cruda también). */
const codeOf = (answer: Answer): string | undefined => {
  const code = field(answer.body, 'code');
  return typeof code === 'string' ? code : undefined;
};

/** Valor de un campo para un mensaje: JSON o «(ausente)». */
export const show = (value: unknown): string => (value === undefined ? '(ausente)' : JSON.stringify(value));

/** Evidencias de una ejecución (`evidences`), o `undefined` si el cuerpo no las trae. */
export const evidencesOf = (body: unknown): readonly Record<string, unknown>[] | undefined => {
  const list = field(body, 'evidences');
  return Array.isArray(list) ? (list as Record<string, unknown>[]) : undefined;
};

/** Comprobaciones de una respuesta frente a su expectativa. Lo observado sale de lo medido. */
export const expectChecks = (expect: Expect, answer: Answer): Check[] => {
  const body = answer.body;
  const checks: Check[] = [check(answer.status === expect.status, `respuesta ${expect.status}`, `respuesta ${answer.status}`)];
  if (expect.code !== undefined) checks.push(check(codeOf(answer) === expect.code, `código ${expect.code}`, `código ${codeOf(answer) ?? '(sin código)'}`));
  if (expect.bare === true) {
    const trails = field(body, 'code') !== undefined || field(body, 'errors') !== undefined;
    checks.push(check(!trails, 'sin code ni errors', trails ? `con code ${show(field(body, 'code'))} o errors ${show(field(body, 'errors'))}` : 'sin code ni errors'));
  }
  for (const [key, value] of Object.entries(expect.fields ?? {})) {
    const observed = field(body, key);
    checks.push(check(JSON.stringify(observed) === JSON.stringify(value), `${key} ${JSON.stringify(value)}`, `${key} ${show(observed)}`));
  }
  const errors = field(body, 'errors');
  const motives: Record<string, unknown> = typeof errors === 'object' && errors !== null ? (errors as Record<string, unknown>) : {};
  for (const [key, value] of Object.entries(expect.errors ?? {})) {
    const observed = motives[key];
    checks.push(check(observed === value, `errors.${key} igual a ${value}`, `errors.${key} ${observed === undefined ? '(sin motivo)' : String(observed)}`));
  }
  if (expect.caso !== undefined) checks.push(check(field(body, 'testCaseCode') === expect.caso, `caso ${expect.caso}`, `caso ${show(field(body, 'testCaseCode'))}`));
  if (expect.runId !== undefined) checks.push(check(field(body, 'id') === expect.runId, `ejecución ${expect.runId}`, `ejecución ${show(field(body, 'id'))}`));
  if (expect.evidencias !== undefined) {
    const list = evidencesOf(body);
    const ids = (list ?? []).map((item) => String(field(item, 'id'))).join(', ');
    checks.push(check(list !== undefined && list.length === expect.evidencias.length, `${expect.evidencias.length} evidencia(s)`, `${list?.length ?? 0} evidencia(s)${ids === '' ? '' : ` (${ids})`}`));
    expect.evidencias.forEach((wanted, index) => {
      const item = list?.[index];
      checks.push(check(field(item, 'id') === wanted.id, `evidencia ${index + 1} con id ${wanted.id}`, `evidencia ${index + 1} con id ${show(field(item, 'id'))}`));
      if (wanted.filename !== undefined) checks.push(check(field(item, 'filename') === wanted.filename, `evidencia ${wanted.id} con nombre ${wanted.filename}`, `evidencia ${wanted.id} con nombre ${show(field(item, 'filename'))}`));
      if (wanted.mimeType !== undefined) checks.push(check(field(item, 'mimeType') === wanted.mimeType, `evidencia ${wanted.id} con tipo ${wanted.mimeType}`, `evidencia ${wanted.id} con tipo ${show(field(item, 'mimeType'))}`));
      if (wanted.size !== undefined) checks.push(check(field(item, 'size') === wanted.size, `evidencia ${wanted.id} de ${wanted.size} bytes`, `evidencia ${wanted.id} de ${show(field(item, 'size'))} bytes`));
    });
  }
  return checks;
};

/** Veredicto de una fila: coincide si todas las comprobaciones se cumplen. Si no, la nota dice en qué difiere (derivada de lo medido). */
export const verdict = (checks: readonly Check[], extraNote?: string): Outcome => {
  const failed = checks.filter((entry) => !entry.ok).map((entry) => entry.observed);
  const parts = [failed.length === 0 ? undefined : `difiere en: ${failed.join('; ')}`, extraNote].filter((part): part is string => part !== undefined);
  return conclude(checks, parts.length === 0 ? {} : { note: parts.join('. ') });
};

// --- Lecturas del caso y de la auditoría ----------------------------------------------------------------------------------------

/** `GET /api/test-cases/:code` con el token dado. */
export const caseOf = (token: string, code = 'TC-001'): Promise<ApiResult> => act('GET', `/test-cases/${code}`, token);

/** Número de ejecuciones del caso según la lectura (`undefined` si no se puede leer). */
export const runCountOf = (result: ApiResult): number | undefined => {
  const count = field(result.body, 'runCount');
  return result.status === 200 && typeof count === 'number' ? count : undefined;
};

/** Ids de las ejecuciones del caso, del más reciente al más antiguo (como las devuelve la API). */
export const runIdsOf = (result: ApiResult): readonly string[] => {
  const runs = field(result.body, 'runs');
  return Array.isArray(runs) ? runs.map((run) => String(field(run, 'id'))) : [];
};

/** Ejecuciones del caso con su campo `notes` y `result`, por id, para comparar antes y después. */
export const runsById = (result: ApiResult): ReadonlyMap<string, Record<string, unknown>> => {
  const runs = field(result.body, 'runs');
  return new Map((Array.isArray(runs) ? (runs as Record<string, unknown>[]) : []).map((run) => [String(field(run, 'id')), run]));
};

/** Auditoría leída con un administrador: total de eventos del filtro y sus elementos. `undefined` si no responde 200. */
export interface AuditSnapshot {
  readonly total: number;
  readonly items: readonly Record<string, unknown>[];
}

export const auditOf = async (token: string, query: string): Promise<AuditSnapshot | undefined> => {
  const listed = await act('GET', `/audit?${query}`, token);
  const total = field(listed.body, 'total');
  const items = field(listed.body, 'items');
  if (listed.status !== 200 || typeof total !== 'number' || !Array.isArray(items)) return undefined;
  return { total, items: items as Record<string, unknown>[] };
};

/** Eventos `testrun.executed` sobre una ejecución concreta dentro de una lectura de auditoría. */
export const executedEventsFor = (snapshot: AuditSnapshot, runId: string): number =>
  snapshot.items.filter((item) => field(item, 'action') === 'testrun.executed' && field(item, 'entityId') === runId).length;
