import { z } from 'zod';

const bool = z
  .enum(['true', 'false'])
  .default('true')
  .transform((value) => value === 'true');

export const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  PORT: z.coerce.number().int().default(3000),
  JWT_SECRET: z.string().min(8).default('dev-only-change-me'),
  ADMIN_KEY: z.string().min(1).default('dev-admin-key'),
  CORS_ORIGIN: z.string().default('http://localhost:5173,http://localhost:8081'),
  SEED_ON_BOOT: bool,
  SEED_STUDENT_TENANTS: z.coerce.number().int().min(0).max(100).default(25),
  DOCS_BASIC_AUTH: z.string().default(''),
  APP_ENV: z.string().default('dev'),
  ACCESS_TOKEN_TTL_S: z.coerce.number().int().positive().default(900),
  // Defectos plantados del laboratorio (docs/planted-bugs.md): activos por defecto; `false` deja la app «limpia»
  PLANTED_BUGS: bool,
  // Intervalo del simulador de misión en ms (0 = desactivado). Solo emite a tenants con algún cliente conectado
  SIMULATOR_MS: z.coerce.number().int().min(0).max(60000).default(4000),
});

export type Env = z.infer<typeof envSchema>;

export const ENV = Symbol('ENV');

export const loadEnv = (raw: NodeJS.ProcessEnv = process.env): Env => {
  const parsed = envSchema.safeParse(raw);
  if (parsed.success) return parsed.data;
  const detail = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
  throw new Error(`Configuración de entorno inválida → ${detail}`);
};

/** Entorno en el que se muestran los usuarios de prueba (dev/staging, nunca producción). */
export const showsTestUsers = (env: Pick<Env, 'APP_ENV'>): boolean => env.APP_ENV !== 'production';
