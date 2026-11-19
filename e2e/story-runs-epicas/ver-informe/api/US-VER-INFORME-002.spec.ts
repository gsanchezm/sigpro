import { defineApiRows, type ApiRowHandler } from '../../core/framework';
import { cell, check, responseCheck, strict } from '../../support/checks';
import { TENANT_A, resetTenants } from '../../../story-runs/support/prepare';
import { SCOPE_CELLS, adminToken, asApiResult, attachmentCheck, bearer, done, evidenceOf, filenameCheck, lineCheck, mediaOf, numberOf, pdfCheck, pdfTypeCause, queryOf, reportReply, scopeCheck, seedFailure } from './common';

// US-VER-INFORME-002 — Elegir el alcance del informe: selección, programa o todos los casos (API). Preparación de cada fila: reinicio
// de alumno01 con el token de su administrador, y ese mismo token pide el informe con la consulta de la fila (ninguna combinación
// responde 422: la consulta no se valida).

// --- Esquema 1: la consulta elige el alcance, la línea de alcance y el nombre del archivo -----------------------------------------

const scopeAndName: ApiRowHandler = async (row) => {
  const scope = strict('consulta', SCOPE_CELLS, cell(row, 'consulta'));
  const casos = numberOf(cell(row, 'casos'));
  const linea = cell(row, 'linea');
  const nombre = cell(row, 'nombre');
  const expectedLine = `Casos de prueba: ${casos} · Ejecutados: ${casos} · Sin ejecutar: 0`;
  const expected = `respuesta 200 con un PDF llamado ${nombre}, con el PDF «${expectedLine}» y la línea de alcance «${linea}»`;
  await resetTenants([TENANT_A]);
  const prepared = await seedFailure(TENANT_A, expected, 25);
  if (prepared !== undefined) return prepared;
  const reply = await reportReply(bearer(await adminToken(TENANT_A)), queryOf(scope));
  return done(
    [
      responseCheck(asApiResult(reply), { status: 200 }),
      pdfCheck(reply),
      filenameCheck(reply, nombre),
      attachmentCheck(reply),
      lineCheck(reply.lines, expectedLine, 'Casos de prueba:'),
      scopeCheck(reply.lines, linea),
    ],
    { evidence: evidenceOf(reply) },
  );
};

// --- Esquema 2: un alcance sin casos responde 404 y no trae PDF -------------------------------------------------------------------

const noCases: ApiRowHandler = async (row) => {
  const scope = strict('consulta', SCOPE_CELLS, cell(row, 'consulta'));
  const expected = 'respuesta 404 test_cases_not_found, sin PDF y con Content-Type application/json';
  await resetTenants([TENANT_A]);
  const prepared = await seedFailure(TENANT_A, expected, 25);
  if (prepared !== undefined) return prepared;
  const reply = await reportReply(bearer(await adminToken(TENANT_A)), queryOf(scope));
  const media = mediaOf(reply.contentType);
  return done(
    [
      responseCheck(asApiResult(reply), { status: 404, code: 'test_cases_not_found' }),
      check(!reply.pdf, 'ningún PDF', reply.pdf ? `trae un PDF (Content-Type ${reply.contentType})` : 'ningún PDF'),
      check(media === 'application/json', 'el tipo de contenido es application/json, no application/pdf', `el tipo de contenido es ${reply.contentType}`),
    ],
    { cause: pdfTypeCause(reply), evidence: evidenceOf(reply) },
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
