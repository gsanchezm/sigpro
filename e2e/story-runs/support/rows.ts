import { test, type BrowserContext, type Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { API_URL, NO_CHAOS, field, readConfig, setChaos } from './api';
import { RESULTS_ROOT, writeJsonResult } from './evidence';
import { effectiveSettings, settingsProblems } from './provenance';

// MARCO DE EJECUCIÓN POR FILA. Cada fila de cada Esquema de una historia (manifiesto: `pnpm stories:manifest`) es UNA prueba,
// con un manejador que traduce las celdas de la fila a acciones y devuelve lo que se OBSERVÓ junto a lo que la historia ESPERA.
//
// Reglas que este marco impone (no las eludas en un manejador):
//  - Una fila sin manejador NO se salta: la prueba falla y la fila queda como `no-ejecutable` con el motivo.
//  - Nunca se edita una historia para que una fila «pase»: si la historia es ambigua o no reproducible, el manejador devuelve
//    `notExecutable(...)` explicando por qué; si la app no cumple lo que dice la historia, devuelve `discrepa`.
//  - Lo observado se guarda crudo (estado, código, texto visible) y el veredicto se calcula aparte.
//  - Una discrepancia NO hace fallar la prueba: es un hallazgo. Solo fallan los errores del propio arnés.
//  - Antes de cada fila se comprueba que la app es la esperada (defectos del curso apagados, caos a cero); el reinicio de un
//    tenant NO apaga el caos, así que se apaga aquí si hiciera falta.

export interface ManifestRow {
  readonly rowId: string;
  readonly story: string;
  readonly platform: string;
  readonly verificacion: string;
  readonly noImplementada: boolean;
  readonly esquemaIndex: number;
  readonly esquema: string;
  readonly rowIndex: number;
  readonly cells: Readonly<Record<string, string>>;
  readonly resolvedSteps: readonly string[];
}

interface Manifest {
  readonly generatedAt: string;
  readonly storiesCommit: string | null;
  readonly dirty: boolean;
  readonly rows: readonly ManifestRow[];
}

export type Verdict =
  /** La app hace lo que dice la historia. */
  | 'coincide'
  /** La app NO hace lo que dice la historia (la historia es la fuente de verdad). */
  | 'discrepa'
  /** La fila depende de algo que la historia deja en «Decisiones pendientes»: se anota, no se juzga. */
  | 'pendiente-de-decision'
  /** La fila no se pudo ejecutar aquí (motivo en `note`): entorno, plataforma o historia no reproducible. */
  | 'no-ejecutable'
  /** El arnés falló (excepción): no es un hallazgo sobre la app. */
  | 'error-de-prueba';

export interface Outcome {
  readonly verdict: Verdict;
  /** Lo que dice la historia para esta fila, en una frase con los datos concretos. */
  readonly expected: string;
  /** Lo que se observó, en una frase con los datos crudos (estado y código HTTP, o texto visible, o ruta). */
  readonly observed: string;
  /** Si `discrepa`: en qué difiere. Si `no-ejecutable` o `pendiente-de-decision`: el motivo. */
  readonly note?: string;
  /** Datos crudos adicionales (cuerpos de respuesta, rutas de capturas…). Sin tokens ni secretos. */
  readonly evidence?: Readonly<Record<string, unknown>>;
}

export const outcome = (ok: boolean, expected: string, observed: string, extra: Pick<Outcome, 'note' | 'evidence'> = {}): Outcome => ({
  verdict: ok ? 'coincide' : 'discrepa',
  expected,
  observed,
  ...extra,
});

export const pending = (expected: string, observed: string, note: string, evidence?: Outcome['evidence']): Outcome => ({
  verdict: 'pendiente-de-decision',
  expected,
  observed,
  note,
  ...(evidence ? { evidence } : {}),
});

export const notExecutable = (expected: string, note: string): Outcome => ({ verdict: 'no-ejecutable', expected, observed: '(no se ejecutó)', note });

export interface BrowserFixtures {
  readonly page: Page;
  readonly context: BrowserContext;
}

/** Manejador de una fila de API: solo HTTP, sin navegador. */
export type ApiRowHandler = (row: ManifestRow) => Promise<Outcome>;
/** Manejador de una fila de web o de la app móvil servida como web: recibe la página y el contexto de Playwright. */
export type BrowserRowHandler = (row: ManifestRow, fixtures: BrowserFixtures) => Promise<Outcome>;

interface StoryRunBase {
  readonly story: string;
  /** Tenants que usa la historia: se comprueba (y se apaga si hace falta) su caos antes de cada fila. */
  readonly tenants: readonly string[];
}

export interface ApiStoryRun extends StoryRunBase {
  readonly surface: 'api';
  /** Manejador por número de Esquema (1..n). */
  readonly handlers: ReadonlyMap<number, ApiRowHandler>;
}

export interface BrowserStoryRun extends StoryRunBase {
  /** `web` (escritorio 1440 px) o `expo-web` (la app móvil servida como web a 390 px: NO es nativo). */
  readonly surface: 'web' | 'expo-web';
  readonly handlers: ReadonlyMap<number, BrowserRowHandler>;
}

interface RowResult extends Outcome {
  readonly rowId: string;
  readonly esquemaIndex: number;
  readonly esquema: string;
  readonly rowIndex: number;
  readonly cells: Readonly<Record<string, string>>;
  readonly resolvedSteps: readonly string[];
  readonly ms: number;
}

/** Identifica una ejecución completa: lo fija el config de Playwright en el proceso principal y los workers lo heredan. No lo fijes a mano: dos ejecuciones con el mismo id mezclarían filas. */
const RUN_ID = process.env.SIGPRO_STORIES_RUN_ID ?? 'sin-id';
const rowFile = (rowId: string): string => `EP-LOGIN/rows/${rowId.replaceAll('/', '__')}.json`;

const git = (args: readonly string[]): string => {
  try {
    return execFileSync('git', [...args], { encoding: 'utf8', cwd: resolve(RESULTS_ROOT, '..', '..') }).trim();
  } catch {
    return '';
  }
};

export const loadManifest = (): Manifest => JSON.parse(readFileSync(resolve(RESULTS_ROOT, 'manifest.json'), 'utf8')) as Manifest;

/** El manifiesto debe salir de las historias confirmadas que hay ahora: si cambian, hay que regenerarlo y volver a ejecutar. */
const assertManifestFresh = (manifest: Manifest): void => {
  const storiesCommit = git(['log', '-1', '--format=%H', '--', 'docs/user-stories']);
  const dirty = git(['status', '--porcelain', '--', 'docs/user-stories']) !== '';
  if (dirty) throw new Error('docs/user-stories tiene cambios sin confirmar: confírmalos antes de ejecutar (el resultado se asocia a un commit).');
  if (manifest.dirty || manifest.storiesCommit !== storiesCommit) {
    throw new Error(`Manifiesto obsoleto (generado en ${manifest.storiesCommit ?? 'sin git'}; las historias están en ${storiesCommit}). Ejecuta «pnpm stories:manifest --out docs/story-runs/manifest.json».`);
  }
};

const STARTED_AT = new Date().toISOString();

/**
 * La puerta de aislamiento debe constar superada EN ESTA ejecución (mismo `runId`). Con `--no-deps` la puerta no corre y aquí eso
 * impide ejecutar cualquier fila: no basta con que el informe lo detecte después.
 */
const assertGatePassed = (): void => {
  const path = resolve(RESULTS_ROOT, 'aislamiento.json');
  const saved = existsSync(path) ? (JSON.parse(readFileSync(path, 'utf8')) as { readonly runs?: ReadonlyArray<{ readonly runId: string; readonly passed: boolean }> }) : {};
  const run = (saved.runs ?? []).find((entry) => entry.runId === RUN_ID);
  if (!run?.passed) throw new Error(`La puerta de aislamiento no consta superada en esta ejecución (runId ${RUN_ID}): ¿se usó --no-deps, o falló? No se ejecuta ninguna fila.`);
};

/** La app debe ser la esperada y los tenants de la historia, sin caos. Devuelve el estado observado para el encabezado. */
export const assertCleanStack = async (tenants: readonly string[]): Promise<{ readonly plantedBugs: boolean }> => {
  const first = await readConfig(tenants[0] ?? 'alumno01');
  if (first.status !== 200) throw new Error(`GET /config respondió ${first.status}: ¿está la API en ${API_URL}?`);
  if (field(first.body, 'plantedBugs') !== false) throw new Error('La API tiene los defectos del curso activos (PLANTED_BUGS distinto de false): no se ejecuta nada.');
  for (const tenant of tenants) {
    const chaos = field((await readConfig(tenant)).body, 'chaos');
    if (JSON.stringify(chaos) === JSON.stringify(NO_CHAOS)) continue;
    await setChaos(tenant, NO_CHAOS);
    const after = field((await readConfig(tenant)).body, 'chaos');
    if (JSON.stringify(after) !== JSON.stringify(NO_CHAOS)) throw new Error(`No se pudo apagar el caos de ${tenant}: ${JSON.stringify(after)}`);
  }
  return { plantedBugs: false };
};

interface Registration {
  readonly story: string;
  readonly surface: 'api' | 'web' | 'expo-web';
  readonly tenants: readonly string[];
  readonly hasHandler: (esquemaIndex: number) => boolean;
  /** Ejecuta el manejador del Esquema de la fila; `fixtures` solo existe en las pruebas de navegador. */
  readonly execute: (row: ManifestRow, fixtures: BrowserFixtures | undefined) => Promise<Outcome>;
  readonly browser: boolean;
}

const register = (run: Registration): void => {
  const manifest = loadManifest();
  const rows = manifest.rows.filter((row) => row.story === run.story);
  const results = new Map<string, RowResult>();

  // Cada resultado se guarda en disco al momento: si una prueba lanza una excepción, Playwright reinicia el worker y el mapa en
  // memoria se pierde; el JSON final se arma con lo guardado de ESTA ejecución (mismo `RUN_ID`) y nunca con restos de otra.
  const saveRow = (result: RowResult): void => {
    results.set(result.rowId, result);
    writeJsonResult(rowFile(result.rowId), { runId: RUN_ID, result });
  };
  const loadSavedRow = (rowId: string): RowResult | undefined => {
    const path = resolve(RESULTS_ROOT, rowFile(rowId));
    if (!existsSync(path)) return undefined;
    const saved = JSON.parse(readFileSync(path, 'utf8')) as { readonly runId: string; readonly result: RowResult };
    return saved.runId === RUN_ID ? saved.result : undefined;
  };

  const runRow = async (row: ManifestRow, fixtures: BrowserFixtures | undefined): Promise<void> => {
    const started = performance.now();
    const base = { rowId: row.rowId, esquemaIndex: row.esquemaIndex, esquema: row.esquema, rowIndex: row.rowIndex, cells: row.cells, resolvedSteps: row.resolvedSteps };
    if (!run.hasHandler(row.esquemaIndex)) {
      // Un fallo del arnés, no una fila «no ejecutable»: el informe debe poder distinguir lo que no se pudo ejecutar de lo que se olvidó
      saveRow({ ...base, verdict: 'error-de-prueba', expected: '(sin manejador)', observed: `El Esquema ${row.esquemaIndex} no tiene manejador en el arnés`, note: 'Fila sin manejador', ms: 0 });
      throw new Error(`Fila sin manejador: ${row.rowId}`);
    }
    try {
      await assertCleanStack(run.tenants);
      const result = await run.execute(row, fixtures);
      saveRow({ ...base, ...result, ms: Math.round(performance.now() - started) });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      saveRow({ ...base, verdict: 'error-de-prueba', expected: '(no evaluado)', observed: message, note: 'Excepción del arnés; no es un hallazgo sobre la app', ms: Math.round(performance.now() - started) });
      throw error;
    }
  };

  // Si la precondición falla (manifiesto obsoleto…), `afterAll` no debe escribir nada: pisaría un JSON bueno con filas sin evaluar
  let preconditionFailed = false;

  test.describe(run.story, () => {
    // eslint-disable-next-line no-empty-pattern
    test.beforeAll(({}, testInfo) => {
      try {
        assertManifestFresh(manifest);
        if (rows.length === 0) throw new Error(`El manifiesto no tiene filas de ${run.story}`);
        const settings = settingsProblems(effectiveSettings(testInfo));
        if (settings.length > 0) throw new Error(`Ajustes de ejecución no admitidos: ${settings.join('; ')}. El aislamiento entre filas exige ejecución en serie.`);
        assertGatePassed();
      } catch (error) {
        preconditionFailed = true;
        throw error;
      }
    });

    for (const row of rows) {
      // Solo las pruebas de navegador piden `page`: así las de API no abren un navegador
      if (run.browser) test(row.rowId, async ({ page, context }) => runRow(row, { page, context }));
      else test(row.rowId, async () => runRow(row, undefined));
    }

    // eslint-disable-next-line no-empty-pattern
    test.afterAll(async ({}, testInfo) => {
      if (preconditionFailed) return;
      // Lo que no llegó a ejecutarse (p. ej. porque el proceso se interrumpió o se repitió una sola fila) queda registrado como
      // error del arnés, nunca como una fila «no ejecutable» legítima
      const complete = rows.every((row) => results.has(row.rowId) || loadSavedRow(row.rowId) !== undefined);
      const all = rows.map(
        (row): RowResult =>
          results.get(row.rowId) ?? loadSavedRow(row.rowId) ?? {
            rowId: row.rowId,
            esquemaIndex: row.esquemaIndex,
            esquema: row.esquema,
            rowIndex: row.rowIndex,
            cells: row.cells,
            resolvedSteps: row.resolvedSteps,
            verdict: 'error-de-prueba',
            expected: '(no evaluado)',
            observed: '(la fila no llegó a ejecutarse en esta ejecución)',
            note: 'Ejecución incompleta: no es un hallazgo sobre la app',
            ms: 0,
          },
      );
      const totals = all.reduce<Record<string, number>>((acc, r) => ({ ...acc, [r.verdict]: (acc[r.verdict] ?? 0) + 1 }), {});
      const config = await readConfig(run.tenants[0] ?? 'alumno01').catch(() => undefined);
      // Una ejecución incompleta (p. ej. una sola fila con --grep) va aparte y NO pisa el JSON completo de la historia
      writeJsonResult(complete ? `EP-LOGIN/${run.story}.json` : `EP-LOGIN/partial/${run.story}.json`, {
        header: {
          story: run.story,
          surface: run.surface,
          apiUrl: API_URL,
          apiPlantedBugs: config ? field(config.body, 'plantedBugs') : 'desconocido',
          commit: git(['rev-parse', 'HEAD']),
          // El resultado se asocia a un commit: si el arnés tenía cambios sin confirmar, el informe lo marca como problema
          harnessDirty: git(['status', '--porcelain', '--', 'e2e/story-runs', 'e2e/playwright.stories.config.ts']) !== '',
          storiesCommit: manifest.storiesCommit,
          manifestGeneratedAt: manifest.generatedAt,
          node: process.version,
          runId: RUN_ID,
          // Ajustes efectivos de esta ejecución (el informe exige los de ejecución en serie) y cuándo empezaron las filas
          settings: effectiveSettings(testInfo),
          startedAt: STARTED_AT,
          executedAt: new Date().toISOString(),
        },
        totals: { rows: all.length, ...totals },
        rows: all,
      });
    });
  });
};

const handlerOf = <H>(handlers: ReadonlyMap<number, H>, row: ManifestRow): H => {
  const handler = handlers.get(row.esquemaIndex);
  if (!handler) throw new Error(`Fila sin manejador: ${row.rowId}`);
  return handler;
};

/** Un `test()` por cada fila de una historia de API, y al final un JSON con todo lo observado. */
export const defineApiRows = (run: ApiStoryRun): void =>
  register({ story: run.story, surface: run.surface, tenants: run.tenants, browser: false, hasHandler: (index) => run.handlers.has(index), execute: (row) => handlerOf(run.handlers, row)(row) });

/** Igual, para una historia de web o de la app móvil servida como web: cada fila recibe su `page` y su `context`. */
export const defineBrowserRows = (run: BrowserStoryRun): void =>
  register({
    story: run.story,
    surface: run.surface,
    tenants: run.tenants,
    browser: true,
    hasHandler: (index) => run.handlers.has(index),
    execute: (row, fixtures) => {
      if (!fixtures) throw new Error('Una fila de navegador se ejecutó sin página');
      return handlerOf(run.handlers, row)(row, fixtures);
    },
  });
