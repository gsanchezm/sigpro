import { API_URL, call, field, type ApiResult } from '../../../story-runs/support/api';
import { TENANT_A, TENANT_B, resetTenants, startSession, type Credentials } from '../../../story-runs/support/prepare';
import { check, cell, preparationFailed, type Check } from '../../support/checks';
import { outcome, type ManifestRow, type Outcome } from '../../core/framework';

/**
 * Veredicto de una fila a partir de sus comprobaciones: cumple solo si todas se cumplen. Si hay discrepancias, la nota dice qué
 * comprobaciones no se cumplen y qué se observó en su lugar (lo que la historia espera frente a lo medido).
 */
export const conclude = (checks: readonly Check[], extra: Pick<Outcome, 'note' | 'evidence'> = {}): Outcome => {
  const failing = checks.filter((entry) => !entry.ok);
  // La nota del manejador (si la hay) va delante; el resumen de lo que no se cumple se añade siempre que haya algo que no se cumple
  const summary = failing.length === 0 ? undefined : 'No se cumple: ' + failing.map((entry) => entry.expected).join('; ') + '. Observado: ' + failing.map((entry) => entry.observed).join('; ') + '.';
  const note = [extra.note, summary].filter((text): text is string => text !== undefined).join(' ');
  return outcome(failing.length === 0, checks.map((entry) => entry.expected).join('; '), checks.map((entry) => entry.observed).join('; '), {
    ...(note === '' ? {} : { note }),
    ...(extra.evidence === undefined ? {} : { evidence: extra.evidence }),
  });
};

// Piezas comunes de las filas de API de EP-MISION-KPI: cuentas con su sesión, el resumen y el simulador, los cambios de
// preparación que las historias nombran («alumno01@sigpro.lab archiva PRG-001…»), el envío multipart de una ejecución y las
// comprobaciones de la forma y de los valores del resumen. Lo observado se deriva de lo medido; lo esperado sale de la historia.

export { API_URL, TENANT_A, TENANT_B, call, field, resetTenants, type ApiResult };

/** Administradores de cada tenant de la épica: `alumnoNN@sigpro.lab`, con la contraseña del seed y sin segundo factor. */
export const ADMIN_ALUMNO01: Credentials = { email: 'alumno01@sigpro.lab', password: 'Alumno1234!' };
export const ADMIN_ALUMNO02: Credentials = { email: 'alumno02@sigpro.lab', password: 'Alumno1234!' };

/** Cuentas que citan las celdas `cuenta` de las filas de API (el texto exacto del correo). */
export const ACCOUNTS: ReadonlyMap<string, true> = new Map<string, true>([
  ['alumno01@sigpro.lab', true],
  ['alumno02@sigpro.lab', true],
  ['gestor@sigpro.test', true],
  ['consultor@sigpro.test', true],
  ['auditor@sigpro.test', true],
]);

/** Cabecera `Authorization` de las filas sin token válido: un JWT con forma correcta que la API no ha emitido. */
export const INVENTED_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJpbnZlbnRhZG8iLCJ0ZW5hbnQiOiJhbHVtbm8wMSJ9.firma-no-emitida';

/** Cabecera `x-tenant` de la celda → tenant real. */
export const TENANT_OF_HEADER: ReadonlyMap<string, string> = new Map<string, string>([
  ['alumno01', TENANT_A],
  ['alumno02', TENANT_B],
]);

/** Sesión de una cuenta: su access token (o `undefined` si el inicio de sesión no lo dio) y la última respuesta para explicar un fallo. */
export interface Session {
  readonly token: string | undefined;
  readonly last: ApiResult;
}

/** Inicia sesión en un tenant con una cuenta (remember por defecto, como la API). */
export const sessionAs = async (tenant: string, credentials: Credentials): Promise<Session> => {
  const started = await startSession(tenant, credentials);
  return { token: started.session?.accessToken, last: started.result };
};

