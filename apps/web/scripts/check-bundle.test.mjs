import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { checkDist, forbiddenFromSeed } from './check-bundle.mjs';

// Un seed de mentira con la misma forma que apps/api/src/seed/data.ts
const SEED = `
export const MFA_CODE = '654321';
export const DEMO_USERS = [
  { id: 'u1', email: 'admin@sigpro.test', password: 'Secreta-Admin-1!', role: 'admin' },
  { id: 'u2', email: 'gestor@sigpro.test', password: 'Secreta-Gestor-2!', role: 'program_manager' },
];
export const STUDENT_PASSWORD = 'Secreta-Alumno-3!';
`;

const dirs = [];
const makeDist = (files) => {
  const root = mkdtempSync(join(tmpdir(), 'sigpro-dist-'));
  dirs.push(root);
  for (const [name, content] of Object.entries(files)) {
    const path = join(root, name);
    mkdirSync(join(path, '..'), { recursive: true });
    writeFileSync(path, content);
  }
  return root;
};
afterEach(() => dirs.splice(0).forEach((dir) => rmSync(dir, { recursive: true, force: true })));

describe('forbiddenFromSeed', () => {
  it('lee del seed las contraseñas, los correos de demo y el código MFA, y añade el correo del alumno', () => {
    const labels = forbiddenFromSeed(SEED).map((item) => item.label);
    expect(labels.filter((label) => label.startsWith('contraseña'))).toHaveLength(3);
    expect(labels.filter((label) => label.startsWith('correo de demo'))).toHaveLength(2);
    expect(labels).toContain('código MFA de demo');
    expect(labels.some((label) => label.includes('@sigpro.lab'))).toBe(true);
  });

  it('las etiquetas nunca llevan el valor', () => {
    const text = forbiddenFromSeed(SEED).map((item) => item.label).join(' ');
    for (const secret of ['Secreta', '654321', 'admin@sigpro.test']) expect(text).not.toContain(secret);
  });

  it('el código MFA solo cuenta como número aislado (no dentro del alfabeto base64)', () => {
    const mfa = forbiddenFromSeed(SEED).find((item) => item.label === 'código MFA de demo');
    expect(mfa?.test('el código es 654321.')).toBe(true);
    expect(mfa?.test('ABC0123456543210+/')).toBe(false);
    expect(mfa?.test('id9654321x')).toBe(false);
  });
});

describe('checkDist --closed', () => {
  it('un build limpio pasa', () => {
    const dist = makeDist({ 'index.html': '<html></html>', 'assets/app.js': 'console.log("hola")' });
    expect(checkDist(dist, { closed: true, seedSource: SEED })).toEqual([]);
  });

  it('detecta una contraseña, un correo de demo, el código MFA y el correo del alumno, diciendo en qué archivo', () => {
    const dist = makeDist({
      'assets/app.js': 'const p="Secreta-Alumno-3!";const e="admin@sigpro.test";const c="654321";const s="x@sigpro.lab";',
      'index.html': '<html></html>',
    });
    const problems = checkDist(dist, { closed: true, seedSource: SEED });
    expect(problems.every((problem) => problem.startsWith('assets/app.js: contiene '))).toBe(true);
    expect(problems).toHaveLength(4);
    expect(problems.join('\n')).not.toContain('Secreta');
  });

  it('un zip publicado es un fallo (lleva la guía del alumno)', () => {
    const dist = makeDist({ 'index.html': '<html></html>', 'downloads/sigpro-examples.zip': 'PK' });
    expect(checkDist(dist, { closed: true, seedSource: SEED })).toEqual([expect.stringContaining('downloads/sigpro-examples.zip')]);
  });

  it('sin --closed no exige nada de esto (compilación abierta, como hoy)', () => {
    const dist = makeDist({ 'assets/app.js': 'const p="Secreta-Alumno-3!";', 'downloads/sigpro-examples.zip': 'PK' });
    expect(checkDist(dist, { seedSource: SEED })).toEqual([]);
  });

  it('un dist inexistente se avisa', () => {
    expect(checkDist(join(tmpdir(), 'no-existe-sigpro'), { closed: true, seedSource: SEED })[0]).toContain('No existe');
  });
});

describe('checkDist --noindex', () => {
  const META = '<html><head><meta name="robots" content="noindex, nofollow" /></head></html>';

  it('pasa con robots.txt Disallow total y la meta noindex', () => {
    const dist = makeDist({ 'robots.txt': 'User-agent: *\nDisallow: /\n', 'index.html': META });
    expect(checkDist(dist, { noindex: true, seedSource: SEED })).toEqual([]);
  });

  it('falla sin robots.txt, con un robots.txt permisivo o sin la meta', () => {
    expect(checkDist(makeDist({ 'index.html': META }), { noindex: true, seedSource: SEED })).toEqual([expect.stringContaining('robots.txt: no existe')]);
    expect(checkDist(makeDist({ 'robots.txt': 'User-agent: *\nDisallow:\n', 'index.html': META }), { noindex: true, seedSource: SEED })[0]).toContain('Disallow: /');
    expect(checkDist(makeDist({ 'robots.txt': 'User-agent: *\nDisallow: /\n', 'index.html': '<html></html>' }), { noindex: true, seedSource: SEED })).toEqual([expect.stringContaining('meta name="robots"')]);
  });
});
