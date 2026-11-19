import { adminCredentials, field } from '../../../story-runs/support/api';
import { DEMO } from '../../../story-runs/support/prepare';
import { defineApiRows, type ApiRowHandler, type ManifestRow } from '../../core/framework';
import { cell, check, preparationFailed, strict, type Check } from '../../support/checks';
import {
  ACCOUNT_CELLS,
  CONSULTA_CELLS,
  LIST_CELLS,
  NC_CODE_CELLS,
  NUMBER_CELLS,
  PROGRAM_CELLS,
  RESPONSIBLE_CELLS,
  SEVERITY_CELLS,
  STATE_CELLS,
  TENANT_A,
  TENANT_B,
  TENANT_CELLS,
  TENANT_OF_ACCOUNT,
  actorOf,
  answerChecks,
  codesCheck,
  codesOfItems,
  itemsOf,
  listNc,
  queryOf,
  resetTenants,
  transitionNc,
  stateOfBody,
  verdict,
  EXPECT_CELLS,
  type Consulta,
} from './common';

// US-NC-TABLERO-001 — Lista de no conformidades por la API. Preparación de cada fila: reinicio de alumno01 (y de alumno02 en la
// fila de aislamiento) con el token de su administrador; después, la cuenta de la fila inicia sesión en su tenant. Las peticiones
// de la lista llevan la cabecera x-tenant y el access token de la cuenta. El total de la lista sin filtros es 12 (totalAll).

/** Cabecera Authorization de la celda: sin cabecera, o el texto que se envía como token (un texto que no es un token). */
const AUTHORIZATION_CELLS: ReadonlyMap<string, string | undefined> = new Map<string, string | undefined>([
  ['(sin cabecera)', undefined],
  ['Bearer un texto que no es un token', 'un texto que no es un token'],
]);

const GESTOR = DEMO.gestor;
const ALUMNO02_ADMIN = adminCredentials(TENANT_B);

// --- Esquema 1: cada no conformidad del seed trae su programa, severidad, estado, responsable y comentarios --------------------

const itemRow: ApiRowHandler = async (row: ManifestRow) => {
  const code = strict('código', NC_CODE_CELLS, cell(row, 'codigo'));
  const program = strict('programa', PROGRAM_CELLS, cell(row, 'programa'));
  const severity = strict('severidad', SEVERITY_CELLS, cell(row, 'severidad'));
  const state = strict('estado', STATE_CELLS, cell(row, 'estado'));
  const responsible = strict('responsable', RESPONSIBLE_CELLS, cell(row, 'responsable'));
  const comments = strict('comentarios', NUMBER_CELLS, cell(row, 'comentarios'));
  const expected = `respuesta 200 y en items la no conformidad ${code} trae programCode ${program}, severity ${severity}, state ${state}, assigneeName ${cell(row, 'responsable')} y commentCount ${comments}`;

  await resetTenants([TENANT_A]);
  const gestor = await actorOf(TENANT_A, GESTOR);
  if (gestor.token === undefined) return preparationFailed(expected, 'gestor@sigpro.test inicia sesión y recibe accessToken', gestor.last);

  const listed = await listNc(TENANT_A, gestor.token);
  const item = itemsOf(listed.body).find((entry) => field(entry, 'code') === code);
  const valueOf = (key: string): string => {
    if (item === undefined) return `(${code} no está en items)`;
    const value = field(item, key);
    return value === null || value === undefined ? '(ninguno)' : String(value);
  };
  return verdict([
    check(listed.status === 200, 'respuesta 200', `respuesta ${listed.status}`),
    check(item !== undefined, `${code} en items`, item === undefined ? `${code} no está en items` : `${code} en items`),
    check(valueOf('programCode') === program, `programCode ${program}`, `programCode ${valueOf('programCode')}`),
    check(valueOf('severity') === severity, `severity ${severity}`, `severity ${valueOf('severity')}`),
    check(valueOf('state') === state, `state ${state}`, `state ${valueOf('state')}`),
    check(valueOf('assigneeName') === (responsible ?? '(ninguno)'), `assigneeName ${responsible ?? '(ninguno)'}`, `assigneeName ${valueOf('assigneeName')}`),
    check(valueOf('commentCount') === String(comments), `commentCount ${comments}`, `commentCount ${valueOf('commentCount')}`),
  ]);
};

// --- Esquemas 2 y 3: la lista sin filtros o con un filtro, por código, y los totales -------------------------------------------

