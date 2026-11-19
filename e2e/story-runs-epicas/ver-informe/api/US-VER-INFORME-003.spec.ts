import { defineApiRows, type ApiRowHandler } from '../../core/framework';
import { cell, check, responseCheck, strict, type Check } from '../../support/checks';
import { TENANT_A, resetTenants } from '../../../story-runs/support/prepare';
import {
  CASE_CELLS,
  RESULT_LABEL_CELLS,
  SCOPE_CELLS,
  adminToken,
  asApiResult,
  bearer,
  codesOfPdf,
  done,
  evidenceOf,
  expectedCodes,
  lineCheck,
  numberOf,
  pdfCheck,
  queryOf,
  reportReply,
  seedFailure,
  type Reply,
  type ScopeQuery,
} from './common';
import { EXPECTED_TEXT, PROGRAM_NAMES, SEED_CASES, STEPS, type SeedCase } from './seed-cases';

// US-VER-INFORME-003 — Contenido del PDF: resumen por resultado y una ficha por caso (API). Preparación de cada fila: reinicio de
// alumno01 con el token de su administrador; ese mismo token pide el informe con la consulta de la fila. Las líneas se leen del texto
// del PDF (no son imágenes). Además de lo que cada Ejemplo nombra, cada ficha del alcance se compara con sus ocho líneas del seed.

const TITLE = 'SIGPRO - Informe del plan de verificación';
/** Las fechas se calculan en UTC; la historia deja pendiente la zona horaria: se anota, no se afirma que sea la correcta. */
const UTC_NOTE =
  'Las fechas («Generado el» y la fecha de cada último resultado) se calculan y se juzgan en UTC. La historia deja pendiente la zona horaria (Decisiones pendientes): se anota aquí y no se afirma que sea la correcta.';

const todayUtc = (): string => new Date().toISOString().slice(0, 10);

/** Las ocho líneas de una ficha del seed: título, programa, requisitos, los tres pasos, resultado esperado y último resultado. */
const fichaOf = (testCase: SeedCase): readonly string[] => [
  `${testCase.code} · ${testCase.title}`,
  `Programa ${testCase.programCode} · ${PROGRAM_NAMES.get(testCase.programCode) ?? '(sin nombre)'}`,
  `Requisitos verificados: ${testCase.requirements.join(', ')}`,
  ...STEPS.map((step, index) => `${index + 1}. ${step}`),
  `Esperado: ${EXPECTED_TEXT}`,
  `Último resultado: ${testCase.label} (${testCase.date}) · Ejecuciones: ${testCase.runs}`,
];

const sameLines = (actual: readonly string[], expected: readonly string[]): boolean => actual.length === expected.length && actual.every((line, index) => line === expected[index]);

/** La línea de alcance que corresponde a la consulta: selección (con su número de casos), programa o todos. */
const scopeLineOf = (scope: ScopeQuery, count: number): string => {
  const givenCodes = (scope.codes ?? '').split(',').some((code) => code.trim() !== '');
  const program = (scope.program ?? '').trim();
  if (givenCodes) return `Selección de ${count} caso(s)`;
  return program === '' ? 'Todos los programas' : `Programa ${program}`;
};

/** Encabezado, línea de alcance, «Generado el» (fecha UTC de la descarga) y el título «Resumen» en su sitio. */
const headerChecks = (reply: Reply, scopeLine: string, before: string, after: string): Check[] => {
  const generated = reply.lines[2] ?? '';
  return [
    check(reply.lines[0] === TITLE, `el encabezado es «${TITLE}»`, `el encabezado es «${reply.lines[0] ?? '(sin línea)'}»`),
    check(reply.lines[1] === scopeLine, `la línea de alcance es «${scopeLine}»`, `la línea de alcance es «${reply.lines[1] ?? '(sin línea)'}»`),
    check(generated === `Generado el ${before}` || generated === `Generado el ${after}`, 'la línea «Generado el» con la fecha de la descarga (UTC)', `la línea es «${generated === '' ? '(sin línea)' : generated}»`),
    check(reply.lines[3] === 'Resumen', 'el título «Resumen» tras la fecha', `la cuarta línea es «${reply.lines[3] ?? '(sin línea)'}»`),
  ];
};

