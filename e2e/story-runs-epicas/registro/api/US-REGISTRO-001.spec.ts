import { cell, conclude, responseCheck, strict } from '../../support/checks';
import { defineApiRows, type ApiRowHandler } from '../../support/framework';
import { TENANT_25, TENANT_A, emailEchoCheck, newAccountEmail, noRequestIdCheck, pendingCheck, postRegister, requestIdCheck, resetTenants, roleEchoCheck, validBody } from './common';

// US-REGISTRO-001 — Crear una solicitud de acceso pendiente de aprobación. Preparación de cada fila: reinicio de alumno01 y de
// alumno25 (Esquema 1, según su «Dado») con sus administradores. Correo nuevo por fila; las peticiones llevan x-tenant de la fila.

const SENT_EMAIL: ReadonlyMap<string, (email: string) => string> = new Map<string, (email: string) => string>([
  ['(correo nuevo)', (email) => email],
  // Mayúsculas y espacios en los extremos: la API debe devolver el correo en minúsculas y sin espacios
  ['(correo nuevo con mayúsculas y espacios en los extremos)', (email) => `  ${email.toUpperCase()}  `],
]);

const ECHOED_EMAIL: ReadonlyMap<string, (email: string) => string> = new Map<string, (email: string) => string>([
  ['(correo nuevo)', (email) => email],
  ['(correo nuevo en minúsculas y sin espacios)', (email) => email],
]);

const ROLES: ReadonlyMap<string, string> = new Map([
  ['consultant', 'consultant'],
  ['program_manager', 'program_manager'],
  ['auditor', 'auditor'],
]);

const TENANTS_OF_E1: ReadonlyMap<string, string> = new Map([
  ['alumno01', 'alumno01'],
  ['alumno25', 'alumno25'],
]);

// --- Esquema 1: una solicitud con datos válidos queda pendiente de aprobación ------------------------------------------------

const accepted: ApiRowHandler = async (row) => {
  // El «Dado» de este Esquema reinicia alumno01 y alumno25 antes de cada fila
  await resetTenants([TENANT_A, TENANT_25]);
  const tenant = strict('cabecera', TENANTS_OF_E1, cell(row, 'cabecera'));
  const email = newAccountEmail();
  const sent = strict('correo', SENT_EMAIL, cell(row, 'correo'))(email);
  const echoed = strict('correo_respuesta', ECHOED_EMAIL, cell(row, 'correo_respuesta'))(email);
  const role = strict('rol', ROLES, cell(row, 'rol'));
  const result = await postRegister(tenant, { ...validBody(sent), role });
  return conclude([
    responseCheck(result, { status: 201 }),
    pendingCheck(result),
    roleEchoCheck(result, role),
    emailEchoCheck(result, echoed),
    requestIdCheck(result),
  ]);
};

// --- Esquema 2: un tenant que no existe no recibe la solicitud ---------------------------------------------------------------

const UNKNOWN_TENANTS: ReadonlyMap<string, string> = new Map([
  ['alumno26', 'alumno26'],
  ['noexiste', 'noexiste'],
]);

const unknownTenant: ApiRowHandler = async (row) => {
  await resetTenants([TENANT_A]);
  const tenant = strict('cabecera', UNKNOWN_TENANTS, cell(row, 'cabecera'));
  const result = await postRegister(tenant, validBody(newAccountEmail()));
  return conclude([responseCheck(result, { status: 404, code: 'tenant_not_found' }), noRequestIdCheck(result)]);
};

defineApiRows({
  story: 'US-REGISTRO-001',
  surface: 'api',
  tenants: [TENANT_A, TENANT_25],
  handlers: new Map<number, ApiRowHandler>([
    [1, accepted],
    [2, unknownTenant],
  ]),
});
