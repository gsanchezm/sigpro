import { API_URL, call, field, type ApiResult } from '../../../story-runs/support/api';
import { DEMO, TENANT_A, TENANT_B, resetTenants, startSession, type Credentials } from '../../../story-runs/support/prepare';
import { check, conclude as concludeChecks, type Check } from '../../support/checks';
import type { ApiRowHandler, Outcome } from '../../core/framework';

/**
 * Veredicto de una fila a partir de sus comprobaciones. Si la fila discrepa, la nota dice en qué difiere (lo esperado frente a lo
 * observado de cada comprobación que no se cumplió): la nota es obligatoria para un hallazgo.
 */
export const conclude = (checks: readonly Check[], extra: Pick<Outcome, 'note' | 'evidence'> = {}): Outcome => {
  const result = concludeChecks(checks, extra);
  if (result.verdict !== 'discrepa') return result;
  const differs = checks
    .filter((entry) => !entry.ok)
    .map((entry) => `se esperaba ${entry.expected}; se observó ${entry.observed}`)
    .join(' | ');
  return { ...result, note: [extra.note, differs].filter((part) => part !== undefined && part !== '').join(' | ') };
};

/** Salvedad de las filas que solo ejecutan la parte de API: se nombra en el esperado y en el observado de cada comprobación. */
export const API_ONLY = "solo por API: la parte «desde la interfaz» no se ejecuta en esta superficie";

/** Nombra la llamada en cada comprobación de una fila que solo se ejecuta por la API (el veredicto no cambia). */
export const apiOnly = (checks: readonly Check[], prefix: string): Check[] =>
  checks.map((entry) => ({
    ok: entry.ok,
    expected: `${prefix}: ${entry.expected} [${API_ONLY}]`,
    observed: `${prefix}: ${entry.observed} [${API_ONLY}]`,
  }));

/**
 * Envoltorio de una fila que toca un tenant ajeno: reinicia los tenants indicados ANTES (lo hace la preparación) y DESPUÉS, aunque la
 * fila lance, para que ninguna fila deje a alumno02 con los datos que creó.
 */
export const restoring =
  (handler: ApiRowHandler, tenants: readonly string[] = [TENANT_A, TENANT_B]): ApiRowHandler =>
  async (row) => {
    try {
      return await handler(row);
    } finally {
      await resetTenants(tenants);
    }
  };

// Piezas comunes de las historias de API de EP-MULTITENANT-PERMISOS. Convenciones de esta épica:
//  - Cada fila reinicia SUS tenants antes de actuar y cada cuenta inicia sesión con POST /api/auth/login y su cabecera x-tenant.
//  - La preparación de alumno02 (la cuenta de OTRO alumno del curso) se hace con `prepareTenants`: sus operaciones están en
//    `ALUMNO02_STEPS` y cualquier paso que no responda lo esperado devuelve `preparationFailed` en la fila.
//  - Las comprobaciones de aislamiento comparan instantáneas del tenant ajeno ANTES y DESPUÉS de la acción (por id y en orden),
//    y además leen por API con el token de ESE tenant: nunca se juzga por lo que devuelve el propio tenant del token.

export const ALUMNO_25 = 'alumno25';
export const ADMIN_PASSWORD = 'Alumno1234!';

/** Cuenta de administración de un alumno (`alumnoNN@sigpro.lab`, rol admin, sin segundo factor). */
export const adminOf = (tenant: string): Credentials => ({ email: `${tenant}@sigpro.lab`, password: ADMIN_PASSWORD });

/** Cuentas de los roles del tenant alumno01 (las del seed). El rol admin es la cuenta de administración del alumno. */
export const ROLE_ACCOUNTS: ReadonlyMap<string, Credentials> = new Map<string, Credentials>([
  ['admin', adminOf(TENANT_A)],
  ['program_manager', DEMO.gestor],
  ['consultant', DEMO.consultor],
  ['auditor', DEMO.auditor],
]);

export type Access = { readonly token: string } | { readonly failed: ApiResult };

/** Inicia sesión y devuelve el accessToken, o la respuesta cruda si el login no da sesión (la fila lo reporta como preparación). */
export const accessOf = async (tenant: string, credentials: Credentials): Promise<Access> => {
  const started = await startSession(tenant, credentials);
  return started.session ? { token: started.session.accessToken } : { failed: started.result };
};

export const isFailed = (access: Access): access is { readonly failed: ApiResult } => 'failed' in access;

/** Lectura JSON segura de un cuerpo que puede no ser JSON. */
const parseJson = (text: string): unknown => {
  if (text.length === 0) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
};

/** `POST /api/test-cases/<code>/runs` como multipart (campo `result`, sin archivos): es la forma que espera el endpoint. */
export const runMultipart = async (tenant: string, token: string | undefined, testCode: string, result = 'pass'): Promise<ApiResult> => {
  const form = new FormData();
  form.append('result', result);
  const headers: Record<string, string> = { 'x-tenant': tenant };
  if (token !== undefined) headers.authorization = `Bearer ${token}`;
  const started = performance.now();
  const response = await fetch(`${API_URL}/test-cases/${testCode}/runs`, { method: 'POST', headers, body: form });
  return { status: response.status, body: parseJson(await response.text()), ms: Math.round(performance.now() - started) };
};

