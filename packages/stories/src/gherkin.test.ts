import { describe, expect, it } from 'vitest';
import { extractGherkinBlocks, findEnglishKeywords, parseOutlines, placeholdersOf } from './gherkin';

/** Une líneas con `\n`: así cada fixture se lee como el Gherkin real y no depende de plantillas multilínea. */
const lines = (...parts: readonly string[]): string => parts.join('\n');

// Esquema del ejemplo de la spec: cuatro pasos y una tabla de cabecera + 2 filas.
const LOGIN_OUTLINE = lines(
  'Característica: Bloqueo de cuenta tras intentos fallidos',
  '',
  '  Esquema del escenario: Intentos de acceso',
  '    Dado un usuario con cuenta activa',
  '    Cuando envío <usuario> con <contraseña>',
  '    Entonces veo <resultado>',
  '    Y el contador de intentos aumenta',
  '',
  '    Ejemplos:',
  '      | usuario           | intento | resultado       |',
  '      | admin@sigpro.test | 4       | Credenciales no válidas |',
  '      | admin@sigpro.test | 5       | Cuenta bloqueada |',
);

describe('extractGherkinBlocks', () => {
  it('devuelve solo el contenido de los bloques gherkin', () => {
    const body = lines(
      '## Criterios de aceptación',
      '```gherkin',
      'Característica: Uno',
      '  Esquema del escenario: A',
      '```',
      '',
      '```ts',
      'const x = 1;',
      '```',
    );
    expect(extractGherkinBlocks(body)).toEqual(['Característica: Uno\n  Esquema del escenario: A']);
  });

  it('devuelve un elemento por cada bloque gherkin, en orden', () => {
    const body = lines('```gherkin', 'primero', '```', 'texto', '```gherkin', 'segundo', '```');
    expect(extractGherkinBlocks(body)).toEqual(['primero', 'segundo']);
  });

  it('devuelve [] si no hay bloques gherkin', () => {
    expect(extractGherkinBlocks('')).toEqual([]);
    expect(extractGherkinBlocks('Solo texto')).toEqual([]);
    expect(extractGherkinBlocks(lines('```', 'sin lenguaje', '```'))).toEqual([]);
  });

  it('no confunde ```gherkinx ni otro lenguaje con gherkin', () => {
    expect(extractGherkinBlocks(lines('```gherkinx', 'a', '```', '```text', 'b', '```'))).toEqual([]);
  });

  it('ignora un bloque gherkin que es texto de un bloque exterior más largo', () => {
    const body = lines('````md', '```gherkin', 'ejemplo de plantilla', '```', '````', '', '```gherkin', 'real', '```');
    expect(extractGherkinBlocks(body)).toEqual(['real']);
  });

  it('el cierre debe ser tan largo como la apertura', () => {
    const body = lines('````gherkin', 'a', '```', 'sigue dentro', '````', 'fuera');
    expect(extractGherkinBlocks(body)).toEqual(['a\n```\nsigue dentro']);
  });

  it('tolera saltos CRLF y la sangría de la valla', () => {
    const body = ['  ```gherkin', 'Característica: A', '  ```'].join('\r\n');
    expect(extractGherkinBlocks(body)).toEqual(['Característica: A']);
  });

  it('acepta vallas con ~~~ y el lenguaje en mayúsculas', () => {
    const body = lines('~~~Gherkin', 'a', '~~~');
    expect(extractGherkinBlocks(body)).toEqual(['a']);
  });

  it('un bloque sin cierre llega hasta el final del cuerpo', () => {
    expect(extractGherkinBlocks(lines('```gherkin', 'a', 'b'))).toEqual(['a\nb']);
  });

  it('un bloque vacío da una cadena vacía', () => {
    expect(extractGherkinBlocks(lines('```gherkin', '```'))).toEqual(['']);
  });
});

