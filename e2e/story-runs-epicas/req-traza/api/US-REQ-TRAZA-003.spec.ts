import { call, type ApiResult } from '../../../story-runs/support/api';
import { cell, check, preparationFailed, strict } from '../../support/checks';
import { defineApiRows, type ApiRowHandler } from '../../core/framework';
import {
  APARECE,
  CABECERA,
  CASO,
  CUENTA,
  GESTOR,
  REQUISITO,
  RESPUESTA,
  TENANT_A,
  TENANT_B,
  answerChecks,
  bodyOf,
  concluir,
  linksOf,
  onlyErrorBody,
  pairCheck,
  prepareIsolation,
  resetAlumno01,
  samePairs,
  sameLinkSet,
  signIn,
  traceabilityOf,
  type Pair,
} from './common';

// US-REQ-TRAZA-003 — Rechazar un enlace que no puede crearse. Una petición rechazada no crea enlace y no cambia la lista links: cada
// fila compara la lista completa antes y después (por pares), no solo el par pedido.

/** PUT del enlace requisito–caso con el token y la cabecera `x-tenant` dados. */
const putLink = (requirement: string, testCase: string, tenant: string, token: string | undefined): Promise<ApiResult> =>
  call('PUT', `/requirements/${requirement}/tests/${testCase}`, { tenant, ...(token === undefined ? {} : { token }) });

/** Programa al que pertenece cada requisito de la fila (según el seed: REQ-015…REQ-028 de PRG-002, REQ-029…REQ-040 de PRG-003). */
const PROGRAMA_DEL_REQUISITO: ReadonlyMap<string, string> = new Map<string, string>([
  ['REQ-028', 'PRG-002'],
  ['REQ-040', 'PRG-003'],
]);

/** E1: un caso solo se enlaza con requisitos de su mismo programa; el rechazo no cambia links y el aceptado añade solo su par. */
const sameProgramOnly: ApiRowHandler = async (row) => {
  const requirement = strict('requisito', REQUISITO, cell(row, 'requisito'));
  const testCase = strict('caso', CASO, cell(row, 'caso'));
  const answer = strict('respuesta', RESPUESTA, cell(row, 'respuesta'));
  const present = strict('enlace', APARECE, cell(row, 'enlace'));
  const program = PROGRAMA_DEL_REQUISITO.get(requirement);
  if (program === undefined) throw new Error(`celda sin interpretación: requisito «${requirement}» sin programa en el seed de la fila`);
  await resetAlumno01();
  const gestor = await signIn(GESTOR);
  if (gestor.token === undefined) return preparationFailed('gestor@sigpro.test tiene un accessToken válido en alumno01', 'iniciar sesión de gestor@sigpro.test en alumno01', gestor.last);
  const before = await traceabilityOf(program, TENANT_A, gestor.token);
  if (before.status !== 200) return preparationFailed(`la matriz de ${program} responde 200 antes de enlazar`, `GET de la matriz de ${program}`, before);
  const beforeLinks: readonly Pair[] = linksOf(before.body);
  if (beforeLinks.some((pair) => pair.requirementCode === requirement && pair.testCaseCode === testCase)) {
    return preparationFailed(`${requirement} no tiene enlazado ${testCase}`, `${requirement} ya tiene enlazado ${testCase} tras el reinicio`, before);
  }
  const put = await putLink(requirement, testCase, TENANT_A, gestor.token);
  const after = await traceabilityOf(program, TENANT_A, gestor.token);
  const afterLinks = linksOf(after.body);
  const expectedLinks: readonly Pair[] = present ? [...beforeLinks, { requirementCode: requirement, testCaseCode: testCase }] : beforeLinks;
  return concluir(
    [
      ...answerChecks(answer, put),
      check(after.status === 200, 'la matriz responde 200', `respuesta ${after.status}`),
      pairCheck(afterLinks, requirement, testCase, present),
      check(sameLinkSet(afterLinks, expectedLinks), present ? 'links solo suma ese enlace' : 'links no cambia', sameLinkSet(afterLinks, expectedLinks) ? `links ${present ? 'solo suma ese enlace' : 'no cambia'}` : `links ${afterLinks.length} pares, se esperaban ${expectedLinks.length}`),
    ],
    { evidence: { respuesta: put.status, cuerpo: bodyOf(put) } },
  );
};

