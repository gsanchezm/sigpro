import { API_URL, adminToken, call, field, login, sessionOf, type ApiResult } from '../../../story-runs/support/api';
import { DEMO, TENANT_A, TENANT_B, type Credentials } from '../../../story-runs/support/prepare';
import { check, conclude, preparationFailed, type Check } from '../../support/checks';
import { type Outcome } from '../../core/framework';
import { isPdf, pdfLines } from './pdf';

// Piezas comunes de los manejadores de API de EP-VER-INFORME. El informe no es JSON: el cuerpo llega como bytes, así que aquí se
// hace la petición con `fetch` directo (el `call` del piloto lee el cuerpo como texto y lo rompería). Las cifras que la historia
// da por hechas se leen del PDF; lo observado sale de lo medido (estado, tipo, nombre y líneas), nunca de un texto fijo.

export { TENANT_A, TENANT_B, adminToken };

/** Cuentas de los Esquemas: alumno01 y alumno02 son administradores de su tenant (sin segundo factor). */
export const ALUMNO01: Credentials = { email: 'alumno01@sigpro.lab', password: 'Alumno1234!' };
export const ALUMNO02: Credentials = { email: 'alumno02@sigpro.lab', password: 'Alumno1234!' };

/** Cuenta de la celda y tenant en el que inicia sesión (la cuenta de alumno02 vive solo en alumno02). */
export interface Account {
  readonly credentials: Credentials;
  readonly tenant: string;
}

export const ACCOUNT_CELLS: ReadonlyMap<string, Account> = new Map<string, Account>([
  ['alumno01@sigpro.lab', { credentials: ALUMNO01, tenant: TENANT_A }],
  ['alumno02@sigpro.lab', { credentials: ALUMNO02, tenant: TENANT_B }],
  ['gestor@sigpro.test', { credentials: DEMO.gestor, tenant: TENANT_A }],
  ['consultor@sigpro.test', { credentials: DEMO.consultor, tenant: TENANT_A }],
  ['auditor@sigpro.test', { credentials: DEMO.auditor, tenant: TENANT_A }],
]);

/** Cabecera `x-tenant` de la celda: el tenant que se escribe. */
export const TENANT_CELLS: ReadonlyMap<string, string> = new Map<string, string>([
  ['alumno01', TENANT_A],
  ['alumno02', TENANT_B],
]);

/** Contraseñas que escriben las historias (las del seed); una contraseña ajena LANZA. */
export const PASSWORD_CELLS: ReadonlyMap<string, string> = new Map<string, string>([
  ['Gestor1234!', 'Gestor1234!'],
  ['Consul1234!', 'Consul1234!'],
  ['Audit1234!', 'Audit1234!'],
  ['Alumno1234!', 'Alumno1234!'],
]);

/** Cuerpo de una consulta del informe. Un campo ausente no se envía; uno vacío sí (`program=`). */
export interface ScopeQuery {
  readonly codes?: string;
  readonly program?: string;
}

/** Consultas de las celdas «consulta» (historias 002 y 003), tal cual las escribe la historia. */
export const SCOPE_CELLS: ReadonlyMap<string, ScopeQuery> = new Map<string, ScopeQuery>([
  ['(sin parámetros)', {}],
  ['(program vacío)', { program: '' }],
  ['(codes vacío) y program=PRG-002', { codes: '', program: 'PRG-002' }],
  ['program=PRG-001', { program: 'PRG-001' }],
  ['program=PRG-002', { program: 'PRG-002' }],
  ['program=PRG-003', { program: 'PRG-003' }],
  ['program=PRG-004', { program: 'PRG-004' }],
  ['program=PRG-999', { program: 'PRG-999' }],
  ['codes=TC-001', { codes: 'TC-001' }],
  ['codes=TC-001, TC-010', { codes: 'TC-001, TC-010' }],
  ['codes=TC-001,TC-010,TC-020', { codes: 'TC-001,TC-010,TC-020' }],
  ['codes=TC-001 y program=PRG-002', { codes: 'TC-001', program: 'PRG-002' }],
  ['codes=TC-002', { codes: 'TC-002' }],
  ['codes=TC-999', { codes: 'TC-999' }],
  ['codes=tc-001', { codes: 'tc-001' }],
  ['codes=TC-999 y program=PRG-002', { codes: 'TC-999', program: 'PRG-002' }],
]);

