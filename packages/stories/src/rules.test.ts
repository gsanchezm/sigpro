import { describe, expect, it } from 'vitest';
import { TITLE_PREFIX, type StoryFrontmatter } from './model';
import type { ParseResult } from './parse';
import { lintStoryFiles, RULES, type Finding } from './rules';

// ---------------------------------------------------------------------------------------------------------
// Fixtures: la historia de ejemplo de la spec (US-LOGIN-003) y su mundo mínimo (la épica y una hermana)
// ---------------------------------------------------------------------------------------------------------

/** Une líneas con `\n`: cada fixture se lee como el Markdown real. */
const lines = (...parts: readonly string[]): string => parts.join('\n');

const INTRO = lines(
  '## Historia',
  'Como usuario con cuenta activa, quiero ver un aviso claro cuando mi cuenta se bloquea,',
  'para saber que debo esperar o pedir ayuda y no seguir intentando.',
);
const RULES_SECTION = lines('## Reglas', '- La cuenta se bloquea al quinto intento fallido.');

const OUTLINE_HEADER = '  Esquema del escenario: Intentos fallidos';
const STEP_GIVEN = '    Dado un usuario con <intentos> intentos fallidos';
const STEP_THEN = '    Entonces ve el mensaje "<mensaje>"';
const ROW_4 = '      | 4        | Credenciales incorrectas |';
const OUTLINE: readonly string[] = [
  'Característica: Bloqueo de cuenta tras intentos fallidos',
  '',
  OUTLINE_HEADER,
  STEP_GIVEN,
  '    Cuando intenta iniciar sesión con una contraseña incorrecta',
  STEP_THEN,
  '',
  '    Ejemplos:',
  '      | intentos | mensaje                  |',
  '      | 3        | Credenciales incorrectas |',
  ROW_4,
  '      | 5        | Cuenta bloqueada         |',
];

/** El Gherkin de ejemplo con una línea cambiada: así cada test altera una sola cosa. */
const swap = (from: string, to: string): readonly string[] => OUTLINE.map((line) => (line === from ? to : line));

type BodyParts = { intro?: string; gherkin?: readonly string[]; tail?: string };

const fenced = (gherkin: readonly string[]): string => lines('```gherkin', ...gherkin, '```');

/** Cuerpo de la historia de ejemplo; `tail` va al final, en «Fuera de alcance». */
const bodyOf = ({ intro = INTRO, gherkin = OUTLINE, tail }: BodyParts = {}): string =>
  lines(
    intro,
    '',
    RULES_SECTION,
    '',
    '## Criterios de aceptación',
    fenced(gherkin),
    '',
    '## Fuera de alcance',
    '- Recuperar la contraseña.',
    ...(tail === undefined ? [] : ['', tail]),
  );

const STORY_FM: StoryFrontmatter = {
  id: 'US-LOGIN-003',
  tipo: 'historia',
  epica: 'EP-LOGIN',
  titulo: '[Web] Bloquear la cuenta tras 5 intentos fallidos',
  etiquetas: ['web'],
  relacionadas: ['US-LOGIN-002'],
  verificacion: 'ejecutada',
};

type StoryOverrides = { path?: string; fm?: Partial<StoryFrontmatter>; body?: string };

/** Historia válida con lo que se le cambie. */
const story = ({ path = 'docs/user-stories/login/US-LOGIN-003.md', fm = {}, body = bodyOf() }: StoryOverrides = {}): ParseResult => ({
  ok: true,
  file: { kind: 'story', path, fm: { ...STORY_FM, ...fm }, body },
});

const epic = (
  path = 'docs/user-stories/login/epic.md',
  id = 'EP-LOGIN',
  body = '## Resumen\nTodo lo relativo a entrar en la aplicación.\n',
  titulo = 'Acceso y sesión',
): ParseResult => ({
  ok: true,
  file: { kind: 'epic', path, fm: { id, tipo: 'epica', titulo, etiquetas: ['epic'] }, body },
});

