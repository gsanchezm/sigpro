import { describe, expect, it } from 'vitest';
import type { StoryFile } from './model';
import { parseStoryFile } from './parse';
import { markerOf, renderIssue, storyMarker } from './render';

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

/** Lee el texto con el parser real: así el test usa el mismo `StoryFile` que verá la sincronización. */
const fileOf = (path: string, text: string): StoryFile => {
  const result = parseStoryFile(path, text);
  if (!result.ok) throw new Error(`se esperaba ok, llegó: ${result.error}`);
  return result.file;
};

const MARKER = '<!-- sigpro-story-id: US-LOGIN-003 -->';
const VISIBLE_LINE = '**Id:** US-LOGIN-003 · **Épica:** EP-LOGIN';
const STATUS_CURRENT = '**Estado:** vigente — la app debe cumplirlo; si no lo cumple, es un defecto.';
const STATUS_FUTURE = '**Estado:** capacidad futura — la app todavía no la tiene; no se prueba contra la app.';

describe('storyMarker', () => {
  it('devuelve el comentario HTML con el id, con el formato exacto', () => {
    expect(storyMarker('US-LOGIN-003')).toBe(MARKER);
    expect(storyMarker('EP-LOGIN')).toBe('<!-- sigpro-story-id: EP-LOGIN -->');
  });
});

describe('renderIssue de una historia', () => {
  const story = fileOf('docs/user-stories/login/US-LOGIN-003.md', STORY_TEXT);
  const draft = renderIssue(story);

  it('copia id, tipo, título y etiquetas del front matter', () => {
    expect(draft.id).toBe('US-LOGIN-003');
    expect(draft.kind).toBe('story');
    expect(draft.title).toBe('[Web] Bloquear la cuenta tras 5 intentos fallidos');
    expect(draft.labels).toEqual(['web']);
  });

  it('enlaza con su épica', () => {
    expect(draft.epicId).toBe('EP-LOGIN');
  });

  it('el cuerpo empieza por la marca de identidad, sin nada antes', () => {
    expect(draft.body.startsWith(MARKER)).toBe(true);
  });

  it('tras la marca va la línea visible con el id y la épica', () => {
    expect(draft.body.split('\n').slice(0, 2)).toEqual([MARKER, VISIBLE_LINE]);
  });

  it('justo después de la línea visible va la línea de estado (vigente, sin no-implementada)', () => {
    expect(draft.body.split('\n').slice(0, 3)).toEqual([MARKER, VISIBLE_LINE, STATUS_CURRENT]);
  });

  it('conserva el cuerpo original entre la línea de estado y las relacionadas', () => {
    expect(draft.body).toContain(`${STATUS_CURRENT}\n\n${story.body.trimEnd()}\n\n## Relacionadas`);
  });

  it('añade la sección Relacionadas con cada id, una por línea', () => {
    expect(draft.body.endsWith('## Relacionadas\n- US-LOGIN-002')).toBe(true);
  });

  it('no publica el front matter ni la verificación', () => {
    expect(draft.body).not.toContain('---');
    expect(draft.body).not.toContain('verificacion');
    expect(draft.body).not.toContain('tipo: historia');
    expect(draft.body).not.toContain('etiquetas:');
  });

  it('solo usa saltos \\n y no acaba en salto de línea', () => {
    expect(draft.body).not.toContain('\r');
    expect(draft.body.endsWith('\n')).toBe(false);
  });

  it('es determinista: el mismo archivo da el mismo borrador', () => {
    expect(renderIssue(story)).toEqual(draft);
  });

  it('no muta el archivo de entrada', () => {
    const before = structuredClone(story);
    renderIssue(story);
    expect(story).toEqual(before);
  });

  it('la lista de etiquetas del borrador no es la misma referencia que la del front matter', () => {
    expect(draft.labels).not.toBe(story.fm.etiquetas);
  });
});

describe('renderIssue: línea de estado', () => {
  it('una historia no-implementada lleva la línea de capacidad futura y no la de vigente', () => {
    const text = STORY_TEXT.replace('etiquetas: [web]', 'etiquetas: [web, no-implementada]').replace(
      'verificacion: ejecutada',
      'verificacion: no-ejecutable',
    );
    const body = renderIssue(fileOf('a/US-LOGIN-003.md', text)).body;
    expect(body.split('\n').slice(0, 3)).toEqual([MARKER, VISIBLE_LINE, STATUS_FUTURE]);
    expect(body).not.toContain('vigente');
  });

  it('el estado depende solo de la etiqueta no-implementada, no de verificacion', () => {
    const text = STORY_TEXT.replace('verificacion: ejecutada', 'verificacion: codigo');
    expect(renderIssue(fileOf('a/US-LOGIN-003.md', text)).body).toContain(STATUS_CURRENT);
  });

  it('cada historia lleva una sola línea de estado', () => {
    const body = renderIssue(fileOf('a/US-LOGIN-003.md', STORY_TEXT)).body;
    expect(body.match(/\*\*Estado:\*\*/g)).toHaveLength(1);
  });
});

