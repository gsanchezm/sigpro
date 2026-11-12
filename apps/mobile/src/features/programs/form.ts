// Lógica pura de los formularios de Programas en móvil: alta en tres pasos (web: ProgramWizard), edición (web: ProgramEditPage)
// y hitos (web: MilestonesPanelNewDialog y la edición de MilestonesPanel). Valida con los esquemas Zod compartidos con la API
// y traduce los 422 a errores por campo. Sin imports de react-native: se prueba con Vitest en Node (`form.test.ts`).
import {
  ApiError,
  createMilestoneSchema,
  createProgramSchema,
  flattenIssues,
  programStep1Schema,
  programStep2Schema,
  updateMilestoneSchema,
  updateProgramSchema,
  type CreateMilestoneInput,
  type CreateProgramInput,
  type MilestoneDto,
  type Priority,
  type ProgramDto,
  type ProgramStatus,
  type UpdateMilestoneInput,
  type UpdateProgramInput,
} from '@sigpro/shared';

/** Campos del formulario. Las fechas son `YYYY-MM-DD` escritas a mano y el presupuesto es texto hasta validar. */
export interface ProgramDraft {
  readonly name: string;
  readonly description: string;
  readonly ownerId: string;
  readonly status: ProgramStatus;
  readonly startDate: string;
  readonly endDate: string;
  readonly budget: string;
  readonly priority: Priority;
  readonly classified: boolean;
  /** Solo el alta: aviso por correo al equipo (paso 3). */
  readonly notify: boolean;
}

/** Borrador del alta: estado inicial «Borrador», prioridad media y aviso activado (como la web). */
export const EMPTY_DRAFT: ProgramDraft = {
  name: '',
  description: '',
  ownerId: '',
  status: 'draft',
  startDate: '',
  endDate: '',
  budget: '',
  priority: 'medium',
  classified: false,
  notify: true,
};

/** Campos que cuentan para «hay cambios» en la edición (el aviso por correo no existe al editar). */
const EDITABLE_FIELDS = ['name', 'description', 'ownerId', 'status', 'startDate', 'endDate', 'budget', 'priority', 'classified'] as const;

export type Errors = Readonly<Record<string, string>>;
export type Validation<T> = { readonly success: true; readonly data: T } | { readonly success: false; readonly errors: Errors };
export type WizardStep = 1 | 2 | 3;

interface Issue {
  readonly path: readonly (string | number)[];
  readonly message: string;
}

/** `{ campo: claveI18n }` (primer error de cada campo) a partir del resultado de un `safeParse`. */
const errorsOf = (result: { readonly success: true } | { readonly success: false; readonly error: { readonly issues: readonly Issue[] } }): Errors =>
  result.success ? {} : flattenIssues(result.error.issues);

/** El presupuesto viaja como número a los esquemas; el texto vacío o no numérico da 0, que el esquema rechaza. */
const planOf = (draft: ProgramDraft) => ({ ...draft, budget: Number(draft.budget) });

/** Errores de un paso del asistente. El paso 3 no tiene campos: su validación es la del envío. */
export const stepErrors = (step: WizardStep, draft: ProgramDraft): Errors => {
  if (step === 1) return errorsOf(programStep1Schema.safeParse(draft));
  if (step === 2) return errorsOf(programStep2Schema.safeParse(planOf(draft)));
  return {};
};

/** Valida el alta completa con el mismo esquema que la API (datos listos o errores por campo). */
export const validateCreate = (draft: ProgramDraft): Validation<CreateProgramInput> => {
  const parsed = createProgramSchema.safeParse(planOf(draft));
  return parsed.success ? { success: true, data: parsed.data } : { success: false, errors: errorsOf(parsed) };
};

/** Valores iniciales de la edición a partir del programa guardado. */
export const draftOfProgram = (program: ProgramDto): ProgramDraft => ({
  name: program.name,
  description: program.description,
  ownerId: program.ownerId,
  status: program.status,
  startDate: program.startDate,
  endDate: program.endDate,
  budget: String(program.budgetEur),
  priority: program.priority,
  classified: program.classified,
  notify: true,
});

/** ¿El borrador difiere del programa guardado? Sin cambios, «Guardar» queda deshabilitado (la API rechaza un PATCH vacío). */
export const isDirty = (draft: ProgramDraft, baseline: ProgramDraft): boolean => EDITABLE_FIELDS.some((field) => draft[field] !== baseline[field]);

/**
 * Valida la edición con el esquema PATCH de la API. Se envían todos los campos, como hace la web: la API solo audita los que
 * cambian y el esquema no aplica valores por defecto a los ausentes.
 */
export const validateUpdate = (draft: ProgramDraft): Validation<UpdateProgramInput> => {
  const parsed = updateProgramSchema.safeParse(planOf(draft));
  return parsed.success ? { success: true, data: parsed.data } : { success: false, errors: errorsOf(parsed) };
};

/** Errores por campo de un 422 de la API (`{ campo: claveI18n }`), o `null` si el fallo no es de validación. */
export const fieldErrorsOf = (failure: unknown): Errors | null => (failure instanceof ApiError && failure.status === 422 ? (failure.body.errors ?? {}) : null);

/** Quita el error de los campos que acaban de cambiar (el aviso desaparece al corregir, como la web). */
export const withoutErrors = (errors: Errors, fields: readonly string[]): Errors => Object.fromEntries(Object.entries(errors).filter(([field]) => !fields.includes(field)));

// --- Hitos -----------------------------------------------------------------

export interface MilestoneDraft {
  readonly name: string;
  readonly dueDate: string;
}

/** Alta de un hito: nombre y fecha límite con el esquema de la API. */
export const validateMilestoneCreate = (draft: MilestoneDraft): Validation<CreateMilestoneInput> => {
  const parsed = createMilestoneSchema.safeParse({ name: draft.name.trim(), dueDate: draft.dueDate });
  return parsed.success ? { success: true, data: parsed.data } : { success: false, errors: errorsOf(parsed) };
};

/** Solo los campos del hito que cambiaron (el nombre sin espacios sobrantes). Vacío = nada que guardar. */
export const milestoneChanges = (item: MilestoneDto, draft: MilestoneDraft): UpdateMilestoneInput => {
  const name = draft.name.trim();
  return {
    ...(name === item.name ? {} : { name }),
    ...(draft.dueDate === item.dueDate ? {} : { dueDate: draft.dueDate }),
  };
};

/** Valida la edición de un hito con el esquema de la API (incluido «no hay nada que actualizar»). */
export const validateMilestoneUpdate = (changes: UpdateMilestoneInput): Validation<UpdateMilestoneInput> => {
  const parsed = updateMilestoneSchema.safeParse(changes);
  return parsed.success ? { success: true, data: parsed.data } : { success: false, errors: errorsOf(parsed) };
};

/** Hay algo que enviar al editar un hito. */
export const hasMilestoneChanges = (changes: UpdateMilestoneInput): boolean => Object.keys(changes).length > 0;
