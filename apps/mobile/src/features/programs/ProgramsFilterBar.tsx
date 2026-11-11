import { MOVIL_DYNAMIC_TESTIDS, MOVIL_TESTIDS, PROGRAMAS_TESTIDS } from '@sigpro/shared';
import { StyleSheet, View } from 'react-native';
import { useI18n, useTexts } from '../../state/i18n';
import { Button } from '../../ui/Button';
import { Chip } from '../../ui/Chip';
import { TextField } from '../../ui/TextField';
import { STATUS_CHOICES, type StatusChoice } from './params';
import { PROGRAMS_TEXTS } from './texts';

interface Props {
  /** Texto del buscador (el borrador: lo que el usuario ve, aunque la URL vaya un poco por detrás). */
  readonly query: string;
  readonly onQueryChange: (value: string) => void;
  /** Opción seleccionada del selector de estado. */
  readonly choice: StatusChoice;
  readonly onChoice: (choice: StatusChoice) => void;
  /** Hay filtros aplicados: muestra «Limpiar filtros». */
  readonly filtered: boolean;
  readonly onClear: () => void;
}

/** Buscador (placeholder distinto de la etiqueta) y chips de estado de selección única dentro de un `radiogroup` con nombre. */
export const ProgramsFilterBar = ({ query, onQueryChange, choice, onChoice, filtered, onClear }: Props) => {
  const { t } = useI18n();
  const texts = useTexts(PROGRAMS_TEXTS);

  const labelOf = (option: StatusChoice): string => (option === 'all' ? texts.allStatuses : t('programas', `st_${option}`));

  return (
    <View testID={PROGRAMAS_TESTIDS.PROGRAMS_FILTERS} role="region" aria-label={t('programas', 'filters')} style={styles.wrap}>
      <TextField
        label={t('programas', 'searchPrograms')}
        placeholder={t('programas', 'searchPlaceholder')}
        testID={PROGRAMAS_TESTIDS.PROGRAMS_SEARCH}
        value={query}
        onChangeText={onQueryChange}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
      />
      <View role="radiogroup" aria-label={t('programas', 'status')} testID={MOVIL_TESTIDS.PROGRAMS_FILTER_STATUS_GROUP} style={styles.chips}>
        {STATUS_CHOICES.map((option) => (
          <Chip
            key={option}
            label={labelOf(option)}
            selected={option === choice}
            onPress={() => onChoice(option)}
            testID={MOVIL_DYNAMIC_TESTIDS.PROGRAMS_FILTER_STATUS(option)}
          />
        ))}
      </View>
      {filtered ? <Button label={t('programas', 'clearFilters')} testID={PROGRAMAS_TESTIDS.PROGRAMS_FILTERS_CLEAR} variant="ghost" onPress={onClear} /> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
