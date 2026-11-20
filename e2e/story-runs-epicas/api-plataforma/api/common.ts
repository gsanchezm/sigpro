import { API_URL, NO_CHAOS, field, readConfig, setChaos, type ApiResult, type ChaosFlags } from '../../../story-runs/support/api';
import { TENANT_A, resetTenants } from '../../../story-runs/support/prepare';
import { check, conclude, type Check } from '../../support/checks';
import type { Outcome } from '../../core/framework';

/**
 * Veredicto de una fila: coincide si todas sus comprobaciones se cumplen. Si alguna no se cumple, la nota dice en qué difiere
 * (el texto esperado y lo observado de cada una), para que el hallazgo se lea sin abrir la evidencia.
 */
export const judge = (checks: readonly Check[], extra: Pick<Outcome, 'note' | 'evidence'> = {}): Outcome => {
  const failed = checks.filter((entry) => !entry.ok);
  const difference = failed.length === 0 ? undefined : `No coincide en: ${failed.map((entry) => `${entry.expected} (observado: ${entry.observed})`).join('; ')}`;
  const note = [extra.note, difference].filter((part): part is string => part !== undefined).join(' ');
  return conclude(checks, {
    ...(note === '' ? {} : { note }),
    ...(extra.evidence === undefined ? {} : { evidence: extra.evidence }),
  });
};

// Piezas comunes de las filas de API de EP-API-PLATAFORMA. Las rutas de las celdas ya llevan `/api` («GET /api/health»), así que se
// piden contra el origen y NO con `call()` (que añade `/api` y no envía cabeceras arbitrarias, como `Origin` o `Access-Control-*`).
// Criterio: lo que la historia dice y la API no cumple es una DISCREPANCIA (la comprobación falla); una configuración de la pila que
// la fila exige y la pila aislada no tiene (APP_ENV, DOCS_BASIC_AUTH, orígenes) es `notExecutable` con el motivo, nunca un fallo del arnés.

/** Origen de la API («http://localhost:3000»): sin el prefijo `/api`, que las celdas ya llevan. */
export const ORIGIN = new URL(API_URL).origin;

export interface RawOptions {
  readonly headers?: Readonly<Record<string, string>>;
  readonly body?: unknown;
}

/** Respuesta cruda: estado, cuerpo JSON (si lo es), cabeceras y texto tal cual. */
export interface Raw extends ApiResult {
  readonly headers: Headers;
  readonly text: string;
}

const parseJson = (text: string): unknown => {
  if (text.length === 0) return undefined;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
};

