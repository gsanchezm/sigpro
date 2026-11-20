import { defineApiRows, type ApiRowHandler } from '../../core/framework';
import { cell, preparationFailed, responseCheck, strict } from '../../support/checks';
import { RUN_CHANGES, TENANT_A, adminSession, call, conclude, failedPreparation, field, integerOf, isOk, kpiCheck, listOf, notOkEvidence, resetTenants, seedPresent, summaryOf, type ApiResult } from './common';

// US-MISION-KPI-003 — Verificación superada por caso de prueba en el resumen (API). Preparación de cada fila: reinicio de alumno01 con
// el token de su administrador, comprobación de los 24 programas del seed, lectura del último resultado de TC-001, TC-002 y TC-003
// (la historia los da por hechos) y, si la historia lo nombra, la ejecución nueva con ese mismo token (multipart, campo `result`).
// Las cifras de `kpis` se comparan con lo que dice la historia, nunca con la API.

/** Último resultado de un caso (el de su ejecución más reciente, la primera del detalle, que viene ordenada por fecha) y la respuesta cruda. */
const lastResultOf = async (token: string, code: string): Promise<{ readonly last: string | undefined; readonly detail: ApiResult }> => {
  const detail = await call('GET', `/test-cases/${code}`, { tenant: TENANT_A, token });
  const newest = listOf(detail.body, 'runs')?.[0];
  const last = isOk(detail) && typeof field(newest, 'result') === 'string' ? String(field(newest, 'result')) : undefined;
  return { last, detail };
};

/** Estado inicial que la historia da por hecho: TC-001 con último resultado `blocked`, TC-002 `fail` y TC-003 `pass`. */
const LAST_RESULTS: readonly (readonly [string, string])[] = [
  ['TC-001', 'blocked'],
  ['TC-002', 'fail'],
  ['TC-003', 'pass'],
];

const verificationRow: ApiRowHandler = async (row) => {
  await resetTenants([TENANT_A]);
  const expected = `en kpis verificationPass vale ${cell(row, 'porcentaje')} y casesWithRuns vale ${cell(row, 'casos')}`;
  const change = strict('cambio', RUN_CHANGES, cell(row, 'cambio'));
  const admin = await adminSession(TENANT_A);
  if (admin.token === undefined) return preparationFailed(expected, 'alumno01@sigpro.lab inicia sesión', admin.last);
  const seeded = await seedPresent(admin.token);
  if (seeded !== undefined) return failedPreparation(expected, seeded);
  // Los estados de partida de TC-001, TC-002 y TC-003 se leen (no se infieren de los deltas de la historia)
  for (const [code, result] of LAST_RESULTS) {
    const { last, detail } = await lastResultOf(admin.token, code);
    if (last !== result) return preparationFailed(expected, `el último resultado de ${code} es ${result} (la API dice ${last ?? '(sin leer)'})`, detail);
  }
  const done = await change(admin.token);
  if (done !== undefined && !isOk(done)) return failedPreparation(expected, { step: cell(row, 'cambio'), result: done });
  const result = await summaryOf(admin.token);
  return conclude(
    [
      responseCheck(result, { status: 200 }),
      kpiCheck(result.body, 'verificationPass', integerOf(row, 'porcentaje')),
      kpiCheck(result.body, 'casesWithRuns', integerOf(row, 'casos')),
    ],
    {
      evidence: notOkEvidence(result),
      // Reglas que ninguna fila de la historia puede alcanzar con el seed: se anotan, no se afirman aquí
      note: 'No comprobado por las filas: el redondeo de 0,5 hacia arriba (la app usa Math.round, percentOf), «sin casos con ejecuciones → 0» (el seed tiene 25 casos con ejecuciones) y el desempate por identificador cuando dos ejecuciones tienen la misma fecha (no es alcanzable por la API: la fecha es la del servidor).',
    },
  );
};

defineApiRows({
  story: 'US-MISION-KPI-003',
  surface: 'api',
  tenants: [TENANT_A],
  handlers: new Map<number, ApiRowHandler>([[1, verificationRow]]),
});