/** Códigos de caso de las celdas «caso» de la historia 003 (el seed tiene TC-001 a TC-025). */
export const CASE_CELLS: ReadonlyMap<string, string> = new Map<string, string>([
  ['TC-001', 'TC-001'],
  ['TC-002', 'TC-002'],
  ['TC-019', 'TC-019'],
  ['TC-023', 'TC-023'],
]);

/** Resultados del último resultado, con la etiqueta que muestra el PDF. */
export const RESULT_LABEL_CELLS: ReadonlyMap<string, string> = new Map<string, string>([
  ['Bloqueado', 'Bloqueado'],
  ['Fallido', 'Fallido'],
  ['Superado', 'Superado'],
]);

/** Número de una celda (cifras del seed y de los recuentos). Otra forma LANZA. */
export const numberOf = (text: string): number => {
  if (!/^\d+$/.test(text)) throw new Error(`celda sin interpretación: número «${text}»`);
  return Number(text);
};

/** Consulta de la URL del informe: solo los parámetros que la fila trae, con su codificación real. */
export const queryOf = (scope: ScopeQuery): string => {
  const params = new URLSearchParams();
  if (scope.codes !== undefined) params.set('codes', scope.codes);
  if (scope.program !== undefined) params.set('program', scope.program);
  return params.toString();
};

/** Nombre del archivo que indica `Content-Disposition` (`filename*=UTF-8''…` o `filename="…"`). */
const filenameOf = (header: string | undefined): string | undefined => {
  if (header === undefined) return undefined;
  const encoded = /filename\*=UTF-8''([^;]+)/i.exec(header)?.[1];
  if (encoded !== undefined) return decodeURIComponent(encoded);
  return /filename="([^"]+)"/i.exec(header)?.[1];
};

/** Cuerpo JSON de una respuesta, o `undefined` si no lo es (un PDF nunca se intenta leer como JSON). */
const parseJson = (text: string): unknown => {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
};

/** Respuesta de `GET /api/verification/report` tal como llega: estado, tipo, nombre, bytes y texto del PDF si lo hay. */
export interface Reply {
  readonly status: number;
  readonly ms: number;
  readonly contentType: string;
  readonly disposition: string | undefined;
  readonly filename: string | undefined;
  readonly pdf: boolean;
  readonly bytes: Buffer;
  readonly body: unknown;
  readonly lines: readonly string[];
}

/** Pide el informe con las cabeceras dadas y la consulta (sin `?` si va vacía). */
export const reportReply = async (headers: Readonly<Record<string, string>>, query = ''): Promise<Reply> => {
  const started = performance.now();
  const response = await fetch(`${API_URL}/verification/report${query === '' ? '' : `?${query}`}`, { method: 'GET', headers });
  const bytes = Buffer.from(await response.arrayBuffer());
  const pdf = isPdf(bytes);
  const disposition = response.headers.get('content-disposition') ?? undefined;
  return {
    status: response.status,
    ms: Math.round(performance.now() - started),
    contentType: response.headers.get('content-type') ?? '(sin Content-Type)',
    disposition,
    filename: filenameOf(disposition),
    pdf,
    bytes,
    body: pdf ? undefined : parseJson(bytes.toString('utf8')),
    lines: pdf ? pdfLines(bytes) : [],
  };
};

/** La misma respuesta como `ApiResult` (para `responseCheck`, que lee `status` y el `code` del cuerpo). */
export const asApiResult = (reply: Reply): ApiResult => ({ status: reply.status, body: reply.body, ms: reply.ms });

