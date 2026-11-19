import { cell, check, parseResponse, preparationFailed, responseCheck, strict, type Check } from '../../support/checks';
import { quoted } from '../../support/browser';
import { defineApiRows, type ApiRowHandler } from '../../core/framework';
import { field } from '../../../story-runs/support/api';
import { detailCase, isolatedState, joinedCodes, resetTenants, sessionFor, tenantAdminSession, TENANT_A, TENANT_B, textFieldCheck as textField, type SessionOf, concluded } from './common';

// US-VER-CASOS-003 — Consultar el detalle de un caso de prueba y su 404 (API). Preparación de cada fila: reinicio de alumno01 con
// el token de su administrador y, después, gestor@sigpro.test inicia sesión (`x-tenant: alumno01`). El Esquema de aislamiento
// reinicia también alumno02 y quita el enlace REQ-001 ↔ TC-001 en alumno01.

const STEPS = ['Preparar el entorno de pruebas', 'Ejecutar el escenario nominal', 'Registrar las mediciones'];
const EXPECTED = 'Los valores medidos cumplen el umbral definido en el requisito.';
const EXECUTED_BY = 'Lucía Fernández';

/** Celda de evidencias de la ejecución: ninguna, o una con su id, nombre y tipo. */
type EvidenceCell = { readonly kind: 'none' } | { readonly kind: 'one'; readonly id: string; readonly filename: string; readonly mimeType: string };

const EVIDENCE: ReadonlyMap<string, EvidenceCell> = new Map<string, EvidenceCell>([
  ['evidences vacío', { kind: 'none' }],
  ['una evidencia EV-001, de nombre TC-001-001.png y tipo image/png', { kind: 'one', id: 'EV-001', filename: 'TC-001-001.png', mimeType: 'image/png' }],
]);

const CREDENTIALS: ReadonlyMap<string, 'none' | 'text'> = new Map<string, 'none' | 'text'>([
  ['(sin cabecera Authorization)', 'none'],
  ['(un texto que no es un token)', 'text'],
]);

const TENANT_OF: ReadonlyMap<string, string> = new Map<string, string>([
  ['alumno01', TENANT_A],
  ['alumno02', TENANT_B],
]);

const ACCOUNT_OF: ReadonlyMap<string, 'gestor' | 'tenantAdmin'> = new Map<string, 'gestor' | 'tenantAdmin'>([
  ['gestor@sigpro.test', 'gestor'],
  ['alumno02@sigpro.lab', 'tenantAdmin'],
]);

const sessionOrSkip = (session: SessionOf, expected: string, step: string): ReturnType<typeof preparationFailed> | undefined =>
  session.token === undefined ? preparationFailed(expected, step, session.last) : undefined;

// --- Esquema 1: el detalle trae los datos del caso y sus requisitos enlazados -----------------------------------------------

const caseDetail: ApiRowHandler = async (row) => {
  await resetTenants([TENANT_A]);
  const expected = `respuesta 200 con programCode ${cell(row, 'programa')}, title ${cell(row, 'titulo')}, requirementCodes ${cell(row, 'requisitos')} y runs con ${cell(row, 'ejecuciones')} elementos`;
  const session = await sessionFor('gestor');
  const missing = sessionOrSkip(session, expected, 'gestor@sigpro.test inicia sesión y recibe accessToken');
  if (missing) return missing;
  const result = await detailCase(cell(row, 'codigo'), session.token);
  const runs = field(result.body, 'runs');
  return concluded([
    responseCheck(result, { status: 200 }),
    textField(result.body, 'programCode', cell(row, 'programa')),
    textField(result.body, 'title', cell(row, 'titulo')),
    check(joinedCodes(field(result.body, 'requirementCodes')) === cell(row, 'requisitos'), `requirementCodes ${cell(row, 'requisitos')}`, `requirementCodes ${joinedCodes(field(result.body, 'requirementCodes'))}`),
    check(Array.isArray(runs) && runs.length === Number(cell(row, 'ejecuciones')), `runs con ${cell(row, 'ejecuciones')} elementos`, `runs con ${Array.isArray(runs) ? runs.length : '(no es lista)'} elementos`),
    check(JSON.stringify(field(result.body, 'steps')) === JSON.stringify(STEPS), `steps «${STEPS.join('», «')}» en ese orden`, `steps ${JSON.stringify(field(result.body, 'steps'))}`),
    textField(result.body, 'expected', EXPECTED),
  ]);
};

// --- Esquema 2: cada ejecución trae su fecha, su resultado, sus notas, su evidencia y quién la registró -------------------

