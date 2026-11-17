// Informe por fila de la ejecución de los ejemplos de las historias. Lee docs/story-runs/manifest.json, los resultados
// docs/story-runs/EP-LOGIN/US-*.json (los escribe el marco `support/rows.ts`) y docs/story-runs/entorno.json, y escribe
// docs/story-runs/EP-LOGIN/informe.md y resumen.json. Falla (código 1) si falta alguna fila del manifiesto, si hay
// `error-de-prueba` o si las cabeceras no coinciden (distinto commit de las historias o defectos del curso activos).
// Uso (desde la raíz): node e2e/story-runs/report.mjs
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..', '..');
// SIGPRO_STORIES_RESULTS_DIR solo lo usa el autotest (report.selftest.mjs) para probar el informe sobre una copia manipulada
const results = process.env.SIGPRO_STORIES_RESULTS_DIR ?? resolve(root, 'docs', 'story-runs');
const dir = resolve(results, 'EP-LOGIN');

const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));
const manifest = readJson(resolve(results, 'manifest.json'));
const entorno = existsSync(resolve(results, 'entorno.json')) ? readJson(resolve(results, 'entorno.json')) : null;
const gate = existsSync(resolve(results, 'aislamiento.json')) ? readJson(resolve(results, 'aislamiento.json')) : null;
const buildsRecord = existsSync(resolve(results, 'builds.json')) ? readJson(resolve(results, 'builds.json')) : null;
const sentinels = existsSync(resolve(results, 'centinelas.json')) ? readJson(resolve(results, 'centinelas.json')) : [];
const files = readdirSync(dir).filter((name) => /^US-.*\.json$/.test(name)).sort();
const stories = files.map((name) => readJson(resolve(dir, name)));

const REQUIRED_SETTINGS = { workers: 1, retries: 0, repeatEach: 1, fullyParallel: false, shard: null };
const git = (args) => {
  try {
    return execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
  } catch {
    return null;
  }
};
const sameSettings = (settings) => Boolean(settings) && Object.keys(REQUIRED_SETTINGS).every((key) => settings[key] === REQUIRED_SETTINGS[key]);

const VERDICTS = ['coincide', 'discrepa', 'pendiente-de-decision', 'no-ejecutable', 'error-de-prueba'];
const SURFACE_LABEL = { api: 'API (HTTP)', web: 'Web, escritorio 1440 px', 'expo-web': 'App móvil como web de Expo a 390 px (NO nativo)' };

