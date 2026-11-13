import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { loadStoryFiles, parseStoryFile, type ParseResult } from './parse';

// Archivo de ejemplo de la spec (US-LOGIN-003), con saltos LF.
const STORY_TEXT = `---
id: US-LOGIN-003
tipo: historia            # historia | epica
epica: EP-LOGIN
titulo: "[Web] Bloquear la cuenta tras 5 intentos fallidos"
etiquetas: [web]
relacionadas: [US-LOGIN-002]
verificacion: ejecutada   # ejecutada | codigo | pendiente-nativo | no-ejecutable
---

## Historia
Como usuario con cuenta activa, quiero ver un aviso claro cuando mi cuenta se bloquea,
para saber que debo esperar o pedir ayuda y no seguir intentando.

## Reglas
- La cuenta se bloquea al quinto intento fallido.

## Criterios de aceptación
\`\`\`gherkin
Característica: Bloqueo de cuenta tras intentos fallidos

  Esquema del escenario: Intentos fallidos
    Dado un usuario con <intentos> intentos fallidos
    Cuando intenta iniciar sesión con una contraseña incorrecta
    Entonces ve el mensaje "<mensaje>"

    Ejemplos:
      | intentos | mensaje                   |
      | 3        | Credenciales incorrectas  |
      | 4        | Credenciales incorrectas  |
      | 5        | Cuenta bloqueada          |
\`\`\`
`;

const EPIC_TEXT = `---
id: EP-LOGIN
tipo: epica
titulo: Acceso y sesión
etiquetas: [epic]
---

## Resumen
Todo lo relativo a entrar en la aplicación.
`;

// Marca de orden de bytes (U+FEFF), escrita como código para no meter el carácter invisible en el fuente.
const BOM = String.fromCharCode(0xfeff);

/** El texto tal como lo guarda un editor de Windows: BOM al inicio y saltos CRLF. */
const asWindows = (text: string): string => `${BOM}${text.replace(/\n/g, '\r\n')}`;

/** Aserción de tipo: falla el test si el resultado no es correcto y deja `file` tipado. */
const expectOk = (result: ParseResult): Extract<ParseResult, { ok: true }>['file'] => {
  if (!result.ok) throw new Error(`se esperaba ok, llegó: ${result.error}`);
  return result.file;
};

const expectFail = (result: ParseResult): Extract<ParseResult, { ok: false }> => {
  if (result.ok) throw new Error('se esperaba un fallo');
  return result;
};

