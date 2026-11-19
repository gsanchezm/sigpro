import { defineApiRows, type ApiRowHandler } from '../../core/framework';
import { cell, check, conclude, preparationFailed, strict, type Check } from '../../support/checks';
import { ACCOUNT_OF, CREDENTIAL_OF, TENANT_A, act, codeOfText, csvLines, rawExport, resetTenants, sessionFor, tokenOf, type RawCsv } from './common';

// US-PROG-GESTION-004 — Exportar los programas a CSV por la API. Preparación de cada fila: reinicio de alumno01 con el token de su
// administrador y, según la fila, inicio de sesión de la cuenta en alumno01 (el administrador completa el segundo factor). El
// archivo se lee como texto crudo con sus cabeceras; el número de líneas cuenta la cabecera.

const HEADER = 'code;name;status;owner;start;end;budget;progress';

const statusCheck = (csv: RawCsv, expected: number): Check => check(csv.status === expected, `respuesta ${expected}`, `respuesta ${csv.status}`);

// --- Esquema 1: el archivo tiene una cabecera y una línea por programa con sus campos -----------------------------------------

const fullFile: ApiRowHandler = async (row) => {
  await resetTenants([TENANT_A]);
  const expected = 'respuesta 200 de tipo text/csv en UTF-8 como sigpro-programas.csv con 25 líneas; la primera es la cabecera y la de PRG-001 es PRG-001;"Sistema de mando táctico Ártemis";active;"Marta Ruiz";2023-01-01;2024-07-01;450000;11';
  const actor = await sessionFor(strict('cuenta', ACCOUNT_OF, cell(row, 'cuenta')));
  if (actor.token === undefined) return preparationFailed(expected, `${cell(row, 'cuenta')} inicia sesión y recibe accessToken`, actor.last);
  const csv = await rawExport(undefined, actor.token);
  const lines = csvLines(csv.text);
  const type = csv.contentType.toLowerCase();
  return conclude([
    statusCheck(csv, 200),
    check(type.startsWith('text/csv') && type.includes('charset=utf-8'), 'tipo text/csv en UTF-8', `tipo ${csv.contentType}`),
    check(csv.disposition === 'attachment; filename="sigpro-programas.csv"', 'nombre sigpro-programas.csv', `descarga ${csv.disposition}`),
    check(lines.length === 25, '25 líneas', `${lines.length} líneas`),
    check(lines[0] === HEADER, `la primera línea es ${HEADER}`, `la primera línea es ${lines[0] ?? '(vacía)'}`),
    check(
      lines.includes('PRG-001;"Sistema de mando táctico Ártemis";active;"Marta Ruiz";2023-01-01;2024-07-01;450000;11'),
      'la línea de PRG-001 es PRG-001;"Sistema de mando táctico Ártemis";active;"Marta Ruiz";2023-01-01;2024-07-01;450000;11',
      `la línea de PRG-001 es ${lines.find((line) => line.startsWith('PRG-001;')) ?? '(no está)'}`,
    ),
  ]);
};

// --- Esquema 2: el archivo contiene solo los programas que cumplen los parámetros --------------------------------------------

const filtered: ApiRowHandler = async (row) => {
  await resetTenants([TENANT_A]);
  const primero = cell(row, 'primero');
  const expected = `${cell(row, 'lineas')} líneas; la primera línea de programas es ${primero}`;
  const gestor = await sessionFor('gestor');
  if (gestor.token === undefined) return preparationFailed(expected, 'gestor@sigpro.test inicia sesión y recibe accessToken', gestor.last);
  const csv = await rawExport(cell(row, 'parametros'), gestor.token);
  const lines = csvLines(csv.text);
  const firstProgram = lines[1]?.split(';')[0];
  const firstCheck =
    primero === '(ninguno)'
      ? check(lines.length === 1, 'ninguna línea de programa', `${lines.length - 1} líneas de programa`)
      : check(firstProgram === primero, `la primera línea de programas es ${primero}`, `la primera línea de programas es ${firstProgram ?? '(ninguna)'}`);
  return conclude([statusCheck(csv, 200), check(lines.length === Number(cell(row, 'lineas')), `${cell(row, 'lineas')} líneas`, `${lines.length} líneas`), firstCheck]);
};

// --- Esquema 3: cualquier rol con sesión descarga el archivo y sin sesión no hay archivo ------------------------------------

const RESPONSES: ReadonlyMap<string, (csv: RawCsv) => readonly Check[]> = new Map<string, (csv: RawCsv) => readonly Check[]>([
  ['200 con 25 líneas', (csv) => [statusCheck(csv, 200), check(csvLines(csv.text).length === 25, '25 líneas', `${csvLines(csv.text).length} líneas`)]],
  ['401 missing_token', (csv) => [statusCheck(csv, 401), check(codeOfText(csv.text) === 'missing_token', 'código missing_token', `código ${codeOfText(csv.text) ?? '(sin código)'}`)]],
  ['401 invalid_token', (csv) => [statusCheck(csv, 401), check(codeOfText(csv.text) === 'invalid_token', 'código invalid_token', `código ${codeOfText(csv.text) ?? '(sin código)'}`)]],
]);

const byCredential: ApiRowHandler = async (row) => {
  await resetTenants([TENANT_A]);
  const expected = cell(row, 'respuesta');
  const credential = strict('credencial', CREDENTIAL_OF, cell(row, 'credencial'));
  const checksOf = strict('respuesta', RESPONSES, expected);
  const actor = await tokenOf(credential);
  if (credential.kind === 'account' && actor.token === undefined) return preparationFailed(expected, 'la cuenta de la credencial inicia sesión y recibe accessToken', actor.last);
  const csv = await rawExport(undefined, actor.token);
  return conclude(checksOf(csv));
};

// --- Esquema 4: un nombre con comillas dobles se escribe con las comillas duplicadas ---------------------------------------

const quotedName: ApiRowHandler = async (row) => {
  await resetTenants([TENANT_A]);
  const expected = `la línea del programa es ${cell(row, 'linea')}`;
  const gestor = await sessionFor('gestor');
  if (gestor.token === undefined) return preparationFailed(expected, 'gestor@sigpro.test inicia sesión y recibe accessToken', gestor.last);
  // «gestor@sigpro.test ha creado con POST /api/programs el programa Radar "RVC" de prueba…» (las cifras van en la Dado)
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
  return conclude([statusCheck(csv, 200), check(lines[1] === cell(row, 'linea'), `la línea del programa es ${cell(row, 'linea')}`, `la línea del programa es ${lines[1] ?? '(sin línea)'}`)]);
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