describe('parseOutlines', () => {
  it('lee un Esquema con cuatro pasos y una tabla de 2 filas', () => {
    const outlines = parseOutlines(LOGIN_OUTLINE);
    expect(outlines).toHaveLength(1);
    const outline = outlines[0];
    expect(outline?.name).toBe('Intentos de acceso');
    expect(outline?.steps).toEqual([
      'Dado un usuario con cuenta activa',
      'Cuando envío <usuario> con <contraseña>',
      'Entonces veo <resultado>',
      'Y el contador de intentos aumenta',
    ]);
    expect(outline?.tables).toHaveLength(1);
    const table = outline?.tables[0];
    expect(table?.header).toEqual(['usuario', 'intento', 'resultado']);
    expect(table?.rows).toEqual([
      ['admin@sigpro.test', '4', 'Credenciales no válidas'],
      ['admin@sigpro.test', '5', 'Cuenta bloqueada'],
    ]);
  });

  it('devuelve [] si no hay Esquemas', () => {
    expect(parseOutlines('')).toEqual([]);
    expect(parseOutlines(lines('Característica: A', '  Escenario: B', '    Dado algo'))).toEqual([]);
  });

  it('un `\\|` dentro de una celda es un | literal', () => {
    const gherkin = lines(
      'Esquema del escenario: Barras',
      '  Dado <a>',
      '  Ejemplos:',
      '    | x | y |',
      String.raw`    | a \| b | c |`,
    );
    expect(parseOutlines(gherkin)[0]?.tables[0]?.rows).toEqual([['a | b', 'c']]);
  });

  it('un `\\\\` es una barra literal y no escapa el | siguiente', () => {
    const gherkin = lines(
      'Esquema del escenario: Barras',
      '  Dado <a>',
      '  Ejemplos:',
      '    | x | y |',
      String.raw`    | a\\| b |`,
    );
    expect(parseOutlines(gherkin)[0]?.tables[0]?.rows).toEqual([['a\\', 'b']]);
  });

  it('una celda vacía en medio se conserva y cuenta como celda', () => {
    const gherkin = lines('Esquema del escenario: Vacías', '  Dado <a>', '  Ejemplos:', '    | a | b | c |', '    | 1 |   | 3 |', '    |   |   |   |');
    expect(parseOutlines(gherkin)[0]?.tables[0]?.rows).toEqual([
      ['1', '', '3'],
      ['', '', ''],
    ]);
  });

  it('una fila con celdas de más o de menos conserva su longitud real', () => {
    const gherkin = lines('Esquema del escenario: Filas', '  Dado <a>', '  Ejemplos:', '    | a | b |', '    | 1 | 2 | 3 |', '    | 1 |');
    expect(parseOutlines(gherkin)[0]?.tables[0]?.rows.map((row) => row.length)).toEqual([3, 1]);
  });

  it('la tabla con solo cabecera tiene 0 filas', () => {
    const gherkin = lines('Esquema del escenario: Sin filas', '  Dado <a>', '  Ejemplos:', '    | a | b |');
    expect(parseOutlines(gherkin)[0]?.tables[0]).toEqual({ header: ['a', 'b'], rows: [] });
  });

  it('cada bloque Ejemplos aporta su propia tabla', () => {
    const gherkin = lines(
      'Esquema del escenario: Dos tablas',
      '  Dado <a>',
      '  Ejemplos: Válidos',
      '    | a |',
      '    | 1 |',
      '  Ejemplos: Inválidos',
      '    | a |',
      '    | 2 |',
      '    | 3 |',
    );
    const tables = parseOutlines(gherkin)[0]?.tables;
    expect(tables?.map((table) => table.rows.length)).toEqual([1, 2]);
  });

  it('las líneas en blanco y los comentarios no parten una tabla', () => {
    const gherkin = lines(
      'Esquema del escenario: Tabla con huecos',
      '  Dado <a>',
      '  Ejemplos:',
      '    | a |',
      '    | 1 |',
      '',
      '    # una nota',
      '    | 2 |',
    );
    const tables = parseOutlines(gherkin)[0]?.tables;
    expect(tables).toHaveLength(1);
    expect(tables?.[0]?.rows).toEqual([['1'], ['2']]);
  });

  it('lee varios Esquemas y cada uno se queda con sus pasos y tablas', () => {
    const gherkin = lines(
      'Esquema del escenario: Primero',
      '  Dado <a>',
      '  Ejemplos:',
      '    | a |',
      '    | 1 |',
      '',
      'Esquema del escenario: Segundo',
      '  Cuando <b>',
      '  Entonces <c>',
      '  Ejemplos:',
      '    | b | c |',
      '    | 2 | 3 |',
    );
    const outlines = parseOutlines(gherkin);
    expect(outlines.map((outline) => outline.name)).toEqual(['Primero', 'Segundo']);
    expect(outlines.map((outline) => outline.steps.length)).toEqual([1, 2]);
    expect(outlines[1]?.tables[0]?.header).toEqual(['b', 'c']);
  });

  it('un Escenario simple cierra el Esquema abierto: sus pasos y tablas no se le atribuyen', () => {
    const gherkin = lines(
      'Esquema del escenario: Abierto',
      '  Dado <a>',
      '  Ejemplos:',
      '    | a |',
      '    | 1 |',
      '',
      '  Escenario: Suelto',
      '    Dado un paso ajeno',
      '    | no | es | del | esquema |',
    );
    const outlines = parseOutlines(gherkin);
    expect(outlines).toHaveLength(1);
    expect(outlines[0]?.steps).toEqual(['Dado <a>']);
    expect(outlines[0]?.tables).toHaveLength(1);
  });

  it('Antecedentes, Regla y una nueva Característica también cierran el Esquema abierto', () => {
    const closers = ['Antecedentes:', 'Regla: Otra', 'Característica: Otra', 'Ejemplo: Otro'];
    closers.forEach((closer) => {
      const gherkin = lines('Esquema del escenario: Abierto', '  Dado <a>', closer, '  Dado un paso ajeno');
      expect(parseOutlines(gherkin)[0]?.steps).toEqual(['Dado <a>']);
    });
  });

  it('los pasos que anteceden al primer Esquema no se pierden ni se atribuyen a nadie', () => {
    const gherkin = lines('Antecedentes:', '  Dado un paso de contexto', 'Esquema del escenario: A', '  Dado <a>');
    expect(parseOutlines(gherkin)[0]?.steps).toEqual(['Dado <a>']);
  });

  it('reconoce todas las palabras clave de paso, sin confundir texto que empieza igual', () => {
    const gherkin = lines(
      'Esquema del escenario: Pasos',
      '  Dada una cuenta',
      '  Dados dos usuarios',
      '  Cuando entro',
      '  Entonces veo',
      '  Y algo más',
      '  E incluso otro',
      '  Pero no esto',
      '  * un paso con asterisco',
      '  Yacimiento de datos sin paso',
      '  Entonceses no es paso',
    );
    expect(parseOutlines(gherkin)[0]?.steps).toEqual([
      'Dada una cuenta',
      'Dados dos usuarios',
      'Cuando entro',
      'Entonces veo',
      'Y algo más',
      'E incluso otro',
      'Pero no esto',
      '* un paso con asterisco',
    ]);
  });

  it('un Esquema sin nombre da name vacío', () => {
    expect(parseOutlines('Esquema del escenario:\n  Dado <a>')[0]?.name).toBe('');
  });

  it('ignora los comentarios, las etiquetas y la sangría', () => {
    const gherkin = lines('# language: es', '@humo', '   Esquema del escenario:   Con sangría   ', '   # nota', '      Dado   <a>   ');
    const outline = parseOutlines(gherkin)[0];
    expect(outline?.name).toBe('Con sangría');
    expect(outline?.steps).toEqual(['Dado   <a>']);
  });

  it('tolera saltos CRLF', () => {
    const outlines = parseOutlines(LOGIN_OUTLINE.replace(/\n/g, '\r\n'));
    expect(outlines).toHaveLength(1);
    expect(outlines[0]?.steps).toHaveLength(4);
    expect(outlines[0]?.tables[0]?.header).toEqual(['usuario', 'intento', 'resultado']);
  });

  it('el texto tras la última barra de una fila no es una celda', () => {
    const gherkin = lines('Esquema del escenario: Sin cierre', '  Dado <a>', '  Ejemplos:', '    | a | b |', '    | 1 | 2 | resto');
    expect(parseOutlines(gherkin)[0]?.tables[0]?.rows).toEqual([['1', '2']]);
  });
});