// --- Comprobaciones de integridad ---------------------------------------------------------------------------------
const problems = [];
const expectedIds = new Set(manifest.rows.map((row) => row.rowId));
const seen = new Map();
for (const story of stories) {
  for (const row of story.rows) {
    if (seen.has(row.rowId)) problems.push(`Fila duplicada en los resultados: ${row.rowId}`);
    if (!VERDICTS.includes(row.verdict)) problems.push(`Veredicto desconocido «${row.verdict}» en ${row.rowId}`);
    seen.set(row.rowId, { story, row });
  }
}
for (const id of expectedIds) if (!seen.has(id)) problems.push(`Falta el resultado de la fila ${id}`);
for (const id of seen.keys()) if (!expectedIds.has(id)) problems.push(`Resultado de una fila que no está en el manifiesto: ${id}`);
for (const story of stories) {
  if (story.header.storiesCommit !== manifest.storiesCommit) problems.push(`${story.header.story}: commit de las historias ${story.header.storiesCommit} ≠ manifiesto ${manifest.storiesCommit}`);
  if (story.header.harnessDirty !== false) problems.push(`${story.header.story}: el arnés tenía cambios sin confirmar al ejecutar (harnessDirty=${story.header.harnessDirty}); el resultado no se puede asociar a un commit`);
  if (!sameSettings(story.header.settings)) problems.push(`${story.header.story}: la ejecución no consta en serie (ajustes efectivos ${JSON.stringify(story.header.settings ?? null)}; se exige ${JSON.stringify(REQUIRED_SETTINGS)})`);
  const gateRun = (gate?.runs ?? []).find((run) => run.runId === story.header.runId);
  if (!gateRun?.passed) problems.push(`${story.header.story}: la puerta de aislamiento no consta como superada en su ejecución (runId ${story.header.runId})`);
  else {
    const environment = gateRun.environment;
    if (!environment) problems.push(`${story.header.story}: la puerta no registró el entorno de su ejecución`);
    else {
      const pgPort = String(environment.isolatedPgPort ?? '');
      if (environment.ports?.['5432'] !== false) problems.push(`${story.header.story}: el puerto 5432 (la base de datos de Docker del usuario) estaba accesible o no consta: no se puede demostrar que la API no hablara con ella`);
      if (!pgPort || ['5432', '3000', '5173', '8081'].includes(pgPort)) problems.push(`${story.header.story}: el puerto registrado para PostgreSQL aislado (${pgPort || 'ninguno'}) no es válido (no puede ser el de Docker ni el de una aplicación)`);
      else if (environment.ports?.[pgPort] !== true) problems.push(`${story.header.story}: el puerto ${pgPort} (PostgreSQL aislado) no consta accesible durante la puerta`);
      if (!sameSettings(environment.settings)) problems.push(`${story.header.story}: la puerta registró ajustes de ejecución que no son los de la serie`);
      const served = environment.served;
      if (!served) problems.push(`${story.header.story}: la puerta no registró qué sirven los puertos`);
      else {
        for (const [name, url] of Object.entries(served.urls ?? {})) if (!/^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?(\/|$)/.test(url)) problems.push(`${story.header.story}: la URL de ${name} (${url}) no es local`);
        if (served.apiStartedAfterBuild !== true) problems.push(`${story.header.story}: no consta que la API arrancara DESPUÉS de construir su dist (apiStartedAfterBuild=${served.apiStartedAfterBuild})`);
        if (story.header.surface === 'web' && served.web?.matchesDist !== true) problems.push(`${story.header.story}: no consta que lo que sirve la web sea el index.html del dist (matchesDist=${served.web?.matchesDist})`);
        if (story.header.surface === 'expo-web' && served.mobile?.matchesDist !== true) problems.push(`${story.header.story}: no consta que lo que sirve la app móvil sea el index.html del dist (matchesDist=${served.mobile?.matchesDist})`);
      }
    }
    if (gateRun.commit !== story.header.commit) problems.push(`${story.header.story}: la puerta y las filas de su ejecución no son del mismo commit del arnés (${gateRun.commit?.slice(0, 7) ?? '?'} frente a ${story.header.commit?.slice(0, 7) ?? '?'})`);
    if (gateRun.harnessDirty !== false) problems.push(`${story.header.story}: el arnés tenía cambios sin confirmar durante la puerta de su ejecución`);
    if (!(story.header.startedAt >= gateRun.endedAt)) problems.push(`${story.header.story}: sus filas empezaron (${story.header.startedAt ?? 'sin hora'}) antes de que terminara la puerta de su ejecución (${gateRun.endedAt})`);
  }
  if (story.header.apiPlantedBugs !== false) problems.push(`${story.header.story}: la API tenía los defectos del curso activos o desconocidos (${story.header.apiPlantedBugs})`);
}
// Las ejecuciones (una por superficie) deben ser coherentes entre sí: mismo commit del arnés, sin cambios desde entonces y la
// misma app servida (mismas huellas de build). Los builds NO tienen commit conocido: ver «Contra qué app se probó».
const runIds = [...new Set(stories.map((story) => story.header.runId))];
const gateRunsUsed = runIds.map((id) => (gate?.runs ?? []).find((run) => run.runId === id)).filter((run) => run?.environment);
const buildKey = (run) => JSON.stringify(Object.entries(run.environment.builds).map(([name, build]) => [name, build.sha256]));
if (new Set(gateRunsUsed.map(buildKey)).size > 1) problems.push('Los builds servidos (dist) cambiaron entre las ejecuciones: no es la misma app en las tres superficies');
for (const run of gateRunsUsed) for (const [name, build] of Object.entries(run.environment.builds)) if (!build.exists) problems.push(`El build ${name} (${build.path}) no existía durante la ejecución ${run.runId}`);
const harnessCommits = [...new Set(stories.map((story) => story.header.commit))];
if (harnessCommits.length > 1) problems.push(`Las ejecuciones no son del mismo commit del arnés: ${harnessCommits.map((commit) => commit.slice(0, 7)).join(', ')}`);
// Las herramientas que no participan en una ejecución (informe, autotest del informe, script de construcción) no cuentan como cambio del arnés
const HARNESS_PATHS = ['e2e/story-runs', 'e2e/playwright.stories.config.ts', ':(exclude)e2e/story-runs/report.mjs', ':(exclude)e2e/story-runs/report.selftest.mjs', ':(exclude)e2e/story-runs/build.mjs'];
const harnessUnchanged = harnessCommits.length === 1 && git(['diff', '--quiet', harnessCommits[0], 'HEAD', '--', ...HARNESS_PATHS]) !== null;
if (!harnessUnchanged) problems.push('El arnés cambió desde el commit con el que se ejecutó (o ese commit ya no existe): los resultados no corresponden al arnés actual');
if (harnessCommits.length === 1 && git(['merge-base', '--is-ancestor', harnessCommits[0], 'HEAD']) === null) problems.push(`El commit del arnés ${harnessCommits[0].slice(0, 7)} no es antecesor de HEAD (¿historia reescrita?)`);
// Dos ejecuciones a la vez contra la misma pila se pisarían: las ventanas [inicio de la puerta, última fila] no pueden solaparse
const windows = runIds
  .map((id) => {
    const gateRun = (gate?.runs ?? []).find((run) => run.runId === id);
    const ends = stories.filter((story) => story.header.runId === id).map((story) => story.header.executedAt);
    return gateRun ? { id, start: gateRun.startedAt, end: ends.sort().at(-1) } : null;
  })
  .filter(Boolean)
  .sort((a, b) => (a.start < b.start ? -1 : 1));
