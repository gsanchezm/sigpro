import { call, field } from '../../../story-runs/support/api';
import { resetTenants, TENANT_A, TENANT_B } from '../../../story-runs/support/prepare';
import { defineApiRows, type ApiRowHandler, type ManifestRow, type Outcome } from '../../core/framework';
import { cell, check, preparationFailed, strict, type Check } from '../../support/checks';
import { fieldIs, gestorIn, idsOf, isolationPrep, itemsOf, statusCheck, thenOf, type Credential, type PrepFailure, finish } from './common';

// US-DOC-LISTA-001 — Lista de documentos por la API: campos, orden y aislamiento por tenant. Preparación: reinicio de alumno01 con
// su administrador y sesión de gestor@sigpro.test en alumno01; las filas de aislamiento reinician también alumno02 y publican la
// versión 4 de su DOC-001 (preparación, no el objeto de la prueba).

/** Código del documento de la celda (los cuatro que citan los ejemplos). */
const CODIGO: ReadonlyMap<string, string> = new Map<string, string>([
  ['DOC-001', 'DOC-001'],
  ['DOC-002', 'DOC-002'],
  ['DOC-003', 'DOC-003'],
  ['DOC-012', 'DOC-012'],
]);

/** Programa de la celda. */
const PROGRAMA: ReadonlyMap<string, string> = new Map<string, string>([
  ['PRG-001', 'PRG-001'],
  ['PRG-002', 'PRG-002'],
  ['PRG-006', 'PRG-006'],
]);

/** Clasificación de la celda (valor de la API). */
const CLASIFICACION: ReadonlyMap<string, string> = new Map<string, string>([
  ['public', 'public'],
  ['restricted', 'restricted'],
]);

/** Versión de la celda, como número (la versión vigente que citan los ejemplos de aislamiento). */
const VERSION_AISLAMIENTO: ReadonlyMap<string, number> = new Map<string, number>([
  ['3', 3],
  ['4', 4],
]);

/** Credencial de la celda: la cabecera Authorization que envía la fila. */
const CREDENCIAL: ReadonlyMap<string, Credential> = new Map<string, Credential>([
  ['(sin cabecera Authorization)', { kind: 'none' }],
  ['Bearer con un texto que no es un token', { kind: 'text' }],
  ['Bearer con el refreshToken', { kind: 'refresh' }],
  ['Bearer con el accessToken', { kind: 'access' }],
]);

/** Respuesta esperada de la celda «respuesta» de la segunda tabla. */
interface Expected {
  readonly status: number;
  readonly code?: string;
  readonly count?: number;
}

const RESPUESTA: ReadonlyMap<string, Expected> = new Map<string, Expected>([
  ['401 missing_token', { status: 401, code: 'missing_token' }],
  ['401 invalid_token', { status: 401, code: 'invalid_token' }],
  ['200 con 12 documentos', { status: 200, count: 12 }],
]);

/** Tenant de la credencial de la tercera tabla (el accessToken de gestor@sigpro.test en ese tenant). */
const TENANT_DE_CREDENCIAL: ReadonlyMap<string, string> = new Map<string, string>([
  ['el accessToken de gestor@sigpro.test en alumno01', TENANT_A],
  ['el accessToken de gestor@sigpro.test en alumno02', TENANT_B],
]);

/** Cabecera x-tenant de la tercera tabla: `undefined` = sin cabecera. */
const CABECERA: ReadonlyMap<string, string | undefined> = new Map<string, string | undefined>([
  ['(sin cabecera)', undefined],
  ['alumno01', TENANT_A],
  ['alumno02', TENANT_B],
]);

const FIRST_LAST = { first: 'DOC-001', last: 'DOC-012' } as const;

// --- Esquema 1: cada documento trae sus campos y su versión vigente ---------------------------------------------------------------

