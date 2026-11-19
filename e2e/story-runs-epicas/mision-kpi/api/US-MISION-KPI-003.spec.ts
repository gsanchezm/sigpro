import { defineApiRows, type ApiRowHandler } from '../../core/framework';
import { conclude } from './common';
import { cell, preparationFailed, responseCheck, strict } from '../../support/checks';
import { RUN_CHANGES, TENANT_A, adminSession, failedPreparation, integerOf, isOk, kpiCheck, notOkEvidence, resetTenants, seedPresent, summaryOf } from './common';

// US-MISION-KPI-003 — Verificación superada por caso de prueba en el resumen (API). Preparación de cada fila: reinicio de alumno01
// con el token de su administrador, comprobación de los 24 programas del seed y, si la historia lo nombra, la ejecución nueva con ese
// mismo token (multipart, campo `result`). Las cifras de `kpis` se comparan con lo que dice la historia, nunca con la API.

const verificationRow: ApiRowHandler = async (row) => {
  await resetTenants([TENANT_A]);
  const expected = `en kpis verificationPass vale ${cell(row, 'porcentaje')} y casesWithRuns vale ${cell(row, 'casos')}`;
  const change = strict('cambio', RUN_CHANGES, cell(row, 'cambio'));
  const admin = await adminSession(TENANT_A);
  if (admin.token === undefined) return preparationFailed(expected, 'alumno01@sigpro.lab inicia sesión', admin.last);
  const seeded = await seedPresent(admin.token);
  if (seeded !== undefined) return failedPreparation(expected, seeded);
  const done = await change(admin.token);
  if (done !== undefined && !isOk(done)) return preparationFailed(expected, cell(row, 'cambio'), done);
  const result = await summaryOf(admin.token);
  return conclude(
    [
      responseCheck(result, { status: 200 }),
      kpiCheck(result.body, 'verificationPass', integerOf(row, 'porcentaje')),
      kpiCheck(result.body, 'casesWithRuns', integerOf(row, 'casos')),
    ],
    { evidence: notOkEvidence(result) },
  );
};

defineApiRows({
  story: 'US-MISION-KPI-003',
  surface: 'api',
  tenants: [TENANT_A],
  handlers: new Map<number, ApiRowHandler>([[1, verificationRow]]),
});
