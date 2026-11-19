// Informe por fila de la ejecución de los ejemplos de UNA épica posterior al piloto. Lee el manifiesto
// docs/story-runs/epicas/manifest.json, los resultados docs/story-runs/epicas/<EP>/US-*.json (los escribe
// `support/framework.ts`), la evidencia de la puerta (docs/story-runs/aislamiento-epicas.json), el registro de construcción del
// piloto (docs/story-runs/builds.json, solo lectura) y los centinelas de la base aislada (docs/story-runs/epicas/centinelas.json).
// Escribe docs/story-runs/epicas/<EP>/informe.md y resumen.json. Sale con código 1 si falta alguna fila del manifiesto, si hay
// errores del arnés o si algo de la procedencia no cuadra.
//
// Uso (desde la raíz): node e2e/story-runs-epicas/report.mjs EP-MFA
//
// No toca nada del piloto (EP-LOGIN): ni su informe, ni su manifiesto, ni su evidencia de aislamiento.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const epic = process.argv[2];
if (!epic || !/^EP-[A-Z0-9-]+$/.test(epic)) {
  console.error('Uso: node e2e/story-runs-epicas/report.mjs EP-<SLUG>');
  process.exit(2);
}
const slug = epic.slice(3);
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const results = process.env.SIGPRO_STORIES_RESULTS_DIR ?? resolve(root, 'docs', 'story-runs');
const dir = resolve(results, 'epicas', epic);

const readJson = (path) => (existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : null);
const git = (args) => {
  try {
    return execFileSync('git', args, { encoding: 'utf8', cwd: root }).trim();
  } catch {
    return null;
  }
};

const manifest = readJson(resolve(results, 'epicas', 'manifest.json'));
const gate = readJson(resolve(results, 'aislamiento-epicas.json'));
const buildsRecord = readJson(resolve(results, 'builds.json'));
const sentinelsFile = readJson(resolve(results, 'epicas', 'centinelas.json'));
const sentinels = Array.isArray(sentinelsFile) ? sentinelsFile : (sentinelsFile?.checks ?? sentinelsFile?.sentinels ?? []);
const problems = [];
if (!manifest) {
  console.error('Falta docs/story-runs/epicas/manifest.json: genera el manifiesto con «pnpm stories:manifest --out docs/story-runs/epicas/manifest.json».');
  process.exit(1);
}

const storyPrefix = `US-${slug}-`;
const manifestRows = manifest.rows.filter((row) => row.story.startsWith(storyPrefix));
const storyIds = [...new Set(manifestRows.map((row) => row.story))].sort();
const manifestOf = (story) => manifestRows.filter((row) => row.story === story);
if (manifestRows.length === 0) problems.push(`El manifiesto no tiene filas de ${epic}`);

const stories = existsSync(dir)
  ? readdirSync(dir)
      .filter((name) => /^US-[A-Z0-9-]+\.json$/.test(name))
      .map((name) => readJson(resolve(dir, name)))
      .filter(Boolean)
  : [];
for (const id of storyIds) if (!stories.some((story) => story.header.story === id)) problems.push(`Falta el resultado completo de ${id} (¿solo hay uno parcial?)`);

