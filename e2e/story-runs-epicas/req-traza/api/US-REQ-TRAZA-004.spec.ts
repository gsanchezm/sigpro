import { call, type ApiResult } from '../../../story-runs/support/api';
import { cell, check, preparationFailed, strict } from '../../support/checks';
import { defineApiRows, type ApiRowHandler } from '../../core/framework';
import {
  AUDITOR,
  CASO,
  CONSERVA,
  CUENTA,
  GESTOR,
  PROGRAM_CODE,
  REQUISITO,
  SITUACION,
  TENANT_A,
  answerChecks,
  bodyOf,
  casesOf,
  codesOf,
  concluir,
  countPair,
  describeList,
  linksOf,
  onlyErrorBody,
  pairCheck,
  pairKey,
  resetAlumno01,
  samePairs,
  signIn,
  traceabilityOf,
  type Pair,
} from './common';

// US-REQ-TRAZA-004 — Desenlazar un caso de prueba de un requisito. Quitar un enlace borra solo ese par: el requisito y el caso siguen
// existiendo y el resto de enlaces queda igual. Cada fila compara la lista links antes y después, por pares.

/** DELETE del enlace requisito–caso en alumno01 con el token dado. */
const unlink = (requirement: string, testCase: string, token: string | undefined): Promise<ApiResult> =>
  call('DELETE', `/requirements/${requirement}/tests/${testCase}`, { tenant: TENANT_A, ...(token === undefined ? {} : { token }) });

/** E1: quitar un enlace existente responde 204 y lo borra; el resto de enlaces del requisito se mantiene. */
const unlinkExisting: ApiRowHandler = async (row) => {
  const account = strict('cuenta', CUENTA, cell(row, 'cuenta'));
  const requirement = strict('requisito', REQUISITO, cell(row, 'requisito'));
  const testCase = strict('caso', CASO, cell(row, 'caso'));
  const kept = strict('conserva', CONSERVA, cell(row, 'conserva'));
  await resetAlumno01();
  const signed = await signIn(account);
  if (signed.token === undefined) return preparationFailed(`${cell(row, 'cuenta')} tiene un accessToken válido`, `iniciar sesión de ${cell(row, 'cuenta')} en alumno01`, signed.last);
  const before = await traceabilityOf('PRG-002', TENANT_A, signed.token);
  if (before.status !== 200) return preparationFailed('la matriz de PRG-002 responde 200 antes de desenlazar', 'GET de la matriz de PRG-002', before);
  const beforeLinks = linksOf(before.body);
  if (countPair(beforeLinks, requirement, testCase) !== 1) return preparationFailed(`${requirement} tiene enlazado ${testCase}`, `${requirement} no tiene enlazado ${testCase} tras el reinicio`, before);
  const del = await unlink(requirement, testCase, signed.token);
  const after = await traceabilityOf('PRG-002', TENANT_A, signed.token);
  const afterLinks = linksOf(after.body);
  const expectedLinks: readonly Pair[] = beforeLinks.filter((pair) => pairKey(pair) !== `${requirement}|${testCase}`);
  return concluir(
    [
      ...answerChecks({ status: 204, sinCuerpo: true }, del),
      check(after.status === 200, 'la matriz responde 200', `respuesta ${after.status}`),
      pairCheck(afterLinks, requirement, testCase, false),
      check(
        samePairs(casesOf(afterLinks, requirement).map((code) => ({ requirementCode: requirement, testCaseCode: code })), kept.map((code) => ({ requirementCode: requirement, testCaseCode: code }))),
        `los casos enlazados de ${requirement} son ${cell(row, 'conserva')}`,
        `los casos enlazados de ${requirement} son ${casesOf(afterLinks, requirement).join(', ') || '(ninguno)'}`,
      ),
      check(codesOf(after.body, 'testCases').includes(testCase), `${testCase} sigue en testCases`, codesOf(after.body, 'testCases').includes(testCase) ? `${testCase} sigue en testCases` : `${testCase} ya no está en testCases`),
      check(codesOf(after.body, 'requirements').includes(requirement), `${requirement} sigue en requirements`, codesOf(after.body, 'requirements').includes(requirement) ? `${requirement} sigue en requirements` : `${requirement} ya no está en requirements`),
      check(samePairs(afterLinks, expectedLinks), 'links queda igual salvo ese enlace', samePairs(afterLinks, expectedLinks) ? 'links queda igual salvo ese enlace' : `links tiene ${afterLinks.length} pares, se esperaban ${expectedLinks.length}`),
    ],
    { evidence: { respuesta: del.status, enlacesQuedan: describeList(afterLinks.map(pairKey)) } },
  );
};

