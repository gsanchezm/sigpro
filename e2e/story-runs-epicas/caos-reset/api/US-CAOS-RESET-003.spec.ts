import { call, login } from '../../../story-runs/support/api';
import { NEW_ACCOUNT_PASSWORD, TENANT_A, requestAccount } from '../../../story-runs/support/prepare';
import { cell, check, preparationFailed, strict } from '../../support/checks';
import { defineApiRows, type ApiRowHandler } from '../../core/framework';
import {
  FIRST_NEW_CODE,
  GESTOR,
  PROGRAM_BODY,
  PROGRAM_NAME,
  RENAMED_NAME,
  adminAccess,
  codeOf,
  expectCheck,
  nameOf,
  prepareTenant,
  rowOutcome,
  sessionOfAccount,
  shown,
  withRestore,
  withToken,
  type Expect,
} from './common';

// US-CAOS-RESET-003 — El reinicio borra las cuentas y los programas creados en la prueba (API). Cada fila reinicia alumno01 antes de
// actuar y, al terminar, `withRestore` lo vuelve a reiniciar y le apaga el caos.

/** Contraseñas de la solicitud de cuenta y de la contraseña incorrecta del Esquema 1. */
const PASSWORDS: ReadonlyMap<string, string> = new Map<string, string>([
  ['Abcdefghij1!', NEW_ACCOUNT_PASSWORD],
  ['x', 'x'],
]);

/** Respuestas esperadas del inicio de sesión del Esquema 1. */
const RESPONSES: ReadonlyMap<string, Expect> = new Map<string, Expect>([
  ['403 pending_approval', { status: 403, code: 'pending_approval' }],
  ['401 invalid_credentials con attempts 1', { status: 401, code: 'invalid_credentials', attempts: 1 }],
]);

/** Número de altas previas del Esquema 2. */
/** Nombre del seed de PRG-001 (apps/api/src/seed/data.ts, PROGRAM_NAMES[0]): tras el reinicio el programa vuelve a tenerlo. */
const SEED_NAME_PRG_001 = 'Sistema de mando táctico Ártemis';
/** Nombres de las altas previas del Esquema 2: cada una lleva el cuerpo base con un nombre distinto (historia 003, Reglas). */
const PREVIOUS_NAMES: readonly string[] = ['Programa de prueba alfa', 'Programa de prueba beta'];
const PREVIOUS_CREATIONS: ReadonlyMap<string, number> = new Map<string, number>([
  ['1', 1],
  ['2', 2],
]);

/** Código de PRG-001 (el único programa del seed que cambia el Esquema 3). */
const SEED_PROGRAM: ReadonlyMap<string, string> = new Map<string, string>([['PRG-001', 'PRG-001']]);

// --- Esquema 1: el reinicio borra la cuenta solicitada durante la prueba --------------------------------------------------------

const deletesRequestedAccount: ApiRowHandler = async (row) => {
  const password = strict('contraseña', PASSWORDS, cell(row, 'contraseña'));
  const beforeText = cell(row, 'antes');
  const afterText = cell(row, 'despues');
  const before = strict('antes', RESPONSES, beforeText);
  const after = strict('despues', RESPONSES, afterText);
  const expected = `antes del reinicio: ${beforeText}; tras el reinicio: ${afterText}`;
  return withRestore([TENANT_A], async () => {
    await prepareTenant(TENANT_A);
    const requested = await requestAccount(TENANT_A);
    if (requested.result.status < 200 || requested.result.status >= 300) {
      return preparationFailed(expected, 'se solicita una cuenta nueva con POST /api/auth/register (cuenta recién solicitada)', requested.result);
    }
    const first = await login({ tenant: TENANT_A, email: requested.email, password });
    const admin = await adminAccess(TENANT_A);
    const reset = await call('POST', '/admin/reset', { tenant: TENANT_A, token: admin });
    const second = await login({ tenant: TENANT_A, email: requested.email, password });
    return rowOutcome([
      expectCheck(first, `la respuesta es ${beforeText}`, before),
      expectCheck(reset, 'la respuesta del reinicio es 200', { status: 200 }),
      expectCheck(second, `tras el reinicio, la misma petición responde ${afterText}`, after),
    ]);
  });
};

