import { adminToken, call, login, resetTenant, sessionOf, uniqueEmail, usersByEmail, type ApiResult, type Session } from './api';

// PREPARACIÓN COMÚN DE LAS FILAS, SOLO POR HTTP: reiniciar el tenant, fallos previos, cuenta desactivada, cuenta recién
// solicitada e inicio de sesión. Sirve igual a las historias de API, de web y de móvil (cada una la usa antes de actuar con su
// propia superficie), así que no sabe nada de ninguna superficie.
//
// Criterio de diseño: estas funciones OBSERVAN, no afirman. Devuelven la respuesta cruda de cada paso para que quien las usa
// decida si lo que la historia da por hecho («recibe 200», «la cuenta queda bloqueada») se cumplió: un paso previo que la app
// no cumple es un hallazgo (`discrepa`), no un error del arnés. Solo lanzan por fallos de fontanería (el reinicio o el login de
// administración no responden), porque sin ellos la fila no puede ni empezar.

export const TENANT_A = 'alumno01';
export const TENANT_B = 'alumno02';

export interface Credentials {
  readonly email: string;
  readonly password: string;
}

/** Cuentas de demostración que citan las historias del piloto (existen en todos los tenants tras el reinicio). */
export const DEMO = {
  admin: { email: 'admin@sigpro.test', password: 'Admin1234!' },
  gestor: { email: 'gestor@sigpro.test', password: 'Gestor1234!' },
  consultor: { email: 'consultor@sigpro.test', password: 'Consul1234!' },
  auditor: { email: 'auditor@sigpro.test', password: 'Audit1234!' },
  bloqueado: { email: 'bloqueado@sigpro.test', password: 'Block1234!' },
  pendiente: { email: 'pendiente@sigpro.test', password: 'Pend1234!' },
} as const satisfies Readonly<Record<string, Credentials>>;

/** «La contraseña incorrecta» de los ejemplos: cualquier texto que no sea la contraseña de la cuenta. */
export const WRONG_PASSWORD = 'Contraseña-incorrecta-1';

/** Contraseña con la que las historias solicitan una cuenta nueva (`password` y `confirm` del registro). */
export const NEW_ACCOUNT_PASSWORD = 'Abcdefghij1!';

/** Reinicia los tenants indicados, uno tras otro, cada uno con el token de SU administrador. Falla si un reinicio no responde 200. */
export const resetTenants = async (tenants: readonly string[]): Promise<void> => {
  for (const tenant of tenants) {
    const result = await resetTenant(tenant);
    if (result.status !== 200) throw new Error(`El reinicio de ${tenant} respondió ${result.status}: ${JSON.stringify(result.body)}`);
  }
};

/** Envía `count` inicios de sesión con contraseña incorrecta (por defecto) y devuelve cada respuesta, en orden. */
export const failedLogins = async (tenant: string, email: string, count: number, password: string = WRONG_PASSWORD): Promise<readonly ApiResult[]> => {
  const results: ApiResult[] = [];
  for (let attempt = 1; attempt <= count; attempt += 1) results.push(await login({ tenant, email, password }));
  return results;
};

/** `PATCH /api/admin/users/<id>` con `active`, hecho por el administrador del tenant. El id sale del listado de usuarios del tenant. */
export const setAccountActive = async (tenant: string, email: string, active: boolean): Promise<ApiResult> => {
  const user = (await usersByEmail(tenant)).get(email);
  if (user === undefined) throw new Error(`${email} no está en el listado de usuarios de ${tenant}`);
  return call('PATCH', `/admin/users/${String(user.id)}`, { tenant, token: await adminToken(tenant), body: { active } });
};

/** `PATCH /api/admin/users/<id>` con un id ya conocido (el que cita la historia). */
export const patchAccountById = async (tenant: string, id: string, active: boolean): Promise<ApiResult> =>
  call('PATCH', `/admin/users/${id}`, { tenant, token: await adminToken(tenant), body: { active } });

export interface RequestedAccount extends Credentials {
  /** Respuesta de `POST /api/auth/register`. */
  readonly result: ApiResult;
}

/**
 * Solicita una cuenta nueva con `POST /api/auth/register`, con el cuerpo que describen las historias: Ana Prueba, organización
 * «Unidad de pruebas», rol consultant y `Abcdefghij1!`. El correo es nuevo cada vez (`nueva-…@organizacion.es`): se aprovecha el
 * generador de correos únicos y se cambia solo el dominio.
 */
export const requestAccount = async (tenant: string): Promise<RequestedAccount> => {
  const email = uniqueEmail('nueva').replace(/@.*$/, '@organizacion.es');
  const result = await call('POST', '/auth/register', {
    tenant,
    body: { first: 'Ana', last: 'Prueba', email, org: 'Unidad de pruebas', role: 'consultant', password: NEW_ACCOUNT_PASSWORD, confirm: NEW_ACCOUNT_PASSWORD, terms: true },
  });
  return { email, password: NEW_ACCOUNT_PASSWORD, result };
};

export interface StartedSession {
  /** Respuesta cruda del login. */
  readonly result: ApiResult;
  /** La sesión, si el login respondió con tokens. */
  readonly session: Session | undefined;
}

/** `POST /api/auth/login` con `remember` (verdadero si no se indica, como en la API). La sesión puede faltar: quien llama decide qué hacer. */
export const startSession = async (tenant: string, credentials: Credentials, remember = true): Promise<StartedSession> => {
  const result = await login({ tenant, ...credentials, remember });
  return { result, session: sessionOf(result) };
};
