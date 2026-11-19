import { adminToken, call, field, type ApiResult } from '../../../story-runs/support/api';
import { DEMO, startSession, TENANT_A, TENANT_B, type Credentials } from '../../../story-runs/support/prepare';
import { outcome, type ManifestRow, type Outcome } from '../../core/framework';
import { check, errorsOf, responseCheck, strict, type Check } from '../../support/checks';

// Piezas comunes de las filas de API de EP-DOC-VERSIONES: cuentas del seed por correo, inicio de sesión, lectura de la ficha
// (versiones con su nota y su autor), publicación, comparación y el último registro de auditoría. Las celdas de texto se traducen
// con mapas estrictos en cada historia (un texto desconocido LANZA). Lo observado se lee de la API: nunca se toma de la historia.

/** Cuentas que citan las filas, por correo, con la contraseña del seed. `alumnoNN@sigpro.lab` solo existe en su tenant. */
export const CUENTAS: ReadonlyMap<string, Credentials> = new Map<string, Credentials>([
  ['alumno01@sigpro.lab', { email: 'alumno01@sigpro.lab', password: 'Alumno1234!' }],
  ['alumno02@sigpro.lab', { email: 'alumno02@sigpro.lab', password: 'Alumno1234!' }],
  ['gestor@sigpro.test', DEMO.gestor],
  ['consultor@sigpro.test', DEMO.consultor],
  ['auditor@sigpro.test', DEMO.auditor],
]);

/** Documentos que citan las filas (todos existen en el seed de cada tenant, salvo DOC-999, que no existe en ninguno). */
export const DOCUMENTOS: ReadonlyMap<string, string> = new Map<string, string>([
  ['DOC-001', 'DOC-001'],
  ['DOC-002', 'DOC-002'],
  ['DOC-003', 'DOC-003'],
  ['DOC-004', 'DOC-004'],
  ['DOC-999', 'DOC-999'],
]);

/** Cuenta de la celda → credenciales. Un correo que no está en el mapa LANZA. */
export const cuentaOf = (text: string): Credentials => strict('cuenta', CUENTAS, text);

/** Tenant en el que la cuenta inicia sesión: `alumno02@sigpro.lab` solo existe en `alumno02`; el resto, en `alumno01`. */
export const tenantDe = (account: Credentials): string => (account.email === 'alumno02@sigpro.lab' ? TENANT_B : TENANT_A);

/** Línea de texto de una publicación de prueba (la historia pide «una línea de texto» sin dar el texto). */
export const LINEA = 'Línea de prueba';

/** Lista de `n` líneas distintas («Línea 1» … «Línea n»), para los límites de la historia. */
export const lineas = (n: number): string[] => Array.from({ length: n }, (_, index) => `Línea ${index + 1}`);

/** Texto de `n` letras «a» seguidas, como dice la historia («(N letras a)»). */
export const letras = (n: number): string => 'a'.repeat(n);

/** Número entero de una celda («4», «3»…). Otra forma LANZA. */
export const intOf = (text: string): number => {
  const value = Number(text);
  if (!Number.isInteger(value)) throw new Error(`celda sin interpretación: número «${text}»`);
  return value;
};

/** Pasos «Entonces» y «Y» de la fila tal como están en el manifiesto: lo que la historia espera de la fila. */
export const thenOf = (row: ManifestRow): string => row.resolvedSteps.filter((step) => /^(Entonces|Y) /.test(step)).join('; ');

// --- Sesión ----------------------------------------------------------------------------------------------------------------------

export interface Login {
  /** Token de acceso, o `undefined` si el login no lo dio. */
  readonly token: string | undefined;
  /** Última respuesta del login (para la evidencia de la preparación). */
  readonly last: ApiResult;
}

/** Inicia sesión de la cuenta en su tenant con `POST /api/auth/login` y la cabecera `x-tenant`. */
export const loginAs = async (tenant: string, account: Credentials): Promise<Login> => {
  const started = await startSession(tenant, account);
  return { token: started.session?.accessToken, last: started.result };
};

