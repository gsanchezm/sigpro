// Lógica pura de los formularios de No conformidades en móvil: alta (web: NewNcDialog) y edición del detalle (web:
// NcDetailDialog + `diffNcDraft`). Valida con los esquemas Zod compartidos con la API. Sin imports de react-native: se
// prueba con Vitest en Node (`form.test.ts`).
//
// La descripción se guarda como HTML saneado; la web la edita con un editor enriquecido y el móvil, como texto plano (un
// párrafo por línea), igual que Requisitos: se reutilizan sus conversiones.
import { createNcSchema, flattenIssues, updateNcSchema, type CreateNcInput, type NcDetailDto, type NcSeverity, type UpdateNcInput } from '@sigpro/shared';
import { descriptionToText, normalizeText, textToDescription, type Validation } from '../requirements/form';

export { fieldErrorsOf, withoutErrors, type Validation } from '../requirements/form';

/** Campos del alta: la severidad no tiene valor inicial (la web obliga a elegirla). */
export interface NewNcDraft {
  readonly programCode: string;
  readonly severity: NcSeverity | null;
  /** Texto plano, no HTML. */
  readonly description: string;
}

export const EMPTY_NEW_DRAFT: NewNcDraft = { programCode: '', severity: null, description: '' };

/**
 * Cuerpo del alta tal como lo valida el esquema: sin severidad viaja `''`, que Zod rechaza con `severityRequired` (el
 * mensaje de la web). La asignación no existe en el alta de la web: el esquema la deja en `null`.
 */
export const createInputOf = (draft: NewNcDraft): Record<string, unknown> => ({
  programCode: draft.programCode,
  severity: draft.severity ?? '',
  description: textToDescription(draft.description),
});

/** Valida el alta con el mismo esquema que la API. */
export const validateCreate = (input: Record<string, unknown>): Validation<CreateNcInput> => {
  const parsed = createNcSchema.safeParse(input);
  return parsed.success ? { success: true, data: parsed.data } : { success: false, errors: flattenIssues(parsed.error.issues) };
};

/** Campos editables del detalle (los de la web): severidad, descripción y asignación (`''` = sin asignar). */
export interface NcEditDraft {
  readonly severity: NcSeverity;
  readonly description: string;
  readonly assigneeId: string;
}

type Editable = Pick<NcDetailDto, 'severity' | 'description' | 'assigneeId'>;

/** Valores iniciales de la edición a partir de la NC. */
export const editDraftOf = (nc: Editable): NcEditDraft => ({ severity: nc.severity, description: descriptionToText(nc.description), assigneeId: nc.assigneeId ?? '' });

/** Id que viaja a la API: `''` (ninguna persona) es `null`. */
const assigneeOf = (draft: NcEditDraft): string | null => (draft.assigneeId === '' ? null : draft.assigneeId);

/** El texto de la descripción cambió (los saltos de línea sobrantes no cuentan). */
export const descriptionChanged = (nc: Editable, draft: NcEditDraft): boolean => normalizeText(draft.description) !== descriptionToText(nc.description);

/**
 * Solo lo que cambió respecto a la NC (es lo que viaja en el PATCH). La descripción únicamente si su texto cambió: si se
 * reenviara el HTML regenerado en una edición de severidad, la API lo vería distinto del guardado y registraría una
 * edición de descripción sin motivo. Quitar la asignación es `assigneeId: null`, distinto de no haberla tocado (ausente).
 */
export const buildChanges = (nc: Editable, draft: NcEditDraft): UpdateNcInput => ({
  ...(draft.severity === nc.severity ? {} : { severity: draft.severity }),
  ...(descriptionChanged(nc, draft) ? { description: textToDescription(draft.description) } : {}),
  ...(assigneeOf(draft) === nc.assigneeId ? {} : { assigneeId: assigneeOf(draft) }),
});

/** ¿Hay algo que enviar? Sin cambios «Guardar» queda deshabilitado (la API rechazaría un PATCH vacío). */
export const hasChanges = (changes: UpdateNcInput): boolean => Object.keys(changes).length > 0;

/** Valida la edición con el mismo esquema que la API (incluido «no hay nada que actualizar»). */
export const validateUpdate = (changes: UpdateNcInput): Validation<UpdateNcInput> => {
  const parsed = updateNcSchema.safeParse(changes);
  return parsed.success ? { success: true, data: parsed.data } : { success: false, errors: flattenIssues(parsed.error.issues) };
};
