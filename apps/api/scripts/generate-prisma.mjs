// `prisma generate` que sobrevive a una API local en marcha.
//
// En Windows, mientras un proceso Node tiene cargado `query_engine-windows.dll.node`, Prisma no puede sustituirlo y
// `generate` falla con `EPERM … rename`. Un .dll cargado sí se puede RENOMBRAR: si ocurre, se aparta el motor en uso
// (los procesos que lo tienen cargado siguen con su copia) y se reintenta una vez. En Linux/macOS (CI, Render) nunca entra.
import { spawnSync } from 'node:child_process';
import { readdirSync, renameSync, unlinkSync } from 'node:fs';
import { dirname, join } from 'node:path';

const generate = () => spawnSync('prisma', ['generate'], { shell: true, encoding: 'utf8', env: process.env });

const show = (result) => {
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
};

/** Motor que Prisma no pudo reemplazar, leído del mensaje de error (`… -> 'C:\…\query_engine-windows.dll.node'`). */
const lockedEngine = (output) => /->\s+'([^']*query_engine[^']*\.node)'/.exec(output)?.[1] ?? null;

/** Borra los motores apartados en ejecuciones anteriores que ya no estén en uso (los que sigan cargados se ignoran). */
const sweepOldEngines = (engine) => {
  const dir = dirname(engine);
  readdirSync(dir)
    .filter((name) => name.includes('.node.old-') || name.includes('.node.tmp'))
    .forEach((name) => {
      try {
        unlinkSync(join(dir, name));
      } catch {
        // sigue cargado por otro proceso: se borrará en una pasada posterior
      }
    });
};

let result = generate();
const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
const engine = result.status === 0 ? null : output.includes('EPERM') ? lockedEngine(output) : null;

if (engine) {
  const aside = `${engine}.old-${Date.now()}`;
  renameSync(engine, aside);
  console.log(`[prisma] motor en uso por otro proceso: apartado como ${aside.split(/[\\/]/).pop()} y se reintenta`);
  result = generate();
  sweepOldEngines(engine);
}

show(result);
process.exit(result.status ?? 1);
