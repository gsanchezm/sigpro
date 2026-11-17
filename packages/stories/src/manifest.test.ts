import { describe, expect, it } from 'vitest';
import { buildManifestRows, countRowsByStory } from './manifest';
import type { StoryFile, Verification } from './model';
import { parseStoryFile } from './parse';

/** Marca de orden de bytes UTF-8 (U+FEFF), escrita como código para no meter el carácter en el fuente. */
const BOM = String.fromCharCode(0xfeff);

/** Une líneas con `\n`: cada fixture se lee como el Gherkin real y no depende de plantillas multilínea. */
const lines = (...parts: readonly string[]): string => parts.join('\n');

type StoryOptions = { tags?: readonly string[]; verificacion?: Verification; gherkin?: readonly string[] };

/** Historia en memoria: el Gherkin va en un único bloque ```gherkin del cuerpo (o sin bloque si no se pasa). */
const story = (id: string, { tags = ['web'], verificacion = 'ejecutada', gherkin }: StoryOptions = {}): StoryFile => ({
  kind: 'story',
  path: `docs/user-stories/login/${id}.md`,
  fm: { id, tipo: 'historia', epica: 'EP-LOGIN', titulo: `[Web] Historia ${id}`, etiquetas: [...tags], verificacion },
  body: gherkin === undefined ? '## Historia\nTexto.\n' : lines('## Criterios de aceptación', '```gherkin', ...gherkin, '```', ''),
});

const epic: StoryFile = { kind: 'epic', path: 'docs/user-stories/login/epic.md', fm: { id: 'EP-LOGIN', tipo: 'epica', titulo: 'Acceso', etiquetas: ['epic'] }, body: '## Resumen\nTodo.\n' };

const ACCOUNT_OUTLINE = [
  'Característica: Bloqueo',
  '',
  '  Esquema del escenario: Intentos fallidos',
  '    Dado un usuario con <intentos> intentos fallidos',
  '    Entonces ve el mensaje "<mensaje>"',
  '',
  '    Ejemplos:',
  '      | intentos | mensaje                  |',
  '      | 4        | Credenciales incorrectas |',
  '      | 5        | Cuenta bloqueada         |',
];

describe('buildManifestRows: identificadores y campos de la historia', () => {
  const rows = buildManifestRows([story('US-LOGIN-003', { gherkin: ACCOUNT_OUTLINE })]);

  it('una fila por cada fila de datos de la tabla, con el id historia/Esquema/fila', () => {
    expect(rows.map((row) => row.rowId)).toEqual(['US-LOGIN-003/E1/F1', 'US-LOGIN-003/E1/F2']);
    expect(rows.map((row) => [row.esquemaIndex, row.rowIndex])).toEqual([
      [1, 1],
      [1, 2],
    ]);
  });

  it('copia de la historia su id, plataforma, verificación y el nombre del Esquema', () => {
    expect(rows[0]).toMatchObject({ story: 'US-LOGIN-003', platform: 'web', verificacion: 'ejecutada', noImplementada: false, esquema: 'Intentos fallidos' });
  });

  it('las celdas se indexan por la cabecera y los pasos salen con el marcador sustituido', () => {
    expect(rows[0]?.cells).toEqual({ intentos: '4', mensaje: 'Credenciales incorrectas' });
    expect(rows[1]?.cells).toEqual({ intentos: '5', mensaje: 'Cuenta bloqueada' });
    expect(rows[0]?.resolvedSteps).toEqual(['Dado un usuario con 4 intentos fallidos', 'Entonces ve el mensaje "Credenciales incorrectas"']);
    expect(rows[1]?.resolvedSteps).toEqual(['Dado un usuario con 5 intentos fallidos', 'Entonces ve el mensaje "Cuenta bloqueada"']);
  });
});