describe('renderIssue: relacionadas', () => {
  it('sin relacionadas no añade la sección', () => {
    const text = STORY_TEXT.replace('relacionadas: [US-LOGIN-002]\n', '');
    const draft = renderIssue(fileOf('a/US-LOGIN-003.md', text));
    expect(draft.body).not.toContain('## Relacionadas');
    expect(draft.body.endsWith('\n')).toBe(false);
  });

  it('con una lista vacía tampoco añade la sección', () => {
    const text = STORY_TEXT.replace('relacionadas: [US-LOGIN-002]', 'relacionadas: []');
    expect(renderIssue(fileOf('a/US-LOGIN-003.md', text)).body).not.toContain('## Relacionadas');
  });

  it('con varias relacionadas las lista todas en el orden del archivo', () => {
    const text = STORY_TEXT.replace('relacionadas: [US-LOGIN-002]', 'relacionadas: [US-LOGIN-002, US-LOGIN-001]');
    const draft = renderIssue(fileOf('a/US-LOGIN-003.md', text));
    expect(draft.body.endsWith('## Relacionadas\n- US-LOGIN-002\n- US-LOGIN-001')).toBe(true);
  });
});

describe('renderIssue de una épica', () => {
  const epic = fileOf('docs/user-stories/login/epic.md', EPIC_TEXT);
  const draft = renderIssue(epic);

  it('no tiene épica padre y se marca como épica', () => {
    expect(draft.epicId).toBeNull();
    expect(draft.kind).toBe('epic');
  });

  it('copia id, título y etiquetas', () => {
    expect(draft.id).toBe('EP-LOGIN');
    expect(draft.title).toBe('Acceso y sesión');
    expect(draft.labels).toEqual(['epic']);
  });

  it('la línea visible lleva el id y no menciona la épica', () => {
    expect(draft.body.split('\n').slice(0, 2)).toEqual(['<!-- sigpro-story-id: EP-LOGIN -->', '**Id:** EP-LOGIN']);
    expect(draft.body).not.toContain('Épica');
  });

  it('una épica no lleva línea de estado', () => {
    expect(draft.body).not.toContain('**Estado:**');
  });

  it('conserva el cuerpo y no añade Relacionadas', () => {
    expect(draft.body).toContain('## Resumen\nTodo lo relativo a entrar en la aplicación.');
    expect(draft.body).not.toContain('## Relacionadas');
    expect(draft.body).not.toContain('---');
  });

  it('una épica sin cuerpo da solo la marca y la línea visible', () => {
    const bare = fileOf('a/epic.md', '---\nid: EP-LOGIN\ntipo: epica\ntitulo: Acceso\netiquetas: [epic]\n---\n');
    expect(renderIssue(bare).body).toBe('<!-- sigpro-story-id: EP-LOGIN -->\n**Id:** EP-LOGIN');
  });
});

describe('renderIssue con archivos de Windows', () => {
  it('un archivo con BOM y CRLF da el mismo borrador que con LF', () => {
    const windows = `${String.fromCharCode(0xfeff)}${STORY_TEXT.replace(/\n/g, '\r\n')}`;
    const draft = renderIssue(fileOf('a/US-LOGIN-003.md', windows));
    expect(draft).toEqual(renderIssue(fileOf('a/US-LOGIN-003.md', STORY_TEXT)));
    expect(draft.body).not.toContain('\r');
  });

  it('aunque el cuerpo llegue con CRLF y blancos al final, el borrador usa solo \\n', () => {
    const story = fileOf('a/US-LOGIN-003.md', STORY_TEXT);
    const crlf: StoryFile = { ...story, body: `${story.body.replace(/\n/g, '\r\n')}\r\n\r\n` };
    expect(renderIssue(crlf)).toEqual(renderIssue(story));
  });
});

describe('markerOf', () => {
  it('lee de vuelta el id del cuerpo renderizado de una historia y de una épica', () => {
    const story = renderIssue(fileOf('a/US-LOGIN-003.md', STORY_TEXT));
    const epic = renderIssue(fileOf('a/epic.md', EPIC_TEXT));
    expect(markerOf(story.body)).toBe('US-LOGIN-003');
    expect(markerOf(epic.body)).toBe('EP-LOGIN');
  });

  it('es la inversa de storyMarker', () => {
    expect(markerOf(storyMarker('US-API-AUTH-012'))).toBe('US-API-AUTH-012');
  });

  it('devuelve null si el cuerpo no tiene marca', () => {
    expect(markerOf('sin marca')).toBeNull();
    expect(markerOf('')).toBeNull();
  });

  it('devuelve null con una marca mal formada o con un id vacío', () => {
    expect(markerOf('<!-- sigpro-story-id: -->')).toBeNull();
    expect(markerOf('<!-- sigpro-story-id: US-LOGIN-003')).toBeNull();
    expect(markerOf('<!-- otra-marca: US-LOGIN-003 -->')).toBeNull();
  });

  it('encuentra la marca aunque GitHub devuelva el cuerpo con saltos CRLF', () => {
    const body = renderIssue(fileOf('a/US-LOGIN-003.md', STORY_TEXT)).body.replace(/\n/g, '\r\n');
    expect(markerOf(body)).toBe('US-LOGIN-003');
  });

  it('con varias marcas manda la primera (la que escribe la sincronización)', () => {
    const body = `${storyMarker('US-LOGIN-003')}\n\nTexto con otra marca: ${storyMarker('US-OTRA-001')}`;
    expect(markerOf(body)).toBe('US-LOGIN-003');
  });
});