const EPIC = epic();
const SIBLING = story({
  path: 'docs/user-stories/login/US-LOGIN-002.md',
  fm: { id: 'US-LOGIN-002', titulo: '[Web] Iniciar sesión con correo y contraseña', relacionadas: [] },
});

/** Corre el linter sobre el mundo mínimo más lo que se pase. */
const lintWorld = (...extra: readonly ParseResult[]): readonly Finding[] => lintStoryFiles([EPIC, SIBLING, ...extra]);

/** Reglas distintas que saltaron, ordenadas: permite afirmar que SOLO salta la esperada. */
const fired = (findings: readonly Finding[]): readonly string[] => [...new Set(findings.map((finding) => finding.rule))].sort();

const messagesOf = (findings: readonly Finding[], rule: string): readonly string[] =>
  findings.filter((finding) => finding.rule === rule).map((finding) => finding.message);

// ---------------------------------------------------------------------------------------------------------

describe('lintStoryFiles: caso positivo y catálogo de reglas', () => {
  it('la historia de ejemplo de la spec, con su épica, no tiene hallazgos', () => {
    expect(lintWorld(story())).toEqual([]);
  });

  it('sin archivos no hay hallazgos', () => {
    expect(lintStoryFiles([])).toEqual([]);
  });

  it('define exactamente las 16 reglas estables', () => {
    expect([...RULES.keys()]).toEqual([
      'frontmatter',
      'id-unico',
      'epica-existe',
      'plataforma-unica',
      'prefijo-titulo',
      'archivo-id',
      'relacionadas-existen',
      'historia-como',
      'esquema-requerido',
      'placeholder-columna',
      'fila-celdas',
      'gherkin-ingles',
      'no-ejecutable-etiqueta',
      'ios-pendiente-nativo',
      'terminos-prohibidos',
      'mencion-suelta',
    ]);
  });

  it('cada hallazgo lleva la ruta y el id del archivo, y respeta el orden de entrada', () => {
    const bad = story({ path: 'docs/user-stories/login/US-LOGIN-009.md' });
    const findings = lintStoryFiles([EPIC, SIBLING, bad]);
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({ path: 'docs/user-stories/login/US-LOGIN-009.md', id: 'US-LOGIN-003', rule: 'archivo-id' });
  });
});

describe('regla frontmatter', () => {
  it('un archivo que no se pudo leer sale como hallazgo con el error y sin id', () => {
    const broken: ParseResult = { ok: false, path: 'docs/user-stories/login/US-LOGIN-009.md', error: 'sin front matter: el archivo debe empezar con una línea ---' };
    const findings = lintWorld(broken);
    expect(findings).toEqual([
      {
        path: 'docs/user-stories/login/US-LOGIN-009.md',
        id: '',
        rule: 'frontmatter',
        message: 'sin front matter: el archivo debe empezar con una línea ---',
      },
    ]);
  });
});

describe('regla id-unico', () => {
  it('marca los dos archivos que comparten id', () => {
    const first = story({ path: 'docs/a/login/US-LOGIN-003.md' });
    const second = story({ path: 'docs/b/login/US-LOGIN-003.md' });
    const findings = lintWorld(first, second);
    expect(fired(findings)).toEqual(['id-unico']);
    expect(findings.map((finding) => finding.path).sort()).toEqual(['docs/a/login/US-LOGIN-003.md', 'docs/b/login/US-LOGIN-003.md']);
    expect(findings[0]?.message).toContain('US-LOGIN-003');
  });
});

describe('regla epica-existe', () => {
  it('marca una historia cuya épica no está entre los archivos', () => {
    const orphan = story({
      path: 'docs/user-stories/otra/US-OTRA-001.md',
      fm: { id: 'US-OTRA-001', epica: 'EP-OTRA', titulo: '[Web] Algo suelto', relacionadas: [] },
    });
    const findings = lintWorld(orphan);
    expect(fired(findings)).toEqual(['epica-existe']);
    expect(findings[0]?.message).toContain('EP-OTRA');
  });
});

