import { cell, check, preparationFailed, responseCheck, strict, type Check } from '../../support/checks';
import { defineApiRows, type ApiRowHandler } from '../../core/framework';
import { field, type ApiResult } from '../../../story-runs/support/api';
import {
  codesBetween,
  codesCheck,
  codesIn,
  countCheck,
  isolatedState,
  itemByCode,
  itemsOf,
  joinedCodes,
  listCases,
  numberCheck,
  ownLastResult,
  ownLastRunAt,
  ownRunCount,
  queryOfRequest,
  resetTenants,
  sessionFor,
  tenantAdminSession,
  TENANT_A,
  TENANT_B,
  textFieldCheck,
  type SessionOf,
  concluded,
} from './common';

// US-VER-CASOS-001 — Listar los casos de prueba en páginas de 10 con sus totales y su forma (API). Preparación de cada fila:
// reinicio de alumno01 con el token de su administrador; el reinicio de alumno02 y el borrado del enlace REQ-001 ↔ TC-001 solo en
// el Esquema de aislamiento. Todas las peticiones llevan x-tenant del tenant de la fila.

const TOTAL_CASES = 25;
const TOTAL_RUNS = 50;

// --- Esquema 1: cada página trae sus casos en orden de código ----------------------------------------------------------------

const eachPage: ApiRowHandler = async (row) => {
  await resetTenants([TENANT_A]);
  const expected = `respuesta 200 con ${cell(row, 'cuantos')} casos, desde ${cell(row, 'primero')} hasta ${cell(row, 'ultimo')}`;
  const session = await sessionFor('gestor');
  if (session.token === undefined) return preparationFailed(expected, 'gestor@sigpro.test inicia sesión y recibe accessToken', session.last);
  const result = await listCases(`page=${cell(row, 'pagina')}`, session.token);
  return concluded([
    responseCheck(result, { status: 200 }),
    countCheck(result, Number(cell(row, 'cuantos'))),
    codesCheck(codesIn(result), codesBetween(cell(row, 'primero'), cell(row, 'ultimo'))),
    numberCheck(result.body, 'total', TOTAL_CASES),
    numberCheck(result.body, 'totalAll', TOTAL_CASES),
    numberCheck(result.body, 'totalRuns', TOTAL_RUNS),
    numberCheck(result.body, 'pageSize', 10),
    numberCheck(result.body, 'pages', 3),
    numberCheck(result.body, 'page', Number(cell(row, 'page'))),
  ]);
};

// --- Esquema 2: el tamaño de página se acota entre 1 y 100 ---------------------------------------------------------------

const boundedPageSize: ApiRowHandler = async (row) => {
  await resetTenants([TENANT_A]);
  const expected = `respuesta 200 con ${cell(row, 'cuantos')} casos, pageSize ${cell(row, 'tamano_respuesta')} y pages ${cell(row, 'paginas')}`;
  const session = await sessionFor('gestor');
  if (session.token === undefined) return preparationFailed(expected, 'gestor@sigpro.test inicia sesión y recibe accessToken', session.last);
  const result = await listCases(queryOfRequest(cell(row, 'peticion')), session.token);
  return concluded([
    responseCheck(result, { status: 200 }),
    countCheck(result, Number(cell(row, 'cuantos'))),
    numberCheck(result.body, 'pageSize', Number(cell(row, 'tamano_respuesta'))),
    numberCheck(result.body, 'pages', Number(cell(row, 'paginas'))),
  ]);
};

// --- Esquema 3: una página no válida o fuera de rango no da error --------------------------------------------------------

const invalidPage: ApiRowHandler = async (row) => {
  await resetTenants([TENANT_A]);
  const expected = `respuesta 200 con page ${cell(row, 'page')} y el primer caso es ${cell(row, 'primero')}`;
  const session = await sessionFor('gestor');
  if (session.token === undefined) return preparationFailed(expected, 'gestor@sigpro.test inicia sesión y recibe accessToken', session.last);
  const result = await listCases(queryOfRequest(cell(row, 'peticion')), session.token);
  const first = codesIn(result)[0];
  return concluded([
    responseCheck(result, { status: 200 }),
    numberCheck(result.body, 'page', Number(cell(row, 'page'))),
    check(first === cell(row, 'primero'), `el primer caso ${cell(row, 'primero')}`, `el primer caso ${first ?? '(ninguno)'}`),
  ]);
};

