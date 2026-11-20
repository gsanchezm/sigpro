import { call, NO_CHAOS, type ApiResult } from '../../../story-runs/support/api';
import { TENANT_A, TENANT_B } from '../../../story-runs/support/prepare';
import { cell, check, preparationFailed, strict } from '../../support/checks';
import { defineApiRows, type ApiRowHandler } from '../../core/framework';
import { FIRST_NEW_CODE, GESTOR, PROGRAM_BODY, adminAccess, codeOf, expectCheck, prepareTenant, rowOutcome, sessionOfAccount, studentAdmin, withRestore, withToken, type Expect } from './common';

// US-CAOS-RESET-007 — El modo caos retrasa y falla solo las peticiones de su tenant (API). Cada fila reinicia alumno01 antes de
// actuar y, al terminar, `withRestore` lo vuelve a reiniciar y le apaga el caos (alumno02 solo aparece en el Esquema 5).

/** Latencia máxima que fija la fila (Esquema 1). */
const LATENCIES: ReadonlyMap<string, number> = new Map<string, number>([
  ['0', 0],
  ['5000', 5000],
]);

/** Resultado esperado de la comparación de medias: `true` si la media de las diez supera a la referencia en más de 1000 ms. */
const EXCEEDS: ReadonlyMap<string, boolean> = new Map<string, boolean>([
  ['no supera', false],
  ['supera', true],
]);

/** Escritura que falla con errorRate 1 (Esquema 2). */
const WRITES: ReadonlyMap<string, string> = new Map<string, string>([['POST /api/programs', '/programs']]);

/** Lecturas que siguen respondiendo con errorRate 1 (Esquema 3). */
const READS: ReadonlyMap<string, string> = new Map<string, string>([
  ['GET /api/programs', '/programs'],
  ['GET /api/programs/PRG-001', '/programs/PRG-001'],
]);

/** Peticiones exentas del Esquema 4: la que hace cada fila y la forma de su respuesta. */
type Exempt = 'login' | 'reset' | 'apagado' | 'config';
const EXEMPT: ReadonlyMap<string, Exempt> = new Map<string, Exempt>([
  ['POST /api/auth/login con x-tenant alumno01, alumno01@sigpro.lab y la contraseña Alumno1234!', 'login'],
  ['POST /api/admin/reset con el token de alumno01@sigpro.lab', 'reset'],
  ['PATCH /api/admin/chaos con el cuerpo { "errorRate": 0 } y el token de alumno01@sigpro.lab', 'apagado'],
  ['GET /api/config con x-tenant alumno01', 'config'],
]);
const EXEMPT_RESPONSES: ReadonlyMap<string, Expect> = new Map<string, Expect>([
  ['200 con accessToken', { status: 200, accessToken: true }],
  ['200', { status: 200 }],
]);

/** Respuesta de la escritura de alumno02 y de alumno01 (Esquema 5). */
const OTHER_RESPONSES: ReadonlyMap<string, Expect> = new Map<string, Expect>([
  ['422 validation_failed', { status: 422, code: 'validation_failed' }],
  ['500 con el código chaos_error', { status: 500, code: 'chaos_error' }],
]);

/** Media de una lista de milisegundos. */
const mean = (values: readonly number[]): number => values.reduce((total, value) => total + value, 0) / values.length;

/** Latencia de cada respuesta medida por el cliente (`ms`), y si todas son 200. */
const timingsOf = (results: readonly ApiResult[]): { readonly ms: readonly number[]; readonly allOk: boolean } => ({
  ms: results.map((result) => result.ms),
  allOk: results.every((result) => result.status === 200),
});

// --- Esquema 1: el retardo añadido queda entre cero y el máximo fijado ---------------------------------------------------------

