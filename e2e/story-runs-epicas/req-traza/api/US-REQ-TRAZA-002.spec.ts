import { call, type ApiResult } from '../../../story-runs/support/api';
import { cell, check, preparationFailed, strict } from '../../support/checks';
import { defineApiRows, type ApiRowHandler } from '../../core/framework';
import {
  AUDITOR,
  CASO,
  CREDENCIAL,
  CUENTA,
  GESTOR,
  PROGRAM_CODE,
  REQUISITO,
  RESPUESTA,
  TENANT_A,
  answerChecks,
  bodyOf,
  concluir,
  countPair,
  linksOf,
  pairCheck,
  resetAlumno01,
  signIn,
  traceabilityOf,
} from './common';

// US-REQ-TRAZA-002 — Enlazar un caso de prueba con un requisito del mismo programa. Cada fila reinicia alumno01, inicia sesión la
// cuenta de la fila y comprueba por la API (GET de la matriz) que el enlace queda, o que no cambia. La petición PUT no lleva cuerpo.

/** PUT del enlace requisito–caso con el token dado (sin token, sin cabecera Authorization), en alumno01. */
const putLink = (requirement: string, testCase: string, token: string | undefined): Promise<ApiResult> =>
  call('PUT', `/requirements/${requirement}/tests/${testCase}`, { tenant: TENANT_A, ...(token === undefined ? {} : { token }) });

/** Frase de cada comprobación con el prefijo de la petición (primera o segunda), para que el informe distinga las dos. */
const labeled = (prefix: string, checks: readonly { readonly ok: boolean; readonly expected: string; readonly observed: string }[]) =>
  checks.map((entry) => ({ ...entry, expected: `${prefix}: ${entry.expected}`, observed: `${prefix}: ${entry.observed}` }));

/** E1: un enlace nuevo responde 204 y aparece en la matriz. */
const linkNew: ApiRowHandler = async (row) => {
  const account = strict('cuenta', CUENTA, cell(row, 'cuenta'));
  const requirement = strict('requisito', REQUISITO, cell(row, 'requisito'));
  const testCase = strict('caso', CASO, cell(row, 'caso'));
  const program = strict('programa', PROGRAM_CODE, cell(row, 'programa'));
  await resetAlumno01();
  const signed = await signIn(account);
  if (signed.token === undefined) return preparationFailed(`${cell(row, 'cuenta')} tiene un accessToken válido`, `iniciar sesión de ${cell(row, 'cuenta')} en alumno01`, signed.last);
  const before = await traceabilityOf(program, TENANT_A, signed.token);
  if (before.status !== 200) return preparationFailed(`la matriz de ${program} responde 200 antes de enlazar`, `GET de la matriz de ${program}`, before);
  if (countPair(linksOf(before.body), requirement, testCase) !== 0) return preparationFailed(`${requirement} no tiene enlazado ${testCase}`, `${requirement} ya tiene enlazado ${testCase} tras el reinicio`, before);
  const put = await putLink(requirement, testCase, signed.token);
  const after = await traceabilityOf(program, TENANT_A, signed.token);
  return concluir([...answerChecks({ status: 204, sinCuerpo: true }, put), check(after.status === 200, 'la matriz responde 200', `respuesta ${after.status}`), pairCheck(linksOf(after.body), requirement, testCase, true)], {
    evidence: { respuestaPut: put.status, respuestaMatriz: after.status, cuerpoMatriz: bodyOf(after) },
  });
};

/** E2: enlazar un par ya enlazado dos veces responde 204 dos veces y el par aparece una sola vez. */
const linkTwice: ApiRowHandler = async (row) => {
  const account = strict('cuenta', CUENTA, cell(row, 'cuenta'));
  const requirement = strict('requisito', REQUISITO, cell(row, 'requisito'));
  const testCase = strict('caso', CASO, cell(row, 'caso'));
  const program = strict('programa', PROGRAM_CODE, cell(row, 'programa'));
  await resetAlumno01();
  const signed = await signIn(account);
  if (signed.token === undefined) return preparationFailed(`${cell(row, 'cuenta')} tiene un accessToken válido`, `iniciar sesión de ${cell(row, 'cuenta')} en alumno01`, signed.last);
  const before = await traceabilityOf(program, TENANT_A, signed.token);
  if (before.status !== 200) return preparationFailed(`la matriz de ${program} responde 200 antes de enlazar`, `GET de la matriz de ${program}`, before);
  if (countPair(linksOf(before.body), requirement, testCase) !== 1) return preparationFailed(`${requirement} ya tiene enlazado ${testCase}`, `${requirement} no tiene enlazado ${testCase} tras el reinicio`, before);
  const first = await putLink(requirement, testCase, signed.token);
  const second = await putLink(requirement, testCase, signed.token);
  const after = await traceabilityOf(program, TENANT_A, signed.token);
  return concluir(
    [
      ...labeled('primera petición', answerChecks({ status: 204, sinCuerpo: true }, first)),
      ...labeled('segunda petición', answerChecks({ status: 204, sinCuerpo: true }, second)),
      check(after.status === 200, 'la matriz responde 200', `respuesta ${after.status}`),
      pairCheck(linksOf(after.body), requirement, testCase, true),
    ],
    { evidence: { respuestasPut: [first.status, second.status], respuestaMatriz: after.status } },
  );
};

