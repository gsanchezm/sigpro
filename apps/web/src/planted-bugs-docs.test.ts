import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// `docs/planted-bugs.md` es solo para el instructor: ninguna pantalla (ni /lab) ni activo de la web puede referenciarlo,
// y como no está en `src`, `public` ni `index.html`, tampoco entra en `apps/web/dist`.

const WEB_ROOT = join(import.meta.dirname, '..');

const filesUnder = (dir: string): readonly string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? filesUnder(path) : [path];
  });

describe('docs/planted-bugs.md queda fuera de la web', () => {
  const sources = [...filesUnder(join(WEB_ROOT, 'src')), join(WEB_ROOT, 'index.html'), ...(safeList(join(WEB_ROOT, 'public')))].filter((file) => !file.endsWith('planted-bugs-docs.test.ts'));

  it('ningún código ni activo de la web menciona el documento', () => {
    const offenders = sources.filter((file) => /planted-bugs/i.test(readFileSync(file, 'utf8')));
    expect(offenders).toEqual([]);
  });

  it('la página /lab no enumera defectos', () => {
    const lab = readFileSync(join(WEB_ROOT, 'src', 'pages', 'lab', 'LabPage.tsx'), 'utf8');
    expect(lab).not.toMatch(/plantedBugs|planted/i);
  });
});

function safeList(dir: string): readonly string[] {
  try {
    return filesUnder(dir);
  } catch {
    return [];
  }
}