const delayIsBounded: ApiRowHandler = async (row) => {
  const latencyMs = strict('latencia', LATENCIES, cell(row, 'latencia'));
  const exceeds = strict('resultado', EXCEEDS, cell(row, 'resultado'));
  const expected = `la media de las diez respuestas ${exceeds ? 'supera' : 'no supera'} a la media de la referencia en más de 1000 ms`;
  return withRestore([TENANT_A], async () => {
    await prepareTenant(TENANT_A);
    const token = await adminAccess(TENANT_A);
    // Referencia: tres lecturas con el caos en reposo (secuenciales)
    const reference: ApiResult[] = [];
    for (let index = 0; index < 3; index += 1) reference.push(await withToken('GET', '/programs', TENANT_A, token));
    const preset = await withToken('PATCH', '/admin/chaos', TENANT_A, token, { latencyMs });
    if (preset.status !== 200) return preparationFailed(expected, `alumno01@sigpro.lab fija con PATCH latencyMs ${latencyMs}`, preset);
    // Diez lecturas a la vez: cada una mide su propio tiempo (el retardo es por petición), así la fila dura lo que la más lenta.
    const samples = await Promise.all(Array.from({ length: 10 }, () => withToken('GET', '/programs', TENANT_A, token)));
    const referenceTimes = timingsOf(reference);
    const sampleTimes = timingsOf(samples);
    const referenceMean = mean(referenceTimes.ms);
    const sampleMean = mean(sampleTimes.ms);
    const difference = sampleMean - referenceMean;
    const ok = referenceTimes.allOk && sampleTimes.allOk && (exceeds ? difference > 1000 : difference <= 1000);
    return rowOutcome(
      [
        check(
          ok,
          expected,
          `la media de las diez respuestas es ${Math.round(sampleMean)} ms y la de la referencia ${Math.round(referenceMean)} ms (diferencia ${Math.round(difference)} ms)${sampleTimes.allOk && referenceTimes.allOk ? '' : '; alguna lectura no respondió 200'}`,
        ),
      ],
      {
        note: 'Las diez lecturas se lanzan a la vez (cada una mide su propio tiempo, así la fila dura lo que tarda la más lenta). La referencia son tres lecturas secuenciales con el caos en reposo.',
        evidence: { latenciaFijadaMs: latencyMs, mediaReferenciaMs: Math.round(referenceMean), mediaDiezMs: Math.round(sampleMean), msPorLectura: sampleTimes.ms.map((ms) => Math.round(ms)) },
      },
    );
  });
};

// --- Esquema 2: con errorRate 1 una escritura responde 500 y no crea el programa --------------------------------------------

const writeFailsWithoutCreating: ApiRowHandler = async (row) => {
  const path = strict('escritura', WRITES, cell(row, 'escritura'));
  const expected = 'la respuesta es 500 con el código chaos_error; tras apagar el caos con PATCH, una nueva alta con el cuerpo base recibe el código PRG-025';
  return withRestore([TENANT_A], async () => {
    await prepareTenant(TENANT_A);
    const admin = await adminAccess(TENANT_A);
    const gestor = await sessionOfAccount(TENANT_A, GESTOR);
    if (gestor.token === undefined) return preparationFailed(expected, 'gestor@sigpro.test tiene un token de acceso', gestor.result);
    const preset = await withToken('PATCH', '/admin/chaos', TENANT_A, admin, { errorRate: 1 });
    if (preset.status !== 200) return preparationFailed(expected, 'alumno01@sigpro.lab fija con PATCH errorRate 1', preset);
    const failed = await withToken('POST', path, TENANT_A, gestor.token, PROGRAM_BODY);
    const off = await withToken('PATCH', '/admin/chaos', TENANT_A, admin, NO_CHAOS);
    const created = await withToken('POST', path, TENANT_A, gestor.token, PROGRAM_BODY);
    return rowOutcome([
      expectCheck(failed, 'la respuesta es 500 con el código chaos_error', { status: 500, code: 'chaos_error' }),
      expectCheck(off, 'el PATCH que apaga el caos responde 200', { status: 200 }),
      expectCheck(created, 'la nueva alta responde 201', { status: 201 }),
      check(
        codeOf(created.body) === FIRST_NEW_CODE,
        `la nueva alta recibe el código ${FIRST_NEW_CODE} (la fallida no creó nada)`,
        `la nueva alta recibe el código ${codeOf(created.body) ?? '(ausente)'}`,
      ),
    ]);
  });
};

// --- Esquema 3: con errorRate 1 las lecturas responden con normalidad ---------------------------------------------------------