describe('placeholdersOf', () => {
  it('devuelve los marcadores en orden', () => {
    expect(placeholdersOf('Cuando envío <usuario> con <contraseña>')).toEqual(['usuario', 'contraseña']);
  });

  it('un < y un > en una comparación no son marcadores', () => {
    expect(placeholdersOf('Entonces el valor < 5 y > 3')).toEqual([]);
  });

  it('distingue el marcador real aunque haya comparaciones en el mismo paso', () => {
    expect(placeholdersOf('Entonces el valor < 5 y <codigo> > 3')).toEqual(['codigo']);
  });

  it('exige un carácter que no sea espacio tras < y antes de >', () => {
    expect(placeholdersOf('Entonces <5 y > 3')).toEqual([]);
    expect(placeholdersOf('Entonces a < b> c')).toEqual([]);
    expect(placeholdersOf('Entonces < usuario >')).toEqual([]);
    expect(placeholdersOf('Entonces <>')).toEqual([]);
  });

  it('acepta marcadores de un carácter, con acentos, ñ, dígitos y guiones', () => {
    expect(placeholdersOf('Dado <a> y <año> y <código_2> y <fecha-fin>')).toEqual(['a', 'año', 'código_2', 'fecha-fin']);
  });

  it('acepta espacios dentro del nombre', () => {
    expect(placeholdersOf('Cuando envío <nombre completo>')).toEqual(['nombre completo']);
  });

  it('un < sin cerrar no se come el marcador siguiente', () => {
    expect(placeholdersOf('Cuando a <b y <c>')).toEqual(['c']);
  });

  it('devuelve cada aparición, también las repetidas', () => {
    expect(placeholdersOf('Cuando <a> y <a>')).toEqual(['a', 'a']);
  });

  it('un paso sin marcadores da []', () => {
    expect(placeholdersOf('Dado un usuario con cuenta activa')).toEqual([]);
    expect(placeholdersOf('')).toEqual([]);
  });

  it('se puede llamar varias veces seguidas con el mismo resultado', () => {
    const step = 'Cuando envío <usuario> con <contraseña>';
    expect(placeholdersOf(step)).toEqual(placeholdersOf(step));
  });
});

