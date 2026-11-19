import { field } from '../../../story-runs/support/api';
import { defineApiRows, type ApiRowHandler, type Outcome } from '../../core/framework';
import { cell, check, preparationFailed, strict, type Check } from '../../support/checks';
import { ACCOUNT_OF, TENANT_A, act, codeCell, codesOf, expectChecks, itemsOf, loginAs, positionsOf, resetTenants, snapshotOf, unchangedCheck, verdict, auditCount, auditDelta } from './common';

// US-REQ-EDICION-004 — Borrar un requisito con sus descendientes y sus enlaces (API). Preparación de cada fila: reinicio de alumno01 y
// token de gestor@sigpro.test. Las listas de códigos de las celdas se leen con `codesOf`, que valida cada código y LANZA si no lo es.

/** Token de gestor en alumno01 tras reiniciarlo. Devuelve el token, o la preparación fallida. */
const gestorToken = async (expected: string): Promise<string | Outcome> => {
  await resetTenants([TENANT_A]);
  const session = await loginAs(strict('cuenta', ACCOUNT_OF, 'gestor@sigpro.test'));
  return session.token ?? preparationFailed(expected, 'gestor@sigpro.test inicia sesión en alumno01 y recibe accessToken', session.last);
};

/** Lectura de un requisito: 200 con él, o 404 `requirement_not_found`. */
const existsCheck = async (token: string, code: string, shouldExist: boolean): Promise<Check> => {
  const read = await act('GET', `/requirements/${code}`, token);
  const ok = shouldExist ? read.status === 200 : read.status === 404 && field(read.body, 'code') === 'requirement_not_found';
  return check(ok, shouldExist ? `GET ${code} responde 200` : `GET ${code} responde 404 requirement_not_found`, `GET ${code} responde ${read.status}${shouldExist ? '' : ` ${String(field(read.body, 'code') ?? '')}`}`);
};

/** Comprobación de que los hermanos y el resto del árbol no cambian de posición: las posiciones de los que quedan son las de antes. */
const positionsCheck = (beforeItems: readonly Record<string, unknown>[] | undefined, afterItems: readonly Record<string, unknown>[] | undefined): Check => {
  if (beforeItems === undefined || afterItems === undefined) return check(false, 'las posiciones del programa se pueden leer', 'posiciones: lectura no disponible');
  const before = positionsOf(beforeItems);
  const after = positionsOf(afterItems);
  const moved = [...after.keys()].filter((code) => before.get(code) !== after.get(code));
  return check(moved.length === 0, 'los requisitos que quedan conservan su posición', moved.length === 0 ? 'los que quedan conservan su posición' : `cambian de posición: ${moved.join(', ')}`);
};

// --- Esquema 1: el borrado quita el requisito y todos sus descendientes -------------------------------------------------------

const deletesSubtree: ApiRowHandler = async (row) => {
  const code = codeCell(cell(row, 'codigo'));
  const deleted = codesOf(cell(row, 'borrados'));
  const kept = codesOf(cell(row, 'siguen'));
  const expected = `DELETE ${code} responde 204; ${deleted.join(', ')} responden 404; ${kept.join(', ')} siguen`;
  const token = await gestorToken(expected);
  if (typeof token !== 'string') return token;
  const beforeItems = itemsOf(await act('GET', '/programs/PRG-001/requirements', token));
  const auditBefore = await auditCount(code, 'requirement.deleted');
  const result = await act('DELETE', `/requirements/${code}`, token);
  const auditAfter = await auditCount(code, 'requirement.deleted');
  const checks: Check[] = expectChecks({ status: 204 }, result);
  // Un borrado correcto deja un evento requirement.deleted del código borrado
  checks.push(auditDelta(auditBefore, auditAfter, 1, `requirement.deleted de ${code}`));
  // La historia dice «el programa PRG-001 tiene 14 requisitos» como punto de partida
  checks.push(check(beforeItems?.length === 14, 'PRG-001 tiene 14 requisitos antes del borrado', `PRG-001 tiene ${beforeItems?.length ?? '(sin leer)'} requisitos antes del borrado`));
  for (const gone of deleted) checks.push(await existsCheck(token, gone, false));
  for (const stay of kept) checks.push(await existsCheck(token, stay, true));
  const afterItems = itemsOf(await act('GET', '/programs/PRG-001/requirements', token));
  const expectedCount = beforeItems === undefined ? undefined : beforeItems.length - deleted.length;
  checks.push(check(afterItems !== undefined && afterItems.length === expectedCount, `PRG-001 queda con ${expectedCount ?? '(sin leer)'} requisitos`, `PRG-001 queda con ${afterItems?.length ?? '(sin leer)'} requisitos`));
  checks.push(positionsCheck(beforeItems, afterItems));
  return verdict(checks);
};

