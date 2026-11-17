// Línea de comandos de las historias: `stories lint | coverage | sync | manifest`. Es un borde: aquí se lee el disco y se
// imprime; la lógica vive en `rules.ts`, `parse.ts` y los módulos de cada comando. Cada comando carga sus
// módulos con `await import` perezoso: `lint`, `sync` y `manifest` no necesitan el `dist` de `@sigpro/shared`, que solo usa `coverage`.
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import type { CoverageSources } from './coverage';
import type { StoriesGit } from './git';
import type { ParseResult } from './parse';
import type { Finding } from './rules';
import type { Gh } from './sync';

export type CommandName = 'lint' | 'coverage' | 'sync' | 'manifest';

/** `out` es la ruta de `--out`: `null` si no se pasó y `''` si se pasó sin valor (`manifest` lo rechaza). */
export type CliArgs = { command: CommandName | null; apply: boolean; write: boolean; check: boolean; out: string | null };

/** Resultado de un comando: lo que se imprime en cada flujo y el código de salida. */
export type CommandResult = { code: number; stdout: readonly string[]; stderr: readonly string[] };

const COMMAND_NAMES: ReadonlyMap<string, CommandName> = new Map<string, CommandName>([
  ['lint', 'lint'],
  ['coverage', 'coverage'],
  ['sync', 'sync'],
  ['manifest', 'manifest'],
]);

/** `--out <ruta>`; sin valor (por ejemplo, `--out` al final) queda como cadena vacía para que `manifest` lo rechace en vez de volcar el JSON por la salida estándar. */
const outOf = (value: unknown): string | null => {
  if (value === undefined) return null;
  return typeof value === 'string' ? value : '';
};

/**
 * Lee los argumentos (sin `node` ni el script). Puro. Ignora un `--` suelto, porque `pnpm stories:sync -- --apply`
 * lo reenvía tal cual, y `parseArgs` trataría lo que va detrás como posicional. Una opción desconocida no lanza.
 */
export const parseCliArgs = (argv: readonly string[]): CliArgs => {
  const { values, positionals } = parseArgs({
    args: argv.filter((arg) => arg !== '--'),
    options: { apply: { type: 'boolean' }, write: { type: 'boolean' }, check: { type: 'boolean' }, out: { type: 'string' } },
    allowPositionals: true,
    strict: false,
  });
  return {
    command: COMMAND_NAMES.get(positionals[0] ?? '') ?? null,
    apply: values.apply === true,
    write: values.write === true,
    check: values.check === true,
    out: outOf(values.out),
  };
};

/** `ruta: [regla] mensaje`, con la ruta relativa a la raíz del repositorio y con `/` en cualquier sistema. */
export const formatFinding = (finding: Finding, root: string): string =>
  `${relative(root, finding.path).split('\\').join('/')}: [${finding.rule}] ${finding.message}`;

/** Carpeta de las historias, relativa a la raíz del repositorio. */
const STORIES_DIR = join('docs', 'user-stories');

/** Carga `docs/user-stories` y le pasa las reglas: lo comparten `lint` y `sync`. */
const loadAndLint = async (root: string): Promise<{ results: readonly ParseResult[]; findings: readonly Finding[] }> => {
  const [{ loadStoryFiles }, { lintStoryFiles }] = await Promise.all([import('./parse'), import('./rules')]);
  const results = await loadStoryFiles(join(root, STORIES_DIR));
  return { results, findings: lintStoryFiles(results) };
};

/** `stories lint`: carga `docs/user-stories`, pasa las reglas y sale con 1 si hay algún hallazgo. */
export const runLint = async (root: string): Promise<CommandResult> => {
  const { results, findings } = await loadAndLint(root);
  const summary = `stories lint: ${results.length} archivos revisados, ${findings.length} hallazgos`;
  return { code: findings.length === 0 ? 0 : 1, stdout: [...findings.map((finding) => formatFinding(finding, root)), summary], stderr: [] };
};

/** Espera entre escrituras (`delayMs`, 1500 ms por defecto) y reloj inyectable; solo los tests lo cambian. */
export type SyncOptions = { delayMs?: number; sleep?: (ms: number) => Promise<void> };

/**
 * `stories sync`: en seco por defecto. Carga y valida (con hallazgos aborta sin hablar con GitHub), arma los
 * borradores, lee los issues y etiquetas del repositorio y la cuenta, e imprime el plan. Solo con `--apply`
 * lo ejecuta. No existe ninguna opción para cerrar ni borrar issues.
 */