// --- Coherencia fila a fila con el manifiesto ---------------------------------------------------------------------------
const NO_EXEC = new Set(['no-ejecutable', 'pendiente-de-decision']);
const rowsByStory = new Map();
for (const story of stories) {
  const expected = new Set(manifestOf(story.header.story).map((row) => row.rowId));
  const seenIds = new Set();
  for (const row of story.rows) {
    if (!expected.has(row.rowId)) problems.push(`${story.header.story}: la fila ${row.rowId} no está en el manifiesto`);
    if (seenIds.has(row.rowId)) problems.push(`${story.header.story}: la fila ${row.rowId} está duplicada`);
    seenIds.add(row.rowId);
    if (row.verdict === 'error-de-prueba') problems.push(`Error del arnés en ${row.rowId}: ${row.observed}`);
  }
  for (const id of expected) if (!seenIds.has(id)) problems.push(`${story.header.story}: falta la fila ${id} del manifiesto`);
  if (story.header.storiesCommit !== manifest.storiesCommit) problems.push(`${story.header.story}: commit de las historias ${story.header.storiesCommit} ≠ manifiesto ${manifest.storiesCommit}`);
  if (story.header.apiPlantedBugs !== false) problems.push(`${story.header.story}: la API tenía los defectos del curso activos o desconocidos (${story.header.apiPlantedBugs})`);
  if (story.header.harnessDirty !== false) problems.push(`${story.header.story}: el arnés tenía cambios sin confirmar al ejecutar`);
  const settings = story.header.settings ?? {};
  if (!(settings.workers === 1 && settings.retries === 0 && settings.repeatEach === 1 && settings.fullyParallel === false && settings.shard === null)) problems.push(`${story.header.story}: ajustes de ejecución que no son en serie (${JSON.stringify(settings)})`);
  rowsByStory.set(story.header.story, story);
}
if (manifest.dirty) problems.push('El manifiesto se generó con cambios sin confirmar en docs/user-stories');
if (git(['cat-file', '-e', `${manifest.storiesCommit}^{commit}`]) === null) problems.push(`El commit de las historias ${String(manifest.storiesCommit).slice(0, 7)} no existe`);

// --- La puerta de aislamiento de cada ejecución ---------------------------------------------------------------------------
const runIds = [...new Set(stories.map((story) => story.header.runId))];
const gateRuns = runIds.map((id) => (gate?.runs ?? []).find((run) => run.runId === id));
for (const [index, run] of gateRuns.entries()) {
  const id = runIds[index];
  if (!run) {
    problems.push(`${id}: no consta ninguna puerta de aislamiento para esa ejecución`);
    continue;
  }
  if (run.passed !== true) problems.push(`${id}: la puerta de aislamiento no consta superada`);
  if (run.harnessDirty !== false) problems.push(`${id}: el arnés tenía cambios sin confirmar durante la puerta`);
  const environment = run.environment;
  if (!environment) {
    problems.push(`${id}: la puerta no registró el entorno`);
    continue;
  }
  if (environment.ports?.['5432'] !== false) problems.push(`${id}: el puerto 5432 (Docker del usuario) no consta inaccesible`);
  if (environment.ports?.[String(environment.isolatedPgPort)] !== true) problems.push(`${id}: no consta accesible el PostgreSQL aislado (${environment.isolatedPgPort})`);
  const apiMain = resolve(root, 'apps', 'api', 'dist', 'main.js').replaceAll('\\', '/').toLowerCase();
  const apiCommand = String(environment.apiProcess?.commandLine ?? '').replaceAll('\\', '/').replaceAll('"', '').toLowerCase();
  if (!apiCommand.includes(apiMain)) problems.push(`${id}: no consta que el proceso del puerto de la API ejecute ${apiMain}`);
  for (const story of stories.filter((entry) => entry.header.runId === id)) {
    if (run.commit !== story.header.commit) problems.push(`${story.header.story}: la puerta y las filas no son del mismo commit del arnés`);
    if (!(story.header.startedAt >= run.endedAt)) problems.push(`${story.header.story}: sus filas empezaron antes de que terminara la puerta de su ejecución`);
    const surface = story.header.surface;
    if (surface === 'web' && environment.served?.web?.matchesDist !== true) problems.push(`${story.header.story}: no consta que la web sirva el index.html del dist`);
    if (surface === 'expo-web' && environment.served?.mobile?.matchesDist !== true) problems.push(`${story.header.story}: no consta que la app móvil sirva el index.html del dist`);
  }
}
const windows = runIds
  .map((id) => {
    const run = (gate?.runs ?? []).find((entry) => entry.runId === id);
    const ends = stories.filter((story) => story.header.runId === id).map((story) => story.header.executedAt);
    return run ? { id, start: run.startedAt, end: ends.sort().at(-1) } : null;
  })
  .filter(Boolean)
  .sort((a, b) => (a.start < b.start ? -1 : 1));
for (let i = 1; i < windows.length; i += 1) if (windows[i].start < windows[i - 1].end) problems.push(`Las ejecuciones ${windows[i - 1].id} y ${windows[i].id} se solapan en el tiempo`);

