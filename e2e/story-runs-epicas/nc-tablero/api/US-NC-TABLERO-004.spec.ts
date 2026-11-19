import { adminCredentials } from '../../../story-runs/support/api';
import { defineApiRows, type ApiRowHandler, type ManifestRow } from '../../core/framework';
import { cell, check, preparationFailed, strict, type Check } from '../../support/checks';
import { ACCOUNT_CELLS, EXPECT_CELLS, STATE_CELLS, TENANT_A, TENANT_OF_ACCOUNT, actorOf, answerChecks, detailNc, resetTenants, stateOfBody, transitionNc, verdict } from './common';

// US-NC-TABLERO-004 — Permiso `nc.transition` por la API. Preparación de cada fila: reinicio de alumno01 con el token de su
// administrador y, después, la cuenta de la fila inicia sesión en alumno01. El estado se lee con alumno01@sigpro.lab (admin), que
// no cambia la lectura: la lectura no depende del rol que hizo el paso.

const ADMIN_ALUMNO01 = adminCredentials(TENANT_A);

/** Lectura del estado de NC-001 con el administrador del tenant (la lectura no depende del rol que hizo el paso). */
const readNc001 = async (token: string): Promise<string | undefined> => stateOfBody(await detailNc(TENANT_A, token, 'NC-001'));

// --- Esquema 1: solo los roles con nc.transition dan un paso admitido ----------------------------------------------------------

const onlyTransitionRoles: ApiRowHandler = async (row: ManifestRow) => {
  const credentials = strict('cuenta', ACCOUNT_CELLS, cell(row, 'cuenta'));
  const tenant = strict('tenant de la cuenta', TENANT_OF_ACCOUNT, cell(row, 'cuenta'));
  const expect = strict('respuesta', EXPECT_CELLS, cell(row, 'respuesta'));
  const state = strict('estado', STATE_CELLS, cell(row, 'estado'));
  const expected = `respuesta ${cell(row, 'respuesta')}; GET NC-001 devuelve state ${state}`;

  await resetTenants([TENANT_A]);
  const admin = await actorOf(TENANT_A, ADMIN_ALUMNO01);
  if (admin.token === undefined) return preparationFailed(expected, 'alumno01@sigpro.lab inicia sesión y recibe accessToken', admin.last);
  const initial = await readNc001(admin.token);
  if (initial !== 'open') return preparationFailed(expected, `NC-001 está en open (la lectura da ${initial ?? '(sin state)'})`, await detailNc(TENANT_A, admin.token, 'NC-001'));

  const actor = await actorOf(tenant, credentials);
  if (actor.token === undefined) return preparationFailed(expected, `${cell(row, 'cuenta')} inicia sesión y recibe accessToken`, actor.last);

  const acted = await transitionNc(TENANT_A, actor.token, 'NC-001', { to: 'in_analysis' });
  const after = await readNc001(admin.token);
  const checks: Check[] = [...answerChecks(expect, acted), check(after === state, `GET NC-001 devuelve state ${state}`, `GET NC-001 devuelve state ${after ?? '(sin state)'}`)];
  return verdict(checks);
};

// --- Esquema 2: el rol se comprueba antes que la máquina de estados --------------------------------------------------------

const roleBeforeMachine: ApiRowHandler = async (row: ManifestRow) => {
  const credentials = strict('cuenta', ACCOUNT_CELLS, cell(row, 'cuenta'));
  const tenant = strict('tenant de la cuenta', TENANT_OF_ACCOUNT, cell(row, 'cuenta'));
  const expect = strict('respuesta', EXPECT_CELLS, cell(row, 'respuesta'));
  const expected = `respuesta ${cell(row, 'respuesta')}; GET NC-001 devuelve state open`;

  await resetTenants([TENANT_A]);
  const admin = await actorOf(TENANT_A, ADMIN_ALUMNO01);
  if (admin.token === undefined) return preparationFailed(expected, 'alumno01@sigpro.lab inicia sesión y recibe accessToken', admin.last);
  const initial = await readNc001(admin.token);
  if (initial !== 'open') return preparationFailed(expected, `NC-001 está en open (la lectura da ${initial ?? '(sin state)'})`, await detailNc(TENANT_A, admin.token, 'NC-001'));

  const actor = await actorOf(tenant, credentials);
  if (actor.token === undefined) return preparationFailed(expected, `${cell(row, 'cuenta')} inicia sesión y recibe accessToken`, actor.last);

  // Paso a «rejected» SIN comentario: desde «open» la máquina no lo admite; el rol debe decidir antes (403) que la máquina (409)
  const acted = await transitionNc(TENANT_A, actor.token, 'NC-001', { to: 'rejected' });
  const after = await readNc001(admin.token);
  return verdict([...answerChecks(expect, acted), check(after === 'open', 'GET NC-001 devuelve state open', `GET NC-001 devuelve state ${after ?? '(sin state)'}`)]);
};

defineApiRows({
  story: 'US-NC-TABLERO-004',
  surface: 'api',
  tenants: [TENANT_A],
  handlers: new Map<number, ApiRowHandler>([
    [1, onlyTransitionRoles],
    [2, roleBeforeMachine],
  ]),
});
