import { cell, check, conclude, preparationFailed, responseCheck, strict, type Check } from '../../support/checks';
import { defineApiRows, type ApiRowHandler } from '../../core/framework';
import { codesCheck, codesIn, codesOf, itemsOf, listPrograms, numberCheck, resetTenants, sessionFor, TENANT_A, textFieldCheck, type AccountKey } from './common';
import { field, type ApiResult } from '../../../story-runs/support/api';

// US-PROG-LISTA-001 — Listar los programas en páginas de 10 con su total y su forma (API). Preparación de cada fila: reinicio de
// alumno01 con el token de su administrador y, si la fila usa una cuenta, inicio de sesión de esa cuenta en alumno01. Todas las
// peticiones llevan x-tenant: alumno01.

// --- Esquema 1: cada página trae sus programas en orden de código ----------------------------------------------------------------

const eachPage: ApiRowHandler = async (row) => {
  await resetTenants([TENANT_A]);
  const expected = `respuesta 200 con ${cell(row, 'cuantos')} programas, desde ${cell(row, 'primero')} hasta ${cell(row, 'ultimo')}`;
  const session = await sessionFor('gestor');
  if (session.token === undefined) return preparationFailed(expected, 'gestor@sigpro.test inicia sesión y recibe accessToken', session.last);
  const result = await listPrograms(`page=${cell(row, 'pagina')}`, session.token);
  return conclude([
    responseCheck(result, { status: 200 }),
    check(itemsOf(result).length === Number(cell(row, 'cuantos')), `${cell(row, 'cuantos')} programas`, `${itemsOf(result).length} programas`),
    codesCheck(codesIn(result), codesOf(`${cell(row, 'primero')} a ${cell(row, 'ultimo')}`)),
    numberCheck(result, 'total', 24),
    numberCheck(result, 'totalAll', 24),
    numberCheck(result, 'activeCount', 12),
    numberCheck(result, 'pageSize', 10),
    numberCheck(result, 'pages', 3),
    numberCheck(result, 'page', Number(cell(row, 'page'))),
  ]);
};

// --- Esquema 2: el tamaño de página se acota entre 1 y 100 -------------------------------------------------------------------

const boundedPageSize: ApiRowHandler = async (row) => {
  await resetTenants([TENANT_A]);
  const expected = `respuesta 200 con ${cell(row, 'cuantos')} programas, pageSize ${cell(row, 'tamano_respuesta')} y pages ${cell(row, 'paginas')}`;
  const session = await sessionFor('gestor');
  if (session.token === undefined) return preparationFailed(expected, 'gestor@sigpro.test inicia sesión y recibe accessToken', session.last);
  const result = await listPrograms(`pageSize=${cell(row, 'tamano')}`, session.token);
  return conclude([
    responseCheck(result, { status: 200 }),
    check(itemsOf(result).length === Number(cell(row, 'cuantos')), `${cell(row, 'cuantos')} programas`, `${itemsOf(result).length} programas`),
    numberCheck(result, 'pageSize', Number(cell(row, 'tamano_respuesta'))),
    numberCheck(result, 'pages', Number(cell(row, 'paginas'))),
  ]);
};

// --- Esquema 3: una página no válida o fuera de rango no da error -------------------------------------------------------------

const invalidPage: ApiRowHandler = async (row) => {
  await resetTenants([TENANT_A]);
  const expected = `respuesta 200 con page ${cell(row, 'page')} y el primer programa es ${cell(row, 'primero')}`;
  const session = await sessionFor('gestor');
  if (session.token === undefined) return preparationFailed(expected, 'gestor@sigpro.test inicia sesión y recibe accessToken', session.last);
  const result = await listPrograms(`page=${cell(row, 'pagina')}`, session.token);
  const first = codesIn(result)[0];
  return conclude([
    responseCheck(result, { status: 200 }),
    numberCheck(result, 'page', Number(cell(row, 'page'))),
    check(first === cell(row, 'primero'), `el primer programa ${cell(row, 'primero')}`, `el primer programa ${first ?? '(ninguno)'}`),
  ]);
};

// --- Esquema 4: solo entrega la lista quien tiene una sesión válida ------------------------------------------------------------

type Credential = { readonly kind: 'none' } | { readonly kind: 'text' } | { readonly kind: 'account'; readonly account: AccountKey };

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
  ['200 con total 24', (result) => [responseCheck(result, { status: 200 }), numberCheck(result, 'total', 24)]],
]);

const credentialRow: ApiRowHandler = async (row) => {
  await resetTenants([TENANT_A]);
  const credential = strict('credencial', CREDENTIALS, cell(row, 'credencial'));
  const expectedCheck = strict('respuesta', RESPONSES, cell(row, 'respuesta'));
  const expected = cell(row, 'respuesta');
  let token: string | undefined;
  if (credential.kind === 'text') token = 'un texto que no es un token';
  if (credential.kind === 'account') {
    const session = await sessionFor(credential.account);
    if (session.token === undefined) return preparationFailed(expected, `${credential.account} inicia sesión y recibe accessToken`, session.last);
    token = session.token;
  }
  const result = await listPrograms(undefined, token);
  return conclude(expectedCheck(result));
};

// --- Esquema 5: el primer programa trae sus datos completos ----------------------------------------------------------------------

const FIRST_FIELDS: ReadonlyArray<readonly [cellKey: string, apiKey: string]> = [
  ['codigo', 'code'],
  ['nombre', 'name'],
  ['estado', 'status'],
  ['responsable', 'ownerName'],
  ['inicio', 'startDate'],
  ['fin', 'endDate'],
  ['presupuesto', 'budgetEur'],
  ['avance', 'progress'],
  ['hechos', 'milestonesDone'],
  ['hitos', 'milestonesTotal'],
];

/** Campos del elemento que la regla nombra («trae code, name, description, status, priority, classified, ownerId…»). */
const PRESENT_FIELDS: readonly string[] = ['description', 'priority', 'classified', 'ownerId'];

const firstProgram: ApiRowHandler = async (row) => {
  await resetTenants([TENANT_A]);
  const expected = `respuesta 200 y el primer programa con ${FIRST_FIELDS.map(([key]) => `${key} ${cell(row, key)}`).join(', ')}`;
  const session = await sessionFor('gestor');
  if (session.token === undefined) return preparationFailed(expected, 'gestor@sigpro.test inicia sesión y recibe accessToken', session.last);
  const result = await listPrograms(undefined, session.token);
  const first: unknown = itemsOf(result)[0];
  return conclude([
    responseCheck(result, { status: 200 }),
    check(first !== undefined, 'un primer programa en items', first === undefined ? 'items vacío' : 'un primer programa en items'),
    ...FIRST_FIELDS.map(([cellKey, apiKey]) => textFieldCheck(first, apiKey, cell(row, cellKey), apiKey)),
    // Campos que la regla de la historia nombra y la fila no lee: deben estar presentes
    ...PRESENT_FIELDS.map((key) => check(field(first, key) !== undefined, `trae ${key}`, field(first, key) === undefined ? `sin ${key}` : `trae ${key}`)),
  ]);
};

defineApiRows({
  story: 'US-PROG-LISTA-001',
  surface: 'api',
  tenants: [TENANT_A],
  handlers: new Map<number, ApiRowHandler>([
    [1, eachPage],
    [2, boundedPageSize],
    [3, invalidPage],
    [4, credentialRow],
    [5, firstProgram],
  ]),
});
