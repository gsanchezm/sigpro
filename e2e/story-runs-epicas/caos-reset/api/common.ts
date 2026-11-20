import { adminToken, call, errorCode, field, login, NO_CHAOS, sessionOf, setChaos, type ApiResult } from '../../../story-runs/support/api';
import { resetTenants, type Credentials } from '../../../story-runs/support/prepare';
import { check, type Check } from '../../support/checks';
import { outcome, type Outcome } from '../../core/framework';

// Piezas comunes de los manejadores de API de EP-CAOS-RESET. Todas las filas parten de un reinicio de alumno01 y de un caos en
// reposo (`prepareTenant`), y al terminar (pase lo que pase) vuelven a reiniciarse los tenants que usó la fila y a apagarse su caos
// (`withRestore`). El reinicio NO apaga el caos ni invalida tokens: por eso el caos se apaga siempre al final.

/** Cuenta de alumno de un tenant: `alumnoNN@sigpro.lab` (contraseña del seed de alumno). Su administrador reinicia y gestiona el caos. */
export const STUDENT_PASSWORD = 'Alumno1234!';

/** Cuerpo base de las altas de programa (Reglas de las historias 001, 003 y 007). */
export const PROGRAM_BODY = { name: 'Programa de prueba alfa', ownerId: 'u2', startDate: '2027-03-01', endDate: '2027-03-02', budget: 900000 } as const;
/** Nombre del programa dado de alta por el cuerpo base. */
export const PROGRAM_NAME = 'Programa de prueba alfa';
/** Nombre que la historia 003 pone a PRG-001 para comprobar que el reinicio lo devuelve al seed. */
export const RENAMED_NAME = 'Nombre de prueba';
/** Código que recibe la primera alta tras un reinicio (la semilla llega hasta PRG-024). */
export const FIRST_NEW_CODE = 'PRG-025';

/** Credenciales del gestor del seed (`gestor@sigpro.test`); el id del usuario es `u2` en todos los tenants. */
export const GESTOR: Credentials = { email: 'gestor@sigpro.test', password: 'Gestor1234!' };
export const CONSULTOR: Credentials = { email: 'consultor@sigpro.test', password: 'Consul1234!' };
export const AUDITOR: Credentials = { email: 'auditor@sigpro.test', password: 'Audit1234!' };

/** Cuenta de administración de un tenant de alumno (`alumnoNN@sigpro.lab`). */
export const studentAdmin = (tenant: string): Credentials => ({ email: `${tenant}@sigpro.lab`, password: STUDENT_PASSWORD });

// --- Caos ------------------------------------------------------------------------------------------------------------------

/** Valor de un campo de la configuración del caos tal como lo devuelve la API (puede faltar: `undefined`). */
export const shown = (value: unknown): string => (value === undefined ? '(ausente)' : String(value));

/** Los tres campos del caos de un cuerpo de respuesta (`GET /api/admin/chaos`, `PATCH` o `GET /api/config`.chaos). */
export const chaosOf = (body: unknown): { readonly latencyMs: unknown; readonly errorRate: unknown; readonly flakyLabels: unknown } => ({
  latencyMs: field(body, 'latencyMs'),
  errorRate: field(body, 'errorRate'),
  flakyLabels: field(body, 'flakyLabels'),
});

/** Frase observada con los tres campos del caos, medidos. */
export const describeChaos = (body: unknown): string => {
  const chaos = chaosOf(body);
  return `latencyMs ${shown(chaos.latencyMs)}, errorRate ${shown(chaos.errorRate)}, flakyLabels ${shown(chaos.flakyLabels)}`;
};

/** ¿Está el caos en reposo (latencia 0, tasa 0 y textos sin variar)? Un valor no legible NO cuenta como reposo. */
export const isRestChaos = (body: unknown): boolean => {
  const chaos = chaosOf(body);
  return chaos.latencyMs === 0 && chaos.errorRate === 0 && chaos.flakyLabels === false;
};

/** Comprobación de que el caos de un tenant (cuerpo de `GET /api/admin/chaos`) tiene esos valores exactos. */
export const chaosIs = (body: unknown, expected: { readonly latencyMs: number; readonly errorRate: number; readonly flakyLabels: boolean }, what: string): Check => {
  const chaos = chaosOf(body);
  const ok = chaos.latencyMs === expected.latencyMs && chaos.errorRate === expected.errorRate && chaos.flakyLabels === expected.flakyLabels;
  return check(ok, `${what} latencyMs ${expected.latencyMs}, errorRate ${expected.errorRate} y flakyLabels ${String(expected.flakyLabels)}`, `${what} ${describeChaos(body)}`);
};