describe('regla plataforma-unica', () => {
  it('marca una historia con dos etiquetas de plataforma', () => {
    const findings = lintWorld(story({ fm: { etiquetas: ['web', 'api'] } }));
    expect(fired(findings)).toEqual(['plataforma-unica']);
    expect(findings[0]?.message).toContain('web, api');
  });

  it('marca una historia sin etiqueta de plataforma', () => {
    expect(fired(lintWorld(story({ fm: { etiquetas: [] } })))).toEqual(['plataforma-unica']);
    expect(fired(lintWorld(story({ fm: { etiquetas: ['no-implementada'], verificacion: 'no-ejecutable' } })))).toEqual(['plataforma-unica']);
  });

  it('marca una etiqueta que no es de historia (epic) o desconocida', () => {
    expect(fired(lintWorld(story({ fm: { etiquetas: ['web', 'epic'] } })))).toEqual(['plataforma-unica']);
    expect(fired(lintWorld(story({ fm: { etiquetas: ['web', 'urgente'] } })))).toEqual(['plataforma-unica']);
  });

  it('acepta la etiqueta no-implementada junto a la de plataforma', () => {
    expect(lintWorld(story({ fm: { etiquetas: ['web', 'no-implementada'], verificacion: 'no-ejecutable' } }))).toEqual([]);
  });
});

describe('regla prefijo-titulo', () => {
  it('marca un título con el prefijo de otra plataforma (historia api con [Web])', () => {
    const findings = lintWorld(story({ fm: { etiquetas: ['api'], titulo: '[Web] Bloquear la cuenta tras 5 intentos fallidos' } }));
    expect(fired(findings)).toEqual(['prefijo-titulo']);
    expect(findings[0]?.message).toContain('[API]');
  });

  it('marca un título sin prefijo o con el prefijo pegado al texto', () => {
    expect(fired(lintWorld(story({ fm: { titulo: 'Bloquear la cuenta' } })))).toEqual(['prefijo-titulo']);
    expect(fired(lintWorld(story({ fm: { titulo: '[Web]Bloquear la cuenta' } })))).toEqual(['prefijo-titulo']);
  });

  it.each([...TITLE_PREFIX.entries()])('acepta el prefijo de %s (%s)', (platform, prefix) => {
    const result = story({
      fm: { etiquetas: [platform], titulo: `${prefix} Bloquear la cuenta`, verificacion: platform === 'ios' ? 'pendiente-nativo' : 'ejecutada' },
    });
    expect(lintWorld(result)).toEqual([]);
  });
});

describe('regla archivo-id', () => {
  it('marca un archivo US-LOGIN-009.md cuyo id es US-LOGIN-003', () => {
    const findings = lintWorld(story({ path: 'docs/user-stories/login/US-LOGIN-009.md' }));
    expect(fired(findings)).toEqual(['archivo-id']);
    expect(findings[0]?.message).toContain('US-LOGIN-009.md');
    expect(findings[0]?.message).toContain('US-LOGIN-003.md');
  });

  it('marca una historia que no está en la carpeta de su épica', () => {
    const findings = lintWorld(story({ path: 'docs/user-stories/acceso/US-LOGIN-003.md' }));
    expect(fired(findings)).toEqual(['archivo-id']);
    expect(findings[0]?.message).toContain('login');
  });

  it.each(['US-003-003', 'US-LOGINX-003', 'US-LOGIN-003-004'])('marca el id mal formado %s aunque el archivo y la carpeta coincidan', (id) => {
    const findings = lintWorld(story({ path: `docs/user-stories/login/${id}.md`, fm: { id } }));
    expect(fired(findings)).toEqual(['archivo-id']);
    expect(findings[0]?.message).toContain('US-LOGIN-');
  });

  it('marca una épica con id EP-LOGIN-003 en la carpeta login (su carpeta sería login-003)', () => {
    const findings = lintStoryFiles([epic('docs/user-stories/login/epic.md', 'EP-LOGIN-003')]);
    expect(fired(findings)).toEqual(['archivo-id']);
    expect(findings[0]?.message).toContain('login-003');
  });

  it('marca una épica que no se llama epic.md', () => {
    expect(fired(lintStoryFiles([epic('docs/user-stories/login/epico.md')]))).toEqual(['archivo-id']);
  });

  it('acepta rutas absolutas, con barras invertidas y slugs con guion', () => {
    expect(lintWorld(story({ path: 'C:/Users/gilsa/repo/docs/user-stories/login/US-LOGIN-003.md' }))).toEqual([]);
    expect(lintWorld(story({ path: 'C:\\repo\\docs\\user-stories\\login\\US-LOGIN-003.md' }))).toEqual([]);
    const hyphenated = [
      epic('docs/user-stories/mi-modulo/epic.md', 'EP-MI-MODULO'),
      story({
        path: 'docs/user-stories/mi-modulo/US-MI-MODULO-001.md',
        fm: { id: 'US-MI-MODULO-001', epica: 'EP-MI-MODULO', relacionadas: [] },
      }),
    ];
    expect(lintStoryFiles(hyphenated)).toEqual([]);
  });
});

