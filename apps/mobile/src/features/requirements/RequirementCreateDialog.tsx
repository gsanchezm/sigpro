import { REQUISITOS_TESTIDS, formatTrace, type CreateRequirementInput, type MessageKey, type RequirementDto } from '@sigpro/shared';
import { useState } from 'react';
import { useI18n } from '../../state/i18n';
import { FormDialog } from '../../ui/FormDialog';
import { SelectField } from '../../ui/SelectField';
import { Text } from '../../ui/Text';
import { RequirementFields } from './RequirementFields';
import { EMPTY_DRAFT, createInputOf, fieldErrorsOf, validateCreate, withoutErrors, type RequirementDraft } from './form';

interface Props {
  readonly programCode: string;
  /** Requisitos del programa: candidatos a padre. */
  readonly items: readonly RequirementDto[];
  /** Padre preseleccionado («Añadir hijo»); `null` = raíz. */
  readonly parentCode: string | null;
  readonly onClose: () => void;
  /** Da de alta el requisito; rechaza con el error de la API para que el diálogo lo muestre. */
  readonly onSubmit: (input: CreateRequirementInput) => Promise<void>;
}

/**
 * Alta de un requisito en borrador (la alternativa móvil al diálogo «Nuevo requisito»). Valida con el esquema compartido
 * antes de llamar a la API; un 422 se muestra bajo el campo y cualquier otro fallo, arriba con su traza.
 */
export const RequirementCreateDialog = ({ programCode, items, parentCode, onClose, onSubmit }: Props) => {
  const { t } = useI18n();
  const [draft, setDraft] = useState<RequirementDraft>(EMPTY_DRAFT);
  const [parent, setParent] = useState<string>(parentCode ?? '');
  const [errors, setErrors] = useState<Readonly<Record<string, string>>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const message = (key: string) => t('requisitos', key as MessageKey<'requisitos'>);

  const change = (patch: Partial<RequirementDraft>) => {
    setDraft((current) => ({ ...current, ...patch }));
    setErrors((current) => withoutErrors(current, Object.keys(patch)));
  };

  const submit = async () => {
    const result = validateCreate(createInputOf(programCode, parent === '' ? null : parent, draft));
    if (!result.success) {
      setErrors(result.errors);
      return;
    }
    setSubmitting(true);
    setServerError(null);
    try {
      await onSubmit(result.data);
    } catch (failure) {
      const fields = fieldErrorsOf(failure);
      if (fields) setErrors(fields);
      setServerError(fields ? message(Object.values(fields)[0] ?? 'required') : formatTrace(failure) || t('common', 'genericError'));
    } finally {
      setSubmitting(false);
    }
  };

  const parentOptions = [{ value: '', label: t('requisitos', 'noParent') }, ...items.map((item) => ({ value: item.code, label: `${item.code} · ${item.title}` }))];

  return (
    <FormDialog
      visible
      title={t('requisitos', 'newDialog')}
      submitLabel={t('requisitos', 'create')}
      cancelLabel={t('requisitos', 'cancel')}
      onSubmit={() => void submit()}
      onClose={onClose}
      busy={submitting}
      testID={REQUISITOS_TESTIDS.REQUIREMENT_NEW_DIALOG}
      submitTestID={REQUISITOS_TESTIDS.REQUIREMENT_NEW_SUBMIT}
      cancelTestID={REQUISITOS_TESTIDS.REQUIREMENT_NEW_CANCEL}
    >
      <Text variant="mono" tone="muted">
        {programCode}
      </Text>
      {serverError ? (
        <Text variant="small" tone="danger" role="alert" testID={REQUISITOS_TESTIDS.REQUIREMENT_NEW_SERVER_ERROR}>
          {serverError}
        </Text>
      ) : null}
      <RequirementFields
        draft={draft}
        onChange={change}
        errors={errors}
        ids={{
          title: REQUISITOS_TESTIDS.REQUIREMENT_NEW_TITLE,
          titleError: REQUISITOS_TESTIDS.REQUIREMENT_NEW_TITLE_ERROR,
          priority: REQUISITOS_TESTIDS.REQUIREMENT_NEW_PRIORITY,
          tags: REQUISITOS_TESTIDS.REQUIREMENT_TAGS,
          description: REQUISITOS_TESTIDS.REQUIREMENT_DESCRIPTION,
        }}
      />
      <SelectField<string>
        label={t('requisitos', 'newParent')}
        value={parent}
        options={parentOptions}
        onChange={(value) => {
          setParent(value);
          setErrors((current) => withoutErrors(current, ['parentCode']));
        }}
        testID={REQUISITOS_TESTIDS.REQUIREMENT_NEW_PARENT}
        error={errors.parentCode ? message(errors.parentCode) : undefined}
      />
    </FormDialog>
  );
};
