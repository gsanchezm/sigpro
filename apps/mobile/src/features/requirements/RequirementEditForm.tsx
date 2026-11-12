import { REQUISITOS_TESTIDS, formatTrace, type MessageKey, type RequirementDto, type UpdateRequirementInput } from '@sigpro/shared';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useI18n, useTexts } from '../../state/i18n';
import { SPACING } from '../../theme/tokens';
import { Button } from '../../ui/Button';
import { Text } from '../../ui/Text';
import { RequirementFields } from './RequirementFields';
import { buildChanges, draftOf, fieldErrorsOf, hasChanges, textChanged, validateUpdate, withoutErrors, type RequirementDraft } from './form';
import { REQUIREMENTS_TEXTS } from './texts';
import { MOVIL_REQUIREMENTS_DYNAMIC_TESTIDS, MOVIL_REQUIREMENTS_TESTIDS } from './testids';

interface Props {
  readonly item: RequirementDto;
  /** Envía los cambios; rechaza con el error de la API (un 422 se muestra bajo cada campo). */
  readonly onSave: (changes: UpdateRequirementInput) => Promise<void>;
  /** Guardado correcto: `closeAfter` indica «Guardar y cerrar». */
  readonly onDone: (closeAfter: boolean) => void;
  readonly onCancel: () => void;
}

/**
 * Edición de un requisito dentro de la hoja (sustituye a la vista de lectura mientras dura). Solo viajan los campos que
 * cambiaron; si cambia el texto y el requisito no está en borrador, un aviso anuncia que volverá a borrador (como la web).
 */
export const RequirementEditForm = ({ item, onSave, onDone, onCancel }: Props) => {
  const { t } = useI18n();
  const texts = useTexts(REQUIREMENTS_TEXTS);
  const [draft, setDraft] = useState<RequirementDraft>(() => draftOf(item));
  const [errors, setErrors] = useState<Readonly<Record<string, string>>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [saving, setSaving] = useState<'save' | 'close' | null>(null);
  const message = (key: string) => t('requisitos', key as MessageKey<'requisitos'>);

  const changes = buildChanges(item, draft);
  const dirty = hasChanges(changes);
  const willRevert = textChanged(item, draft) && item.state !== 'draft';
  const stateLabel = t('requisitos', `st_${item.state}`);
  const saveReason = saving !== null ? t('common', 'processing') : undefined;

  const change = (patch: Partial<RequirementDraft>) => {
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
    try {
      await onSave(result.data);
      setErrors({});
      onDone(closeAfter);
    } catch (failure) {
      const fields = fieldErrorsOf(failure);
      if (fields) setErrors(fields);
      setServerError(fields ? message(Object.values(fields)[0] ?? 'required') : formatTrace(failure) || t('common', 'genericError'));
    } finally {
      setSaving(null);
    }
  };

  return (
    <View testID={MOVIL_REQUIREMENTS_TESTIDS.EDIT_FORM} style={styles.form}>
      <Text variant="heading">{texts.editHeading}</Text>
      {serverError ? (
        <Text variant="small" tone="danger" role="alert" testID={REQUISITOS_TESTIDS.REQUIREMENT_SERVER_ERROR}>
          {serverError}
        </Text>
      ) : null}
      <RequirementFields
        draft={draft}
        onChange={change}
        errors={errors}
        ids={{
          title: REQUISITOS_TESTIDS.REQUIREMENT_TITLE,
          titleError: REQUISITOS_TESTIDS.REQUIREMENT_TITLE_ERROR,
          priority: REQUISITOS_TESTIDS.REQUIREMENT_PRIORITY,
          tags: REQUISITOS_TESTIDS.REQUIREMENT_TAGS,
          description: REQUISITOS_TESTIDS.REQUIREMENT_DESCRIPTION,
        }}
      />
      {willRevert ? (
        <Text variant="small" tone="muted" testID={REQUISITOS_TESTIDS.REQUIREMENT_REVERT_NOTICE}>
          {t('requisitos', 'revertNotice', { state: stateLabel.toLowerCase() })}
        </Text>
      ) : null}
      <View style={styles.actions}>
        <Button label={t('programas', 'cancel')} testID={MOVIL_REQUIREMENTS_TESTIDS.EDIT_CANCEL} onPress={onCancel} disabled={saving !== null} />
        <Button
          label={t('requisitos', 'saveClose')}
          testID={REQUISITOS_TESTIDS.REQUIREMENT_SAVE_CLOSE}
          variant="secondary"
          onPress={() => void submit(true)}
          disabled={!dirty || saving !== null}
          disabledReason={saveReason ?? (dirty ? undefined : t('programas', 'noChanges'))}
          busy={saving === 'close'}
        />
        <Button
          label={t('requisitos', 'save')}
          testID={REQUISITOS_TESTIDS.REQUIREMENT_SAVE}
          variant="primary"
          onPress={() => void submit(false)}
          disabled={!dirty || saving !== null}
          disabledReason={saveReason ?? (dirty ? undefined : t('programas', 'noChanges'))}
          busy={saving === 'save'}
        />
      </View>
      {dirty ? null : (
        <Text variant="small" tone="faint" testID={MOVIL_REQUIREMENTS_DYNAMIC_TESTIDS.ACTION_REASON('save')}>
          {t('programas', 'noChanges')}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  form: { gap: SPACING.md },
  actions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: SPACING.sm },
});