for (let i = 1; i < windows.length; i += 1) if (windows[i].start < windows[i - 1].end) problems.push(`Las ejecuciones ${windows[i - 1].id} y ${windows[i].id} se solapan en el tiempo: pudieron pisarse sobre la misma pila`);
// --- Procedencia de los builds: solo se da por demostrada si el registro de construcción (builds.json) es completo y coherente ---
// El registro lo escribe `e2e/story-runs/build.mjs`: commit, entradas sin confirmar, comando y huella de cada build. No está
// firmado: la demostración vale en la medida en que ese registro sea fiable.
const BUILD_INPUTS = ['apps', 'packages', 'examples', 'package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml', 'tsconfig.base.json'];
const problemsBeforeBuilds = problems.length;
if (buildsRecord) {
  if (buildsRecord.complete !== true) problems.push(`El registro de construcción no está completo (pendiente: ${(buildsRecord.pending ?? []).join(', ') || 'desconocido'})`);
  if (buildsRecord.inputsDirty !== false) problems.push('Los builds se construyeron con entradas sin confirmar: no se pueden atribuir a un commit');
  for (const build of buildsRecord.builds ?? []) if (build.exitCode !== 0 || build.aborted) problems.push(`El build ${build.name} no terminó bien (código ${build.exitCode}${build.aborted ? ', abortado por memoria' : ''})`);
  for (const run of gateRunsUsed) {
    for (const build of buildsRecord.builds ?? []) {
      const measured = run.environment.builds?.[build.name];
      if (!measured || measured.sha256 !== build.fingerprint?.sha256) problems.push(`La huella del build ${build.name} medida por la puerta (${run.runId}) no coincide con la registrada al construirlo`);
    }
    if (!(buildsRecord.endedAt && buildsRecord.endedAt <= run.startedAt)) problems.push(`La ejecución ${run.runId} empezó antes de que terminara la construcción de los builds`);
  }
  // Un archivo de entorno (ignorado por git) que cambie después de construir invalidaría la atribución del build
  for (const [file, recorded] of Object.entries(buildsRecord.envFiles ?? {})) {
    const path = resolve(root, file);
    const current = existsSync(path) ? createHash('sha256').update(readFileSync(path)).digest('hex') : null;
    if (current !== recorded.sha256) problems.push(`El archivo de entorno ${file} cambió (o desapareció) desde la construcción de los builds`);
  }
  if (git(['cat-file', '-e', `${buildsRecord.commit}^{commit}`]) === null) problems.push(`El commit con el que se construyeron los builds (${String(buildsRecord.commit).slice(0, 7)}) ya no existe`);
  else {
    if (git(['merge-base', '--is-ancestor', buildsRecord.commit, 'HEAD']) === null) problems.push(`El commit de los builds ${buildsRecord.commit.slice(0, 7)} no es antecesor de HEAD`);
    if (git(['diff', '--quiet', buildsRecord.commit, 'HEAD', '--', ...BUILD_INPUTS]) === null) problems.push('Las entradas de los builds cambiaron entre el commit con el que se construyeron y HEAD');
  }
}
const buildsProven = Boolean(buildsRecord) && problems.length === problemsBeforeBuilds;

