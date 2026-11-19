import { adminCredentials, call, errorCode, field, type ApiResult } from '../../../story-runs/support/api';
import { DEMO, TENANT_A, TENANT_B, resetTenants, startSession, type Credentials } from '../../../story-runs/support/prepare';
import { check, describeResponse, errorsOf, type Check } from '../../support/checks';

// Piezas comunes de las filas de API de EP-HITOS: cuentas con su accessToken (en alumno01, cabecera x-tenant: alumno01), lectura
// y escritura de hitos por HTTP, comprobaciones de la forma de las respuestas (422 por campo, 403/404 con su código, orden de la
// lista) y preparaciones de alumno02 (el hito «solo de alumno02» y el duplicado PRG-025). Los textos de las celdas se traducen con
// mapas estrictos: cualquier texto que no conozcan LANZA. Nunca se compara un cuerpo de error entero: solo código y campos (traceId).

export { TENANT_A, TENANT_B, resetTenants } from '../../../story-runs/support/prepare';

export type AccountKey = 'gestor' | 'consultor' | 'auditor' | 'alumno';

/** Cuentas de la historia en alumno01. `alumno` es el administrador del tenant (`alumno01@sigpro.lab`, sin segundo factor). */
const ACCOUNTS: Readonly<Record<AccountKey, Credentials>> = {
  gestor: DEMO.gestor,
  consultor: DEMO.consultor,
  auditor: DEMO.auditor,
  alumno: adminCredentials(TENANT_A),
};

export interface TokenOf {
  /** accessToken de la cuenta, o `undefined` si el inicio de sesión no lo dio. */
  readonly token: string | undefined;
  /** Última respuesta de la preparación, para explicar un fallo. */
  readonly last: ApiResult;
}

/** Inicia sesión en alumno01 (ya reiniciado) con la cuenta y devuelve su accessToken. */
export const tokenFor = async (account: AccountKey): Promise<TokenOf> => {
  const started = await startSession(TENANT_A, ACCOUNTS[account]);
  return { token: started.session?.accessToken, last: started.result };
};

/** Inicia sesión en alumno02 con su administrador (solo para preparar los estados de alumno02). */
export const tokenForB = async (): Promise<TokenOf> => {
  const started = await startSession(TENANT_B, adminCredentials(TENANT_B));
  return { token: started.session?.accessToken, last: started.result };
};

/** Petición a un tenant, con token si lo hay. Nunca lanza por códigos 4xx/5xx: los observa. */
export const request = (method: 'GET' | 'POST' | 'PATCH' | 'DELETE', tenant: string, path: string, token: string | undefined, body?: unknown): Promise<ApiResult> =>
  call(method, path, { tenant, ...(token === undefined ? {} : { token }), ...(body === undefined ? {} : { body }) });

// --- Celdas: mapas estrictos compartidos por las filas -------------------------------------------------------------------------

/** Credencial de la celda: sin cabecera, un texto que no es un token, o el accessToken de una cuenta de alumno01. */
export type Credential = { readonly kind: 'none' } | { readonly kind: 'junk' } | { readonly kind: 'account'; readonly account: AccountKey };

export const CREDENTIAL_OF: ReadonlyMap<string, Credential> = new Map<string, Credential>([
  ['(sin cabecera Authorization)', { kind: 'none' }],
  ['(un texto que no es un token)', { kind: 'junk' }],
  ['el accessToken de gestor@sigpro.test', { kind: 'account', account: 'gestor' }],
  ['el accessToken de consultor@sigpro.test', { kind: 'account', account: 'consultor' }],
  ['el accessToken de auditor@sigpro.test', { kind: 'account', account: 'auditor' }],
  ['el accessToken de alumno01@sigpro.lab', { kind: 'account', account: 'alumno' }],
]);

/** Nombres de la celda: el texto literal, o los espacios y longitudes que la historia escribe entre paréntesis. */
export const NOMBRE_TEXTO: ReadonlyMap<string, string> = new Map<string, string>([
  ['(vacío)', ''],
  ['(tres espacios)', '   '],
  ['(espacios delante y detrás de Revisión de diseño)', '   Revisión de diseño   '],
  ['(espacios delante y detrás de Revisión PDR)', '   Revisión PDR   '],
  ['Revisión de diseño', 'Revisión de diseño'],
  ['Revisión PDR', 'Revisión PDR'],
  ['A', 'A'],
  ['Ab', 'Ab'],
  ['(80 caracteres)', 'x'.repeat(80)],
  ['(81 caracteres)', 'x'.repeat(81)],
]);

/**
 * Valores de las columnas de nombre, fecha y «valor» de las historias de alta y edición. `undefined` = «(sin el campo)»: el cuerpo
 * no lleva ese campo (no es lo mismo que mandar un texto vacío).
 */