// --- Sesiones y tokens -----------------------------------------------------------------------------------------------------

/** Inicio de sesión de una cuenta en un tenant: token de acceso y refreshToken si los trae; la respuesta cruda siempre. */
export const sessionOfAccount = async (
  tenant: string,
  credentials: Credentials,
  remember?: boolean,
): Promise<{ readonly token?: string; readonly refreshToken?: string; readonly result: ApiResult }> => {
  const result = await login({ tenant, email: credentials.email, password: credentials.password, ...(remember === undefined ? {} : { remember }) });
  const session = sessionOf(result);
  return { token: session?.accessToken, refreshToken: session?.refreshToken, result };
};

/** Token de acceso del administrador de un tenant. Un fallo de este inicio de sesión es de fontanería (lanza). */
export const adminAccess = (tenant: string): Promise<string> => adminToken(tenant);

// --- Preparación, restauración y lectura de respuestas ----------------------------------------------------------------------

/**
 * Preparación de cada fila sobre un tenant: reinicio con el token de su administrador y caos en reposo (lee `GET /api/admin/chaos` y,
 * si no está apagado, lo apaga con `PATCH`). Un fallo del reinicio o del login de administración lanza: es fontanería del arnés.
 */
export const prepareTenant = async (tenant: string): Promise<void> => {
  await resetTenants([tenant]);
  const token = await adminAccess(tenant);
  const current = await call('GET', '/admin/chaos', { tenant, token });
  if (current.status !== 200) throw new Error(`GET /api/admin/chaos de ${tenant} responde ${current.status}: no se puede comprobar el caos`);
  if (isRestChaos(current.body)) return;
  const off = await setChaos(tenant, NO_CHAOS);
  if (off.status !== 200) throw new Error(`PATCH /api/admin/chaos de ${tenant} responde ${off.status}: el caos no se apaga`);
};

/**
 * Deja cada tenant como lo pide la historia al terminar: lo reinicia y le apaga el caos. Si la limpieza falla LANZA (error de prueba del
 * arnés, no un hallazgo sobre la app): la fila no queda como válida con el tenant sucio.
 */
export const restoreTenants = async (tenants: readonly string[]): Promise<void> => {
  for (const tenant of tenants) {
    await resetTenants([tenant]);
    const off = await setChaos(tenant, NO_CHAOS);
    if (off.status !== 200) throw new Error(`limpieza de ${tenant}: PATCH /api/admin/chaos responde ${off.status}`);
  }
};

/** Ejecuta la fila y, pase lo que pase, restaura los tenants que usó: reinicio y caos apagado. Si la limpieza falla, lanza. */
export const withRestore = async (tenants: readonly string[], run: () => Promise<Outcome>): Promise<Outcome> => {
  let result: Outcome;
  try {
    result = await run();
  } catch (error) {
    await restoreTenants(tenants).catch(() => undefined);
    throw error;
  }
  await restoreTenants(tenants);
  return result;
};

/** Respuesta esperada de una celda: código HTTP, `code` del cuerpo, `attempts` y si trae accessToken. */
export interface Expect {
  readonly status: number;
  readonly code?: string;
  readonly attempts?: number;
  readonly accessToken?: boolean;
}

/** Frase observada de una respuesta, a partir de lo medido (estado, código, intentos y accessToken). */
export const describeResult = (result: ApiResult): string => {
  const code = errorCode(result);
  const attempts = field(result.body, 'attempts');
  const hasAccess = typeof field(result.body, 'accessToken') === 'string';
  return [String(result.status), code ?? '', typeof attempts === 'number' ? `con attempts ${attempts}` : '', hasAccess ? 'con accessToken' : '']
    .filter((part) => part !== '')
    .join(' ');
};

/** Comprobación de una respuesta contra lo que dice su celda (`expectedText` es el texto de la historia; `expected`, su lectura). */
export const expectCheck = (result: ApiResult, expectedText: string, expected: Expect): Check => {
  const attempts = field(result.body, 'attempts');
  const hasAccess = typeof field(result.body, 'accessToken') === 'string';
  const ok =
    result.status === expected.status &&
    (expected.code === undefined || errorCode(result) === expected.code) &&
    (expected.attempts === undefined || attempts === expected.attempts) &&
    (expected.accessToken === undefined || hasAccess === expected.accessToken);
  return check(ok, expectedText, `respuesta ${describeResult(result)}`);
};

/** Comprobación del campo `tenant` de la respuesta (el de la historia, leído de la celda). */
export const tenantField = (body: unknown, tenant: string): Check => {
  const value = field(body, 'tenant');
  return check(value === tenant, `el campo tenant es ${tenant}`, `el campo tenant es ${shown(value)}`);
};

