import { call, field } from '../../../story-runs/support/api';
import { DEMO, TENANT_A, TENANT_B } from '../../../story-runs/support/prepare';
import { cell, check, conclude, preparationFailed, strict } from '../../support/checks';
import { defineApiRows, type ApiRowHandler } from '../../core/framework';
import {
  CREDENTIAL,
  ISOLATION_ACCOUNT,
  ISOLATION_HEADER,
  codesOfObjects,
  expectedOf,
  getRequirement,
  isolationAdmin,
  noRequirementData,
  notFoundCheck,
  plainOf,
  quotedText,
  requirementShape,
  resetTenants,
  sameAs,
  sameValue,
  sessionOfAccount,
  shown,
  statusCheck,
  valueCheck,
} from './common';

// US-REQ-ARBOL-002 — Consultar el detalle de un requisito del tenant (API). Preparación de cada fila: reinicio de alumno01 con el token de su
// administrador y, después, inicio de sesión de la cuenta de la fila en alumno01 con x-tenant: alumno01. Las filas de aislamiento (Esquema 8)
// reinician también alumno02 y crean allí el requisito REQ-041 («Requisito de aislamiento») con POST /api/requirements. El reinicio no apaga
// el caos: el marco lo comprueba antes de cada fila.

// --- Esquema 1: el detalle de un requisito trae sus campos del seed --------------------------------------------------------------------------

const FIELD_READERS: ReadonlyMap<string, (body: unknown) => unknown> = new Map<string, (body: unknown) => unknown>([
  ['code', (body) => field(body, 'code')],
  ['programCode', (body) => field(body, 'programCode')],
  ['parentCode', (body) => field(body, 'parentCode')],
  ['title', (body) => field(body, 'title')],
  ['priority', (body) => field(body, 'priority')],
  ['state', (body) => field(body, 'state')],
  ['position', (body) => field(body, 'position')],
  ['testCaseCodes', (body) => field(body, 'testCaseCodes')],
]);

const detailField: ApiRowHandler = async (row) => {
  await resetTenants([TENANT_A]);
  const codigo = cell(row, 'codigo');
  const campo = cell(row, 'campo');
  const read = strict('campo', FIELD_READERS, campo);
  const valor = cell(row, 'valor');
  const expected = `respuesta 200 y el campo ${campo} vale ${valor}`;
  const session = await sessionOfAccount(TENANT_A, DEMO.gestor);
  if (session.accessToken === undefined) return preparationFailed(expected, 'gestor@sigpro.test inicia sesión y recibe accessToken', session.last);
  const result = await getRequirement(codigo, session.accessToken);
  return conclude([statusCheck(result, { status: 200 }), valueCheck(`${campo} de ${codigo}`, read(result.body), valor), ...requirementShape(result.body)]);
};

// --- Esquema 2: la posición del requisito y su padre se leen en el detalle --------------------------------------------------------------------

const detailPlacement: ApiRowHandler = async (row) => {
  await resetTenants([TENANT_A]);
  const codigo = cell(row, 'codigo');
  const expected = `el requisito ${codigo} tiene programCode ${cell(row, 'programa')}, parentCode ${cell(row, 'padre')}, state ${cell(row, 'estado')}, priority ${cell(row, 'prioridad')}, position ${cell(row, 'posicion')} y testCaseCodes ${cell(row, 'casos')}`;
  const session = await sessionOfAccount(TENANT_A, DEMO.gestor);
  if (session.accessToken === undefined) return preparationFailed(expected, 'gestor@sigpro.test inicia sesión y recibe accessToken', session.last);
  const result = await getRequirement(codigo, session.accessToken);
  return conclude([
    statusCheck(result, { status: 200 }),
    valueCheck(`programCode de ${codigo}`, field(result.body, 'programCode'), cell(row, 'programa')),
    valueCheck(`parentCode de ${codigo}`, field(result.body, 'parentCode'), cell(row, 'padre')),
    valueCheck(`state de ${codigo}`, field(result.body, 'state'), cell(row, 'estado')),
    valueCheck(`priority de ${codigo}`, field(result.body, 'priority'), cell(row, 'prioridad')),
    valueCheck(`position de ${codigo}`, field(result.body, 'position'), cell(row, 'posicion')),
    valueCheck(`testCaseCodes de ${codigo}`, field(result.body, 'testCaseCodes'), cell(row, 'casos')),
    ...requirementShape(result.body),
  ]);
};

// --- Esquema 3: la descripción del requisito se guarda como texto con formato ----------------------------------------------------------------

