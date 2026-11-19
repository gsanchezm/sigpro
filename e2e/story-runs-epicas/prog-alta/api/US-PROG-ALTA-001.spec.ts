import { field } from '../../../story-runs/support/api';
import { check, conclude, preparationFailed, responseCheck, cell, type Check } from '../../support/checks';
import { defineApiRows, type ApiRowHandler } from '../../core/framework';
import { baseBody, createProgram, credentialsOf, fieldCheck, getProgram, resetTenants, seedReady, sessionFor, TENANT_A } from './common';

// US-PROG-ALTA-001 — Crear un programa con los datos del alta (API). Preparación de cada fila: reinicio de alumno01 con el token de
// su administrador, después la cuenta de la fila inicia sesión. Antes de crear, el tenant debe tener la semilla (PRG-001 a PRG-024).

// --- Esquema 1: un alta válida crea el programa con el código siguiente -----------------------------------------------------------

/** Campos que la historia pide iguales entre la respuesta del alta y el GET posterior («el mismo programa»). */
const SAME_PROGRAM_KEYS: readonly string[] = ['name', 'ownerId', 'startDate', 'endDate', 'budgetEur', 'status', 'priority', 'classified', 'description'];

const createdWithCode: ApiRowHandler = async (row) => {
  await resetTenants([TENANT_A]);
  const expected = 'respuesta 201 con el código PRG-025 y el responsable Javier Ortega; GET PRG-025 devuelve el mismo programa, en borrador, prioridad medium, sin clasificar y descripción vacía; la segunda alta recibe PRG-026';
  const session = await sessionFor(credentialsOf(cell(row, 'cuenta')));
  if (session.token === undefined) return preparationFailed(expected, `${cell(row, 'cuenta')} inicia sesión y recibe accessToken`, session.last);
  const token = session.token;
  const seed = await seedReady(token);
  if (!seed.ok) return preparationFailed(expected, 'el tenant tiene la semilla (PRG-001 a PRG-024) tras el reinicio', seed.result);

  const created = await createProgram(token, baseBody());
  const fetched = await getProgram(token, 'PRG-025');
  const second = await createProgram(token, { ...baseBody(), name: 'Programa de prueba beta' });

  // «El mismo programa»: cada campo del GET igual al de la respuesta del alta
  const sameChecks: Check[] = SAME_PROGRAM_KEYS.map((key) => {
    const fromAlta = field(created.body, key);
    const fromGet = field(fetched.body, key);
    return check(fromGet === fromAlta, `GET PRG-025 igual que el alta en ${key}`, `GET PRG-025 en ${key}: ${String(fromGet)} (alta: ${String(fromAlta)})`);
  });

  return conclude([
    responseCheck(created, { status: 201 }),
    fieldCheck(created.body, 'code', 'PRG-025', 'código'),
    fieldCheck(created.body, 'ownerName', 'Javier Ortega', 'responsable'),
    responseCheck(fetched, { status: 200 }),
    fieldCheck(fetched.body, 'code', 'PRG-025', 'código del GET'),
    fieldCheck(fetched.body, 'status', 'draft', 'estado'),
    fieldCheck(fetched.body, 'priority', 'medium', 'prioridad'),
    fieldCheck(fetched.body, 'classified', false, 'clasificado'),
    fieldCheck(fetched.body, 'description', '', 'descripción'),
    ...sameChecks,
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
