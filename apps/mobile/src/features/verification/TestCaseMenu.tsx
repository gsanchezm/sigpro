import type { TestCaseDto } from '@sigpro/shared';
import { StyleSheet, View } from 'react-native';
import { useI18n } from '../../state/i18n';
import { SPACING } from '../../theme/tokens';
import { Button } from '../../ui/Button';
import { Sheet } from '../../ui/Sheet';
import { Text } from '../../ui/Text';
import { MOVIL_VERIFICATION_TESTIDS, VERIFICACION_TESTIDS } from './testids';

interface Props {
  /** Caso de la fila abierta; `null` = menú cerrado. */
  readonly testCase: TestCaseDto | null;
  readonly canRun: boolean;
  readonly onClose: () => void;
  readonly onView: (code: string) => void;
  readonly onRun: (code: string) => void;
  readonly onReport: (code: string) => void;
}

/**
 * Menú ⋯ de una fila, en una hoja inferior (`RowMenuButton` de la web): ver detalle, registrar ejecución (deshabilitada con su
 * motivo visible si el rol no puede) e informe PDF del caso. Cada acción cierra la hoja y hace su trabajo.
 */
export const TestCaseMenu = ({ testCase, canRun, onClose, onView, onRun, onReport }: Props) => {
  const { t } = useI18n();
  const run = (action: (code: string) => void) => () => {
    if (!testCase) return;
    onClose();
    action(testCase.code);
  };
  const denied = canRun ? null : t('verificacion', 'denied');

  return (
    <Sheet visible={testCase !== null} title={t('verificacion', 'rowActions', { code: testCase?.code ?? '' })} onClose={onClose} testID={VERIFICACION_TESTIDS.TESTCASE_MENU}>
      <View style={styles.list}>
        <Button label={t('verificacion', 'menuView')} testID={VERIFICACION_TESTIDS.TESTCASE_MENU_VIEW} onPress={run(onView)} />
        <View style={styles.item}>
          <Button
            label={t('verificacion', 'menuRun')}
            testID={VERIFICACION_TESTIDS.TESTCASE_MENU_RUN}
            disabled={!canRun}
            disabledReason={denied ?? undefined}
            onPress={run(onRun)}
          />
          {denied ? (
            <Text variant="small" tone="faint" testID={MOVIL_VERIFICATION_TESTIDS.MENU_RUN_REASON}>
              {denied}
            </Text>
          ) : null}
        </View>
        <Button label={t('verificacion', 'menuReport')} testID={VERIFICACION_TESTIDS.TESTCASE_MENU_REPORT} onPress={run(onReport)} />
      </View>
    </Sheet>
  );
};

const styles = StyleSheet.create({
  list: { gap: SPACING.sm },
  item: { gap: SPACING.xs },
});
