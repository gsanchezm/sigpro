import { API_URL, adminToken, call, field, type ApiResult } from '../../../story-runs/support/api';
import { DEMO, TENANT_A, startSession, type Credentials } from '../../../story-runs/support/prepare';
import type { ManifestRow, Outcome } from '../../core/framework';
import { check, conclude, type Check } from '../../support/checks';

// Piezas comunes de las filas de API de EP-DOC-RESTRINGIDOS: reinicio de alumno01, sesión de cada cuenta de la historia (el admin
// pasa por el segundo factor con 123456), lectura cruda (cabeceras y bytes) para las descargas, texto del PDF y comprobaciones de
// la respuesta. Todas las peticiones llevan `x-tenant: alumno01`. Las celdas se traducen con mapas estrictos en cada historia: un
// texto desconocido LANZA. Un fallo de lectura (`undefined`) nunca cuenta como cumplido.

export { TENANT_A };

/**
 * Reinicia alumno01 con el token de su administrador (`POST /api/admin/reset`). La cabecera `x-tenant` va igual que en el resto de
 * peticiones (la API usa el tenant del token). Lanza si el reinicio no responde 2xx: sin estado inicial no hay fila.
 */
export const resetAlumno = async (): Promise<void> => {
  const token = await adminToken(TENANT_A);
  const result = await call('POST', '/admin/reset', { tenant: TENANT_A, token });
  if (result.status < 200 || result.status > 299) throw new Error(`El reinicio de alumno01 respondió ${result.status}: ${JSON.stringify(result.body)}`);
};

/** Cuentas que ven los restringidos (admin, gestor de programa y auditor) frente al consultor, que no los ve. */
export const RESTRICTED: readonly string[] = ['DOC-003', 'DOC-006', 'DOC-009', 'DOC-012'];
/** Los doce documentos del tenant, en orden ascendente por código. */
export const ALL_DOCUMENTS: readonly string[] = Array.from({ length: 12 }, (_, index) => `DOC-${String(index + 1).padStart(3, '0')}`);
/** Los documentos que ve el consultor: los doce menos los restringidos. */
export const PUBLIC_DOCUMENTS: readonly string[] = ALL_DOCUMENTS.filter((code) => !RESTRICTED.includes(code));
/** Documentos que ve una cuenta: los doce para admin, gestor y auditor; los públicos para el consultor. */
export const visibleFor = (account: AccountKey): readonly string[] => (account === 'consultor' ? PUBLIC_DOCUMENTS : ALL_DOCUMENTS);

/** Código del segundo factor del seed (el de `admin@sigpro.test`). */
export const MFA_CODE = '123456';

/** Cuentas de la historia, por la clave con la que las nombra el manejador. */
export type AccountKey = 'admin' | 'gestor' | 'auditor' | 'consultor';

const CREDENTIALS: Readonly<Record<AccountKey, Credentials>> = {
  admin: DEMO.admin,
  gestor: DEMO.gestor,
  auditor: DEMO.auditor,
  consultor: DEMO.consultor,
};

/** Correo de la celda de cuenta → clave de la cuenta. Cualquier otro correo LANZA (lo resuelve `strict` en cada historia). */
export const CUENTA: ReadonlyMap<string, AccountKey> = new Map<string, AccountKey>([
  ['admin@sigpro.test', 'admin'],
  ['gestor@sigpro.test', 'gestor'],
  ['auditor@sigpro.test', 'auditor'],
  ['consultor@sigpro.test', 'consultor'],
]);

/** Sesión de una cuenta: su access token (o `undefined` si el inicio de sesión no lo dio) y la última respuesta. */
export interface SessionOf {
  readonly token: string | undefined;
  readonly last: ApiResult;
}

/**
 * Inicia sesión en alumno01 con la cuenta de demostración. Gestor, auditor y consultor entran con su contraseña; admin completa el
 * segundo factor (`POST /api/auth/mfa` con `mfaToken` y 123456) y usa el access token que recibe.
 */
export const sessionFor = async (account: AccountKey): Promise<SessionOf> => {
  const started = await startSession(TENANT_A, CREDENTIALS[account]);
  if (account !== 'admin') return { token: started.session?.accessToken, last: started.result };
  const mfaToken = field(started.result.body, 'mfaToken');
  if (typeof mfaToken !== 'string') return { token: undefined, last: started.result };
  const redeemed = await call('POST', '/auth/mfa', { tenant: TENANT_A, body: { mfaToken, code: MFA_CODE } });
  const accessToken = field(redeemed.body, 'accessToken');
  return { token: typeof accessToken === 'string' ? accessToken : undefined, last: redeemed };
};