// --- El arnés: un solo commit, sin cambios desde entonces ----------------------------------------------------------------
const HARNESS_PATHS = ['e2e/story-runs-epicas', 'e2e/playwright.stories-epicas.config.ts', ':(exclude)e2e/story-runs-epicas/report.mjs'];
const harnessCommits = [...new Set(stories.map((story) => story.header.commit))];
if (harnessCommits.length > 1) problems.push(`Las ejecuciones no son del mismo commit del arnés: ${harnessCommits.map((commit) => commit.slice(0, 7)).join(', ')}`);
const harnessUnchanged = harnessCommits.length === 1 && git(['diff', '--quiet', harnessCommits[0], 'HEAD', '--', ...HARNESS_PATHS]) !== null;
if (!harnessUnchanged) problems.push('El arnés cambió desde el commit con el que se ejecutó (o ese commit ya no existe)');
if (harnessCommits.length === 1 && git(['merge-base', '--is-ancestor', harnessCommits[0], 'HEAD']) === null) problems.push(`El commit del arnés ${harnessCommits[0].slice(0, 7)} no es antecesor de HEAD`);

// --- Procedencia de los builds (el registro del piloto, solo lectura) ------------------------------------------------------
const BUILD_INPUTS = ['apps', 'packages', 'examples', 'package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml', 'tsconfig.base.json', 'docs/GUIA-ALUMNO.md', '.github/workflows/students-e2e.yml'];
const buildProblems = [];
if (!buildsRecord) buildProblems.push('No hay registro de construcción (docs/story-runs/builds.json): la app ejecutada no se puede atribuir a un commit');
else {
  const missingInputs = BUILD_INPUTS.filter((input) => !(buildsRecord.inputs ?? []).includes(input));
  if (missingInputs.length > 0) buildProblems.push(`El registro de construcción no cubre estas entradas: ${missingInputs.join(', ')}`);
  if (buildsRecord.complete !== true) buildProblems.push('El registro de construcción no está completo');
  if (buildsRecord.changedDuringBuild) buildProblems.push(`La construcción se invalidó: ${buildsRecord.changedDuringBuild}`);
  if (buildsRecord.inputsDirty !== false) buildProblems.push('Los builds se construyeron con entradas sin confirmar');
  for (const run of gateRuns.filter((entry) => entry?.environment)) {
    for (const build of buildsRecord.builds ?? []) {
      const measured = run.environment.builds?.[build.name];
      if (!measured || measured.sha256 !== build.fingerprint?.sha256) buildProblems.push(`La huella del build ${build.name} medida por la puerta (${run.runId}) no coincide con la registrada al construirlo`);
    }
    if (!(buildsRecord.endedAt && buildsRecord.endedAt <= run.startedAt)) buildProblems.push(`La ejecución ${run.runId} empezó antes de que terminara la construcción de los builds`);
  }
  for (const [envFile, recorded] of Object.entries(buildsRecord.envFiles ?? {})) {
    const path = resolve(root, envFile);
    const current = existsSync(path) ? createHash('sha256').update(readFileSync(path)).digest('hex') : null;
    if (current !== recorded.sha256) buildProblems.push(`El archivo de entorno ${envFile} cambió desde la construcción de los builds`);
  }
  if (git(['cat-file', '-e', `${buildsRecord.commit}^{commit}`]) === null) buildProblems.push(`El commit de los builds ${String(buildsRecord.commit).slice(0, 7)} ya no existe`);
  else {
    if (git(['merge-base', '--is-ancestor', buildsRecord.commit, 'HEAD']) === null) buildProblems.push('El commit de los builds no es antecesor de HEAD');
    if (git(['diff', '--quiet', buildsRecord.commit, 'HEAD', '--', ...BUILD_INPUTS]) === null) buildProblems.push('Las entradas de los builds cambiaron entre el commit con el que se construyeron y HEAD');
  }
}
problems.push(...buildProblems);