describe('parseStoryFile', () => {
  it('lee el archivo de ejemplo de la spec como historia', () => {
    const file = expectOk(parseStoryFile('a/US-LOGIN-003.md', STORY_TEXT));
    expect(file.kind).toBe('story');
    expect(file.path).toBe('a/US-LOGIN-003.md');
    expect(file.fm).toMatchObject({ id: 'US-LOGIN-003', epica: 'EP-LOGIN', etiquetas: ['web'] });
    expect(file.body.startsWith('## Historia')).toBe(true);
    expect(file.body).toContain('Cuenta bloqueada');
  });

  it('con BOM y saltos CRLF da el mismo fm y el mismo body que con LF', () => {
    const plain = expectOk(parseStoryFile('a/US-LOGIN-003.md', STORY_TEXT));
    const windows = expectOk(parseStoryFile('a/US-LOGIN-003.md', asWindows(STORY_TEXT)));
    expect(windows.fm).toEqual(plain.fm);
    expect(windows.body).toBe(plain.body);
    expect(windows.body).not.toContain('\r');
  });

  it('con BOM y CRLF también lee una épica', () => {
    const file = expectOk(parseStoryFile('a/epic.md', asWindows(EPIC_TEXT)));
    expect(file.kind).toBe('epic');
    expect(file.body.startsWith('## Resumen')).toBe(true);
  });

  it('con BOM y LF (editores que solo añaden el BOM) también funciona', () => {
    const file = expectOk(parseStoryFile('a/US-LOGIN-003.md', `${BOM}${STORY_TEXT}`));
    expect(file.kind).toBe('story');
  });

  it('lee una épica (tipo: epica) como kind epic', () => {
    const file = expectOk(parseStoryFile('a/epic.md', EPIC_TEXT));
    expect(file.kind).toBe('epic');
    expect(file.fm).toMatchObject({ id: 'EP-LOGIN', etiquetas: ['epic'] });
    expect(file.body.startsWith('## Resumen')).toBe(true);
  });

  it('un --- dentro del cuerpo no recorta el cuerpo', () => {
    const text = `${EPIC_TEXT}\n---\n\nOtra sección tras una regla horizontal.\n`;
    const file = expectOk(parseStoryFile('a/epic.md', text));
    expect(file.body).toContain('\n---\n');
    expect(file.body).toContain('Otra sección tras una regla horizontal.');
  });

  it('acepta front matter sin cuerpo ni salto final', () => {
    const text = '---\nid: EP-LOGIN\ntipo: epica\ntitulo: Acceso\netiquetas: [epic]\n---';
    const file = expectOk(parseStoryFile('a/epic.md', text));
    expect(file.body).toBe('');
  });

  it('sin front matter devuelve ok: false con la ruta y un error que lo menciona', () => {
    const result = expectFail(parseStoryFile('a/US-X-001.md', '## Historia\nSolo cuerpo.\n'));
    expect(result.path).toBe('a/US-X-001.md');
    expect(result.error).toContain('front matter');
  });

  it('un front matter sin cerrar cuenta como sin front matter', () => {
    const result = expectFail(parseStoryFile('a/US-X-001.md', '---\nid: US-X-001\n\n## Historia\n'));
    expect(result.error).toContain('front matter');
  });

  it('un front matter vacío falla con un error legible', () => {
    const result = expectFail(parseStoryFile('a/US-X-001.md', '---\n---\n## Historia\n'));
    expect(result.error).toContain('front matter');
  });

  it('un front matter vacío no se traga una regla horizontal posterior del cuerpo', () => {
    const result = expectFail(parseStoryFile('a/US-X-001.md', '---\n---\n## Historia\nTexto\n\n---\n\nMás texto\n'));
    expect(result.error).toContain('vacío');
  });

  it('un par de --- que no está al principio del archivo no es front matter', () => {
    const result = expectFail(parseStoryFile('a/US-X-001.md', 'Preámbulo\n---\nid: US-X-001\ntipo: historia\n---\n'));
    expect(result.error).toContain('front matter');
  });

  it('YAML inválido devuelve ok: false', () => {
    const result = expectFail(parseStoryFile('a/US-X-001.md', '---\nid: [sin cerrar\ntipo: historia\n---\n## Historia\n'));
    expect(result.path).toBe('a/US-X-001.md');
    expect(result.error).toContain('YAML');
  });

  it('claves duplicadas en el YAML devuelven ok: false', () => {
    const result = expectFail(parseStoryFile('a/epic.md', '---\nid: EP-A\nid: EP-B\ntipo: epica\n---\n'));
    expect(result.error).toContain('YAML');
  });

  it('un front matter que no es un mapa devuelve ok: false', () => {
    const result = expectFail(parseStoryFile('a/epic.md', '---\n- uno\n- dos\n---\n'));
    expect(result.error).toContain('front matter');
  });

  it('sin el campo tipo devuelve ok: false y lo nombra', () => {
    const result = expectFail(parseStoryFile('a/epic.md', '---\nid: EP-LOGIN\ntitulo: Acceso\netiquetas: [epic]\n---\n'));
    expect(result.error).toContain('tipo');
  });

  it('un tipo desconocido devuelve ok: false y lo cita', () => {
    const result = expectFail(parseStoryFile('a/epic.md', '---\nid: EP-LOGIN\ntipo: tarea\ntitulo: Acceso\netiquetas: [epic]\n---\n'));
    expect(result.error).toContain('tipo');
    expect(result.error).toContain('tarea');
  });

  it('un campo inválido se reporta con su ruta', () => {
    const text = STORY_TEXT.replace('verificacion: ejecutada', 'verificacion: quizas');
    const result = expectFail(parseStoryFile('a/US-LOGIN-003.md', text));
    expect(result.error).toContain('verificacion');
  });

  it('una clave desconocida (esquema estricto) se reporta con su nombre', () => {
    const text = STORY_TEXT.replace('verificacion: ejecutada', 'verificacion: ejecutada\nprioridad: alta');
    const result = expectFail(parseStoryFile('a/US-LOGIN-003.md', text));
    expect(result.error).toContain('prioridad');
  });

  it('un campo anidado inválido incluye el índice en la ruta', () => {
    const text = STORY_TEXT.replace('etiquetas: [web]', 'etiquetas: [web, 7]');
    const result = expectFail(parseStoryFile('a/US-LOGIN-003.md', text));
    expect(result.error).toContain('etiquetas.1');
  });

  it('junta varios errores en un solo texto', () => {
    const text = STORY_TEXT.replace('verificacion: ejecutada', 'verificacion: quizas').replace('epica: EP-LOGIN', 'epica: login');
    const result = expectFail(parseStoryFile('a/US-LOGIN-003.md', text));
    expect(result.error).toContain('verificacion');
    expect(result.error).toContain('epica');
  });
});