describe('regla relacionadas-existen', () => {
  it('marca una historia relacionada que no existe', () => {
    const findings = lintWorld(story({ fm: { relacionadas: ['US-LOGIN-002', 'US-LOGIN-099'] } }));
    expect(fired(findings)).toEqual(['relacionadas-existen']);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.message).toContain('US-LOGIN-099');
  });

  it('solo se relacionan historias: el id de una épica no vale', () => {
    expect(fired(lintWorld(story({ fm: { relacionadas: ['EP-LOGIN'] } })))).toEqual(['relacionadas-existen']);
  });

  it('una historia sin relacionadas no tiene hallazgos', () => {
    expect(lintWorld(story({ fm: { relacionadas: undefined } }))).toEqual([]);
  });
});

describe('regla historia-como', () => {
  it('marca un cuerpo sin la sección «## Historia»', () => {
    const body = bodyOf({ intro: '## Contexto\nComo usuario, quiero entrar.' });
    expect(fired(lintWorld(story({ body })))).toEqual(['historia-como']);
  });

  it('marca una historia que no empieza por «Como»', () => {
    const body = bodyOf({ intro: lines('## Historia', 'El usuario quiere ver un aviso claro cuando su cuenta se bloquea.') });
    expect(fired(lintWorld(story({ body })))).toEqual(['historia-como']);
  });

  it('marca una historia sin «quiero»', () => {
    const body = bodyOf({ intro: lines('## Historia', 'Como usuario con cuenta activa, necesito un aviso.') });
    expect(fired(lintWorld(story({ body })))).toEqual(['historia-como']);
  });

  it('acepta la sección aunque el texto salte de línea y haya otras secciones después', () => {
    expect(lintWorld(story({ body: bodyOf({ intro: lines('## Historia', '', 'Como usuario,', 'quiero entrar.') }) }))).toEqual([]);
  });
});

describe('regla esquema-requerido', () => {
  it('marca un cuerpo sin bloque gherkin', () => {
    const body = lines(INTRO, '', RULES_SECTION);
    expect(fired(lintWorld(story({ body })))).toEqual(['esquema-requerido']);
  });

  it('marca un bloque gherkin sin ningún Esquema del escenario', () => {
    const gherkin = ['Característica: Bloqueo', '', '  Escenario: Cuenta bloqueada', '    Dado un usuario bloqueado', '    Entonces ve "Cuenta bloqueada"'];
    expect(fired(lintWorld(story({ body: bodyOf({ gherkin }) })))).toEqual(['esquema-requerido']);
  });

  it('marca un Esquema sin tabla de Ejemplos (o con la tabla vacía)', () => {
    const withoutTable = OUTLINE.slice(0, OUTLINE.indexOf('    Ejemplos:'));
    expect(fired(lintWorld(story({ body: bodyOf({ gherkin: withoutTable }) })))).toEqual(['esquema-requerido']);
    const headerOnly = OUTLINE.slice(0, OUTLINE.indexOf(ROW_4)).filter((line) => !line.includes('| 3 '));
    expect(fired(lintWorld(story({ body: bodyOf({ gherkin: headerOnly }) })))).toEqual(['esquema-requerido']);
  });
});

