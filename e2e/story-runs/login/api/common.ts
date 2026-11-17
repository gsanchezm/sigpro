import { LOGIN_PATH, call, uniqueEmail, type ApiResult } from '../../support/api';
import { WRONG_PASSWORD } from '../../support/prepare';
import { describeExpectation, describeObserved, expectationFromSteps, judge, redact, type Check, type CheckContext, type Expectation } from '../../support/response';
import { outcome, type ManifestRow, type Outcome } from '../../support/rows';

// Piezas comunes de las historias de API de EP-LOGIN: traducción de las celdas de las tablas de Ejemplos a peticiones y
// armado del resultado de cada fila. Cada traducción es un mapa de despacho; una celda que ningún mapa reconoce LANZA un error:
// nunca se ignora ni se supone qué quiso decir la historia.

/** Valor de una columna de la fila; falla si la columna no existe (la historia y el manejador no coinciden). */
export const cell = (row: ManifestRow, key: string): string => {
  const value = row.cells[key];
  if (value === undefined) throw new Error(`celda sin interpretación: la fila ${row.rowId} no tiene la columna «${key}»`);
  return value;
};

/** Texto de un paso de la fila, tomado con un patrón con un grupo de captura (datos que la historia da en el paso, no en una celda). */
export const fromSteps = (row: ManifestRow, pattern: RegExp): string => {
  for (const step of row.resolvedSteps) {
    const captured = pattern.exec(step)?.[1];
    if (captured !== undefined) return captured;
  }
  throw new Error(`celda sin interpretación: ningún paso de ${row.rowId} encaja con ${String(pattern)}`);
};

/** Valor de un mapa de despacho estricto: solo valen los textos que el mapa conoce. */
export const strict = <T>(kind: string, map: ReadonlyMap<string, T>, text: string): T => {
  if (!map.has(text)) throw new Error(`celda sin interpretación: ${kind} «${text}»`);
  return map.get(text) as T;
};

type Marker = () => string | undefined;

/** Marcadores entre paréntesis por el mapa; cualquier otro texto es un valor literal (un correo, una contraseña, un tenant). */
const literalOr = (kind: string, markers: ReadonlyMap<string, Marker>, text: string): string | undefined => {
  const marker = markers.get(text);
  if (marker) return marker();
  if (text.startsWith('(')) throw new Error(`celda sin interpretación: ${kind} «${text}»`);
  return text;
};

const EMAILS: ReadonlyMap<string, Marker> = new Map<string, Marker>([
  ['(vacío)', () => ''],
  ['(sin el campo)', () => undefined],
  ['(tres espacios)', () => '   '],
  ['(Gestor@SIGPRO.test con un espacio delante y otro detrás)', () => ' Gestor@SIGPRO.test '],
  ['(ana @sigpro.test, con un espacio antes de la arroba)', () => 'ana @sigpro.test'],
  // Un correo que nadie ha usado: el contador de intentos de un correo sin cuenta no lo reinicia ningún reinicio de tenant
  ['(correo sin cuenta)', () => uniqueEmail('nadie')],
]);

const PASSWORDS: ReadonlyMap<string, Marker> = new Map<string, Marker>([
  ['(vacío)', () => ''],
  ['(sin el campo)', () => undefined],
  ['(un espacio)', () => ' '],
  ['incorrecta', () => WRONG_PASSWORD],
]);

const TENANT_HEADERS: ReadonlyMap<string, Marker> = new Map<string, Marker>([['(sin cabecera)', () => undefined]]);

const REMEMBER: ReadonlyMap<string, unknown> = new Map<string, unknown>([
  ['true', true],
  ['false', false],
  ['(sin el campo)', undefined],
  ['(el texto si)', 'si'],
]);

/** `undefined` significa «el campo no se envía». */
export const emailOf = (text: string): string | undefined => literalOr('correo', EMAILS, text);
export const passwordOf = (text: string): string | undefined => literalOr('contraseña', PASSWORDS, text);
/** `undefined` significa «sin cabecera x-tenant». */
export const tenantHeaderOf = (text: string): string | undefined => literalOr('cabecera', TENANT_HEADERS, text);
export const rememberOf = (text: string): unknown => strict('remember', REMEMBER, text);