/** Sesión del administrador de un tenant de la épica. */
export const adminSession = (tenant: string): Promise<Session> => sessionAs(tenant, tenant === TENANT_B ? ADMIN_ALUMNO02 : ADMIN_ALUMNO01);

/** ¿Respondió 2xx? */
export const isOk = (result: ApiResult): boolean => result.status >= 200 && result.status < 300;

/** Evidencia de una respuesta que no es 2xx: estado y cuerpo recortado (sin tokens). Vacía si la respuesta fue 2xx. */
export const notOkEvidence = (result: ApiResult): Readonly<Record<string, unknown>> =>
  isOk(result) ? {} : { respuestaNo2xx: { status: result.status, cuerpo: JSON.stringify(result.body ?? null).slice(0, 400) } };

/** Un paso de preparación que no se cumplió: qué se intentaba y la respuesta cruda. */
export interface Failed {
  readonly step: string;
  readonly result: ApiResult;
}

// --- Resumen, simulador y reinicio --------------------------------------------------------------------------------------------

/** `GET /api/mission/summary`: la cabecera `x-tenant` es la que pide la fila; el token, el de la cuenta de la fila (o ninguno). */
export const summaryOf = (token: string | undefined, tenant: string = TENANT_A): Promise<ApiResult> =>
  call('GET', '/mission/summary', { tenant, ...(token === undefined ? {} : { token }) });

/** `POST /api/mission/tick`, sin cuerpo: la cabecera `x-tenant` es la que pide la fila. */
export const tickOf = (token: string | undefined, tenant: string = TENANT_A): Promise<ApiResult> =>
  call('POST', '/mission/tick', { tenant, ...(token === undefined ? {} : { token }) });

/** Comprueba que los 24 programas del seed existen (la preparación de la historia). Devuelve el fallo si no. */
export const seedPresent = async (token: string): Promise<Failed | undefined> => {
  const listed = await call('GET', '/programs', { tenant: TENANT_A, token, query: 'pageSize=1' });
  const totalAll = field(listed.body, 'totalAll');
  if (!isOk(listed) || totalAll !== 24) return { step: `existen 24 programas del seed (totalAll ${String(totalAll)})`, result: listed };
  return undefined;
};

// --- Cambios de preparación --------------------------------------------------------------------------------------------------

/** Un cambio que la historia nombra como preparación: devuelve su respuesta, o `undefined` si la fila no cambia nada. */
export type Change = (token: string) => Promise<ApiResult | undefined>;

const act = (method: 'POST' | 'PATCH' | 'DELETE', path: string, token: string, body?: unknown): Promise<ApiResult> =>
  call(method, path, { tenant: TENANT_A, token, ...(body === undefined ? {} : { body }) });

const noChange: Change = async () => undefined;

const archivePrg001: Change = (token) => act('POST', '/programs/PRG-001/archive', token);

/** Cambios de programas de la historia 002 (Esquema 2): la clave es el texto exacto de la celda `cambio`. */
export const PROGRAM_CHANGES: ReadonlyMap<string, Change> = new Map<string, Change>([
  ['no hay ningún cambio en los programas', noChange],
  ['alumno01@sigpro.lab archiva PRG-001 con POST /api/programs/PRG-001/archive', archivePrg001],
]);

/** Cambios de no conformidades de la historia 002 (Esquema 4). Los textos incluyen las comillas invertidas que trae la celda. */
export const NC_CHANGES: ReadonlyMap<string, Change> = new Map<string, Change>([
  ['no hay ningún cambio en las no conformidades', noChange],
  ['alumno01@sigpro.lab cambia con PATCH /api/nc/NC-001 la severidad a `critical`', (token) => act('PATCH', '/nc/NC-001', token, { severity: 'critical' })],
  ['alumno01@sigpro.lab pasa NC-002 a `rejected` con POST /api/nc/NC-002/transition', (token) => act('POST', '/nc/NC-002/transition', token, { to: 'rejected' })],
  [
    'alumno01@sigpro.lab pasa NC-003 a `closed` con POST /api/nc/NC-003/transition y el comentario `Acción correctiva verificada por calidad`',
    (token) => act('POST', '/nc/NC-003/transition', token, { to: 'closed', comment: 'Acción correctiva verificada por calidad' }),
  ],
  [
    'alumno01@sigpro.lab registra con POST /api/nc una NC en PRG-002 con severidad `major` y la descripción `Desviación de prueba en la ejecución`',
    (token) => act('POST', '/nc', token, { programCode: 'PRG-002', severity: 'major', description: 'Desviación de prueba en la ejecución' }),
  ],
]);

