import { API_URL, call, errorCode, field, sessionOf, type ApiResult } from '../../../story-runs/support/api';
import { DEMO, TENANT_A, startSession, type Credentials } from '../../../story-runs/support/prepare';
import { check, type Check } from '../../support/checks';

// Piezas comunes de las filas de API de EP-PROG-GESTION: cuentas con su sesión (el administrador pasa por el segundo factor),
// peticiones al tenant alumno01, lectura de la exportación CSV (cabeceras y texto crudo) y comprobaciones de la respuesta.
// Los textos de las celdas se traducen con mapas estrictos: un texto que no conocen LANZA (una celda nueva no se ignora).

export { TENANT_A, resetTenants } from '../../../story-runs/support/prepare';

/** Código del segundo factor del seed (el de «admin@sigpro.test»). */
export const MFA_CODE = '123456';

export type AccountKey = 'gestor' | 'consultor' | 'auditor' | 'admin';

const ACCOUNTS: Readonly<Record<AccountKey, Credentials>> = {
  gestor: DEMO.gestor,
  consultor: DEMO.consultor,
  auditor: DEMO.auditor,
  admin: DEMO.admin,
};

/** Cuenta de la celda → clave de su sesión (el mapa conoce cada correo; cualquier otro LANZA al usarse con `strict`). */
export const ACCOUNT_OF: ReadonlyMap<string, AccountKey> = new Map<string, AccountKey>([
  ['gestor@sigpro.test', 'gestor'],
  ['consultor@sigpro.test', 'consultor'],
  ['auditor@sigpro.test', 'auditor'],
  ['admin@sigpro.test', 'admin'],
]);

/** Sesión de una cuenta: su access token (o `undefined` si el inicio de sesión no lo dio) y la última respuesta para explicar un fallo. */
export interface SessionOf {
  readonly token: string | undefined;
  readonly last: ApiResult;
}

const EMPTY: ApiResult = { status: 0, body: null, ms: 0 };

/**
 * Inicia sesión en alumno01 con la cuenta: gestor, consultor y auditor con su contraseña; admin completa el segundo factor con
 * 123456 (`POST /api/auth/mfa`) y usa el access token que recibe. Las peticiones llevan la cabecera `x-tenant: alumno01`.
 */
export const sessionFor = async (account: AccountKey): Promise<SessionOf> => {
  const started = await startSession(TENANT_A, ACCOUNTS[account]);
  if (account !== 'admin') return { token: started.session?.accessToken, last: started.result };
  const mfaToken = field(started.result.body, 'mfaToken');
  if (typeof mfaToken !== 'string') return { token: undefined, last: started.result };
  const redeemed = await call('POST', '/auth/mfa', { tenant: TENANT_A, body: { mfaToken, code: MFA_CODE } });
  return { token: sessionOf(redeemed)?.accessToken, last: redeemed };
};

/** Cabecera Authorization de la fila: sin cabecera, un texto que no es un token, o el token de una cuenta (la sesión la inicia la fila). */
export type Credential = { readonly kind: 'none' } | { readonly kind: 'text' } | { readonly kind: 'account'; readonly account: AccountKey };

export const CREDENTIAL_OF: ReadonlyMap<string, Credential> = new Map<string, Credential>([
  ['(sin cabecera Authorization)', { kind: 'none' }],
  ['(un texto que no es un token)', { kind: 'text' }],
  ['el accessToken de gestor@sigpro.test', { kind: 'account', account: 'gestor' }],
  ['el accessToken de consultor@sigpro.test', { kind: 'account', account: 'consultor' }],
  ['el accessToken de auditor@sigpro.test', { kind: 'account', account: 'auditor' }],
  ['el accessToken de admin@sigpro.test', { kind: 'account', account: 'admin' }],
]);

/** Token que envía la fila según su credencial (sin cabecera → `undefined`; texto inválido → un texto que no es un JWT). */
export const tokenOf = async (credential: Credential): Promise<SessionOf> => {
  if (credential.kind === 'none') return { token: undefined, last: EMPTY };
  if (credential.kind === 'text') return { token: 'un texto que no es un token', last: EMPTY };
  return sessionFor(credential.account);
};

/** Una petición al tenant alumno01 con el token dado (sin cabecera si no hay token). */
export const act = (method: 'GET' | 'POST' | 'DELETE', path: string, token?: string, body?: unknown): Promise<ApiResult> =>
  call(method, path, { tenant: TENANT_A, ...(token === undefined ? {} : { token }), ...(body === undefined ? {} : { body }) });