/** Lectura de un cuerpo por API con el token y el tenant indicados. */
export const get = (tenant: string, token: string, path: string): Promise<ApiResult> => call('GET', path, { tenant, token });

/** El cuerpo de una lectura, o `undefined` si no es 200 (una instantánea de un 404 cuenta como su propio estado). */
export const snapshotBody = async (tenant: string, token: string, path: string): Promise<unknown> => {
  const result = await get(tenant, token, path);
  return { status: result.status, body: result.body };
};

/** Instantánea completa de los recursos citados: se compara como texto (el orden de claves lo fija la API). */
export const snapshotOf = async (tenant: string, token: string, paths: readonly string[]): Promise<string> => JSON.stringify(await Promise.all(paths.map((path) => snapshotBody(tenant, token, path))));

/** Lista de códigos de los elementos de un cuerpo con `items` o de un array directo. */
export const itemsOf = (body: unknown): readonly Record<string, unknown>[] => {
  const items = Array.isArray(body) ? body : field(body, 'items');
  return Array.isArray(items) ? (items as Record<string, unknown>[]) : [];
};

export const codesOf = (body: unknown, key = 'code'): readonly string[] => itemsOf(body).map((item) => String(item[key]));

/** Comprobación de estado y, si lo hay, del código de error (`code`), con la frase del estado esperado y lo observado. */
export const statusCheck = (result: ApiResult, status: number, code?: string): Check =>
  check(
    result.status === status && (code === undefined || field(result.body, 'code') === code),
    code === undefined ? `respuesta ${status}` : `respuesta ${status} ${code}`,
    `respuesta ${result.status}${typeof field(result.body, 'code') === 'string' ? ` ${String(field(result.body, 'code'))}` : ''}`,
  );

/** Un campo de un cuerpo con su nombre, para frases de comprobación. */
export const valueCheck = (result: ApiResult, key: string, expected: unknown, label: string): Check => {
  const observed = field(result.body, key);
  return check(observed === expected, `${label} ${String(expected)}`, observed === undefined ? `${label} (ausente)` : `${label} ${String(observed)}`);
};

/** Motivo de un 422 para el campo que se nombra (`errors.<campo>`); `undefined` si el cuerpo no lo trae. */
export const fieldReason = (result: ApiResult, fieldName: string): string | undefined => {
  const errors = field(result.body, 'errors');
  const reason = typeof errors === 'object' && errors !== null ? (errors as Record<string, unknown>)[fieldName] : undefined;
  return typeof reason === 'string' ? reason : undefined;
};

// --- Preparación de alumno02 (la cuenta de OTRO alumno del curso) --------------------------------------------------------

export type Profile = 'completo' | 'basico' | 'documental';

export interface Isolation {
  readonly token01: string;
  readonly token02: string;
  /** Ejecución de TC-001 que registró alumno02: id y fecha exactos devueltos por la API (la fecha distingue la ejecución). */
  readonly run?: { readonly id: string; readonly executedAt: string };
}

export type Prepared = { readonly ok: Isolation } | { readonly failed: { readonly step: string; readonly result: ApiResult } };

interface Step {
  readonly label: string;
  readonly run: (token02: string) => Promise<ApiResult>;
  readonly status: number;
  /** Valida la respuesta del paso (código de la entidad creada, versión…); `undefined` si el paso no lo exige. */
  readonly verify: (result: ApiResult) => boolean;
  /** Si el paso crea una ejecución, la guarda para comprobarla después. */
  readonly capture?: (result: ApiResult) => Isolation['run'];
}

const B = TENANT_B;