export const runSync = async (args: CliArgs, root: string, gh: Gh, options: SyncOptions = {}): Promise<CommandResult> => {
  const { results, findings } = await loadAndLint(root);
  if (findings.length > 0) {
    return {
      code: 1,
      stdout: findings.map((finding) => formatFinding(finding, root)),
      stderr: [`stories sync: abortado, el linter encontró ${findings.length} hallazgos; corrígelos y vuelve a ejecutarlo`],
    };
  }
  const [{ renderIssue }, { applyOps, DEFAULT_DELAY_MS, describeOp, planSync, summarizeOps }] = await Promise.all([import('./render'), import('./sync')]);
  const drafts = results.flatMap((result) => (result.ok ? [renderIssue(result.file)] : []));
  const [me, remote, remoteLabels] = await Promise.all([gh.me(), gh.listIssues(), gh.listLabels()]);
  const ops = planSync({ drafts, remote, remoteLabels, me });
  const header = [`stories sync: ${drafts.length} borradores locales, ${remote.length} issues remotos (cuenta ${me})`];
  const planLines = ops.length === 0 ? ['Nada que sincronizar: GitHub ya está al día.'] : [`Plan: ${summarizeOps(ops)}`, ...ops.map((op) => `  - ${describeOp(op)}`)];
  if (!args.apply) {
    const hint = ops.length === 0 ? [] : ['En seco: no se ha escrito nada en GitHub. Para ejecutar el plan: pnpm stories:sync -- --apply'];
    return { code: 0, stdout: [...header, ...planLines, ...hint], stderr: [] };
  }
  if (ops.length === 0) return { code: 0, stdout: [...header, ...planLines], stderr: [] };
  const outcome = await applyOps(ops, gh, { delayMs: options.delayMs ?? DEFAULT_DELAY_MS, sleep: options.sleep });
  if (outcome.failedAt === null) {
    return { code: 0, stdout: [...header, ...planLines, `Aplicadas ${outcome.done} de ${ops.length} operaciones.`], stderr: [] };
  }
  return {
    code: 1,
    stdout: [...header, ...planLines],
    stderr: [
      `stories sync: falló tras ${outcome.done} de ${ops.length} operaciones, en «${describeOp(outcome.failedAt)}»: ${outcome.error ?? 'error desconocido'}`,
      'Lo ya hecho se conserva: vuelve a ejecutar `pnpm stories:sync` para ver lo que falta y `--apply` para continuar.',
    ],
  };
};

/** Matriz generada por `coverage --write`, relativa a la raíz del repositorio y con `/` para mostrarla. */
const COVERAGE_FILE = join(STORIES_DIR, 'COBERTURA.md');
const COVERAGE_FILE_LABEL = 'docs/user-stories/COBERTURA.md';

/** Qué se avisa cuando una fuente de la app sale vacía: una fuente vacía no es «sin huecos», es que no se leyó bien. */
const EMPTY_SOURCE_MESSAGES: ReadonlyMap<keyof CoverageSources, string> = new Map<keyof CoverageSources, string>([
  ['endpoints', 'no se encontró ningún endpoint en los controladores de apps/api/src'],
  ['webRoutes', 'no se encontró ninguna ruta web en apps/web/src/App.tsx'],
  ['mobileRoutes', 'no se encontró ninguna ruta móvil en apps/mobile/app'],
  ['permissions', 'la lista de permisos de @sigpro/shared está vacía'],
]);

/** Archivos y carpetas bajo `dir`, relativos a él, con `/` y en orden de código: el orden del disco no debe cambiar la salida. */
const listTree = async (dir: string): Promise<readonly string[]> => (await readdir(dir, { recursive: true })).map((path) => path.split('\\').join('/')).sort();

/**
 * Lee del repositorio lo que tiene la app: controladores de `apps/api/src`, `App.tsx` de la web y el árbol de
 * `apps/mobile/app`; los permisos llegan ya leídos. Lanza si falta algo o si alguna fuente sale vacía.
 */
const readCoverageSources = async (root: string, permissions: readonly string[]): Promise<CoverageSources> => {
  const { extractEndpoints, extractionProblems, extractWebRoutes, mobileRoutesFromFiles } = await import('./coverage');
  const apiDir = join(root, 'apps', 'api', 'src');
  const controllerFiles = (await listTree(apiDir)).filter((file) => file.endsWith('.controller.ts'));
  const [controllers, appTsx, mobileFiles] = await Promise.all([
    Promise.all(controllerFiles.map((file) => readFile(join(apiDir, file), 'utf8'))),
    readFile(join(root, 'apps', 'web', 'src', 'App.tsx'), 'utf8'),
    listTree(join(root, 'apps', 'mobile', 'app')),
  ]);
  // Los extractores son literales: si el código usa una forma que no leen (otro verbo, un @Controller con objeto, un
  // path entre llaves, un index) se aborta, porque lo perdido saldría como «cubierto» o ni siquiera como hueco.
  const unread = extractionProblems(controllers, appTsx);
  if (unread.length > 0) throw new Error(['las fuentes tienen construcciones que la cobertura no lee:', ...unread.map((problem) => `  - ${problem}`)].join('\n'));
  const sources: CoverageSources = {
    endpoints: extractEndpoints(controllers),
    webRoutes: extractWebRoutes(appTsx),
    mobileRoutes: mobileRoutesFromFiles(mobileFiles),
    permissions,
  };
  const empty = [...EMPTY_SOURCE_MESSAGES].filter(([kind]) => sources[kind].length === 0).map(([, message]) => message);
  if (empty.length > 0) throw new Error(empty.join('; '));
  return sources;
};

