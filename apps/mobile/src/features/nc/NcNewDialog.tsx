import { NC_TESTIDS, formatTrace, type CreateNcInput } from '@sigpro/shared';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useI18n, useTexts } from '../../state/i18n';
import { SPACING } from '../../theme/tokens';
import { Button } from '../../ui/Button';
import { FormDialog } from '../../ui/FormDialog';
import { SelectField } from '../../ui/SelectField';
import { Text } from '../../ui/Text';
import { TextField } from '../../ui/TextField';
import { EMPTY_NEW_DRAFT, createInputOf, fieldErrorsOf, validateCreate, withoutErrors, type NewNcDraft } from './form';
import { useNcPrograms } from './hooks';
import { NcSeverityPicker } from './NcSeverityPicker';
import { NC_SCREEN_TEXTS, isNcMessageKey } from './texts';
import { MOVIL_NC_TESTIDS } from './testids';

interface Props {
  readonly onClose: () => void;
  /** Da de alta la NC; rechaza con el error de la API para que el diálogo lo muestre. */
  readonly onSubmit: (input: CreateNcInput) => Promise<void>;
}

/**
 * Alta de una no conformidad (la alternativa móvil al diálogo «Nueva no conformidad»): programa, severidad y descripción,
 * los mismos campos de la web. Valida con el esquema compartido antes de llamar a la API; un 422 se muestra bajo el campo
 * y cualquier otro fallo, arriba con su traza.
 */
export const NcNewDialog = ({ onClose, onSubmit }: Props) => {
  const { t } = useI18n();
  const texts = useTexts(NC_SCREEN_TEXTS);
  const programs = useNcPrograms();
  const [draft, setDraft] = useState<NewNcDraft>(EMPTY_NEW_DRAFT);
  const [errors, setErrors] = useState<Readonly<Record<string, string>>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // Clave de error de Zod o de la API → texto del espacio `nc` (lo que no existe cae en el error genérico)
  const message = (key: string): string => (isNcMessageKey(key) ? t('nc', key) : t('common', 'genericError'));
  /** Texto del error de un campo, o `undefined` si el campo no tiene error. */
  const fieldText = (key: string | undefined): string | undefined => (key ? message(key) : undefined);

  const change = (patch: Partial<NewNcDraft>) => {
    setDraft((current) => ({ ...current, ...patch }));
    setErrors((current) => withoutErrors(current, Object.keys(patch)));
  };

  const submit = async () => {
    const result = validateCreate(createInputOf(draft));
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
      setServerError(fields ? message(Object.values(fields)[0] ?? 'programRequired') : formatTrace(failure) || t('common', 'genericError'));
    } finally {
      setSubmitting(false);
    }
  };

  const programOptions = [{ value: '', label: t('nc', 'newProgramPlaceholder') }, ...(programs.data ?? []).map((program) => ({ value: program.code, label: `${program.code} · ${program.name}` }))];
  const waitingPrograms = programs.data === null && programs.error === null;

  return (
    <FormDialog
      visible
      title={t('nc', 'newTitle')}
      submitLabel={t('nc', 'newSubmit')}
      cancelLabel={t('nc', 'newCancel')}
      onSubmit={() => void submit()}
      onClose={onClose}
      busy={submitting}
      submitDisabled={waitingPrograms}
      submitDisabledReason={waitingPrograms ? texts.programsLoading : undefined}
      testID={NC_TESTIDS.NC_NEW_DIALOG}
      submitTestID={NC_TESTIDS.NC_NEW_SUBMIT}
      cancelTestID={NC_TESTIDS.NC_NEW_CANCEL}
    >
      {serverError ? (
        <Text variant="small" tone="danger" role="alert" testID={NC_TESTIDS.NC_NEW_SERVER_ERROR}>
          {serverError}
        </Text>
      ) : null}

      <SelectField<string>
        label={t('nc', 'newProgram')}
        value={draft.programCode}
        options={programOptions}
        onChange={(programCode) => change({ programCode })}
        testID={NC_TESTIDS.NC_NEW_PROGRAM}
        disabled={waitingPrograms}
        disabledReason={waitingPrograms ? texts.programsLoading : undefined}
        error={fieldText(errors.programCode)}
        errorTestID={NC_TESTIDS.NC_NEW_PROGRAM_ERROR}
      />
      {programs.error !== null ? (
        <View testID={MOVIL_NC_TESTIDS.NEW_PROGRAMS_STATUS} role="alert" style={styles.status}>
          <Text variant="small" tone="danger">
            {`${texts.programsError} · ${programs.error}`}
          </Text>
          <Button label={t('nc', 'retry')} testID={MOVIL_NC_TESTIDS.NEW_PROGRAMS_RETRY} onPress={programs.reload} />
        </View>
      ) : null}

      <View style={styles.field}>
        <Text variant="label" tone="muted">
          {t('nc', 'newSeverity')}
        </Text>
        <NcSeverityPicker label={t('nc', 'severityPickerLabel')} value={draft.severity} onChange={(severity) => change({ severity })} testID={NC_TESTIDS.NC_NEW_SEVERITY} />
        {errors.severity ? (
          <Text variant="small" tone="danger" role="alert" testID={NC_TESTIDS.NC_NEW_SEVERITY_ERROR}>
            {message(errors.severity)}
          </Text>
        ) : null}
      </View>

      <TextField
        label={t('nc', 'newDescription')}
        placeholder={t('nc', 'descriptionPlaceholder')}
        testID={NC_TESTIDS.NC_NEW_DESCRIPTION}
        errorTestID={NC_TESTIDS.NC_NEW_DESCRIPTION_ERROR}
        value={draft.description}
        onChangeText={(description) => change({ description })}
        multiline
        error={fieldText(errors.description)}
      />
      <Text variant="small" tone="faint">
        {texts.descriptionHint}
      </Text>
    </FormDialog>
  );
};

const styles = StyleSheet.create({
  field: { gap: SPACING.xs },
  status: { gap: SPACING.sm, alignItems: 'flex-start' },
});
