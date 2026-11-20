import type { ApiResult } from '../../../story-runs/support/api';
import { DEMO, TENANT_A, resetTenants, startSession } from '../../../story-runs/support/prepare';
import { cell, check, conclude, preparationFailed, strict, type Check } from '../../support/checks';
import { defineApiRows, type ApiRowHandler } from '../../core/framework';
import { ACCOUNTS, groupsCheck, groupsOf, searchAs, statusCheck, textField, type ExpectedGroup } from './common';

// US-NAVEGACION-001 — Búsqueda en el tenant y grupos por tipo. Preparación de cada fila: reinicio de alumno01 y acceso de la cuenta
// de la fila (POST /api/auth/login con x-tenant alumno01). Los datos son los del seed sin cambios.

const PROGRAMS = (ids: readonly string[], total = ids.length): ExpectedGroup => ({ kind: 'program', total, ids });
const DOCUMENTS = (ids: readonly string[], total = ids.length): ExpectedGroup => ({ kind: 'document', total, ids });

// Grupos que dice cada fila de la columna «grupos» (la historia manda; el seed se contrasta en el informe).
const GROUPS: ReadonlyMap<string, readonly ExpectedGroup[]> = new Map<string, readonly ExpectedGroup[]>([
  ['programa con total 1 (PRG-001) y documento con total 2 (DOC-001 y DOC-002)', [PROGRAMS(['PRG-001']), DOCUMENTS(['DOC-001', 'DOC-002'])]],
  ['programa con total 1 (PRG-003) y documento con total 1 (DOC-005)', [PROGRAMS(['PRG-003']), DOCUMENTS(['DOC-005'])]],
  ['programa con total 1 (PRG-003) y documento con total 2 (DOC-005 y DOC-006)', [PROGRAMS(['PRG-003']), DOCUMENTS(['DOC-005', 'DOC-006'])]],
  ['requisito con total 40 y 5 elementos (REQ-001 a REQ-005)', [{ kind: 'requirement', total: 40, ids: ['REQ-001', 'REQ-002', 'REQ-003', 'REQ-004', 'REQ-005'] }]],
  ['requisito con total 10 y 5 elementos (REQ-030 a REQ-034)', [{ kind: 'requirement', total: 10, ids: ['REQ-030', 'REQ-031', 'REQ-032', 'REQ-033', 'REQ-034'] }]],
  ['caso de prueba con total 25 y 5 elementos (TC-001 a TC-005)', [{ kind: 'testcase', total: 25, ids: ['TC-001', 'TC-002', 'TC-003', 'TC-004', 'TC-005'] }]],
  ['no conformidad con total 12 y 5 elementos (NC-001 a NC-005)', [{ kind: 'nc', total: 12, ids: ['NC-001', 'NC-002', 'NC-003', 'NC-004', 'NC-005'] }]],
  ['(ninguno)', []],
]);

// Tipos de la columna «tipo» de la segunda tabla, tal como los devuelve la API.
const KINDS: ReadonlyMap<string, string> = new Map<string, string>([
  ['program', 'program'],
  ['requirement', 'requirement'],
  ['testcase', 'testcase'],
  ['nc', 'nc'],
  ['document', 'document'],
]);

// --- Esquema 1: la búsqueda agrupa los resultados por tipo, en un orden fijo y con su total ---------------------------------

const groupsRow: ApiRowHandler = async (row) => {
  const account = strict('cuenta', ACCOUNTS, cell(row, 'cuenta'));
  const expected = cell(row, 'grupos');
  const wanted = strict('grupos', GROUPS, expected);
  await resetTenants([TENANT_A]);
  const started = await startSession(account.tenant, account.credentials);
  if (!started.session) return preparationFailed(expected, `${cell(row, 'cuenta')} inicia sesión`, started.result);
  const result = await searchAs(account.tenant, started.session.accessToken, cell(row, 'texto'));
  return conclude([statusCheck(result, 200, 'respuesta 200'), groupsCheck(result, wanted, expected)]);
};

// --- Esquema 2: cada resultado trae su título, su subtítulo y su enlace --------------------------------------------------

const itemRow: ApiRowHandler = async (row) => {
  const kind = strict('tipo', KINDS, cell(row, 'tipo'));
  const id = cell(row, 'id');
  const expected = `el elemento ${id} del grupo ${cell(row, 'tipo')} trae el título ${cell(row, 'titulo')}, el subtítulo ${cell(row, 'subtitulo')} y el enlace ${cell(row, 'href')}`;
  await resetTenants([TENANT_A]);
  const started = await startSession(TENANT_A, DEMO.gestor);
  if (!started.session) return preparationFailed(expected, 'gestor@sigpro.test inicia sesión', started.result);
  const result: ApiResult = await searchAs(TENANT_A, started.session.accessToken, cell(row, 'texto'));
  const group = groupsOf(result)?.find((candidate) => candidate.kind === kind);
  const item = group?.items.find((candidate) => textField(candidate, 'id') === id);
  const title = textField(item, 'title');
  const subtitle = textField(item, 'subtitle');
  const href = textField(item, 'href');
  const checks: Check[] = [
    statusCheck(result, 200, 'respuesta 200'),
    check(item !== undefined, `hay un elemento ${id} en el grupo ${cell(row, 'tipo')}`, item === undefined ? `no hay ${id} en el grupo ${cell(row, 'tipo')} (grupos: ${(groupsOf(result) ?? []).map((g) => g.kind).join(', ') || '(ninguno)'})` : `hay ${id}`),
    check(title === cell(row, 'titulo'), `título ${cell(row, 'titulo')}`, `título ${title ?? '(ausente)'}`),
    check(subtitle === cell(row, 'subtitulo'), `subtítulo ${cell(row, 'subtitulo')}`, `subtítulo ${subtitle ?? '(ausente)'}`),
    check(href === cell(row, 'href'), `enlace ${cell(row, 'href')}`, `enlace ${href ?? '(ausente)'}`),
  ];
  return conclude(checks, { evidence: { title, subtitle, href } });
};

defineApiRows({
  story: 'US-NAVEGACION-001',
  surface: 'api',
  tenants: [TENANT_A],
  handlers: new Map<number, ApiRowHandler>([
    [1, groupsRow],
    [2, itemRow],
  ]),
});
