import { z } from 'zod';
import { MAX_SUFFIX_LENGTH, MIN_SEED_LENGTH, MIN_SUFFIX_LENGTH, type TenantSuffixOptions } from '../seed/tenant-suffix';

const bool = z
  .enum(['true', 'false'])
  .default('true')
  .transform((value) => value === 'true');

/** Como `bool`, pero apagada por defecto: las medidas de endurecimiento no cambian nada hasta que se activan. */
const boolOff = z
  .enum(['true', 'false'])
  .default('false')
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

  // --- Endurecimiento de los despliegues del curso -------------------------------------------------------------------
  // Todo es opcional: sin estas variables la API se comporta como siempre (entorno demo público). Ver docs/DEPLOY-RENDER.md.
  /** Semilla SECRETA para que los tenants de alumno lleven un sufijo estable (`alumno07-k4x9`). Vacía = sin sufijos. */
  TENANT_SUFFIX_SEED: z
    .string()
    .default('')
    .refine((value) => value === '' || value.length >= MIN_SEED_LENGTH, `debe tener al menos ${MIN_SEED_LENGTH} caracteres (o estar vacía)`),
  TENANT_SUFFIX_LENGTH: z.coerce.number().int().min(MIN_SUFFIX_LENGTH).max(MAX_SUFFIX_LENGTH).default(4),
  /** `false`: las credenciales de demo y la lista de tenants solo se sirven con sesión o con `X-Admin-Key`. */
  LAB_PUBLIC: bool,
  /** `true`: /auth/register, /auth/forgot y /auth/resend rechazan con 422 los correos de otros dominios. */
  RESTRICT_EMAIL_DOMAINS: boolOff,
  /** Dominios ficticios admitidos cuando `RESTRICT_EMAIL_DOMAINS=true` (coincidencia exacta, separados por comas). */
  ALLOWED_EMAIL_DOMAINS: z.string().default('sigpro.test,example.com'),
  /** `true`: añade `X-Robots-Tag: noindex, nofollow` a todas las respuestas de la API. */
  ROBOTS_NOINDEX: boolOff,
});

export type Env = z.infer<typeof envSchema>;

export const ENV = Symbol('ENV');

export const loadEnv = (raw: NodeJS.ProcessEnv = process.env): Env => {
  const parsed = envSchema.safeParse(raw);
  if (parsed.success) return parsed.data;
  // Los mensajes de Zod no incluyen el valor recibido: la semilla y las claves nunca llegan al log
  const detail = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
  throw new Error(`Configuración de entorno inválida → ${detail}`);
};

/** Entorno en el que se muestran los usuarios de prueba (dev/staging, nunca producción). */
const isTestEnvironment = (env: Pick<Env, 'APP_ENV'>): boolean => env.APP_ENV !== 'production';

/** ¿Hay usuarios de prueba que servir a alguien con sesión (o con `X-Admin-Key`)? */
export const hasTestUsers = isTestEnvironment;

/** ¿Se ofrecen a cualquiera, sin sesión (panel de la pantalla de acceso y `GET /config`)? Con `LAB_PUBLIC=false`, no. */
export const showsTestUsers = (env: Pick<Env, 'APP_ENV' | 'LAB_PUBLIC'>): boolean => isTestEnvironment(env) && env.LAB_PUBLIC;

/** Opciones de sufijo de tenant, o `undefined` si no hay semilla (ids históricos `alumno07`). */
export const tenantSuffixOptions = (env: Pick<Env, 'TENANT_SUFFIX_SEED' | 'TENANT_SUFFIX_LENGTH'>): TenantSuffixOptions | undefined =>
  env.TENANT_SUFFIX_SEED === '' ? undefined : { seed: env.TENANT_SUFFIX_SEED, length: env.TENANT_SUFFIX_LENGTH };

/** Los nombres de los tenants son un secreto: con sufijos, o con el laboratorio cerrado, listarlos exige `X-Admin-Key`. */
export const tenantListIsPrivate = (env: Pick<Env, 'TENANT_SUFFIX_SEED' | 'LAB_PUBLIC'>): boolean => env.TENANT_SUFFIX_SEED !== '' || !env.LAB_PUBLIC;

/** Dominios de correo admitidos en minúsculas y sin espacios. */
export const allowedEmailDomains = (env: Pick<Env, 'ALLOWED_EMAIL_DOMAINS'>): ReadonlySet<string> =>
  new Set(
    env.ALLOWED_EMAIL_DOMAINS.split(',')
      .map((domain) => domain.trim().toLowerCase())
      .filter((domain) => domain !== ''),
  );