/** Tipo de medio sin parámetros, en minúsculas (`application/pdf; charset=…` → `application/pdf`). */
export const mediaOf = (contentType: string): string => contentType.split(';')[0]?.trim().toLowerCase() ?? '';

/** Cabeceras de autorización: un token de acceso como Bearer, o ninguna si no hay token. */
export const bearer = (token: string | undefined): Readonly<Record<string, string>> => (token === undefined ? {} : { authorization: `Bearer ${token}` });

/** Estado del seed de un tenant según la lista de casos (`totalAll` = casos, `totalRuns` = ejecuciones). */
export const seedOf = async (tenant: string, token: string): Promise<{ readonly result: ApiResult; readonly cases?: number; readonly runs?: number }> => {
  const listed = await call('GET', '/test-cases', { tenant, token, query: 'pageSize=100' });
  const cases = field(listed.body, 'totalAll');
  const runs = field(listed.body, 'totalRuns');
  return {
    result: listed,
    ...(listed.status === 200 && typeof cases === 'number' ? { cases } : {}),
    ...(listed.status === 200 && typeof runs === 'number' ? { runs } : {}),
  };
};

/**
 * Preparación de la fila: el tenant reiniciado tiene `cases` casos (y `runs` ejecuciones, si se dan). Si no, la fila no se puede
 * juzgar y devuelve el motivo con la lista que respondió la API.
 */
export const seedFailure = async (tenant: string, expected: string, cases: number, runs?: number): Promise<Outcome | undefined> => {
  const seed = await seedOf(tenant, await adminToken(tenant));
  const ok = seed.cases === cases && (runs === undefined || seed.runs === runs);
  return ok
    ? undefined
    : preparationFailed(expected, `el tenant ${tenant} tiene ${cases} casos${runs === undefined ? '' : ` y ${runs} ejecuciones`} tras el reinicio (lista de casos)`, seed.result);
};

/** Registra una ejecución en un caso con `POST /api/test-cases/:code/runs` como formulario multiparte, sin archivos. */
export const postRun = async (tenant: string, token: string, code: string, result: 'pass' | 'fail' | 'blocked'): Promise<ApiResult> => {
  const started = performance.now();
  const form = new FormData();
  form.append('result', result);
  const response = await fetch(`${API_URL}/test-cases/${code}/runs`, { method: 'POST', headers: { 'x-tenant': tenant, authorization: `Bearer ${token}` }, body: form });
  const text = await response.text();
  return { status: response.status, body: parseJson(text) ?? text, ms: Math.round(performance.now() - started) };
};

/** Inicio de sesión de una cuenta en su tenant: el resultado crudo y, si trae tokens, el accessToken y el refreshToken. */
export const signedIn = async (account: Account, remember?: boolean): Promise<{ readonly result: ApiResult; readonly accessToken: string | undefined; readonly refreshToken: string | undefined }> => {
  const result = await login({ tenant: account.tenant, email: account.credentials.email, password: account.credentials.password, ...(remember === undefined ? {} : { remember }) });
  const session = sessionOf(result);
  return { result, accessToken: session?.accessToken, refreshToken: session?.refreshToken };
};

/** Inicio de sesión con una contraseña escrita en la celda (puede no coincidir con la del seed). */
export const signedInWith = async (tenant: string, email: string, password: string): Promise<{ readonly result: ApiResult; readonly accessToken: string | undefined }> => {
  const result = await login({ tenant, email, password });
  return { result, accessToken: sessionOf(result)?.accessToken };
};

// --- Comprobaciones de la respuesta del informe ----------------------------------------------------------------------------------

/** Un PDF (cabecera `%PDF-`). */
export const pdfCheck = (reply: Reply): Check => check(reply.pdf, 'un PDF', reply.pdf ? `un PDF (Content-Type ${reply.contentType})` : `no es un PDF (Content-Type ${reply.contentType})`);