// --- La API usa la base aislada: un centinela (marcador escrito por la API y hallado por consulta directa en PostgreSQL) de la
// MISMA instancia de la API (mismo arranque) y anterior a la puerta de cada ejecución ----------------------------------------
for (const run of gateRunsUsed) {
  const apiStart = Date.parse(run.environment.served?.apiStartedAt ?? '');
  const match = sentinels.find((sentinel) => sentinel.foundInIsolatedDb === true && sentinel.port5432Accessible === false && Math.abs(Date.parse(sentinel.apiStartedAt) - apiStart) <= 5000 && sentinel.checkedAt <= run.startedAt);
  if (!match) problems.push(`${run.runId}: no consta que la API de esa ejecución escribiera en la base aislada (ningún centinela de la misma instancia de la API comprobado antes de la puerta)`);
}
const withError = [...seen.values()].filter(({ row }) => row.verdict === 'error-de-prueba');
for (const { row } of withError) problems.push(`Error del arnés en ${row.rowId}: ${row.observed}`);
const storiesInManifest = [...new Set(manifest.rows.map((row) => row.story))].sort();
for (const id of storiesInManifest) if (!stories.some((story) => story.header.story === id)) problems.push(`No hay archivo de resultados de ${id}`);

// --- Formato --------------------------------------------------------------------------------------------------------
const cell = (text, max = 220) => {
  const flat = String(text ?? '').replace(/\r?\n/g, ' ').replace(/\|/g, '\\|').trim();
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
};
const cellsSummary = (cells) => cell(Object.entries(cells).map(([key, value]) => `${key}=${value}`).join('; '), 260);
const count = (rows, verdict) => rows.filter((row) => row.verdict === verdict).length;

const totalsOf = (rows) => Object.fromEntries(VERDICTS.map((verdict) => [verdict, count(rows, verdict)]));
const allRows = stories.flatMap((story) => story.rows);
const lines = [];
const out = (text = '') => lines.push(text);

