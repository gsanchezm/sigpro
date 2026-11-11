// Configuración de la suite. Todo sale de variables de entorno (o de un `.env`) para poder apuntarla a tu máquina
// o a Render sin tocar los specs. Mira `.env.example`.

try {
  // Node ≥ 20.12 lee el `.env` sin dependencias; si no existe, se usan los valores por defecto
  process.loadEnvFile('.env');
} catch {
  /* sin .env */
}

/** Tu usuario de alumno: `alumnoNN`. Es a la vez el correo `alumnoNN@sigpro.lab` y el tenant donde trabajas. */
export const STUDENT = process.env.SIGPRO_STUDENT ?? 'alumno01';
/** Tenant de trabajo (cabecera `x-tenant`). Por defecto, el de tu usuario. */
export const TENANT = process.env.SIGPRO_TENANT ?? STUDENT;
export const WEB_URL = (process.env.SIGPRO_WEB_URL ?? 'http://localhost:5173').replace(/\/$/, '');
export const API_URL = (process.env.SIGPRO_API_URL ?? 'http://localhost:3000/api').replace(/\/$/, '');

export interface Credentials {
  readonly email: string;
  readonly password: string;
  /** Código del segundo paso de autenticación, si el usuario lo exige. */
  readonly mfa?: string;
}

/** Los cuatro roles del seed: existen en TODOS los tenants (tabla de usuarios del lab). */
export const ROLES = {
  admin: { email: 'admin@sigpro.test', password: 'Admin1234!', mfa: '123456' },
  program_manager: { email: 'gestor@sigpro.test', password: 'Gestor1234!' },
  consultant: { email: 'consultor@sigpro.test', password: 'Consul1234!' },
  auditor: { email: 'auditor@sigpro.test', password: 'Audit1234!' },
} as const satisfies Record<string, Credentials>;

export type RoleName = keyof typeof ROLES;
export const ROLE_NAMES = Object.keys(ROLES) as readonly RoleName[];

/** Tu usuario personal: administrador de tu tenant. */
export const STUDENT_USER: Credentials = {
  email: `${STUDENT}@sigpro.lab`,
  password: process.env.SIGPRO_STUDENT_PASSWORD ?? 'Alumno1234!',
};

/** Dónde se guarda la sesión de cada rol (`storageState`). Lleva el tenant en el nombre para no mezclar entornos. */
export const authFile = (role: RoleName): string => `.auth/${TENANT}-${role}.json`;