describe('regla placeholder-columna', () => {
  it('marca un <codigo> que no es columna de Ejemplos, una sola vez aunque se repita', () => {
    const gherkin = swap(STEP_THEN, '    Entonces ve el mensaje "<mensaje>" para <codigo> y <codigo>');
    const findings = lintWorld(story({ body: bodyOf({ gherkin }) }));
    expect(fired(findings)).toEqual(['placeholder-columna']);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.message).toContain('<codigo>');
  });

  it('un marcador con columna no se marca y «valor < 5 y > 3» no es un marcador', () => {
    const gherkin = swap(STEP_THEN, '    Entonces ve el mensaje "<mensaje>" si el valor < 5 y > 3');
    expect(lintWorld(story({ body: bodyOf({ gherkin }) }))).toEqual([]);
  });
});

describe('regla fila-celdas', () => {
  it('marca una fila con una celda de más', () => {
    const gherkin = swap(ROW_4, '      | 4        | Credenciales incorrectas | sobra |');
    const findings = lintWorld(story({ body: bodyOf({ gherkin }) }));
    expect(fired(findings)).toEqual(['fila-celdas']);
    expect(findings[0]?.message).toContain('3 celdas');
  });

  it('marca una fila con una celda de menos', () => {
    const gherkin = swap(ROW_4, '      | 4        |');
    expect(fired(lintWorld(story({ body: bodyOf({ gherkin }) })))).toEqual(['fila-celdas']);
  });

  it('una celda vacía y un \\| escapado dentro de una celda no cambian el número de celdas', () => {
    const gherkin = swap(ROW_4, '      | 4        | Usa a \\| b |');
    expect(lintWorld(story({ body: bodyOf({ gherkin }) }))).toEqual([]);
    expect(lintWorld(story({ body: bodyOf({ gherkin: swap(ROW_4, '      | 4        |  |') }) }))).toEqual([]);
  });
});

describe('regla gherkin-ingles', () => {
  it('marca un Scenario Outline en inglés', () => {
    const findings = lintWorld(story({ body: bodyOf({ gherkin: swap(OUTLINE_HEADER, '  Scenario Outline: Intentos fallidos') }) }));
    expect(fired(findings)).toEqual(['esquema-requerido', 'gherkin-ingles']);
    expect(messagesOf(findings, 'gherkin-ingles')[0]).toContain('Scenario Outline');
  });

  it('marca un paso en inglés y lo cita una sola vez', () => {
    const gherkin = swap(STEP_GIVEN, '    Given un usuario con <intentos> intentos fallidos').map((line) => (line === STEP_THEN ? '    Then ve el mensaje' : line));
    const findings = lintWorld(story({ body: bodyOf({ gherkin }) }));
    expect(fired(findings)).toEqual(['gherkin-ingles']);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.message).toContain('Given');
    expect(findings[0]?.message).toContain('Then');
  });
});

describe('regla no-ejecutable-etiqueta', () => {
  it('marca verificacion no-ejecutable sin la etiqueta no-implementada', () => {
    expect(fired(lintWorld(story({ fm: { verificacion: 'no-ejecutable' } })))).toEqual(['no-ejecutable-etiqueta']);
  });

  it('marca la etiqueta no-implementada con una verificacion distinta de no-ejecutable', () => {
    const findings = lintWorld(story({ fm: { etiquetas: ['web', 'no-implementada'], verificacion: 'ejecutada' } }));
    expect(fired(findings)).toEqual(['no-ejecutable-etiqueta']);
  });
});

