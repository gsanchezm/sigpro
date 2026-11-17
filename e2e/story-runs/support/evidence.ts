import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Los resultados de la ejecución (observado y discrepancias) son material del instructor: caen en `docs/story-runs/`,
// que está en `.gitignore` (el repositorio es público). Quien cambie esta ruta debe comprobar `git check-ignore`.
const RESULTS_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'docs', 'story-runs');

/** Escribe un archivo de resultados (JSON o texto) dentro de `docs/story-runs/`, creando las carpetas que falten. */
export const writeResult = (relativePath: string, content: string): string => {
  const target = resolve(RESULTS_DIR, relativePath);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, content, 'utf8');
  return target;
};

export const writeJsonResult = (relativePath: string, value: unknown): string => writeResult(relativePath, `${JSON.stringify(value, null, 2)}\n`);

export const RESULTS_ROOT = RESULTS_DIR;