/** Cada ficha del alcance con sus ocho líneas del seed, y las fichas en orden de código ascendente. */
const fichasCheck = (reply: Reply, cases: readonly SeedCase[]): Check => {
  const failing: string[] = [];
  let correct = 0;
  for (const testCase of cases) {
    const start = reply.lines.indexOf(`${testCase.code} · ${testCase.title}`);
    const block = start < 0 ? undefined : reply.lines.slice(start, start + 8);
    if (block !== undefined && sameLines(block, fichaOf(testCase))) correct += 1;
    else failing.push(testCase.code);
  }
  const wanted = cases.map((testCase) => testCase.code);
  const order = codesOfPdf(reply.lines);
  const orderOk = sameLines(order, wanted);
  return check(
    failing.length === 0 && orderOk,
    `las ${cases.length} fichas del alcance tienen sus ocho líneas (datos del seed) y van por código ascendente`,
    `${correct} de ${cases.length} fichas con sus ocho líneas${failing.length === 0 ? '' : `; difieren: ${failing.join(', ')}`}; orden de fichas: ${orderOk ? 'por código' : order.join(', ') || '(ninguna)'}`,
  );
};

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
  const wanted = expectedCodes(scope);
  const selected = SEED_CASES.filter((testCase) => wanted.includes(testCase.code));
  const scopeLine = scopeLineOf(scope, wanted.length);
  const expected = `respuesta 200 con un PDF y el PDF dice «${countLine}» y «${resultLine}», con sus ${selected.length} fichas`;
  await resetTenants([TENANT_A]);
  const prepared = await seedFailure(TENANT_A, expected, 25, 50);
  if (prepared !== undefined) return prepared;
  const before = todayUtc();
  const reply = await reportReply(bearer(await adminToken(TENANT_A)), queryOf(scope));
  const after = todayUtc();
  return done(
    [
      responseCheck(asApiResult(reply), { status: 200 }),
      pdfCheck(reply),
      lineCheck(reply.lines, countLine, 'Casos de prueba:'),
      lineCheck(reply.lines, resultLine, 'Último resultado - Superados:'),
      ...headerChecks(reply, scopeLine, before, after),
      fichasCheck(reply, selected),
    ],
    { evidence: evidenceOf(reply), reading: UTC_NOTE },
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
  const seedCase = SEED_CASES.find((testCase) => testCase.code === caso);
  if (seedCase === undefined) throw new Error(`el caso ${caso} de la celda no está en el seed (seed-cases.ts)`);
  const expected = `respuesta 200 con un PDF que tiene las líneas «${fichaLine}», «${programLine}», «${requirementsLine}» y «${resultLine}», y la ficha completa del seed`;
  await resetTenants([TENANT_A]);
  const prepared = await seedFailure(TENANT_A, expected, 25, 50);
  if (prepared !== undefined) return prepared;
  const before = todayUtc();
  const reply = await reportReply(bearer(await adminToken(TENANT_A)), queryOf({ codes: caso }));
  const after = todayUtc();
  return done(
    [
      responseCheck(asApiResult(reply), { status: 200 }),
      pdfCheck(reply),
      lineCheck(reply.lines, fichaLine, `${caso} · `),
      lineCheck(reply.lines, programLine, 'Programa '),
      lineCheck(reply.lines, requirementsLine, 'Requisitos verificados:'),
      lineCheck(reply.lines, resultLine, 'Último resultado:'),
      ...headerChecks(reply, `Selección de 1 caso(s)`, before, after),
      fichasCheck(reply, [seedCase]),
    ],
    { evidence: evidenceOf(reply), reading: UTC_NOTE },
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
