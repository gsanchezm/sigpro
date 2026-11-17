import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readStoriesGit } from './git';

const execFileAsync = promisify(execFile);

/** Repositorio temporal real: `git` de verdad, sin tocar el del proyecto ni depender de la configuración del usuario. Lanzar `git` varias veces es lento en Windows: más margen que los 5 s por defecto. */
describe('readStoriesGit', { timeout: 30_000 }, () => {
  let root = '';

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'stories-git-'));
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  const git = async (...args: readonly string[]): Promise<string> =>
    (await execFileAsync('git', ['-c', 'user.name=Test', '-c', 'user.email=test@example.com', '-c', 'commit.gpgsign=false', ...args], { cwd: root, encoding: 'utf8' })).stdout.trim();

  const write = async (relative: string, text: string): Promise<void> => {
    await mkdir(join(root, relative, '..'), { recursive: true });
    await writeFile(join(root, relative), text, 'utf8');
  };

  const commitAll = async (message: string): Promise<string> => {
    await git('add', '-A');
    await git('commit', '-m', message);
    return git('rev-parse', 'HEAD');
  };

  it('fuera de un repositorio devuelve commit null y dirty true, sin lanzar', async () => {
    expect(await readStoriesGit(root)).toEqual({ storiesCommit: null, dirty: true });
  });

  it('devuelve el hash completo del último commit que tocó docs/user-stories y dirty false si está limpio', async () => {
    await git('init', '-q');
    await write('docs/user-stories/login/US-LOGIN-001.md', 'uno\n');
    const first = await commitAll('feat: stories');
    await write('apps/otra-cosa.txt', 'no es una historia\n');
    const second = await commitAll('feat: algo ajeno');
    expect(second).not.toBe(first);
    const result = await readStoriesGit(root);
    expect(result.storiesCommit).toBe(first);
    expect(result.storiesCommit).toMatch(/^[0-9a-f]{40,64}$/);
    expect(result.dirty).toBe(false);
  });

  it('un cambio sin confirmar en un archivo seguido de docs/user-stories da dirty true', async () => {
    await git('init', '-q');
    await write('docs/user-stories/login/US-LOGIN-001.md', 'uno\n');
    const commit = await commitAll('feat: stories');
    await write('docs/user-stories/login/US-LOGIN-001.md', 'uno editado\n');
    expect(await readStoriesGit(root)).toEqual({ storiesCommit: commit, dirty: true });
  });

  it('un archivo nuevo sin seguimiento en docs/user-stories también da dirty true', async () => {
    await git('init', '-q');
    await write('docs/user-stories/login/US-LOGIN-001.md', 'uno\n');
    const commit = await commitAll('feat: stories');
    await write('docs/user-stories/login/US-LOGIN-002.md', 'dos\n');
    expect(await readStoriesGit(root)).toEqual({ storiesCommit: commit, dirty: true });
  });

  it('los cambios fuera de docs/user-stories no cuentan', async () => {
    await git('init', '-q');
    await write('docs/user-stories/login/US-LOGIN-001.md', 'uno\n');
    const commit = await commitAll('feat: stories');
    await write('e2e/story-runs/nuevo.ts', 'sin seguimiento\n');
    expect(await readStoriesGit(root)).toEqual({ storiesCommit: commit, dirty: false });
  });

  it('un repositorio donde ningún commit tocó la carpeta da commit null y dirty según el estado', async () => {
    await git('init', '-q');
    await write('README.md', 'hola\n');
    await commitAll('chore: init');
    expect(await readStoriesGit(root)).toEqual({ storiesCommit: null, dirty: false });
  });
});