/** Respuesta cruda de una petición GET: estado, cabeceras relevantes y bytes (sirve para JSON, PDF y respuestas vacías). */
export interface RawResponse {
  readonly status: number;
  readonly contentType: string;
  readonly disposition: string;
  readonly bytes: Buffer;
}

/** `GET` crudo a la API de alumno01 con el token dado (sin cabecera de autorización si no hay token). */
export const rawGet = async (path: string, token: string | undefined, query?: string): Promise<RawResponse> => {
  const headers: Record<string, string> = {
    'x-tenant': TENANT_A,
    ...(token === undefined ? {} : { authorization: `Bearer ${token}` }),
  };
  const response = await fetch(`${API_URL}${path}${query ? `?${query}` : ''}`, { headers });
  return {
    status: response.status,
    contentType: response.headers.get('content-type') ?? '',
    disposition: response.headers.get('content-disposition') ?? '',
    bytes: Buffer.from(await response.arrayBuffer()),
  };
};

/** Cuerpo JSON de una respuesta cruda; `undefined` si no es JSON (p. ej. un PDF). */
export const jsonOf = (bytes: Buffer): unknown => {
  try {
    return JSON.parse(bytes.toString('utf8')) as unknown;
  } catch {
    return undefined;
  }
};

/** Código de error (`code`) de un cuerpo JSON, o `undefined`. */
export const codeOf = (body: unknown): string | undefined => {
  const code = field(body, 'code');
  return typeof code === 'string' ? code : undefined;
};

/** ¿Empieza el cuerpo por `%PDF-` y termina por `%%EOF`? */
export const isPdf = (bytes: Buffer): boolean => bytes.subarray(0, 5).toString('latin1') === '%PDF-' && bytes.toString('latin1').trimEnd().endsWith('%%EOF');

/** Nombre del archivo de `Content-Disposition` (`filename*` UTF-8 si lo hay, si no `filename`); `undefined` si no hay. */
export const filenameOf = (disposition: string): string | undefined => {
  const utf8 = /filename\*=UTF-8''([^;]+)/.exec(disposition);
  if (utf8?.[1] !== undefined) return decodeURIComponent(utf8[1].trim());
  const plain = /filename="([^"]*)"/.exec(disposition);
  return plain?.[1];
};

/** Un texto que dibuja el PDF de la API, con su fuente (F1 normal, F2 negrita), en el orden del archivo. */
export interface PdfText {
  readonly font: string;
  readonly text: string;
}

/** Textos del PDF que genera la API (contenido sin comprimir): `BT /Fn tam Tf 1 0 0 1 x y Tm (texto) Tj ET`. */
export const pdfTexts = (bytes: Buffer): readonly PdfText[] => {
  const raw = bytes.toString('latin1');
  const pattern = /\/(F[12]) [\d.]+ Tf 1 0 0 1 [\d.]+ [-\d.]+ Tm \(((?:\\.|[^\\)])*)\) Tj/g;
  return Array.from(raw.matchAll(pattern), (match) => ({ font: match[1] ?? '', text: (match[2] ?? '').replace(/\\(.)/g, '$1') }));
};

/** Campos que solo trae un documento (ficha, contenido o listado): si el cuerpo los trae, hay datos del documento. */
const DOCUMENT_KEYS: readonly string[] = ['id', 'title', 'classification', 'version', 'versions', 'pages', 'programCode', 'programName', 'updatedAt'];

/** ¿Hay alguna clave de documento en el cuerpo, a cualquier nivel (p. ej. `{ document: { title } }`)? */
const hasDocumentKey = (value: unknown): boolean => {
  if (Array.isArray(value)) return value.some(hasDocumentKey);
  if (typeof value !== 'object' || value === null) return false;
  return Object.entries(value).some(([key, inner]) => DOCUMENT_KEYS.includes(key) || hasDocumentKey(inner));
};