/** Los 24 códigos del seed de alumno01 (PRG-001 a PRG-024). */
export const PROGRAM_CODES: readonly string[] = Array.from({ length: 24 }, (_, index) => `PRG-${String(index + 1).padStart(3, '0')}`);

/** Archiva los programas en estado activo de alumno01 (la historia dice 12: si no son 12, la preparación no se cumple). */
export const archiveActive = async (token: string): Promise<Failed | undefined> => {
  const listed = await call('GET', '/programs', { tenant: TENANT_A, token, query: 'pageSize=100' });
  if (!isOk(listed)) return { step: 'listar los programas', result: listed };
  const items = listOf(listed.body, 'items') ?? [];
  const active = items.filter((item) => field(item, 'status') === 'active').map((item) => String(field(item, 'code')));
  if (active.length !== 12) return { step: `listar los 12 programas activos (hay ${active.length})`, result: listed };
  for (const code of active) {
    const result = await act('POST', `/programs/${code}/archive`, token);
    if (!isOk(result)) return { step: `archivar ${code} con POST /api/programs/${code}/archive`, result };
  }
  return undefined;
};

/** Borra los 24 programas de alumno01, uno a uno (la historia nombra «elimina los 24 programas con DELETE /api/programs/:code»). */
export const removeAll = async (token: string): Promise<Failed | undefined> => {
  for (const code of PROGRAM_CODES) {
    const result = await act('DELETE', `/programs/${code}`, token);
    if (!isOk(result)) return { step: `eliminar ${code} con DELETE /api/programs/${code}`, result };
  }
  return undefined;
};

/** Cuerpo de texto de una respuesta: JSON si lo es, texto si no, `null` si está vacía. */
const parseText = (text: string): unknown => {
  if (text.length === 0) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
};

/** `POST /api/test-cases/<código>/runs` como formulario multipart (campo `result`), con la cuenta de la fila. Un fallo de conexión es estado 0. */
export const runOf = async (token: string, code: string, result: string): Promise<ApiResult> => {
  const form = new FormData();
  form.append('result', result);
  try {
    const response = await fetch(`${API_URL}/test-cases/${code}/runs`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'x-tenant': TENANT_A },
      body: form,
    });
    return { status: response.status, body: parseText(await response.text()), ms: 0 };
  } catch (error) {
    return { status: 0, body: { transporte: error instanceof Error ? error.message.split('\n')[0] : String(error) }, ms: 0 };
  }
};

const runChange = (code: string, result: string): Change => (token) => runOf(token, code, result);

/** Ejecuciones de la historia 003 (Esquema 2 a 4). */
export const RUN_CHANGES: ReadonlyMap<string, Change> = new Map<string, Change>([
  ['no hay ningún cambio en las ejecuciones', noChange],
  ['alumno01@sigpro.lab ejecuta TC-001 con POST /api/test-cases/TC-001/runs y el resultado `pass`', runChange('TC-001', 'pass')],
  ['alumno01@sigpro.lab ejecuta TC-002 con POST /api/test-cases/TC-002/runs y el resultado `blocked`', runChange('TC-002', 'blocked')],
  ['alumno01@sigpro.lab ejecuta TC-003 con POST /api/test-cases/TC-003/runs y el resultado `fail`', runChange('TC-003', 'fail')],
]);

// --- Lectura estricta de celdas ----------------------------------------------------------------------------------------------

