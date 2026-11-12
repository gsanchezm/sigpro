import type { ProgramDto, TestCaseSortColumn } from '@sigpro/shared';
import { StyleSheet, View } from 'react-native';
import { useI18n, useTexts } from '../../state/i18n';
import { Button } from '../../ui/Button';
import { Chip } from '../../ui/Chip';
import { SelectField, type SelectOption } from '../../ui/SelectField';
import { TextField } from '../../ui/TextField';
import { ALL, RESULT_CHOICES, SORT_COLUMNS, fromChoice, resultFromChoice, toChoice, type ResultFilter, type VerificationFilters } from './params';
import { VERIFICATION_TEXTS } from './texts';
import { VERIFICACION_DYNAMIC_TESTIDS, VERIFICACION_TESTIDS, MOVIL_VERIFICATION_TESTIDS } from './testids';

interface Props {
  readonly filters: VerificationFilters;
  /** Texto del buscador (el borrador: lo que el usuario ve, aunque la URL vaya un poco por detrás). */
  readonly query: string;
  readonly onQueryChange: (value: string) => void;
  readonly programs: readonly ProgramDto[];
  readonly onProgram: (program: string) => void;
  readonly onResult: (result: ResultFilter) => void;
  readonly onSort: (column: TestCaseSortColumn) => void;
  /** Hay búsqueda, programa o resultado aplicados: muestra «Limpiar filtros». */
  readonly filtered: boolean;
  readonly onClear: () => void;
}

/**
 * Filtros de la lista, los de la web: buscador (placeholder distinto de la etiqueta), programa y último resultado en
 * selectores, y el orden en chips de selección única (pulsar el activo invierte el sentido, como la cabecera de la tabla).
 */
export const VerificationFilterBar = ({ filters, query, onQueryChange, programs, onProgram, onResult, onSort, filtered, onClear }: Props) => {
  const { t } = useI18n();
  const texts = useTexts(VERIFICATION_TEXTS);

  const programOptions: readonly SelectOption<string>[] = [{ value: ALL, label: t('verificacion', 'allPrograms') }, ...programs.map((program) => ({ value: program.code, label: program.code }))];
  const resultOptions: readonly SelectOption<string>[] = RESULT_CHOICES.map((choice) => ({
    value: choice,
    label: choice === ALL ? t('verificacion', 'allResults') : choice === 'none' ? t('verificacion', 'neverRun') : t('verificacion', `r_${choice}`),
  }));
  const columnLabel: Readonly<Record<TestCaseSortColumn, string>> = {
    code: t('verificacion', 'colCode'),
    title: t('verificacion', 'colTitle'),
    program: t('verificacion', 'colProgram'),
    result: t('verificacion', 'colResult'),
    runs: t('verificacion', 'colRuns'),
  };
  const arrow = filters.dir === 'asc' ? '↑' : '↓';

  return (
    <View style={styles.wrap}>
      <TextField
        label={t('verificacion', 'searchLabel')}
        placeholder={t('verificacion', 'searchPlaceholder')}
        testID={VERIFICACION_TESTIDS.VERIFICATION_SEARCH}
        value={query}
        onChangeText={onQueryChange}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
      />
      <SelectField
        label={t('verificacion', 'filterProgram')}
        testID={VERIFICACION_TESTIDS.VERIFICATION_FILTER_PROGRAM}
        value={toChoice(filters.program)}
        options={programOptions}
        onChange={(choice) => onProgram(fromChoice(choice))}
      />
      <SelectField
        label={t('verificacion', 'filterResult')}
        testID={VERIFICACION_TESTIDS.VERIFICATION_FILTER_RESULT}
        value={toChoice(filters.result)}
        options={resultOptions}
        onChange={(choice) => onResult(resultFromChoice(choice))}
      />
      <View role="radiogroup" aria-label={texts.sortBy} testID={MOVIL_VERIFICATION_TESTIDS.SORT_GROUP} style={styles.chips}>
        {SORT_COLUMNS.map((column) => (
          <Chip
            key={column}
            label={filters.sort === column ? `${columnLabel[column]} ${arrow}` : columnLabel[column]}
            selected={filters.sort === column}
            onPress={() => onSort(column)}
            testID={VERIFICACION_DYNAMIC_TESTIDS.TESTCASE_SORT(column)}
          />
        ))}
      </View>
      {filtered ? <Button label={t('verificacion', 'clearFilters')} testID={VERIFICACION_TESTIDS.VERIFICATION_FILTERS_CLEAR} variant="ghost" onPress={onClear} /> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
