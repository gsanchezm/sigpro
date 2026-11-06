import {
  ApiError,
  EVIDENCE_MAX_BYTES,
  EVIDENCE_MAX_FILES,
  EVIDENCE_MIME_TYPES,
  TEST_RESULTS,
  VERIFICACION_DYNAMIC_TESTIDS,
  VERIFICACION_TESTIDS,
  runFieldsSchema,
  type MessageKey,
  type TestResult,
  type TestRunDto,
} from '@sigpro/shared';
import { useEffect, useRef, useState, type DragEvent, type FormEvent } from 'react';
import { formatTrace } from '../../lib/errors';
import { useAuth } from '../../state/auth';
import { useI18n } from '../../state/i18n';
import { Spinner } from '../../ui/Spinner';
import { formatBytes } from './EvidenceImage';

const ACCEPT = '.png,.jpg,.jpeg,.pdf,image/png,image/jpeg,application/pdf';

/** Tipo declarado o, si el navegador no lo da (arrastrar desde algunos gestores), el deducido de la extensión. */
const mimeOf = (file: File): string => {
  if (file.type) return file.type;
  const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
  return ({ png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', pdf: 'application/pdf' } as Readonly<Record<string, string>>)[extension] ?? '';
};

/** Mismo archivo = mismo nombre y mismo tamaño (no se añade dos veces). */
const sameFile = (a: File, b: File): boolean => a.name === b.name && a.size === b.size;

/** Vista previa de un archivo elegido (las imágenes con su propio `alt`; los PDF, un icono de texto). */
const FilePreview = ({ file, onRemove, index }: { file: File; onRemove: () => void; index: number }) => {
  const { t } = useI18n();
  const [url, setUrl] = useState<string | null>(null);
  const isImage = mimeOf(file).startsWith('image/');

  useEffect(() => {
    if (!isImage) return;
    const created = URL.createObjectURL(file);
    setUrl(created);
    return () => URL.revokeObjectURL(created);
  }, [file, isImage]);

  return (
    <li className="flex items-center gap-2 rounded-[4px] border border-border bg-surface px-2 py-1.5">
      {isImage && url ? (
        <img src={url} alt={t('verificacion', 'previewAlt', { name: file.name })} width={40} height={30} className="h-[30px] w-10 flex-none rounded-[3px] object-cover" />
      ) : (
        <span aria-hidden="true" className="grid h-[30px] w-10 flex-none place-items-center rounded-[3px] bg-danger-soft text-[10px] font-bold text-danger">
          PDF
        </span>
      )}
      <span className="min-w-0 flex-1 truncate text-[12.5px]" title={file.name}>
        {file.name}
      </span>
      <span className="font-mono text-[11.5px] text-fg-3">{formatBytes(file.size)}</span>
      <button
        type="button"
        data-testid={VERIFICACION_DYNAMIC_TESTIDS.RUN_FILE_REMOVE(index)}
        aria-label={t('verificacion', 'removeFile', { name: file.name })}
        onClick={onRemove}
        className="grid size-6 cursor-pointer place-items-center rounded-[4px] border-0 bg-transparent text-[16px] leading-none text-fg-3 hover:bg-surface-2"
      >
        ×
      </button>
    </li>
  );
};

interface RunFormProps {
  readonly testCaseCode: string;
  readonly canExecute: boolean;
  readonly onSaved: (run: TestRunDto) => void;
}

/**
 * Registrar ejecución: resultado (radio), notas y evidencias con tres entradas — un archivo, varios archivos y una zona
 * para arrastrar —. Los archivos se validan al añadirlos (tipo y 2 MB; hasta 5) y otra vez en el servidor.
 */
export const RunForm = ({ testCaseCode, canExecute, onSaved }: RunFormProps) => {
  const { t } = useI18n();
  const { api } = useAuth();
  const [result, setResult] = useState<TestResult | ''>('');
  const [notes, setNotes] = useState('');
  const [files, setFiles] = useState<readonly File[]>([]);
  const [fileErrors, setFileErrors] = useState<readonly string[]>([]);
  const [resultError, setResultError] = useState<string | null>(null);
  const [serverError, setServerError] = useState<{ status: string; text: string } | null>(null);
  const [over, setOver] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const message = (key: string) => t('verificacion', key as MessageKey<'verificacion'>);
  const firstRadio = useRef<HTMLInputElement>(null);

  /** Añade los archivos válidos y avisa de los rechazados (tipo, tamaño o máximo de 5). */
  const addFiles = (incoming: readonly File[]) => {
    const errors: string[] = [];
    const accepted: File[] = [];
    for (const file of incoming) {
      if (!(EVIDENCE_MIME_TYPES as readonly string[]).includes(mimeOf(file))) errors.push(t('verificacion', 'fileBadType', { name: file.name }));
      else if (file.size > EVIDENCE_MAX_BYTES) errors.push(t('verificacion', 'fileTooBig', { name: file.name }));
      else if (files.some((existing) => sameFile(existing, file)) || accepted.some((existing) => sameFile(existing, file))) continue;
      else if (files.length + accepted.length >= EVIDENCE_MAX_FILES) {
        if (!errors.includes(t('verificacion', 'fileTooMany'))) errors.push(t('verificacion', 'fileTooMany'));
      } else accepted.push(file);
    }
    setFiles((current) => [...current, ...accepted]);
    setFileErrors(errors);
  };

  const fromInput = (list: FileList | null) => addFiles(Array.from(list ?? []));

  const onDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setOver(false);
    addFiles(Array.from(event.dataTransfer.files));
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const parsed = runFieldsSchema.safeParse({ result: result || undefined, notes });
    if (!parsed.success) {
      const key = parsed.error.issues.find((issue) => issue.path[0] === 'result')?.message;
      setResultError(key ?? null);
      if (key) firstRadio.current?.focus();
      return;
    }
    setSubmitting(true);
    setServerError(null);
    const form = new FormData();
    form.set('result', parsed.data.result);
    form.set('notes', parsed.data.notes);
    files.forEach((file) => form.append('files', file));
    try {
      const run = await api.testCases.execute(testCaseCode, form);
      setResult('');
      setNotes('');
      setFiles([]);
      setFileErrors([]);
      setResultError(null);
      onSaved(run);
    } catch (error) {
      const fieldErrors = error instanceof ApiError && error.status === 422 ? (error.body.errors ?? {}) : null;
      if (fieldErrors?.result) setResultError(fieldErrors.result);
      setServerError({
        status: error instanceof ApiError ? String(error.status || '—') : '—',
        text: fieldErrors ? message(Object.values(fieldErrors)[0] ?? 'required') : formatTrace(error) || t('common', 'genericError'),
      });
    } finally {
      setSubmitting(false);
    }
  };

  const resultTestIds: Readonly<Record<TestResult, string>> = {
    pass: VERIFICACION_DYNAMIC_TESTIDS.RUN_RESULT_OPTION('pass'),
    fail: VERIFICACION_DYNAMIC_TESTIDS.RUN_RESULT_OPTION('fail'),
    blocked: VERIFICACION_DYNAMIC_TESTIDS.RUN_RESULT_OPTION('blocked'),
  };
  const disabledTitle = canExecute ? undefined : t('verificacion', 'denied');

  return (
    <section id="run" aria-labelledby="run-form-title" className="card flex flex-col gap-3 p-4">
      <h2 id="run-form-title" className="m-0 text-[14px] font-semibold">
        {t('verificacion', 'runFormTitle')}
      </h2>

      {!canExecute ? (
        <p role="note" data-testid={VERIFICACION_TESTIDS.RUN_DENIED} className="alert alert-warn m-0 text-[12.5px]">
          {t('verificacion', 'denied')}
        </p>
      ) : null}

      {serverError ? (
        <div role="alert" data-testid={VERIFICACION_TESTIDS.RUN_SERVER_ERROR} className="alert alert-danger text-[12.5px]">
          <strong className="font-mono">{serverError.status}</strong> · {serverError.text}
        </div>
      ) : null}

      <form data-testid={VERIFICACION_TESTIDS.RUN_FORM} noValidate onSubmit={(event) => void submit(event)} aria-busy={submitting} className="flex flex-col gap-3.5">
        <fieldset disabled={!canExecute} title={disabledTitle} data-testid={VERIFICACION_TESTIDS.RUN_RESULT} className="m-0 flex flex-col gap-1.5 border-0 p-0">
          <legend className="mb-1 p-0 text-[12px] font-medium text-fg-2">
            {t('verificacion', 'resultLabel')} <span aria-hidden="true" className="text-danger">*</span>
          </legend>
          <div className="flex flex-wrap gap-4">
            {TEST_RESULTS.map((value, index) => (
              <label key={value} className="flex min-h-6 cursor-pointer items-center gap-1.5">
                <input
                  ref={index === 0 ? firstRadio : undefined}
                  type="radio"
                  name="run-result"
                  value={value}
                  data-testid={resultTestIds[value]}
                  checked={result === value}
                  aria-describedby={resultError ? 'run-result-error' : undefined}
                  onChange={() => {
                    setResult(value);
                    setResultError(null);
                  }}
                  className="m-0 accent-accent"
                />
                {t('verificacion', `r_${value}`)}
              </label>
            ))}
          </div>
          {resultError ? (
            <span id="run-result-error" role="alert" data-testid={VERIFICACION_TESTIDS.RUN_RESULT_ERROR} className="text-[12px] text-danger">
              {message(resultError)}
            </span>
          ) : null}
        </fieldset>

        <div className="flex flex-col gap-1">
          <label htmlFor="run-notes" className="label">
            {t('verificacion', 'notesLabel')}
          </label>
          <textarea
            id="run-notes"
            data-testid={VERIFICACION_TESTIDS.RUN_NOTES}
            rows={3}
            value={notes}
            disabled={!canExecute}
            title={disabledTitle}
            placeholder={t('verificacion', 'notesPlaceholder')}
            onChange={(event) => setNotes(event.target.value)}
            className="input !h-auto !bg-surface px-2.5 py-2"
            style={{ resize: 'vertical' }}
          />
        </div>

        <fieldset disabled={!canExecute} title={disabledTitle} className="m-0 flex flex-col gap-2 border-0 p-0">
          <legend className="mb-1 p-0 text-[12px] font-medium text-fg-2">{t('verificacion', 'evidenceTitle')}</legend>
          <p className="m-0 text-[12px] text-fg-3">{t('verificacion', 'evidenceHint')}</p>

          <div className="flex flex-wrap gap-2">
            <label className="btn btn-secondary !h-8 cursor-pointer !px-3">
              {t('verificacion', 'evidenceSimple')}
              <input type="file" accept={ACCEPT} data-testid={VERIFICACION_TESTIDS.RUN_EVIDENCE_SIMPLE} onChange={(event) => { fromInput(event.target.files); event.target.value = ''; }} className="sr-only" />
            </label>
            <label className="btn btn-secondary !h-8 cursor-pointer !px-3">
              {t('verificacion', 'evidenceMultiple')}
              <input type="file" multiple accept={ACCEPT} data-testid={VERIFICACION_TESTIDS.RUN_EVIDENCE_MULTIPLE} onChange={(event) => { fromInput(event.target.files); event.target.value = ''; }} className="sr-only" />
            </label>
          </div>

          <label
            data-testid={VERIFICACION_TESTIDS.RUN_DROPZONE}
            data-over={over}
            onDragOver={(event) => {
              event.preventDefault();
              setOver(true);
            }}
            onDragLeave={() => setOver(false)}
            onDrop={onDrop}
            className="dropzone flex cursor-pointer flex-col items-center gap-0.5 rounded-[6px] border-2 border-dashed border-border-strong px-4 py-5 text-center"
          >
            <span className="font-medium">{t('verificacion', 'dropzone')}</span>
            <span className="text-[12px] text-fg-3">{t('verificacion', 'dropzoneHint')}</span>
            <input
              type="file"
              multiple
              accept={ACCEPT}
              aria-label={t('verificacion', 'dropzoneLabel')}
              data-testid={VERIFICACION_TESTIDS.RUN_DROPZONE_INPUT}
              onChange={(event) => {
                fromInput(event.target.files);
                event.target.value = '';
              }}
              className="sr-only"
            />
          </label>

          {fileErrors.length > 0 ? (
            <ul role="alert" data-testid={VERIFICACION_TESTIDS.RUN_FILES_ERROR} className="m-0 flex list-none flex-col gap-0.5 p-0 text-[12px] text-danger">
              {fileErrors.map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
          ) : null}

          <div className="flex flex-col gap-1.5">
            <span className="text-[12px] font-medium text-fg-2">{t('verificacion', 'filesTitle')}</span>
            {files.length === 0 ? (
              <p className="m-0 text-[12px] text-fg-3">{t('verificacion', 'filesNone')}</p>
            ) : (
              <ul data-testid={VERIFICACION_TESTIDS.RUN_FILES} aria-label={t('verificacion', 'filesTitle')} className="m-0 flex list-none flex-col gap-1.5 p-0">
                {files.map((file, index) => (
                  <FilePreview
                    key={`${file.name}-${file.size}`}
                    file={file}
                    index={index}
                    onRemove={() => {
                      setFiles((current) => current.filter((candidate) => candidate !== file));
                      setFileErrors([]);
                    }}
                  />
                ))}
              </ul>
            )}
          </div>
        </fieldset>

        <div className="flex justify-end">
          <button
            type="submit"
            data-testid={VERIFICACION_TESTIDS.RUN_SUBMIT}
            disabled={!canExecute || submitting}
            aria-busy={submitting}
            title={submitting ? t('common', 'processing') : disabledTitle}
            className="btn btn-primary"
          >
            {submitting ? <Spinner /> : null}
            {t('verificacion', 'submit')}
          </button>
        </div>
      </form>
    </section>
  );
};
