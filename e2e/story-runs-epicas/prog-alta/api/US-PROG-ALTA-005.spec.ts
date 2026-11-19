import type { ApiResult } from '../../../story-runs/support/api';
import { cell, conclude, preparationFailed, responseCheck, strict, type Check } from '../../support/checks';
import { defineApiRows, type ApiRowHandler } from '../../core/framework';
import { baseBody, credentialsOf, createProgram, fieldCheck, getProgram, noProgramCreated, resetTenants, seedPrg001Check, sessionFor, TENANT_A, updateProgram } from './common';

// US-PROG-ALTA-005 — Permisos de alta y edición por rol (API). Preparación de cada fila: reinicio de alumno01, la cuenta de la fila
// inicia sesión (consultor o auditor, o gestor para comprobar que nada cambió) y PRG-001 tiene los datos de la semilla.

const GESTOR = 'gestor@sigpro.test';
const PRG_001_NAME = 'Sistema de mando táctico Ártemis';

// --- Esquema 1: un rol sin permiso recibe 403 al crear o editar y no cambia nada ------------------------------------------------

/** Petición de la fila (texto de la tabla) → envío con el token de la cuenta de la fila. */
type Attempt = (token: string) => Promise<ApiResult>;

const ATTEMPTS: ReadonlyMap<string, Attempt> = new Map<string, Attempt>([
  ['POST /api/programs con el cuerpo base', (token) => createProgram(token, baseBody())],
  ['POST /api/programs con el nombre (vacío)', (token) => createProgram(token, { ...baseBody(), name: '' })],
  ['PATCH /api/programs/PRG-001 con solo el nombre Radar nuevo de prueba', (token) => updateProgram(token, 'PRG-001', { name: 'Radar nuevo de prueba' })],
  ['PATCH /api/programs/PRG-999 con solo el nombre Radar nuevo de prueba', (token) => updateProgram(token, 'PRG-999', { name: 'Radar nuevo de prueba' })],
]);

/** Respuesta de la tabla del Esquema 1 → qué más se comprueba además del 403 (no se crea nada, o PRG-001 conserva su nombre). */
const DENIED_EXPECT: ReadonlyMap<string, { readonly noProgram: boolean; readonly keepsName: boolean }> = new Map<string, { readonly noProgram: boolean; readonly keepsName: boolean }>([
  ['403 forbidden y no se crea ningún programa', { noProgram: true, keepsName: false }],
  ['403 forbidden y no 422', { noProgram: true, keepsName: false }],
  ['403 forbidden y PRG-001 conserva su nombre', { noProgram: false, keepsName: true }],
  ['403 forbidden y no 404', { noProgram: false, keepsName: false }],
]);

const deniedRow: ApiRowHandler = async (row) => {
  const expected = `respuesta ${cell(row, 'respuesta')}`;
  await resetTenants([TENANT_A]);
  const session = await sessionFor(credentialsOf(cell(row, 'cuenta')));
  if (session.token === undefined) return preparationFailed(expected, `${cell(row, 'cuenta')} inicia sesión y recibe accessToken`, session.last);
  const token = session.token;
  const seed = await getProgram(token, 'PRG-001');
  if (!seedPrg001Check(seed.body).ok) return preparationFailed(expected, 'PRG-001 con los datos de la semilla', seed);

  const attempt = strict('petición', ATTEMPTS, cell(row, 'peticion'));
  const expect = strict('respuesta', DENIED_EXPECT, cell(row, 'respuesta'));
  const result = await attempt(token);
  const checks: Check[] = [responseCheck(result, { status: 403, code: 'forbidden' })];
  // «y no se crea ningún programa»: un POST rechazado por rol no deja nada en el tenant
  if (expect.noProgram) checks.push(...(await noProgramCreated(token)));
  // «PRG-001 conserva su nombre»: la lectura de PRG-001 tras el intento
  if (expect.keepsName) {
    const after = await getProgram(token, 'PRG-001');
    checks.push(fieldCheck(after.body, 'name', PRG_001_NAME, 'nombre de PRG-001'));
  }
  return conclude(checks);
};

// --- Esquema 2: sin token o con un token que no es válido no se crea el programa ---------------------------------------------

/** Credencial de la tabla: «(sin cabecera)» no envía Authorization; el texto se envía como token. */
const CREDENTIAL: ReadonlyMap<string, string | undefined> = new Map<string, string | undefined>([
  ['(sin cabecera)', undefined],
  ['un texto que no es un token', 'un texto que no es un token'],
]);

const ANSWERS: ReadonlyMap<string, { readonly status: number; readonly code: string }> = new Map([
  ['401 missing_token', { status: 401, code: 'missing_token' }],
  ['401 invalid_token', { status: 401, code: 'invalid_token' }],
]);

const credentialRow: ApiRowHandler = async (row) => {
  const expected = `respuesta ${cell(row, 'respuesta')} y no se crea ningún programa`;
  await resetTenants([TENANT_A]);
  const gestor = await sessionFor(credentialsOf(GESTOR));
  if (gestor.token === undefined) return preparationFailed(expected, `${GESTOR} inicia sesión y recibe accessToken`, gestor.last);
  const token = strict('credencial', CREDENTIAL, cell(row, 'credencial'));
  const answer = strict('respuesta', ANSWERS, cell(row, 'respuesta'));
  const result = await createProgram(token, baseBody());
  return conclude([responseCheck(result, answer), ...(await noProgramCreated(gestor.token))]);
};

defineApiRows({
  story: 'US-PROG-ALTA-005',
  surface: 'api',
  tenants: [TENANT_A],
  handlers: new Map<number, ApiRowHandler>([
    [1, deniedRow],
    [2, credentialRow],
  ]),
});