/** E2: quitar un enlace que no existe responde 204 y no cambia nada. */
const unlinkMissing: ApiRowHandler = async (row) => {
  const account = strict('cuenta', CUENTA, cell(row, 'cuenta'));
  const requirement = strict('requisito', REQUISITO, cell(row, 'requisito'));
  const testCase = strict('caso', CASO, cell(row, 'caso'));
  const program = strict('programa', PROGRAM_CODE, cell(row, 'programa'));
  await resetAlumno01();
  const signed = await signIn(account);
  if (signed.token === undefined) return preparationFailed(`${cell(row, 'cuenta')} tiene un accessToken válido`, `iniciar sesión de ${cell(row, 'cuenta')} en alumno01`, signed.last);
  const before = await traceabilityOf(program, TENANT_A, signed.token);
  if (before.status !== 200) return preparationFailed(`la matriz de ${program} responde 200 antes de desenlazar`, `GET de la matriz de ${program}`, before);
  const beforeLinks = linksOf(before.body);
  if (countPair(beforeLinks, requirement, testCase) !== 0) return preparationFailed(`${requirement} no tiene enlazado ${testCase}`, `${requirement} sí tiene enlazado ${testCase} tras el reinicio`, before);
  const del = await unlink(requirement, testCase, signed.token);
  const after = await traceabilityOf(program, TENANT_A, signed.token);
  return concluir(
    [
      ...answerChecks({ status: 204, sinCuerpo: true }, del),
      check(after.status === 200, 'la matriz responde 200', `respuesta ${after.status}`),
      check(samePairs(beforeLinks, linksOf(after.body)), `los enlaces de ${program} quedan igual que tras el reinicio`, samePairs(beforeLinks, linksOf(after.body)) ? `los enlaces de ${program} no cambian` : `los enlaces de ${program} cambiaron`),
    ],
    { evidence: { respuesta: del.status } },
  );
};

/** E3: un rol sin permiso de edición recibe 403 y el enlace se mantiene (o sigue sin existir). */
const forbiddenUnlink: ApiRowHandler = async (row) => {
  const requirement = strict('requisito', REQUISITO, cell(row, 'requisito'));
  const testCase = strict('caso', CASO, cell(row, 'caso'));
  const present = strict('situacion', SITUACION, cell(row, 'situacion'));
  await resetAlumno01();
  const auditor = await signIn(AUDITOR);
  if (auditor.token === undefined) return preparationFailed('auditor@sigpro.test tiene un accessToken válido', 'iniciar sesión de auditor@sigpro.test en alumno01', auditor.last);
  const before = await traceabilityOf('PRG-002', TENANT_A, auditor.token);
  if (before.status !== 200) return preparationFailed('la matriz de PRG-002 responde 200 antes de intentarlo', 'GET de la matriz de PRG-002', before);
  const beforeLinks = linksOf(before.body);
  if (countPair(beforeLinks, requirement, testCase) !== (present ? 1 : 0)) {
    return preparationFailed(`el enlace de ${requirement} con ${testCase} ${present ? 'existe' : 'no existe'} tras el reinicio`, 'el estado inicial no coincide con el seed', before);
  }
  const del = await unlink(requirement, testCase, auditor.token);
  const after = await traceabilityOf('PRG-002', TENANT_A, auditor.token);
  // Con REQ-999 no hay enlace que quitar: el «no aparece» no prueba por sí solo el 403, lo prueba la respuesta
  const note = requirement === 'REQ-999' ? 'REQ-999 no existe y no tiene enlace: el 403 es lo que prueba la fila; el «no aparece» sería igual aunque la petición se aceptara.' : undefined;
  return concluir(
    [
      ...answerChecks({ status: 403, code: 'forbidden' }, del),
      check(after.status === 200, 'la matriz responde 200', `respuesta ${after.status}`),
      pairCheck(linksOf(after.body), requirement, testCase, present),
      check(samePairs(beforeLinks, linksOf(after.body)), 'links no cambia', samePairs(beforeLinks, linksOf(after.body)) ? 'links no cambia' : 'links cambió'),
    ],
    { ...(note === undefined ? {} : { note }), evidence: { respuesta: del.status, cuerpo: bodyOf(del) } },
  );
};

/** E4: un requisito que no existe en el tenant responde 404 sin datos del requisito. */
const unknownRequirementUnlink: ApiRowHandler = async (row) => {
  const requirement = strict('requisito', REQUISITO, cell(row, 'requisito'));
  await resetAlumno01();
  const gestor = await signIn(GESTOR);
  if (gestor.token === undefined) return preparationFailed('gestor@sigpro.test tiene un accessToken válido en alumno01', 'iniciar sesión de gestor@sigpro.test en alumno01', gestor.last);
  const del = await unlink(requirement, 'TC-012', gestor.token);
  return concluir([...answerChecks({ status: 404, code: 'requirement_not_found' }, del), onlyErrorBody(del, 'ningún dato del requisito')], { evidence: { respuesta: del.status, cuerpo: bodyOf(del) } });
};

defineApiRows({
  story: 'US-REQ-TRAZA-004',
  surface: 'api',
  tenants: [TENANT_A],
  handlers: new Map<number, ApiRowHandler>([
    [1, unlinkExisting],
    [2, unlinkMissing],
    [3, forbiddenUnlink],
    [4, unknownRequirementUnlink],
  ]),
});
