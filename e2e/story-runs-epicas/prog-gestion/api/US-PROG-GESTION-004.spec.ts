import { defineApiRows, type ApiRowHandler } from '../../core/framework';
import { cell, check, conclude, preparationFailed, strict, type Check } from '../../support/checks';
import { ACCOUNT_OF, CREDENTIAL_OF, TENANT_A, act, codeOfText, csvLines, rawExport, resetTenants, sessionFor, tokenOf, type RawCsv } from './common';

// US-PROG-GESTION-004 — Exportar los programas a CSV por la API. Preparación de cada fila: reinicio de alumno01 con el token de su
// administrador y, según la fila, inicio de sesión de la cuenta en alumno01 (el administrador completa el segundo factor). El
// archivo se lee como texto crudo con sus cabeceras; las líneas cuentan la cabecera; el orden se compara con la lista completa.

const HEADER = 'code;name;status;owner;start;end;budget;progress';
const PRG001_LINE = 'PRG-001;"Sistema de mando táctico Ártemis";active;"Marta Ruiz";2023-01-01;2024-07-01;450000;11';

const ascending = (count: number): readonly string[] => Array.from({ length: count }, (_, index) => `PRG-${String(index + 1).padStart(3, '0')}`);
const descending = (count: number): readonly string[] => [...ascending(count)].reverse();

/** Códigos que cada fila de «parámetros» debe devolver, en orden (los de la historia y su seed; `status=on_hold` son PRG-004, PRG-012 y PRG-020). */
const EXPECTED_CODES: ReadonlyMap<string, readonly string[]> = new Map<string, readonly string[]>([
  ['status=on_hold', ['PRG-004', 'PRG-012', 'PRG-020']],
  ['q=PRG-001&to=2024-07-01', ['PRG-001']],
  ['q=PRG-001&to=2024-06-30', []],
  ['sort=code&dir=desc', descending(24)],
  ['page=3&pageSize=10', ascending(24)],
  ['status=inventado', ascending(24)],
]);

const statusCheck = (csv: RawCsv, expected: number): Check => check(csv.status === expected, `respuesta ${expected}`, `respuesta ${csv.status}`);

/** Comprobaciones de la descarga completa: tipo, codificación, nombre de archivo, cabecera y 25 líneas con PRG-001 exacta. */
const fullFileChecks = (csv: RawCsv): Check[] => {
  const lines = csvLines(csv.text);
  const type = csv.contentType.toLowerCase();
  return [
    statusCheck(csv, 200),
    check(type.startsWith('text/csv') && type.includes('charset=utf-8'), 'tipo text/csv en UTF-8', `tipo ${csv.contentType}`),
    check(csv.disposition === 'attachment; filename="sigpro-programas.csv"', 'nombre sigpro-programas.csv', `descarga ${csv.disposition}`),
    check(lines.length === 25, '25 líneas', `${lines.length} líneas`),
    check(lines[0] === HEADER, `la primera línea es ${HEADER}`, `la primera línea es ${lines[0] ?? '(vacía)'}`),
    check(lines.includes(PRG001_LINE), `la línea de PRG-001 es ${PRG001_LINE}`, `la línea de PRG-001 es ${lines.find((line) => line.startsWith('PRG-001;')) ?? '(no está)'}`),
  ];
};

/** Códigos de las líneas de programa (sin la cabecera), en orden. */
const codesOfLines = (csv: RawCsv): readonly string[] => csvLines(csv.text).slice(1).map((line) => line.split(';')[0] ?? '');

const sameList = (actual: readonly string[], expected: readonly string[]): Check =>
  check(actual.length === expected.length && actual.every((code, index) => code === expected[index]), `el orden es ${expected.length === 0 ? '(ninguno)' : expected.join(', ')}`, `el orden es ${actual.length === 0 ? '(ninguno)' : actual.join(', ')}`);

// --- Esquema 1: el archivo tiene una cabecera y una línea por programa con sus campos -----------------------------------------

const fullFile: ApiRowHandler = async (row) => {
  await resetTenants([TENANT_A]);
  const expected = 'respuesta 200 de tipo text/csv en UTF-8 como sigpro-programas.csv con 25 líneas, la cabecera, la línea de PRG-001 y los 24 códigos en orden';
  const actor = await sessionFor(strict('cuenta', ACCOUNT_OF, cell(row, 'cuenta')));
  if (actor.token === undefined) return preparationFailed(expected, `${cell(row, 'cuenta')} inicia sesión y recibe accessToken`, actor.last);
  const csv = await rawExport(undefined, actor.token);
  return conclude([...fullFileChecks(csv), sameList(codesOfLines(csv), ascending(24))]);
};

