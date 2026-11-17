// AUTOTEST DEL INFORME. Prueba que `report.mjs` detecta cada tipo de incoherencia: copia los resultados reales a una carpeta
// temporal, los MANIPULA de una forma concreta (puerta sin superar, Docker accesible, ejecución en paralelo, fila perdida o
// duplicada, huella de build distinta, centinela de otra instancia de la API…) y exige que el informe termine con código 1 y con
// el mensaje esperado. La copia sin manipular debe dar código 0. Se ejecuta DESPUÉS de una ejecución completa:
//   node e2e/story-runs/report.selftest.mjs
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..', '..');
const source = resolve(root, 'docs', 'story-runs');
const report = resolve(import.meta.dirname, 'report.mjs');

const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));

const sandbox = () => {
  const dir = mkdtempSync(join(tmpdir(), 'sigpro-report-'));
  for (const name of ['manifest.json', 'aislamiento.json', 'builds.json', 'centinelas.json', 'entorno.json']) if (existsSync(join(source, name))) cpSync(join(source, name), join(dir, name));
  mkdirSync(join(dir, 'EP-LOGIN'));
  for (const name of readdirSync(join(source, 'EP-LOGIN')).filter((file) => /^US-.*\.json$/.test(file))) cpSync(join(source, 'EP-LOGIN', name), join(dir, 'EP-LOGIN', name));
  return dir;
};

const run = (dir) => spawnSync('node', [report], { env: { ...process.env, SIGPRO_STORIES_RESULTS_DIR: dir }, encoding: 'utf8' });

const mutate = (dir, file, change) => {
  const path = join(dir, file);
  const value = readJson(path);
  change(value);
  writeFileSync(path, JSON.stringify(value), 'utf8');
};

// Identificadores de las tres ejecuciones, leídos de los propios resultados
const runIdOf = (id) => readJson(join(source, 'EP-LOGIN', `US-LOGIN-${id}.json`)).header.runId;
const API_RUN = runIdOf('001');
const WEB_RUN = runIdOf('006');
const MOBILE_RUN = runIdOf('011');
const gateRun = (dir, runId, change) => mutate(dir, 'aislamiento.json', (gate) => change(gate.runs.find((entry) => entry.runId === runId)));
const story = (dir, id, change) => mutate(dir, `EP-LOGIN/US-LOGIN-${id}.json`, change);

