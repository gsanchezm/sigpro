// Reconstruye los builds que sirven la API, la web y la app móvil (y el paquete compartido que leen los tres) DESDE EL COMMIT
// ACTUAL, con una guarda de memoria, y registra en docs/story-runs/builds.json (ignorado por git) el commit, las entradas sin
// confirmar, el comando, los tiempos, la memoria mínima y la huella de cada build. Así se puede demostrar de qué commit salió lo
// que se sirve: la huella registrada aquí debe coincidir con la que mide la puerta de aislamiento en cada ejecución.
//
// Uso (desde la raíz, con la API, la web y Expo PARADOS): node e2e/story-runs/build.mjs
//   - Se niega a construir si las entradas de los builds tienen cambios sin confirmar o si el puerto 3000 está en uso.
//   - Aparta el `dist` anterior en una carpeta temporal (no lo borra) para que no queden archivos de un build anterior.
//   - Si la memoria libre baja de MIN_MB, mata el proceso, deja constancia y termina con código 3: lo que no se construyó queda
//     en `pending` del registro, nunca como hecho.
import { execFileSync, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createWriteStream, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { createConnection } from 'node:net';
import { freemem, tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..', '..');
const results = resolve(root, 'docs', 'story-runs');
const MIN_MB = Number(process.env.SIGPRO_BUILD_MIN_FREE_MB ?? '500');

// Lo que entra en un build: si algo de esto tiene cambios sin confirmar, el build no se puede atribuir a un commit
const INPUTS = ['apps', 'packages', 'examples', 'package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml', 'tsconfig.base.json'];

// Mismo orden que las dependencias: la API, la web y la app móvil leen `packages/shared/dist`
const BUILDS = [
  { name: 'shared', command: 'pnpm --filter @sigpro/shared build', dist: 'packages/shared/dist' },
  { name: 'api', command: 'pnpm --filter api build', dist: 'apps/api/dist' },
  { name: 'web', command: 'pnpm --filter web build', dist: 'apps/web/dist' },
  { name: 'mobile', command: 'pnpm --filter mobile build', dist: 'apps/mobile/dist' },
];

const git = (args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
const out = (text) => console.log(text);
const sha256 = (data) => createHash('sha256').update(data).digest('hex');

const filesUnder = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((entry) => (entry.isDirectory() ? filesUnder(join(dir, entry.name)) : [join(dir, entry.name)]));

/** MISMO algoritmo que `fingerprintBuild` de support/provenance.ts: si difirieran, el informe lo marca como huellas distintas. */
const fingerprint = (relativeDir) => {
  const base = resolve(root, relativeDir);
  try {
    const entries = filesUnder(base)
      .map((file) => ({ file, relative: file.slice(base.length + 1).replaceAll('\\', '/') }))
      .sort((a, b) => (a.relative < b.relative ? -1 : a.relative > b.relative ? 1 : 0));
    const digest = createHash('sha256');
    let bytes = 0;
    let newest = 0;
    for (const { file, relative } of entries) {
      const stat = statSync(file);
      bytes += stat.size;
      newest = Math.max(newest, stat.mtimeMs);
      digest.update(`${relative}\t${sha256(readFileSync(file))}\n`);
    }
    return { path: relativeDir, exists: true, files: entries.length, bytes, newestMtime: entries.length > 0 ? new Date(newest).toISOString() : null, sha256: digest.digest('hex'), error: null };
  } catch (error) {
    const missing = error instanceof Error && 'code' in error && error.code === 'ENOENT';
    return { path: relativeDir, exists: false, files: 0, bytes: 0, newestMtime: null, sha256: null, error: missing ? null : String(error) };
  }
};

const portOpen = (port) =>
  new Promise((done) => {
    const socket = createConnection({ host: '127.0.0.1', port, timeout: 1500 });
    socket.once('connect', () => {
      socket.destroy();
      done(true);
    });
    socket.once('error', () => done(false));
    socket.once('timeout', () => {
      socket.destroy();
      done(false);
    });
  });

const toolVersion = (command) => {
  try {
    return execFileSync(command, ['--version'], { encoding: 'utf8', shell: true }).trim();
  } catch {
    return 'desconocida';
  }
};

const record = {
  commit: git(['rev-parse', 'HEAD']),
  commitDate: git(['log', '-1', '--format=%cI']),
  inputs: INPUTS,
  inputsDirty: git(['status', '--porcelain', '--', ...INPUTS]) !== '',
  node: process.version,
  pnpm: toolVersion('pnpm'),
  minFreeMbGuard: MIN_MB,
  startedAt: new Date().toISOString(),
  endedAt: null,
  complete: false,
  builds: [],
  pending: BUILDS.map((build) => build.name),
};

const save = () => {
  mkdirSync(results, { recursive: true });
  writeFileSync(resolve(results, 'builds.json'), `${JSON.stringify(record, null, 2)}\n`, 'utf8');
};

if (record.inputsDirty) {
  save();
  out('ABORTADO: las entradas de los builds tienen cambios sin confirmar; el build no se podría atribuir a un commit.');
  process.exit(2);
}
for (const port of [3000, 5173, 8081]) {
  if (await portOpen(port)) {
    out(`ABORTADO: el puerto ${port} está en uso (para la API, la web y Expo antes de construir: con la API en marcha el build falla o queda a medias).`);
    process.exit(2);
  }
}

const backups = resolve(tmpdir(), `sigpro-dist-anteriores-${Date.now()}`);
mkdirSync(backups, { recursive: true });
mkdirSync(resolve(results, 'builds'), { recursive: true });
save();
out(`Commit ${record.commit.slice(0, 7)} · entradas sin confirmar: no · Node ${record.node} · pnpm ${record.pnpm} · guarda de memoria ${MIN_MB} MB`);

const killTree = (pid) => {
  try {
    execFileSync('taskkill', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore' });
  } catch {
    // ya había terminado
  }
};

const runGuarded = (build) =>
  new Promise((done) => {
    const log = createWriteStream(resolve(results, 'builds', `${build.name}.log`));
    const child = spawn(build.command, { cwd: root, shell: true, stdio: ['ignore', 'pipe', 'pipe'] });
    child.stdout.pipe(log, { end: false });
    child.stderr.pipe(log, { end: false });
    let minFree = Infinity;
    let aborted = false;
    const guard = setInterval(() => {
      const free = Math.round(freemem() / 1024 / 1024);
      minFree = Math.min(minFree, free);
      if (free < MIN_MB && !aborted) {
        aborted = true;
        out(`  ABORTADA: memoria libre ${free} MB < ${MIN_MB} MB; se detiene «${build.command}»`);
        killTree(child.pid);
      }
    }, 3000);
    child.once('close', (code) => {
      clearInterval(guard);
      log.end();
      done({ exitCode: code, aborted, minFreeMb: Number.isFinite(minFree) ? minFree : null });
    });
  });

for (const build of BUILDS) {
  const distPath = resolve(root, build.dist);
  if (existsSync(distPath)) renameSync(distPath, resolve(backups, build.name));
  const startedAt = new Date().toISOString();
  out(`→ ${build.name}: ${build.command}`);
  const result = await runGuarded(build);
  const entry = { name: build.name, command: build.command, dist: build.dist, startedAt, endedAt: new Date().toISOString(), ...result, fingerprint: fingerprint(build.dist) };
  record.builds.push(entry);
  if (result.exitCode === 0 && !result.aborted && entry.fingerprint.exists) record.pending = record.pending.filter((name) => name !== build.name);
  save();
  out(`  código ${result.exitCode}${result.aborted ? ' (ABORTADA por memoria)' : ''} · ${entry.fingerprint.files} archivos · sha256 ${entry.fingerprint.sha256?.slice(0, 16) ?? '—'} · memoria libre mínima ${result.minFreeMb} MB`);
  if (result.exitCode !== 0 || result.aborted) {
    out(`DETENIDO en «${build.name}». Pendiente: ${record.pending.join(', ')}. El dist anterior de cada build quedó en ${backups}.`);
    record.endedAt = new Date().toISOString();
    save();
    process.exit(result.aborted ? 3 : 1);
  }
}

record.complete = record.pending.length === 0;
record.endedAt = new Date().toISOString();
save();
out(`Builds completos desde ${record.commit.slice(0, 7)}. Registro en docs/story-runs/builds.json; los dist anteriores en ${backups}.`);