// --- Esquema 4: solo entrega la lista quien tiene una sesión válida ------------------------------------------------------

type Credential = { readonly kind: 'none' } | { readonly kind: 'text' } | { readonly kind: 'account'; readonly account: 'gestor' | 'consultor' | 'auditor' | 'admin' };

const CREDENTIALS: ReadonlyMap<string, Credential> = new Map<string, Credential>([
  ['(sin cabecera Authorization)', { kind: 'none' }],
  ['(un texto que no es un token)', { kind: 'text' }],
  ['el accessToken de gestor@sigpro.test', { kind: 'account', account: 'gestor' }],
  ['el accessToken de consultor@sigpro.test', { kind: 'account', account: 'consultor' }],
  ['el accessToken de auditor@sigpro.test', { kind: 'account', account: 'auditor' }],
  ['el accessToken de admin@sigpro.test', { kind: 'account', account: 'admin' }],
]);

const RESPONSES: ReadonlyMap<string, (result: ApiResult) => readonly Check[]> = new Map<string, (result: ApiResult) => readonly Check[]>([
  ['401 missing_token', (result) => [responseCheck(result, { status: 401, code: 'missing_token' })]],
  ['401 invalid_token', (result) => [responseCheck(result, { status: 401, code: 'invalid_token' })]],
  ['200 con total 25', (result) => [responseCheck(result, { status: 200 }), numberCheck(result.body, 'total', TOTAL_CASES)]],
]);

const credentialRow: ApiRowHandler = async (row) => {
  await resetTenants([TENANT_A]);
  const credential = strict('credencial', CREDENTIALS, cell(row, 'credencial'));
  const expectedChecks = strict('respuesta', RESPONSES, cell(row, 'respuesta'));
  let token: string | undefined;
  if (credential.kind === 'text') token = 'un texto que no es un token';
  if (credential.kind === 'account') {
    const session = await sessionFor(credential.account);
    if (session.token === undefined) return preparationFailed(cell(row, 'respuesta'), `${credential.account} inicia sesión y recibe accessToken`, session.last);
    token = session.token;
  }
  const result = await listCases(undefined, token);
  const checks: Check[] = [...expectedChecks(result)];
  // «Los cuatro roles reciben la misma lista»: se compara la lista completa (páginas 1 a 3: códigos, orden y cada elemento) con la de gestor
  if (credential.kind === 'account' && token !== undefined) {
    const reference = await sessionFor('gestor');
    if (reference.token === undefined) return preparationFailed(cell(row, 'respuesta'), 'gestor@sigpro.test inicia sesión y recibe accessToken (referencia)', reference.last);
    const mine = await wholeList(token);
    const theirs = await wholeList(reference.token);
    const same = mine.statusOk && theirs.statusOk && JSON.stringify(mine.items) === JSON.stringify(theirs.items);
    checks.push(
      check(same, `la misma lista que gestor@sigpro.test (${theirs.codes.length} casos, en el mismo orden)`, `${mine.codes.length} casos: ${mine.codes.join(', ') || '(ninguno)'}${same ? ', igual que gestor' : ', distinta de gestor o sin leer'}`),
    );
  }
  return concluded(checks);
};

/** Lista completa de TC-001…: páginas 1 a 3 con su token (códigos en orden y elementos enteros). */
const wholeList = async (token: string): Promise<{ readonly statusOk: boolean; readonly items: readonly unknown[]; readonly codes: readonly string[] }> => {
  const pages = await Promise.all([1, 2, 3].map((page) => listCases(`page=${page}`, token)));
  const items = pages.flatMap((page) => itemsOf(page));
  return { statusOk: pages.every((page) => page.status === 200), items, codes: items.map((item) => String(field(item, 'code'))) };
};

// --- Esquema 5: cada caso trae sus datos y el resumen de sus ejecuciones -------------------------------------------------