// --- Esquema 2: el archivo contiene solo los programas que cumplen los parámetros --------------------------------------------

const filtered: ApiRowHandler = async (row) => {
  await resetTenants([TENANT_A]);
  const parametros = cell(row, 'parametros');
  const expected = `${cell(row, 'lineas')} líneas con cabecera; la primera línea de programas es ${cell(row, 'primero')}; orden ${EXPECTED_CODES.get(parametros)?.join(', ') ?? '(sin lista)'}`;
  const expectedCodes = strict('parámetros', EXPECTED_CODES, parametros);
  const gestor = await sessionFor('gestor');
  if (gestor.token === undefined) return preparationFailed(expected, 'gestor@sigpro.test inicia sesión y recibe accessToken', gestor.last);
  const csv = await rawExport(parametros, gestor.token);
  const lines = csvLines(csv.text);
  const primero = cell(row, 'primero');
  return conclude([
    statusCheck(csv, 200),
    check(lines[0] === HEADER, `la cabecera es ${HEADER}`, `la cabecera es ${lines[0] ?? '(vacía)'}`),
    check(lines.length === Number(cell(row, 'lineas')), `${cell(row, 'lineas')} líneas`, `${lines.length} líneas`),
    sameList(codesOfLines(csv), expectedCodes),
    check(primero === '(ninguno)' ? lines.length === 1 : codesOfLines(csv)[0] === primero, `la primera línea de programas es ${primero}`, `la primera línea de programas es ${codesOfLines(csv)[0] ?? '(ninguna)'}`),
  ]);
};

// --- Esquema 3: cualquier rol con sesión descarga el archivo y sin sesión no hay archivo ------------------------------------

const byCredential: ApiRowHandler = async (row) => {
  await resetTenants([TENANT_A]);
  const expected = cell(row, 'respuesta');
  const credential = strict('credencial', CREDENTIAL_OF, cell(row, 'credencial'));
  const actor = await tokenOf(credential);
  if (credential.kind === 'account' && actor.token === undefined) return preparationFailed(expected, 'la cuenta de la credencial inicia sesión y recibe accessToken', actor.last);
  const csv = await rawExport(undefined, actor.token);
  if (expected === '200 con 25 líneas') return conclude([...fullFileChecks(csv), sameList(codesOfLines(csv), ascending(24))]);
  const code = codeOfText(csv.text);
  const missing = expected === '401 missing_token' ? 'missing_token' : 'invalid_token';
  return conclude([statusCheck(csv, 401), check(code === missing, `código ${missing}`, `código ${code ?? '(sin código)'}`)]);
};

// --- Esquema 4: un nombre con comillas dobles se escribe con las comillas duplicadas ---------------------------------------

const quotedName: ApiRowHandler = async (row) => {
  await resetTenants([TENANT_A]);
  const expected = `el archivo es la cabecera y una sola línea: ${cell(row, 'linea')}`;
  const gestor = await sessionFor('gestor');
  if (gestor.token === undefined) return preparationFailed(expected, 'gestor@sigpro.test inicia sesión y recibe accessToken', gestor.last);
  // «gestor@sigpro.test ha creado con POST /api/programas el programa Radar "RVC" de prueba…» (las cifras van en la Dado)
  const created = await act('POST', '/programs', gestor.token, {
    name: 'Radar "RVC" de prueba',
    description: '',
    ownerId: 'u1',
    status: 'draft',
    startDate: '2030-01-01',
    endDate: '2030-12-31',
    budget: 100000,
    priority: 'low',
    classified: false,
  });
  if (created.status !== 201) return preparationFailed(expected, 'gestor@sigpro.test crea el programa con POST /api/programs', created);
  const csv = await rawExport(cell(row, 'parametros'), gestor.token);
  const lines = csvLines(csv.text);
  return conclude([
    statusCheck(csv, 200),
    check(lines.length === 2, 'la cabecera y una línea de programa (2 líneas)', `${lines.length} líneas`),
    check(lines[0] === HEADER, `la cabecera es ${HEADER}`, `la cabecera es ${lines[0] ?? '(vacía)'}`),
    check(lines[1] === cell(row, 'linea'), `la línea del programa es ${cell(row, 'linea')}`, `la línea del programa es ${lines[1] ?? '(sin línea)'}`),
  ]);
};

defineApiRows({
  story: 'US-PROG-GESTION-004',
  surface: 'api',
  tenants: [TENANT_A],
  handlers: new Map<number, ApiRowHandler>([
    [1, fullFile],
    [2, filtered],
    [3, byCredential],
    [4, quotedName],
  ]),
});
