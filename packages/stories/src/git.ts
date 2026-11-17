// Lo que `git` sabe de las historias: borde de `stories manifest`. Lanza `git` con `execFile` (sin pasar por un shell)
// desde la raíz del repositorio; la función pura del manifiesto (`manifest.ts`) nunca habla con `git`.
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

/** Carpeta de las historias para `git`: siempre con `/`, también en Windows. */
const STORIES_PATH = 'docs/user-stories';

/** Estado de `docs/user-stories` en git: el último commit que la tocó y si tiene cambios sin confirmar. */
export type StoriesGit = { storiesCommit: string | null; dirty: boolean };

/** Sin `git` (o fuera de un repositorio) no se puede afirmar nada: sin commit y, por prudencia, con cambios. */
const UNKNOWN: StoriesGit = { storiesCommit: null, dirty: true };

/** La salida de `git` sin espacios sobrantes, o `null` si falla. Nunca rechaza: así se espera a las dos llamadas aunque una falle. */
const git = (root: string, args: readonly string[]): Promise<string | null> =>
  execFileAsync('git', [...args], { cwd: root, encoding: 'utf8', windowsHide: true }).then(
    ({ stdout }) => stdout.trim(),
    () => null,
  );

/**
 * Hash completo del último commit que tocó `docs/user-stories` y si hay algo sin confirmar en esa carpeta (cambios
 * en archivos seguidos o archivos nuevos sin seguimiento). Si `git` falla devuelve `null` y `true`; si funciona pero
 * ningún commit tocó la carpeta, el commit es `null` y `dirty` sale de `git status`. Espera a las dos llamadas
 * antes de volver: no deja ningún proceso `git` vivo en la raíz.
 */
export const readStoriesGit = async (root: string): Promise<StoriesGit> => {
  const [commit, status] = await Promise.all([git(root, ['log', '-1', '--format=%H', '--', STORIES_PATH]), git(root, ['status', '--porcelain', '--', STORIES_PATH])]);
  if (commit === null || status === null) return UNKNOWN;
  return { storiesCommit: commit === '' ? null : commit, dirty: status !== '' };
};
