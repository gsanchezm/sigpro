import { adminToken, type ApiResult, type Session } from '../../../story-runs/support/api';
import { DEMO, TENANT_A, TENANT_B, resetTenants, startSession } from '../../../story-runs/support/prepare';
import { cell, check, conclude, parseResponse, preparationFailed, responseCheck, strict, type Check } from '../../support/checks';
import { defineApiRows, type ApiRowHandler } from '../../core/framework';
import { ACCOUNTS, createProgram, emptyGroupsCheck, groupsOf, searchAs, stamp, statusCheck, textField, withApiNote } from './common';

// Reglas sin fila: cualquier rol con sesión puede buscar (solo se prueba con gestor y alumnos); un acceso caducado o alterado no se
// prueba (la historia lo nombra y no tiene fila).
const RULES_NOTE = 'Reglas sin fila: otros roles y el acceso caducado o alterado no se prueban aquí.';

// US-NAVEGACION-003 — Acceso válido y aislamiento por tenant. Preparación: se reinician alumno01 y alumno02. Las filas de
// aislamiento crean con alumno01@sigpro.lab un programa «aislamiento-<marca>» (responsable u1, 2027-01-10 a 2027-12-31, 500000);
// cada fila usa una marca nueva. Las dos tenants se usan en la historia: la lista de tenants del arnés los incluye.

// --- Esquema 1: sin un acceso válido la búsqueda no responde ----------------------------------------------------------------

// La cabecera `Authorization` de cada fila (la columna «cabecera»): sin cabecera, un valor inventado o el token de renovación.
const AUTHORIZATION: ReadonlyMap<string, (session: Session) => string | undefined> = new Map<string, (session: Session) => string | undefined>([
  ['(sin cabecera)', () => undefined],
  ['Authorization con el valor Bearer abc', () => 'abc'],
  ['Authorization con el token de renovación de gestor@sigpro.test', (session) => session.refreshToken],
]);

const withoutAccess: ApiRowHandler = async (row) => {
  const expected = cell(row, 'respuesta');
  const pick = strict('cabecera', AUTHORIZATION, cell(row, 'cabecera'));
  await resetTenants([TENANT_A]);
  const started = await startSession(TENANT_A, DEMO.gestor);
  if (!started.session) return preparationFailed(expected, 'gestor@sigpro.test inicia sesión', started.result);
  const result = await searchAs(TENANT_A, pick(started.session), 'PRG-001');
  return conclude([responseCheck(result, parseResponse(expected))]);
};

// --- Esquema 2: la búsqueda devuelve solo los datos del tenant del acceso --------------------------------------------------

const HEADER_TENANTS: ReadonlyMap<string, string> = new Map<string, string>([
  ['alumno01', TENANT_A],
  ['alumno02', TENANT_B],
]);

// Lo que dice cada fila de la columna «respuesta»: un grupo de programas con el programa creado, o ningún grupo.
const ISOLATION: ReadonlyMap<string, (result: ApiResult, created: { readonly code: string; readonly name: string }) => readonly Check[]> = new Map<
  string,
  (result: ApiResult, created: { readonly code: string; readonly name: string }) => readonly Check[]
>([
  [
    '200 con un grupo de programas de total 1, el programa creado',
    (result, created) => {
      const groups = groupsOf(result) ?? [];
      const only = groups.length === 1 ? groups[0] : undefined;
      const item = only?.items[0];
      return [
        statusCheck(result, 200, 'respuesta 200'),
        check(
          only?.kind === 'program' && only.total === 1 && only.ids.length === 1 && only.ids[0] === created.code,
          `un grupo de programas de total 1 con ${created.code}`,
          `grupos: ${groups.map((group) => `${group.kind} total ${String(group.total)} (${group.ids.join(', ')})`).join(' y ') || '(ninguno)'}`,
        ),
        check(textField(item, 'title') === created.name, `el programa creado ${created.name}`, `título ${textField(item, 'title') ?? '(ausente)'}`),
      ];
    },
  ],
  ['200 sin grupos', (result) => [statusCheck(result, 200, 'respuesta 200'), emptyGroupsCheck(result)]],
]);

const isolation: ApiRowHandler = async (row) => {
  const expected = cell(row, 'respuesta');
  const account = strict('cuenta', ACCOUNTS, cell(row, 'cuenta'));
  const header = strict('cabecera', HEADER_TENANTS, cell(row, 'cabecera'));
  const outcome = strict('respuesta', ISOLATION, expected);
  await resetTenants([TENANT_A, TENANT_B]);
  const name = `aislamiento-${stamp()}`;
  const admin = await adminToken(TENANT_A);
  const created = await createProgram(TENANT_A, admin, name);
  const code = textField(created.body, 'code');
  if (created.status !== 201 || code === undefined) return preparationFailed(expected, 'alumno01@sigpro.lab crea el programa con POST /api/programs', created);
  const started = await startSession(account.tenant, account.credentials);
  if (!started.session) return preparationFailed(expected, `${cell(row, 'cuenta')} inicia sesión`, started.result);
  const result = await searchAs(header, started.session.accessToken, name);
  return conclude(outcome(result, { code, name }), { evidence: { created: code } });
};

defineApiRows({
  story: 'US-NAVEGACION-003',
  surface: 'api',
  tenants: [TENANT_A, TENANT_B],
  handlers: new Map<number, ApiRowHandler>([
    [1, withApiNote(withoutAccess, RULES_NOTE)],
    [2, withApiNote(isolation, RULES_NOTE)],
  ]),
});
