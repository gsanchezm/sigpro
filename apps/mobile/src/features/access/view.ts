// Lógica pura de las pantallas de Acceso del móvil (web: `AccessPage.tsx`): validación del registro y de «recuperar contraseña»,
// medidor de contraseña y el retardo mínimo del spinner. Sin imports de react-native: se prueba con Vitest en Node (`view.test.ts`).
import {
  REGISTER_ROLES,
  flattenIssues,
  forgotSchema,
  passwordRules,
  passwordStrength,
  registerSchema,
  type ForgotInput,
  type PasswordStrength,
  type RegisterInput,
  type RegisterRole,
} from '@sigpro/shared';

/** Valores del formulario de registro (los mismos campos que `registerSchema`). */
export interface RegisterValues {
  readonly first: string;
  readonly last: string;
  readonly email: string;
  readonly org: string;
  readonly role: RegisterRole;
  readonly password: string;
  readonly confirm: string;
  readonly terms: boolean;
}

export const EMPTY_REGISTER: RegisterValues = { first: '', last: '', email: '', org: '', role: 'consultant', password: '', confirm: '', terms: false };

/** Errores por campo del formulario: el valor es una clave del espacio `acceso` (la pantalla la traduce al idioma activo). */
export type FieldErrors = Readonly<Record<string, string>>;

/** Resultado de validar un formulario: los datos ya normalizados (sin espacios de los extremos) o los errores por campo. */
export type Parsed<T> = { readonly ok: true; readonly data: T } | { readonly ok: false; readonly errors: FieldErrors };

/** Valida el registro con el esquema compartido (el mismo que la API). `data` es lo que se envía a `POST /auth/register`. */
export const parseRegister = (values: RegisterValues): Parsed<RegisterInput> => {
  const parsed = registerSchema.safeParse(values);
  return parsed.success ? { ok: true, data: parsed.data } : { ok: false, errors: flattenIssues(parsed.error.issues) };
};

/** Valida el correo de «recuperar contraseña» con el esquema compartido. `data` es lo que se envía a `POST /auth/forgot`. */
export const parseForgot = (email: string): Parsed<ForgotInput> => {
  const parsed = forgotSchema.safeParse({ email });
  return parsed.success ? { ok: true, data: parsed.data } : { ok: false, errors: flattenIssues(parsed.error.issues) };
};

/** Solo los errores del registro: `{ campo: claveI18n }`, vacío si todo es válido. */
export const registerErrors = (values: RegisterValues): FieldErrors => {
  const parsed = parseRegister(values);
  return parsed.ok ? {} : parsed.errors;
};

/** Solo los errores de «recuperar contraseña». */
export const forgotErrors = (email: string): FieldErrors => {
  const parsed = parseForgot(email);
  return parsed.ok ? {} : parsed.errors;
};

/** Opciones del rol solicitado: la web enseña el código del rol tal cual (`consultant`, `program_manager`, `auditor`). */
export const REGISTER_ROLE_OPTIONS: readonly { readonly value: RegisterRole; readonly label: string }[] = REGISTER_ROLES.map((role) => ({ value: role, label: role }));

/** Color de las barras del medidor según las reglas cumplidas (0–4); clave de la paleta del tema. */
export type MeterTone = 'border' | 'danger' | 'warn' | 'info' | 'ok';
const METER_TONES: readonly MeterTone[] = ['border', 'danger', 'warn', 'info', 'ok'];

export interface PasswordMeter {
  readonly strength: PasswordStrength;
  /** Reglas cumplidas, en el orden de `r1…r4` (≥10 caracteres · mayúscula y minúscula · número · símbolo). */
  readonly rules: readonly boolean[];
  readonly score: number;
  readonly tone: MeterTone;
  /** Las cuatro barras: `true` si están rellenas (tantas como reglas cumplidas). */
  readonly segments: readonly boolean[];
}

const SEGMENTS = 4;

/** Medidor de contraseña del registro: fuerza, reglas, puntuación y barras (igual que el de la web). */
export const passwordMeter = (password: string): PasswordMeter => {
  const rules = passwordRules(password);
  const score = rules.filter(Boolean).length;
  return {
    strength: passwordStrength(password),
    rules,
    score,
    tone: METER_TONES[score] ?? 'border',
    segments: Array.from({ length: SEGMENTS }, (_, index) => index < score),
  };
};

/** Mantiene el spinner visible un instante (el prototipo simulaba 600–800 ms de red). */
export const MIN_BUSY_MS = 400;

/** Espera a la petición y, como mínimo, `MIN_BUSY_MS`: así «Enviando…» no parpadea cuando la API responde al instante. */
export const withMinDelay = async <T>(work: Promise<T>, minMs: number = MIN_BUSY_MS): Promise<T> => {
  const [result] = await Promise.all([work, new Promise<void>((resolve) => setTimeout(resolve, minMs))]);
  return result;
};