/** Estado y código de error esperados de una respuesta, y lo que la historia dice de su cuerpo. */
export interface Expected {
  readonly status: number;
  readonly code?: string;
  readonly classification?: string;
  readonly version?: number;
  /** Números de versión que trae el historial, en orden. */
  readonly versions?: readonly number[];
  /** `true`: trae páginas (contenido de una versión). */
  readonly pages?: boolean;
  /** Nombre del archivo de la descarga (PDF). */
  readonly file?: string;
  /** `true`: la respuesta no trae datos del documento (ni campos de ficha ni PDF). */
  readonly sinDatos?: boolean;
}

/** Estado y `code` frente a lo esperado. */
export const answerCheck = (status: number, code: string | undefined, expected: { readonly status: number; readonly code?: string }): Check =>
  check(
    status === expected.status && (expected.code === undefined || code === expected.code),
    `respuesta ${expected.status}${expected.code === undefined ? '' : ` ${expected.code}`}`,
    `respuesta ${status}${code === undefined ? '' : ` ${code}`}`,
  );

/** Un campo de la ficha tiene el valor esperado (ausente = no cumple). */
export const fieldCheck = (body: unknown, key: string, expected: string | number): Check => {
  const observed = field(body, key);
  return check(observed === expected, `${key} ${expected}`, `${key} ${observed === undefined ? '(sin leer)' : String(observed)}`);
};

/** El historial trae exactamente esos números de versión, en orden (lectura ausente = no cumple). */
export const versionsCheck = (body: unknown, expected: readonly number[]): Check => {
  const raw = field(body, 'versions');
  const observed = Array.isArray(raw) ? raw.map((item) => field(item, 'version')) : undefined;
  const same = observed !== undefined && observed.length === expected.length && expected.every((value, index) => observed[index] === value);
  return check(same, `${expected.length} versiones (${expected.join(' y ')})`, observed === undefined ? '(historial sin leer)' : `${observed.length} versiones (${observed.map(String).join(' y ')})`);
};

/** La versión trae páginas (lista no vacía). */
export const pagesCheck = (body: unknown): Check => {
  const pages = field(body, 'pages');
  return check(Array.isArray(pages) && pages.length > 0, 'con sus páginas', Array.isArray(pages) ? `con ${pages.length} páginas` : 'sin páginas (no leídas)');
};

/** La descarga es un PDF llamado `name` (cabecera de tipo, nombre y bytes). */
export const fileCheck = (raw: RawResponse, name: string): Check => {
  const observed = filenameOf(raw.disposition);
  const pdf = raw.contentType.startsWith('application/pdf') && isPdf(raw.bytes);
  return check(pdf && observed === name, `un PDF llamado ${name}`, `${pdf ? 'un PDF' : 'no es un PDF'} llamado ${observed ?? '(sin nombre)'}`);
};

/** La respuesta no trae datos del documento: ni campos de ficha ni PDF. */
export const noDataCheck = (raw: RawResponse): Check => {
  const body = jsonOf(raw.bytes);
  const leaked = isPdf(raw.bytes) || hasDocumentKey(body);
  return check(!leaked, 'sin datos del documento', leaked ? 'trae datos del documento' : 'sin datos del documento');
};

/** Comprobaciones de una respuesta frente a lo que dice su celda (la historia es la fuente de verdad). */
export const expectationChecks = (raw: RawResponse, expected: Expected): Check[] => {
  const body = jsonOf(raw.bytes);
  const checks: Check[] = [answerCheck(raw.status, codeOf(body), expected)];
  if (expected.classification !== undefined) checks.push(fieldCheck(body, 'classification', expected.classification));
  if (expected.version !== undefined) checks.push(fieldCheck(body, 'version', expected.version));
  if (expected.versions !== undefined) checks.push(versionsCheck(body, expected.versions));
  if (expected.pages === true) checks.push(pagesCheck(body));
  if (expected.file !== undefined) checks.push(fileCheck(raw, expected.file));
  if (expected.sinDatos === true) checks.push(noDataCheck(raw));
  return checks;
};

/** Lista `items` de una respuesta de la lista de documentos; `undefined` si no es una lista (no leída). */
export const itemsOfList = (body: unknown): readonly Record<string, unknown>[] | undefined => {
  const items = field(body, 'items');
  return Array.isArray(items) ? (items as Record<string, unknown>[]) : undefined;
};

/** Códigos de los documentos de una lista, en el orden de la API (vacío si no es una lista). */
export const idsOf = (items: readonly Record<string, unknown>[] | undefined): readonly string[] => (items ?? []).map((item) => String(field(item, 'id')));