/** Cuerpo de la petición: los campos indefinidos no se envían (un campo que falta no es lo mismo que uno vacío). */
export const bodyOf = (fields: Readonly<Record<string, unknown>>): Readonly<Record<string, unknown>> =>
  Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== undefined));

/** `POST /api/auth/login` con el cuerpo tal cual y la cabecera `x-tenant` solo si se indica. */
export const postLogin = (tenant: string | undefined, body: Readonly<Record<string, unknown>>): Promise<ApiResult> =>
  call('POST', LOGIN_PATH, { ...(tenant === undefined ? {} : { tenant }), body });

/** Estados de una serie de respuestas, para contar lo que pasó en los pasos previos. */
export const statuses = (results: readonly ApiResult[]): string => results.map((result) => result.status).join(', ');

/** Algo que la historia da por hecho antes de actuar («recibe 200», «la cuenta queda bloqueada»). Si no se cumple, la fila discrepa. */
export interface Premise {
  readonly label: string;
  readonly ok: boolean;
  readonly observed: string;
}

export const premise = (label: string, ok: boolean, observed: string): Premise => ({ label, ok, observed });

export interface FinishOptions {
  /** Expectativa ya calculada (si el manejador la necesitó antes de actuar); si no, se lee de los pasos de la fila. */
  readonly expectation?: Expectation;
  readonly premises?: readonly Premise[];
  readonly context?: CheckContext;
  /** Comprobaciones adicionales que salen de las Reglas de la historia y no de una fila de la tabla. */
  readonly extraChecks?: readonly Check[];
  /** Lo observado en los pasos previos, en una frase y sin secretos. */
  readonly history?: string;
  readonly note?: string;
  readonly evidence?: Readonly<Record<string, unknown>>;
}

/** La preparación no dejó la situación que la historia da por hecho: la fila discrepa sin llegar a la petición. */
export const blocked = (row: ManifestRow, premises: readonly Premise[]): Outcome => {
  const failed = premises.filter((item) => !item.ok);
  const reasons = failed.map((item) => `no se cumple lo que la historia da por hecho («${item.label}»): ${item.observed}`).join('; ');
  return outcome(false, describeExpectation(expectationOf(row)), `No se llegó a la petición de la fila; ${failed.map((item) => item.observed).join('; ')}`, { note: reasons });
};

export const expectationOf = (row: ManifestRow): Expectation => expectationFromSteps(row.resolvedSteps);

/** Compara la respuesta final con lo que dicen los pasos de la fila y arma el `Outcome` (expected, observed, veredicto, nota). */
export const finish = (row: ManifestRow, result: ApiResult, options: FinishOptions = {}): Outcome => {
  const base = options.expectation ?? expectationOf(row);
  const expectation: Expectation = { ...base, checks: [...base.checks, ...(options.extraChecks ?? [])] };
  const judgement = judge(expectation, result, options.context);
  const premises = options.premises ?? [];
  const failedPremises = premises.filter((item) => !item.ok);
  const problems = [...failedPremises.map((item) => `no se cumple lo que la historia da por hecho («${item.label}»): ${item.observed}`), ...judgement.mismatches];
  const note = [...(problems.length === 0 ? [] : [`Difiere: ${problems.join('; ')}`]), ...(options.note === undefined ? [] : [options.note])].join('. ');
  // Con pasos previos, la frase distingue lo previo de la respuesta que se juzga
  const hasPrelude = premises.length > 0 || options.history !== undefined;
  const final = (text: string): string => (hasPrelude ? `Respuesta: ${text}` : text);
  const expected = [...premises.map((item) => `Antes: ${item.label}`), final(describeExpectation(expectation))].join('; ');
  const observed = [...premises.map((item) => `Antes: ${item.observed}`), ...(options.history === undefined ? [] : [options.history]), final(describeObserved(result))].join('; ');
  return outcome(judgement.ok && failedPremises.length === 0, expected, observed, { ...(note === '' ? {} : { note }), evidence: { response: redact(result.body), ...options.evidence } });
};