// --- La API escribe en la base aislada: un centinela de la MISMA instancia de la API, anterior a la puerta -------------------
const SENTINEL_TOLERANCE_MS = 2000;
for (const run of gateRuns.filter((entry) => entry?.environment)) {
  const apiStart = Date.parse(run.environment.served?.apiStartedAt ?? '');
  const match = sentinels.find(
    (sentinel) =>
      sentinel.foundInIsolatedDb === true &&
      sentinel.port5432Accessible === false &&
      sentinel.apiUrl === run.environment.served?.urls?.api &&
      sentinel.isolatedPgPort === run.environment.isolatedPgPort &&
      Math.abs(Date.parse(sentinel.apiStartedAt) - apiStart) <= SENTINEL_TOLERANCE_MS &&
      sentinel.checkedAt <= run.startedAt,
  );
  if (!match) problems.push(`${run.runId}: no consta que la API de esa ejecución escribiera en la base aislada (ningún centinela de la misma instancia de la API anterior a la puerta)`);
}

// --- Recuentos ---------------------------------------------------------------------------------------------------------------
const VERDICTS = ['coincide', 'discrepa', 'pendiente-de-decision', 'no-ejecutable', 'error-de-prueba'];
const totalsOf = (rows) => Object.fromEntries(VERDICTS.map((verdict) => [verdict, rows.filter((row) => row.verdict === verdict).length]));
const allRows = stories.flatMap((story) => story.rows.map((row) => ({ ...row, story: story.header.story, surface: story.header.surface })));
const grand = { filas: allRows.length, ...totalsOf(allRows) };
const executed = allRows.filter((row) => !NO_EXEC.has(row.verdict) && row.verdict !== 'error-de-prueba').length;
const complete = problems.length === 0 && stories.length === storyIds.length && allRows.length === manifestRows.length;
const everyRowExecuted = complete && executed === manifestRows.length;