/** Positivo: la respuesta trae la lista `items` (sin ella, «sin documentos» no se da por cumplido). */
export const listPresentCheck = (body: unknown): Check => {
  const items = itemsOfList(body);
  return check(items !== undefined, 'la respuesta trae la lista items', items === undefined ? 'la respuesta no trae la lista items' : `la respuesta trae ${items.length} documentos`);
};

/** Mismos códigos y en el mismo orden (lista no leída = no cumple). `lead` es la frase previa: «la lista trae», «los restringidos que trae son». */
export const codesCheck = (lead: string, shown: readonly string[] | undefined, expected: readonly string[]): Check => {
  const same = shown !== undefined && shown.length === expected.length && shown.every((code, index) => code === expected[index]);
  const describe = (codes: readonly string[]): string => (codes.length === 0 ? '(ninguno)' : codes.join(', '));
  return check(same, `${lead} ${describe(expected)}`, `${lead} ${shown === undefined ? '(sin leer)' : describe(shown)}`);
};

/** Convierte una respuesta cruda en el formato de respuesta de `support/api` (para `preparationFailed`). */
export const asApiResult = (raw: RawResponse): ApiResult => ({ status: raw.status, body: jsonOf(raw.bytes), ms: 0 });

/** Códigos de documentos de una lista (los que trae la lista con el valor dado en un campo). */
export const idsWhere = (items: readonly Record<string, unknown>[] | undefined, key: string, value: string): readonly string[] =>
  (items ?? []).filter((item) => field(item, key) === value).map((item) => String(field(item, 'id')));

/**
 * Códigos de documentos de una celda: «DOC-001 a DOC-012», «DOC-003 y DOC-004», «DOC-001, DOC-003 y DOC-005» o «(ninguno)». Otra
 * forma LANZA (una celda nueva no se ignora).
 */
export const docCodesOf = (text: string): readonly string[] => {
  if (text === '(ninguno)') return [];
  const range = /^(DOC-\d{3}) a (DOC-\d{3})$/.exec(text);
  if (range?.[1] !== undefined && range[2] !== undefined) {
    const from = Number(range[1].slice(4));
    const to = Number(range[2].slice(4));
    return Array.from({ length: to - from + 1 }, (_, index) => `DOC-${String(from + index).padStart(3, '0')}`);
  }
  const parts = text.split(/, | y /);
  if (!parts.every((code) => /^DOC-\d{3}$/.test(code))) throw new Error(`celda sin interpretación: códigos «${text}»`);
  return parts;
};

/** Un «Entonces»/«Y» de la fila: sus pasos tal como están en el manifiesto (lo que la historia espera de la fila). */
/**
 * Como `finish`, pero añade una nota fija (cobertura que la fila no prueba) sin perder lo que difiere: si la fila discrepa, la
 * nota dice en qué y, a continuación, la cobertura.
 */
export const finishNoted = (checks: readonly Check[], note: string, evidence?: Readonly<Record<string, unknown>>): Outcome => {
  const result = finish(checks, evidence === undefined ? {} : { evidence });
  return { ...result, note: result.note === undefined ? note : `${result.note} · ${note}` };
};

/** Cobertura que la historia no prueba con fila: el gestor de programa no tiene fila aquí (su acceso se prueba en 001 y 002). */
export const COBERTURA_GESTOR = 'El gestor de programa no tiene fila en esta historia: su acceso a los restringidos se prueba en US-DOC-RESTRINGIDOS-001 (E1) y 002 (E1).';

export const thenOf = (row: ManifestRow): string => row.resolvedSteps.filter((step) => /^(Entonces|Y) /.test(step)).join('; ');

/**
 * Resultado de las comprobaciones de una fila: `coincide` solo si todas se cumplen. Si una falla y el resultado no trae nota, la nota
 * dice en qué difiere (lo que la historia espera frente a lo observado).
 */
export const finish = (checks: readonly Check[], extra: Pick<Outcome, 'note' | 'evidence'> = {}): Outcome => {
  const result = conclude(checks, extra);
  if (result.verdict === 'coincide' || result.note !== undefined) return result;
  const differences = checks.filter((entry) => !entry.ok).map((entry) => `«${entry.expected}» no se cumple (${entry.observed})`);
  return { ...result, note: `Difiere en: ${differences.join('; ')}` };
};
