import { cell, conclude, preparationFailed, responseCheck, type Check } from '../../support/checks';
import { defineApiRows, type ApiRowHandler } from '../../core/framework';
import type { ApiResult } from '../../../story-runs/support/api';
import { codesCheck, codesIn, codesOf, emptyPagingChecks, listPrograms, numberCheck, resetTenants, sessionFor, TENANT_A } from './common';

// US-PROG-LISTA-002 — Filtrar la lista por estado, fechas, responsable y texto (API). Preparación de cada fila: reinicio de alumno01
// con el token de su administrador y, después, inicio de sesión de gestor@sigpro.test en alumno01 (su accessToken). Todas las
// peticiones llevan x-tenant: alumno01.

/**
 * Comprobaciones de un listado filtrado: 200, total y, si la historia lo dice, los códigos. Sin coincidencias, además `items` vacío
 * y paginación 1 de 1 (la regla de la historia).
 */
const filtered = (result: ApiResult, total: number, codes?: readonly string[]): readonly Check[] => {
  const checks: Check[] = [responseCheck(result, { status: 200 }), numberCheck(result, 'total', total)];
  if (codes !== undefined) checks.push(codesCheck(codesIn(result), codes));
  if (total === 0) checks.push(codesCheck(codesIn(result), []), ...emptyPagingChecks(result));
  return checks;
};

// --- Esquema 1: el filtro de estado devuelve solo los programas de ese estado ---------------------------------------------------

const byStatus: ApiRowHandler = async (row) => {
  await resetTenants([TENANT_A]);
  const expected = `respuesta 200 con total ${cell(row, 'total')} y los programas ${cell(row, 'codigos')}`;
  const session = await sessionFor('gestor');
  if (session.token === undefined) return preparationFailed(expected, 'gestor@sigpro.test inicia sesión y recibe accessToken', session.last);
  const result = await listPrograms(`status=${cell(row, 'estado')}&pageSize=20`, session.token);
  return conclude(filtered(result, Number(cell(row, 'total')), codesOf(cell(row, 'codigos'))));
};

// --- Esquema 2: «Inicio desde» incluye el día indicado y mira solo la fecha de inicio ------------------------------------------

const fromDate: ApiRowHandler = async (row) => {
  await resetTenants([TENANT_A]);
  const expected = `respuesta 200 con total ${cell(row, 'total')}`;
  const session = await sessionFor('gestor');
  if (session.token === undefined) return preparationFailed(expected, 'gestor@sigpro.test inicia sesión y recibe accessToken', session.last);
  const result = await listPrograms(`q=${cell(row, 'texto')}&from=${cell(row, 'desde')}`, session.token);
  return conclude(filtered(result, Number(cell(row, 'total'))));
};

// --- Esquema 3: «Fin hasta» incluye el día indicado y mira solo la fecha de fin -----------------------------------------------

const toDate: ApiRowHandler = async (row) => {
  await resetTenants([TENANT_A]);
  const expected = `respuesta 200 con total ${cell(row, 'total')}`;
  const session = await sessionFor('gestor');
  if (session.token === undefined) return preparationFailed(expected, 'gestor@sigpro.test inicia sesión y recibe accessToken', session.last);
  const result = await listPrograms(`q=PRG-001&to=${cell(row, 'hasta')}`, session.token);
  return conclude(filtered(result, Number(cell(row, 'total'))));
};

// --- Esquema 4: el filtro de responsable devuelve los programas de esa persona -----------------------------------------------

const byOwner: ApiRowHandler = async (row) => {
  await resetTenants([TENANT_A]);
  const expected = `respuesta 200 con total ${cell(row, 'total')} y los programas ${cell(row, 'codigos')}`;
  const session = await sessionFor('gestor');
  if (session.token === undefined) return preparationFailed(expected, 'gestor@sigpro.test inicia sesión y recibe accessToken', session.last);
  const result = await listPrograms(`owner=${cell(row, 'responsable')}`, session.token);
  return conclude(filtered(result, Number(cell(row, 'total')), codesOf(cell(row, 'codigos'))));
};

// --- Esquema 5: la búsqueda compara código y nombre sin distinguir mayúsculas -------------------------------------------------

const search: ApiRowHandler = async (row) => {
  await resetTenants([TENANT_A]);
  const expected = `respuesta 200 con total ${cell(row, 'total')} y los programas ${cell(row, 'codigos')}`;
  const session = await sessionFor('gestor');
  if (session.token === undefined) return preparationFailed(expected, 'gestor@sigpro.test inicia sesión y recibe accessToken', session.last);
  const result = await listPrograms(`q=${cell(row, 'texto')}`, session.token);
  return conclude(filtered(result, Number(cell(row, 'total')), codesOf(cell(row, 'codigos'))));
};

// --- Esquema 6: un valor no válido se descarta sin error ----------------------------------------------------------------------

const invalidValue: ApiRowHandler = async (row) => {
  await resetTenants([TENANT_A]);
  const expected = 'respuesta 200 con total 24';
  const session = await sessionFor('gestor');
  if (session.token === undefined) return preparationFailed(expected, 'gestor@sigpro.test inicia sesión y recibe accessToken', session.last);
  const result = await listPrograms(cell(row, 'parametro'), session.token);
  return conclude(filtered(result, 24));
};

// --- Esquema 7: los filtros se combinan entre sí --------------------------------------------------------------------------------

const combined: ApiRowHandler = async (row) => {
  await resetTenants([TENANT_A]);
  const expected = `respuesta 200 con total ${cell(row, 'total')} y los programas ${cell(row, 'codigos')}`;
  const session = await sessionFor('gestor');
  if (session.token === undefined) return preparationFailed(expected, 'gestor@sigpro.test inicia sesión y recibe accessToken', session.last);
  const result = await listPrograms(`status=${cell(row, 'estado')}&owner=${cell(row, 'responsable')}`, session.token);
  return conclude(filtered(result, Number(cell(row, 'total')), codesOf(cell(row, 'codigos'))));
};

defineApiRows({
  story: 'US-PROG-LISTA-002',
  surface: 'api',
  tenants: [TENANT_A],
  handlers: new Map<number, ApiRowHandler>([
    [1, byStatus],
    [2, fromDate],
    [3, toDate],
    [4, byOwner],
    [5, search],
    [6, invalidValue],
    [7, combined],
  ]),
});
