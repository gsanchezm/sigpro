import { HITOS_TESTIDS, MOVIL_PROGRAMS_TESTIDS, formatDate, formatTrace, type MessageKey, type MilestoneDto } from '@sigpro/shared';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useAuth } from '../../state/auth';
import { useI18n, useTexts } from '../../state/i18n';
import { SPACING } from '../../theme/tokens';
import { FormDialog } from '../../ui/FormDialog';
import { Text } from '../../ui/Text';
import { TextField } from '../../ui/TextField';
import { fieldErrorsOf, hasMilestoneChanges, milestoneChanges, validateMilestoneCreate, validateMilestoneUpdate, withoutErrors, type Errors } from './form';
import { PROGRAMS_TEXTS } from './texts';

// Alta y edición de un hito en una hoja (la web las hace en un diálogo y en línea, celda a celda). Validan con los esquemas
// de la API; un 422 se muestra bajo cada campo y cualquier otro fallo, arriba con su traza, y la hoja queda abierta.

const messageOf = (t: ReturnType<typeof useI18n>['t']) => (key: string | undefined): string | undefined => (key ? t('hitos', key as MessageKey<'hitos'>) : undefined);

interface CreateProps {
  readonly programCode: string;
  readonly onClose: () => void;
  /** Hito creado en la API: la hoja se cierra y el panel lo añade. */
  readonly onCreated: (milestone: MilestoneDto) => void;
}

/** Alta de un hito: nombre y fecha límite. */
export const MilestoneCreateDialog = ({ programCode, onClose, onCreated }: CreateProps) => {
  const { t } = useI18n();
  const texts = useTexts(PROGRAMS_TEXTS);
  const { api } = useAuth();
  const [name, setName] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const message = messageOf(t);

  const submit = async () => {
    const result = validateMilestoneCreate({ name, dueDate });
    if (!result.success) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    setServerError(null);
    setSubmitting(true);
    try {
      onCreated(await api.milestones.create(programCode, result.data));
    } catch (failure) {
      const fields = fieldErrorsOf(failure);
      if (fields) setErrors(fields);
      else setServerError(formatTrace(failure) || t('common', 'networkError'));
      setSubmitting(false);
    }
  };

  return (
    <FormDialog
      visible
      title={t('hitos', 'newTitle')}
      submitLabel={t('hitos', 'newSubmit')}
      cancelLabel={t('hitos', 'newCancel')}
      onSubmit={() => void submit()}
      onClose={onClose}
      busy={submitting}
      testID={HITOS_TESTIDS.MILESTONE_NEW_DIALOG}
      submitTestID={HITOS_TESTIDS.MILESTONE_NEW_SUBMIT}
      cancelTestID={HITOS_TESTIDS.MILESTONE_NEW_CANCEL}
    >
      <Text variant="mono" tone="muted">
        {programCode}
      </Text>
      {serverError ? (
        <Text variant="small" tone="danger" role="alert" testID={HITOS_TESTIDS.MILESTONE_NEW_SERVER_ERROR}>
          {serverError}
        </Text>
      ) : null}
      <TextField
        label={t('hitos', 'newName')}
        placeholder={t('hitos', 'newNamePlaceholder')}
        testID={HITOS_TESTIDS.MILESTONE_NEW_NAME}
        value={name}
        onChangeText={(value) => {
          setName(value);
          setErrors((current) => withoutErrors(current, ['name']));
        }}
        error={message(errors.name)}
        errorTestID={HITOS_TESTIDS.MILESTONE_NEW_NAME_ERROR}
      />
      <TextField
        label={t('hitos', 'newDate')}
        placeholder={texts.dateFormat}
        testID={HITOS_TESTIDS.MILESTONE_NEW_DATE}
        value={dueDate}
        onChangeText={(value) => {
          setDueDate(value);
          setErrors((current) => withoutErrors(current, ['dueDate']));
        }}
        autoCapitalize="none"
        autoCorrect={false}
        error={message(errors.dueDate)}
        errorTestID={HITOS_TESTIDS.MILESTONE_NEW_DATE_ERROR}
      />
    </FormDialog>
  );
};

