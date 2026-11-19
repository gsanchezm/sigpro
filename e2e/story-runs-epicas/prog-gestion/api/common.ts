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