/** Un número entero de una celda («56», «-1»). Cualquier otra forma LANZA. */
export const integerOf = (row: ManifestRow, column: string): number => {
  const text = cell(row, column);
  if (!/^-?\d+$/.test(text)) throw new Error(`celda sin interpretación: «${text}» en la columna ${column} no es un entero`);
  return Number(text);
};

/** Código de programa de una celda («PRG-004»), o `null` para «(ninguno)». Cualquier otra forma LANZA. */
export const programOf = (text: string): string | null => {
  if (text === '(ninguno)') return null;
  if (!/^PRG-\d{3}$/.test(text)) throw new Error(`celda sin interpretación: programa «${text}»`);
  return text;
};

/** Pares «clave valor» de una celda de variables («program PRG-004 y value 5» → { program: 'PRG-004', value: '5' }). Otra forma LANZA. */
export const varsOf = (text: string): Readonly<Record<string, string>> => {
  const pairs = text.split(' y ').map((pair): readonly [string, string] => {
    const match = /^([a-z]+) (.+)$/.exec(pair.trim());
    if (!match?.[1] || !match[2]) throw new Error(`celda sin interpretación: variables «${text}»`);
    return [match[1], match[2]];
  });
  return Object.fromEntries(pairs);
};

// --- Comprobaciones ----------------------------------------------------------------------------------------------------------

/** Texto de un valor de la API para una frase («12», «(sin leer)» si no hay valor). */
export const showValue = (value: unknown): string => (value === undefined ? '(sin leer)' : typeof value === 'string' ? `«${value}»` : JSON.stringify(value));

/** Un campo de un objeto igual al esperado (comparación exacta de tipo y valor). */
export const fieldCheck = (label: string, item: unknown, key: string, expected: string | number | null): Check => {
  const observed = field(item, key);
  return check(observed === expected, `${label} ${String(expected)}`, `${label} ${showValue(observed)}`);
};

/** Las variables que nombra la celda, cada una igual (el valor numérico cuenta como número en el texto). */
export const varsCheck = (event: unknown, expected: Readonly<Record<string, string>>): Check => {
  const vars = field(event, 'vars');
  const ok = Object.entries(expected).every(([key, value]) => String(field(vars, key)) === value);
  const names = Object.keys(expected);
  return check(
    ok,
    `vars con ${Object.entries(expected).map(([key, value]) => `${key} ${value}`).join(' y ')}`,
    `vars con ${names.map((key) => `${key} ${String(field(vars, key))}`).join(' y ')}`,
  );
};

/** El evento de la respuesta de tick, o `undefined` si la respuesta no trae un objeto `event`. */
export const eventOf = (result: ApiResult): unknown => {
  const event = field(result.body, 'event');
  return typeof event === 'object' && event !== null ? event : undefined;
};

/** Una lista del resumen (vacía si no es una lista: quien llama decide si eso cuenta como «no legible»). */
export const listOf = (summary: unknown, key: string): readonly unknown[] | undefined => {
  const value = field(summary, key);
  return Array.isArray(value) ? value : undefined;
};

/** Las cifras de `kpis` tal como vienen (sin convertir). */
export const kpisOf = (summary: unknown): unknown => field(summary, 'kpis');

/** Cifra de `kpis` igual al número esperado. */
export const kpiCheck = (summary: unknown, kpi: string, expected: number): Check => {
  const observed = field(kpisOf(summary), kpi);
  return check(observed === expected, `${kpi} ${expected}`, `${kpi} ${showValue(observed)}`);
};


/** Emite `count` eventos con el token dado; falla con el primero que no responda 200. */
export const tickMany = async (token: string, count: number): Promise<Failed | undefined> => {
  for (let index = 0; index < count; index += 1) {
    const result = await tickOf(token);
    if (!isOk(result)) return { step: `emitir el evento ${index + 1} con POST /api/mission/tick`, result };
  }
  return undefined;
};

/** Enlace de preparación fallida: sirve para cualquier fila que no pudo llegar a su estado inicial. */
export const failedPreparation = (expected: string, failed: Failed): Outcome => preparationFailed(expected, failed.step, failed.result);


