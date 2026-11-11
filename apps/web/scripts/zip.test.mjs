import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { buildExamplesEntries, isExcluded } from './zip-examples.mjs';
import { crc32, createZip, readZip } from './zip.mjs';

describe('crc32', () => {
  it('coincide con el vector de prueba estándar', () => {
    expect(crc32(Buffer.from('123456789'))).toBe(0xcbf43926);
    expect(crc32(Buffer.alloc(0))).toBe(0);
  });
});

describe('createZip / readZip', () => {
  it('ida y vuelta: nombres (con tildes), contenido y orden', () => {
    const files = [
      { name: 'a/léeme.md', data: Buffer.from('# Hola, curso\n'.repeat(50)) },
      { name: 'a/vacío.txt', data: Buffer.alloc(0) },
      { name: 'b.bin', data: Buffer.from([0, 1, 2, 3, 255, 254]) },
    ];
    const back = readZip(createZip(files));
    expect(back.map((file) => file.name)).toEqual(files.map((file) => file.name));
    back.forEach((file, index) => expect(file.data.equals(files[index].data)).toBe(true));
  });

  it('comprime lo que se repite y guarda tal cual lo que no comprime', () => {
    const repetitive = Buffer.from('abc'.repeat(2000));
    expect(createZip([{ name: 'r.txt', data: repetitive }]).length).toBeLessThan(repetitive.length / 4);
    expect(readZip(createZip([{ name: 'tiny', data: Buffer.from('x') }]))[0].data.toString()).toBe('x');
  });

  it('es determinista: el mismo contenido da el mismo zip, byte a byte', () => {
    const files = [{ name: 'x.txt', data: Buffer.from('hola') }];
    expect(createZip(files).equals(createZip(files))).toBe(true);
  });

  it('un zip dañado se detecta por el CRC', () => {
    const zip = createZip([{ name: 'x.txt', data: Buffer.from('contenido de prueba sin comprimir ni nada') }]);
    // Cambia un byte del contenido (justo después de la cabecera local y del nombre)
    zip[30 + 'x.txt'.length] ^= 0xff;
    expect(() => readZip(zip)).toThrow();
  });
});

describe('isExcluded', () => {
  it('deja fuera lo que no se comparte', () => {
    for (const path of ['node_modules/x/index.js', '.auth/alumno01-admin.json', 'playwright-report/index.html', 'blob-report/report-1.zip', 'test-results/a.png', '.env', 'tests/s11.spec.ts-snapshots/a.png', 'sub/node_modules/y.js']) {
      expect(isExcluded(path), path).toBe(true);
    }
  });

  it('conserva el proyecto', () => {
    for (const path of ['package.json', 'package-lock.json', 'playwright.config.ts', '.env.example', '.gitignore', 'tests/s02-locators-auth.spec.ts', 'pages/ProgramsPage.ts']) {
      expect(isExcluded(path), path).toBe(false);
    }
  });
});

describe('buildExamplesEntries (sobre el repositorio real)', () => {
  const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
  const entries = buildExamplesEntries(repoRoot);
  const names = entries.map((entry) => entry.name);

  it('empaqueta el proyecto de ejemplo bajo una carpeta raíz', () => {
    expect(names).toContain('sigpro-examples/package.json');
    expect(names).toContain('sigpro-examples/playwright.config.ts');
    expect(names).toContain('sigpro-examples/fixtures/index.ts');
    expect(names).toContain('sigpro-examples/pages/ProgramsPage.ts');
    expect(names.filter((name) => /\/tests\/s\d\d-.*\.spec\.ts$/.test(name)).length).toBeGreaterThanOrEqual(2);
  });

  it('no incluye dependencias, sesiones ni informes', () => {
    expect(names.some((name) => /\/(node_modules|\.auth|playwright-report|blob-report|test-results)\//.test(name))).toBe(false);
    expect(names.some((name) => name.endsWith('/.env'))).toBe(false);
  });

  it('el workflow de alumnos va con el proyecto en la raíz (PROJECT_DIR: .)', () => {
    const workflow = entries.find((entry) => entry.name === 'sigpro-examples/.github/workflows/students-e2e.yml');
    expect(workflow).toBeDefined();
    expect(workflow.data.toString('utf8')).toMatch(/^\s*PROJECT_DIR:\s*\.\s*$/m);
    expect(workflow.data.toString('utf8')).not.toMatch(/PROJECT_DIR:\s*examples/);
  });

  it('el orden es estable', () => {
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
  });
});