/** E2: un caso que no existe en el tenant responde 404 sin datos del caso y sin tocar links. */
const unknownTestCase: ApiRowHandler = async (row) => {
  const testCase = strict('caso', CASO, cell(row, 'caso'));
  await resetAlumno01();
  const gestor = await signIn(GESTOR);
  if (gestor.token === undefined) return preparationFailed('gestor@sigpro.test tiene un accessToken válido en alumno01', 'iniciar sesión de gestor@sigpro.test en alumno01', gestor.last);
  const before = await traceabilityOf('PRG-002', TENANT_A, gestor.token);
  if (before.status !== 200) return preparationFailed('la matriz de PRG-002 responde 200 antes de intentarlo', 'GET de la matriz de PRG-002', before);
  const beforeLinks = linksOf(before.body);
  const put = await putLink('REQ-028', testCase, TENANT_A, gestor.token);
  const after = await traceabilityOf('PRG-002', TENANT_A, gestor.token);
  return concluir(
    [
      ...answerChecks({ status: 404, code: 'test_case_not_found', mensaje: true }, put),
      onlyErrorBody(put, 'ningún dato del caso'),
      check(after.status === 200, 'la matriz responde 200', `respuesta ${after.status}`),
      check(samePairs(beforeLinks, linksOf(after.body)), 'la lista links no cambia', samePairs(beforeLinks, linksOf(after.body)) ? 'la lista links no cambia' : 'la lista links cambió'),
    ],
    { evidence: { respuesta: put.status, cuerpo: bodyOf(put) } },
  );
};

/** E3: un requisito que no existe en el tenant responde 404 sin datos del requisito y sin tocar links. */
const unknownRequirement: ApiRowHandler = async (row) => {
  const requirement = strict('requisito', REQUISITO, cell(row, 'requisito'));
  await resetAlumno01();
  const gestor = await signIn(GESTOR);
  if (gestor.token === undefined) return preparationFailed('gestor@sigpro.test tiene un accessToken válido en alumno01', 'iniciar sesión de gestor@sigpro.test en alumno01', gestor.last);
  const before = await traceabilityOf('PRG-002', TENANT_A, gestor.token);
  if (before.status !== 200) return preparationFailed('la matriz de PRG-002 responde 200 antes de intentarlo', 'GET de la matriz de PRG-002', before);
  const beforeLinks = linksOf(before.body);
  const put = await putLink(requirement, 'TC-010', TENANT_A, gestor.token);
  const after = await traceabilityOf('PRG-002', TENANT_A, gestor.token);
  return concluir(
    [
      ...answerChecks({ status: 404, code: 'requirement_not_found', mensaje: true }, put),
      onlyErrorBody(put, 'ningún dato del requisito'),
      check(after.status === 200, 'la matriz responde 200', `respuesta ${after.status}`),
      check(samePairs(beforeLinks, linksOf(after.body)), 'la lista links no cambia', samePairs(beforeLinks, linksOf(after.body)) ? 'la lista links no cambia' : 'la lista links cambió'),
    ],
    { evidence: { respuesta: put.status, cuerpo: bodyOf(put) } },
  );
};

/** E4: un requisito de otro tenant responde igual que uno que no existe; el de alumno02 se enlaza en alumno02. */
const otherTenantRequirement: ApiRowHandler = async (row) => {
  const account = strict('cuenta', CUENTA, cell(row, 'cuenta'));
  const tenant = strict('cabecera', CABECERA, cell(row, 'cabecera'));
  const answer = strict('respuesta', RESPUESTA, cell(row, 'respuesta'));
  const prepared = await prepareIsolation('alumno02@sigpro.lab crea REQ-041 en PRG-001 (alumno02 con código REQ-041)');
  if (prepared !== undefined) return prepared;
  const signed = await signIn(account);
  if (signed.token === undefined) return preparationFailed(`la cuenta ${cell(row, 'cuenta')} inicia sesión`, `iniciar sesión de ${cell(row, 'cuenta')}`, signed.last);
  const put = await putLink('REQ-041', 'TC-002', tenant, signed.token);
  const after = await traceabilityOf('PRG-001', tenant, signed.token);
  return concluir([...answerChecks(answer, put), check(after.status === 200, 'la matriz responde 200', `respuesta ${after.status}`), pairCheck(linksOf(after.body), 'REQ-041', 'TC-002', answer.status === 204)], {
    evidence: { cabeceraEnviada: tenant, respuesta: put.status, cuerpo: bodyOf(put) },
  });
};

defineApiRows({
  story: 'US-REQ-TRAZA-003',
  surface: 'api',
  tenants: [TENANT_A, TENANT_B],
  handlers: new Map<number, ApiRowHandler>([
    [1, sameProgramOnly],
    [2, unknownTestCase],
    [3, unknownRequirement],
    [4, otherTenantRequirement],
  ]),
});