describe('findEnglishKeywords', () => {
  it('devuelve las palabras clave en inglés, en orden y sin los dos puntos', () => {
    expect(findEnglishKeywords('Scenario Outline: x\n Given y\n Examples:')).toEqual(['Scenario Outline', 'Given', 'Examples']);
  });

  it('un Gherkin en español da []', () => {
    expect(findEnglishKeywords(LOGIN_OUTLINE)).toEqual([]);
  });

  it('prefiere la palabra clave más larga', () => {
    expect(findEnglishKeywords('Scenario Outline: a')).toEqual(['Scenario Outline']);
    expect(findEnglishKeywords('Scenario Template: a')).toEqual(['Scenario Template']);
    expect(findEnglishKeywords('Scenario: a')).toEqual(['Scenario']);
    expect(findEnglishKeywords('Examples: a')).toEqual(['Examples']);
    expect(findEnglishKeywords('Example: a')).toEqual(['Example']);
  });

  it('reconoce el resto de palabras clave en inglés', () => {
    const gherkin = lines('Feature: f', 'Background:', 'Rule: r', 'Given a', 'When b', 'Then c', 'And d', 'But e');
    expect(findEnglishKeywords(gherkin)).toEqual(['Feature', 'Background', 'Rule', 'Given', 'When', 'Then', 'And', 'But']);
  });

  it('devuelve cada aparición, también las repetidas', () => {
    expect(findEnglishKeywords('Given a\nGiven b')).toEqual(['Given', 'Given']);
  });

  it('exige el delimitador: el texto en español que empieza igual no cuenta', () => {
    const gherkin = lines('Andrés inicia sesión', 'Butano sin paso', 'Whenever no es paso', 'Thenceforth no es paso', 'Features sin dos puntos', 'Given');
    expect(findEnglishKeywords(gherkin)).toEqual(['Given']);
  });

  it('solo cuenta al principio de la línea: no en celdas, comentarios ni a mitad de texto', () => {
    const gherkin = lines('| Given | When |', '# Given a comentario', 'Entonces veo "Given" en pantalla', 'Cuando escribo Scenario: algo');
    expect(findEnglishKeywords(gherkin)).toEqual([]);
  });

  it('distingue mayúsculas: given en minúsculas no es palabra clave', () => {
    expect(findEnglishKeywords('given y\nscenario outline: x')).toEqual([]);
  });

  it('tolera CRLF y se puede llamar varias veces seguidas', () => {
    const text = 'Scenario Outline: x\r\n Given y\r\n Examples:';
    expect(findEnglishKeywords(text)).toEqual(['Scenario Outline', 'Given', 'Examples']);
    expect(findEnglishKeywords(text)).toEqual(['Scenario Outline', 'Given', 'Examples']);
  });
});
