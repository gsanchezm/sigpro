import { expect, test } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { NO_CHAOS, call, field, readConfig, resetTenant, setChaos, usersByEmail } from '../../story-runs/support/api';
import { RESULTS_ROOT, writeJsonResult } from '../../story-runs/support/evidence';
import { captureEnvironment, environmentProblems, type RuntimeEnvironment } from '../../story-runs/support/provenance';

// PUERTA DE AISLAMIENTO DE LAS ÉPICAS POSTERIORES AL PILOTO. Mide el entorno de ESTA ejecución con las mismas comprobaciones que
// la puerta del piloto (`story-runs/support/provenance.ts`, sin modificarla): ajustes en serie, la base de Docker (5432)
// inaccesible, la aislada accesible, URLs locales, lo que sirven la web y la app móvil igual al `dist`, la API arrancada tras
// construirse y ejecutando el `dist` de este repositorio. Comprueba además que los defectos del curso están apagados y que el
// caos es cero. Registra su resultado en `aislamiento-epicas.json`, un archivo APARTE del del piloto: así las ejecuciones de
// estas épicas no añaden nada a la evidencia ya cerrada de EP-LOGIN.
//
// No repite la caracterización del reinicio, del caos y de las sesiones que hace la puerta del piloto (siete pruebas más): las
// historias de estas épicas se apoyan en esos hechos, y cada fila vuelve a reiniciar y a comprobar el caos antes de actuar.

const TENANT = 'alumno01';
const RUN_ID = process.env.SIGPRO_STORIES_RUN_ID ?? 'sin-id';
const STARTED_AT = new Date().toISOString();
const REPO_ROOT = resolve(RESULTS_ROOT, '..', '..');
const GATE_FILE = 'aislamiento-epicas.json';

const git = (args: readonly string[]): string => {
  try {
    return execFileSync('git', [...args], { encoding: 'utf8', cwd: REPO_ROOT }).trim();
  } catch {
    return '';
  }
};

const harnessDirty = (): boolean => git(['status', '--porcelain', '--', 'e2e/story-runs-epicas', 'e2e/playwright.stories-epicas.config.ts']) !== '';

interface GateRun {
  readonly runId: string;
  readonly passed: boolean;
  readonly startedAt: string;
  readonly endedAt: string;
  readonly commit: string;
  readonly harnessDirty: boolean;
  readonly environment: RuntimeEnvironment | null;
}

const previousRuns = (): readonly GateRun[] => {
  const path = resolve(RESULTS_ROOT, GATE_FILE);
  if (!existsSync(path)) return [];
  return (JSON.parse(readFileSync(path, 'utf8')) as { readonly runs?: readonly GateRun[] }).runs ?? [];
};

let environment: RuntimeEnvironment | undefined;
let ran = 0;
let failed = 0;

// Playwright exige el patrón de desestructuración en el primer argumento de un hook, aunque no se use ninguna fixture
// eslint-disable-next-line no-empty-pattern
test.afterEach(({}, testInfo) => {
  ran += 1;
  if (testInfo.status !== testInfo.expectedStatus || testInfo.retry !== 0) failed += 1;
});

test.afterAll(async () => {
  // Deja el tenant sin caos y con su seed, pase lo que pase
  await (async () => {
    await setChaos(TENANT, NO_CHAOS);
    await resetTenant(TENANT);
  })().catch(() => undefined);
  const passed = failed === 0 && ran === 1 && environment !== undefined && environmentProblems(environment).length === 0;
  writeJsonResult(GATE_FILE, {
    generatedAt: new Date().toISOString(),
    runs: [
      ...previousRuns().filter((run) => run.runId !== RUN_ID),
      { runId: RUN_ID, passed, startedAt: STARTED_AT, endedAt: new Date().toISOString(), commit: git(['rev-parse', 'HEAD']), harnessDirty: harnessDirty(), environment: environment ?? null },
    ],
  });
});

// eslint-disable-next-line no-empty-pattern
test('0. la pila es la esperada: serie, base aislada, defectos del curso apagados y caos apagado', async ({}, testInfo) => {
  environment = await captureEnvironment(testInfo);
  expect(environmentProblems(environment), 'el entorno de la ejecución').toEqual([]);
  const config = await readConfig(TENANT);
  const health = await call('GET', '/health');
  expect(health.status).toBe(200);
  expect(config.status).toBe(200);
  expect(field(config.body, 'plantedBugs'), 'PLANTED_BUGS debe estar en false').toBe(false);
  expect(field(config.body, 'chaos')).toEqual(NO_CHAOS);
  expect((await usersByEmail(TENANT)).has('alumno01@sigpro.lab')).toBe(true);
});