// --- Ficha de un documento -------------------------------------------------------------------------------------------------------

/** Una entrada del historial de la ficha: número, nota guardada, autor y momento. */
export interface VersionEntry {
  readonly version: number;
  readonly note: string;
  readonly authorName: string | null;
  readonly createdAt: string;
}

/** Lectura de una ficha: versión vigente y historial. `undefined` = no legible (nunca cuenta como cumplido). */
export interface DocumentState {
  readonly version: number | undefined;
  readonly versions: readonly VersionEntry[] | undefined;
  readonly result: ApiResult;
}

const entryOf = (value: unknown): VersionEntry | undefined => {
  const version = field(value, 'version');
  const note = field(value, 'note');
  const authorName = field(value, 'authorName');
  const createdAt = field(value, 'createdAt');
  if (typeof version !== 'number' || typeof note !== 'string' || typeof createdAt !== 'string') return undefined;
  return { version, note, authorName: typeof authorName === 'string' ? authorName : null, createdAt };
};

const entriesOf = (value: unknown): readonly VersionEntry[] | undefined => {
  if (!Array.isArray(value)) return undefined;
  const list: readonly unknown[] = value;
  const out: VersionEntry[] = [];
  for (const item of list) {
    const entry = entryOf(item);
    if (entry === undefined) return undefined;
    out.push(entry);
  }
  return out;
};

/** `GET /api/documents/:id` con la cuenta y su tenant. */
export const documentOf = async (tenant: string, token: string, id: string): Promise<DocumentState> => {
  const result = await call('GET', `/documents/${id}`, { tenant, token });
  const version = field(result.body, 'version');
  return { version: typeof version === 'number' ? version : undefined, versions: entriesOf(field(result.body, 'versions')), result };
};

/** La entrada del historial con ese número, o `undefined` si no está o no es legible. */
export const entryNamed = (versions: readonly VersionEntry[] | undefined, n: number): VersionEntry | undefined => versions?.find((entry) => entry.version === n);

/** `POST /api/documents/:id/versions` con el cuerpo dado (tal cual: la fila decide si lleva campos). */
export const publish = (tenant: string, token: string, id: string, body: unknown): Promise<ApiResult> => call('POST', `/documents/${id}/versions`, { tenant, token, body });

/** `GET /api/documents/:id/compare` con la cadena de consulta dada (sin `?`). */
export const compare = (tenant: string, token: string, id: string, query: string): Promise<ApiResult> => call('GET', `/documents/${id}/compare`, { tenant, token, query });

// --- Auditoría -------------------------------------------------------------------------------------------------------------------

/** Lo que dice el evento más reciente de publicación de versiones del tenant. */
export interface PublishEvent {
  readonly action: string | undefined;
  readonly entityId: string | undefined;
  readonly version: number | undefined;
}

/**
 * Evento más reciente `document.version_published` del tenant, leído con el administrador (`GET /api/audit`, permiso `audit.view`).
 * `undefined` en un campo = no legible.
 */
export const lastPublishEvent = async (tenant: string): Promise<{ readonly event: PublishEvent; readonly result: ApiResult }> => {
  const token = await adminToken(tenant);
  const result = await call('GET', '/audit', { tenant, token, query: 'entity=document&q=document.version_published&limit=1' });
  const items = field(result.body, 'items');
  const first: unknown = Array.isArray(items) ? items[0] : undefined;
  const action = field(first, 'action');
  const entityId = field(first, 'entityId');
  const version = field(field(first, 'diff'), 'version');
  return {
    event: {
      action: typeof action === 'string' ? action : undefined,
      entityId: typeof entityId === 'string' ? entityId : undefined,
      version: typeof version === 'number' ? version : undefined,
    },
    result,
  };
};

/** El registro más reciente es la publicación de la fila: `document.version_published` sobre el documento, con la versión nueva. */
export const auditCheck = (event: PublishEvent, doc: string, version: number): Check =>
  check(
    event.action === 'document.version_published' && event.entityId === doc && event.version === version,
    `la auditoría registra document.version_published sobre ${doc} con la versión ${version}`,
    `la auditoría más reciente de publicación es ${String(event.action)} sobre ${String(event.entityId)} con la versión ${String(event.version)}`,
  );

