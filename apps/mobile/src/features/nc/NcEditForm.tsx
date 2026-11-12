import { NC_TESTIDS, formatTrace, type NcDetailDto, type UpdateNcInput } from '@sigpro/shared';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useI18n, useTexts } from '../../state/i18n';
import { SPACING } from '../../theme/tokens';
import { Button } from '../../ui/Button';
import { Text } from '../../ui/Text';
import { TextField } from '../../ui/TextField';
import { OwnerPicker } from '../programs/OwnerPicker';
import { buildChanges, editDraftOf, fieldErrorsOf, hasChanges, validateUpdate, withoutErrors, type NcEditDraft } from './form';
import { useNcOwners } from './hooks';
import { NcSeverityPicker } from './NcSeverityPicker';
import { NC_SCREEN_TEXTS, isNcMessageKey } from './texts';
import { MOVIL_NC_TESTIDS } from './testids';

interface Props {
  readonly detail: NcDetailDto;
  /** Envía los cambios; rechaza con el error de la API (un 422 se muestra bajo cada campo). */
  readonly onSave: (changes: UpdateNcInput) => Promise<void>;
  /** Guardado correcto: `closeAfter` indica «Guardar y cerrar». */
  readonly onDone: (closeAfter: boolean) => void;
  readonly onCancel: () => void;
}

/**
 * Edición de una NC dentro de la hoja de detalle (sustituye a la vista de lectura mientras dura): severidad, descripción y
 * asignación, lo mismo que edita la web. Solo viajan los campos que cambiaron; «Guardar» y «Guardar y cerrar» quedan
 * deshabilitados sin cambios, con su motivo visible. La hoja solo ofrece este formulario a quien tiene `nc.edit`.
 */
export const NcEditForm = ({ detail, onSave, onDone, onCancel }: Props) => {
  const { t } = useI18n();
  const texts = useTexts(NC_SCREEN_TEXTS);
  const owners = useNcOwners();
  const [draft, setDraft] = useState<NcEditDraft>(() => editDraftOf(detail));
  const [errors, setErrors] = useState<Readonly<Record<string, string>>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [saving, setSaving] = useState<'save' | 'close' | null>(null);
  const message = (key: string): string => (isNcMessageKey(key) ? t('nc', key) : t('common', 'genericError'));
  /** Texto del error de un campo, o `undefined` si el campo no tiene error. */
  const fieldText = (key: string | undefined): string | undefined => (key ? message(key) : undefined);

  const changes = buildChanges(detail, draft);
  const dirty = hasChanges(changes);
  const saveReason = saving !== null ? t('common', 'processing') : dirty ? undefined : t('nc', 'noChanges');

  const change = (patch: Partial<NcEditDraft>) => {
    setDraft((current) => ({ ...current, ...patch }));
    setErrors((current) => withoutErrors(current, Object.keys(patch)));
  };

  const submit = async (closeAfter: boolean) => {
    if (!dirty) return;
    const result = validateUpdate(changes);
    if (!result.success) {
      setErrors(result.errors);
      return;
    }
    setSaving(closeAfter ? 'close' : 'save');
    setServerError(null);
    setErrors({});
    try {
      await onSave(result.data);
      onDone(closeAfter);
    } catch (failure) {
      const fields = fieldErrorsOf(failure);
      if (fields) setErrors(fields);
      setServerError(fields ? message(Object.values(fields)[0] ?? 'nothingToUpdate') : formatTrace(failure) || t('common', 'genericError'));
    } finally {
      setSaving(null);
    }
  };

  const ownerList = owners.data ?? [];

  return (
    <View testID={MOVIL_NC_TESTIDS.EDIT_FORM} style={styles.form}>
      <Text variant="heading">{texts.editHeading}</Text>
      {serverError ? (
        <Text variant="small" tone="danger" role="alert" testID={NC_TESTIDS.NC_SERVER_ERROR}>
          {serverError}
        </Text>
      ) : null}

      <View style={styles.field}>
        <Text variant="label" tone="muted">
          {t('nc', 'severity')}
        </Text>
        <NcSeverityPicker
          label={t('nc', 'severityPickerLabel')}
          value={draft.severity}
          onChange={(severity) => change({ severity })}
          testID={NC_TESTIDS.NC_SEVERITY_PICKER}
          disabled={saving !== null}
          disabledReason={saving !== null ? t('common', 'processing') : undefined}
        />
      </View>

      <TextField
        label={t('nc', 'description')}
        placeholder={t('nc', 'descriptionPlaceholder')}
        testID={NC_TESTIDS.NC_DESCRIPTION}
        errorTestID={NC_TESTIDS.NC_DESCRIPTION_ERROR}
        value={draft.description}
        onChangeText={(description) => change({ description })}
        multiline
        error={fieldText(errors.description)}
      />
      <Text variant="small" tone="faint">
        {texts.descriptionHint}
      </Text>

      <View style={styles.field}>
        <OwnerPicker
          label={t('nc', 'assignee')}
          value={draft.assigneeId}
          owners={ownerList}
          onChange={(assigneeId) => change({ assigneeId })}
          testID={NC_TESTIDS.NC_ASSIGNEE}
          errorTestID={MOVIL_NC_TESTIDS.ASSIGNEE_ERROR}
          error={fieldText(errors.assigneeId)}
          placeholder={owners.data === null && owners.error === null ? t('common', 'loading') : t('nc', 'unassigned')}
          searchLabel={texts.assigneeSearch}
          searchPlaceholder={t('nc', 'assigneePlaceholder')}
          noMatch={t('nc', 'assigneeNoMatch')}
        />
        {draft.assigneeId === '' ? null : (
          <View style={styles.clear}>
            <Button label={t('nc', 'assigneeClear')} testID={NC_TESTIDS.NC_ASSIGNEE_CLEAR} variant="ghost" onPress={() => change({ assigneeId: '' })} disabled={saving !== null} />
          </View>
        )}
      </View>

      <View style={styles.actions}>
        <Button label={t('programas', 'cancel')} testID={MOVIL_NC_TESTIDS.EDIT_CANCEL} onPress={onCancel} disabled={saving !== null} />
        <Button
          label={t('nc', 'saveAndClose')}
          testID={NC_TESTIDS.NC_SAVE_CLOSE}
          onPress={() => void submit(true)}
          disabled={!dirty || saving !== null}
          disabledReason={saveReason}
          busy={saving === 'close'}
        />
        <Button
          label={t('nc', 'save')}
          testID={NC_TESTIDS.NC_SAVE}
          variant="primary"
          onPress={() => void submit(false)}
          disabled={!dirty || saving !== null}
          disabledReason={saveReason}
          busy={saving === 'save'}
        />
      </View>
      {dirty ? null : (
        <Text variant="small" tone="faint">
          {t('nc', 'noChanges')}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  form: { gap: SPACING.md },
  field: { gap: SPACING.xs },
  clear: { alignItems: 'flex-start' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: SPACING.sm },
});
