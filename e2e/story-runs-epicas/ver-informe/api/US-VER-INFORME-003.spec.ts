import { defineApiRows, type ApiRowHandler } from '../../core/framework';
import { cell, responseCheck, strict } from '../../support/checks';
import { TENANT_A, resetTenants } from '../../../story-runs/support/prepare';
import { CASE_CELLS, RESULT_LABEL_CELLS, SCOPE_CELLS, adminToken, asApiResult, bearer, done, evidenceOf, lineCheck, numberOf, pdfCheck, queryOf, reportReply, seedFailure } from './common';

// US-VER-INFORME-003 — Contenido del PDF: resumen por resultado y una ficha por caso (API). Preparación de cada fila: reinicio de
// alumno01 con el token de su administrador; ese mismo token pide el informe con la consulta de la fila. Las líneas se leen del
// texto del PDF (no son imágenes): cada comprobación busca la línea exacta y, si no aparece, muestra la que sí aparece.

// --- Esquema 1: el resumen cuenta los casos, las ejecuciones y los últimos resultados del alcance -------------------------------

const summaryOfScope: ApiRowHandler = async (row) => {
  const scope = strict('consulta', SCOPE_CELLS, cell(row, 'consulta'));
  const casos = numberOf(cell(row, 'casos'));
  const ejecutados = numberOf(cell(row, 'ejecutados'));
  const sinEjecutar = numberOf(cell(row, 'sin_ejecutar'));
  const superados = numberOf(cell(row, 'superados'));
  const fallidos = numberOf(cell(row, 'fallidos'));
  const bloqueados = numberOf(cell(row, 'bloqueados'));
  const countLine = `Casos de prueba: ${casos} · Ejecutados: ${ejecutados} · Sin ejecutar: ${sinEjecutar}`;
  const resultLine = `Último resultado - Superados: ${superados} · Fallidos: ${fallidos} · Bloqueados: ${bloqueados}`;
  const expected = `respuesta 200 con un PDF y el PDF dice «${countLine}» y «${resultLine}»`;
  await resetTenants([TENANT_A]);
  const prepared = await seedFailure(TENANT_A, expected, 25, 50);
  if (prepared !== undefined) return prepared;
  const reply = await reportReply(bearer(await adminToken(TENANT_A)), queryOf(scope));
  return done(
    [
      responseCheck(asApiResult(reply), { status: 200 }),
      pdfCheck(reply),
      lineCheck(reply.lines, countLine, 'Casos de prueba:'),
      lineCheck(reply.lines, resultLine, 'Último resultado - Superados:'),
    ],
    { evidence: evidenceOf(reply) },
  );
};

// --- Esquema 2: cada caso tiene su ficha con sus datos y su último resultado ------------------------------------------------------

const fichaOfCase: ApiRowHandler = async (row) => {
  const caso = strict('caso', CASE_CELLS, cell(row, 'caso'));
  const titulo = cell(row, 'titulo');
  const programa = cell(row, 'programa');
  const nombrePrograma = cell(row, 'nombre_programa');
  const requisitos = cell(row, 'requisitos');
  const resultado = strict('resultado', RESULT_LABEL_CELLS, cell(row, 'resultado'));
  const fecha = cell(row, 'fecha');
  const ejecuciones = numberOf(cell(row, 'ejecuciones'));
  const fichaLine = `${caso} · ${titulo}`;
  const programLine = `Programa ${programa} · ${nombrePrograma}`;
  const requirementsLine = `Requisitos verificados: ${requisitos}`;
  const resultLine = `Último resultado: ${resultado} (${fecha}) · Ejecuciones: ${ejecuciones}`;
  const expected = `respuesta 200 con un PDF que tiene las líneas «${fichaLine}», «${programLine}», «${requirementsLine}» y «${resultLine}»`;
  await resetTenants([TENANT_A]);
  const prepared = await seedFailure(TENANT_A, expected, 25, 50);
  if (prepared !== undefined) return prepared;
  const reply = await reportReply(bearer(await adminToken(TENANT_A)), queryOf({ codes: caso }));
  return done(
    [
      responseCheck(asApiResult(reply), { status: 200 }),
      pdfCheck(reply),
      lineCheck(reply.lines, fichaLine, `${caso} · `),
      lineCheck(reply.lines, programLine, 'Programa '),
      lineCheck(reply.lines, requirementsLine, 'Requisitos verificados:'),
      lineCheck(reply.lines, resultLine, 'Último resultado:'),
    ],
    { evidence: evidenceOf(reply) },
  );
};

defineApiRows({
  story: 'US-VER-INFORME-003',
  surface: 'api',
  tenants: [TENANT_A],
  handlers: new Map<number, ApiRowHandler>([
    [1, summaryOfScope],
    [2, fichaOfCase],
  ]),
});