const ISOLATION_STEPS: ReadonlyMap<string, Step> = new Map<string, Step>([
  [
    'renombra PRG-001',
    {
      label: 'renombrar PRG-001 a «Programa de aislamiento»',
      run: (token) => call('PATCH', '/programs/PRG-001', { tenant: B, token, body: { name: 'Programa de aislamiento' } }),
      status: 200,
      verify: (result) => field(result.body, 'name') === 'Programa de aislamiento',
    },
  ],
  [
    'crea PRG-025',
    {
      label: 'crear PRG-025 «Programa de aislamiento nuevo»',
      run: (token) =>
        call('POST', '/programs', {
          tenant: B,
          token,
          body: { name: 'Programa de aislamiento nuevo', ownerId: 'u1', startDate: '2026-03-01', endDate: '2026-12-31', budget: 150000 },
        }),
      status: 201,
      verify: (result) => field(result.body, 'code') === 'PRG-025',
    },
  ],
  [
    'crea REQ-041',
    {
      label: 'crear REQ-041 en PRG-001 «Requisito solo de alumno02»',
      run: (token) => call('POST', '/requirements', { tenant: B, token, body: { programCode: 'PRG-001', title: 'Requisito solo de alumno02' } }),
      status: 201,
      verify: (result) => field(result.body, 'code') === 'REQ-041',
    },
  ],
  [
    'crea NC-013',
    {
      label: 'crear NC-013 en PRG-025 «Desviación solo de alumno02»',
      run: (token) => call('POST', '/nc', { tenant: B, token, body: { programCode: 'PRG-025', severity: 'minor', description: 'Desviación solo de alumno02' } }),
      status: 201,
      verify: (result) => field(result.body, 'code') === 'NC-013',
    },
  ],
  [
    'crea PRG-025-M01',
    {
      label: 'crear el hito PRG-025-M01 «Hito solo de alumno02»',
      run: (token) => call('POST', '/programs/PRG-025/milestones', { tenant: B, token, body: { name: 'Hito solo de alumno02', dueDate: '2026-06-30' } }),
      status: 201,
      verify: (result) => field(result.body, 'id') === 'PRG-025-M01',
    },
  ],
  [
    'registra ejecución de TC-001',
    {
      label: 'registrar una ejecución de TC-001 con resultado pass',
      run: (token) => runMultipart(B, token, 'TC-001'),
      status: 201,
      verify: (result) => typeof field(result.body, 'id') === 'string',
      capture: (result) => ({ id: String(field(result.body, 'id')), executedAt: String(field(result.body, 'executedAt')) }),
    },
  ],
  [
    'publica versión 4 de DOC-001',
    {
      label: 'publicar la versión 4 de DOC-001 «Versión solo de alumno02»',
      run: (token) => call('POST', '/documents/DOC-001/versions', { tenant: B, token, body: { lines: ['Versión solo de alumno02'] } }),
      status: 201,
      verify: (result) => field(result.body, 'version') === 4,
    },
  ],
]);

/** Pasos de alumno02 por perfil, en el orden en que la historia los describe. */
const PROFILE_STEPS: ReadonlyMap<Profile, readonly string[]> = new Map<Profile, readonly string[]>([
  ['completo', ['renombra PRG-001', 'crea PRG-025', 'crea REQ-041', 'crea NC-013', 'crea PRG-025-M01', 'registra ejecución de TC-001', 'publica versión 4 de DOC-001']],
  ['basico', ['renombra PRG-001', 'crea PRG-025']],
  ['documental', ['renombra PRG-001', 'crea PRG-025', 'publica versión 4 de DOC-001', 'crea PRG-025-M01']],
]);

/**
 * Reinicia alumno01 y alumno02 con el token de SU administrador, inicia sesión en ambos y, en alumno02, aplica los pasos del perfil.
 * Los pasos de alumno02 los hace su administrador; alumno01 no recibe ninguna de estas operaciones.
 */
export const prepareTenants = async (profile: Profile): Promise<Prepared> => {
  await resetTenants([TENANT_A, TENANT_B]);
  const a = await accessOf(TENANT_A, adminOf(TENANT_A));
  if (isFailed(a)) return { failed: { step: 'admin de alumno01 inicia sesión', result: a.failed } };
  const b = await accessOf(TENANT_B, adminOf(TENANT_B));
  if (isFailed(b)) return { failed: { step: 'admin de alumno02 inicia sesión', result: b.failed } };
  let run: Isolation['run'] = undefined;
  for (const name of PROFILE_STEPS.get(profile) ?? []) {
    const step = ISOLATION_STEPS.get(name);
    if (!step) throw new Error(`paso de preparación desconocido: ${name}`);
    const result = await step.run(b.token);
    if (result.status !== step.status || !step.verify(result)) return { failed: { step: step.label, result } };
    run = step.capture?.(result) ?? run;
  }
  return { ok: { token01: a.token, token02: b.token, ...(run ? { run } : {}) } };
};

/** Códigos de un listado ordenados: se comparan como conjunto, sin fijar el orden que devuelve la API. */
export const sortedCodes = (body: unknown): readonly string[] => codesOf(body).slice().sort();

// --- Instantáneas de estado (aislamiento): estado y cuerpo de cada ruta citada, sin tiempos de respuesta -------------------

export interface Snap {
  readonly status: number;
  readonly body: unknown;
}
export type Snapshots = Readonly<Record<string, Snap>>;

/** Lee cada ruta con el token y el tenant indicados (en orden) y guarda estado y cuerpo; el tiempo de respuesta no se guarda. */
export const readSnapshots = async (tenant: string, token: string, paths: readonly string[]): Promise<Snapshots> => {
  const out: Record<string, Snap> = {};
  for (const path of paths) {
    const result = await call('GET', path, { tenant, token });
    out[path] = { status: result.status, body: result.body };
  }
  return out;
};

/** El cuerpo de una ruta de una instantánea. */
export const bodyAt = (snapshots: Snapshots, path: string): unknown => snapshots[path]?.body;

/** Comprobación de «no cambia»: las rutas indicadas dan la misma respuesta antes y después. */
export const unchanged = (before: Snapshots, after: Snapshots, paths: readonly string[], label: string): Check => {
  const changed = paths.filter((path) => JSON.stringify(before[path]) !== JSON.stringify(after[path]));
  return check(changed.length === 0, `${label} sin cambios`, changed.length === 0 ? `${label} sin cambios` : `cambian: ${changed.join(', ')}`);
};