/**
 * `stories coverage`: cruza lo que tiene la app (endpoints, rutas web y móviles, permisos) con lo que cubren las
 * historias e imprime los huecos, siempre con código 0. `--write` escribe `docs/user-stories/COBERTURA.md`;
 * `--check` sale con 1 si hay huecos o si el archivo no coincide con lo que se generaría ahora (los CRLF no cuentan).
 * Si algún archivo de historia no se puede leer aborta: con datos a medias la matriz sería engañosa.
 */
export const runCoverage = async (args: CliArgs, root: string, permissions: readonly string[]): Promise<CommandResult> => {
  const [{ loadStoryFiles }, { buildCoverage, holes, renderCoverageMarkdown, summarizeHoles }] = await Promise.all([import('./parse'), import('./coverage')]);
  const results = await loadStoryFiles(join(root, STORIES_DIR));
  const unreadable = results.flatMap((result) => (result.ok ? [] : [formatFinding({ path: result.path, id: '', rule: 'frontmatter', message: result.error }, root)]));
  if (unreadable.length > 0) {
    return {
      code: 1,
      stdout: unreadable,
      stderr: [`stories coverage: abortado, ${unreadable.length} archivos de historia no se pueden leer; corrígelos (pnpm stories:lint) y vuelve a ejecutarlo`],
    };
  }
  const read = await readCoverageSources(root, permissions).then(
    (sources) => ({ ok: true as const, sources }),
    (error: unknown) => ({ ok: false as const, error: error instanceof Error ? error.message : String(error) }),
  );
  if (!read.ok) return { code: 1, stdout: [], stderr: [`stories coverage: ${read.error}`] };

  const coverage = buildCoverage(read.sources, results.flatMap((result) => (result.ok ? [result.file] : [])));
  const holeList = holes(coverage);
  const markdown = renderCoverageMarkdown(coverage);
  const target = join(root, COVERAGE_FILE);
  const current = await readFile(target, 'utf8').then((text) => text.replace(/\r\n/g, '\n'), () => null);
  if (args.write) {
    await mkdir(join(target, '..'), { recursive: true });
    await writeFile(target, markdown, 'utf8');
  }
  const stale = !args.write && current !== markdown;
  const problems = args.check
    ? [
        ...(holeList.length > 0 ? ['stories coverage --check: hay huecos sin historia'] : []),
        ...(stale ? [`stories coverage --check: ${COVERAGE_FILE_LABEL} ${current === null ? 'no existe' : 'está desactualizado'}; regenéralo con pnpm stories:coverage -- --write`] : []),
      ]
    : [];
  return {
    code: problems.length === 0 ? 0 : 1,
    stdout: [...holeList, `stories coverage: ${summarizeHoles(coverage)}`, ...(args.write ? [`Escrito ${COVERAGE_FILE_LABEL}`] : [])],
    stderr: problems,
  };
};

/** Cómo se lee el estado de git de las historias; el borde real es `readStoriesGit` (`git.ts`) y los tests inyectan uno falso. */
export type ReadGit = (root: string) => Promise<StoriesGit>;

/** Ruta legible para el resumen: relativa a la raíz y con `/` en cualquier sistema. */
const displayPath = (root: string, target: string): string => relative(root, target).split('\\').join('/');

/**
 * `stories manifest`: la lista de todas las filas de todos los Esquemas de las historias (`manifest.ts`) como JSON
 * `{ generatedAt, storiesCommit, dirty, rows }`. `storiesCommit` y `dirty` los da `readGit`; sin `--out` el JSON va
 * por la salida estándar y con `--out <ruta>` se escribe en ese archivo (la ruta es relativa a la raíz del
 * repositorio, no a donde `pnpm --filter` lance el proceso; las carpetas que falten se crean). Con hallazgos del
 * linter o con archivos que no se pueden leer sale con 1 y no escribe nada: un manifiesto a medias dejaría filas fuera.
 */
