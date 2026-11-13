import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { formatFinding, parseCliArgs, runCommand, runCoverage, runLint, runSync } from './cli';
import type { Gh, RemoteIssue } from './sync';

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

/** `Gh` falso: anota lecturas y escrituras por separado. Nada de esto llega a GitHub. */
const fakeGh = (existing: readonly RemoteIssue[] = [], remoteLabels: readonly string[] = []): { gh: Gh; reads: string[]; writes: string[] } => {
  const reads: string[] = [];
  const writes: string[] = [];
  const gh: Gh = {
    me: async () => {
      reads.push('me');
      return 'gsanchezm';
    },
    listIssues: async () => {
      reads.push('listIssues');
      return existing;
    },
    listLabels: async () => {
      reads.push('listLabels');
      return remoteLabels;
    },
    createLabel: async (label) => void writes.push(`createLabel ${label.name}`),
    createIssue: async (draft) => {
      writes.push(`createIssue ${draft.id}`);
      return { nodeId: `node-${draft.id}`, number: writes.length };
    },
    updateIssue: async (number, draft) => void writes.push(`updateIssue ${number} ${draft.id}`),
    addSubIssue: async (parent, child) => void writes.push(`addSubIssue ${parent} ${child}`),
  };
  return { gh, reads, writes };
};

const SYNC_ARGS = { command: 'sync', apply: false, write: false, check: false } as const;

describe('runSync', () => {
  let root = '';

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'stories-sync-'));
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  const write = async (relative: string, text: string): Promise<void> => {
    const path = join(root, relative);
    await mkdir(join(path, '..'), { recursive: true });
    await writeFile(path, text, 'utf8');
  };

  const writeValid = async (): Promise<void> => {
    await write('docs/user-stories/login/epic.md', EPIC_OK);
    await write('docs/user-stories/login/US-LOGIN-003.md', STORY_OK);
  };

  it('sin historias y sin issues remotos imprime «0 issues remotos» y un plan de 8 etiquetas, sin escribir', async () => {
    const { gh, reads, writes } = fakeGh();
    const result = await runSync(SYNC_ARGS, root, gh);
    expect(result.code).toBe(0);
    const out = result.stdout.join('\n');
    expect(out).toContain('0 issues remotos');
    expect(out).toContain('createLabel: 8, createIssue: 0, updateIssue: 0, linkSubIssue: 0');
    expect(result.stdout.filter((line) => line.includes('crear etiqueta'))).toHaveLength(8);
    expect(out).toContain('En seco');
    expect(reads.sort()).toEqual(['listIssues', 'listLabels', 'me']);
    expect(writes).toEqual([]);
  });

  it('con una épica y una historia el plan lista crear los dos issues y enlazarlos, y no escribe nada', async () => {
    await writeValid();
    const { gh, writes } = fakeGh([], ['epic', 'api', 'web', 'movil', 'ios', 'android', 'transversal', 'no-implementada']);
    const result = await runSync(SYNC_ARGS, root, gh);
    expect(result.code).toBe(0);
    const out = result.stdout.join('\n');
    expect(out).toContain('createLabel: 0, createIssue: 2, updateIssue: 0, linkSubIssue: 1');
    expect(out).toContain('crear issue EP-LOGIN: Acceso y sesión');
    expect(out).toContain('crear issue US-LOGIN-003: [Web] Bloquear la cuenta tras 5 intentos fallidos');
    expect(out).toContain('enlazar US-LOGIN-003 como sub-issue de EP-LOGIN');
    expect(writes).toEqual([]);
  });

  it('si todo está al día dice que no hay nada que sincronizar', async () => {
    const { gh } = fakeGh([], ['epic', 'api', 'web', 'movil', 'ios', 'android', 'transversal', 'no-implementada']);
    const result = await runSync(SYNC_ARGS, root, gh);
    expect(result.code).toBe(0);
    expect(result.stdout.join('\n')).toContain('Nada que sincronizar');
  });

  it('si el linter da hallazgos aborta con código 1 sin hablar con GitHub (ni siquiera leer)', async () => {
    await write('docs/user-stories/login/epic.md', EPIC_OK);
    await write('docs/user-stories/login/US-LOGIN-009.md', STORY_OK);
    const { gh, reads, writes } = fakeGh();
    const result = await runSync({ ...SYNC_ARGS, apply: true }, root, gh, { delayMs: 0 });
    expect(result.code).toBe(1);
    expect(result.stdout.some((line) => line.includes(': [archivo-id] '))).toBe(true);
    expect(result.stderr.join('\n')).toContain('abortado');
    expect(reads).toEqual([]);
    expect(writes).toEqual([]);
  });

  it('con --apply ejecuta el plan en orden y lo cuenta en el informe', async () => {
    await writeValid();
    const { gh, writes } = fakeGh([], ['epic', 'api', 'web', 'movil', 'ios', 'android', 'transversal', 'no-implementada']);
    const result = await runSync({ ...SYNC_ARGS, apply: true }, root, gh, { delayMs: 0 });
    expect(result.code).toBe(0);
    expect(writes).toEqual(['createIssue EP-LOGIN', 'createIssue US-LOGIN-003', 'addSubIssue node-EP-LOGIN node-US-LOGIN-003']);
    expect(result.stdout.join('\n')).toContain('3 de 3 operaciones');
  });

  it('con --apply, si una operación falla, se detiene, sale con 1 y dice cuál y por qué', async () => {
    await writeValid();
    const { gh, writes } = fakeGh([], ['epic', 'api', 'web', 'movil', 'ios', 'android', 'transversal', 'no-implementada']);
    const failing: Gh = { ...gh, createIssue: async () => Promise.reject(new Error('Validation Failed (HTTP 422)')) };
    const result = await runSync({ ...SYNC_ARGS, apply: true }, root, failing, { delayMs: 0 });
    expect(result.code).toBe(1);
    const err = result.stderr.join('\n');
    expect(err).toContain('crear issue EP-LOGIN');
    expect(err).toContain('Validation Failed (HTTP 422)');
    expect(err).toContain('0 de 3');
    expect(writes).toEqual([]);
  });

  it('con --apply y nada que hacer no escribe', async () => {
    const { gh, writes } = fakeGh([], ['epic', 'api', 'web', 'movil', 'ios', 'android', 'transversal', 'no-implementada']);
    const result = await runSync({ ...SYNC_ARGS, apply: true }, root, gh, { delayMs: 0 });
    expect(result.code).toBe(0);
    expect(writes).toEqual([]);
  });
});

