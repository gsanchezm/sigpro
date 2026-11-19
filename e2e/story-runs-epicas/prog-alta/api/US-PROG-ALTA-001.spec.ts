import { cell, check, preparationFailed, responseCheck, type Check } from '../../support/checks';
import { defineApiRows, type ApiRowHandler } from '../../core/framework';
import { auditCount, baseBody, conclude, createProgram, credentialsOf, fieldCheck, getProgram, presentCheck, resetTenants, seedReady, sessionFor, TENANT_A } from './common';
import { field } from '../../../story-runs/support/api';

// US-PROG-ALTA-001 — Crear un programa con los datos del alta (API). Preparación de cada fila: reinicio de alumno01 con el token de su
// administrador, después la cuenta de la fila inicia sesión. Antes de crear, el tenant debe tener la semilla (PRG-001 a PRG-024).

/** Valores que la historia fija para el cuerpo base del alta (lo que la API debe devolver, no lo que devuelve la app). */
const BASE_VALUES: readonly (readonly [key: string, value: unknown])[] = [
  ['name', 'Programa de prueba alfa'],
  ['ownerId', 'u2'],
  ['ownerName', 'Javier Ortega'],
  ['startDate', '2027-03-01'],
  ['endDate', '2027-03-02'],
  ['budgetEur', 900000],
];

/** Campos por defecto que la historia da al alta sin esos datos: borrador, prioridad media, sin clasificar y descripción vacía. */
const DEFAULT_VALUES: readonly (readonly [key: string, value: unknown])[] = [
  ['status', 'draft'],
  ['priority', 'medium'],
  ['classified', false],
  ['description', ''],
];

/** Campos que la Regla de la historia nombra en la respuesta (y que el GET debe devolver igual que el alta). */
const SAME_PROGRAM_KEYS: readonly string[] = [
  'code',
  'name',
  'description',
  'status',
  'priority',
  'classified',
  'ownerId',
  'ownerName',
  'startDate',
  'endDate',
  'budgetEur',
  'progress',
  'milestonesDone',
  'milestonesTotal',
];

// --- Esquema 1: un alta válida crea el programa con el código siguiente -----------------------------------------------------------

const createdWithCode: ApiRowHandler = async (row) => {
  await resetTenants([TENANT_A]);
  const expected = 'respuesta 201 con el código PRG-025 y el responsable Javier Ortega; GET PRG-025 devuelve el mismo programa, en borrador, prioridad medium, sin clasificar y descripción vacía; la segunda alta recibe PRG-026';
  const session = await sessionFor(credentialsOf(cell(row, 'cuenta')));
  if (session.token === undefined) return preparationFailed(expected, `${cell(row, 'cuenta')} inicia sesión y recibe accessToken`, session.last);
  const token = session.token;
  const seed = await seedReady(token);
  if (!seed.ok) return preparationFailed(expected, 'el tenant tiene la semilla (PRG-001 a PRG-024) tras el reinicio', seed.result);

  const auditBefore = await auditCount('PRG-025', 'program.created');
  const created = await createProgram(token, baseBody());
  const fetched = await getProgram(token, 'PRG-025');
  const auditAfter = await auditCount('PRG-025', 'program.created');
  const second = await createProgram(token, { ...baseBody(), name: 'Programa de prueba beta' });

  // «El mismo programa»: cada campo que nombra la Regla existe en el alta y en el GET, y son iguales (sin valores indefinidos)
  const sameChecks: Check[] = SAME_PROGRAM_KEYS.map((key) => {
    const fromAlta = field(created.body, key);
    const fromGet = field(fetched.body, key);
    const equal = fromAlta !== undefined && fromGet !== undefined && fromAlta === fromGet;
    return check(equal, `GET PRG-025 igual que el alta en ${key}`, `GET PRG-025 en ${key}: ${String(fromGet)} (alta: ${String(fromAlta)})`);
  });
  const auditChecks: Check[] = [
    check(
      auditBefore !== undefined && auditAfter !== undefined && auditAfter - auditBefore === 1,
      'la auditoría registra program.created de PRG-025 una vez',
      auditBefore === undefined || auditAfter === undefined ? 'la auditoría no se puede leer' : `la auditoría de PRG-025 crece en ${auditAfter - auditBefore}`,
    ),
  ];

  return conclude([
    responseCheck(created, { status: 201 }),
    fieldCheck(created.body, 'code', 'PRG-025', 'código'),
    ...BASE_VALUES.map(([key, value]) => fieldCheck(created.body, key, value, key)),
    ...DEFAULT_VALUES.map(([key, value]) => fieldCheck(created.body, key, value, key)),
    presentCheck(created.body, 'progress'),
    presentCheck(created.body, 'milestonesDone'),
    presentCheck(created.body, 'milestonesTotal'),
    responseCheck(fetched, { status: 200 }),
    fieldCheck(fetched.body, 'code', 'PRG-025', 'código del GET'),
    ...sameChecks,
    ...auditChecks,
    responseCheck(second, { status: 201 }),
    fieldCheck(second.body, 'code', 'PRG-026', 'código de la segunda alta'),
  ]);
};

defineApiRows({
  story: 'US-PROG-ALTA-001',
  surface: 'api',
  tenants: [TENANT_A],
  handlers: new Map<number, ApiRowHandler>([[1, createdWithCode]]),
});