/** Total de programas del tenant (`totalAll` de la lista, sin filtros) leído con el token dado. */
export const totalOf = async (token: string): Promise<number | undefined> => {
  const listed = await act('GET', '/programs?pageSize=1', token);
  const total = field(listed.body, 'totalAll');
  return typeof total === 'number' ? total : undefined;
};

/** Cuántos programas dice la fila que hay, comparado con el total leído con el token dado. */
export const totalCheck = (observed: number | undefined, expected: number): Check =>
  check(observed === expected, `el tenant tiene ${expected} programas`, `el tenant tiene ${observed === undefined ? '(sin leer)' : observed} programas`);

/** Comprobaciones de campos del cuerpo: cada par «campo, valor» debe coincidir como texto exacto (los números y booleanos, como su texto). */
export const fieldChecks = (body: unknown, pairs: ReadonlyArray<readonly [key: string, value: string]>): Check[] =>
  pairs.map(([key, value]) => {
    const observed = String(field(body, key));
    return check(observed === value, `${key} ${value}`, `${key} ${observed}`);
  });

/**
 * Respuesta de la celda: «401 missing_token», «403 forbidden», «204 sin cuerpo», «201 con code PRG-025 y status draft» o
 * «200 con status closed». Cualquier otra forma LANZA. Comprueba el código HTTP, el `code` de error o el cuerpo que diga.
 */
export const answerChecks = (text: string, result: ApiResult): Check[] => {
  const head = /^(\d{3})(?: (sin cuerpo|con .+|[a-z_]+))?$/.exec(text.trim());
  if (!head?.[1]) throw new Error(`celda sin interpretación: respuesta «${text}»`);
  const status = Number(head[1]);
  const tail = head[2] ?? '';
  const checks: Check[] = [check(result.status === status, `respuesta ${status}`, `respuesta ${result.status}`)];
  if (tail === 'sin cuerpo') return [...checks, check(result.body === null, 'sin cuerpo', result.body === null ? 'sin cuerpo' : 'con cuerpo')];
  if (tail.startsWith('con ')) {
    for (const pair of tail.slice(4).split(' y ')) {
      const parts = /^(\w+) (.+)$/.exec(pair);
      if (!parts?.[1] || !parts[2]) throw new Error(`celda sin interpretación: campo «${pair}» de la respuesta «${text}»`);
      const observed = String(field(result.body, parts[1]));
      checks.push(check(observed === parts[2], `${parts[1]} ${parts[2]}`, `${parts[1]} ${observed}`));
    }
    return checks;
  }
  if (tail !== '') checks.push(check(errorCode(result) === tail, `código ${tail}`, `código ${errorCode(result) ?? '(sin código)'}`));
  return checks;
};

/** Respuesta de la exportación CSV: texto crudo, tipo, nombre de descarga y estado. */
export interface RawCsv {
  readonly status: number;
  readonly contentType: string;
  readonly disposition: string;
  readonly text: string;
}

/** `GET /api/programs/export` con la cadena de consulta dada (sin `?`) y el token opcional; no decodifica el cuerpo. */
export const rawExport = async (query: string | undefined, token: string | undefined): Promise<RawCsv> => {
  const headers: Record<string, string> = { 'x-tenant': TENANT_A, ...(token === undefined ? {} : { authorization: `Bearer ${token}` }) };
  const response = await fetch(`${API_URL}/programs/export${query ? `?${query}` : ''}`, { headers });
  return {
    status: response.status,
    contentType: response.headers.get('content-type') ?? '',
    disposition: response.headers.get('content-disposition') ?? '',
    text: await response.text(),
  };
};

/** Líneas del CSV: un salto de línea separa cada una; si el archivo acabara en salto, quedaría una línea vacía al final. */
export const csvLines = (text: string): readonly string[] => text.split('\n');

/** Código de error de un cuerpo de texto (JSON con `code`), o `undefined`. */
export const codeOfText = (text: string): string | undefined => {
  try {
    const code = field(JSON.parse(text) as unknown, 'code');
    return typeof code === 'string' ? code : undefined;
  } catch {
    return undefined;
  }
};

// --- Lecturas para «no se borra nada», cascada, proveedores, usuarios y auditoría ----------------------------------------------

