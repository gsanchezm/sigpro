import { errorCode, field, type ApiResult } from '../../story-runs/support/api';
import { outcome, type ManifestRow, type Outcome } from './framework';

// Piezas comunes de los manejadores de las épicas posteriores al piloto: lectura estricta de las celdas, comprobaciones con su
// frase esperada y observada, y armado del resultado de cada fila. Criterio (el mismo del piloto): una celda que ningún mapa
// reconoce LANZA, nunca se ignora; y lo que la app no cumple de lo que dice la historia es una DISCREPANCIA, no un error del arnés.

/** Valor de una columna de la fila; falla si la columna no existe (la historia y el manejador no coinciden). */
export const cell = (row: ManifestRow, key: string): string => {
  const value = row.cells[key];
  if (value === undefined) throw new Error(`celda sin interpretación: la fila ${row.rowId} no tiene la columna «${key}»`);
  return value;
};

/** Valor de un mapa de despacho estricto: solo valen los textos que el mapa conoce. */
export const strict = <T>(kind: string, map: ReadonlyMap<string, T>, text: string): T => {
  if (!map.has(text)) throw new Error(`celda sin interpretación: ${kind} «${text}»`);
  return map.get(text) as T;
};

/** Una comprobación con lo que la historia espera y lo que se observó, en una frase cada una. */
export interface Check {
  readonly ok: boolean;
  readonly expected: string;
  readonly observed: string;
}

export const check = (ok: boolean, expected: string, observed: string): Check => ({ ok, expected, observed });

/** Resultado de una fila a partir de sus comprobaciones: coincide solo si todas se cumplen. */
export const conclude = (checks: readonly Check[], extra: Pick<Outcome, 'note' | 'evidence'> = {}): Outcome =>
  outcome(
    checks.every((entry) => entry.ok),
    checks.map((entry) => entry.expected).join('; '),
    checks.map((entry) => entry.observed).join('; '),
    extra,
  );

/** Respuesta esperada de una celda como «200» o «401 invalid_mfa»: código HTTP y, si lo hay, el `code` del cuerpo. */
export interface ExpectedResponse {
  readonly status: number;
  readonly code?: string;
}

export const parseResponse = (text: string): ExpectedResponse => {
  const match = /^(\d{3})(?: ([a-z_]+))?$/.exec(text.trim());
  if (!match?.[1]) throw new Error(`celda sin interpretación: respuesta «${text}»`);
  return { status: Number(match[1]), ...(match[2] ? { code: match[2] } : {}) };
};

/** Frase corta de lo observado en una respuesta: estado, `code` si lo trae y, si hay tokens de sesión, que los trae. */
export const describeResponse = (result: ApiResult): string => {
  const code = errorCode(result);
  return `${result.status}${code ? ` ${code}` : ''}${hasSessionTokens(result) ? ' con tokens de sesión' : ''}`;
};

/** ¿Trae el cuerpo algún token de sesión (`accessToken` o `refreshToken`)? */
export const hasSessionTokens = (result: ApiResult): boolean => typeof field(result.body, 'accessToken') === 'string' || typeof field(result.body, 'refreshToken') === 'string';

/** Estado y `code` esperados frente a lo observado. */
export const responseCheck = (result: ApiResult, expected: ExpectedResponse): Check =>
  check(result.status === expected.status && (expected.code === undefined || errorCode(result) === expected.code), `respuesta ${expected.status}${expected.code ? ` ${expected.code}` : ''}`, `respuesta ${describeResponse(result)}`);

/** «No trae tokens de sesión». */
export const noTokensCheck = (result: ApiResult): Check => check(!hasSessionTokens(result), 'sin tokens de sesión', hasSessionTokens(result) ? 'trae tokens de sesión' : 'sin tokens de sesión');

/** Mapa campo → motivo de un 422 (`errors`); vacío si el cuerpo no lo trae. */
export const errorsOf = (result: ApiResult): Readonly<Record<string, unknown>> => {
  const errors = field(result.body, 'errors');
  return typeof errors === 'object' && errors !== null ? (errors as Record<string, unknown>) : {};
};

/** Si falla la preparación de una fila (el estado inicial que la historia da por hecho no se produjo), la fila discrepa con ese motivo. */
export const preparationFailed = (expected: string, step: string, result: ApiResult): Outcome =>
  outcome(false, expected, `la preparación no se cumplió: ${step} → ${describeResponse(result)}`, {
    note: 'No se pudo reproducir el estado inicial que da por hecho la historia; la app no hace lo que la preparación describe.',
    evidence: { step, status: result.status, body: JSON.stringify(result.body).slice(0, 300) },
  });

/** Igual que `preparationFailed`, para las pruebas de navegador: la pantalla no llegó al estado que la historia da por hecho. */
export const preparationFailedWeb = (expected: string, reason: string): Outcome =>
  outcome(false, expected, `la preparación no se cumplió: ${reason}`, {
    note: 'No se pudo reproducir el estado inicial que da por hecho la historia; la app no hace lo que la preparación describe.',
  });

export const sleep = (ms: number): Promise<void> => new Promise((done) => setTimeout(done, ms));
