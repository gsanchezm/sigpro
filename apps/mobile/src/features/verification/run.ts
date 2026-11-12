import { ApiError, formatTrace, runFieldsSchema, type TestResult, type TestRunDto } from '@sigpro/shared';

// Lógica pura del formulario «Registrar ejecución»: validación con el esquema compartido con la API y traducción de los
// fallos del servidor a un texto (422 por campo, 413 por tamaño y el resto con su traza), como `RunForm` de la web.
// Sin react-native: se prueba con Vitest.

/** Error por campo: clave de i18n de `verificacion` (`resultRequired`, `notesLong`). */
export type RunFieldErrors = { readonly result?: string; readonly notes?: string };

export type RunValidation =
  | { readonly success: true; readonly data: { readonly result: TestResult; readonly notes: string } }
  | { readonly success: false; readonly errors: RunFieldErrors };

/** Valida resultado (obligatorio) y notas (hasta 1000 caracteres, recortadas) con `runFieldsSchema`. */
export const validateRun = (result: TestResult | '', notes: string): RunValidation => {
  const parsed = runFieldsSchema.safeParse({ result: result || undefined, notes });
  if (parsed.success) return { success: true, data: parsed.data };
  const messageOf = (field: string): string | undefined => parsed.error.issues.find((issue) => issue.path[0] === field)?.message;
  const resultKey = messageOf('result');
  const notesKey = messageOf('notes');
  return { success: false, errors: { ...(resultKey ? { result: resultKey } : {}), ...(notesKey ? { notes: notesKey } : {}) } };
};

/** Fallo del servidor listo para pintar: código HTTP (o «—»), texto y, si lo hay, el error del campo «resultado». */
export interface RunFailure {
  readonly status: string;
  readonly text: string;
  readonly resultError: string | null;
}

/**
 * Traduce un fallo al enviar la ejecución. 422 → el mensaje del primer campo con error (`message` convierte la clave de i18n);
 * 413 (un archivo pasa del límite de multer) → «Un archivo supera los 2 MB»; el resto → la traza HTTP o el texto genérico.
 * La API no devuelve 415: el tipo real del archivo se comprueba por su firma y falla con 422 (`fileBadTypeServer`).
 */
export const describeRunFailure = (error: unknown, message: (key: string) => string, generic: string): RunFailure => {
  if (!(error instanceof ApiError)) return { status: '—', text: formatTrace(error) || generic, resultError: null };
  const status = String(error.status || '—');
  const fieldErrors = error.status === 422 ? (error.body.errors ?? {}) : null;
  if (fieldErrors) return { status, text: message(Object.values(fieldErrors)[0] ?? 'required'), resultError: fieldErrors.result ?? null };
  if (error.status === 413) return { status, text: message('fileTooBigServer'), resultError: null };
  return { status, text: formatTrace(error) || generic, resultError: null };
};

/** Cuerpo del aviso «Ejecución registrada»: `TC-005: Bloqueado · RUN-051 con 2 archivo(s) de evidencia`. */
export const savedToastBody = (run: TestRunDto, parts: { readonly body: string; readonly files: (count: number) => string }): string =>
  `${parts.body} · ${run.id}${run.evidences.length > 0 ? ` ${parts.files(run.evidences.length)}` : ''}`;