export const VALOR_TEXTO: ReadonlyMap<string, string | undefined> = new Map<string, string | undefined>([
  ...NOMBRE_TEXTO,
  ['2027-3-5', '2027-3-5'],
  ['05/03/2027', '05/03/2027'],
  ['2027-02-29', '2027-02-29'],
  ['2028-02-29', '2028-02-29'],
  ['2027-03-15', '2027-03-15'],
  ['2022-12-31', '2022-12-31'],
  ['(sin el campo)', undefined],
]);

/** Avance de la celda: un entero de 0 a 100 (o fuera de rango, o con decimales) y los textos que no son números. */
export const AVANCE_TEXTO: ReadonlyMap<string, number | string | undefined> = new Map<string, number | string | undefined>([
  ['(sin el campo)', undefined],
  ['-1', -1],
  ['0', 0],
  ['99', 99],
  ['100', 100],
  ['101', 101],
  ['50.5', 50.5],
  ['(el texto 50)', '50'],
]);

/** Booleanos escritos como en la historia («true» / «false»). */
export const BOOLEANO: ReadonlyMap<string, boolean> = new Map<string, boolean>([
  ['true', true],
  ['false', false],
]);

/** Número entero de una celda («9», «45»). Cualquier otro texto lanza: no se interpreta en silencio. */
export const countOf = (text: string): number => {
  if (!/^\d+$/.test(text)) throw new Error(`celda sin interpretación: número «${text}»`);
  return Number(text);
};

// --- Lectura de la lista de hitos ---------------------------------------------------------------------------------------------

/** GET /api/programs/:code/milestones de alumno01 (con token, o sin él si `token` es `undefined`). */
export const listMilestones = (token: string | undefined, programCode: string): Promise<ApiResult> =>
  request('GET', TENANT_A, `/programs/${programCode}/milestones`, token);

/** Elementos de una respuesta de lista; vacío si el cuerpo no es un arreglo (p. ej. un 401). */
export const itemsOf = (result: ApiResult): readonly unknown[] => (Array.isArray(result.body) ? (result.body as readonly unknown[]) : []);

/** Texto de un campo de un hito (`id`, `name`…) o `undefined` si no es texto. */
export const textField = (item: unknown, key: string): string | undefined => {
  const value = field(item, key);
  return typeof value === 'string' ? value : undefined;
};

/** Hito de la lista con ese id, o `undefined`. */
export const milestoneOf = (items: readonly unknown[], id: string): unknown => items.find((item) => field(item, 'id') === id);

/** Número de hitos que la API devuelve para un programa de alumno01 (solo lectura). */
export const countMilestones = async (token: string | undefined, programCode: string): Promise<number> => itemsOf(await listMilestones(token, programCode)).length;

/** Regla «No se crea nada»: el número de hitos no cambia tras un rechazo. */
export const nothingCreatedCheck = (antes: number, despues: number): Check =>
  check(antes === despues, 'no se crea ningún hito', `hitos antes ${antes}, después ${despues}`);

/** Código del programa de un id de hito: PRG-001-M02 → PRG-001. Cualquier otra forma lanza. */
export const programOf = (milestoneId: string): string => {
  const match = /^(PRG-\d{3})-M\d{2}$/.exec(milestoneId);
  if (!match?.[1]) throw new Error(`celda sin interpretación: id de hito «${milestoneId}»`);
  return match[1];
};

const compareText = (a: string, b: string): number => (a === b ? 0 : a < b ? -1 : 1);

/** La lista va por `dueDate` ascendente y, con la misma fecha, por `id` ascendente. */
export const orderCheck = (items: readonly unknown[]): Check => {
  const keys = items.map((item): readonly [string, string] => [String(field(item, 'dueDate')), String(field(item, 'id'))]);
  const sorted = keys.every((key, index, all) => {
    const previous = all[index - 1];
    if (previous === undefined) return true;
    const byDate = compareText(previous[0], key[0]);
    return byDate < 0 || (byDate === 0 && compareText(previous[1], key[1]) <= 0);
  });
  const ids = items.map((item) => String(field(item, 'id'))).join(', ');
  return check(sorted, 'la lista va por fecha límite ascendente y, con la misma fecha, por código ascendente', sorted ? `en ese orden (${ids})` : `desordenada (${ids})`);
};

// --- Comprobaciones de respuesta -----------------------------------------------------------------------------------------------

/** Respuesta de rechazo esperada: código HTTP y `code`, y opcionalmente el motivo de un campo (`errors[campo]`). */
export interface Rechazo {
  readonly status: number;
  readonly code: string;
  readonly campo?: string;
  /** Sin `motivo` basta con que el campo traiga algún motivo («con un motivo en dueDate»). */
  readonly motivo?: string;
}