describe('regla ios-pendiente-nativo', () => {
  const ios: Partial<StoryFrontmatter> = { etiquetas: ['ios'], titulo: '[iOS] Teclado en el formulario' };

  it('marca una historia ios con verificacion ejecutada (o codigo)', () => {
    expect(fired(lintWorld(story({ fm: { ...ios, verificacion: 'ejecutada' } })))).toEqual(['ios-pendiente-nativo']);
    expect(fired(lintWorld(story({ fm: { ...ios, verificacion: 'codigo' } })))).toEqual(['ios-pendiente-nativo']);
  });

  it('acepta pendiente-nativo y, con la etiqueta no-implementada, no-ejecutable', () => {
    expect(lintWorld(story({ fm: { ...ios, verificacion: 'pendiente-nativo' } }))).toEqual([]);
    expect(lintWorld(story({ fm: { ...ios, etiquetas: ['ios', 'no-implementada'], verificacion: 'no-ejecutable' } }))).toEqual([]);
  });
});

describe('regla terminos-prohibidos', () => {
  it.each([
    ['data-testid', 'Se pulsa el elemento con data-testid login-submit.'],
    ['getByRole', 'El botón se localiza con getByRole("button").'],
    ['planted-bugs', 'El detalle está en docs/planted-bugs.md.'],
    ['defecto plantado', 'Este comportamiento es un defecto plantado del curso.'],
    ['testid', 'El testid del botón es login-submit.'],
    ['getByLabel', 'Se rellena con getByLabel("Correo").'],
    ['plantedBugs', 'Se activa con plantedBugs en la configuración.'],
    ['planted', 'El bug planted aparece al cerrar sesión.'],
    ['DATA-TESTID', 'Mayúsculas: DATA-TESTID.'],
  ])('marca %s en el cuerpo', (term, sentence) => {
    const findings = lintWorld(story({ body: bodyOf({ tail: sentence }) }));
    expect(fired(findings)).toEqual(['terminos-prohibidos']);
    expect(findings[0]?.message.toLowerCase()).toContain(term.toLowerCase());
  });

  it('también lo marca dentro del bloque gherkin', () => {
    const gherkin = swap(STEP_GIVEN, '    Dado un usuario con <intentos> intentos fallidos y getByTestId');
    expect(fired(lintWorld(story({ body: bodyOf({ gherkin }) })))).toEqual(['terminos-prohibidos']);
  });

  it('no marca palabras parecidas del español ni «data» suelto', () => {
    const tail = 'La usuaria ha plantado un árbol; los datos de la prueba están en el seed. Cada test identifica el caso.';
    expect(lintWorld(story({ body: bodyOf({ tail }) }))).toEqual([]);
  });

  it('también se aplica al cuerpo de una épica', () => {
    const findings = lintStoryFiles([epic('docs/user-stories/login/epic.md', 'EP-LOGIN', '## Resumen\nVer docs/planted-bugs.md.\n')]);
    expect(fired(findings)).toEqual(['terminos-prohibidos']);
  });

  // R8: `planted` va como subcadena (también con `_`), la frase en español admite bug/defecto/error y el título se vigila.
  it.each([
    ['PLANTED_BUGS', 'La app arrancada con `PLANTED_BUGS=false`.'],
    ['planted_bugs', 'Ver docs/planted_bugs.md.'],
    ['bug plantado', 'Es un bug plantado en el inicio de sesión.'],
    ['defectos plantados', 'Hay defectos plantados en el módulo.'],
    ['Errores plantados', 'Errores plantados del curso.'],
  ])('marca %s en el cuerpo (una sola regla)', (term, sentence) => {
    const findings = lintWorld(story({ body: bodyOf({ tail: sentence }) }));
    expect(fired(findings)).toEqual(['terminos-prohibidos']);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.message.toLowerCase()).toContain(term.toLowerCase());
  });

  it('cada familia de `planted` se informa una sola vez, sin duplicar planted-bugs, plantedBugs ni PLANTED_BUGS', () => {
    const findings = lintWorld(story({ body: bodyOf({ tail: 'docs/planted-bugs.md, plantedBugs y PLANTED_BUGS.' }) }));
    expect(findings).toHaveLength(1);
    const reported = findings[0]?.message.split(': ').at(-1)?.split(', ');
    expect(reported).toEqual(['planted-bugs', 'plantedBugs', 'PLANTED_BUGS']);
  });

  it.each([
    ['data-testid', '[Web] Ver el data-testid del botón'],
    ['PLANTED_BUGS', '[Web] Activar PLANTED_BUGS para el caso'],
    ['bug plantado', '[Web] Un bug plantado al guardar'],
  ])('marca %s solo en el título de una historia (el cuerpo está limpio)', (_term, titulo) => {
    const findings = lintWorld(story({ fm: { titulo } }));
    expect(fired(findings)).toEqual(['terminos-prohibidos']);
    expect(findings).toHaveLength(1);
  });

  it('marca un término prohibido solo en el título de una épica', () => {
    const findings = lintStoryFiles([epic('docs/user-stories/login/epic.md', 'EP-LOGIN', undefined, 'Acceso y planted-bugs')]);
    expect(fired(findings)).toEqual(['terminos-prohibidos']);
  });

  it('la palabra «plantado/plantada» sola sigue pasando, en el cuerpo y en el título', () => {
    const tail = 'El jardinero ha plantado un árbol y la semilla plantada crece; el error es del usuario.';
    expect(lintWorld(story({ body: bodyOf({ tail }) }))).toEqual([]);
    expect(lintWorld(story({ fm: { titulo: '[Web] Mostrar el árbol plantado' } }))).toEqual([]);
  });
});

