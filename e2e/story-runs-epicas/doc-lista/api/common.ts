import { API_URL, call, errorCode, field, type ApiResult } from '../../../story-runs/support/api';
import { DEMO, TENANT_A, TENANT_B, resetTenants, startSession } from '../../../story-runs/support/prepare';
import type { ManifestRow, Outcome } from '../../core/framework';
import { check, conclude, type Check } from '../../support/checks';

// Piezas comunes de las filas de API de EP-DOC-LISTA: reinicio de los tenants, sesión de gestor@sigpro.test en cada tenant, la
// publicación de aislamiento que prepara alumno02, lectura cruda (cabeceras y bytes) para las descargas y el texto del PDF, y
// comprobaciones de la respuesta. Las celdas de texto se traducen con mapas estrictos en cada historia (un texto desconocido LANZA).

export { TENANT_A, TENANT_B } from '../../../story-runs/support/prepare';

/** Sesión de gestor@sigpro.test en un tenant: su access token (o `undefined` si el login no lo dio) y la última respuesta. */
export interface GestorSession {
  readonly token: string | undefined;
  readonly refreshToken: string | undefined;
  readonly last: ApiResult;
}

/** Inicia sesión de gestor@sigpro.test (program_manager) en el tenant dado con `POST /api/auth/login` y `x-tenant`. */
export const gestorIn = async (tenant: string): Promise<GestorSession> => {
  const started = await startSession(tenant, DEMO.gestor);
  return { token: started.session?.accessToken, refreshToken: started.session?.refreshToken, last: started.result };
};

/** Fallo de la preparación de aislamiento: el paso que no se cumplió y su respuesta cruda. */
export interface PrepFailure {
  readonly step: string;
  readonly result: ApiResult;
}

/**
 * Preparación de las filas de aislamiento: reinicia alumno01 y alumno02 (cada uno con su administrador), y después alumno02@sigpro.lab
 * publica la versión de prueba de DOC-001 (queda en la 4). Devuelve el fallo si algo no se cumple, o `undefined` si todo sale bien.
 */
export const isolationPrep = async (): Promise<PrepFailure | undefined> => {
  await resetTenants([TENANT_A, TENANT_B]);
  const publisher = await startSession(TENANT_B, { email: 'alumno02@sigpro.lab', password: 'Alumno1234!' });
  if (publisher.session === undefined) return { step: 'alumno02@sigpro.lab inicia sesión en alumno02', result: publisher.result };
  const published = await call('POST', '/documents/DOC-001/versions', {
    tenant: TENANT_B,
    token: publisher.session.accessToken,
    body: { lines: ['Versión de prueba de aislamiento'], note: 'Prueba de aislamiento' },
  });
  if (published.status < 200 || published.status > 299) return { step: 'alumno02 publica una versión nueva de DOC-001', result: published };
  const reader = await gestorIn(TENANT_B);
  if (reader.token === undefined) return { step: 'gestor@sigpro.test inicia sesión en alumno02', result: reader.last };
  const doc = await call('GET', '/documents/DOC-001', { tenant: TENANT_B, token: reader.token });
  if (field(doc.body, 'version') !== 4) return { step: `DOC-001 de alumno02 queda en la versión 4 (la lectura da ${String(field(doc.body, 'version'))})`, result: doc };
  return undefined;
};

/** Cadena de consulta con los valores codificados (los espacios van como %20: la URL no pierde los del final). */
export const queryOf = (pairs: readonly (readonly [string, string])[]): string => pairs.map(([key, value]) => `${key}=${encodeURIComponent(value)}`).join('&');

/** Lista `items` de una respuesta de la lista de documentos; vacía si no es una lista. */
export const itemsOf = (body: unknown): readonly Record<string, unknown>[] => {
  const items = field(body, 'items');
  return Array.isArray(items) ? (items as Record<string, unknown>[]) : [];
};

/** Códigos de los documentos de una respuesta de lista, en el orden de la API. */
export const idsOf = (body: unknown): readonly string[] => itemsOf(body).map((item) => String(field(item, 'id')));

/** Lectura cruda de una petición (cabeceras y bytes): para PDFs y para respuestas que no son JSON. */
export interface RawResponse {
  readonly status: number;
  readonly contentType: string;
  readonly disposition: string;
  readonly bytes: Buffer;
}