const runEntry: ApiRowHandler = async (row) => {
  await resetTenants([TENANT_A]);
  const expected = `la ejecución ${cell(row, 'posicion')} es ${cell(row, 'ejecucion')}, con result ${cell(row, 'resultado')}, executedAt ${cell(row, 'fecha')}, notes ${cell(row, 'notas')} y ${cell(row, 'evidencias')}`;
  const session = await sessionFor('gestor');
  const missing = sessionOrSkip(session, expected, 'gestor@sigpro.test inicia sesión y recibe accessToken');
  if (missing) return missing;
  const result = await detailCase('TC-001', session.token);
  const runs = field(result.body, 'runs');
  const run: unknown = Array.isArray(runs) ? runs[Number(cell(row, 'posicion')) - 1] : undefined;
  const evidence = strict('evidencias', EVIDENCE, cell(row, 'evidencias'));
  const evidences = field(run, 'evidences');
  const evidenceChecks: Check[] =
    evidence.kind === 'none'
      ? [check(Array.isArray(evidences) && evidences.length === 0, 'evidences vacío', `evidences ${Array.isArray(evidences) ? `con ${evidences.length} elementos` : String(evidences)}`)]
      : [
          check(Array.isArray(evidences) && evidences.length === 1, 'una evidencia', `evidences ${Array.isArray(evidences) ? `con ${evidences.length} elementos` : String(evidences)}`),
          textField(Array.isArray(evidences) ? evidences[0] : undefined, 'id', evidence.id, 'id de la evidencia'),
          textField(Array.isArray(evidences) ? evidences[0] : undefined, 'filename', evidence.filename, 'filename'),
          textField(Array.isArray(evidences) ? evidences[0] : undefined, 'mimeType', evidence.mimeType, 'mimeType'),
        ];
  return concluded([
    check(run !== undefined, `una ejecución en la posición ${cell(row, 'posicion')}`, run === undefined ? 'ninguna ejecución en esa posición' : 'una ejecución en esa posición'),
    textField(run, 'id', cell(row, 'ejecucion'), 'id'),
    textField(run, 'result', cell(row, 'resultado'), 'result'),
    textField(run, 'executedAt', cell(row, 'fecha'), 'executedAt'),
    textField(run, 'notes', quoted(cell(row, 'notas')), 'notes'),
    ...evidenceChecks,
    textField(run, 'executedByName', EXECUTED_BY, 'executedByName'),
  ]);
};

// --- Esquema 3: un código que no existe en el tenant responde 404 --------------------------------------------------------

const notFound: ApiRowHandler = async (row) => {
  await resetTenants([TENANT_A]);
  const session = await sessionFor('gestor');
  const expected = 'respuesta 404 test_case_not_found y ningún caso';
  const missing = sessionOrSkip(session, expected, 'gestor@sigpro.test inicia sesión y recibe accessToken');
  if (missing) return missing;
  const result = await detailCase(cell(row, 'codigo'), session.token);
  // La respuesta de error trae `code`: que no haya caso se comprueba por las claves propias de un caso (title, steps, runs)
  const caseKeys = ['title', 'steps', 'runs'];
  const present = caseKeys.filter((key) => field(result.body, key) !== undefined);
  return concluded([
    responseCheck(result, { status: 404, code: 'test_case_not_found' }),
    check(present.length === 0, 'sin title, steps ni runs', present.length === 0 ? 'sin title, steps ni runs' : `trae ${present.join(', ')}`),
  ]);
};

// --- Esquema 4: sin una sesión válida no hay detalle ---------------------------------------------------------------------

const withoutSession: ApiRowHandler = async (row) => {
  await resetTenants([TENANT_A]);
  const credential = strict('credencial', CREDENTIALS, cell(row, 'credencial'));
  const token = credential === 'text' ? 'un texto que no es un token' : undefined;
  const result = await detailCase('TC-001', token);
  return concluded([responseCheck(result, parseResponse(cell(row, 'respuesta')))]);
};

// --- Esquema 5: el detalle solo muestra los requisitos del tenant de la sesión -------------------------------------------

const isolation: ApiRowHandler = async (row) => {
  const expected = `el caso TC-001 trae requirements con los códigos ${cell(row, 'requisitos')}`;
  const prepared = await isolatedState();
  if (prepared.failure) return preparationFailed(expected, prepared.failure.step, prepared.failure.result);
  const tenant = strict('tenant', TENANT_OF, cell(row, 'tenant'));
  const account = strict('cuenta', ACCOUNT_OF, cell(row, 'cuenta'));
  const session: SessionOf = account === 'gestor' ? await sessionFor('gestor', tenant) : await tenantAdminSession(tenant);
  const missing = sessionOrSkip(session, expected, `${cell(row, 'cuenta')} inicia sesión en ${cell(row, 'tenant')}`);
  if (missing) return missing;
  const result = await detailCase('TC-001', session.token, tenant);
  const requirements = field(result.body, 'requirements');
  const codes = Array.isArray(requirements) ? joinedCodes(requirements) : '(sin lista de requirements)';
  return concluded([responseCheck(result, { status: 200 }), check(codes === cell(row, 'requisitos'), `requirements con los códigos ${cell(row, 'requisitos')}`, `requirements con los códigos ${codes}`)]);
};

defineApiRows({
  story: 'US-VER-CASOS-003',
  surface: 'api',
  tenants: [TENANT_A, TENANT_B],
  handlers: new Map<number, ApiRowHandler>([
    [1, caseDetail],
    [2, runEntry],
    [3, notFound],
    [4, withoutSession],
    [5, isolation],
  ]),
});