const CASES = [
  ['la puerta de una ejecución no consta superada', (d) => gateRun(d, API_RUN, (r) => { r.passed = false; }), /puerta de aislamiento no consta/],
  ['la base de Docker (5432) estaba accesible', (d) => gateRun(d, WEB_RUN, (r) => { r.environment.ports['5432'] = true; }), /5432/],
  ['el puerto de PostgreSQL aislado es el de una aplicación', (d) => gateRun(d, API_RUN, (r) => { r.environment.isolatedPgPort = 3000; }), /no es válido/],
  ['una historia consta ejecutada en paralelo (workers 2)', (d) => story(d, '001', (j) => { j.header.settings.workers = 2; }), /no consta en serie/],
  ['la puerta registró reintentos', (d) => gateRun(d, WEB_RUN, (r) => { r.environment.settings.retries = 1; }), /ajustes de ejecución que no son los de la serie/],
  ['falta una fila', (d) => story(d, '003', (j) => { j.rows.pop(); }), /Falta el resultado/],
  ['una fila duplicada', (d) => story(d, '003', (j) => { j.rows.push(j.rows[0]); }), /duplicada/],
  ['un veredicto desconocido', (d) => story(d, '003', (j) => { j.rows[0].verdict = 'raro'; }), /Veredicto desconocido/],
  ['un error del arnés', (d) => story(d, '003', (j) => { j.rows[0].verdict = 'error-de-prueba'; }), /Error del arnés/],
  ['el arnés tenía cambios sin confirmar (filas)', (d) => story(d, '006', (j) => { j.header.harnessDirty = true; }), /sin confirmar al ejecutar/],
  ['el arnés tenía cambios sin confirmar (puerta)', (d) => gateRun(d, MOBILE_RUN, (r) => { r.harnessDirty = true; }), /durante la puerta/],
  ['la puerta y las filas son de commits distintos', (d) => gateRun(d, API_RUN, (r) => { r.commit = '0'.repeat(40); }), /no son del mismo commit del arnés/],
  ['las ejecuciones son de commits distintos del arnés', (d) => story(d, '011', (j) => { j.header.commit = '1'.repeat(40); }), /no son del mismo commit del arnés/],
  ['las filas empezaron antes de que terminara la puerta', (d) => story(d, '006', (j) => { j.header.startedAt = '2000-01-01T00:00:00.000Z'; }), /antes de que terminara la puerta/],
  ['dos ejecuciones se solapan en el tiempo', (d) => mutate(d, 'aislamiento.json', (g) => { g.runs.find((r) => r.runId === WEB_RUN).startedAt = g.runs.find((r) => r.runId === API_RUN).startedAt; }), /se solapan/],
  ['la web no sirve el index.html de su dist', (d) => gateRun(d, WEB_RUN, (r) => { r.environment.served.web.matchesDist = false; }), /no consta que lo que sirve la web/],
  ['la app móvil no sirve el index.html de su dist', (d) => gateRun(d, MOBILE_RUN, (r) => { r.environment.served.mobile.matchesDist = null; }), /no consta que lo que sirve la app móvil/],
  ['la API arrancó antes de construir su dist', (d) => gateRun(d, API_RUN, (r) => { r.environment.served.apiStartedAfterBuild = false; }), /DESPUÉS de construir su dist/],
  ['una URL no es local', (d) => gateRun(d, API_RUN, (r) => { r.environment.served.urls.api = 'http://example.com/api'; }), /no es local/],
  ['la huella de un build cambia entre ejecuciones', (d) => gateRun(d, WEB_RUN, (r) => { r.environment.builds.web.sha256 = 'f'.repeat(64); }), /cambiaron entre las ejecuciones/],
  ['la huella registrada al construir no coincide con la medida', (d) => mutate(d, 'builds.json', (b) => { b.builds[0].fingerprint.sha256 = 'e'.repeat(64); }), /no coincide con la registrada/],
  ['la construcción no está completa', (d) => mutate(d, 'builds.json', (b) => { b.complete = false; b.pending = ['mobile']; }), /no está completo/],
  ['los builds se construyeron con entradas sin confirmar', (d) => mutate(d, 'builds.json', (b) => { b.inputsDirty = true; }), /entradas sin confirmar/],
  ['la construcción terminó después de empezar una ejecución', (d) => mutate(d, 'builds.json', (b) => { b.endedAt = '2099-01-01T00:00:00.000Z'; }), /antes de que terminara la construcción/],
  ['no hay centinela de la base aislada', (d) => writeFileSync(join(d, 'centinelas.json'), '[]', 'utf8'), /no consta que la API de esa ejecución escribiera en la base aislada/],
  ['el centinela vio el 5432 accesible', (d) => mutate(d, 'centinelas.json', (list) => list.forEach((s) => { s.port5432Accessible = true; })), /no consta que la API de esa ejecución escribiera en la base aislada/],
  ['el centinela es de otra instancia de la API', (d) => mutate(d, 'centinelas.json', (list) => list.forEach((s) => { s.apiStartedAt = '2001-01-01T00:00:00.000Z'; })), /no consta que la API de esa ejecución escribiera en la base aislada/],
];

let failures = 0;
const check = (label, ok, detail) => {
  if (!ok) failures += 1;
  console.log(`${ok ? 'OK  ' : 'FALLA'} ${label}${detail ? ` — ${detail}` : ''}`);
};

{
  const dir = sandbox();
  const result = run(dir);
  check('copia SIN manipular: el informe sale con código 0', result.status === 0, result.status === 0 ? '' : `código ${result.status}: ${result.stderr.split('\n')[0]}`);
  rmSync(dir, { recursive: true, force: true });
}

for (const [label, mutation, expected] of CASES) {
  const dir = sandbox();
  mutation(dir);
  const result = run(dir);
  const detected = result.status === 1 && expected.test(result.stderr);
  check(`${label}`, detected, detected ? '' : `código ${result.status}; esperaba ${expected}; stderr: ${result.stderr.split('\n').slice(0, 2).join(' | ')}`);
  rmSync(dir, { recursive: true, force: true });
}

console.log(`\n${CASES.length + 1} casos · ${failures === 0 ? 'todos detectados' : `${failures} FALLAN`}`);
process.exit(failures === 0 ? 0 : 1);