/** Código HTTP, `code` y motivo por campo de un rechazo, frente a lo observado. */
export const rechazoCheck = (result: ApiResult, expected: Rechazo): Check => {
  const errors = errorsOf(result);
  const campo = expected.campo;
  const fieldOk = campo === undefined || (expected.motivo === undefined ? typeof errors[campo] === 'string' : errors[campo] === expected.motivo);
  const ok = result.status === expected.status && errorCode(result) === expected.code && fieldOk;
  const motivo = expected.motivo === undefined ? '' : ` con el motivo ${expected.motivo}`;
  const donde = campo === undefined ? '' : ` en ${campo}`;
  return check(ok, `${expected.status} ${expected.code}${motivo}${donde}`, `${describeResponse(result)}; errores ${JSON.stringify(errors)}`);
};

/** 422 `nothingToUpdate`: el motivo no va asociado a ningún campo (la clave de `errors` no es ninguno de los campos del hito). */
export const nothingToUpdateCheck = (result: ApiResult): Check => {
  const errors = errorsOf(result);
  // Solo la clave raíz (la vacía: ningún campo) y ese motivo. Cualquier otra clave, aunque no sea un campo del hito, rompe la regla.
  const keys = Object.keys(errors);
  const onlyRoot = keys.length === 1 && keys[0] === '' && errors[''] === 'nothingToUpdate';
  const ok = result.status === 422 && errorCode(result) === 'validation_failed' && onlyRoot;
  return check(ok, '422 validation_failed con el motivo nothingToUpdate y sin motivo de ningún campo', `${describeResponse(result)}; errores ${JSON.stringify(errors)}`);
};

/** Campos del cuerpo de la respuesta iguales (tipo y valor) a los que la historia cita. */
export const echoChecks = (result: ApiResult, expected: Readonly<Record<string, string | number | boolean>>): readonly Check[] =>
  Object.entries(expected).map(([key, value]) => {
    const got = field(result.body, key);
    return check(got === value, `${key} ${String(value)}`, `${key} ${String(got)}`);
  });

// --- Preparaciones --------------------------------------------------------------------------------------------------------------

/** Lo que devuelve una preparación fallida: el paso que no se cumplió y su respuesta (para `preparationFailed`). */
export interface PrepFailure {
  readonly step: string;
  readonly result: ApiResult;
}

/** Token que envía la fila para una credencial de la celda. `failed` si la cuenta no pudo iniciar sesión. */
export interface SentToken {
  readonly token: string | undefined;
  readonly failed: TokenOf | undefined;
}

export const sentTokenOf = async (credential: Credential): Promise<SentToken> => {
  if (credential.kind === 'none') return { token: undefined, failed: undefined };
  if (credential.kind === 'junk') return { token: 'texto-que-no-es-un-token', failed: undefined };
  const session = await tokenFor(credential.account);
  return session.token === undefined ? { token: undefined, failed: session } : { token: session.token, failed: undefined };
};

/**
 * Hito «solo de alumno02»: reinicia alumno02, inicia sesión con su administrador y crea un hito en PRG-001 de ese tenant, que recibe
 * PRG-001-M10. Devuelve `undefined` si se creó; si no, el paso que falló. Quien llama debe reiniciar alumno02 al terminar.
 */
export const prepareM10InB = async (): Promise<PrepFailure | undefined> => {
  await resetTenants([TENANT_B]);
  const admin = await tokenForB();
  if (admin.token === undefined) return { step: 'alumno02@sigpro.lab inicia sesión y recibe accessToken', result: admin.last };
  const created = await request('POST', TENANT_B, '/programs/PRG-001/milestones', admin.token, { name: 'Revisión de diseño', dueDate: '2027-03-15' });
  if (created.status !== 201 || textField(created.body, 'id') !== 'PRG-001-M10') {
    return { step: 'POST /api/programs/PRG-001/milestones en alumno02 crea PRG-001-M10', result: created };
  }
  return undefined;
};

/**
 * Programa «solo de alumno02»: reinicia alumno02, inicia sesión con su administrador y duplica PRG-001, que recibe el código PRG-025.
 * Devuelve `undefined` si la copia tiene ese código; si no, el paso que falló. Quien llama debe reiniciar alumno02 al terminar.
 */
export const prepareCopyInB = async (): Promise<PrepFailure | undefined> => {
  await resetTenants([TENANT_B]);
  const admin = await tokenForB();
  if (admin.token === undefined) return { step: 'alumno02@sigpro.lab inicia sesión y recibe accessToken', result: admin.last };
  const copy = await request('POST', TENANT_B, '/programs/PRG-001/duplicate', admin.token);
  if (copy.status < 200 || copy.status > 299 || textField(copy.body, 'code') !== 'PRG-025') {
    return { step: 'POST /api/programs/PRG-001/duplicate en alumno02 crea la copia PRG-025', result: copy };
  }
  return undefined;
};