export const runManifest = async (args: CliArgs, root: string, readGit: ReadGit, now: () => Date = () => new Date()): Promise<CommandResult> => {
  if (args.out === '') return { code: 2, stdout: [], stderr: ['stories manifest: --out necesita una ruta (--out <ruta>)'] };
  const { results, findings } = await loadAndLint(root);
  // Un archivo ilegible ya sale como hallazgo `frontmatter`; se cuenta aparte por si alguna vez dejara de hacerlo.
  const unreadable = results.filter((result) => !result.ok).length;
  if (findings.length > 0 || unreadable > 0) {
    return {
      code: 1,
      stdout: findings.map((finding) => formatFinding(finding, root)),
      stderr: [`stories manifest: abortado, ${findings.length} hallazgos del linter y ${unreadable} archivos ilegibles; corrígelos (pnpm stories:lint) y vuelve a ejecutarlo`],
    };
  }
  const [{ buildManifestRows, countRowsByStory }, git] = await Promise.all([import('./manifest'), readGit(root)]);
  const rows = buildManifestRows(results.flatMap((result) => (result.ok ? [result.file] : [])));
  const json = JSON.stringify({ generatedAt: now().toISOString(), storiesCommit: git.storiesCommit, dirty: git.dirty, rows }, null, 2);
  if (args.out === null) return { code: 0, stdout: [json], stderr: [] };
  const target = resolve(root, args.out);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, `${json}\n`, 'utf8');
  const perStory = [...countRowsByStory(rows)];
  const state = `${git.storiesCommit === null ? 'sin commit' : `commit ${git.storiesCommit.slice(0, 7)}`}, ${git.dirty ? 'con cambios sin confirmar' : 'sin cambios sin confirmar'}`;
  return {
    code: 0,
    stdout: [
      `stories manifest: ${rows.length} filas de ${perStory.length} historias escritas en ${displayPath(root, target)} (${state})`,
      ...perStory.map(([story, count]) => `  ${story}: ${count} ${count === 1 ? 'fila' : 'filas'}`),
    ],
    stderr: [],
  };
};

/** Los permisos salen de `@sigpro/shared`, que solo este comando necesita; si su `dist` no está compilado lo dice en vez de lanzar. */
const loadPermissions = async (): Promise<{ ok: true; permissions: readonly string[] } | { ok: false; error: string }> =>
  import('@sigpro/shared').then(
    (shared) => ({ ok: true as const, permissions: Object.keys(shared.PERMISSIONS) }),
    (error: unknown) => ({ ok: false as const, error: error instanceof Error ? error.message : String(error) }),
  );

type Command = (args: CliArgs, root: string) => Promise<CommandResult>;

const COMMANDS: ReadonlyMap<CommandName, Command> = new Map<CommandName, Command>([
  ['lint', (_args, root) => runLint(root)],
  [
    'coverage',
    async (args, root) => {
      const loaded = await loadPermissions();
      return loaded.ok
        ? runCoverage(args, root, loaded.permissions)
        : { code: 1, stdout: [], stderr: [`stories coverage: no se pudo cargar @sigpro/shared (¿está compilado? pnpm --filter @sigpro/shared build): ${loaded.error}`] };
    },
  ],
  [
    'sync',
    async (args, root) => {
      const { makeGh } = await import('./gh');
      return runSync(args, root, makeGh());
    },
  ],
  [
    'manifest',
    async (args, root) => {
      const { readStoriesGit } = await import('./git');
      return runManifest(args, root, readStoriesGit);
    },
  ],
]);

const USAGE = 'Uso: stories <lint | coverage | sync | manifest> [--apply] [--write] [--check] [--out <ruta>]';

/** Despacha al comando elegido; sin comando (o desconocido) imprime el uso y sale con 2. */
export const runCommand = async (args: CliArgs, root: string): Promise<CommandResult> => {
  const command = args.command === null ? undefined : COMMANDS.get(args.command);
  return command === undefined ? { code: 2, stdout: [], stderr: [USAGE] } : command(args, root);
};

/** ¿Se ejecutó este archivo directamente (`tsx src/cli.ts`) y no se importó desde un test? `relative` ignora mayúsculas en Windows. */
const isEntryPoint = (): boolean => {
  const entry = process.argv[1];
  return entry !== undefined && relative(resolve(entry), fileURLToPath(import.meta.url)) === '';
};

const main = async (argv: readonly string[]): Promise<void> => {
  // Raíz del repositorio: este archivo vive en packages/stories/src.
  const root = resolve(import.meta.dirname, '../../..');
  const result = await runCommand(parseCliArgs(argv), root);
  result.stdout.forEach((line) => console.log(line));
  result.stderr.forEach((line) => console.error(line));
  process.exitCode = result.code;
};

if (isEntryPoint()) {
  main(process.argv.slice(2)).catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
