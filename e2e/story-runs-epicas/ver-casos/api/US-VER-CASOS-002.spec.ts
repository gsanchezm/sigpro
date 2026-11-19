import { cell, check, preparationFailed, responseCheck, type Check } from '../../support/checks';
import { defineApiRows, type ApiRowHandler } from '../../core/framework';
import { field, type ApiResult } from '../../../story-runs/support/api';
import { codesCheck, codesIn, codesOf, itemsOf, listCases, numberCheck, queryOfRequest, resetTenants, sessionFor, TENANT_A, concluded } from './common';

// US-VER-CASOS-002 — Filtrar y ordenar la lista de casos de prueba (API). Preparación de cada fila: reinicio de alumno01 con el
// token de su administrador y, después, gestor@sigpro.test inicia sesión en alumno01 (`x-tenant: alumno01`).

/**
 * Query de la celda de filtro u orden («program=PRG-003», «sort=program&dir=desc»): pares clave=valor sin espacios. Cualquier otra
 * forma LANZA (una celda nueva no se ignora). Los valores no válidos sí se envían: la prueba es que la API los ignore.
 */
const filterQuery = (text: string): string => {
  if (!/^[a-z]+=[A-Za-z0-9-]+(&[a-z]+=[A-Za-z0-9-]+)*$/.test(text)) throw new Error(`celda sin interpretación: filtro «${text}»`);
  return text;
};

/** Nota de paginación: el ejemplo lista más códigos de los que cabe en una página, y la respuesta lo deja ver en el observado. */
const pagingNote = (result: ApiResult, expectedCount: number): { readonly note?: string } => {
  const pageSize = Number(field(result.body, 'pageSize'));
  const total = Number(field(result.body, 'total'));
  const shown = itemsOf(result).length;
  if (expectedCount <= shown || total < expectedCount) return {};
  return {
    note: `El ejemplo lista ${expectedCount} códigos en la respuesta de una sola petición, pero la respuesta pagina de ${pageSize}: trae ${shown} de ${total} casos (la Regla de paginación de 10 y el ejemplo se contradicen; el manejador sigue el ejemplo y lo anota).`,
  };
};

// --- Esquema 1: el texto busca en el código y en el título sin distinguir mayúsculas ------------------------------------

const textSearch: ApiRowHandler = async (row) => {
  await resetTenants([TENANT_A]);
  const expected = `respuesta 200 con total ${cell(row, 'total')} y los casos ${cell(row, 'codigos')}`;
  const session = await sessionFor('gestor');
  if (session.token === undefined) return preparationFailed(expected, 'gestor@sigpro.test inicia sesión y recibe accessToken', session.last);
  const result = await listCases(`q=${encodeURIComponent(cell(row, 'texto'))}`, session.token);
  return concluded([responseCheck(result, { status: 200 }), numberCheck(result.body, 'total', Number(cell(row, 'total'))), codesCheck(codesIn(result), codesOf(cell(row, 'codigos')))]);
};

// --- Esquema 2: el programa y el último resultado filtran la lista y se combinan ----------------------------------------

const combinedFilters: ApiRowHandler = async (row) => {
  await resetTenants([TENANT_A]);
  const expectedCodes = codesOf(cell(row, 'codigos'));
  const expected = `respuesta 200 con total ${cell(row, 'total')}, totalRuns ${cell(row, 'ejecuciones')} y los casos ${cell(row, 'codigos')}`;
  const session = await sessionFor('gestor');
  if (session.token === undefined) return preparationFailed(expected, 'gestor@sigpro.test inicia sesión y recibe accessToken', session.last);
  const result = await listCases(filterQuery(cell(row, 'filtro')), session.token);
  const checks: Check[] = [
    responseCheck(result, { status: 200 }),
    numberCheck(result.body, 'total', Number(cell(row, 'total'))),
    numberCheck(result.body, 'totalRuns', Number(cell(row, 'ejecuciones'))),
    codesCheck(codesIn(result), expectedCodes),
  ];
  return concluded(checks, pagingNote(result, expectedCodes.length));
};

// --- Esquema 3: un valor no válido en el filtro o en el orden se ignora --------------------------------------------------

const invalidValue: ApiRowHandler = async (row) => {
  await resetTenants([TENANT_A]);
  const expected = `respuesta 200 con total 25 y el primer caso ${cell(row, 'primero')}`;
  const session = await sessionFor('gestor');
  if (session.token === undefined) return preparationFailed(expected, 'gestor@sigpro.test inicia sesión y recibe accessToken', session.last);
  const result = await listCases(filterQuery(cell(row, 'parametro')), session.token);
  const first = codesIn(result)[0];
  return concluded([
    responseCheck(result, { status: 200 }),
    numberCheck(result.body, 'total', 25),
    check(first === cell(row, 'primero'), `el primer caso ${cell(row, 'primero')}`, `el primer caso ${first ?? '(ninguno)'}`),
  ]);
};

// --- Esquema 4: cada orden coloca sus primeros casos en el orden que le corresponde --------------------------------------

const sortOrder: ApiRowHandler = async (row) => {
  await resetTenants([TENANT_A]);
  const expectedCodes = codesOf(cell(row, 'codigos'));
  const expected = `los diez primeros casos ${cell(row, 'codigos')}`;
  const session = await sessionFor('gestor');
  if (session.token === undefined) return preparationFailed(expected, 'gestor@sigpro.test inicia sesión y recibe accessToken', session.last);
  const result = await listCases(filterQuery(cell(row, 'orden')), session.token);
  return concluded([responseCheck(result, { status: 200 }), codesCheck(codesIn(result), expectedCodes)]);
};

// --- Esquema 5: el orden se mantiene al pasar de página -------------------------------------------------------------------

const orderOnPageTwo: ApiRowHandler = async (row) => {
  await resetTenants([TENANT_A]);
  const expectedCodes = codesOf(cell(row, 'codigos'));
  const expected = `respuesta 200 con page 2 y los casos de la página ${cell(row, 'codigos')}`;
  const session = await sessionFor('gestor');
  if (session.token === undefined) return preparationFailed(expected, 'gestor@sigpro.test inicia sesión y recibe accessToken', session.last);
  const query = queryOfRequest(cell(row, 'peticion'));
  const result = await listCases(query, session.token);
  return concluded([responseCheck(result, { status: 200 }), numberCheck(result.body, 'page', 2), codesCheck(codesIn(result), expectedCodes)]);
};

defineApiRows({
  story: 'US-VER-CASOS-002',
  surface: 'api',
  tenants: [TENANT_A],
  handlers: new Map<number, ApiRowHandler>([
    [1, textSearch],
    [2, combinedFilters],
    [3, invalidValue],
    [4, sortOrder],
    [5, orderOnPageTwo],
  ]),
});
