// `pnpm --filter api tenants:list [--csv] [--web-url=https://…]` — imprime los tenants de alumno que genera el entorno actual.
// NO toca la base de datos: no importa Prisma ni exige DATABASE_URL. Solo necesita TENANT_SUFFIX_SEED, TENANT_SUFFIX_LENGTH y
// SEED_STUDENT_TENANTS (los mismos valores que tiene la API en Render), y usa el mismo algoritmo que el seed.
import { envSchema, tenantSuffixOptions } from '../config/env';
import { tenantIds } from './data';
import { tenantRows, toCsv, toTable } from './tenants-list';

const args = process.argv.slice(2);
const csv = args.includes('--csv');
const webUrl = args.find((arg) => arg.startsWith('--web-url='))?.slice('--web-url='.length) ?? process.env.WEB_URL ?? '';

const parsed = envSchema.pick({ SEED_STUDENT_TENANTS: true, TENANT_SUFFIX_SEED: true, TENANT_SUFFIX_LENGTH: true }).safeParse(process.env);
if (!parsed.success) {
  // Los mensajes de Zod no incluyen valores: la semilla no se imprime
  console.error(`Configuración inválida → ${parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`);
  process.exit(1);
}

const suffix = tenantSuffixOptions(parsed.data);
if (!suffix) console.error('Aviso: TENANT_SUFFIX_SEED no está definida; se listan los ids históricos (alumno01…).');

const rows = tenantRows(tenantIds(parsed.data.SEED_STUDENT_TENANTS, suffix), webUrl);
console.log(csv ? toCsv(rows) : toTable(rows));