/** Código de un programa en un cuerpo de la API (`code`), o `undefined` si no es texto. */
export const codeOf = (body: unknown): string | undefined => {
  const code = field(body, 'code');
  return typeof code === 'string' ? code : undefined;
};

/** Nombre de un programa en un cuerpo de la API, o `undefined` si no es texto. */
export const nameOf = (body: unknown): string | undefined => {
  const name = field(body, 'name');
  return typeof name === 'string' ? name : undefined;
};

/**
 * Nota de una fila que no coincide: en qué difiere (la comprobación que falla, con lo que dice la historia y lo que se observó).
 * Se añade a la nota que ya traiga la fila; una fila que coincide no lleva nota de diferencia.
 */
export const withDifference = (checks: readonly Check[], extra: Pick<Outcome, 'note' | 'evidence'>): Pick<Outcome, 'note' | 'evidence'> => {
  const failing = checks.filter((entry) => !entry.ok);
  if (failing.length === 0) return extra;
  const difference = `Difiere en: ${failing.map((entry) => `«${entry.expected}» (observado: ${entry.observed})`).join('; ')}.`;
  const note = [extra.note, difference].filter((part): part is string => part !== undefined && part !== '').join(' ');
  return { ...extra, note };
};

/** Resultado de una fila a partir de sus comprobaciones (coincide solo si todas se cumplen). */
export const rowOutcome = (checks: readonly Check[], extra: Pick<Outcome, 'note' | 'evidence'> = {}): Outcome =>
  outcome(
    checks.every((entry) => entry.ok),
    checks.map((entry) => entry.expected).join('; '),
    checks.map((entry) => entry.observed).join('; '),
    withDifference(checks, extra),
  );

/** Ruta de programa de la API (`/programs/PRG-001`): se usa solo con códigos ya leídos de la historia. */
export const programPath = (code: string): string => `/programs/${code}`;

/** Petición de la API con el token dado y el tenant de la cabecera (`undefined` = sin cabecera). */
export const withToken = (method: 'GET' | 'POST' | 'PATCH', path: string, tenant: string | undefined, token: string | undefined, body?: unknown): Promise<ApiResult> =>
  call(method, path, {
    ...(tenant === undefined ? {} : { tenant }),
    ...(token === undefined ? {} : { token }),
    ...(body === undefined ? {} : { body }),
  });

/** Evento más reciente de la auditoría del tenant (`GET /api/audit`, del más reciente al más antiguo): id, acción y diff. */
export interface NewestAudit {
  readonly id?: string;
  readonly action?: string;
  readonly diff?: unknown;
}
export const newestAudit = async (tenant: string, token: string): Promise<NewestAudit> => {
  const page = await call('GET', '/audit', { tenant, token, query: 'limit=1' });
  const items = field(page.body, 'items');
  const first = Array.isArray(items) ? items[0] : undefined;
  const id = field(first, 'id');
  const action = field(first, 'action');
  return {
    ...(typeof id === 'string' ? { id } : {}),
    ...(typeof action === 'string' ? { action } : {}),
    diff: field(first, 'diff'),
  };
};

/**
 * Marca de datos para las filas que afirman «no reinicia nada»: alta de un programa con el cuerpo base por gestor@sigpro.test. Si un
 * reinicio se ejecutara, el programa desaparecería. Devuelve el token y el código, o el motivo si la alta no se hace.
 */
export const markerProgram = async (tenant: string): Promise<{ readonly token?: string; readonly code?: string; readonly error?: string }> => {
  const gestor = await sessionOfAccount(tenant, GESTOR);
  if (gestor.token === undefined) return { error: `gestor@sigpro.test no inicia sesión en ${tenant}` };
  const created = await withToken('POST', '/programs', tenant, gestor.token, PROGRAM_BODY);
  const code = codeOf(created.body);
  if (created.status !== 201 || code === undefined) return { error: `la alta de la marca de datos responde ${created.status}` };
  return { token: gestor.token, code };
};

/** Comprobación de que la marca de datos sigue existiendo tras la fila (la alta sigue en el tenant). */
export const markerKept = async (tenant: string, token: string, code: string): Promise<Check> => {
  const read = await withToken('GET', `/programs/${code}`, tenant, token);
  const kept = read.status === 200 && codeOf(read.body) === code;
  return check(kept, `el programa ${code} dado de alta antes sigue existiendo (los datos no cambian)`, `GET /api/programs/${code} responde ${read.status}`);
};
