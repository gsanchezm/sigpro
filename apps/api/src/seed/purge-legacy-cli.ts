// `pnpm --filter api tenants:purge-legacy [--confirm]` — borra los tenants `alumnoNN` sin sufijo que quedan en la base tras
// activar TENANT_SUFFIX_SEED. Sin `--confirm` solo MUESTRA lo que borraría. Es irreversible (los datos del tenant se pierden,
// aunque el seed es determinista) y nunca se ejecuta solo: lo lanza una persona, con las variables de la API de ese entorno.
import { loadEnv, tenantSuffixOptions } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';
import { SeedService } from './seed.service';

const confirm = process.argv.includes('--confirm');

const main = async (): Promise<void> => {
  const env = loadEnv();
  // Sin semilla los tenants alumnoNN SON los vigentes: no hay nada que purgar y decir «no hay antiguos» sería engañoso
  if (!tenantSuffixOptions(env)) {
    console.error('TENANT_SUFFIX_SEED no está definida en este entorno: sin sufijos los tenants alumnoNN son los vigentes y no hay nada que purgar.');
    console.error('Ejecuta este comando con las variables de la API del entorno (en Render, desde la Shell del servicio sigpro-api).');
    process.exit(1);
  }
  const prisma = new PrismaService();
  await prisma.$connect();
  try {
    const seed = new SeedService(prisma, { ...env, SEED_ON_BOOT: false });
    const legacy = await seed.legacyTenants();
    if (legacy.length === 0) return console.log('No hay tenants antiguos (alumnoNN sin sufijo) en esta base: nada que purgar.');
    console.log(`Tenants antiguos (${legacy.length}): ${legacy.join(', ')}`);
    const missing = await seed.missingTenants();
    if (missing.length > 0) console.log(`Aviso: faltan ${missing.length} tenant(s) nuevos en la base. --confirm se negará a borrar hasta que la API arranque con TENANT_SUFFIX_SEED y SEED_ON_BOOT=true.`);
    if (!confirm) return console.log('Es una simulación. Para borrarlos con todos sus datos: añade --confirm.');
    const deleted = await seed.purgeLegacyTenants();
    console.log(`Borrados ${deleted.length} tenant(s) antiguos.`);
  } finally {
    await prisma.$disconnect();
  }
};

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