interface EditProps {
  readonly milestone: MilestoneDto;
  readonly onClose: () => void;
  /** Hito guardado y frase del aviso con lo que cambió (`nombre actualizado · fecha límite …`). */
  readonly onSaved: (milestone: MilestoneDto, detail: string) => void;
}

/** Edición del nombre y la fecha límite de un hito. Solo viaja lo que cambió; sin cambios, «Guardar» queda deshabilitado. */
export const MilestoneEditDialog = ({ milestone, onClose, onSaved }: EditProps) => {
  const { t, lang } = useI18n();
  const texts = useTexts(PROGRAMS_TEXTS);
  const { api } = useAuth();
  const [name, setName] = useState(milestone.name);
  const [dueDate, setDueDate] = useState(milestone.dueDate);
  const [errors, setErrors] = useState<Errors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const message = messageOf(t);

  const changes = milestoneChanges(milestone, { name, dueDate });
  const dirty = hasMilestoneChanges(changes);

  const save = async () => {
    if (!dirty) return;
    const result = validateMilestoneUpdate(changes);
    if (!result.success) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    setServerError(null);
    setSaving(true);
    try {
      const saved = await api.milestones.update(milestone.id, result.data);
      const parts = [
        result.data.name !== undefined ? t('hitos', 'detailName') : null,
        result.data.dueDate !== undefined ? t('hitos', 'detailDate', { value: formatDate(result.data.dueDate, lang) }) : null,
      ].filter((part): part is string => part !== null);
      onSaved(saved, parts.join(' · '));
    } catch (failure) {
      const fields = fieldErrorsOf(failure);
      if (fields) setErrors(fields);
      else setServerError(formatTrace(failure) || t('common', 'networkError'));
      setSaving(false);
    }
  };

  return (
    <FormDialog
      visible
      title={texts.milestoneEditTitle}
      submitLabel={texts.milestoneSave}
      cancelLabel={t('hitos', 'newCancel')}
      onSubmit={() => void save()}
      onClose={onClose}
      busy={saving}
      submitDisabled={!dirty}
      submitDisabledReason={dirty ? undefined : t('programas', 'noChanges')}
      testID={MOVIL_PROGRAMS_TESTIDS.MILESTONE_EDIT_DIALOG}
      submitTestID={MOVIL_PROGRAMS_TESTIDS.MILESTONE_EDIT_SUBMIT}
      cancelTestID={MOVIL_PROGRAMS_TESTIDS.MILESTONE_EDIT_CANCEL}
    >
      {serverError ? (
        <Text variant="small" tone="danger" role="alert" testID={MOVIL_PROGRAMS_TESTIDS.MILESTONE_EDIT_SERVER_ERROR}>
          {serverError}
        </Text>
      ) : null}
      <View style={styles.fields}>
        <TextField
          label={t('hitos', 'nameLabel')}
          testID={MOVIL_PROGRAMS_TESTIDS.MILESTONE_EDIT_NAME}
          value={name}
          onChangeText={(value) => {
            setName(value);
            setErrors((current) => withoutErrors(current, ['name']));
          }}
          error={message(errors.name)}
          errorTestID={MOVIL_PROGRAMS_TESTIDS.MILESTONE_EDIT_NAME_ERROR}
        />
        <TextField
          label={t('hitos', 'dateLabel')}
          placeholder={texts.dateFormat}
          testID={MOVIL_PROGRAMS_TESTIDS.MILESTONE_EDIT_DATE}
          value={dueDate}
          onChangeText={(value) => {
            setDueDate(value);
            setErrors((current) => withoutErrors(current, ['dueDate']));
          }}
          autoCapitalize="none"
          autoCorrect={false}
          error={message(errors.dueDate)}
          errorTestID={MOVIL_PROGRAMS_TESTIDS.MILESTONE_EDIT_DATE_ERROR}
        />
      </View>
    </FormDialog>
  );
};

const styles = StyleSheet.create({
  fields: { gap: SPACING.md },
});