out('# Ejecución del piloto EP-LOGIN: resultado por fila');
out();
out('> Documento del instructor, **ignorado por git** (repositorio público). Lo genera `node e2e/story-runs/report.mjs` a partir de `docs/story-runs/EP-LOGIN/US-*.json`; no se edita a mano.');
out();
out('## Cómo se ejecutó');
out();
out(`Son **tres cosas distintas** y no se mezclan: las historias que se probaron, el arnés con el que se probaron y los builds contra los que se probaron. ${buildsProven ? 'De los tres consta un commit (el de los builds es el de sus fuentes: ver más abajo).' : 'De los dos primeros hay commit; **de los builds no**.'}`);
out();
out(`- **Qué se probó (historias):** commit \`${manifest.storiesCommit?.slice(0, 7) ?? '?'}\`, sin cambios sin confirmar al ejecutar; manifiesto generado ${manifest.generatedAt}.`);
out(`- **Con qué se probó (arnés):** commit ${harnessCommits.map((commit) => `\`${commit.slice(0, 7)}\``).join(', ')}${harnessCommits.length === 1 ? ' (el mismo en todas las ejecuciones)' : ''}; ${harnessUnchanged ? 'sin cambios desde entonces en `e2e/story-runs` ni en el config' : '**el arnés ha cambiado desde entonces**'}. Cada historia se ejecuta entera de una vez, una ejecución por superficie, siempre en serie (un worker, sin reintentos ni repeticiones ni fragmentos: lo comprueba la puerta con los ajustes EFECTIVOS):`);
for (const story of stories) out(`  - ${story.header.story}: ${SURFACE_LABEL[story.header.surface] ?? story.header.surface} · runId ${story.header.runId} · empezó ${story.header.startedAt ?? '?'} · terminó ${story.header.executedAt}`);
out(`- **Aislamiento:** la puerta \`e2e/story-runs/gate/aislamiento.spec.ts\` es un proyecto del que dependen \`api\`, \`web\` y \`mobile\`, y cada historia se niega a ejecutar si la puerta no consta superada en SU ejecución. Consta superada en ${gateRunsUsed.filter((run) => run.passed).length} de las ${runIds.length} ejecuciones de estos resultados. En cada una midió, en ese momento: ${gateRunsUsed.map((run) => `5432 ${run.environment.ports['5432'] ? '**accesible**' : 'inaccesible'} y ${run.environment.isolatedPgPort} ${run.environment.ports[String(run.environment.isolatedPgPort)] ? 'accesible' : '**inaccesible**'} (Node ${run.environment.node}, el que ejecuta las pruebas; no el de la API)`).join('; ')}. Evidencia en \`docs/story-runs/aislamiento.json\`. Cada fila reinicia su tenant, comprueba que el caos está a cero y usa correos únicos y sesiones propias.`);
out(`- **La API usa la base aislada:** ${gateRunsUsed.map((run) => {
  const apiStart = Date.parse(run.environment.served?.apiStartedAt ?? '');
  const match = sentinels.find((sentinel) => sentinel.foundInIsolatedDb === true && sentinel.port5432Accessible === false && Math.abs(Date.parse(sentinel.apiStartedAt) - apiStart) <= 5000 && sentinel.checkedAt <= run.startedAt);
  return match ? `${run.runId}: la API (arrancada ${match.apiStartedAt}) escribió el marcador \`${match.email}\` y se halló por consulta directa en PostgreSQL (puerto ${match.isolatedPgPort}) a las ${match.checkedAt}; el 5432 estaba inaccesible` : `${run.runId}: **no consta**`;
}).join('; ')}. Es una comprobación por consulta directa de lo que escribe la API (script local \`entorno/db-sentinel.mjs\`), no una demostración de que la API no use además otra base.`);
out(`- **Qué NO verifica el arnés:** que el simulador de misión de la API esté apagado, ni la versión de la base de datos${entorno ? ` (la versión ${entorno.postgres.version.split(',')[0]} sale de \`entorno.json\`, una foto hecha a mano el ${entorno.capturedAt}, no medida por la ejecución)` : ''}.`);
out();
out('### Contra qué app se probó (builds)');
out();
const SOURCES = { api: ['apps/api', 'packages/shared'], web: ['apps/web', 'packages/shared'], mobile: ['apps/mobile', 'packages/shared'], shared: ['packages/shared'] };
if (buildsProven) {
  const since = git(['log', '--format=%h', `${buildsRecord.commit}..HEAD`]);
  out(`Los builds se construyeron **desde el commit \`${buildsRecord.commit.slice(0, 7)}\`** (con las entradas de los builds confirmadas; Node ${buildsRecord.node}, pnpm ${buildsRecord.pnpm}) con estos comandos, registrados por \`e2e/story-runs/build.mjs\` en \`builds.json\`:`);
  out();
  out('| Build | Comando | Terminó | Memoria libre mín. | Archivos | Bytes | Huella sha256 | Huella medida por la puerta |');
  out('| --- | --- | --- | ---: | ---: | ---: | --- | --- |');
  for (const build of buildsRecord.builds) {
    const same = gateRunsUsed.every((run) => run.environment.builds[build.name]?.sha256 === build.fingerprint.sha256);
    out(`| ${build.name} | \`${build.command}\` | ${build.endedAt} | ${build.minFreeMb ?? '—'} MB | ${build.fingerprint.files} | ${build.fingerprint.bytes} | \`${build.fingerprint.sha256.slice(0, 16)}…\` | ${same ? `coincide en las ${gateRunsUsed.length} ejecuciones` : '**NO coincide**'} |`);
  }
  out();
  out(`**Procedencia de los builds: demostrada por el registro de construcción.** La huella registrada al construir coincide con la que midió la puerta en cada ejecución, el commit de construcción es antecesor de HEAD y ninguna entrada de los builds (${BUILD_INPUTS.join(', ')}) ha cambiado entre \`${buildsRecord.commit.slice(0, 7)}\` y HEAD (${since ? since.split('\n').length : 0} commits posteriores, ninguno toca esas entradas). Archivos de entorno presentes al construir (solo su hash, sin cambios desde entonces): ${Object.keys(buildsRecord.envFiles ?? {}).join(', ') || 'ninguno'}; variables de entorno relevantes: ${Object.keys(buildsRecord.buildEnv ?? {}).join(', ') || 'ninguna'}. **Límite:** el registro no está firmado y la demostración supone que \`build.mjs\` se ejecutó tal cual. Es el commit de las FUENTES de los builds: el del arnés y el de las historias son otros (ver arriba).`);
} else {
  out('Se usan los `dist` que hay en disco; **ningún `dist` guarda de qué commit salió** y no hay un registro de construcción coherente que lo demuestre (`builds.json`). Lo único que se puede registrar es su huella y la fecha de sus archivos (medidas por la puerta en cada ejecución; si cambiaran entre ejecuciones, el informe lo marca como problema):');
  out();
  if (gateRunsUsed.length > 0) {
    out('| Build | Archivos | Bytes | Archivo más reciente | Huella sha256 | Commits posteriores a esa fecha que tocan su código |');
    out('| --- | ---: | ---: | --- | --- | --- |');
    for (const [name, build] of Object.entries(gateRunsUsed[0].environment.builds)) {
      const later = build.newestMtime ? git(['log', `--since=${build.newestMtime}`, '--format=%h', '--', ...(SOURCES[name] ?? [])]) : null;
      const laterList = later === null ? 'no se pudo consultar' : later === '' ? 'ninguno' : later.split('\n').join(', ');
      out(`| ${name} (\`${build.path}\`) | ${build.files} | ${build.bytes} | ${build.newestMtime ?? '—'} | \`${build.sha256?.slice(0, 16) ?? '—'}…\` | ${laterList} |`);
    }
  }
  out();
  out('**La procedencia de los builds NO está demostrada.** Por eso este informe **no afirma que la app ejecutada corresponda al commit final**. La última columna es solo un indicio por fechas (la fecha de un archivo no es la de su commit, y puede ir en sentido contrario). Para demostrarlo hay que reconstruir los builds desde el commit final con `node e2e/story-runs/build.mjs` y registrar su huella.');
}
out();
out('**Lo que la puerta comprobó de lo servido, en cada ejecución** (no prueba el commit, pero sí que lo servido es lo que hay en disco):');
for (const run of gateRunsUsed) {
  const served = run.environment.served;
  const yesNo = (value) => (value === true ? 'sí' : value === false ? '**NO**' : 'no se comprobó en esta ejecución (no había servidor)');
  out(`- ${stories.find((story) => story.header.runId === run.runId)?.header.surface ?? '?'} (${run.runId}): URLs ${Object.values(served.urls).join(', ')}; la web sirve el index.html del dist: ${yesNo(served.web.matchesDist)}; la app móvil sirve el index.html del dist: ${yesNo(served.mobile.matchesDist)}; la API arrancó (${served.apiStartedAt ?? '?'}) después de construir su dist y el del paquete compartido: ${yesNo(served.apiStartedAfterBuild)}.`);
}
out('- **Veredictos:** `coincide` (la app hace lo que dice la historia), `discrepa` (no lo hace; la historia es la fuente de verdad), `pendiente-de-decision` (depende de algo que la historia deja pendiente), `no-ejecutable` (no se pudo o no se debe ejecutar aquí; motivo en la nota). Un `error-de-prueba` sería un fallo del arnés y no se admite en la entrega.');
out('- **Tiempos:** la columna `ms` es el tiempo de la fila entera (preparación incluida), un dato, no un veredicto. Las historias no fijan plazos de respuesta.');
out();

