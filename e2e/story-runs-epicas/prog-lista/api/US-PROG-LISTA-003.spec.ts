import { cell, conclude, preparationFailed, responseCheck, type Check } from '../../support/checks';
import { defineApiRows, type ApiRowHandler } from '../../core/framework';
import { codesCheck, codesIn, codesOf, listPrograms, resetTenants, sessionFor, TENANT_A } from './common';

// US-PROG-LISTA-003 — Ordenar la lista por columna y mantener el orden entre páginas (API). Preparación de cada fila: reinicio de
// alumno01 con el token de su administrador y, después, inicio de sesión de gestor@sigpro.test en alumno01 (su accessToken).
// Todas las peticiones llevan x-tenant: alumno01. Los códigos se comparan en orden: el orden es lo que la historia afirma.

const ok = (codes: readonly string[], expected: readonly string[]): Check => codesCheck(codes, expected);

// --- Esquema 1: ordenar por presupuesto descendente se mantiene en cada página ------------------------------------------------

const budgetDesc: ApiRowHandler = async (row) => {
  await resetTenants([TENANT_A]);
  const expected = `respuesta 200 con los programas de la página ${cell(row, 'codigos')}`;
  const session = await sessionFor('gestor');
  if (session.token === undefined) return preparationFailed(expected, 'gestor@sigpro.test inicia sesión y recibe accessToken', session.last);
  const result = await listPrograms(`sort=budget&dir=desc&page=${cell(row, 'pagina')}`, session.token);
  return conclude([responseCheck(result, { status: 200 }), ok(codesIn(result), codesOf(cell(row, 'codigos')))]);
};

// --- Esquema 2: ordenar por código descendente se mantiene en las páginas siguientes -----------------------------------------

const codeDesc: ApiRowHandler = async (row) => {
  await resetTenants([TENANT_A]);
  const expected = `respuesta 200 con los programas de la página ${cell(row, 'codigos')}`;
  const session = await sessionFor('gestor');
  if (session.token === undefined) return preparationFailed(expected, 'gestor@sigpro.test inicia sesión y recibe accessToken', session.last);
  const result = await listPrograms(`sort=code&dir=desc&page=${cell(row, 'pagina')}`, session.token);
  return conclude([responseCheck(result, { status: 200 }), ok(codesIn(result), codesOf(cell(row, 'codigos')))]);
};

// --- Esquema 3: ordenar por fecha usa la fecha de inicio -----------------------------------------------------------------------

const datesAsc: ApiRowHandler = async (row) => {
  await resetTenants([TENANT_A]);
  const expected = `respuesta 200 con los programas de la página ${cell(row, 'codigos')}`;
  const session = await sessionFor('gestor');
  if (session.token === undefined) return preparationFailed(expected, 'gestor@sigpro.test inicia sesión y recibe accessToken', session.last);
  const result = await listPrograms(`sort=dates&dir=asc&page=${cell(row, 'pagina')}`, session.token);
  return conclude([responseCheck(result, { status: 200 }), ok(codesIn(result), codesOf(cell(row, 'codigos')))]);
};

// --- Esquema 4: ordenar por responsable en descendente agrupa por persona y desempata por código -------------------------

const ownerDesc: ApiRowHandler = async (row) => {
  await resetTenants([TENANT_A]);
  const expected = `respuesta 200 con los programas de la primera página ${cell(row, 'codigos')}`;
  const session = await sessionFor('gestor');
  if (session.token === undefined) return preparationFailed(expected, 'gestor@sigpro.test inicia sesión y recibe accessToken', session.last);
  const result = await listPrograms('sort=owner&dir=desc', session.token);
  return conclude([responseCheck(result, { status: 200 }), ok(codesIn(result), codesOf(cell(row, 'codigos')))]);
};

// --- Esquema 5: una columna o un sentido que no existen usan el orden por defecto ---------------------------------------------

const fallbackOrder: ApiRowHandler = async (row) => {
  await resetTenants([TENANT_A]);
  const expected = `respuesta 200 y los tres primeros programas son ${cell(row, 'primeros')}`;
  const session = await sessionFor('gestor');
  if (session.token === undefined) return preparationFailed(expected, 'gestor@sigpro.test inicia sesión y recibe accessToken', session.last);
  const result = await listPrograms(cell(row, 'consulta'), session.token);
  const firstThree = codesIn(result).slice(0, 3);
  return conclude([responseCheck(result, { status: 200 }), ok(firstThree, codesOf(cell(row, 'primeros')))]);
};

defineApiRows({
  story: 'US-PROG-LISTA-003',
  surface: 'api',
  tenants: [TENANT_A],
  handlers: new Map<number, ApiRowHandler>([
    [1, budgetDesc],
    [2, codeDesc],
    [3, datesAsc],
    [4, ownerDesc],
    [5, fallbackOrder],
  ]),
});