describe('buildManifestRows: etiquetas de la historia', () => {
  it.each([
    ['api', ['api']],
    ['movil', ['movil']],
    ['ios', ['ios']],
    ['android', ['android']],
    ['transversal', ['transversal']],
  ] as const)('la plataforma %s sale tal cual', (platform, tags) => {
    const [row] = buildManifestRows([story('US-LOGIN-001', { tags, gherkin: ACCOUNT_OUTLINE })]);
    expect(row?.platform).toBe(platform);
  });

  it('con no-implementada junto a la plataforma, la plataforma sigue siendo la de plataforma y noImplementada es true', () => {
    const [row] = buildManifestRows([story('US-LOGIN-001', { tags: ['no-implementada', 'web'], verificacion: 'no-ejecutable', gherkin: ACCOUNT_OUTLINE })]);
    expect(row).toMatchObject({ platform: 'web', verificacion: 'no-ejecutable', noImplementada: true });
  });
});

describe('buildManifestRows: Esquemas y tablas', () => {
  it('numera los Esquemas en el orden del archivo y reinicia la fila en cada uno', () => {
    const rows = buildManifestRows([
      story('US-LOGIN-002', {
        gherkin: [
          'Característica: Dos esquemas',
          '  Esquema del escenario: Primero',
          '    Dado <a>',
          '    Ejemplos:',
          '      | a |',
          '      | x |',
          '      | y |',
          '  Esquema del escenario: Segundo',
          '    Dado <b>',
          '    Ejemplos:',
          '      | b |',
          '      | z |',
        ],
      }),
    ]);
    expect(rows.map((row) => [row.rowId, row.esquema])).toEqual([
      ['US-LOGIN-002/E1/F1', 'Primero'],
      ['US-LOGIN-002/E1/F2', 'Primero'],
      ['US-LOGIN-002/E2/F1', 'Segundo'],
    ]);
  });

  it('los Esquemas de bloques gherkin distintos siguen la misma numeración', () => {
    const body = lines(
      '```gherkin',
      'Esquema del escenario: En el primer bloque',
      '  Dado <a>',
      '  Ejemplos:',
      '    | a |',
      '    | 1 |',
      '```',
      '',
      '```gherkin',
      'Esquema del escenario: En el segundo bloque',
      '  Dado <a>',
      '  Ejemplos:',
      '    | a |',
      '    | 2 |',
      '```',
    );
    const rows = buildManifestRows([{ ...story('US-LOGIN-002'), body }]);
    expect(rows.map((row) => [row.rowId, row.esquema])).toEqual([
      ['US-LOGIN-002/E1/F1', 'En el primer bloque'],
      ['US-LOGIN-002/E2/F1', 'En el segundo bloque'],
    ]);
  });

  it('con dos tablas de Ejemplos las filas se numeran seguidas y cada fila usa su propia cabecera', () => {
    const rows = buildManifestRows([
      story('US-LOGIN-004', {
        gherkin: [
          'Esquema del escenario: Dos tablas',
          '  Dado <a> y <b>',
          '  Entonces <c>',
          '  Ejemplos: Primera',
          '    | a | b |',
          '    | 1 | 2 |',
          '    | 3 | 4 |',
          '  Ejemplos: Segunda',
          '    | b | c |',
          '    | 5 | 6 |',
        ],
      }),
    ]);
    expect(rows.map((row) => row.rowId)).toEqual(['US-LOGIN-004/E1/F1', 'US-LOGIN-004/E1/F2', 'US-LOGIN-004/E1/F3']);
    expect(rows.map((row) => row.cells)).toEqual([
      { a: '1', b: '2' },
      { a: '3', b: '4' },
      { b: '5', c: '6' },
    ]);
    // En la tercera fila `<a>` no es columna de su tabla: se deja tal cual, y `<c>` sí se sustituye.
    expect(rows[2]?.resolvedSteps).toEqual(['Dado <a> y 5', 'Entonces 6']);
  });

  it('una tabla solo con cabecera no da filas', () => {
    const rows = buildManifestRows([story('US-LOGIN-004', { gherkin: ['Esquema del escenario: Vacío', '  Dado <a>', '  Ejemplos:', '    | a |'] })]);
    expect(rows).toEqual([]);
  });
});