/** E3: un rol sin permiso de edición recibe 403, aunque el requisito no exista, y el enlace no se crea. */
const forbiddenLink: ApiRowHandler = async (row) => {
  const requirement = strict('requisito', REQUISITO, cell(row, 'requisito'));
  const testCase = strict('caso', CASO, cell(row, 'caso'));
  await resetAlumno01();
  const auditor = await signIn(AUDITOR);
  if (auditor.token === undefined) return preparationFailed('auditor@sigpro.test tiene un accessToken válido', 'iniciar sesión de auditor@sigpro.test en alumno01', auditor.last);
  const before = await traceabilityOf('PRG-002', TENANT_A, auditor.token);
  if (before.status !== 200) return preparationFailed('la matriz de PRG-002 responde 200 antes de intentarlo', 'GET de la matriz de PRG-002', before);
  if (countPair(linksOf(before.body), requirement, testCase) !== 0) return preparationFailed(`${requirement} no tiene enlazado ${testCase}`, `${requirement} ya tiene enlazado ${testCase}`, before);
  const put = await putLink(requirement, testCase, auditor.token);
  const after = await traceabilityOf('PRG-002', TENANT_A, auditor.token);
  // Con REQ-999 el enlace no puede existir de todos modos (no hay requisito): el «no aparece» no prueba por sí solo el 403
  const note =
    requirement === 'REQ-999' ? 'REQ-999 no existe: el enlace no podría crearse aunque el rol pasara; lo que sí prueba la fila es que el 403 llega antes de la existencia del requisito.' : undefined;
  return concluir([...answerChecks({ status: 403, code: 'forbidden' }, put), check(after.status === 200, 'la matriz responde 200', `respuesta ${after.status}`), pairCheck(linksOf(after.body), requirement, testCase, false)], {
    ...(note === undefined ? {} : { note }),
    evidence: { respuesta: put.status, cuerpo: bodyOf(put) },
  });
};

/** E4: sin una sesión de acceso válida no se enlaza y el enlace no aparece. */
const withoutSessionLink: ApiRowHandler = async (row) => {
  const credential = strict('credencial', CREDENCIAL, cell(row, 'credencial'));
  const answer = strict('respuesta', RESPUESTA, cell(row, 'respuesta'));
  await resetAlumno01();
  const gestor = await signIn(GESTOR);
  if (gestor.token === undefined || gestor.refreshToken === undefined) {
    return preparationFailed('gestor@sigpro.test tiene un accessToken y un refreshToken válidos', 'iniciar sesión de gestor@sigpro.test en alumno01', gestor.last);
  }
  const token = credential.kind === 'none' ? undefined : credential.kind === 'text' ? 'un texto que no es JWT' : gestor.refreshToken;
  const put = await putLink('REQ-028', 'TC-010', token);
  const after = await traceabilityOf('PRG-002', TENANT_A, gestor.token);
  return concluir([...answerChecks(answer, put), check(after.status === 200, 'la matriz responde 200', `respuesta ${after.status}`), pairCheck(linksOf(after.body), 'REQ-028', 'TC-010', false)], { evidence: { respuesta: put.status, cuerpo: bodyOf(put) } });
};

defineApiRows({
  story: 'US-REQ-TRAZA-002',
  surface: 'api',
  tenants: [TENANT_A],
  handlers: new Map<number, ApiRowHandler>([
    [1, linkNew],
    [2, linkTwice],
    [3, forbiddenLink],
    [4, withoutSessionLink],
  ]),
});