const cellText = (row) => Object.entries(row.cells).map(([key, value]) => `${key}=${value}`).join(' · ').replaceAll('|', '\\|');
const flat = (text) => String(text ?? '').replaceAll('\n', ' ').replaceAll('|', '\\|');
const lines = [];
const out = (text = '') => lines.push(text);
out(`# Ejecución de ${epic}: resultado por fila`);
out();
out('> Documento del instructor, **ignorado por git** (repositorio público). Lo genera `node e2e/story-runs-epicas/report.mjs ' + epic + '` a partir de `docs/story-runs/epicas/' + epic + '/US-*.json`; no se edita a mano.');
out();
out('## Cómo se ejecutó');
out();
out(`- **Qué se probó (historias):** commit \`${manifest.storiesCommit?.slice(0, 7) ?? '?'}\`, sin cambios sin confirmar al ejecutar; manifiesto generado ${manifest.generatedAt}.`);
out(`- **Con qué se probó (arnés):** commit ${harnessCommits.map((commit) => `\`${commit.slice(0, 7)}\``).join(', ') || '?'}${harnessUnchanged ? ', sin cambios desde entonces en e2e/story-runs-epicas ni en su config' : ' (**el arnés cambió desde entonces**)'}. Es un arnés APARTE del del piloto: no modifica nada de e2e/story-runs/ ni de su evidencia.`);
out(`- **Entorno:** PostgreSQL portátil aislado, API con los defectos del curso apagados, web y app móvil servidas como web de Expo a 390 px (NO es nativo). La puerta (\`e2e/story-runs-epicas/gate/aislamiento.spec.ts\`) midió en cada ejecución: ${gateRuns.filter((run) => run?.environment).map((run) => `5432 ${run.environment.ports?.['5432'] ? '**accesible**' : 'inaccesible'} y ${run.environment.isolatedPgPort} ${run.environment.ports?.[String(run.environment.isolatedPgPort)] ? 'accesible' : '**inaccesible**'}`).join('; ') || 'sin datos'}.`);
out(`- **Builds:** ${buildProblems.length === 0 && buildsRecord ? `construidos desde el commit \`${buildsRecord.commit.slice(0, 7)}\` (registro del piloto, solo lectura); su huella coincide con la medida por la puerta y ninguna entrada de los builds ha cambiado hasta HEAD.` : '**procedencia no demostrada** (ver problemas).'}`);
out(`- **Ejecuciones:** ${runIds.map((id) => `\`${id}\` (${stories.filter((story) => story.header.runId === id).map((story) => story.header.story).join(', ')})`).join('; ') || 'ninguna'}.`);
out();
out('## Resumen');
out();
out(`- **${grand.filas} de ${manifestRows.length} filas** del manifiesto registradas; ejecutadas: **${executed}**.`);
out(`- coinciden: **${grand.coincide}** · discrepan: **${grand.discrepa}** · pendientes de decisión: **${grand['pendiente-de-decision']}** · no ejecutables: **${grand['no-ejecutable']}** · errores del arnés: **${grand['error-de-prueba']}**.`);
out(`- **¿Se ejecutaron todas las filas?** ${everyRowExecuted ? 'Sí.' : 'No: quedan filas sin ejecutar o la ejecución no es íntegra (ver problemas).'}`);
out();
out('| Historia | Superficie | Filas | Coinciden | Discrepan | Pendientes | No ejecutables | Error |');
out('| --- | --- | --- | --- | --- | --- | --- | --- |');
for (const id of storyIds) {
  const story = rowsByStory.get(id);
  const totals = totalsOf(story?.rows ?? []);
  out(`| ${id} | ${story?.header.surface ?? '—'} | ${story?.rows.length ?? 0} de ${manifestOf(id).length} | ${totals.coincide} | ${totals.discrepa} | ${totals['pendiente-de-decision']} | ${totals['no-ejecutable']} | ${totals['error-de-prueba']} |`);
}
out();
out('## Problemas de integridad');
out();
out(problems.length === 0 ? 'Ninguno.' : problems.map((problem) => `- ${problem}`).join('\n'));
out();
const discrepancies = allRows.filter((row) => row.verdict === 'discrepa');
out('## Discrepancias (la app no hace lo que dice la historia)');
out();
out(discrepancies.length === 0 ? 'Ninguna.' : discrepancies.map((row) => `- **${row.rowId}** (${cellText(row)}): esperaba ${flat(row.expected)}; observó ${flat(row.observed)}${row.note ? `. ${flat(row.note)}` : ''}`).join('\n'));
out();
const notExecuted = allRows.filter((row) => NO_EXEC.has(row.verdict));
out('## No ejecutadas');
out();
out(notExecuted.length === 0 ? 'Ninguna.' : notExecuted.map((row) => `- **${row.rowId}**: ${flat(row.note ?? row.observed)}`).join('\n'));
out();
out('## Detalle por fila');
for (const id of storyIds) {
  const story = rowsByStory.get(id);
  out();
  out(`### ${id}`);
  out();
  if (!story) {
    out('Sin resultado completo.');
    continue;
  }
  out('| Fila | Celdas | Esperado | Observado | Veredicto | ms |');
  out('| --- | --- | --- | --- | --- | --- |');
  for (const row of story.rows) out(`| ${row.rowId} | ${cellText(row)} | ${flat(row.expected)} | ${flat(row.observed)}${row.note ? ` _(${flat(row.note)})_` : ''} | ${row.verdict} | ${row.ms} |`);
}
out();
mkdirSync(dir, { recursive: true });
writeFileSync(resolve(dir, 'informe.md'), `${lines.join('\n')}\n`, 'utf8');
writeFileSync(
  resolve(dir, 'resumen.json'),
  `${JSON.stringify({ epic, storiesCommit: manifest.storiesCommit, harnessCommits, rows: allRows.length, manifestRows: manifestRows.length, executed, everyRowExecuted, totals: grand, perStory: Object.fromEntries(storyIds.map((id) => [id, totalsOf(rowsByStory.get(id)?.rows ?? [])])), problems }, null, 2)}\n`,
  'utf8',
);
console.log(`${epic}: ${grand.filas}/${manifestRows.length} filas, ejecutadas ${executed}; coinciden ${grand.coincide}, discrepan ${grand.discrepa}, no ejecutables ${grand['no-ejecutable']}, pendientes ${grand['pendiente-de-decision']}, error ${grand['error-de-prueba']}; problemas: ${problems.length}`);
process.exit(problems.length === 0 ? 0 : 1);
