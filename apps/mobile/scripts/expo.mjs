// Ejecuta la CLI de Expo con dos ajustes del monorepo:
//  - sin terminal interactiva (turbo, CI) Expo se pone en modo no interactivo (`CI=1`) para no quedarse esperando teclas;
//  - EXPO_PUBLIC_API_URL por defecto apunta a la API local (en Render/EAS se define fuera).
import { spawnSync } from 'node:child_process';
import { delimiter, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const env = { ...process.env };
// `pnpm run` ya añade node_modules/.bin al PATH; si se lanza el script con `node` a pelo, `expo` no se encontraría
const bin = join(dirname(fileURLToPath(import.meta.url)), '..', 'node_modules', '.bin');
env.PATH = `${bin}${delimiter}${env.PATH ?? ''}`;
if (env.Path !== undefined) env.Path = env.PATH;
if (!process.stdin.isTTY && env.CI === undefined) env.CI = '1';
env.EXPO_PUBLIC_API_URL ??= 'http://localhost:3000/api';
// Expo no debe preguntar por telemetría ni por actualizaciones en un entorno automático
env.EXPO_NO_TELEMETRY ??= '1';

const result = spawnSync('expo', process.argv.slice(2), { stdio: 'inherit', shell: true, env });
process.exit(result.status ?? 1);