describe('buildManifestRows: celdas y marcadores', () => {
  it('las celdas llegan sin escapes: «\\|» es «|» y «\\\\» es «\\»', () => {
    const [row] = buildManifestRows([
      story('US-LOGIN-005', {
        gherkin: ['Esquema del escenario: Barras', '  Cuando envía <cuerpo>', '  Ejemplos:', '    | cuerpo |', String.raw`    | a \| b \\ c |`],
      }),
    ]);
    expect(row?.cells).toEqual({ cuerpo: String.raw`a | b \ c` });
    expect(row?.resolvedSteps).toEqual([String.raw`Cuando envía a | b \ c`]);
  });

  it('los marcadores con acentos y ñ se sustituyen, y se sustituyen todas las apariciones', () => {
    const [row] = buildManifestRows([
      story('US-LOGIN-005', {
        gherkin: [
          'Esquema del escenario: Acentos',
          '  Dado la contraseña <contraseña> y el número <número>',
          '  Entonces la contraseña <contraseña> se rechaza',
          '  Ejemplos:',
          '    | contraseña | número |',
          '    | Año1234!   | 3      |',
        ],
      }),
    ]);
    expect(row?.cells).toEqual({ contraseña: 'Año1234!', número: '3' });
    expect(row?.resolvedSteps).toEqual(['Dado la contraseña Año1234! y el número 3', 'Entonces la contraseña Año1234! se rechaza']);
  });

  it('un marcador que no es cabecera de la tabla se deja tal cual y no lanza', () => {
    const [row] = buildManifestRows([
      story('US-LOGIN-005', { gherkin: ['Esquema del escenario: Sin columna', '  Dado <usuario> con <fantasma>', '  Ejemplos:', '    | usuario |', '    | admin@sigpro.test |'] }),
    ]);
    expect(row?.resolvedSteps).toEqual(['Dado admin@sigpro.test con <fantasma>']);
  });

  it('«<» y «>» en una comparación no son marcadores y quedan igual', () => {
    const [row] = buildManifestRows([
      story('US-LOGIN-005', { gherkin: ['Esquema del escenario: Comparación', '  Entonces el valor < 5 y > 3 para <n>', '  Ejemplos:', '    | n |', '    | 4 |'] }),
    ]);
    expect(row?.resolvedSteps).toEqual(['Entonces el valor < 5 y > 3 para 4']);
  });

  it('lo sustituido no se vuelve a leer: una celda con un «<marcador>» no se expande y «$&» va literal', () => {
    const [row] = buildManifestRows([
      story('US-LOGIN-005', { gherkin: ['Esquema del escenario: Una pasada', '  Dado <a> y <b>', '  Ejemplos:', '    | a | b |', '    | <b> | cuesta $& |'] }),
    ]);
    expect(row?.resolvedSteps).toEqual(['Dado <b> y cuesta $&']);
  });

  it('un marcador con el nombre de una propiedad de Object no se resuelve contra el prototipo', () => {
    const [row] = buildManifestRows([story('US-LOGIN-005', { gherkin: ['Esquema del escenario: Prototipo', '  Dado <constructor> y <a>', '  Ejemplos:', '    | a |', '    | 1 |'] })]);
    expect(row?.resolvedSteps).toEqual(['Dado <constructor> y 1']);
  });

  it('una celda vacía sustituye el marcador por nada', () => {
    const [row] = buildManifestRows([story('US-LOGIN-005', { gherkin: ['Esquema del escenario: Vacía', '  Dado <a>.', '  Ejemplos:', '    | a | b |', '    |   | x |'] })]);
    expect(row?.cells).toEqual({ a: '', b: 'x' });
    expect(row?.resolvedSteps).toEqual(['Dado .']);
  });

  it('una fila con menos celdas que la cabecera no inventa las que faltan', () => {
    const [row] = buildManifestRows([story('US-LOGIN-005', { gherkin: ['Esquema del escenario: Corta', '  Dado <a> y <b>', '  Ejemplos:', '    | a | b |', '    | 1 |'] })]);
    expect(row?.cells).toEqual({ a: '1' });
    expect(row?.resolvedSteps).toEqual(['Dado 1 y <b>']);
  });
});

