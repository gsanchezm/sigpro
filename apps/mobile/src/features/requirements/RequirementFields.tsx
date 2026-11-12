import { PRIORITIES, REQUIREMENT_TAGS, REQUISITOS_DYNAMIC_TESTIDS, type MessageKey, type Priority, type RequirementTag } from '@sigpro/shared';
import { StyleSheet, View } from 'react-native';
import { useI18n, useTexts } from '../../state/i18n';
import { SPACING } from '../../theme/tokens';
import { SelectField } from '../../ui/SelectField';
import { Text } from '../../ui/Text';
import { TextField } from '../../ui/TextField';
import { ToggleButton } from '../../ui/ToggleButton';
import type { RequirementDraft } from './form';
import { REQUIREMENTS_TEXTS } from './texts';

/** `data-testid` de cada campo: el alta y la edición usan los de la web (`requirement-new-*` o `requirement-*`). */
export interface FieldIds {
  readonly title: string;
  readonly titleError: string;
  readonly priority: string;
  readonly tags: string;
  readonly description: string;
}

interface Props {
  readonly draft: RequirementDraft;
  /** Cambia uno o más campos; el formulario quita el error de esos campos. */
  readonly onChange: (patch: Partial<RequirementDraft>) => void;
  /** Errores por campo: claves i18n de `requisitos` (las que devuelve Zod y la API). */
  readonly errors: Readonly<Record<string, string>>;
  readonly ids: FieldIds;
}

/**
 * Campos comunes del alta y de la edición: título, prioridad, etiquetas (alternancia) y descripción en texto plano.
 * Las etiquetas son «chips» de alternancia (`aria-pressed`) y la prioridad, un selector en hoja.
 */
export const RequirementFields = ({ draft, onChange, errors, ids }: Props) => {
  const { t } = useI18n();
  const texts = useTexts(REQUIREMENTS_TEXTS);
  const message = (key: string | undefined) => (key ? t('requisitos', key as MessageKey<'requisitos'>) : undefined);
  const priorityOptions = PRIORITIES.map((value) => ({ value, label: t('programas', value) }));
  const toggleTag = (tag: RequirementTag) => {
    const next = draft.tags.includes(tag) ? draft.tags.filter((item) => item !== tag) : [...draft.tags, tag];
    onChange({ tags: next });
  };

  return (
    <View style={styles.fields}>
      <TextField
        label={t('requisitos', 'titleLabel')}
        placeholder={t('requisitos', 'titlePlaceholder')}
        testID={ids.title}
        value={draft.title}
        onChangeText={(title) => onChange({ title })}
        error={message(errors.title)}
        errorTestID={ids.titleError}
        returnKeyType="next"
      />
      <SelectField<Priority>
        label={t('requisitos', 'priorityLabel')}
        value={draft.priority}
        options={priorityOptions}
        onChange={(priority) => onChange({ priority })}
        testID={ids.priority}
        error={message(errors.priority)}
      />
      <View style={styles.tags}>
        <Text variant="label" tone="muted">
          {t('requisitos', 'tagsLabel')}
        </Text>
        <View role="group" aria-label={t('requisitos', 'tagsLabel')} testID={ids.tags} style={styles.tagList}>
          {REQUIREMENT_TAGS.map((tag) => (
            <ToggleButton
              key={tag}
              label={t('requisitos', `tag_${tag}`)}
              pressed={draft.tags.includes(tag)}
              onPress={() => toggleTag(tag)}
              testID={REQUISITOS_DYNAMIC_TESTIDS.REQUIREMENT_TAG_OPTION(tag)}
            />
          ))}
        </View>
      </View>
      <TextField
        label={t('requisitos', 'descriptionLabel')}
        placeholder={t('requisitos', 'descriptionPlaceholder')}
        testID={ids.description}
        value={draft.description}
        onChangeText={(description) => onChange({ description })}
        multiline
        error={message(errors.description)}
      />
      <Text variant="small" tone="faint">
        {texts.descriptionHint}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  fields: { gap: SPACING.md },
  tags: { gap: SPACING.xs },
  tagList: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
});