// --- Esquema 2: el reinicio devuelve el código de programa a la numeración del seed -----------------------------------------

const restartsProgramNumbering: ApiRowHandler = async (row) => {
  const previous = strict('altas_previas', PREVIOUS_CREATIONS, cell(row, 'altas_previas'));
  const expected = `la respuesta es 201 con el código ${FIRST_NEW_CODE}`;
  return withRestore([TENANT_A], async () => {
    await prepareTenant(TENANT_A);
    const gestor = await sessionOfAccount(TENANT_A, GESTOR);
    if (gestor.token === undefined) return preparationFailed(expected, 'gestor@sigpro.test inicia sesión en alumno01', gestor.result);
    // Cada alta previa lleva el cuerpo base con un nombre distinto (la API rechaza un nombre repetido con 422 duplicate_name)
    for (let index = 1; index <= previous; index += 1) {
      const name = PREVIOUS_NAMES[index - 1] ?? `${PROGRAM_NAME} ${index}`;
      const created = await withToken('POST', '/programs', TENANT_A, gestor.token, { ...PROGRAM_BODY, name });
      const expectedCode = `PRG-0${24 + index}`;
      if (created.status !== 201 || codeOf(created.body) !== expectedCode) {
        return preparationFailed(expected, `gestor@sigpro.test da de alta el programa ${index} («${name}») con el cuerpo base (se espera 201 con ${expectedCode})`, created);
      }
    }
    const reset = await call('POST', '/admin/reset', { tenant: TENANT_A, token: await adminAccess(TENANT_A) });
    const afterReset = await withToken('POST', '/programs', TENANT_A, gestor.token, PROGRAM_BODY);
    return rowOutcome([
      expectCheck(reset, 'la respuesta del reinicio es 200', { status: 200 }),
      expectCheck(afterReset, expected, { status: 201 }),
      check(
        codeOf(afterReset.body) === FIRST_NEW_CODE,
        `el programa dado de alta recibe el código ${FIRST_NEW_CODE}`,
        `el programa dado de alta recibe el código ${shown(codeOf(afterReset.body))}`,
      ),
    ]);
  });
};

// --- Esquema 3: el reinicio devuelve al seed un dato existente que se cambió -----------------------------------------------

const restoresChangedProgramName: ApiRowHandler = async (row) => {
  const code = strict('codigo', SEED_PROGRAM, cell(row, 'codigo'));
  const expected = `la respuesta es 200 con un nombre distinto de «${RENAMED_NAME}»`;
  return withRestore([TENANT_A], async () => {
    await prepareTenant(TENANT_A);
    const gestor = await sessionOfAccount(TENANT_A, GESTOR);
    if (gestor.token === undefined) return preparationFailed(expected, 'gestor@sigpro.test inicia sesión en alumno01', gestor.result);
    const renamed = await withToken('PATCH', `/programs/${code}`, TENANT_A, gestor.token, { name: RENAMED_NAME });
    if (renamed.status !== 200) return preparationFailed(expected, `gestor@sigpro.test cambia el nombre de ${code} con PATCH /api/programs/${code}`, renamed);
    const reset = await call('POST', '/admin/reset', { tenant: TENANT_A, token: await adminAccess(TENANT_A) });
    const read = await withToken('GET', `/programs/${code}`, TENANT_A, gestor.token);
    const name = nameOf(read.body);
    return rowOutcome([
      expectCheck(reset, 'la respuesta del reinicio es 200', { status: 200 }),
      check(
        read.status === 200 && name === SEED_NAME_PRG_001,
        `${expected}; el nombre que devuelve el reinicio es el del seed de PRG-001 («${SEED_NAME_PRG_001}»)`,
        `respuesta ${read.status} con el nombre «${shown(name)}»`,
      ),
    ]);
  });
};

defineApiRows({
  story: 'US-CAOS-RESET-003',
  surface: 'api',
  tenants: [TENANT_A],
  handlers: new Map<number, ApiRowHandler>([
    [1, deletesRequestedAccount],
    [2, restartsProgramNumbering],
    [3, restoresChangedProgramName],
  ]),
});
