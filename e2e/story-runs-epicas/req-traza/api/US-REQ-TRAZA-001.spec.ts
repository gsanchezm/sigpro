import { call, field } from '../../../story-runs/support/api';
import { cell, check, preparationFailed, strict } from '../../support/checks';
import { defineApiRows, type ApiRowHandler } from '../../core/framework';
import {
  CABECERA,
  CAMPOS,
  CASO,
  CASOS_ENLAZADOS,
  CONTIENE_ENLACE,
  CREDENCIAL,
  CUENTA,
  GESTOR,
  LISTA_CASOS,
  LISTA_MATRIZ,
  LISTA_REQUISITOS,
  PROGRAM_CODE,
  REQUISITO,
  RESPUESTA,
  RESULTADO,
  ROL,
  TENANT_A,
  TENANT_B,
  answerChecks,
  arrayOf,
  bodyOf,
  casesOf,
  codeListCheck,
  codesOf,
  concluir,
  describePairs,
  keysOf,
  linksOf,
  messageOf,
  onlyErrorBody,
  pairCheck,
  prepareIsolation,
  resetAlumno01,
  resetBoth,
  signIn,
  sameList,
  sortedPairs,
  traceabilityOf,
  type Signed,
} from './common';

// US-REQ-TRAZA-001 — Consultar la matriz de trazabilidad de un programa por la API. Cada fila parte de un reinicio de alumno01 (y
// de alumno02 en las filas de aislamiento) y de un inicio de sesión de la cuenta de la fila. Las listas se comparan código a código
// con lo que dice la historia; una lista vacía no cuenta como cumplida si la historia dice que tiene elementos.

/** Token que envía la fila según su credencial (sin cabecera, un texto que no es JWT, o el refreshToken de gestor). */
const tokenFor = (kind: 'none' | 'text' | 'refresh', signed: Signed): string | undefined => {
  if (kind === 'none') return undefined;
  if (kind === 'text') return 'un texto que no es JWT';
  return signed.refreshToken;
};

/** Lista de la respuesta (los elementos), sin leer nada si la lista no existe. */
const itemsOf = (body: unknown, key: string): readonly unknown[] => arrayOf(body, key);

/** E1: la matriz de cada programa trae sus requisitos y sus casos (listas exactas). */
const matrixOfProgram: ApiRowHandler = async (row) => {
  const program = strict('programa', PROGRAM_CODE, cell(row, 'programa'));
  const requirementsWanted = strict('requisitos', LISTA_REQUISITOS, cell(row, 'requisitos'));
  const casesWanted = strict('casos', LISTA_CASOS, cell(row, 'casos'));
  await resetAlumno01();
  const gestor = await signIn(GESTOR);
  if (gestor.token === undefined) return preparationFailed('gestor@sigpro.test tiene un accessToken válido en alumno01', 'iniciar sesión de gestor@sigpro.test en alumno01', gestor.last);
  const read = await traceabilityOf(program, TENANT_A, gestor.token);
  return concluir(
    [
      check(read.status === 200, 'la respuesta es 200', `respuesta ${read.status}`),
      codeListCheck('requirements', read.body, requirementsWanted, cell(row, 'requisitos')),
      codeListCheck('testCases', read.body, casesWanted, cell(row, 'casos')),
    ],
    { evidence: { respuesta: read.status, cuerpo: bodyOf(read) } },
  );
};

/** E2: cada elemento de la lista trae exactamente sus campos (una lista vacía no cumple: la historia dice que tiene elementos). */
const fieldsOfList: ApiRowHandler = async (row) => {
  const key = strict('lista', LISTA_MATRIZ, cell(row, 'lista'));
  const fieldsWanted = strict('campos', CAMPOS, cell(row, 'campos'));
  await resetAlumno01();
  const gestor = await signIn(GESTOR);
  if (gestor.token === undefined) return preparationFailed('gestor@sigpro.test tiene un accessToken válido en alumno01', 'iniciar sesión de gestor@sigpro.test en alumno01', gestor.last);
  const read = await traceabilityOf('PRG-002', TENANT_A, gestor.token);
  const items = itemsOf(read.body, key);
  const observedSets = [...new Set(items.map((item) => keysOf(item).join(', ')))];
  const wanted = [...fieldsWanted].sort().join(', ');
  return concluir([
    check(read.status === 200, 'la respuesta es 200', `respuesta ${read.status}`),
    check(items.length > 0, `${key} tiene elementos`, `${key}: ${items.length} elementos`),
    check(items.length > 0 && items.every((item) => keysOf(item).join(', ') === wanted), `cada elemento de ${key} trae exactamente ${cell(row, 'campos')}`, `campos vistos en ${key}: ${observedSets.join(' | ') || '(ninguno)'}`),
  ]);
};

