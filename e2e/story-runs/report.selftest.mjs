// AUTOTEST DEL INFORME. Prueba que `report.mjs` detecta cada tipo de incoherencia: copia los resultados reales a una carpeta
// temporal, los MANIPULA de una forma concreta (puerta sin superar, Docker accesible, ejecución en paralelo, fila perdida o
// duplicada, huella de build distinta, centinela de otra instancia de la API, proceso de la API ajeno al dist…) y exige que el
// informe termine con código 1 y con el mensaje esperado (cada caso tiene su propio mensaje, para que ninguno pase por casualidad
// con la comprobación rota). Hay casos que DEBEN pasar (un centinela con 1 s de desfase) y uno sin registro de construcción, donde
// el informe debe seguir saliendo con 0 pero decir que la procedencia NO está demostrada. Se ejecuta DESPUÉS de una ejecución
// completa:   node e2e/story-runs/report.selftest.mjs
import { execFileSync, spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..', '..');
const source = resolve(root, 'docs', 'story-runs');
const report = resolve(import.meta.dirname, 'report.mjs');

const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));
const git = (args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();

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
const allStories = (dir, change) => readdirSync(join(dir, 'EP-LOGIN')).filter((n) => /^US-.*\.json$/.test(n)).forEach((n) => mutate(dir, `EP-LOGIN/${n}`, change));

// Commits reales para los casos: uno que ya no es el del arnés actual (el de la puerta original), otro que NO es antecesor de HEAD
// (un commit huérfano hijo de HEAD, que no se referencia desde ninguna rama) y el último que tocó las entradas de los builds
const OLD_HARNESS_COMMIT = git(['log', '--format=%H', '--diff-filter=A', '-n', '1', '--', 'e2e/story-runs/gate/aislamiento.spec.ts']);
const NOT_ANCESTOR = git(['commit-tree', 'HEAD^{tree}', '-p', 'HEAD', '-m', 'autotest del informe']);
const LAST_APPS_COMMIT = git(['log', '--format=%H', '-n', '1', '--', 'apps']);
const shiftSentinels = (dir, ms) => mutate(dir, 'centinelas.json', (list) => list.forEach((s) => { s.apiStartedAt = new Date(Date.parse(s.apiStartedAt) + ms).toISOString(); }));
const SENTINEL_MSG = /no consta que la API de esa ejecución escribiera en la base aislada/;

// [descripción, manipulación, mensaje esperado en stderr, opciones: { ok: debe salir con 0, informe: texto que debe decir informe.md }]
const CASES = [
  // Puerta, entorno y ajustes
  ['la puerta de una ejecución no consta superada', (d) => gateRun(d, API_RUN, (r) => { r.passed = false; }), /puerta de aislamiento no consta/],
  ['la puerta no registró el entorno', (d) => gateRun(d, WEB_RUN, (r) => { r.environment = null; }), /la puerta no registró el entorno de su ejecución/],
  ['la base de Docker (5432) estaba accesible', (d) => gateRun(d, WEB_RUN, (r) => { r.environment.ports['5432'] = true; }), /puerto 5432 \(la base de datos de Docker/],
  ['el puerto de PostgreSQL aislado es el de una aplicación', (d) => gateRun(d, API_RUN, (r) => { r.environment.isolatedPgPort = 3000; }), /no es válido/],
  ['el PostgreSQL aislado no estaba accesible', (d) => gateRun(d, API_RUN, (r) => { r.environment.ports['5433'] = false; }), /no consta accesible durante la puerta/],
  ['una historia consta ejecutada en paralelo (workers 2)', (d) => story(d, '001', (j) => { j.header.settings.workers = 2; }), /no consta en serie/],
  ['la puerta registró reintentos', (d) => gateRun(d, WEB_RUN, (r) => { r.environment.settings.retries = 1; }), /ajustes de ejecución que no son los de la serie/],
  ['la API tenía los defectos del curso activos', (d) => story(d, '002', (j) => { j.header.apiPlantedBugs = true; }), /defectos del curso activos/],
  // Filas y veredictos
  ['falta una fila', (d) => story(d, '003', (j) => { j.rows.pop(); }), /Falta el resultado/],
  ['una fila duplicada', (d) => story(d, '003', (j) => { j.rows.push(j.rows[0]); }), /Fila duplicada/],
  ['una fila que no está en el manifiesto', (d) => story(d, '003', (j) => { j.rows.push({ ...j.rows[0], rowId: 'US-LOGIN-999/E1/F1' }); }), /no está en el manifiesto/],
  ['un veredicto desconocido', (d) => story(d, '003', (j) => { j.rows[0].verdict = 'raro'; }), /Veredicto desconocido/],
  ['un error del arnés', (d) => story(d, '003', (j) => { j.rows[0].verdict = 'error-de-prueba'; }), /Error del arnés/],
  ['falta el archivo de resultados de una historia', (d) => rmSync(join(d, 'EP-LOGIN', 'US-LOGIN-016.json')), /No hay archivo de resultados de US-LOGIN-016/],
  ['el commit de las historias no es el del manifiesto', (d) => story(d, '004', (j) => { j.header.storiesCommit = 'f'.repeat(40); }), /commit de las historias/],
  // Arnés
  ['el arnés tenía cambios sin confirmar (filas)', (d) => story(d, '006', (j) => { j.header.harnessDirty = true; }), /sin confirmar al ejecutar/],
  ['el arnés tenía cambios sin confirmar (puerta)', (d) => gateRun(d, MOBILE_RUN, (r) => { r.harnessDirty = true; }), /durante la puerta/],
  ['la puerta y las filas son de commits distintos', (d) => gateRun(d, API_RUN, (r) => { r.commit = '0'.repeat(40); }), /la puerta y las filas de su ejecución no son del mismo commit/],
  [
    'las ejecuciones son de commits distintos del arnés (cabecera Y puerta, para no solaparse con el caso anterior)',
    (d) => { story(d, '011', (j) => { j.header.commit = '1'.repeat(40); }); gateRun(d, MOBILE_RUN, (r) => { r.commit = '1'.repeat(40); }); },
    /Las ejecuciones no son del mismo commit del arnés/,
  ],
  [
    'el arnés cambió desde el commit con el que se ejecutó',
    (d) => { allStories(d, (j) => { j.header.commit = OLD_HARNESS_COMMIT; }); mutate(d, 'aislamiento.json', (g) => g.runs.forEach((r) => { r.commit = OLD_HARNESS_COMMIT; })); },
    /El arnés cambió desde el commit con el que se ejecutó/,
  ],
  [
    'el commit del arnés no es antecesor de HEAD',
    (d) => { allStories(d, (j) => { j.header.commit = NOT_ANCESTOR; }); mutate(d, 'aislamiento.json', (g) => g.runs.forEach((r) => { r.commit = NOT_ANCESTOR; })); },
    /no es antecesor de HEAD \(¿historia reescrita\?\)/,
  ],
  // Tiempos
  ['las filas empezaron antes de que terminara la puerta', (d) => story(d, '006', (j) => { j.header.startedAt = '2000-01-01T00:00:00.000Z'; }), /antes de que terminara la puerta/],
  ['dos ejecuciones se solapan en el tiempo', (d) => mutate(d, 'aislamiento.json', (g) => { g.runs.find((r) => r.runId === WEB_RUN).startedAt = g.runs.find((r) => r.runId === API_RUN).startedAt; }), /se solapan/],
  // Lo que sirven los puertos
  ['la web no sirve el index.html de su dist', (d) => gateRun(d, WEB_RUN, (r) => { r.environment.served.web.matchesDist = false; }), /no consta que lo que sirve la web/],
  ['la app móvil no sirve el index.html de su dist', (d) => gateRun(d, MOBILE_RUN, (r) => { r.environment.served.mobile.matchesDist = null; }), /no consta que lo que sirve la app móvil/],
  ['la API arrancó antes de construir su dist', (d) => gateRun(d, API_RUN, (r) => { r.environment.served.apiStartedAfterBuild = false; }), /DESPUÉS de construir su dist/],
  ['la puerta no registró qué sirven los puertos', (d) => gateRun(d, API_RUN, (r) => { r.environment.served = undefined; }), /no registró qué sirven los puertos/],
  ['una URL no es local', (d) => gateRun(d, API_RUN, (r) => { r.environment.served.urls.api = 'http://example.com/api'; }), /no es local/],
  ['el proceso que escucha en el puerto de la API es ajeno al dist', (d) => gateRun(d, WEB_RUN, (r) => { r.environment.apiProcess.commandLine = 'node C:/otro/apps/api/dist/main.js'; }), /no consta que el proceso que escucha en el puerto de la API ejecute/],
  ['no consta el proceso de la API', (d) => gateRun(d, API_RUN, (r) => { r.environment.apiProcess = null; }), /no consta que el proceso que escucha en el puerto de la API ejecute/],
  // Builds
  ['un build no existía durante la ejecución', (d) => gateRun(d, API_RUN, (r) => { r.environment.builds.api.exists = false; }), /no existía durante la ejecución/],
  ['la huella de un build cambia entre ejecuciones', (d) => gateRun(d, WEB_RUN, (r) => { r.environment.builds.web.sha256 = 'f'.repeat(64); }), /cambiaron entre las ejecuciones/, { informe: /NO está demostrada/ }],
  ['la huella registrada al construir no coincide con la medida', (d) => mutate(d, 'builds.json', (b) => { b.builds[0].fingerprint.sha256 = 'e'.repeat(64); }), /no coincide con la registrada/, { informe: /NO está demostrada/ }],
  ['el registro de construcción no cubre las entradas vigiladas (registro antiguo)', (d) => mutate(d, 'builds.json', (b) => { b.inputs = b.inputs.filter((i) => i !== 'docs/GUIA-ALUMNO.md'); }), /no cubre estas entradas de los builds/],
  ['la construcción se invalidó durante su ejecución', (d) => mutate(d, 'builds.json', (b) => { b.changedDuringBuild = 'HEAD cambió durante la construcción'; }), /La construcción se invalidó/],
  ['la construcción no está completa', (d) => mutate(d, 'builds.json', (b) => { b.complete = false; b.pending = ['mobile']; }), /no está completo/],
  ['un build terminó con error', (d) => mutate(d, 'builds.json', (b) => { b.builds[1].exitCode = 1; }), /no terminó bien/],
  ['los builds se construyeron con entradas sin confirmar', (d) => mutate(d, 'builds.json', (b) => { b.inputsDirty = true; }), /entradas sin confirmar/],
  ['el commit de construcción ya no existe', (d) => mutate(d, 'builds.json', (b) => { b.commit = '0'.repeat(40); }), /ya no existe/],
  ['el commit de construcción no es antecesor de HEAD', (d) => mutate(d, 'builds.json', (b) => { b.commit = NOT_ANCESTOR; }), /no es antecesor de HEAD(?!\s*\()/],
  ['las entradas de los builds cambiaron desde el commit de construcción', (d) => mutate(d, 'builds.json', (b) => { b.commit = LAST_APPS_COMMIT; }), /Las entradas de los builds cambiaron entre el commit/],
  ['un archivo de entorno cambió después de construir', (d) => mutate(d, 'builds.json', (b) => { const file = Object.keys(b.envFiles)[0]; if (!file) throw new Error('el registro no tiene archivos de entorno'); b.envFiles[file].sha256 = 'd'.repeat(64); }), /archivo de entorno/],
  ['la construcción terminó después de empezar una ejecución', (d) => mutate(d, 'builds.json', (b) => { b.endedAt = '2099-01-01T00:00:00.000Z'; }), /antes de que terminara la construcción/],
  // Centinela de la base aislada
  ['no hay centinela de la base aislada', (d) => writeFileSync(join(d, 'centinelas.json'), '[]', 'utf8'), SENTINEL_MSG],
  ['el centinela no halló el marcador', (d) => mutate(d, 'centinelas.json', (list) => list.forEach((s) => { s.foundInIsolatedDb = false; })), SENTINEL_MSG],
  ['el centinela vio el 5432 accesible', (d) => mutate(d, 'centinelas.json', (list) => list.forEach((s) => { s.port5432Accessible = true; })), SENTINEL_MSG],
  ['el centinela es de otra instancia de la API (6 s de desfase)', (d) => shiftSentinels(d, 6000), SENTINEL_MSG],
  ['el centinela es posterior a la puerta', (d) => mutate(d, 'centinelas.json', (list) => list.forEach((s) => { s.checkedAt = '2099-01-01T00:00:00.000Z'; })), SENTINEL_MSG],
  ['el centinela es de otra URL de la API', (d) => mutate(d, 'centinelas.json', (list) => list.forEach((s) => { s.apiUrl = 'http://localhost:3999/api'; })), SENTINEL_MSG],
  ['el centinela comprobó otro puerto de PostgreSQL', (d) => mutate(d, 'centinelas.json', (list) => list.forEach((s) => { s.isolatedPgPort = 5999; })), SENTINEL_MSG],
  ['el centinela no identifica su script', (d) => mutate(d, 'centinelas.json', (list) => list.forEach((s) => { delete s.scriptSha256; })), SENTINEL_MSG],
  ['el centinela no identifica la instancia de PostgreSQL', (d) => mutate(d, 'centinelas.json', (list) => list.forEach((s) => { delete s.systemIdentifier; })), SENTINEL_MSG],
  // Casos que DEBEN pasar
  ['un centinela con 1 s de desfase SÍ vale (la tolerancia es de 2 s)', (d) => shiftSentinels(d, 1000), /^$/, { ok: true }],
  ['sin registro de construcción: el informe sale con 0 pero dice que la procedencia NO está demostrada', (d) => rmSync(join(d, 'builds.json')), /^$/, { ok: true, informe: /NO está demostrada/ }],
];

let failures = 0;
const check = (label, ok, detail) => {
  if (!ok) failures += 1;
  console.log(`${ok ? 'OK  ' : 'FALLA'} ${label}${detail ? ` — ${detail}` : ''}`);
};

{
  const dir = sandbox();
  const result = run(dir);
  const informe = readFileSync(join(dir, 'EP-LOGIN', 'informe.md'), 'utf8');
  check('copia SIN manipular: el informe sale con código 0', result.status === 0, result.status === 0 ? '' : `código ${result.status}: ${result.stderr.split('\n')[0]}`);
  check('copia SIN manipular: el informe da la procedencia por demostrada', /demostrada por el registro de construcción/.test(informe));
  rmSync(dir, { recursive: true, force: true });
}

for (const [label, mutation, expected, options = {}] of CASES) {
  const dir = sandbox();
  mutation(dir);
  const result = run(dir);
  const informePath = join(dir, 'EP-LOGIN', 'informe.md');
  const informe = existsSync(informePath) ? readFileSync(informePath, 'utf8') : '';
  const codeOk = options.ok ? result.status === 0 : result.status === 1 && expected.test(result.stderr);
  const informeOk = options.informe ? options.informe.test(informe) : true;
  check(label, codeOk && informeOk, codeOk && informeOk ? '' : `código ${result.status}; esperaba ${options.ok ? 'código 0' : expected}${options.informe ? ` e informe con ${options.informe}` : ''}; stderr: ${result.stderr.split('\n').slice(0, 2).join(' | ')}`);
  rmSync(dir, { recursive: true, force: true });
}

console.log(`\n${CASES.length + 2} comprobaciones · ${failures === 0 ? 'todas correctas' : `${failures} FALLAN`}`);
process.exit(failures === 0 ? 0 : 1);