const COVERAGE_ARGS = { command: 'coverage', apply: false, write: false, check: false } as const;

/** Controlador, `App.tsx` y árbol móvil mínimos: 1 endpoint, 2 rutas web y 2 móviles (la raíz y el `_layout` no cuentan). */
const MINI_REPO: Readonly<Record<string, string>> = {
  'apps/api/src/audit/audit.controller.ts': `@Controller('audit')\nexport class AuditController {\n  @Get()\n  list() {}\n}\n`,
  'apps/web/src/App.tsx': `<Routes>\n  <Route path="/" element={<Navigate to="/login" />} />\n  <Route path="/login" element={<LoginPage />} />\n  <Route path="/programs" element={<ProgramsPage />} />\n</Routes>\n`,
  'apps/mobile/app/_layout.tsx': 'export default function Layout() {}\n',
  'apps/mobile/app/index.tsx': 'export default function Index() {}\n',
  'apps/mobile/app/login.tsx': 'export default function Login() {}\n',
  'apps/mobile/app/(app)/programs/index.tsx': 'export default function Programs() {}\n',
};

const storyMd = (id: string, label: string, extra: string): string =>
  `---\nid: ${id}\ntipo: historia\nepica: EP-AUDIT\ntitulo: "[Web] Historia ${id}"\netiquetas: [${label}]\nverificacion: ejecutada\n${extra}---\n\n## Historia\nTexto.\n`;

/** Historias que cubren todo lo de `MINI_REPO` más el permiso `audit.view`. */
const FULL_STORIES: Readonly<Record<string, string>> = {
  'docs/user-stories/audit/US-AUDIT-001.md': storyMd('US-AUDIT-001', 'api', 'cubre: ["GET /api/audit"]\npermisos: [audit.view]\n'),
  'docs/user-stories/audit/US-AUDIT-002.md': storyMd('US-AUDIT-002', 'web', 'cubre: ["/login", "/programs"]\n'),
  'docs/user-stories/audit/US-AUDIT-003.md': storyMd('US-AUDIT-003', 'ios', 'cubre: ["/login", "/programs"]\n'),
};

