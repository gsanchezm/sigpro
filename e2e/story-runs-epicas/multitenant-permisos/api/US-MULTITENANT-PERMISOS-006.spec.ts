import { API_URL, call, field, type ApiResult } from '../../../story-runs/support/api';
import { TENANT_A, TENANT_B } from '../../../story-runs/support/prepare';
import { cell, check, preparationFailed, strict, type Check } from '../../support/checks';
import { defineApiRows, type ApiRowHandler } from '../../core/framework';
import { API_ONLY, apiOnly, bodyAt, conclude, itemsOf, prepareTenants, readSnapshots, restoring, statusCheck, unchanged, valueCheck, type Snapshots } from './common';

// US-MULTITENANT-PERMISOS-006: ningún listado, búsqueda, exportación ni descarga mezcla datos de dos tenants. Es una historia transversal:
// sus superficies (búsqueda global, listados, CSV, PDF y descargas, auditoría) se leen por las rutas de la API que consume cada pantalla,
// con el token del tenant de la fila. Preparación de cada fila (la de la regla, perfil «documental» de alumno02: renombra PRG-001, crea
// PRG-025, publica la versión 4 de DOC-001 y crea el hito PRG-025-M01). La persona de alumno01 es admin: puede usar todas las superficies.

/** Tokens de las dos cuentas de administración de la fila: `a` para alumno01 y `b` para alumno02. */
interface Tokens {
  readonly a: string;
  readonly b: string;
}

const PROGRAM_CSV_ROWS = 24;
const CSV_NOTE = 'los listados y el CSV se comprueban con el contenido completo del archivo, no solo con su número de filas';

/** Descarga de un archivo por la API con su cabecera `Content-Disposition` y su tamaño (el nombre del archivo lleva la versión). */
const download = async (tenant: string, token: string, path: string): Promise<{ readonly status: number; readonly disposition: string; readonly bytes: number }> => {
  const response = await fetch(`${API_URL}${path}`, { headers: { 'x-tenant': tenant, authorization: `Bearer ${token}` } });
  const bytes = await response.arrayBuffer();
  return { status: response.status, disposition: response.headers.get('content-disposition') ?? '', bytes: bytes.byteLength };
};

/** Grupos de resultados de una búsqueda (solo aparecen los grupos con algo). */
const groupsOf = (result: ApiResult): number => {
  const groups = field(result.body, 'groups');
  return Array.isArray(groups) ? groups.length : -1;
};

const searchAislamiento = async (tokens: Tokens): Promise<readonly Check[]> => {
  const alumno01 = await call('GET', '/search?q=aislamiento', { tenant: TENANT_A, token: tokens.a });
  const alumno02 = await call('GET', '/search?q=aislamiento', { tenant: TENANT_B, token: tokens.b });
  const n01 = groupsOf(alumno01);
  const n02 = groupsOf(alumno02);
  // Control positivo: la misma búsqueda sí devuelve resultados en alumno02, así que el vacío de alumno01 no es un fallo de la búsqueda
  return [
    statusCheck(alumno01, 200),
    check(n01 === 0, 'ningún grupo de resultados para «aislamiento» en alumno01', `${n01} grupos de resultados en alumno01`),
    statusCheck(alumno02, 200),
    check(n02 > 0, 'control: «aislamiento» sí da resultados en alumno02', `${n02} grupos de resultados en alumno02`),
  ];
};

const listEmpty = async (tokens: Tokens): Promise<readonly Check[]> => {
  const result = await call('GET', '/programs?q=aislamiento', { tenant: TENANT_A, token: tokens.a });
  return [statusCheck(result, 200), valueCheck(result, 'total', 0, 'total'), check(itemsOf(result.body).length === 0, 'ningún programa en la lista', `${itemsOf(result.body).length} programas en la lista`)];
};

const csvWithoutOther = async (tokens: Tokens): Promise<readonly Check[]> => {
  const result = await call('GET', '/programs/export', { tenant: TENANT_A, token: tokens.a });
  const text = typeof result.body === 'string' ? result.body : '';
  const lines = text.split('\n').filter((line) => line.trim() !== '');
  const rows = lines.slice(1);
  return [
    statusCheck(result, 200),
    check(rows.length === PROGRAM_CSV_ROWS, `${PROGRAM_CSV_ROWS} programas en el archivo`, `${rows.length} programas en el archivo`),
    check(!rows.some((line) => line.startsWith('PRG-025;')), 'ninguna fila con el código PRG-025', rows.some((line) => line.startsWith('PRG-025;')) ? 'hay una fila PRG-025' : 'ninguna fila con el código PRG-025'),
    check(!text.includes('Programa de aislamiento'), 'ningún programa «Programa de aislamiento»', text.includes('Programa de aislamiento') ? 'aparece «Programa de aislamiento»' : 'ningún programa «Programa de aislamiento»'),
  ];
};

