import type { TestCaseDto } from '@sigpro/shared';
import { Pressable, StyleSheet, View } from 'react-native';
import { useI18n } from '../../state/i18n';
import { useTheme } from '../../state/theme';
import { RADIUS } from '../../theme/tokens';
import { Card } from '../../ui/Card';
import { Text } from '../../ui/Text';
import { ResultBadge } from './ResultBadge';
import { VERIFICACION_DYNAMIC_TESTIDS } from './testids';
import { rowState } from './view';

interface Props {
  readonly testCase: TestCaseDto;
  /** Modo selección: la tarjeta muestra una casilla y tocarla marca o desmarca el caso en lugar de abrirlo. */
  readonly selectMode: boolean;
  readonly selected: boolean;
  readonly onOpen: (code: string) => void;
  readonly onToggle: (code: string) => void;
  /** Abre el menú ⋯ de la fila (ver detalle, registrar ejecución, informe). */
  readonly onMenu: (code: string) => void;
}

/**
 * Tarjeta de un caso de prueba (la fila de la web a 390 px). El `listitem` lleva el id de la fila, el código como nombre y
 * `data-state` con el último resultado. El cuerpo es un enlace al detalle (o marca la casilla en modo selección) y, a la
 * derecha, el botón ⋯ con el menú de la fila.
 */
export const TestCaseCard = ({ testCase, selectMode, selected, onOpen, onToggle, onMenu }: Props) => {
  const { t } = useI18n();
  const { colors } = useTheme();
  const { code, title, programCode, runCount, lastResult } = testCase;
  const press = () => (selectMode ? onToggle(code) : onOpen(code));

  return (
    <Card
      role="listitem"
      aria-label={code}
      testID={VERIFICACION_DYNAMIC_TESTIDS.TESTCASE_ROW(code)}
      dataSet={{ state: rowState(lastResult) }}
      style={[styles.item, selectMode && selected ? { borderColor: colors.accent } : null]}
    >
      <View style={styles.top}>
        {selectMode ? (
          <Pressable
            role="checkbox"
            aria-label={t('verificacion', 'selectRow', { code })}
            aria-checked={selected}
            testID={VERIFICACION_DYNAMIC_TESTIDS.TESTCASE_SELECT(code)}
            onPress={() => onToggle(code)}
            style={styles.check}
          >
            <View style={[styles.box, { borderColor: selected ? colors.accent : colors.borderStrong, backgroundColor: selected ? colors.accent : colors.surface }]}>
              {selected ? (
                <Text variant="small" weight="600" tone="onAccent" aria-hidden>
                  ✓
                </Text>
              ) : null}
            </View>
          </Pressable>
        ) : null}

        <Pressable
          role="link"
          aria-label={`${code} · ${title}`}
          testID={VERIFICACION_DYNAMIC_TESTIDS.TESTCASE_LINK(code)}
          onPress={press}
          style={({ pressed }) => [styles.press, pressed ? styles.pressed : null]}
        >
          <View style={styles.row}>
            <Text variant="mono" tone="muted" aria-hidden>
              {code}
            </Text>
            <ResultBadge result={lastResult} />
          </View>
          <Text variant="heading">{title}</Text>
          <View style={styles.row}>
            <Text variant="mono" tone="muted" style={styles.grow}>
              {programCode}
            </Text>
            <Text variant="small" tone="muted">
              {`${runCount} ${t('verificacion', 'colRuns').toLowerCase()}`}
            </Text>
          </View>
        </Pressable>

        <Pressable
          role="button"
          aria-label={t('verificacion', 'rowActions', { code })}
          testID={VERIFICACION_DYNAMIC_TESTIDS.TESTCASE_ROW_MENU(code)}
          onPress={() => onMenu(code)}
          style={({ pressed }) => [styles.menu, { borderColor: colors.border, backgroundColor: pressed ? colors.surface2 : colors.surface }]}
        >
          <Text variant="heading" tone="muted" aria-hidden>
            ⋯
          </Text>
        </Pressable>
      </View>
    </Card>
  );
};

const styles = StyleSheet.create({
  item: { padding: 0, gap: 0, overflow: 'hidden' },
  top: { flexDirection: 'row', alignItems: 'center' },
  press: { flex: 1, padding: 16, gap: 8 },
  pressed: { opacity: 0.85 },
  check: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center', paddingLeft: 12 },
  box: { width: 20, height: 20, borderRadius: 6, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  menu: { width: 44, height: 44, borderWidth: 1, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  grow: { flex: 1 },
});