out('## Resumen');
out();
out(`| Historia | Superficie | Filas | ${VERDICTS.join(' | ')} |`);
out(`| --- | --- | ---: | ${VERDICTS.map(() => '---:').join(' | ')} |`);
for (const story of stories) {
  const totals = totalsOf(story.rows);
  out(`| ${story.header.story} | ${SURFACE_LABEL[story.header.surface] ?? story.header.surface} | ${story.rows.length} | ${VERDICTS.map((verdict) => totals[verdict]).join(' | ')} |`);
}
const grand = totalsOf(allRows);
out(`| **Total** | | **${allRows.length}** | ${VERDICTS.map((verdict) => `**${grand[verdict]}**`).join(' | ')} |`);
out();
out(`**Completitud:** ${[...expectedIds].filter((id) => seen.has(id)).length} de ${expectedIds.size} filas del manifiesto tienen resultado${problems.length === 0 ? '' : ' (**hay problemas, ver abajo**)'}.`);
out();

if (problems.length > 0) {
  out('## PROBLEMAS DE INTEGRIDAD');
  out();
  for (const problem of problems) out(`- ${problem}`);
  out();
}

const discrepancies = allRows.filter((row) => row.verdict === 'discrepa');
out(`## Discrepancias (${discrepancies.length})`);
out();
if (discrepancies.length === 0) out('Ninguna.');
else {
  out('| Fila | Esquema | Celdas | Esperado | Observado | Nota |');
  out('| --- | --- | --- | --- | --- | --- |');
  for (const row of discrepancies) out(`| ${row.rowId} | ${cell(row.esquema, 80)} | ${cellsSummary(row.cells)} | ${cell(row.expected)} | ${cell(row.observed)} | ${cell(row.note ?? '')} |`);
}
out();