/** Ningún PDF en la respuesta (un error no trae el informe). */
export const noPdfCheck = (reply: Reply): Check => check(!reply.pdf, 'ningún PDF', reply.pdf ? `trae un PDF (Content-Type ${reply.contentType})` : `ningún PDF (Content-Type ${reply.contentType})`);

/** `Content-Disposition` de tipo `attachment`. */
export const attachmentCheck = (reply: Reply): Check => {
  const type = reply.disposition?.split(';')[0]?.trim().toLowerCase();
  return check(type === 'attachment', 'Content-Disposition attachment', `Content-Disposition ${type ?? '(ausente)'}`);
};

/** El archivo se llama exactamente así (nombre que indica el servidor). */
export const filenameCheck = (reply: Reply, name: string): Check =>
  check(reply.filename === name, `el archivo se llama «${name}»`, `el archivo se llama «${reply.filename ?? '(sin nombre)'}»`);

/** Una línea exacta del PDF; lo observado es la línea medida con ese prefijo (o que no aparece ninguna). */
export const lineCheck = (lines: readonly string[], expected: string, prefix: string): Check => {
  const found = lines.includes(expected);
  const measured = lines.find((line) => line.startsWith(prefix));
  return check(found, `el PDF dice «${expected}»`, found ? `el PDF dice «${expected}»` : `el PDF dice «${measured ?? '(ninguna línea de ese tipo)'}»`);
};

/** La línea de alcance es la segunda del documento (la primera es el título). Comparación exacta. */
export const scopeCheck = (lines: readonly string[], scope: string): Check => {
  const measured = lines[1];
  return check(measured === scope, `la línea de alcance es «${scope}»`, `la línea de alcance es «${measured ?? '(sin línea)'}»`);
};

/** Datos de una respuesta para la evidencia (sin tokens ni contenido del PDF). */
export const evidenceOf = (reply: Reply): Readonly<Record<string, unknown>> => ({
  estado: reply.status,
  contentType: reply.contentType,
  disposition: reply.disposition ?? '(ausente)',
  bytes: reply.bytes.length,
});

/** Nota de una fila que no coincide: en qué difiere, con lo medido, y la causa si se conoce. */
export const noteOf = (checks: readonly Check[], cause?: string): string | undefined => {
  const failing = checks.filter((entry) => !entry.ok);
  if (failing.length === 0) return undefined;
  const differs = `Difiere en: ${failing.map((entry) => `${entry.expected} (${entry.observed})`).join('; ')}.`;
  return cause === undefined ? differs : `${differs} ${cause}`;
};

/**
 * Resultado de una fila: las comprobaciones, con la nota que declara la lectura de una celda ambigua (`reading`, siempre) y la
 * diferencia con lo medido (solo si la hay, con la causa si se conoce).
 */
export const done = (checks: readonly Check[], options: { readonly reading?: string; readonly cause?: string; readonly evidence?: Readonly<Record<string, unknown>> } = {}): Outcome => {
  const note = [options.reading, noteOf(checks, options.cause)].filter((part): part is string => part !== undefined).join(' ');
  return conclude(checks, {
    ...(note === '' ? {} : { note }),
    ...(options.evidence === undefined ? {} : { evidence: options.evidence }),
  });
};

/** Causa de un 404 que llega como `application/pdf` (medido en la respuesta; el porqué sale del código). */
export const pdfTypeCause = (reply: Reply): string | undefined =>
  mediaOf(reply.contentType) === 'application/pdf'
    ? 'Causa por lectura del código: el decorador @Header(\'Content-Type\', \'application/pdf\') de report() (apps/api/src/verification/verification.controller.ts:86-87) fija el tipo antes de ejecutar el manejador, y el filtro de excepciones responde con res.json, que solo pone application/json si no hay tipo.'
    : undefined;