const detailText: ApiRowHandler = async (row) => {
  await resetTenants([TENANT_A]);
  const codigo = cell(row, 'codigo');
  const texto = quotedText(cell(row, 'texto'));
  const expected = `el texto de description de ${codigo}, sin etiquetas HTML, es ${texto}`;
  const session = await sessionOfAccount(TENANT_A, DEMO.gestor);
  if (session.accessToken === undefined) return preparationFailed(expected, 'gestor@sigpro.test inicia sesión y recibe accessToken', session.last);
  const result = await getRequirement(codigo, session.accessToken);
  const plain = plainOf(field(result.body, 'description'));
  return conclude([statusCheck(result, { status: 200 }), check(plain === texto, `el texto de description es ${texto}`, `el texto de description es «${plain}»`), ...requirementShape(result.body)]);
};

// --- Esquema 4: las etiquetas del requisito son las que se guardaron, en su orden ------------------------------------------------------------

const detailTags: ApiRowHandler = async (row) => {
  await resetTenants([TENANT_A]);
  const codigo = cell(row, 'codigo');
  const etiquetas = cell(row, 'etiquetas');
  const expected = `el requisito ${codigo} tiene tags ${etiquetas}`;
  const session = await sessionOfAccount(TENANT_A, DEMO.gestor);
  if (session.accessToken === undefined) return preparationFailed(expected, 'gestor@sigpro.test inicia sesión y recibe accessToken', session.last);
  const result = await getRequirement(codigo, session.accessToken);
  return conclude([statusCheck(result, { status: 200 }), valueCheck(`tags de ${codigo}`, field(result.body, 'tags'), etiquetas), ...requirementShape(result.body)]);
};

// --- Esquema 5: los casos enlazados aparecen en tests con su código -------------------------------------------------------------------------

const detailTests: ApiRowHandler = async (row) => {
  await resetTenants([TENANT_A]);
  const codigo = cell(row, 'codigo');
  const casos = cell(row, 'casos');
  const expected = `en tests aparecen solo los códigos ${casos}`;
  const session = await sessionOfAccount(TENANT_A, DEMO.gestor);
  if (session.accessToken === undefined) return preparationFailed(expected, 'gestor@sigpro.test inicia sesión y recibe accessToken', session.last);
  const result = await getRequirement(codigo, session.accessToken);
  const codes = codesOfObjects(field(result.body, 'tests'));
  return conclude([statusCheck(result, { status: 200 }), check(sameValue(codes, casos), `en tests solo ${casos}`, `en tests ${shown(codes)}`), ...requirementShape(result.body)]);
};

// --- Esquema 6: un requisito sin casos enlazados no tiene ni tests ni no conformidades ------------------------------------------------------

const UNLINKED: ReadonlyMap<string, string> = new Map<string, string>([
  ['REQ-014', 'REQ-014'],
  ['REQ-028', 'REQ-028'],
]);

const detailUnlinked: ApiRowHandler = async (row) => {
  await resetTenants([TENANT_A]);
  const codigo = strict('código', UNLINKED, cell(row, 'codigo'));
  const expected = `el campo tests es una lista vacía y el campo ncs es una lista vacía (${codigo})`;
  const session = await sessionOfAccount(TENANT_A, DEMO.gestor);
  if (session.accessToken === undefined) return preparationFailed(expected, 'gestor@sigpro.test inicia sesión y recibe accessToken', session.last);
  const result = await getRequirement(codigo, session.accessToken);
  return conclude([
    statusCheck(result, { status: 200 }),
    valueCheck('tests', field(result.body, 'tests'), '(vacío)'),
    valueCheck('ncs', field(result.body, 'ncs'), '(vacío)'),
    ...requirementShape(result.body),
  ]);
};

// --- Esquema 7: un código que no es un requisito del tenant responde 404 ----------------------------------------------------------------------

const NOT_REQUIREMENTS: ReadonlyMap<string, string> = new Map<string, string>([
  ['REQ-000', 'REQ-000'],
  ['REQ-041', 'REQ-041'],
  ['PRG-001', 'PRG-001'],
]);

const notARequirement: ApiRowHandler = async (row) => {
  await resetTenants([TENANT_A]);
  const codigo = strict('código', NOT_REQUIREMENTS, cell(row, 'codigo'));
  const expected = `respuesta 404 con el código requirement_not_found para ${codigo}, sin datos de requisito`;
  const session = await sessionOfAccount(TENANT_A, DEMO.gestor);
  if (session.accessToken === undefined) return preparationFailed(expected, 'gestor@sigpro.test inicia sesión y recibe accessToken', session.last);
  const result = await getRequirement(codigo, session.accessToken);
  return conclude([notFoundCheck(result, 'requirement_not_found'), noRequirementData(result)]);
};