describe('loadStoryFiles', () => {
  let root: string;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'sigpro-stories-'));
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it('carga solo epic.md y US-*.md, ignorando el resto', async () => {
    await mkdir(join(root, 'a'));
    await writeFile(join(root, 'a', 'epic.md'), EPIC_TEXT);
    await writeFile(join(root, 'a', 'US-A-001.md'), STORY_TEXT);
    await writeFile(join(root, 'a', 'README.md'), '# Léeme\n');
    const results = await loadStoryFiles(root);
    expect(results).toHaveLength(2);
    expect(results.every((result) => result.ok)).toBe(true);
  });

  it('devuelve [] si el directorio no existe', async () => {
    expect(await loadStoryFiles(join(root, 'no-existe'))).toEqual([]);
  });

  it('recorre subcarpetas y devuelve los resultados ordenados por ruta', async () => {
    await mkdir(join(root, 'b'));
    await mkdir(join(root, 'a', 'sub'), { recursive: true });
    await writeFile(join(root, 'b', 'epic.md'), EPIC_TEXT);
    await writeFile(join(root, 'a', 'sub', 'US-A-002.md'), STORY_TEXT);
    await writeFile(join(root, 'a', 'US-A-001.md'), STORY_TEXT);
    const results = await loadStoryFiles(root);
    const paths = results.map((result) => (result.ok ? result.file.path : result.path));
    expect(paths).toEqual([...paths].sort());
    expect(paths).toHaveLength(3);
  });

  it('las rutas usan / como separador y cuelgan de la raíz', async () => {
    await mkdir(join(root, 'a'));
    await writeFile(join(root, 'a', 'epic.md'), EPIC_TEXT);
    const [result] = await loadStoryFiles(root);
    const path = result?.ok ? result.file.path : result?.path;
    expect(path).toBeDefined();
    expect(path).not.toContain('\\');
    expect(path?.endsWith('/a/epic.md')).toBe(true);
  });

  it('un archivo inválido no aborta la carga: llega como ok: false', async () => {
    await mkdir(join(root, 'a'));
    await writeFile(join(root, 'a', 'epic.md'), EPIC_TEXT);
    await writeFile(join(root, 'a', 'US-A-001.md'), 'sin front matter\n');
    const results = await loadStoryFiles(root);
    expect(results).toHaveLength(2);
    expect(results.filter((result) => !result.ok)).toHaveLength(1);
  });

  it('lee archivos con BOM y CRLF tal como los guarda Windows', async () => {
    await mkdir(join(root, 'a'));
    await writeFile(join(root, 'a', 'US-LOGIN-003.md'), asWindows(STORY_TEXT), 'utf8');
    const [result] = await loadStoryFiles(root);
    expect(result?.ok).toBe(true);
  });
});