const eachDocumentFields: ApiRowHandler = async (row: ManifestRow): Promise<Outcome> => {
  const expected = thenOf(row);
  const code = strict('código', CODIGO, cell(row, 'codigo'));
  const programa = strict('programa', PROGRAMA, cell(row, 'programa'));
  const clasificacion = strict('clasificación', CLASIFICACION, cell(row, 'clasificacion'));
  await resetTenants([TENANT_A]);
  const gestor = await gestorIn(TENANT_A);
  if (gestor.token === undefined) return preparationFailed(expected, 'gestor@sigpro.test inicia sesión en alumno01', gestor.last);
  const listed = await call('GET', '/documents', { tenant: TENANT_A, token: gestor.token });
  const items = itemsOf(listed.body);
  const item = items.find((candidate) => field(candidate, 'id') === code);
  const ids = idsOf(listed.body);
  return finish([
    statusCheck(listed, 200),
    check(items.length === 12, 'la respuesta trae 12 documentos', `la respuesta trae ${items.length} documentos`),
    check(field(listed.body, 'hiddenCount') === 0, 'hiddenCount 0', `hiddenCount ${String(field(listed.body, 'hiddenCount'))}`),
    check(ids[0] === FIRST_LAST.first && ids[ids.length - 1] === FIRST_LAST.last, 'el primero es DOC-001 y el último es DOC-012', `el primero es ${ids[0] ?? '(ninguno)'} y el último es ${ids[ids.length - 1] ?? '(ninguno)'}`),
    fieldIs(item, 'title', cell(row, 'titulo'), `el documento ${code} tiene el título`),
    fieldIs(item, 'programCode', programa, `el programa`),
    fieldIs(item, 'programName', cell(row, 'nombre_programa'), `con el nombre`),
    fieldIs(item, 'classification', clasificacion, `la clasificación`),
    fieldIs(item, 'version', cell(row, 'version'), `la versión`),
    fieldIs(item, 'updatedAt', cell(row, 'actualizado'), `updatedAt`),
  ]);
};

// --- Esquema 2: la lista solo la entrega una petición con un accessToken válido ----------------------------------------------------

const onlyValidAccessToken: ApiRowHandler = async (row: ManifestRow): Promise<Outcome> => {
  const expected = thenOf(row);
  const credential = strict('credencial', CREDENCIAL, cell(row, 'credencial'));
  const response = strict('respuesta', RESPUESTA, cell(row, 'respuesta'));
  await resetTenants([TENANT_A]);
  const gestor = await gestorIn(TENANT_A);
  if (gestor.token === undefined) return preparationFailed(expected, 'gestor@sigpro.test inicia sesión en alumno01', gestor.last);
  const token = credentialToken(credential, gestor.token, gestor.refreshToken);
  const listed = await call('GET', '/documents', { tenant: TENANT_A, ...(token === undefined ? {} : { token }) });
  const items = itemsOf(listed.body);
  const checks: Check[] = [
    statusCheck(listed, response.status, response.code),
    check(field(listed.body, 'items') === undefined || response.status === 200, 'ninguna respuesta de error trae documentos', `la respuesta trae ${items.length} documentos`),
  ];
  if (response.count !== undefined) checks.push(check(items.length === response.count, `${response.count} documentos`, `${items.length} documentos`));
  return finish(checks);
};

/** Token que envía la fila según su credencial (`undefined` = sin cabecera). Un texto que no es token se envía como tal. */
const credentialToken = (credential: Credential, accessToken: string, refreshToken: string | undefined): string | undefined => {
  if (credential.kind === 'none') return undefined;
  if (credential.kind === 'text') return 'un texto que no es un token';
  if (credential.kind === 'refresh') return refreshToken;
  return accessToken;
};

// --- Esquema 3: cada tenant ve solo sus documentos y la versión de su propio DOC-001 -------------------------------------------------

const ownDocOne: ApiRowHandler = async (row: ManifestRow): Promise<Outcome> => {
  const expected = thenOf(row);
  const tenantOfCredential = strict('credencial', TENANT_DE_CREDENCIAL, cell(row, 'credencial'));
  const header = strict('cabecera', CABECERA, cell(row, 'cabecera'));
  const version = strict('versión', VERSION_AISLAMIENTO, cell(row, 'version'));
  const failure: PrepFailure | undefined = await isolationPrep();
  if (failure !== undefined) return preparationFailed(expected, failure.step, failure.result);
  const owner = await gestorIn(tenantOfCredential);
  if (owner.token === undefined) return preparationFailed(expected, `gestor@sigpro.test inicia sesión en ${tenantOfCredential}`, owner.last);
  const listed = await call('GET', '/documents', { ...(header === undefined ? {} : { tenant: header }), token: owner.token });
  const item = itemsOf(listed.body).find((candidate) => field(candidate, 'id') === 'DOC-001');
  const observed = item === undefined ? '(no aparece)' : String(field(item, 'version'));
  return finish([statusCheck(listed, 200), check(item !== undefined && field(item, 'version') === version, `DOC-001 aparece con la versión ${version}`, `DOC-001 aparece con la versión ${observed}`)], {
    evidence: { cabecera: header ?? '(sin cabecera)', tenantDelToken: tenantOfCredential },
  });
};

defineApiRows({
  story: 'US-DOC-LISTA-001',
  surface: 'api',
  tenants: [TENANT_A, TENANT_B],
  handlers: new Map<number, ApiRowHandler>([
    [1, eachDocumentFields],
    [2, onlyValidAccessToken],
    [3, ownDocOne],
  ]),
});