const docV3 = async (tokens: Tokens): Promise<readonly Check[]> => {
  const file = await download(TENANT_A, tokens.a, '/documents/DOC-001/download');
  const content = await call('GET', '/documents/DOC-001/content', { tenant: TENANT_A, token: tokens.a });
  const pages = field(content.body, 'pages');
  const lines = Array.isArray(pages) ? (pages as unknown[]).flatMap((page) => (Array.isArray(page) ? (page as unknown[]) : [])) : [];
  return [
    check(file.status === 200 && file.disposition.includes('DOC-001-v3.pdf'), 'el archivo DOC-001-v3.pdf', `archivo de estado ${file.status} con cabecera «${file.disposition || '(sin cabecera)'}»`),
    check(file.bytes > 0, 'un PDF con contenido', `${file.bytes} bytes`),
    valueCheck(content, 'version', 3, 'la última versión de alumno01 es'),
    // Contenido de la versión 3 (con su anexo) y ninguna línea de la versión 4 de alumno02
    check(lines.includes('Anexo A: matriz de trazabilidad.'), 'el contenido de la versión 3 (con «Anexo A: matriz de trazabilidad.»)', lines.includes('Anexo A: matriz de trazabilidad.') ? 'contenido de la versión 3' : 'sin el anexo de la versión 3'),
    check(!lines.includes('Versión solo de alumno02'), 'sin la línea «Versión solo de alumno02»', lines.includes('Versión solo de alumno02') ? 'aparece la línea de alumno02' : 'sin la línea «Versión solo de alumno02»'),
  ];
};

const auditEmpty = async (tokens: Tokens): Promise<readonly Check[]> => {
  const result = await call('GET', '/audit?q=PRG-025', { tenant: TENANT_A, token: tokens.a });
  return [statusCheck(result, 200), valueCheck(result, 'total', 0, 'total'), check(itemsOf(result.body).length === 0, 'ningún evento', `${itemsOf(result.body).length} eventos`)];
};

/** Acción de la fila: su resultado esperado (el de la celda, que debe coincidir) y las comprobaciones de lo que alumno01 ve o entrega. */
interface ReadAction {
  readonly expected: string;
  readonly run: (tokens: Tokens) => Promise<readonly Check[]>;
}

const READ_ACTIONS: ReadonlyMap<string, ReadAction> = new Map<string, ReadAction>([
  ['busca «aislamiento» en la búsqueda global', { expected: 'no aparece ningún programa ni documento y la búsqueda no tiene resultados', run: searchAislamiento }],
  ['pide el listado de programas con el texto «aislamiento»', { expected: 'el listado no tiene ningún programa y el total es 0', run: listEmpty }],
  ['exporta el listado de programas en CSV', { expected: 'el archivo tiene 24 programas y ninguno tiene el código PRG-025 ni el nombre «Programa de aislamiento»', run: csvWithoutOther }],
  ['descarga el documento DOC-001', { expected: 'el archivo corresponde a la versión 3 y no a la versión 4 de alumno02', run: docV3 }],
  ['abre el registro de auditoría y busca «PRG-025»', { expected: 'no aparece ningún evento y el total es 0', run: auditEmpty }],
]);

const readsStayInTenant: ApiRowHandler = async (row) => {
  const action = strict('accion', READ_ACTIONS, cell(row, 'accion'));
  if (cell(row, 'resultado') !== action.expected) throw new Error(`la celda «resultado» de «${cell(row, 'accion')}» no es la que espera el manejador`);
  const prepared = await prepareTenants('documental');
  if ('failed' in prepared) return preparationFailed(action.expected, prepared.failed.step, prepared.failed.result);
  const checks = await action.run({ a: prepared.ok.token01, b: prepared.ok.token02 });
  return conclude(apiOnly(checks, 'llamada a la API'), { note: `${API_ONLY}; ${CSV_NOTE}`, evidence: { accion: cell(row, 'accion') } });
};

// --- Esquema 2: una escritura de un tenant no cambia lo que ve el otro -------------------------------------------------------

const PATHS_B: readonly string[] = ['/programs', '/programs/PRG-001', '/programs/PRG-025', '/programs/PRG-025/milestones', '/documents/DOC-001', '/documents/DOC-001/content'];