/** Lista de una respuesta: `items` si la trae, o el propio array. */
export const listItems = (body: unknown): readonly unknown[] => {
  const items = field(body, 'items');
  if (Array.isArray(items)) return items;
  return Array.isArray(body) ? body : [];
};

/** Hijos de un programa leídos por la API con el token dado. `requisitos` es undefined si el programa ya no existe. */
export interface Children {
  readonly requisitos: number | undefined;
  readonly casos: number;
  readonly nc: number;
  readonly documentos: number;
  /** Proveedores con contrato en el programa (filtro `program` de la lista de proveedores). */
  readonly proveedoresConContrato: number;
}

export const childrenOf = async (token: string, code: string): Promise<Children> => {
  const requirements = await act('GET', `/programs/${code}/requirements`, token);
  const cases = await call('GET', '/test-cases', { tenant: TENANT_A, token, query: `program=${code}&pageSize=100` });
  const ncs = await call('GET', '/nc', { tenant: TENANT_A, token, query: `program=${code}` });
  const docs = await call('GET', '/documents', { tenant: TENANT_A, token, query: `program=${code}` });
  const suppliers = await call('GET', '/suppliers', { tenant: TENANT_A, token, query: `program=${code}` });
  return {
    requisitos: requirements.status === 200 ? listItems(requirements.body).length : undefined,
    casos: listItems(cases.body).length,
    nc: listItems(ncs.body).length,
    documentos: listItems(docs.body).length,
    proveedoresConContrato: listItems(suppliers.body).length,
  };
};

/** Comprobación de hijos: con un archivo que no borra, los hijos son los mismos antes y después. */
export const childrenCheck = (before: Children, after: Children): Check => {
  const diff = (Object.keys(before) as (keyof Children)[]).filter((key) => before[key] !== after[key]);
  return check(diff.length === 0, 'los hijos del programa (requisitos, casos, NC, documentos, proveedores con contrato) no cambian', diff.length === 0 ? 'los hijos no cambian' : `cambian: ${diff.join(', ')}`);
};

/** Total de proveedores del tenant (undefined si la lectura falla). */
export const suppliersTotal = async (token: string): Promise<number | undefined> => {
  const listed = await call('GET', '/suppliers', { tenant: TENANT_A, token });
  return listed.status === 200 ? listItems(listed.body).length : undefined;
};

/** Total de usuarios del tenant (lectura del administrador; undefined si falla). */
export const usersTotal = async (adminToken: string): Promise<number | undefined> => {
  const listed = await call('GET', '/admin/users', { tenant: TENANT_A, token: adminToken });
  return listed.status === 200 ? listItems(listed.body).length : undefined;
};

/** Eventos de auditoría de esa acción sobre ese programa (lectura del administrador). undefined si la lectura falla. */
export const auditCount = async (adminToken: string, code: string, action: string): Promise<number | undefined> => {
  const listed = await call('GET', '/audit', { tenant: TENANT_A, token: adminToken, query: `q=${code}&limit=100` });
  if (listed.status !== 200) return undefined;
  return listItems(listed.body).filter((item) => field(item, 'action') === action && field(item, 'entityId') === code).length;
};

/** Campos de un programa que describen su ficha (sin estado: cada historia dice qué debe cambiar). */
export const PHOTO_KEYS: readonly string[] = ['name', 'description', 'ownerName', 'startDate', 'endDate', 'budgetEur', 'milestonesTotal', 'milestonesDone', 'progress', 'priority', 'classified'];

/** Ficha de un programa tal como la devuelve la API (undefined si no se puede leer). */
export const photoOf = async (token: string, code: string): Promise<unknown> => {
  const read = await act('GET', `/programs/${code}`, token);
  return read.status === 200 ? read.body : undefined;
};

/** Los campos indicados de dos fichas son iguales (texto exacto). */
export const photoCheck = (before: unknown, after: unknown, label: string, keys: readonly string[] = PHOTO_KEYS): Check => {
  if (before === undefined || after === undefined) return check(false, `${label}: la ficha se puede leer antes y después`, `${label}: lectura no disponible`);
  const diff = keys.filter((key) => String(field(before, key)) !== String(field(after, key)));
  return check(diff.length === 0, `${label} sin cambios`, diff.length === 0 ? `${label} sin cambios` : `${label} cambia en ${diff.join(', ')}`);
};
