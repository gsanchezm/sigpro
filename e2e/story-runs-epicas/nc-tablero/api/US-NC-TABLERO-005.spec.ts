import { adminCredentials } from '../../../story-runs/support/api';
import { defineApiRows, type ApiRowHandler, type ManifestRow } from '../../core/framework';
import { cell, check, preparationFailed, strict, type Check } from '../../support/checks';
import { EXPECT_CELLS, NC_CODE_CELLS, TENANT_A, TO_CELLS, actorOf, answerChecks, detailNc, resetTenants, stateOfBody, transitionNc, verdict } from './common';

// US-NC-TABLERO-005 — Errores de la petición de paso por la API. Preparación de cada fila: reinicio de alumno01 con el token de su
// administrador; después, alumno01@sigpro.lab (admin, sin segundo factor) inicia sesión en alumno01 y usa su accessToken.
// En la celda «(vacío)» el valor de `to` se envía como cadena vacía (`to: ''`): es la lectura que se declara en el informe.

const ADMIN_ALUMNO01 = adminCredentials(TENANT_A);

/** Longitudes del comentario que nombran las celdas (la frontera de 1000). */
const LENGTH_CELLS: ReadonlyMap<string, number> = new Map<string, number>([
  ['999', 999],
  ['1000', 1000],
  ['1001', 1001],
]);

/** Cuerpo de la fila: `to` (la cadena de la celda) y, si se da, un `comment` de esa longitud. */
const bodyWith = (to: string, comment?: string): Record<string, string> => (comment === undefined ? { to } : { to, comment });

// --- Esquema 1: un estado desconocido o vacío se rechaza con 422 y no cambia la no conformidad ----------------------------

const unknownState: ApiRowHandler = async (row: ManifestRow) => {
  const to = strict('destino', TO_CELLS, cell(row, 'destino'));
  const expected = `respuesta 422 validation_failed con motivo badState para to; GET NC-001 devuelve state open`;

  await resetTenants([TENANT_A]);
  const admin = await actorOf(TENANT_A, ADMIN_ALUMNO01);
  if (admin.token === undefined) return preparationFailed(expected, 'alumno01@sigpro.lab inicia sesión y recibe accessToken', admin.last);
  const initial = await detailNc(TENANT_A, admin.token, 'NC-001');
  if (stateOfBody(initial) !== 'open') return preparationFailed(expected, `NC-001 está en open (la lectura da ${stateOfBody(initial) ?? '(sin state)'})`, initial);

  const acted = await transitionNc(TENANT_A, admin.token, 'NC-001', bodyWith(to));
  const after = await detailNc(TENANT_A, admin.token, 'NC-001');
  const checks: Check[] = [
    ...answerChecks({ status: 422, code: 'validation_failed', errorField: 'to', errorKey: 'badState' }, acted),
    check(stateOfBody(after) === 'open', 'GET NC-001 devuelve state open', `GET NC-001 devuelve state ${stateOfBody(after) ?? '(sin state)'}`),
  ];
  return verdict(checks, to === '' ? 'La celda «(vacío)» se envía como to: \'\' (cadena vacía).' : undefined);
};

// --- Esquema 2: el comentario admite hasta 1000 caracteres -----------------------------------------------------------------

const commentLength: ApiRowHandler = async (row: ManifestRow) => {
  const length = strict('longitud', LENGTH_CELLS, cell(row, 'longitud'));
  const expect = strict('respuesta', EXPECT_CELLS, cell(row, 'respuesta'));
  const expected = `respuesta ${cell(row, 'respuesta')} para un comment de ${length} caracteres`;

  await resetTenants([TENANT_A]);
  const admin = await actorOf(TENANT_A, ADMIN_ALUMNO01);
  if (admin.token === undefined) return preparationFailed(expected, 'alumno01@sigpro.lab inicia sesión y recibe accessToken', admin.last);
  const initial = await detailNc(TENANT_A, admin.token, 'NC-001');
  if (stateOfBody(initial) !== 'open') return preparationFailed(expected, `NC-001 está en open (la lectura da ${stateOfBody(initial) ?? '(sin state)'})`, initial);

  const acted = await transitionNc(TENANT_A, admin.token, 'NC-001', bodyWith('in_analysis', 'a'.repeat(length)));
  return verdict(answerChecks(expect, acted), 'La tabla de la historia prueba el límite de 1000 solo con el paso a in_analysis; no se repite con otros pasos.');
};

// --- Esquema 3: un código que no existe en el tenant responde 404 ----------------------------------------------------------

const unknownCode: ApiRowHandler = async (row: ManifestRow) => {
  const code = strict('código', NC_CODE_CELLS, cell(row, 'codigo'));
  const expected = `respuesta 404 nc_not_found para POST /api/nc/${code}/transition`;

  await resetTenants([TENANT_A]);
  const admin = await actorOf(TENANT_A, ADMIN_ALUMNO01);
  if (admin.token === undefined) return preparationFailed(expected, 'alumno01@sigpro.lab inicia sesión y recibe accessToken', admin.last);

  const acted = await transitionNc(TENANT_A, admin.token, code, { to: 'in_analysis' });
  return verdict(answerChecks({ status: 404, code: 'nc_not_found' }, acted));
};

defineApiRows({
  story: 'US-NC-TABLERO-005',
  surface: 'api',
  tenants: [TENANT_A],
  handlers: new Map<number, ApiRowHandler>([
    [1, unknownState],
    [2, commentLength],
    [3, unknownCode],
  ]),
});