/** Escritura de alumno01 (con su rol admin) que la fila ejecuta antes de mirar alumno02. */
const WRITES: ReadonlyMap<string, (token: string) => Promise<ApiResult>> = new Map<string, (token: string) => Promise<ApiResult>>([
  [
    'crea el programa «Programa de otro tenant», que recibe el código PRG-025',
    (token) => call('POST', '/programs', { tenant: TENANT_A, token, body: { name: 'Programa de otro tenant', ownerId: 'u1', startDate: '2026-03-01', endDate: '2026-12-31', budget: 150000 } }),
  ],
  ['cambia el nombre de PRG-001 a «Programa solo de alumno01»', (token) => call('PATCH', '/programs/PRG-001', { tenant: TENANT_A, token, body: { name: 'Programa solo de alumno01' } })],
  [
    'publica una versión nueva de DOC-001',
    (token) => call('POST', '/documents/DOC-001/versions', { tenant: TENANT_A, token, body: { lines: ['Versión solo de alumno01'] } }),
  ],
]);

/** Comprobación sobre alumno02 (el tenant ajeno) según la frase de la fila. */
const OTHER_TENANT_STATE: ReadonlyMap<string, (after: Snapshots, before: Snapshots) => readonly Check[]> = new Map<string, (after: Snapshots, before: Snapshots) => readonly Check[]>([
  [
    'PRG-025 sigue con el nombre «Programa de aislamiento nuevo» y el listado de programas tiene 25 programas',
    (after, before) => [
      check(field(bodyAt(after, '/programs/PRG-025'), 'name') === 'Programa de aislamiento nuevo', 'PRG-025 de alumno02 sigue con «Programa de aislamiento nuevo»', `PRG-025 de alumno02 con «${String(field(bodyAt(after, '/programs/PRG-025'), 'name'))}»`),
      check(field(bodyAt(after, '/programs'), 'total') === 25, 'el listado de alumno02 con 25 programas', `el listado de alumno02 con ${String(field(bodyAt(after, '/programs'), 'total'))} programas`),
      unchanged(before, after, ['/programs'], 'el listado de programas de alumno02'),
    ],
  ],
  [
    'PRG-001 sigue con el nombre «Programa de aislamiento»',
    (after, before) => [
      check(field(bodyAt(after, '/programs/PRG-001'), 'name') === 'Programa de aislamiento', 'PRG-001 de alumno02 sigue con «Programa de aislamiento»', `PRG-001 de alumno02 con «${String(field(bodyAt(after, '/programs/PRG-001'), 'name'))}»`),
      unchanged(before, after, ['/programs/PRG-001'], 'la ficha de PRG-001 de alumno02'),
    ],
  ],
  [
    'DOC-001 sigue con su versión 4, «Versión solo de alumno02»',
    (after, before) => {
      const pages = field(bodyAt(after, '/documents/DOC-001/content'), 'pages');
      const lines = Array.isArray(pages) ? (pages as unknown[]).flatMap((page) => (Array.isArray(page) ? (page as unknown[]) : [])) : [];
      return [
        check(field(bodyAt(after, '/documents/DOC-001'), 'version') === 4, 'DOC-001 de alumno02 en la versión 4', `DOC-001 de alumno02 en la versión ${String(field(bodyAt(after, '/documents/DOC-001'), 'version'))}`),
        check(lines.includes('Versión solo de alumno02'), 'la línea «Versión solo de alumno02»', lines.includes('Versión solo de alumno02') ? 'la línea «Versión solo de alumno02»' : 'sin la línea «Versión solo de alumno02»'),
        unchanged(before, after, ['/documents/DOC-001/content'], 'el contenido de DOC-001 de alumno02'),
      ];
    },
  ],
]);

const writeStaysInTenant: ApiRowHandler = async (row) => {
  const write = strict('accion', WRITES, cell(row, 'accion'));
  const expectOther = strict('resultado', OTHER_TENANT_STATE, cell(row, 'resultado'));
  const prepared = await prepareTenants('documental');
  if ('failed' in prepared) return preparationFailed(cell(row, 'resultado'), prepared.failed.step, prepared.failed.result);
  const before = await readSnapshots(TENANT_B, prepared.ok.token02, PATHS_B);
  const result = await write(prepared.ok.token01);
  const after = await readSnapshots(TENANT_B, prepared.ok.token02, PATHS_B);
  // La escritura de alumno01 debe completarse: la fila la da por hecha con un rol que puede hacerla
  const done = check(result.status === 200 || result.status === 201, 'la escritura de alumno01 se completa (2xx) por la API', `la escritura de alumno01 responde ${result.status} por la API`);
  return conclude(apiOnly([done, ...expectOther(after, before)], 'llamada a la API'), { note: API_ONLY, evidence: { accion: cell(row, 'accion') } });
};

defineApiRows({
  story: 'US-MULTITENANT-PERMISOS-006',
  surface: 'api',
  tenants: [TENANT_A, TENANT_B],
  handlers: new Map<number, ApiRowHandler>([
    [1, restoring(readsStayInTenant)],
    [2, restoring(writeStaysInTenant)],
  ]),
});
