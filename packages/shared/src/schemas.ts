import { z } from 'zod';
import { PRIORITIES, PROGRAM_STATUSES, REGISTER_ROLES, REQUIREMENT_STATES, REQUIREMENT_TAGS, TEST_RESULTS } from './domain';
import { isPasswordValid } from './password';
import { sanitizeRichText } from './richtext';

// Los mensajes de error son CLAVES i18n (espacio `acceso` o `programas`); la UI las traduce.
// Esto permite validar igual en cliente y servidor y mostrar el texto en el idioma activo.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const emailField = z
  .string()
  .trim()
  .min(1, 'required')
  .refine((v) => v === '' || EMAIL_RE.test(v), 'badEmail');

const requiredText = z.string().trim().min(1, 'required');

export const loginSchema = z.object({
  email: emailField,
  password: z.string().min(1, 'required'),
  remember: z.boolean().default(true),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const mfaSchema = z.object({
  mfaToken: z.string().min(1),
  code: z.string().regex(/^\d{6}$/, 'eMfa'),
});
export type MfaInput = z.infer<typeof mfaSchema>;

export const forgotSchema = z.object({ email: emailField });
export type ForgotInput = z.infer<typeof forgotSchema>;

export const registerSchema = z
  .object({
    first: requiredText,
    last: requiredText,
    email: emailField,
    org: requiredText,
    role: z.enum(REGISTER_ROLES),
    password: z.string().min(1, 'required').refine((v) => v === '' || isPasswordValid(v), 'pwShort'),
    confirm: z.string(),
    terms: z.boolean().refine((v) => v, 'termsReq'),
  })
  .superRefine((value, ctx) => {
    if (value.confirm === value.password) return;
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['confirm'], message: 'pwMismatch' });
  });
export type RegisterInput = z.infer<typeof registerSchema>;

// --- Programas -------------------------------------------------------------

const step1Shape = {
  name: z.string().trim().min(3, 'requiredName'),
  description: z.string().trim().max(2000).default(''),
  ownerId: z.string().min(1, 'requiredOwner'),
  status: z.enum(PROGRAM_STATUSES).default('draft'),
};

const step2Shape = {
  startDate: z.string().regex(ISO_DATE, 'requiredStart'),
  // Fin ausente o no posterior al inicio comparten mensaje (como en el prototipo)
  endDate: z.string().regex(ISO_DATE, 'endAfterStart'),
  budget: z.number({ invalid_type_error: 'budgetPositive' }).positive('budgetPositive'),
  priority: z.enum(PRIORITIES).default('medium'),
  classified: z.boolean().default(false),
};

type DatePair = { startDate: string; endDate: string };

/** Fin estrictamente posterior al inicio; solo compara si ambas fechas tienen formato válido. */
const endAfterStart = (value: DatePair, ctx: z.RefinementCtx): void => {
  const comparable = ISO_DATE.test(value.startDate) && ISO_DATE.test(value.endDate);
  if (!comparable || value.endDate > value.startDate) return;
  ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['endDate'], message: 'endAfterStart' });
};

export const programStep1Schema = z.object(step1Shape);
export const programStep2Schema = z.object(step2Shape).superRefine(endAfterStart);
export const createProgramSchema = z
  .object({ ...step1Shape, ...step2Shape, notify: z.boolean().default(true) })
  .superRefine(endAfterStart);
export type CreateProgramInput = z.infer<typeof createProgramSchema>;

/**
 * Editar programa (PATCH parcial): cualquier campo del alta salvo el aviso por correo. Los valores por defecto no se
 * aplican (un campo ausente no se toca); si llegan las dos fechas se comprueba que el fin sea posterior al inicio.
 */
export const updateProgramSchema = z
  .object({ ...step1Shape, ...step2Shape })
  .partial()
  .superRefine((value, ctx) => endAfterStart({ startDate: value.startDate ?? '', endDate: value.endDate ?? '' }, ctx))
  .refine((value) => Object.values(value).some((field) => field !== undefined), { message: 'nothingToUpdate' });
export type UpdateProgramInput = z.infer<typeof updateProgramSchema>;

// --- Requisitos (mensajes = claves del espacio `requisitos`) -------------------

const requirementTitle = z.string().trim().min(3, 'titleShort').max(120, 'titleLong');
/** El HTML del editor se sanea con la lista blanca antes de validar la longitud. */
const requirementDescription = z.string().max(12000, 'descLong').transform(sanitizeRichText).pipe(z.string().max(4000, 'descLong'));
const requirementTags = z.array(z.enum(REQUIREMENT_TAGS)).max(REQUIREMENT_TAGS.length).transform((tags) => Array.from(new Set(tags)));

export const createRequirementSchema = z.object({
  programCode: z.string().min(1),
  parentCode: z.string().min(1).nullable().default(null),
  title: requirementTitle,
  description: requirementDescription.default(''),
  priority: z.enum(PRIORITIES).default('medium'),
  tags: requirementTags.default([]),
});
export type CreateRequirementInput = z.infer<typeof createRequirementSchema>;

export const updateRequirementSchema = z
  .object({
    title: requirementTitle.optional(),
    description: requirementDescription.optional(),
    priority: z.enum(PRIORITIES).optional(),
    tags: requirementTags.optional(),
  })
  .refine((value) => Object.values(value).some((field) => field !== undefined), { message: 'nothingToUpdate' });
export type UpdateRequirementInput = z.infer<typeof updateRequirementSchema>;

export const transitionRequirementSchema = z.object({ to: z.enum(REQUIREMENT_STATES, { errorMap: () => ({ message: 'badState' }) }) });
export type TransitionRequirementInput = z.infer<typeof transitionRequirementSchema>;

export const moveRequirementSchema = z.object({ targetCode: z.string().min(1, 'required'), placement: z.enum(['before', 'after']) });
export type MoveRequirementInput = z.infer<typeof moveRequirementSchema>;

// --- Verificación ----------------------------------------------------------

/** Campos de texto de una ejecución; los archivos viajan aparte (multipart). */
export const runFieldsSchema = z.object({
  result: z.enum(TEST_RESULTS, { errorMap: () => ({ message: 'resultRequired' }) }),
  notes: z.string().trim().max(1000, 'notesLong').default(''),
});
export type RunFieldsInput = z.infer<typeof runFieldsSchema>;

// --- Documentos ------------------------------------------------------------

export const publishVersionSchema = z.object({
  lines: z.array(z.string().max(200, 'lineLong')).min(1, 'linesRequired').max(80, 'linesMax'),
  note: z.string().trim().max(200, 'noteLong').default(''),
});
export type PublishVersionInput = z.infer<typeof publishVersionSchema>;

// --- Admin -----------------------------------------------------------------

export const chaosSchema = z.object({
  latencyMs: z.number().int().min(0).max(5000).default(0),
  errorRate: z.number().min(0).max(1).default(0),
  flakyLabels: z.boolean().default(false),
});
export type ChaosConfig = z.infer<typeof chaosSchema>;

/** Convierte los `issues` de Zod en `{ campo: claveI18n }` (primer error de cada campo). */
export const flattenIssues = (issues: readonly { path: readonly (string | number)[]; message: string }[]): Record<string, string> =>
  issues.reduce<Record<string, string>>((acc, issue) => {
    const key = issue.path.join('.');
    return key in acc ? acc : { ...acc, [key]: issue.message };
  }, {});
