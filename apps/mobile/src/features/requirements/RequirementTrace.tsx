import { NC_SEVERITY_TONE, REQUISITOS_DYNAMIC_TESTIDS, REQUISITOS_TESTIDS, TEST_RESULT_TONE, isNcOpen, type RequirementDto } from '@sigpro/shared';
import { StyleSheet, View } from 'react-native';
import { useI18n } from '../../state/i18n';
import { SPACING } from '../../theme/tokens';
import { Badge } from '../../ui/Badge';
import { Text } from '../../ui/Text';

/**
 * Trazabilidad del requisito: casos de prueba enlazados con el resultado de su última ejecución y no conformidades de esas
 * ejecuciones (abiertas en color de peligro; resueltas, atenuadas con «resuelta»). Los datos vienen ya calculados por la API.
 */
export const RequirementTrace = ({ item }: { readonly item: RequirementDto }) => {
  const { t } = useI18n();
  return (
    <View testID={REQUISITOS_TESTIDS.REQUIREMENT_TRACE} style={styles.section}>
      <Text variant="heading">{t('requisitos', 'traceTitle')}</Text>

      <View style={styles.group}>
        <Text variant="small" tone="muted">
          {t('requisitos', 'linkedTests')}
        </Text>
        {item.tests.length === 0 ? (
          <Text variant="small" tone="faint">
            {t('requisitos', 'noTests')}
          </Text>
        ) : (
          <View role="list" testID={REQUISITOS_TESTIDS.REQUIREMENT_TESTS} style={styles.list}>
            {item.tests.map((test) => (
              <View key={test.code} role="listitem" style={styles.row}>
                <Text variant="mono" testID={REQUISITOS_DYNAMIC_TESTIDS.REQUIREMENT_TEST_LINK(test.code)}>
                  {test.code}
                </Text>
                <Badge
                  label={test.lastResult ? t('verificacion', `r_${test.lastResult}`) : t('verificacion', 'neverRun')}
                  tone={test.lastResult ? TEST_RESULT_TONE[test.lastResult] : 'neutral'}
                  state={test.lastResult ?? 'none'}
                  testID={REQUISITOS_DYNAMIC_TESTIDS.REQUIREMENT_TRACE_TEST(test.code)}
                />
              </View>
            ))}
          </View>
        )}
      </View>

      <View style={styles.group}>
        <Text variant="small" tone="muted">
          {t('requisitos', 'traceNcs')}
        </Text>
        {item.ncs.length === 0 ? (
          <Text variant="small" tone="faint">
            {t('requisitos', 'noNcs')}
          </Text>
        ) : (
          <View role="list" testID={REQUISITOS_TESTIDS.REQUIREMENT_TRACE_NCS} style={styles.list}>
            {item.ncs.map((nc) => {
              const open = isNcOpen(nc.state);
              return (
                <View key={nc.code} role="listitem" style={styles.row}>
                  <View style={styles.ncCode}>
                    <Text variant="mono" tone={open ? 'danger' : 'faint'} testID={REQUISITOS_DYNAMIC_TESTIDS.REQUIREMENT_TRACE_NC(nc.code)}>
                      {nc.code}
                    </Text>
                    {open ? null : (
                      <Text variant="small" tone="faint">
                        {t('requisitos', 'ncResolved')}
                      </Text>
                    )}
                  </View>
                  <Badge
                    label={t('nc', `sev_${nc.severity}`)}
                    tone={NC_SEVERITY_TONE[nc.severity]}
                    severity={nc.severity}
                    testID={REQUISITOS_DYNAMIC_TESTIDS.REQUIREMENT_TRACE_NC_BADGE(nc.code)}
                  />
                </View>
              );
            })}
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  section: { gap: SPACING.md },
  group: { gap: SPACING.xs },
  list: { gap: SPACING.sm },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SPACING.sm, flexWrap: 'wrap' },
  ncCode: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, flexWrap: 'wrap' },
});
