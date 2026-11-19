import { call, field, type ApiResult } from '../../../story-runs/support/api';
import { resetTenants, TENANT_A } from '../../../story-runs/support/prepare';
import { defineApiRows, type ApiRowHandler, type ManifestRow, type Outcome } from '../../core/framework';
import { cell, check, preparationFailed, strict, type Check } from '../../support/checks';
import { docCodesOf, gestorIn, idsCheck, idsOf, itemsOf, queryOf, statusCheck, thenOf, finish } from './common';

// US-DOC-LISTA-002 — Filtros de la lista de documentos por la API: programa, clasificación y texto, que se combinan. Preparación:
// reinicio de alumno01 con su administrador y sesión de gestor@sigpro.test en alumno01; la petición lleva la cabecera x-tenant de
// alumno01 y el accessToken como Bearer.

/** Programa de la celda → valor del parámetro `program` (`(vacío)` es el parámetro sin valor). */
const PROGRAMA: ReadonlyMap<string, string> = new Map<string, string>([
  ['PRG-002', 'PRG-002'],
  ['PRG-024', 'PRG-024'],
  ['PRG-099', 'PRG-099'],
  ['(vacío)', ''],
]);

/** Clasificación de la celda → valor del parámetro `classification`. */
const CLASIFICACION: ReadonlyMap<string, string> = new Map<string, string>([
  ['restricted', 'restricted'],
  ['public', 'public'],
]);

/** Texto de la celda → valor del parámetro `q` (`(tres espacios)` son tres espacios reales, enviados como %20). */
const TEXTO: ReadonlyMap<string, string> = new Map<string, string>([
  ['plan', 'plan'],
  ['PLAN', 'PLAN'],
  ['doc-004', 'doc-004'],
  ['PRG-004', 'PRG-004'],
  ['(tres espacios)', '   '],
  ['Ártemis', 'Ártemis'],
  ['zzz-no-existe', 'zzz-no-existe'],
]);

/** Filtros combinados de la celda → pares de la consulta. */
const FILTROS: ReadonlyMap<string, readonly (readonly [string, string])[]> = new Map<string, readonly (readonly [string, string])[]>([
  ['program=PRG-002&classification=restricted', [['program', 'PRG-002'], ['classification', 'restricted']]],
  ['program=PRG-001&classification=restricted', [['program', 'PRG-001'], ['classification', 'restricted']]],
  ['program=PRG-002&q=técnica', [['program', 'PRG-002'], ['q', 'técnica']]],
]);

/** Número de documentos de la celda «cuantos» (entero). */
const cuantos = (row: ManifestRow): number => {
  const value = Number(cell(row, 'cuantos'));
  if (!Number.isInteger(value)) throw new Error(`celda sin interpretación: cuantos «${cell(row, 'cuantos')}»`);
  return value;
};

/** Preparación común: reinicio de alumno01 y sesión de gestor@sigpro.test. Devuelve el accessToken o el resultado de fallo. */
const gestorReady = async (row: ManifestRow): Promise<{ readonly token: string } | { readonly failed: Outcome }> => {
  await resetTenants([TENANT_A]);
  const gestor = await gestorIn(TENANT_A);
  if (gestor.token === undefined) return { failed: preparationFailed(thenOf(row), 'gestor@sigpro.test inicia sesión en alumno01', gestor.last) };
  return { token: gestor.token };
};

/** Pide la lista con esa consulta y el accessToken de gestor@sigpro.test en alumno01. */
const listWith = (token: string, query: string): Promise<ApiResult> => call('GET', '/documents', { tenant: TENANT_A, token, ...(query === '' ? {} : { query }) });

// --- Esquema 1: el filtro por programa acota la lista a los documentos de ese programa ---------------------------------------------

const byProgram: ApiRowHandler = async (row: ManifestRow): Promise<Outcome> => {
  const ready = await gestorReady(row);
  if ('failed' in ready) return ready.failed;
  const value = strict('programa', PROGRAMA, cell(row, 'programa'));
  const listed = await listWith(ready.token, queryOf([['program', value]]));
  const expectedCodes = docCodesOf(cell(row, 'codigos'));
  return finish([
    statusCheck(listed, 200),
    check(itemsOf(listed.body).length === cuantos(row), `${cuantos(row)} documentos`, `${itemsOf(listed.body).length} documentos`),
    idsCheck(idsOf(listed.body), expectedCodes),
  ]);
};

// --- Esquema 2: el filtro por clasificación acota la lista a los documentos de esa clasificación ----------------------------------

const byClassification: ApiRowHandler = async (row: ManifestRow): Promise<Outcome> => {
  const ready = await gestorReady(row);
  if ('failed' in ready) return ready.failed;
  const value = strict('clasificación', CLASIFICACION, cell(row, 'clasificacion'));
  const listed = await listWith(ready.token, queryOf([['classification', value]]));
  const items = itemsOf(listed.body);
  const ids = idsOf(listed.body);
  return finish([
    statusCheck(listed, 200),
    check(items.length === cuantos(row), `${cuantos(row)} documentos`, `${items.length} documentos`),
    check(items.every((item) => field(item, 'classification') === value), `todos con la clasificación ${value}`, `clasificaciones ${items.map((item) => String(field(item, 'classification'))).join(', ') || '(ninguna)'}`),
    check(ids[0] === cell(row, 'primero') && ids[ids.length - 1] === cell(row, 'ultimo'), `el primero es ${cell(row, 'primero')} y el último es ${cell(row, 'ultimo')}`, `el primero es ${ids[0] ?? '(ninguno)'} y el último es ${ids[ids.length - 1] ?? '(ninguno)'}`),
  ]);
};

// --- Esquema 3: el texto busca en el código y en el título, sin distinguir mayúsculas ni espacios sobrantes ----------------------

const byText: ApiRowHandler = async (row: ManifestRow): Promise<Outcome> => {
  const ready = await gestorReady(row);
  if ('failed' in ready) return ready.failed;
  const value = strict('texto', TEXTO, cell(row, 'texto'));
  const listed = await listWith(ready.token, queryOf([['q', value]]));
  return finish([
    statusCheck(listed, 200),
    check(itemsOf(listed.body).length === cuantos(row), `${cuantos(row)} documentos`, `${itemsOf(listed.body).length} documentos`),
    idsCheck(idsOf(listed.body), docCodesOf(cell(row, 'codigos'))),
  ]);
};

// --- Esquema 4: los filtros se combinan: el documento debe cumplir todos los que se envían ----------------------------------------

const combined: ApiRowHandler = async (row: ManifestRow): Promise<Outcome> => {
  const ready = await gestorReady(row);
  if ('failed' in ready) return ready.failed;
  const pairs = strict('filtros', FILTROS, cell(row, 'filtros'));
  const listed = await listWith(ready.token, queryOf(pairs));
  const checks: Check[] = [
    statusCheck(listed, 200),
    check(itemsOf(listed.body).length === cuantos(row), `${cuantos(row)} documentos`, `${itemsOf(listed.body).length} documentos`),
    idsCheck(idsOf(listed.body), docCodesOf(cell(row, 'codigos'))),
  ];
  return finish(checks);
};

defineApiRows({
  story: 'US-DOC-LISTA-002',
  surface: 'api',
  tenants: [TENANT_A],
  handlers: new Map<number, ApiRowHandler>([
    [1, byProgram],
    [2, byClassification],
    [3, byText],
    [4, combined],
  ]),
});
