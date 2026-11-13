// Línea de comandos de las historias: `stories lint | coverage | sync`. Es un borde: aquí se lee el disco y se
// imprime; la lógica vive en `rules.ts`, `parse.ts` y los módulos de cada comando. Cada comando carga sus
// módulos con `await import` perezoso: `lint` y `sync` no necesitan el `dist` de `@sigpro/shared`, que solo usa `coverage`.
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import type { Finding } from './rules';

export type CommandName = 'lint' | 'coverage' | 'sync';

export type CliArgs = { command: CommandName | null; apply: boolean; write: boolean; check: boolean };

/** Resultado de un comando: lo que se imprime en cada flujo y el código de salida. */
export type CommandResult = { code: number; stdout: readonly string[]; stderr: readonly string[] };

const COMMAND_NAMES: ReadonlyMap<string, CommandName> = new Map<string, CommandName>([
  ['lint', 'lint'],
  ['coverage', 'coverage'],
  ['sync', 'sync'],
]);

/**
 * Lee los argumentos (sin `node` ni el script). Puro. Ignora un `--` suelto, porque `pnpm stories:sync -- --apply`
 * lo reenvía tal cual, y `parseArgs` trataría lo que va detrás como posicional. Una opción desconocida no lanza.
 */
export const parseCliArgs = (argv: readonly string[]): CliArgs => {
  const { values, positionals } = parseArgs({
    args: argv.filter((arg) => arg !== '--'),
    options: { apply: { type: 'boolean' }, write: { type: 'boolean' }, check: { type: 'boolean' } },
    allowPositionals: true,
    strict: false,
  });
  return {
    command: COMMAND_NAMES.get(positionals[0] ?? '') ?? null,
    apply: values.apply === true,
    write: values.write === true,
    check: values.check === true,
  };
};

/** `ruta: [regla] mensaje`, con la ruta relativa a la raíz del repositorio y con `/` en cualquier sistema. */
export const formatFinding = (finding: Finding, root: string): string =>
  `${relative(root, finding.path).split('\\').join('/')}: [${finding.rule}] ${finding.message}`;

/** Carpeta de las historias, relativa a la raíz del repositorio. */
const STORIES_DIR = join('docs', 'user-stories');

/** `stories lint`: carga `docs/user-stories`, pasa las reglas y sale con 1 si hay algún hallazgo. */
export const runLint = async (root: string): Promise<CommandResult> => {
  const [{ loadStoryFiles }, { lintStoryFiles }] = await Promise.all([import('./parse'), import('./rules')]);
  const results = await loadStoryFiles(join(root, STORIES_DIR));
  const findings = lintStoryFiles(results);
  const summary = `stories lint: ${results.length} archivos revisados, ${findings.length} hallazgos`;
  return { code: findings.length === 0 ? 0 : 1, stdout: [...findings.map((finding) => formatFinding(finding, root)), summary], stderr: [] };
};

/** Comando que todavía no existe: avisa por stderr y sale con 1. */
const notImplemented =
  (name: CommandName) =>
  async (): Promise<CommandResult> => ({ code: 1, stdout: [], stderr: [`stories ${name}: no implementado todavía`] });

type Command = (args: CliArgs, root: string) => Promise<CommandResult>;

const COMMANDS: ReadonlyMap<CommandName, Command> = new Map<CommandName, Command>([
  ['lint', (_args, root) => runLint(root)],
  ['coverage', notImplemented('coverage')],
  ['sync', notImplemented('sync')],
]);

const USAGE = 'Uso: stories <lint | coverage | sync> [--apply] [--write] [--check]';

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