/** `GET` crudo con el token y la cabecera `x-tenant` dados (sin cabecera si no se pasan). No decodifica el cuerpo. */
export const rawGet = async (path: string, tenant: string | undefined, token: string | undefined, query?: string): Promise<RawResponse> => {
  const headers: Record<string, string> = {
    ...(tenant === undefined ? {} : { 'x-tenant': tenant }),
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

/** `code` y `message` de un cuerpo JSON de error; vacíos si el cuerpo no es JSON. */
export const errorOfBytes = (bytes: Buffer): { readonly code?: string; readonly message?: string } => {
  try {
    const body = JSON.parse(bytes.toString('utf8')) as unknown;
    const code = field(body, 'code');
    const message = field(body, 'message');
    return {
      ...(typeof code === 'string' ? { code } : {}),
      ...(typeof message === 'string' ? { message } : {}),
    };
  } catch {
    return {};
  }
};

/**
 * ¿La fuente F2 del PDF (la que dibuja la negrita) es Helvetica-Bold? Busca el recurso /F2, el objeto al que apunta y su nombre base,
 * sin depender del orden de los objetos.
 */
export const boldFontOf = (bytes: Buffer): boolean => {
  const raw = bytes.toString('latin1');
  const at = raw.indexOf('/F2 ');
  if (at < 0) return false;
  const reference = raw.slice(at + 4).split(' ')[0] ?? '';
  const objectAt = raw.indexOf('\n' + reference + ' 0 obj');
  return objectAt >= 0 && raw.slice(objectAt, objectAt + 200).includes('/BaseFont /Helvetica-Bold');
};

/** ¿Empieza el cuerpo por `%PDF-` y termina por `%%EOF`? */
export const isPdf = (bytes: Buffer): boolean => bytes.subarray(0, 5).toString('latin1') === '%PDF-' && bytes.toString('latin1').trimEnd().endsWith('%%EOF');

/** Un texto de la página del PDF con su fuente (F1 normal, F2 negrita), en el orden del archivo. */
export interface PdfText {
  readonly font: string;
  readonly text: string;
}

/** Textos que dibuja el PDF que genera la API (contenido sin comprimir): `BT /Fn tam Tf 1 0 0 1 x y Tm (texto) Tj ET`. */
export const pdfTexts = (bytes: Buffer): readonly PdfText[] => {
  const raw = bytes.toString('latin1');
  const pattern = /\/(F[12]) [\d.]+ Tf 1 0 0 1 [\d.]+ [-\d.]+ Tm \(((?:\\.|[^\\)])*)\) Tj/g;
  return Array.from(raw.matchAll(pattern), (match) => ({ font: match[1] ?? '', text: (match[2] ?? '').replace(/\\(.)/g, '$1') }));
};

/** Números de una celda: «1, 2 y 3», «1 y 2» o «1». Otra forma LANZA. */
export const numbersOf = (text: string): readonly number[] => {
  const parts = text.split(/, | y /).map((part) => Number(part));
  if (parts.some((value) => !Number.isInteger(value))) throw new Error(`celda sin interpretación: números «${text}»`);
  return parts;
};

/** Códigos de documentos de una celda: «DOC-001 a DOC-012», «DOC-003 y DOC-004», «DOC-001, DOC-003 y DOC-005» o «(ninguno)». Otra forma LANZA. */
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

/** Una comprobación de la lista de códigos: mismos códigos y en el mismo orden. */
export const idsCheck = (shown: readonly string[], expected: readonly string[]): Check =>
  check(
    shown.length === expected.length && shown.every((code, index) => code === expected[index]),
    `los documentos son ${expected.length === 0 ? '(ninguno)' : expected.join(', ')}`,
    `los documentos son ${shown.length === 0 ? '(ninguno)' : shown.join(', ')}`,
  );

/** Código HTTP y, si lo hay, `code` de error de una respuesta JSON, para comprobar «404 document_not_found» y similares. */
export const statusCheck = (result: ApiResult, status: number, code?: string): Check =>
  check(
    result.status === status && (code === undefined || errorCode(result) === code),
    `respuesta ${status}${code === undefined ? '' : ` ${code}`}`,
    `respuesta ${result.status}${errorCode(result) === undefined ? '' : ` ${errorCode(result)}`}`,
  );

/** «Sin datos del documento»: el cuerpo no trae ni título ni historial. */
export const noDocumentDataCheck = (body: unknown): Check => {
  const leaked = field(body, 'title') !== undefined || field(body, 'versions') !== undefined;
  return check(!leaked, 'sin datos del documento', leaked ? 'trae datos del documento' : 'sin datos del documento');
};

/** Un «Entonces»/«Y» de la fila: sus pasos tal como están en el manifiesto (lo que la historia espera de la fila). */
export const thenOf = (row: ManifestRow): string => row.resolvedSteps.filter((step) => /^(Entonces|Y) /.test(step)).join('; ');

/** Compara un campo de un documento con el texto esperado (lectura ausente = no cumple). */
export const fieldIs = (item: Record<string, unknown> | undefined, key: string, expected: string, label: string): Check => {
  const observed = item === undefined || field(item, key) === undefined ? '(sin leer)' : String(field(item, key));
  return check(item !== undefined && observed === expected, `${label} ${expected}`, `${label} ${observed}`);
};

/** Identidad de la credencial de una fila de API (cabecera Authorization). */
export type Credential = { readonly kind: 'none' } | { readonly kind: 'text' } | { readonly kind: 'refresh' } | { readonly kind: 'access' };

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
