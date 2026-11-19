import { call, field, type ApiResult } from '../../../story-runs/support/api';
import { cell, check, conclude, preparationFailed, responseCheck, strict } from '../../support/checks';
import { defineApiRows, type ApiRowHandler } from '../../core/framework';
import { credentialsOf, resetTenants, sessionFor, TENANT_A } from './common';

// US-PROG-ALTA-006 — Listar las personas que pueden ser responsables (API). Preparación de cada fila: reinicio de alumno01 y la cuenta
// de la fila inicia sesión. La lista es la de todas las personas del tenant (también las bloqueadas, pendientes o desactivadas).

const GESTOR = 'gestor@sigpro.test';
const PERSON_KEYS: readonly string[] = ['id', 'name', 'email', 'role', 'programCount'];

/** `GET /api/users/owners` del tenant con el token dado (o sin cabecera Authorization). */
const owners = (token: string | undefined): Promise<ApiResult> => call('GET', '/users/owners', { tenant: TENANT_A, ...(token === undefined ? {} : { token }) });

/** Personas de la respuesta (vacío si la respuesta no es una lista). */
const personsOf = (result: ApiResult): readonly unknown[] => (Array.isArray(result.body) ? result.body : []);

// --- Esquema 1: cualquier rol con sesión recibe la lista de personas del tenant -----------------------------------------------

const everyRoleSeesList: ApiRowHandler = async (row) => {
  const expected = 'respuesta 200 con siete personas, cada una con id, name, email, role y programCount';
  await resetTenants([TENANT_A]);
  const session = await sessionFor(credentialsOf(cell(row, 'cuenta')));
  if (session.token === undefined) return preparationFailed(expected, `${cell(row, 'cuenta')} inicia sesión y recibe accessToken`, session.last);
  const result = await owners(session.token);
  const persons = personsOf(result);
  return conclude([
    responseCheck(result, { status: 200 }),
    check(persons.length === 7, 'siete personas', `${persons.length} personas`),
    check(
      persons.every((person) => PERSON_KEYS.every((key) => field(person, key) !== undefined)),
      'cada persona con id, name, email, role y programCount',
      persons.every((person) => PERSON_KEYS.every((key) => field(person, key) !== undefined)) ? 'cada persona con id, name, email, role y programCount' : 'alguna persona sin todos los campos',
    ),
    check(
      persons.every((person) => typeof field(person, 'programCount') === 'number'),
      'programCount numérico en cada persona',
      persons.every((person) => typeof field(person, 'programCount') === 'number') ? 'programCount numérico en cada persona' : 'alguna persona sin programCount numérico',
    ),
  ]);
};

// --- Esquema 2: cada persona lleva el número de programas a su cargo -------------------------------------------------------------

const programCountRow: ApiRowHandler = async (row) => {
  const expected = `la persona ${cell(row, 'persona')} tiene programCount ${cell(row, 'programas')}`;
  await resetTenants([TENANT_A]);
  const session = await sessionFor(credentialsOf(GESTOR));
  if (session.token === undefined) return preparationFailed(expected, `${GESTOR} inicia sesión y recibe accessToken`, session.last);
  const persona = cell(row, 'persona');
  const expectedCount = Number(cell(row, 'programas'));
  const result = await owners(session.token);
  // Una sola persona con ese nombre: si hay dos, la lectura es ambigua y no se da por cumplida
  const matches = personsOf(result).filter((person) => field(person, 'name') === persona);
  const count = matches.length === 1 ? field(matches[0], 'programCount') : undefined;
  return conclude([
    responseCheck(result, { status: 200 }),
    check(matches.length === 1 && count === expectedCount, `${persona} tiene programCount ${expectedCount}`, matches.length === 1 ? `${persona} tiene programCount ${String(count)}` : `${matches.length} personas llamadas ${persona}`),
  ]);
};

// --- Esquema 3: sin token no hay lista de responsables -----------------------------------------------------------------------

/** Credencial de la tabla: «(sin cabecera)» no envía Authorization; el texto se envía como token. */
const CREDENTIAL: ReadonlyMap<string, string | undefined> = new Map<string, string | undefined>([
  ['(sin cabecera)', undefined],
  ['un texto que no es un token', 'un texto que no es un token'],
]);

const ANSWERS: ReadonlyMap<string, { readonly status: number; readonly code: string }> = new Map([
  ['401 missing_token', { status: 401, code: 'missing_token' }],
  ['401 invalid_token', { status: 401, code: 'invalid_token' }],
]);

const noTokenRow: ApiRowHandler = async (row) => {
  const expected = `respuesta ${cell(row, 'respuesta')}`;
  await resetTenants([TENANT_A]);
  const session = await sessionFor(credentialsOf(GESTOR));
  if (session.token === undefined) return preparationFailed(expected, `${GESTOR} inicia sesión y recibe accessToken`, session.last);
  const token = strict('credencial', CREDENTIAL, cell(row, 'credencial'));
  const answer = strict('respuesta', ANSWERS, cell(row, 'respuesta'));
  return conclude([responseCheck(await owners(token), answer)]);
};

defineApiRows({
  story: 'US-PROG-ALTA-006',
  surface: 'api',
  tenants: [TENANT_A],
  handlers: new Map<number, ApiRowHandler>([
    [1, everyRoleSeesList],
    [2, programCountRow],
    [3, noTokenRow],
  ]),
});