/** Petición HTTP contra el origen. La ruta lleva su `/api` (o no, cuando la historia pide una ruta sin el prefijo). */
export const raw = async (method: string, route: string, options: RawOptions = {}): Promise<Raw> => {
  const { headers = {}, body } = options;
  const started = performance.now();
  const response = await fetch(new URL(route, ORIGIN), {
    method,
    headers: { ...(body === undefined ? {} : { 'content-type': 'application/json' }), ...headers },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const text = await response.text();
  return { status: response.status, body: parseJson(text), ms: Math.round(performance.now() - started), headers: response.headers, text };
};

/** Forma legible de un valor para «observado»: texto entre «…», JSON para el resto y «ausente» si no existe. */
export const show = (value: unknown): string => {
  if (value === undefined) return 'ausente';
  if (typeof value === 'string') return `«${value}»`;
  return JSON.stringify(value) ?? String(value);
};

/** Cuerpo como registro de propiedades (vacío si no es un objeto JSON). */
export const bodyOf = (result: ApiResult): Readonly<Record<string, unknown>> =>
  typeof result.body === 'object' && result.body !== null && !Array.isArray(result.body) ? (result.body as Record<string, unknown>) : {};

const TRACE_FORMAT = /^[0-9a-fA-F]{4}-[0-9a-fA-F]{4}$/;

/** `traceId` con forma de cuatro caracteres hexadecimales, un guion y otros cuatro. */
export const traceOk = (body: Readonly<Record<string, unknown>>): boolean => typeof body.traceId === 'string' && TRACE_FORMAT.test(body.traceId);

/** Estado HTTP frente al esperado. */
export const statusCheck = (result: ApiResult, status: number): Check => check(result.status === status, `respuesta ${status}`, `respuesta ${result.status}`);

/** Formato común de un error: `statusCode`, `error` y `traceId` (la regla de la historia 004). */
export const errorChecks = (result: ApiResult, status: number, error: string): Check[] => {
  const body = bodyOf(result);
  return [
    check(result.status === status && body.statusCode === status, `respuesta ${status} con statusCode ${status}`, `respuesta ${result.status}, statusCode ${show(body.statusCode)}`),
    check(body.error === error, `error «${error}»`, `error ${show(body.error)}`),
    check(traceOk(body), 'traceId de cuatro hexadecimales, un guion y otros cuatro', `traceId ${show(body.traceId)}`),
  ];
};

/** Un mapa de errores por campo es exactamente el esperado: mismas claves y mismos valores, sin campos de más. */
export const sameMap = (actual: unknown, expected: Readonly<Record<string, string>>): boolean => {
  if (typeof actual !== 'object' || actual === null || Array.isArray(actual)) return false;
  const record = actual as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  const wanted = Object.keys(expected).sort();
  return keys.length === wanted.length && wanted.every((key) => record[key] === expected[key]);
};

// --- Caos y reinicio de alumno01 ---------------------------------------------------------------------------------------------

/** `chaos` de `GET /api/config` del tenant indicado. */
export const chaosOf = async (tenant: string): Promise<unknown> => field((await readConfig(tenant)).body, 'chaos');

/** ¿Los tres campos del caos valen lo indicado? (sin exigir un orden de claves ni la lista completa de campos). */
export const sameChaos = (chaos: unknown, flags: ChaosFlags): boolean =>
  field(chaos, 'latencyMs') === flags.latencyMs && field(chaos, 'errorRate') === flags.errorRate && field(chaos, 'flakyLabels') === flags.flakyLabels;

/** Resumen de los tres campos del caos para «observado». */
export const describeChaos = (chaos: unknown): string =>
  `latencyMs ${show(field(chaos, 'latencyMs'))}, errorRate ${show(field(chaos, 'errorRate'))}, flakyLabels ${show(field(chaos, 'flakyLabels'))}`;

/**
 * Estado de cada fila: alumno01 reiniciado con `POST /api/admin/reset` (con el token de su administrador) y el caos apagado,
 * porque el reinicio no lo apaga. Un fallo de esta fontanería lanza: sin ella la fila no puede empezar.
 */
export const prepareAlumno = async (): Promise<void> => {
  await resetTenants([TENANT_A]);
  if (sameChaos(await chaosOf(TENANT_A), NO_CHAOS)) return;
  const off = await setChaos(TENANT_A, NO_CHAOS);
  if (off.status !== 200) throw new Error(`No se pudo apagar el caos de ${TENANT_A}: PATCH /api/admin/chaos responde ${off.status}`);
};

/** Al terminar: caos a cero y después reinicio, para que la fila no deje ni caos ni rastros del cambio de caos. */
const restoreAlumno = async (): Promise<void> => {
  const off = await setChaos(TENANT_A, NO_CHAOS);
  if (off.status !== 200) throw new Error(`limpieza de ${TENANT_A}: PATCH /api/admin/chaos responde ${off.status}`);
  await resetTenants([TENANT_A]);
};

/** Ejecuta la fila y, pase lo que pase, deja alumno01 con el caos apagado y reiniciado. Si la limpieza falla, lanza. */
export const withRestore = async (run: () => Promise<Outcome>): Promise<Outcome> => {
  let result: Outcome;
  try {
    result = await run();
  } catch (error) {
    await restoreAlumno().catch(() => undefined);
    throw error;
  }
  await restoreAlumno();
  return result;
};

// --- Configuración de la pila aislada (docs/story-runs/entorno/env.sh) -------------------------------------------------------

/** Motivo de `notExecutable` cuando la fila exige un APP_ENV que la pila aislada no tiene (env.sh fija APP_ENV=dev). */
export const ENV_NOTE = (wanted: string): string =>
  `la pila aislada se lanza con APP_ENV=dev (docs/story-runs/entorno/env.sh) y la fila exige APP_ENV ${wanted}: la configuración de la pila no lo permite`;

/** Motivo de `notExecutable` cuando la fila exige credenciales de documentación (env.sh no define DOCS_BASIC_AUTH). */
export const DOCS_NOTE =
  'la pila aislada se lanza sin DOCS_BASIC_AUTH (docs/story-runs/entorno/env.sh) y la fila exige credenciales de documentación configuradas: la configuración de la pila no lo permite';