/** E3: el último resultado de un caso es el de su ejecución más reciente (la API lo calcula; aquí se lee el valor). */
const lastResultOfCase: ApiRowHandler = async (row) => {
  const caseCode = strict('caso', CASO, cell(row, 'caso'));
  const resultWanted = strict('resultado', RESULTADO, cell(row, 'resultado'));
  await resetAlumno01();
  const gestor = await signIn(GESTOR);
  if (gestor.token === undefined) return preparationFailed('gestor@sigpro.test tiene un accessToken válido en alumno01', 'iniciar sesión de gestor@sigpro.test en alumno01', gestor.last);
  const read = await traceabilityOf('PRG-002', TENANT_A, gestor.token);
  const found = itemsOf(read.body, 'testCases').find((item) => field(item, 'code') === caseCode);
  const observed = found === undefined ? undefined : field(found, 'lastResult');
  return concluir([
    check(read.status === 200, 'la respuesta es 200', `respuesta ${read.status}`),
    check(observed === resultWanted, `el caso ${caseCode} tiene lastResult ${resultWanted}`, `el caso ${caseCode} tiene lastResult ${found === undefined ? '(caso ausente en testCases)' : String(observed)}`),
  ]);
};

/** E4: los enlaces de un requisito salen en el orden de la historia; la lista va ordenada y no mezcla programas. */
const linkOrder: ApiRowHandler = async (row) => {
  const requirement = strict('requisito', REQUISITO, cell(row, 'requisito'));
  const casesWanted = strict('casos', CASOS_ENLAZADOS, cell(row, 'casos'));
  await resetAlumno01();
  const gestor = await signIn(GESTOR);
  if (gestor.token === undefined) return preparationFailed('gestor@sigpro.test tiene un accessToken válido en alumno01', 'iniciar sesión de gestor@sigpro.test en alumno01', gestor.last);
  const read = await traceabilityOf('PRG-002', TENANT_A, gestor.token);
  const links = linksOf(read.body);
  const requirementCodes = codesOf(read.body, 'requirements');
  const caseCodes = codesOf(read.body, 'testCases');
  const linked = casesOf(links, requirement);
  return concluir([
    check(read.status === 200, 'la respuesta es 200', `respuesta ${read.status}`),
    check(requirementCodes.includes(requirement), `${requirement} es un requisito de PRG-002`, requirementCodes.includes(requirement) ? `${requirement} está en requirements` : `${requirement} no está en requirements`),
    check(sameList(linked, casesWanted), `en links, el requisito ${requirement} aparece con ${cell(row, 'casos')}`, `${requirement} aparece con ${linked.length === 0 ? '(ninguno)' : linked.join(' y después ')}`),
    check(sortedPairs(links), 'links va ordenada por requirementCode y, dentro de cada requisito, por testCaseCode', sortedPairs(links) ? 'links va en orden' : `links fuera de orden: ${describePairs(links)}`),
    check(
      links.every((pair) => requirementCodes.includes(pair.requirementCode) && caseCodes.includes(pair.testCaseCode)),
      'ningún enlace relaciona un requisito o un caso de otro programa',
      links.every((pair) => requirementCodes.includes(pair.requirementCode) && caseCodes.includes(pair.testCaseCode)) ? 'todos los enlaces son de PRG-002' : 'hay enlaces de otro programa',
    ),
  ]);
};

/** E5: un programa que no existe en el tenant responde 404 y no trae ninguna lista. */
const unknownProgram: ApiRowHandler = async (row) => {
  const program = strict('codigo', PROGRAM_CODE, cell(row, 'codigo'));
  await resetAlumno01();
  const gestor = await signIn(GESTOR);
  if (gestor.token === undefined) return preparationFailed('gestor@sigpro.test tiene un accessToken válido en alumno01', 'iniciar sesión de gestor@sigpro.test en alumno01', gestor.last);
  const read = await traceabilityOf(program, TENANT_A, gestor.token);
  return concluir([
    check(read.status === 404, 'la respuesta es 404', `respuesta ${read.status}`),
    check(field(read.body, 'code') === 'program_not_found', 'code program_not_found', `code ${String(field(read.body, 'code'))}`),
    check(messageOf(read) === 'program_not_found', 'message program_not_found', `message ${messageOf(read) ?? '(sin message)'}`),
    onlyErrorBody(read, 'requirements, testCases ni links'),
  ]);
};

/** E6: cualquier rol del tenant lee la matriz: 14 requisitos y 9 casos en PRG-002. */
const readByRole: ApiRowHandler = async (row) => {
  const account = strict('rol', ROL, cell(row, 'rol'));
  await resetAlumno01();
  const signed = await signIn(account);
  if (signed.token === undefined) return preparationFailed(`la cuenta de rol ${cell(row, 'rol')} tiene un accessToken válido`, `iniciar sesión de la cuenta de rol ${account.role} en alumno01`, signed.last);
  if (signed.role !== account.role) return preparationFailed(`el token trae el rol ${account.role}`, `el token trae el rol ${signed.role ?? '(sin rol)'}`, signed.last);
  const read = await traceabilityOf('PRG-002', TENANT_A, signed.token);
  const requirements = itemsOf(read.body, 'requirements').length;
  const cases = itemsOf(read.body, 'testCases').length;
  return concluir([
    check(read.status === 200, 'la respuesta es 200', `respuesta ${read.status}`),
    check(requirements === 14, 'requirements tiene 14 elementos', `requirements: ${requirements} elementos`),
    check(cases === 9, 'testCases tiene 9 elementos', `testCases: ${cases} elementos`),
  ]);
};

