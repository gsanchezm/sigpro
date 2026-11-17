// Informe por fila de la ejecución de los ejemplos de las historias. Lee docs/story-runs/manifest.json, los resultados
// docs/story-runs/EP-LOGIN/US-*.json (los escribe el marco `support/rows.ts`) y docs/story-runs/entorno.json, y escribe
// docs/story-runs/EP-LOGIN/informe.md y resumen.json. Falla (código 1) si falta alguna fila del manifiesto, si hay
// `error-de-prueba` o si las cabeceras no coinciden (distinto commit de las historias o defectos del curso activos).
// Uso (desde la raíz): node e2e/story-runs/report.mjs
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..', '..');
const results = resolve(root, 'docs', 'story-runs');
const dir = resolve(results, 'EP-LOGIN');

const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));
const manifest = readJson(resolve(results, 'manifest.json'));
const entorno = existsSync(resolve(results, 'entorno.json')) ? readJson(resolve(results, 'entorno.json')) : null;
const gate = existsSync(resolve(results, 'aislamiento.json')) ? readJson(resolve(results, 'aislamiento.json')) : null;
const files = readdirSync(dir).filter((name) => /^US-.*\.json$/.test(name)).sort();
const stories = files.map((name) => readJson(resolve(dir, name)));

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
  const gateRun = (gate?.runs ?? []).find((run) => run.runId === story.header.runId);
  if (!gateRun?.passed) problems.push(`${story.header.story}: la puerta de aislamiento no consta como superada en su ejecución (runId ${story.header.runId})`);
  if (story.header.apiPlantedBugs !== false) problems.push(`${story.header.story}: la API tenía los defectos del curso activos o desconocidos (${story.header.apiPlantedBugs})`);
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
out(`- **Historias:** commit \`${manifest.storiesCommit?.slice(0, 7) ?? '?'}\` (sin cambios sin confirmar al ejecutar) · manifiesto generado ${manifest.generatedAt}.`);
out('- **Código del arnés y ejecución** (cada historia se ejecuta entera de una vez; una ejecución por superficie):');
for (const story of stories) out(`  - ${story.header.story}: ${SURFACE_LABEL[story.header.surface] ?? story.header.surface} · commit \`${story.header.commit?.slice(0, 7) ?? '?'}\` · runId ${story.header.runId} · ${story.header.executedAt}`);
if (entorno) {
  out(`- **Base de datos:** ${entorno.postgres.version}, base \`${entorno.postgres.database}\` en el puerto ${entorno.postgres.port} (${entorno.postgres.tenants} tenants con su seed). Aislada: sin Docker ni Render; el puerto 5432 (el Docker del usuario) estaba ${entorno.puertos['5432 (Docker del usuario)'] ? '**abierto**' : 'cerrado'}.`);
  out(`- **API:** \`${stories[0]?.header.apiUrl}\` con \`plantedBugs: ${entorno.api.plantedBugs}\` (defectos del curso apagados), caos a cero, sin simulador de misión. Node ${entorno.node}.`);
}
if (entorno?.dist) out(`- **Web y móvil:** ${entorno.dist}`);
const gateRuns = gate?.runs ?? [];
out(`- **Aislamiento:** la puerta \`e2e/story-runs/gate/aislamiento.spec.ts\` es un proyecto del que dependen \`api\`, \`web\` y \`mobile\`; consta superada en ${gateRuns.filter((run) => run.passed).length} de ${gateRuns.length} ejecuciones registradas (evidencia en \`docs/story-runs/aislamiento.json\`). Cada fila reinicia su tenant, comprueba que el caos está a cero y usa correos únicos y sesiones propias.`);
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