describe('buildManifestRows: qué archivos dan filas', () => {
  it('una épica no tiene filas', () => {
    expect(buildManifestRows([epic])).toEqual([]);
  });

  it('una historia sin bloque gherkin o sin Esquemas da cero filas', () => {
    expect(buildManifestRows([story('US-LOGIN-006')])).toEqual([]);
    expect(buildManifestRows([story('US-LOGIN-006', { gherkin: ['Característica: Solo escenarios', '  Escenario: Uno', '    Dado algo'] })])).toEqual([]);
  });

  it('una historia leída con parseStoryFile (CRLF y BOM incluidos) da las mismas filas', () => {
    const text = ['---', 'id: US-LOGIN-007', 'tipo: historia', 'epica: EP-LOGIN', 'titulo: "[API] Leída del texto"', 'etiquetas: [api]', 'verificacion: codigo', '---', '', '## Criterios de aceptación', '```gherkin', ...ACCOUNT_OUTLINE, '```', ''].join('\r\n');
    const parsed = parseStoryFile('docs/user-stories/login/US-LOGIN-007.md', `${BOM}${text}`);
    expect(parsed.ok).toBe(true);
    const files = parsed.ok ? [parsed.file] : [];
    const rows = buildManifestRows(files);
    expect(rows.map((row) => row.rowId)).toEqual(['US-LOGIN-007/E1/F1', 'US-LOGIN-007/E1/F2']);
    expect(rows[1]?.resolvedSteps[1]).toBe('Entonces ve el mensaje "Cuenta bloqueada"');
  });
});

describe('buildManifestRows: orden y pureza', () => {
  const a = story('US-LOGIN-002', { gherkin: ACCOUNT_OUTLINE });
  const b = story('US-LOGIN-010', { gherkin: ACCOUNT_OUTLINE });
  const c = story('US-AUDIT-001', { tags: ['api'], gherkin: ACCOUNT_OUTLINE });

  it('sale ordenado por id de historia (comparación de texto) sea cual sea el orden de entrada', () => {
    const expected = ['US-AUDIT-001', 'US-LOGIN-002', 'US-LOGIN-010'];
    const idsOf = (files: readonly StoryFile[]): readonly string[] => [...new Set(buildManifestRows(files).map((row) => row.story))];
    expect(idsOf([a, b, c])).toEqual(expected);
    expect(idsOf([c, b, a])).toEqual(expected);
    expect(idsOf([b, epic, a, c])).toEqual(expected);
  });

  it('la salida es la misma en cada llamada y no modifica la entrada', () => {
    const input = [b, a, c];
    const snapshot = JSON.stringify(input);
    expect(buildManifestRows(input)).toEqual(buildManifestRows([...input].reverse()));
    expect(JSON.stringify(buildManifestRows(input))).toBe(JSON.stringify(buildManifestRows(input)));
    expect(JSON.stringify(input)).toBe(snapshot);
  });

  it('dentro de una historia va por Esquema y luego por fila', () => {
    const ids = buildManifestRows([a, c]).map((row) => row.rowId);
    expect(ids).toEqual(['US-AUDIT-001/E1/F1', 'US-AUDIT-001/E1/F2', 'US-LOGIN-002/E1/F1', 'US-LOGIN-002/E1/F2']);
  });

  it('sin archivos no hay filas', () => {
    expect(buildManifestRows([])).toEqual([]);
  });
});

describe('countRowsByStory', () => {
  it('cuenta las filas de cada historia en el orden de salida', () => {
    const rows = buildManifestRows([story('US-LOGIN-002', { gherkin: ACCOUNT_OUTLINE }), story('US-LOGIN-001', { gherkin: [...ACCOUNT_OUTLINE, ...ACCOUNT_OUTLINE.slice(2)] })]);
    expect([...countRowsByStory(rows)]).toEqual([
      ['US-LOGIN-001', 4],
      ['US-LOGIN-002', 2],
    ]);
  });
});