/** E7: sin una sesión de acceso válida no se devuelve ningún dato. */
const withoutSession: ApiRowHandler = async (row) => {
  const credential = strict('credencial', CREDENCIAL, cell(row, 'credencial'));
  const answer = strict('respuesta', RESPUESTA, cell(row, 'respuesta'));
  await resetAlumno01();
  const gestor = await signIn(GESTOR);
  if (gestor.token === undefined || gestor.refreshToken === undefined) {
    return preparationFailed('gestor@sigpro.test tiene un accessToken y un refreshToken', 'iniciar sesión de gestor@sigpro.test en alumno01', gestor.last);
  }
  const token = tokenFor(credential.kind, gestor);
  const read = await traceabilityOf('PRG-002', TENANT_A, token);
  return concluir([...answerChecks(answer, read), onlyErrorBody(read, 'requirements, testCases ni links')], { evidence: { respuesta: read.status, cuerpo: bodyOf(read) } });
};

/** E8: cada tenant ve solo sus requisitos; alumno02 ha creado REQ-041 en PRG-001. */
const isolationRequirements: ApiRowHandler = async (row) => {
  const account = strict('cuenta', CUENTA, cell(row, 'cuenta'));
  const tenant = strict('cabecera', CABECERA, cell(row, 'cabecera'));
  const wanted = strict('requisitos', LISTA_REQUISITOS, cell(row, 'requisitos'));
  const prepared = await prepareIsolation('alumno02@sigpro.lab crea REQ-041 en PRG-001 (alumno02 con código REQ-041)');
  if (prepared !== undefined) return prepared;
  const signed = await signIn(account);
  if (signed.token === undefined) return preparationFailed(`la cuenta ${cell(row, 'cuenta')} inicia sesión`, `iniciar sesión de ${cell(row, 'cuenta')}`, signed.last);
  const read = await traceabilityOf('PRG-001', tenant, signed.token);
  return concluir([check(read.status === 200, 'la respuesta es 200', `respuesta ${read.status}`), codeListCheck('requirements', read.body, wanted, cell(row, 'requisitos'))], {
    evidence: { cabeceraEnviada: tenant, respuesta: read.status },
  });
};

/** E9: un enlace de alumno01 no aparece en la matriz de alumno02 (y sí en la de alumno01, aunque se pida con la cabecera de alumno02). */
const linkAcrossTenants: ApiRowHandler = async (row) => {
  const account = strict('cuenta', CUENTA, cell(row, 'cuenta'));
  const tenant = strict('cabecera', CABECERA, cell(row, 'cabecera'));
  const present = strict('enlace', CONTIENE_ENLACE, cell(row, 'enlace'));
  await resetBoth();
  const gestor = await signIn(GESTOR);
  if (gestor.token === undefined) return preparationFailed('gestor@sigpro.test enlaza REQ-028 con TC-010 en alumno01', 'iniciar sesión de gestor@sigpro.test en alumno01', gestor.last);
  const linked = await call('PUT', '/requirements/REQ-028/tests/TC-010', { tenant: TENANT_A, token: gestor.token });
  if (linked.status !== 204) return preparationFailed('gestor@sigpro.test enlaza REQ-028 con TC-010 en alumno01 (respuesta 204)', 'PUT del enlace en alumno01', linked);
  const signed = await signIn(account);
  if (signed.token === undefined) return preparationFailed(`la cuenta ${cell(row, 'cuenta')} inicia sesión`, `iniciar sesión de ${cell(row, 'cuenta')}`, signed.last);
  const read = await traceabilityOf('PRG-002', tenant, signed.token);
  return concluir([check(read.status === 200, 'la respuesta es 200', `respuesta ${read.status}`), pairCheck(linksOf(read.body), 'REQ-028', 'TC-010', present)], {
    evidence: { cabeceraEnviada: tenant, respuesta: read.status },
  });
};

defineApiRows({
  story: 'US-REQ-TRAZA-001',
  surface: 'api',
  tenants: [TENANT_A, TENANT_B],
  handlers: new Map<number, ApiRowHandler>([
    [1, matrixOfProgram],
    [2, fieldsOfList],
    [3, lastResultOfCase],
    [4, linkOrder],
    [5, unknownProgram],
    [6, readByRole],
    [7, withoutSession],
    [8, isolationRequirements],
    [9, linkAcrossTenants],
  ]),
});
