import { call, field } from '../../../story-runs/support/api';
import { TENANT_A, TENANT_B } from '../../../story-runs/support/prepare';
import { cell, check, preparationFailed, strict } from '../../support/checks';
import { defineApiRows, type ApiRowHandler } from '../../core/framework';
import { FIRST_NEW_CODE, GESTOR, PROGRAM_BODY, PROGRAM_NAME, adminAccess, codeOf, expectCheck, nameOf, prepareTenant, rowOutcome, sessionOfAccount, shown, tenantField, withRestore, withToken } from './common';

// US-CAOS-RESET-001 — Restaurar el tenant con el token de su administrador (API). Cada fila reinicia alumno01 antes de actuar y, al
// terminar (también si falla), `withRestore` vuelve a reiniciar los tenants que usa y le apaga el caos.

/** Cabecera `x-tenant` del reinicio: el tenant, o `undefined` para «(sin cabecera)». */
const HEADERS: ReadonlyMap<string, string | undefined> = new Map<string, string | undefined>([
  ['alumno01', TENANT_A],
  ['(sin cabecera)', undefined],
  ['alumno02', TENANT_B],
]);

/** Tenant ajeno del Esquema 3 (solo alumno02 aparece en la tabla). */
const OTHER_TENANTS: ReadonlyMap<string, string> = new Map<string, string>([['alumno02', TENANT_B]]);

/** Ruta de la variante global: su query de la historia. */
const GLOBAL_ROUTES: ReadonlyMap<string, string> = new Map<string, string>([['POST /api/admin/reset?all=true', 'all=true']]);

// --- Esquema 1: el reinicio responde con el tenant del token, sea cual sea la cabecera -----------------------------------------

const resetsTokenTenant: ApiRowHandler = async (row) => {
  const header = strict('cabecera', HEADERS, cell(row, 'cabecera'));
  return withRestore([TENANT_A], async () => {
    await prepareTenant(TENANT_A);
    const token = await adminAccess(TENANT_A);
    const reset = await withToken('POST', '/admin/reset', header, token);
    const ms = field(reset.body, 'ms');
    return rowOutcome(
      [
        expectCheck(reset, 'la respuesta es 200', { status: 200 }),
        tenantField(reset.body, TENANT_A),
        check(typeof ms === 'number' && ms < 2000, 'el campo ms es menor que 2000', `el campo ms es ${shown(ms)}`),
      ],
      { evidence: { tiempoDeLaPeticionMs: reset.ms } },
    );
  });
};

// --- Esquema 2: la variante global se rechaza sin la clave de infraestructura -------------------------------------------------

const globalResetRejected: ApiRowHandler = async (row) => {
  const query = strict('ruta', GLOBAL_ROUTES, cell(row, 'ruta'));
  const expected = 'la respuesta es 403 con el código admin_key_required; el programa dado de alta antes sigue existiendo';
  return withRestore([TENANT_A], async () => {
    await prepareTenant(TENANT_A);
    const token = await adminAccess(TENANT_A);
    const gestor = await sessionOfAccount(TENANT_A, GESTOR);
    if (gestor.token === undefined) return preparationFailed(expected, 'gestor@sigpro.test inicia sesión en alumno01', gestor.result);
    // Marca que el reinicio global no debe borrar: un programa dado de alta antes de la petición
    const marker = await withToken('POST', '/programs', TENANT_A, gestor.token, PROGRAM_BODY);
    const markerCode = codeOf(marker.body);
    if (marker.status !== 201 || markerCode !== FIRST_NEW_CODE) return preparationFailed(expected, 'gestor@sigpro.test da de alta un programa con el cuerpo base', marker);
    const rejected = await call('POST', '/admin/reset', { tenant: TENANT_A, token, query });
    const kept = await withToken('GET', `/programs/${markerCode}`, TENANT_A, gestor.token);
    return rowOutcome([
      expectCheck(rejected, 'la respuesta es 403 con el código admin_key_required', { status: 403, code: 'admin_key_required' }),
      check(
        kept.status === 200 && codeOf(kept.body) === markerCode,
        `el programa ${FIRST_NEW_CODE} dado de alta sigue existiendo (GET responde 200)`,
        `GET /api/programs/${markerCode} responde ${kept.status}${codeOf(kept.body) === undefined ? '' : ` con el código ${codeOf(kept.body) ?? ''}`}`,
      ),
    ]);
  });
};

// --- Esquema 3: el tenant del token manda, aunque la cabecera apunte a alumno02 -----------------------------------------------

const resetIgnoresHeader: ApiRowHandler = async (row) => {
  const other = strict('tenant_ajeno', OTHER_TENANTS, cell(row, 'tenant_ajeno'));
  const expected = 'la respuesta es 200 con el tenant alumno01 y GET /api/programs/PRG-025 con alumno02 responde 200 con el programa dado de alta';
  return withRestore([TENANT_A, TENANT_B], async () => {
    await prepareTenant(TENANT_A);
    await prepareTenant(TENANT_B);
    const gestor = await sessionOfAccount(TENANT_B, GESTOR);
    if (gestor.token === undefined) return preparationFailed(expected, 'gestor@sigpro.test inicia sesión en alumno02', gestor.result);
    const created = await withToken('POST', '/programs', TENANT_B, gestor.token, PROGRAM_BODY);
    if (created.status !== 201 || codeOf(created.body) !== FIRST_NEW_CODE) {
      return preparationFailed(expected, `gestor@sigpro.test da de alta en alumno02 un programa con el cuerpo base (se espera ${FIRST_NEW_CODE})`, created);
    }
    const tokenA = await adminAccess(TENANT_A);
    const reset = await withToken('POST', '/admin/reset', other, tokenA);
    const kept = await withToken('GET', `/programs/${FIRST_NEW_CODE}`, TENANT_B, gestor.token);
    const keptOk = kept.status === 200 && codeOf(kept.body) === FIRST_NEW_CODE && nameOf(kept.body) === PROGRAM_NAME;
    return rowOutcome([
      expectCheck(reset, 'la respuesta es 200', { status: 200 }),
      tenantField(reset.body, TENANT_A),
      check(
        keptOk,
        `GET /api/programs/${FIRST_NEW_CODE} con x-tenant alumno02 y el token de gestor@sigpro.test de alumno02 responde 200 con el programa dado de alta («${PROGRAM_NAME}»)`,
        `GET /api/programs/${FIRST_NEW_CODE} con x-tenant alumno02 responde ${kept.status} con el código ${shown(codeOf(kept.body))} y el nombre «${shown(nameOf(kept.body))}»`,
      ),
    ]);
  });
};

defineApiRows({
  story: 'US-CAOS-RESET-001',
  surface: 'api',
  tenants: [TENANT_A, TENANT_B],
  handlers: new Map<number, ApiRowHandler>([
    [1, resetsTokenTenant],
    [2, globalResetRejected],
    [3, resetIgnoresHeader],
  ]),
});
