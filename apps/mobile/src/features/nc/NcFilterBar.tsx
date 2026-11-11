import { NC_TESTIDS } from '@sigpro/shared';
import { StyleSheet, View } from 'react-native';
import { useI18n, useTexts } from '../../state/i18n';
import { SPACING } from '../../theme/tokens';
import { Chip } from '../../ui/Chip';
import { TextField } from '../../ui/TextField';
import { SEVERITY_FILTERS, type SeverityFilter } from './filters';
import { NC_SCREEN_TEXTS, SEVERITY_LABEL_KEY } from './texts';
import { MOVIL_NC_DYNAMIC_TESTIDS } from './testids';

interface Props {
  readonly search: string;
  readonly onSearch: (text: string) => void;
  readonly severity: SeverityFilter;
  readonly onSeverity: (value: SeverityFilter) => void;
}

/** Buscador (etiqueta visible + placeholder distinto) y chips de severidad de selección única. */
export const NcFilterBar = ({ search, onSearch, severity, onSeverity }: Props) => {
  const { t } = useI18n();
  const texts = useTexts(NC_SCREEN_TEXTS);
  const labelOf = (value: SeverityFilter): string => (value === 'all' ? texts.allSeverities : t('nc', SEVERITY_LABEL_KEY[value]));

  return (
    <View style={styles.bar}>
      <TextField
        label={t('nc', 'searchLabel')}
        placeholder={t('nc', 'searchPlaceholder')}
        testID={NC_TESTIDS.NC_SEARCH}
        value={search}
        onChangeText={onSearch}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
      />
      <View role="radiogroup" aria-label={t('nc', 'filterSeverity')} testID={NC_TESTIDS.NC_FILTER_SEVERITY} style={styles.chips}>
        {SEVERITY_FILTERS.map((value) => (
          <Chip
            key={value}
            label={labelOf(value)}
            selected={severity === value}
            testID={MOVIL_NC_DYNAMIC_TESTIDS.SEVERITY_FILTER(value)}
            onPress={() => onSeverity(value)}
          />
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  bar: { gap: SPACING.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
});