describe('regla mencion-suelta', () => {
  const lintTail = (tail: string): readonly Finding[] => lintWorld(story({ body: bodyOf({ tail }) }));

  it('un correo (admin@sigpro.test) no es una mención', () => {
    expect(lintTail('escríbeme a admin@sigpro.test')).toEqual([]);
  });

  it('marca «contacta a @maria»', () => {
    const findings = lintTail('contacta a @maria');
    expect(fired(findings)).toEqual(['mencion-suelta']);
    expect(findings[0]?.message).toContain('@maria');
  });

  it('marca «ver el paso #2»', () => {
    const findings = lintTail('ver el paso #2');
    expect(fired(findings)).toEqual(['mencion-suelta']);
    expect(findings[0]?.message).toContain('#2');
  });

  it('una mención y una referencia dentro de código en línea no se marcan', () => {
    expect(lintTail('Escribe `@maria` o usa `#2`, también ``@maria``.')).toEqual([]);
  });

  it('una mención y una referencia dentro de un bloque de código no se marcan', () => {
    const fence = lines('```text', 'paso #2 para @maria', '```', '', '~~~', '#3 @juan', '~~~');
    expect(lintTail(fence)).toEqual([]);
  });

  it('el texto tras un bloque de código vuelve a vigilarse', () => {
    expect(fired(lintTail(lines('```text', '#2', '```', '', 'otra vez @maria')))).toEqual(['mencion-suelta']);
  });

  it('marca la mención al inicio de línea, entre paréntesis y una referencia al inicio', () => {
    expect(fired(lintTail('@maria revisa'))).toEqual(['mencion-suelta']);
    expect(fired(lintTail('(ver @maria)'))).toEqual(['mencion-suelta']);
    expect(fired(lintTail('#12 queda fuera'))).toEqual(['mencion-suelta']);
  });

  it('un único hallazgo por archivo cita cada mención una sola vez', () => {
    const findings = lintTail('hola @maria y @maria, ver #2 y #2');
    expect(findings).toHaveLength(1);
    expect(findings[0]?.message.match(/@maria/g)).toHaveLength(1);
    expect(findings[0]?.message.match(/#2/g)).toHaveLength(1);
  });

  it('los encabezados, los enlaces con ancla, los colores y las entidades HTML no son referencias', () => {
    const tail = lines('### Detalle', 'Ver https://example.com/guia#2 y el color #1d76db, o &#39;.');
    expect(lintTail(tail)).toEqual([]);
  });

  it('también vigila el cuerpo de una épica', () => {
    const findings = lintStoryFiles([epic('docs/user-stories/login/epic.md', 'EP-LOGIN', '## Resumen\nPregunta a @maria.\n')]);
    expect(fired(findings)).toEqual(['mencion-suelta']);
  });
});