for (const [verdict, title] of [['pendiente-de-decision', 'Pendientes de decisión'], ['no-ejecutable', 'No ejecutables']]) {
  const rows = allRows.filter((row) => row.verdict === verdict);
  out(`## ${title} (${rows.length})`);
  out();
  if (rows.length === 0) out('Ninguna.');
  else {
    // Se agrupan por historia y motivo: muchas filas comparten la misma razón
    const groups = new Map();
    for (const row of rows) {
      const story = row.rowId.split('/')[0];
      const key = `${story} — ${row.note ?? '(sin nota)'}`;
      groups.set(key, [...(groups.get(key) ?? []), row.rowId]);
    }
    for (const [key, ids] of groups) out(`- **${cell(key, 300)}** (${ids.length}): ${ids.map((id) => id.split('/').slice(1).join('/')).join(', ')}`);
  }
  out();
}

out('## Detalle por fila');
out();
for (const story of stories) {
  out(`### ${story.header.story} · ${SURFACE_LABEL[story.header.surface] ?? story.header.surface}`);
  out();
  const byEsquema = new Map();
  for (const row of story.rows) byEsquema.set(row.esquemaIndex, [...(byEsquema.get(row.esquemaIndex) ?? []), row]);
  for (const [index, rows] of [...byEsquema.entries()].sort((a, b) => a[0] - b[0])) {
    out(`#### E${index} · ${cell(rows[0].esquema, 200)}`);
    out();
    out('| Fila | Celdas | Esperado | Observado | Veredicto | ms |');
    out('| --- | --- | --- | --- | --- | ---: |');
    for (const row of rows.sort((a, b) => a.rowIndex - b.rowIndex)) {
      const note = row.note ? ` _(${cell(row.note, 200)})_` : '';
      out(`| ${row.rowId.split('/').slice(1).join('/')} | ${cellsSummary(row.cells)} | ${cell(row.expected)} | ${cell(row.observed)}${note} | **${row.verdict}** | ${row.ms} |`);
    }
    out();
  }
}

writeFileSync(resolve(dir, 'informe.md'), `${lines.join('\n')}\n`, 'utf8');
writeFileSync(
  resolve(dir, 'resumen.json'),
  `${JSON.stringify({ storiesCommit: manifest.storiesCommit, rows: allRows.length, manifestRows: expectedIds.size, totals: grand, perStory: Object.fromEntries(stories.map((story) => [story.header.story, totalsOf(story.rows)])), problems }, null, 2)}\n`,
  'utf8',
);
console.log(`informe.md: ${allRows.length}/${expectedIds.size} filas · ${VERDICTS.map((verdict) => `${verdict}=${grand[verdict]}`).join(' · ')}`);
if (problems.length > 0) {
  console.error(`PROBLEMAS (${problems.length}):\n- ${problems.join('\n- ')}`);
  process.exit(1);
}
