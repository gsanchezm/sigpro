import { PRIORITIES, type MessageKey, type OwnerDto, type Priority, type ProgramStatus } from '@sigpro/shared';
import { StyleSheet, View } from 'react-native';
import { useI18n, useTexts } from '../../state/i18n';
import { SPACING } from '../../theme/tokens';
import { Segmented } from '../../ui/Segmented';
import { SelectField } from '../../ui/SelectField';
import { SwitchField } from '../../ui/SwitchField';
import { TextField } from '../../ui/TextField';
import { OwnerPicker } from './OwnerPicker';
import type { Errors, ProgramDraft } from './form';
import { PROGRAMS_TEXTS } from './texts';

/** `data-testid` de cada campo: el alta usa los `programs-wizard-*` de la web y la edición los `program-edit-*`. */
export interface ProgramFieldIds {
  readonly name: string;
  readonly nameError: string;
  readonly description: string;
  readonly owner: string;
  readonly ownerError: string;
  readonly status: string;
  readonly start: string;
  readonly startError: string;
  readonly end: string;
  readonly endError: string;
  readonly budget: string;
  readonly budgetError: string;
  readonly priority: Readonly<Record<Priority, string>>;
  readonly classified: string;
}

interface FieldsProps {
  readonly draft: ProgramDraft;
  readonly onChange: (patch: Partial<ProgramDraft>) => void;
  /** Errores por campo: claves i18n del espacio `programas` (las de Zod y la API). */
  readonly errors: Errors;
  readonly ids: ProgramFieldIds;
}

/** Traduce la clave de un error de campo del espacio `programas`; sin error, `undefined` (no se pinta nada). */
const useErrorText = () => {
  const { t } = useI18n();
  return (key: string | undefined): string | undefined => (key ? t('programas', key as MessageKey<'programas'>) : undefined);
};

interface BasicProps extends FieldsProps {
  readonly owners: readonly OwnerDto[];
  /** Estados que se ofrecen: el alta solo «Borrador» y «Activo» (como la web); la edición, los cinco. */
  readonly statuses: readonly ProgramStatus[];
  readonly statusLabel: string;
  /** Código del programa: solo lectura, como en la web. Va primero. */
  readonly code: { readonly value: string; readonly testID: string };
}

/** Código (solo lectura), nombre, descripción, responsable y estado. */
export const BasicFields = ({ draft, onChange, errors, ids, owners, statuses, statusLabel, code }: BasicProps) => {
  const { t } = useI18n();
  const texts = useTexts(PROGRAMS_TEXTS);
  const errorText = useErrorText();
  const statusOptions = statuses.map((status) => ({ value: status, label: t('programas', `st_${status}` as MessageKey<'programas'>) }));

  return (
    <View style={styles.fields}>
      <TextField label={t('programas', 'code')} testID={code.testID} value={code.value} editable={false} />
      <TextField
        label={t('programas', 'name')}
        placeholder={t('programas', 'namePlaceholder')}
        testID={ids.name}
        value={draft.name}
        onChangeText={(name) => onChange({ name })}
        error={errorText(errors.name)}
        errorTestID={ids.nameError}
        returnKeyType="next"
      />
      <TextField label={t('programas', 'description')} testID={ids.description} value={draft.description} onChangeText={(description) => onChange({ description })} multiline />
      <OwnerPicker
        label={t('programas', 'owner')}
        value={draft.ownerId}
        owners={owners}
        onChange={(ownerId) => onChange({ ownerId })}
        testID={ids.owner}
        errorTestID={ids.ownerError}
        error={errorText(errors.ownerId)}
        placeholder={owners.length === 0 ? texts.ownersLoading : texts.ownerEmpty}
        searchLabel={texts.ownerSearch}
        searchPlaceholder={t('programas', 'searchPerson')}
        noMatch={t('programas', 'noOwnerMatch')}
      />
      <SelectField<ProgramStatus>
        label={statusLabel}
        value={draft.status}
        options={statusOptions}
        onChange={(status) => onChange({ status })}
        testID={ids.status}
      />
    </View>
  );
};

/** Fechas (texto `AAAA-MM-DD`), presupuesto, prioridad y clasificación. */
export const PlanFields = ({ draft, onChange, errors, ids }: FieldsProps) => {
  const { t } = useI18n();
  const texts = useTexts(PROGRAMS_TEXTS);
  const errorText = useErrorText();

  return (
    <View style={styles.fields}>
      <TextField
        label={t('programas', 'startDate')}
        placeholder={texts.dateFormat}
        testID={ids.start}
        value={draft.startDate}
        onChangeText={(startDate) => onChange({ startDate })}
        autoCapitalize="none"
        autoCorrect={false}
        error={errorText(errors.startDate)}
        errorTestID={ids.startError}
      />
      <TextField
        label={t('programas', 'endDate')}
        placeholder={texts.dateFormat}
        testID={ids.end}
        value={draft.endDate}
        onChangeText={(endDate) => onChange({ endDate })}
        autoCapitalize="none"
        autoCorrect={false}
        error={errorText(errors.endDate)}
        errorTestID={ids.endError}
      />
      <TextField
        label={`${t('programas', 'budget')} (€)`}
        placeholder="0"
        testID={ids.budget}
        value={draft.budget}
        onChangeText={(budget) => onChange({ budget })}
        keyboardType="numeric"
        error={errorText(errors.budget)}
        errorTestID={ids.budgetError}
      />
      <Segmented<Priority>
        label={t('programas', 'priority')}
        value={draft.priority}
        onChange={(priority) => onChange({ priority })}
        options={PRIORITIES.map((value) => ({ value, label: t('programas', value), testID: ids.priority[value] }))}
      />
      <SwitchField label={t('programas', 'classified')} value={draft.classified} onChange={(classified) => onChange({ classified })} testID={ids.classified} />
    </View>
  );
};

const styles = StyleSheet.create({
  fields: { gap: SPACING.md },
});
