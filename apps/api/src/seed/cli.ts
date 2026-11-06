// `pnpm seed` — (re)crea todos los tenants con el seed determinista, sin arrancar Nest.
import { loadEnv } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';
import { SeedService } from './seed.service';

const main = async (): Promise<void> => {
  const env = loadEnv();
  const prisma = new PrismaService();
  await prisma.$connect();
  try {
    const seed = new SeedService(prisma, { ...env, SEED_ON_BOOT: false });
    const results = await seed.resetAll();
    results.forEach((r) => console.log(`✔ ${r.tenant} (${r.ms} ms)`));
    console.log(`Seed completado: ${results.length} tenant(s).`);
  } finally {
    await prisma.$disconnect();
  }
};

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