// --- Esquema 2: el borrado quita los enlaces con los casos de prueba y no borra los casos ----------------------------

/** Enlaces requisito-caso del programa (`links` de la matriz de trazabilidad), o `undefined` si no se pudo leer. */
const linksOf = async (token: string): Promise<readonly { readonly requirementCode: string; readonly testCaseCode: string }[] | undefined> => {
  const read = await act('GET', '/programs/PRG-001/traceability', token);
  const links = field(read.body, 'links');
  return read.status === 200 && Array.isArray(links) ? (links as { requirementCode: string; testCaseCode: string }[]) : undefined;
};

const removesLinks: ApiRowHandler = async (row) => {
  const code = codeCell(cell(row, 'codigo'));
  const caso = codeCell(cell(row, 'caso'));
  const expected = `DELETE ${code} responde 204; el enlace ${code}-${caso} desaparece; GET ${caso} responde 200`;
  const token = await gestorToken(expected);
  if (typeof token !== 'string') return token;
  const linksBefore = await linksOf(token);
  const linked = linksBefore?.some((link) => link.requirementCode === code && link.testCaseCode === caso) ?? false;
  if (!linked) return preparationFailed(expected, `${code} está enlazado con ${caso} en la matriz de trazabilidad antes del borrado`, await act('GET', '/programs/PRG-001/traceability', token));
  const result = await act('DELETE', `/requirements/${code}`, token);
  const linksAfter = await linksOf(token);
  const stillLinked = linksAfter?.some((link) => link.requirementCode === code && link.testCaseCode === caso);
  const testCase = await act('GET', `/test-cases/${caso}`, token);
  return verdict([
    ...expectChecks({ status: 204 }, result),
    check(linksAfter !== undefined && stillLinked === false, `la matriz ya no lista ${code}-${caso}`, linksAfter === undefined ? 'matriz no legible' : stillLinked ? `la matriz sigue listando ${code}-${caso}` : `la matriz no lista ${code}-${caso}`),
    check(testCase.status === 200, `GET /api/test-cases/${caso} responde 200`, `GET /api/test-cases/${caso} responde ${testCase.status}`),
  ]);
};

// --- Esquema 3: un código que no existe en el tenant responde 404 y no borra nada ----------------------------------------

const unknownDeletesNothing: ApiRowHandler = async (row) => {
  const code = codeCell(cell(row, 'codigo'));
  const expected = 'respuesta 404 requirement_not_found; PRG-001 conserva sus 14 requisitos';
  const token = await gestorToken(expected);
  if (typeof token !== 'string') return token;
  const before = await snapshotOf(token, 'PRG-001');
  const result = await act('DELETE', `/requirements/${code}`, token);
  const after = await snapshotOf(token, 'PRG-001');
  const count = itemsOf(await act('GET', '/programs/PRG-001/requirements', token))?.length;
  return verdict([
    ...expectChecks({ status: 404, code: 'requirement_not_found' }, result),
    check(count === 14, 'PRG-001 conserva sus 14 requisitos', `PRG-001 tiene ${count ?? '(sin leer)'} requisitos`),
    unchangedCheck(before, after, 'la lista de PRG-001'),
  ]);
};

defineApiRows({
  story: 'US-REQ-EDICION-004',
  surface: 'api',
  tenants: [TENANT_A],
  handlers: new Map<number, ApiRowHandler>([
    [1, deletesSubtree],
    [2, removesLinks],
    [3, unknownDeletesNothing],
  ]),
});