/** Lista con la consulta de la celda: los códigos (en el orden que dice la historia), `total` y `totalAll` 12. */
const listingRow: ApiRowHandler = async (row: ManifestRow) => {
  const consulta = strict<Consulta>('consulta', CONSULTA_CELLS, cell(row, 'consulta'));
  const list = strict('códigos', LIST_CELLS, cell(row, 'codigos'));
  const total = strict('total', NUMBER_CELLS, cell(row, 'total'));

  await resetTenants([TENANT_A]);
  const gestor = await actorOf(TENANT_A, GESTOR);
  if (gestor.token === undefined) return preparationFailed(`respuesta 200 con items ${cell(row, 'codigos')}, total ${total} y totalAll 12`, 'gestor@sigpro.test inicia sesión y recibe accessToken', gestor.last);

  const listed = await listNc(TENANT_A, gestor.token, queryOf(consulta.pairs));
  const names = itemsOf(listed.body).map((item) => String(field(item, 'assigneeName') ?? '(ninguno)'));
  const checks: Check[] = [
    check(listed.status === 200, 'respuesta 200', `respuesta ${listed.status}`),
    codesCheck(codesOfItems(listed.body), list, 'items'),
    check(field(listed.body, 'total') === total, `total ${total}`, `total ${String(field(listed.body, 'total'))}`),
    check(field(listed.body, 'totalAll') === 12, 'totalAll 12', `totalAll ${String(field(listed.body, 'totalAll'))}`),
  ];
  if (consulta.person !== undefined) {
    const person = consulta.person;
    checks.push(check(names.every((name) => name === person), `responsable de cada item ${person}`, `responsables ${names.length === 0 ? '(ninguno)' : names.join(', ')}`));
  }
  return verdict(checks, consulta.person === undefined ? undefined : 'La celda «u4 (Andrés Molina)» se envía como assignee=u4; el nombre entre paréntesis se compara con assigneeName.');
};

// --- Esquema 4: sin un token válido no hay lista -------------------------------------------------------------------------------

const withoutValidToken: ApiRowHandler = async (row: ManifestRow) => {
  const token = strict('cabecera Authorization', AUTHORIZATION_CELLS, cell(row, 'cabecera_autorizacion'));
  const expect = strict('respuesta', EXPECT_CELLS, cell(row, 'respuesta'));
  await resetTenants([TENANT_A]);
  const result = await listNc(TENANT_A, token);
  return verdict(answerChecks(expect, result));
};

// --- Esquema 5: cada petición ve el tenant de SU token, no el de la cabecera x-tenant ----------------------------------------

const tokenTenantWins: ApiRowHandler = async (row: ManifestRow) => {
  const credentials = strict('cuenta', ACCOUNT_CELLS, cell(row, 'cuenta'));
  const accountTenant = strict('tenant de la cuenta', TENANT_OF_ACCOUNT, cell(row, 'cuenta'));
  const header = strict('cabecera x-tenant', TENANT_CELLS, cell(row, 'cabecera'));
  const state = strict('estado', STATE_CELLS, cell(row, 'estado'));
  const expected = `en items, NC-001 trae state ${state} (el tenant del token, ${accountTenant}, gana a la cabecera x-tenant ${header})`;

  // Preparación: alumno02 pasa NC-001 a in_analysis con su propio administrador (la historia lo da por hecho)
  await resetTenants([TENANT_A, TENANT_B]);
  const owner = await actorOf(TENANT_B, ALUMNO02_ADMIN);
  if (owner.token === undefined) return preparationFailed(expected, 'alumno02@sigpro.lab inicia sesión en alumno02', owner.last);
  const moved = await transitionNc(TENANT_B, owner.token, 'NC-001', { to: 'in_analysis' });
  if (moved.status !== 200 || stateOfBody(moved) !== 'in_analysis') {
    return preparationFailed(expected, 'NC-001 pasa a in_analysis en alumno02 con POST /api/nc/NC-001/transition', moved);
  }
  const actor = await actorOf(accountTenant, credentials);
  if (actor.token === undefined) return preparationFailed(expected, `${cell(row, 'cuenta')} inicia sesión en su tenant y recibe accessToken`, actor.last);

  const listed = await listNc(header, actor.token);
  const item = itemsOf(listed.body).find((entry) => field(entry, 'code') === 'NC-001');
  const observed = item === undefined ? '(NC-001 no está en items)' : String(field(item, 'state'));
  return verdict([
    check(listed.status === 200, 'respuesta 200', `respuesta ${listed.status}`),
    check(item !== undefined && field(item, 'state') === state, `NC-001 trae state ${state}`, `NC-001 trae state ${observed}`),
  ]);
};

defineApiRows({
  story: 'US-NC-TABLERO-001',
  surface: 'api',
  tenants: [TENANT_A, TENANT_B],
  handlers: new Map<number, ApiRowHandler>([
    [1, itemRow],
    [2, listingRow],
    [3, listingRow],
    [4, withoutValidToken],
    [5, tokenTenantWins],
  ]),
});