const readsKeepWorking: ApiRowHandler = async (row) => {
  const path = strict('lectura', READS, cell(row, 'lectura'));
  const expected = 'la respuesta es 200';
  return withRestore([TENANT_A], async () => {
    await prepareTenant(TENANT_A);
    const admin = await adminAccess(TENANT_A);
    const gestor = await sessionOfAccount(TENANT_A, GESTOR);
    if (gestor.token === undefined) return preparationFailed(expected, 'gestor@sigpro.test tiene un token de acceso', gestor.result);
    const preset = await withToken('PATCH', '/admin/chaos', TENANT_A, admin, { errorRate: 1 });
    if (preset.status !== 200) return preparationFailed(expected, 'alumno01@sigpro.lab fija con PATCH errorRate 1', preset);
    const read = await withToken('GET', path, TENANT_A, gestor.token);
    return rowOutcome([expectCheck(read, expected, { status: 200 })]);
  });
};

// --- Esquema 4: las rutas exentas responden con normalidad aunque las escrituras fallen ---------------------------------------

const exemptRoutesAnswer: ApiRowHandler = async (row) => {
  const exempt = strict('peticion', EXEMPT, cell(row, 'peticion'));
  const expectedText = cell(row, 'respuesta');
  const expect = strict('respuesta', EXEMPT_RESPONSES, expectedText);
  return withRestore([TENANT_A], async () => {
    await prepareTenant(TENANT_A);
    const admin = await adminAccess(TENANT_A);
    const preset = await withToken('PATCH', '/admin/chaos', TENANT_A, admin, { errorRate: 1 });
    if (preset.status !== 200) return preparationFailed(`la respuesta es ${expectedText}`, 'alumno01@sigpro.lab fija con PATCH errorRate 1', preset);
    const label = `la respuesta es ${expectedText}`;
    if (exempt === 'login') {
      const session = await sessionOfAccount(TENANT_A, studentAdmin(TENANT_A));
      return rowOutcome([expectCheck(session.result, label, expect)]);
    }
    if (exempt === 'reset') {
      const reset = await call('POST', '/admin/reset', { tenant: TENANT_A, token: admin });
      return rowOutcome([expectCheck(reset, label, expect)]);
    }
    if (exempt === 'apagado') {
      const off = await withToken('PATCH', '/admin/chaos', TENANT_A, admin, { errorRate: 0 });
      return rowOutcome([expectCheck(off, label, expect)]);
    }
    const config = await call('GET', '/config', { tenant: TENANT_A });
    return rowOutcome([expectCheck(config, label, expect)]);
  });
};

// --- Esquema 5: el caos de alumno01 no altera las peticiones de alumno02 -----------------------------------------------------

const isolatedBetweenTenants: ApiRowHandler = async (row) => {
  const otherExpect = strict('respuesta_otro', OTHER_RESPONSES, cell(row, 'respuesta_otro'));
  const ownExpect = strict('respuesta_alumno', OTHER_RESPONSES, cell(row, 'respuesta_alumno'));
  const writeText = cell(row, 'escritura');
  const path = strict('escritura', WRITES, writeText);
  const expected = `la petición de alumno02 responde ${cell(row, 'respuesta_otro')} y la de alumno01 responde ${cell(row, 'respuesta_alumno')}`;
  return withRestore([TENANT_A, TENANT_B], async () => {
    await prepareTenant(TENANT_A);
    await prepareTenant(TENANT_B);
    const adminA = await adminAccess(TENANT_A);
    const preset = await withToken('PATCH', '/admin/chaos', TENANT_A, adminA, { errorRate: 1 });
    if (preset.status !== 200) return preparationFailed(expected, 'alumno01@sigpro.lab fija con PATCH errorRate 1', preset);
    const gestorB = await sessionOfAccount(TENANT_B, GESTOR);
    if (gestorB.token === undefined) return preparationFailed(expected, 'gestor@sigpro.test inicia sesión con x-tenant alumno02', gestorB.result);
    const other = await withToken('POST', path, TENANT_B, gestorB.token);
    const own = await withToken('POST', path, TENANT_A, adminA);
    return rowOutcome([
      expectCheck(other, `la petición de alumno02 responde ${cell(row, 'respuesta_otro')}`, otherExpect),
      expectCheck(own, `la petición de alumno01 responde ${cell(row, 'respuesta_alumno')}`, ownExpect),
    ]);
  });
};

defineApiRows({
  story: 'US-CAOS-RESET-007',
  surface: 'api',
  tenants: [TENANT_A, TENANT_B],
  handlers: new Map<number, ApiRowHandler>([
    [1, delayIsBounded],
    [2, writeFailsWithoutCreating],
    [3, readsKeepWorking],
    [4, exemptRoutesAnswer],
    [5, isolatedBetweenTenants],
  ]),
});