// --- Respuestas y comprobaciones -------------------------------------------------------------------------------------------------

export interface Stats {
  readonly added: number;
  readonly removed: number;
  readonly changed: number;
  readonly same: number;
}

/** Lo que la historia espera de una respuesta: estado, `code` y los datos que cita la fila (versión, motivo, estadísticas…). */
export interface Expected {
  readonly status: number;
  readonly code?: string;
  /** Campo `version` del cuerpo (la ficha tras publicar). */
  readonly version?: number;
  /** Motivo que debe traer `errors` en la clave `clave`. */
  readonly motivo?: string;
  readonly clave?: string;
  readonly stats?: Stats;
  readonly from?: number;
  readonly to?: number;
}

const statsText = (stats: Stats): string => `added ${stats.added}, removed ${stats.removed}, changed ${stats.changed}, same ${stats.same}`;

const numberField = (value: unknown, key: string): number | undefined => {
  const found = field(value, key);
  return typeof found === 'number' ? found : undefined;
};

/** Estadísticas del cuerpo de un `compare`; `undefined` si alguna no es legible. */
export const statsOf = (body: unknown): Stats | undefined => {
  const raw = field(body, 'stats');
  const added = numberField(raw, 'added');
  const removed = numberField(raw, 'removed');
  const changed = numberField(raw, 'changed');
  const same = numberField(raw, 'same');
  if (added === undefined || removed === undefined || changed === undefined || same === undefined) return undefined;
  return { added, removed, changed, same };
};

/** Comprobación de estadísticas: los cuatro contadores iguales a los de la historia. */
export const statsCheck = (body: unknown, expected: Stats): Check => {
  const observed = statsOf(body);
  const same = observed !== undefined && observed.added === expected.added && observed.removed === expected.removed && observed.changed === expected.changed && observed.same === expected.same;
  return check(same, `stats ${statsText(expected)}`, `stats ${observed === undefined ? '(sin leer)' : statsText(observed)}`);
};

/** Comprobaciones de una respuesta frente a lo que la historia espera (estado, código y datos citados por la fila). */
export const responseChecks = (result: ApiResult, expected: Expected): Check[] => {
  const checks: Check[] = [responseCheck(result, { status: expected.status, ...(expected.code === undefined ? {} : { code: expected.code }) })];
  if (expected.version !== undefined) {
    const observed = field(result.body, 'version');
    checks.push(check(observed === expected.version, `la ficha trae version ${expected.version}`, `la ficha trae version ${String(observed)}`));
  }
  if (expected.clave !== undefined && expected.motivo !== undefined) {
    const reason = errorsOf(result)[expected.clave];
    checks.push(check(reason === expected.motivo, `motivo ${expected.motivo} en la clave ${expected.clave}`, `motivo ${reason === undefined ? '(sin motivo)' : String(reason)} en la clave ${expected.clave}`));
  }
  if (expected.from !== undefined) {
    const observed = field(result.body, 'from');
    checks.push(check(observed === expected.from, `from ${expected.from}`, `from ${String(observed)}`));
  }
  if (expected.to !== undefined) {
    const observed = field(result.body, 'to');
    checks.push(check(observed === expected.to, `to ${expected.to}`, `to ${String(observed)}`));
  }
  if (expected.stats !== undefined) checks.push(statsCheck(result.body, expected.stats));
  return checks;
};

/** Un «motivo de campo» que la fila pide sin nombrar el texto (solo que exista): la clave debe traer un motivo no vacío. */
export const reasonPresent = (result: ApiResult, key: string): Check => {
  const reason = errorsOf(result)[key];
  const present = typeof reason === 'string' && reason !== '';
  return check(present, `un motivo en la clave ${key}`, present ? `un motivo en la clave ${key}: ${String(reason)}` : `sin motivo en la clave ${key} (errors: ${JSON.stringify(errorsOf(result))})`);
};