describe('runCoverage', () => {
  let root = '';
  const PERMISSIONS = ['audit.view'];
  const COBERTURA = (): string => join(root, 'docs/user-stories/COBERTURA.md');

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'stories-coverage-'));
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  const writeAll = async (files: Readonly<Record<string, string>>): Promise<void> => {
    await Promise.all(
      Object.entries(files).map(async ([relative, text]) => {
        const path = join(root, relative);
        await mkdir(join(path, '..'), { recursive: true });
        await writeFile(path, text, 'utf8');
      }),
    );
  };

  const exists = (path: string): Promise<boolean> => readFile(path, 'utf8').then(() => true, () => false);

  it('sin historias y sin banderas imprime todos los huecos con su tipo, el resumen por tipo, sale con 0 y no escribe nada', async () => {
    await writeAll(MINI_REPO);
    const result = await runCoverage(COVERAGE_ARGS, root, PERMISSIONS);
    expect(result.code).toBe(0);
    expect(result.stdout).toEqual([
      'endpoint: GET /api/audit',
      'ruta web: /login',
      'ruta web: /programs',
      // El árbol móvil va en orden de ruta de archivo: «(app)/…» antes que «login.tsx».
      'ruta móvil: /programs',
      'ruta móvil: /login',
      'permiso: audit.view',
      'stories coverage: 6 huecos (endpoints 1 de 1, rutas web 2 de 2, rutas móviles 2 de 2, permisos 1 de 1)',
    ]);
    expect(await exists(COBERTURA())).toBe(false);
  });

  it('con todo cubierto no imprime huecos y sale con 0', async () => {
    await writeAll({ ...MINI_REPO, ...FULL_STORIES });
    const result = await runCoverage(COVERAGE_ARGS, root, PERMISSIONS);
    expect(result.code).toBe(0);
    expect(result.stdout).toEqual(['stories coverage: 0 huecos (endpoints 0 de 1, rutas web 0 de 2, rutas móviles 0 de 2, permisos 0 de 1)']);
  });

  it('con --write crea docs/user-stories si no existe, escribe COBERTURA.md y sale con 0 aunque haya huecos', async () => {
    await writeAll(MINI_REPO);
    const result = await runCoverage({ ...COVERAGE_ARGS, write: true }, root, PERMISSIONS);
    expect(result.code).toBe(0);
    expect(result.stdout.join('\n')).toContain('docs/user-stories/COBERTURA.md');
    const text = await readFile(COBERTURA(), 'utf8');
    expect(text).toContain('| `GET /api/audit` | — |');
    expect(text).toContain('## Rutas móviles (0 de 2 cubiertas)');
  });

  it('con --write y todo cubierto el archivo lista las historias de cada elemento', async () => {
    await writeAll({ ...MINI_REPO, ...FULL_STORIES });
    await runCoverage({ ...COVERAGE_ARGS, write: true }, root, PERMISSIONS);
    const text = await readFile(COBERTURA(), 'utf8');
    expect(text).toContain('| `GET /api/audit` | US-AUDIT-001 |');
    expect(text).toContain('| `/login` | US-AUDIT-002 |');
    expect(text).toContain('| `/programs` | US-AUDIT-003 |');
    expect(text).toContain('| `audit.view` | US-AUDIT-001 |');
  });

  it('--check con huecos sale con 1 aunque el archivo esté al día', async () => {
    await writeAll(MINI_REPO);
    await runCoverage({ ...COVERAGE_ARGS, write: true }, root, PERMISSIONS);
    const result = await runCoverage({ ...COVERAGE_ARGS, check: true }, root, PERMISSIONS);
    expect(result.code).toBe(1);
    expect(result.stdout).toContain('endpoint: GET /api/audit');
    expect(result.stderr.join('\n')).toContain('huecos sin historia');
  });

  it('--check sin huecos pero sin COBERTURA.md sale con 1 y dice que no existe', async () => {
    await writeAll({ ...MINI_REPO, ...FULL_STORIES });
    const result = await runCoverage({ ...COVERAGE_ARGS, check: true }, root, PERMISSIONS);
    expect(result.code).toBe(1);
    expect(result.stderr.join('\n')).toContain('COBERTURA.md no existe');
    expect(result.stderr.join('\n')).toContain('--write');
  });

  it('--check sin huecos y con el archivo al día sale con 0', async () => {
    await writeAll({ ...MINI_REPO, ...FULL_STORIES });
    await runCoverage({ ...COVERAGE_ARGS, write: true }, root, PERMISSIONS);
    const result = await runCoverage({ ...COVERAGE_ARGS, check: true }, root, PERMISSIONS);
    expect(result.code).toBe(0);
    expect(result.stderr).toEqual([]);
  });

  it('--check sale con 1 si el archivo quedó desactualizado', async () => {
    await writeAll({ ...MINI_REPO, ...FULL_STORIES });
    await runCoverage({ ...COVERAGE_ARGS, write: true }, root, PERMISSIONS);
    await writeAll({ 'docs/user-stories/audit/US-AUDIT-004.md': storyMd('US-AUDIT-004', 'api', 'cubre: ["GET /api/audit"]\n') });
    const result = await runCoverage({ ...COVERAGE_ARGS, check: true }, root, PERMISSIONS);
    expect(result.code).toBe(1);
    expect(result.stderr.join('\n')).toContain('desactualizado');
  });

  it('--check no se deja engañar por los saltos CRLF que un editor de Windows pudo dejar en el archivo', async () => {
    await writeAll({ ...MINI_REPO, ...FULL_STORIES });
    await runCoverage({ ...COVERAGE_ARGS, write: true }, root, PERMISSIONS);
    await writeFile(COBERTURA(), (await readFile(COBERTURA(), 'utf8')).replace(/\n/g, '\r\n'), 'utf8');
    const result = await runCoverage({ ...COVERAGE_ARGS, check: true }, root, PERMISSIONS);
    expect(result.code).toBe(0);
  });

  it('--check sin escribir no crea el archivo', async () => {
    await writeAll({ ...MINI_REPO, ...FULL_STORIES });
    await runCoverage({ ...COVERAGE_ARGS, check: true }, root, PERMISSIONS);
    expect(await exists(COBERTURA())).toBe(false);
  });

  it('un archivo de historia ilegible aborta con 1 sin escribir: con datos a medias la matriz engañaría', async () => {
    await writeAll({ ...MINI_REPO, 'docs/user-stories/audit/US-AUDIT-001.md': 'sin front matter\n' });
    const result = await runCoverage({ ...COVERAGE_ARGS, write: true }, root, PERMISSIONS);
    expect(result.code).toBe(1);
    expect(result.stdout.some((line) => line.startsWith('docs/user-stories/audit/US-AUDIT-001.md: [frontmatter] '))).toBe(true);
    expect(result.stderr.join('\n')).toContain('stories:lint');
    expect(await exists(COBERTURA())).toBe(false);
  });

  it('una fuente vacía es un error y no un «cero huecos»: sin controladores', async () => {
    const { 'apps/api/src/audit/audit.controller.ts': _controller, ...withoutController } = MINI_REPO;
    await writeAll({ ...withoutController, 'apps/api/src/audit/audit.service.ts': 'export class AuditService {}\n' });
    const result = await runCoverage(COVERAGE_ARGS, root, PERMISSIONS);
    expect(result.code).toBe(1);
    expect(result.stderr.join('\n')).toContain('controladores');
  });

  it('una fuente vacía es un error: App.tsx sin rutas, árbol móvil sin pantallas y lista de permisos vacía', async () => {
    await writeAll({ ...MINI_REPO, 'apps/web/src/App.tsx': 'export const App = () => null;\n' });
    expect((await runCoverage(COVERAGE_ARGS, root, PERMISSIONS)).stderr.join('\n')).toContain('App.tsx');
    await writeAll(MINI_REPO);
    await rm(join(root, 'apps/mobile/app/login.tsx'));
    await rm(join(root, 'apps/mobile/app/(app)'), { recursive: true });
    expect((await runCoverage(COVERAGE_ARGS, root, PERMISSIONS)).stderr.join('\n')).toContain('móvil');
    await writeAll({ 'apps/mobile/app/login.tsx': 'export default function Login() {}\n' });
    expect((await runCoverage(COVERAGE_ARGS, root, [])).stderr.join('\n')).toContain('permisos');
  });

  it('un archivo o carpeta que falta (no hay App.tsx) sale con 1 y lo dice, no lanza', async () => {
    const result = await runCoverage(COVERAGE_ARGS, root, PERMISSIONS);
    expect(result.code).toBe(1);
    expect(result.stderr.join('\n')).toContain('stories coverage');
  });
});

