import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { formatFinding, parseCliArgs, runCommand, runLint } from './cli';

describe('parseCliArgs', () => {
  it('reconoce los tres comandos', () => {
    expect(parseCliArgs(['lint']).command).toBe('lint');
    expect(parseCliArgs(['coverage']).command).toBe('coverage');
    expect(parseCliArgs(['sync']).command).toBe('sync');
  });

  it('sin comando o con uno desconocido devuelve command null', () => {
    expect(parseCliArgs([]).command).toBeNull();
    expect(parseCliArgs(['otro']).command).toBeNull();
    expect(parseCliArgs(['--apply']).command).toBeNull();
  });

  it('las banderas son false por defecto', () => {
    expect(parseCliArgs(['lint'])).toEqual({ command: 'lint', apply: false, write: false, check: false });
    expect(parseCliArgs(['sync']).apply).toBe(false);
  });

  it('--apply, --write y --check activan cada bandera', () => {
    expect(parseCliArgs(['sync', '--apply']).apply).toBe(true);
    expect(parseCliArgs(['coverage', '--write']).write).toBe(true);
    expect(parseCliArgs(['coverage', '--check']).check).toBe(true);
  });

  it('ignora un -- suelto: así lo reenvía `pnpm stories:sync -- --apply`', () => {
    expect(parseCliArgs(['sync', '--', '--apply'])).toEqual({ command: 'sync', apply: true, write: false, check: false });
    expect(parseCliArgs(['--', 'lint']).command).toBe('lint');
  });

  it('una opción desconocida no lanza ni cambia el comando', () => {
    expect(parseCliArgs(['lint', '--desconocida'])).toEqual({ command: 'lint', apply: false, write: false, check: false });
  });
});

describe('formatFinding', () => {
  it('imprime «ruta: [regla] mensaje» con la ruta relativa a la raíz y con barras', () => {
    const finding = { path: 'C:/repo/docs/user-stories/login/US-LOGIN-003.md', id: 'US-LOGIN-003', rule: 'prefijo-titulo', message: 'falta el prefijo [Web]' };
    expect(formatFinding(finding, 'C:/repo')).toBe('docs/user-stories/login/US-LOGIN-003.md: [prefijo-titulo] falta el prefijo [Web]');
  });
});

const STORY_OK = `---
id: US-LOGIN-003
tipo: historia
epica: EP-LOGIN
titulo: "[Web] Bloquear la cuenta tras 5 intentos fallidos"
etiquetas: [web]
verificacion: ejecutada
---

## Historia
Como usuario con cuenta activa, quiero ver un aviso claro cuando mi cuenta se bloquea,
para saber que debo esperar o pedir ayuda y no seguir intentando.

## Criterios de aceptación
\`\`\`gherkin
Característica: Bloqueo de cuenta tras intentos fallidos

  Esquema del escenario: Intentos fallidos
    Dado un usuario con <intentos> intentos fallidos
    Entonces ve el mensaje "<mensaje>"

    Ejemplos:
      | intentos | mensaje                  |
      | 4        | Credenciales incorrectas |
      | 5        | Cuenta bloqueada         |
\`\`\`
`;

const EPIC_OK = `---
id: EP-LOGIN
tipo: epica
titulo: Acceso y sesión
etiquetas: [epic]
---

## Resumen
Todo lo relativo a entrar en la aplicación.
`;

/** Una línea de hallazgo: `ruta: [regla] mensaje`. */
const FINDING_LINE = /: \[[a-z-]+\] /;

describe('runLint', () => {
  let root = '';

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'stories-cli-'));
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  const write = async (relative: string, text: string): Promise<void> => {
    const path = join(root, relative);
    await mkdir(join(path, '..'), { recursive: true });
    await writeFile(path, text, 'utf8');
  };

  it('sin carpeta docs/user-stories no hay hallazgos y el código es 0', async () => {
    const result = await runLint(root);
    expect(result.code).toBe(0);
  });

  it('con historias correctas el código es 0', async () => {
    await write('docs/user-stories/login/epic.md', EPIC_OK);
    await write('docs/user-stories/login/US-LOGIN-003.md', STORY_OK);
    const result = await runLint(root);
    expect(result.stdout.filter((line) => FINDING_LINE.test(line))).toEqual([]);
    expect(result.code).toBe(0);
  });

  it('con un hallazgo imprime «ruta: [regla] mensaje» y el código es 1', async () => {
    await write('docs/user-stories/login/epic.md', EPIC_OK);
    await write('docs/user-stories/login/US-LOGIN-009.md', STORY_OK);
    const result = await runLint(root);
    expect(result.code).toBe(1);
    expect(result.stdout.some((line) => line.startsWith('docs/user-stories/login/US-LOGIN-009.md: [archivo-id] '))).toBe(true);
  });

  it('un archivo con front matter roto sale como hallazgo frontmatter', async () => {
    await write('docs/user-stories/login/US-LOGIN-001.md', 'sin front matter\n');
    const result = await runLint(root);
    expect(result.code).toBe(1);
    expect(result.stdout.some((line) => line.includes(': [frontmatter] '))).toBe(true);
  });
});

describe('runCommand', () => {
  it('coverage y sync todavía no están implementados: avisan por stderr y salen con 1', async () => {
    const args = { apply: false, write: false, check: false } as const;
    for (const command of ['coverage', 'sync'] as const) {
      const result = await runCommand({ ...args, command }, tmpdir());
      expect(result.code).toBe(1);
      expect(result.stderr.join('\n')).toContain('no implementado');
    }
  });

  it('sin comando imprime el uso por stderr y sale con 2', async () => {
    const result = await runCommand({ command: null, apply: false, write: false, check: false }, tmpdir());
    expect(result.code).toBe(2);
    expect(result.stderr.join('\n')).toContain('lint');
  });
});
