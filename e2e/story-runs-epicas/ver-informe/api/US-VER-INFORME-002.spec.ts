import { defineApiRows, type ApiRowHandler } from '../../core/framework';
import { cell, check, responseCheck, strict } from '../../support/checks';
import { TENANT_A, resetTenants } from '../../../story-runs/support/prepare';
import {
  SCOPE_CELLS,
  adminToken,
  asApiResult,
  attachmentCheck,
  bearer,
  codesOfPdf,
  done,
  evidenceOf,
  expectedCodes,
  filenameCheck,
  lineCheck,
  listed,
  mediaOf,
  numberOf,
  pdfCheck,
  pdfTypeCause,
  queryOf,
  reportReply,
  sameSet,
  scopeCheck,
  seedFailure,
} from './common';

// US-VER-INFORME-002 — Elegir el alcance del informe: selección, programa o todos los casos (API). Preparación de cada fila: reinicio
// de alumno01 con el token de su administrador, y ese mismo token pide el informe con la consulta de la fila (ninguna combinación
// responde 422: la consulta no se valida).

/** Nota común de los espacios: la regla los excluye, pero las filas no envían espacios alrededor de program. */
const SPACES_READING = 'Los espacios alrededor de cada código o del programa no cuentan (regla): la comparación los recorta; la fila envía espacios solo dentro de codes=TC-001, TC-010.';

// --- Esquema 1: la consulta elige el alcance, la línea de alcance y el nombre del archivo -----------------------------------------

const scopeAndName: ApiRowHandler = async (row) => {
  const scope = strict('consulta', SCOPE_CELLS, cell(row, 'consulta'));
  const casos = numberOf(cell(row, 'casos'));
  const linea = cell(row, 'linea');
  const nombre = cell(row, 'nombre');
  const expectedLine = `Casos de prueba: ${casos} · Ejecutados: ${casos} · Sin ejecutar: 0`;
  const cases = expectedCodes(scope);
  const expected = `respuesta 200 con un PDF llamado ${nombre}, con el PDF «${expectedLine}», la línea de alcance «${linea}» y las fichas ${listed(cases)}`;
  await resetTenants([TENANT_A]);
  const prepared = await seedFailure(TENANT_A, expected, 25);
  if (prepared !== undefined) return prepared;
  const reply = await reportReply(bearer(await adminToken(TENANT_A)), queryOf(scope));
  const fichas = codesOfPdf(reply.lines);
  // Un alcance de un solo caso tiene nombre pendiente de decisión (Decisiones pendientes de la historia 002)
  const singleCase = cases.length === 1;
  return done(
    [
      responseCheck(asApiResult(reply), { status: 200 }),
      pdfCheck(reply),
      filenameCheck(reply, nombre),
      attachmentCheck(reply),
      lineCheck(reply.lines, expectedLine, 'Casos de prueba:'),
      scopeCheck(reply.lines, linea),
      check(sameSet(fichas, cases), `las fichas son ${listed(cases)}`, `las fichas son ${listed(fichas)}`),
    ],
    {
      evidence: { ...evidenceOf(reply), fichas: fichas.length },
      reading: [
        SPACES_READING,
        singleCase
          ? 'Decisión pendiente de la historia 002: el nombre de la selección de un solo caso. Se juzga contra el Ejemplo (informe-verificacion-seleccion.pdf), que es lo que la historia afirma hoy.'
          : undefined,
      ]
        .filter((part): part is string => part !== undefined)
        .join(' '),
    },
  );
};

// --- Esquema 2: un alcance sin casos responde 404 y no trae PDF -------------------------------------------------------------------

/** Filas con un código que no existe en el tenant: la historia deja pendiente si debe ser un error de validación (Decisiones pendientes). */
const UNKNOWN_CODE_READING =
  'Decisión pendiente de la historia 002: si un código que no existe debe responder con un error de validación. El Ejemplo (y la Regla de los 404) dice 404: se juzga contra el Ejemplo. La Regla de los 404 y la pendiente se contradicen; el manejador sigue el Ejemplo y lo anota.';

const noCases: ApiRowHandler = async (row) => {
  const scope = strict('consulta', SCOPE_CELLS, cell(row, 'consulta'));
  const expected = 'respuesta 404 test_cases_not_found, sin PDF y con Content-Type application/json';
  await resetTenants([TENANT_A]);
  const prepared = await seedFailure(TENANT_A, expected, 25);
  if (prepared !== undefined) return prepared;
  const reply = await reportReply(bearer(await adminToken(TENANT_A)), queryOf(scope));
  const media = mediaOf(reply.contentType);
  const unknownCode = (scope.codes ?? '').split(',').some((code) => /^TC-999$/.test(code.trim()));
  // El tipo application/json del Ejemplo no tiene fuente en las Reglas: es una propuesta del redactor (el hallazgo se conserva)
  const proposal =
    'Expectativa sin fuente en las Reglas: propuesta del redactor. El Ejemplo pide application/json, pero las Reglas solo dicen 404 test_cases_not_found y que no hay PDF.';
  return done(
    [
      responseCheck(asApiResult(reply), { status: 404, code: 'test_cases_not_found' }),
      check(!reply.pdf, 'ningún PDF', reply.pdf ? `trae un PDF (Content-Type ${reply.contentType})` : 'ningún PDF'),
      check(media === 'application/json', 'el tipo de contenido es application/json, no application/pdf', `el tipo de contenido es ${reply.contentType}`),
    ],
    {
      cause: pdfTypeCause(reply),
      evidence: evidenceOf(reply),
      reading: [proposal, unknownCode ? UNKNOWN_CODE_READING : undefined].filter((part): part is string => part !== undefined).join(' '),
    },
  );
};

defineApiRows({
  story: 'US-VER-INFORME-002',
  surface: 'api',
  tenants: [TENANT_A],
  handlers: new Map<number, ApiRowHandler>([
    [1, scopeAndName],
    [2, noCases],
  ]),
});