describe('runCommand', () => {
  it('coverage está conectado al comando real y toma los permisos de @sigpro/shared', async () => {
    const root = await mkdtemp(join(tmpdir(), 'stories-cli-coverage-'));
    try {
      await Promise.all(
        Object.entries(MINI_REPO).map(async ([relative, text]) => {
          await mkdir(join(root, relative, '..'), { recursive: true });
          await writeFile(join(root, relative), text, 'utf8');
        }),
      );
      const result = await runCommand(COVERAGE_ARGS, root);
      expect(result.code).toBe(0);
      expect(result.stdout).toContain('permiso: program.create');
      expect(result.stdout).toContain('endpoint: GET /api/audit');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  // Solo en seco y con un hallazgo del linter: el comando aborta antes de leer nada de GitHub. Nunca se ejecuta `sync` con `apply: true` desde aquí.
  it('sync está conectado al comando real: el linter lo aborta antes de hablar con GitHub', async () => {
    const root = await mkdtemp(join(tmpdir(), 'stories-cli-sync-'));
    try {
      await mkdir(join(root, 'docs/user-stories/login'), { recursive: true });
      await writeFile(join(root, 'docs/user-stories/login/US-LOGIN-001.md'), 'sin front matter\n', 'utf8');
      const result = await runCommand(SYNC_ARGS, root);
      expect(result.code).toBe(1);
      expect(result.stderr.join('\n')).toContain('abortado');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('sin comando imprime el uso por stderr y sale con 2', async () => {
    const result = await runCommand({ command: null, apply: false, write: false, check: false }, tmpdir());
    expect(result.code).toBe(2);
    expect(result.stderr.join('\n')).toContain('lint');
  });
});