// --- Esquema 8: un requisito de otro tenant responde igual que un código que no existe ----------------------------------------------------

const ISOLATION_RESPONSE: ReadonlyMap<string, 'not-found' | 'found'> = new Map<string, 'not-found' | 'found'>([
  ['404 requirement_not_found', 'not-found'],
  ['200 con el título Requisito de aislamiento', 'found'],
]);

const isolation: ApiRowHandler = async (row) => {
  await resetTenants([TENANT_A, TENANT_B]);
  const expected = `respuesta ${cell(row, 'respuesta')}`;
  // Preparación: alumno02@sigpro.lab crea «Requisito de aislamiento» en PRG-001 (REQ-041) y gestor@sigpro.test entra en alumno01
  const admin02 = await isolationAdmin();
  if (admin02.accessToken === undefined) return preparationFailed(expected, 'alumno02@sigpro.lab inicia sesión en alumno02 y recibe accessToken', admin02.last);
  const created = await call('POST', '/requirements', { tenant: TENANT_B, token: admin02.accessToken, body: { programCode: 'PRG-001', title: 'Requisito de aislamiento' } });
  if (created.status < 200 || created.status > 299 || field(created.body, 'code') !== 'REQ-041') {
    return preparationFailed(expected, 'alumno02@sigpro.lab crea «Requisito de aislamiento» en PRG-001 y recibe el código REQ-041', created);
  }
  const gestor = await sessionOfAccount(TENANT_A, DEMO.gestor);
  if (gestor.accessToken === undefined) return preparationFailed(expected, 'gestor@sigpro.test inicia sesión en alumno01 y recibe accessToken', gestor.last);

  const who = strict('cuenta', ISOLATION_ACCOUNT, cell(row, 'cuenta'));
  const token = who === 'gestor' ? gestor.accessToken : admin02.accessToken;
  const header = strict('cabecera', ISOLATION_HEADER, cell(row, 'cabecera'));
  const wanted = strict('respuesta', ISOLATION_RESPONSE, cell(row, 'respuesta'));
  const result = await getRequirement('REQ-041', token, header);
  if (wanted === 'found') {
    return conclude([statusCheck(result, { status: 200 }), valueCheck('title', field(result.body, 'title'), 'Requisito de aislamiento'), ...requirementShape(result.body)]);
  }
  // 404: estado, código y mensaje; sin datos; y el mismo cuerpo que un código que no existe (REQ-000, mismo token y cabecera), salvo el traceId
  const missing = await getRequirement('REQ-000', token, header);
  return conclude([notFoundCheck(result, 'requirement_not_found'), noRequirementData(result), sameAs(result, missing, 'igual que un código que no existe (REQ-000)')]);
};

// --- Esquema 9: sin una sesión de acceso válida no se devuelve ningún dato del requisito --------------------------------------------------

const noSession: ApiRowHandler = async (row) => {
  await resetTenants([TENANT_A]);
  const respuesta = cell(row, 'respuesta');
  const expected = `respuesta ${respuesta} y el cuerpo no trae ningún dato del requisito`;
  const gestor = await sessionOfAccount(TENANT_A, DEMO.gestor);
  const refresh = gestor.refreshToken;
  if (gestor.accessToken === undefined || refresh === undefined) return preparationFailed(expected, 'gestor@sigpro.test inicia sesión y recibe accessToken y refreshToken', gestor.last);
  const admin = await sessionOfAccount(TENANT_A, DEMO.admin);
  const mfa = admin.mfaToken;
  if (mfa === undefined) return preparationFailed(expected, 'admin@sigpro.test inicia sesión y recibe mfaToken', admin.last);

  const credential = strict('credencial', CREDENTIAL, cell(row, 'credencial'));
  const token = credential === 'ninguna' ? undefined : credential === 'texto' ? 'texto-que-no-es-jwt' : credential === 'refresh' ? refresh : mfa;
  const result = await getRequirement('REQ-001', token);
  return conclude([statusCheck(result, expectedOf(respuesta)), noRequirementData(result)]);
};

defineApiRows({
  story: 'US-REQ-ARBOL-002',
  surface: 'api',
  tenants: [TENANT_A, TENANT_B],
  handlers: new Map<number, ApiRowHandler>([
    [1, detailField],
    [2, detailPlacement],
    [3, detailText],
    [4, detailTags],
    [5, detailTests],
    [6, detailUnlinked],
    [7, notARequirement],
    [8, isolation],
    [9, noSession],
  ]),
});