/** Resultado de una fila: `coincide` si todas las comprobaciones se cumplen; si no, la nota dice en qué difiere. */
export const finish = (checks: readonly Check[], extra: { readonly note?: string; readonly evidence?: Readonly<Record<string, unknown>> } = {}): Outcome => {
  const differences = checks.filter((entry) => !entry.ok).map((entry) => `«${entry.expected}» no se cumple (${entry.observed})`);
  const note = extra.note ?? (differences.length === 0 ? undefined : `Difiere en: ${differences.join('; ')}`);
  return outcome(differences.length === 0, checks.map((entry) => entry.expected).join('; '), checks.map((entry) => entry.observed).join('; '), {
    ...(note === undefined ? {} : { note }),
    ...(extra.evidence === undefined ? {} : { evidence: extra.evidence }),
  });
};

// --- Comparación: filas del diff ---------------------------------------------------------------------------------------------------

/** Una línea de una fila del diff: número (desde 1) y texto. */
export interface LineRef {
  readonly line: number;
  readonly text: string;
}

/** Celda de la historia: «línea N «texto»» o «(ninguna)» (la columna no tiene línea). Otra forma LANZA. */
export const lineOf = (text: string): LineRef | null => {
  if (text === '(ninguna)') return null;
  const match = /^línea (\d+) «(.*)»$/.exec(text);
  if (!match?.[1] || match[2] === undefined) throw new Error(`celda sin interpretación: línea «${text}»`);
  return { line: Number(match[1]), text: match[2] };
};

/** Lectura de un lado de una fila del diff: `null` (sin línea), la línea, o `undefined` (no legible). */
const sideOf = (value: unknown): LineRef | null | undefined => {
  if (value === null) return null;
  const line = numberField(value, 'line');
  const text = field(value, 'text');
  return line !== undefined && typeof text === 'string' ? { line, text } : undefined;
};

const describeSide = (side: LineRef | null | undefined): string => (side === undefined ? '(sin leer)' : side === null ? '(ninguna)' : `línea ${side.line} «${side.text}»`);

/** Comprobación de un lado de la fila: mismo número de línea y mismo texto, o «ninguna» en los dos. */
export const sideCheck = (label: string, observed: LineRef | null | undefined, expected: LineRef | null): Check => {
  const same =
    expected === null ? observed === null : observed !== undefined && observed !== null && observed.line === expected.line && observed.text === expected.text;
  return check(same, `${label} ${describeSide(expected)}`, `${label} ${describeSide(observed)}`);
};

/** Filas del diff de una respuesta de `compare` (vacía si no es una lista). */
export const rowsOf = (body: unknown): readonly unknown[] => {
  const rows = field(body, 'rows');
  return Array.isArray(rows) ? rows : [];
};

/** La fila del diff en la posición dada (1 = primera), con su tipo y sus dos lados. */
export interface DiffRowRead {
  readonly kind: string | undefined;
  readonly left: LineRef | null | undefined;
  readonly right: LineRef | null | undefined;
}

export const diffRowAt = (body: unknown, position: number): DiffRowRead | undefined => {
  const row: unknown = rowsOf(body)[position - 1];
  if (row === undefined) return undefined;
  const kind = field(row, 'kind');
  return { kind: typeof kind === 'string' ? kind : undefined, left: sideOf(field(row, 'left')), right: sideOf(field(row, 'right')) };
};

/** Versión de un documento leída con el token de la cuenta, o la respuesta cruda si no se pudo leer (para `preparationFailed`). */
export const versionMismatch = (doc: string, expected: number, state: DocumentState): string | undefined =>
  state.version === expected ? undefined : `${doc} está en la versión ${expected} (la lectura da ${state.version === undefined ? '(sin leer)' : String(state.version)})`;

/** Listas de texto de una celda entre «…» (p. ej. «Versión inicial» y «Ajuste de alcance»…): en el orden de la celda. */
export const quotedList = (text: string): readonly string[] => Array.from(text.matchAll(/«([^»]*)»/g), (match) => match[1] ?? '');