const caseData: ApiRowHandler = async (row) => {
  await resetTenants([TENANT_A]);
  const code = cell(row, 'codigo');
  const expected = `el caso ${code} de items con programCode ${cell(row, 'programa')}, title ${cell(row, 'titulo')}, requirementCodes ${cell(row, 'requisitos')}, runCount ${cell(row, 'ejecuciones')}, lastResult ${cell(row, 'ultimo')} y lastRunAt ${cell(row, 'ultima_fecha')}`;
  const session = await sessionFor('gestor');
  if (session.token === undefined) return preparationFailed(expected, 'gestor@sigpro.test inicia sesión y recibe accessToken', session.last);
  const result = await listCases(`page=${cell(row, 'pagina')}`, session.token);
  const item = itemByCode(result, code);
  if (item === undefined) return concluded([check(false, `el caso ${code} en items`, `el caso ${code} no está en items`)]);
  return concluded([
    textFieldCheck(item, 'programCode', cell(row, 'programa')),
    textFieldCheck(item, 'title', cell(row, 'titulo')),
    check(joinedCodes(field(item, 'requirementCodes')) === cell(row, 'requisitos'), `requirementCodes ${cell(row, 'requisitos')}`, `requirementCodes ${joinedCodes(field(item, 'requirementCodes'))}`),
    numberCheck(item, 'runCount', Number(cell(row, 'ejecuciones'))),
    textFieldCheck(item, 'lastResult', cell(row, 'ultimo'), 'lastResult'),
    textFieldCheck(item, 'lastRunAt', cell(row, 'ultima_fecha'), 'lastRunAt'),
  ], { note: 'La regla del desempate de la última ejecución por id (misma fecha) no se prueba: ningún caso del seed tiene dos ejecuciones con la misma fecha.' });
};

// --- Esquema 6: la lista solo trae los casos del tenant de la sesión ----------------------------------------------------

const TENANT_OF: ReadonlyMap<string, string> = new Map<string, string>([
  ['alumno01', TENANT_A],
  ['alumno02', TENANT_B],
]);

/** Cuenta de la celda → cómo se obtiene su sesión en el tenant de la fila. */
const ACCOUNT_OF: ReadonlyMap<string, 'gestor' | 'tenantAdmin'> = new Map<string, 'gestor' | 'tenantAdmin'>([
  ['gestor@sigpro.test', 'gestor'],
  ['alumno02@sigpro.lab', 'tenantAdmin'],
]);

const isolation: ApiRowHandler = async (row) => {
  const expected = `el caso TC-001 con requirementCodes ${cell(row, 'requisitos')} y total 25`;
  const prepared = await isolatedState();
  if (prepared.failure) return preparationFailed(expected, prepared.failure.step, prepared.failure.result);
  const tenant = strict('tenant', TENANT_OF, cell(row, 'tenant'));
  const account = strict('cuenta', ACCOUNT_OF, cell(row, 'cuenta'));
  const session: SessionOf = account === 'gestor' ? await sessionFor('gestor', tenant) : await tenantAdminSession(tenant);
  if (session.token === undefined) return preparationFailed(expected, `${cell(row, 'cuenta')} inicia sesión en ${cell(row, 'tenant')}`, session.last);
  const result = await listCases(undefined, session.token, tenant);
  const item = itemByCode(result, 'TC-001');
  const codes = item === undefined ? '(sin TC-001)' : joinedCodes(field(item, 'requirementCodes'));
  // Datos propios del tenant: runCount, lastResult y lastRunAt de TC-001 (alumno02 tiene una ejecución extra; alumno01 no)
  const lastRunAt = item === undefined ? '(sin TC-001)' : String(field(item, 'lastRunAt'));
  return concluded([
    check(item !== undefined, 'el caso TC-001 en items', item === undefined ? 'el caso TC-001 no está en items' : 'el caso TC-001 en items'),
    check(codes === cell(row, 'requisitos'), `requirementCodes ${cell(row, 'requisitos')}`, `requirementCodes ${codes}`),
    numberCheck(result.body, 'total', TOTAL_CASES),
    numberCheck(item, 'runCount', ownRunCount(tenant), 'runCount del tenant'),
    check(lastRunAt === (ownLastRunAt(tenant, prepared.extraRun) ?? '(sin ejecución extra)'), `lastRunAt ${ownLastRunAt(tenant, prepared.extraRun) ?? '(sin ejecución extra)'}`, `lastRunAt ${lastRunAt}`),
    textFieldCheck(item, 'lastResult', ownLastResult(tenant), 'lastResult del tenant'),
  ]);
};

defineApiRows({
  story: 'US-VER-CASOS-001',
  surface: 'api',
  tenants: [TENANT_A, TENANT_B],
  handlers: new Map<number, ApiRowHandler>([
    [1, eachPage],
    [2, boundedPageSize],
    [3, invalidPage],
    [4, credentialRow],
    [5, caseData],
    [6, isolation],
  ]),
});
