import { FLOW_STATES, REQUISITOS_DYNAMIC_TESTIDS, REQUISITOS_TESTIDS, flowStepStatus, transitionsFor, type FlowStepStatus, type RequirementDto, type RequirementState, type Role } from '@sigpro/shared';
import { StyleSheet, View } from 'react-native';
import { useI18n } from '../../state/i18n';
import { useTheme } from '../../state/theme';
import { RADIUS, SPACING } from '../../theme/tokens';
import { Button } from '../../ui/Button';
import { Text } from '../../ui/Text';
import { MOVIL_REQUIREMENTS_DYNAMIC_TESTIDS } from './testids';

interface Props {
  readonly item: RequirementDto;
  readonly role: Role;
  /** Pide el paso `to`; la hoja abre la confirmación (como la web). */
  readonly onTransition: (to: RequirementState) => void;
}

const STEP_STATUS_TEXT = { done: 'flowDone', current: 'flowCurrent', future: 'flowFuture' } as const satisfies Record<FlowStepStatus, string>;

/**
 * Flujo de aprobación: los cuatro pasos de la web (hecho ✓, actual con halo y pendiente). El paso actual contiene los
 * botones de transición, como en la web; los que el rol no puede dar quedan deshabilitados con su motivo visible.
 */
export const RequirementFlow = ({ item, role, onTransition }: Props) => {
  const { t } = useI18n();
  const { colors } = useTheme();
  return (
    <View testID={REQUISITOS_TESTIDS.REQUIREMENT_FLOW} role="group" aria-label={t('requisitos', 'flowTitle')} style={styles.field}>
      <Text variant="label" tone="muted">
        {t('requisitos', 'flowTitle')}
      </Text>
      <View role="list" style={styles.flow}>
        {FLOW_STATES.map((step, index) => {
          const status = flowStepStatus(item.state, step);
          const done = status === 'done';
          const current = status === 'current';
          return (
            <View
              key={step}
              role="listitem"
              aria-label={`${t('requisitos', `flow_${step}`)} (${t('requisitos', STEP_STATUS_TEXT[status])})`}
              aria-current={current ? 'step' : undefined}
              testID={REQUISITOS_DYNAMIC_TESTIDS.REQUIREMENT_FLOW_STEP(step)}
              dataSet={{ status }}
              style={styles.step}
            >
              <View
                aria-hidden
                style={[
                  styles.dot,
                  done ? { backgroundColor: colors.accent, borderColor: colors.accent } : { backgroundColor: colors.surface, borderColor: current ? colors.accent : colors.borderStrong },
                  current ? { boxShadow: `0 0 0 3px ${colors.accentSoft}` } : null,
                ]}
              >
                <Text variant="small" weight="600" tone={done ? 'onAccent' : current ? 'accent' : 'faint'}>
                  {done ? '✓' : String(index + 1)}
                </Text>
              </View>
              <View style={styles.stepBody}>
                <Text variant="label" weight={current ? '600' : '500'} tone={current ? 'default' : 'muted'}>
                  {t('requisitos', `flow_${step}`)}
                </Text>
                {current ? <Transitions item={item} role={role} onTransition={onTransition} /> : null}
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
};

/** Botones de transición del paso actual. Un paso no permitido al rol va deshabilitado y con su motivo como texto. */
const Transitions = ({ item, role, onTransition }: Props) => {
  const { t } = useI18n();
  return (
    <View testID={REQUISITOS_TESTIDS.REQUIREMENT_TRANSITIONS} style={styles.transitions}>
      {transitionsFor(role, item.state).map((rule) => {
        const reason = rule.allowed ? null : t('requisitos', `trDenied_${rule.to}`);
        return (
          <View key={rule.to} style={styles.transition}>
            <Button
              label={t('requisitos', `tr_${rule.to}`)}
              testID={REQUISITOS_DYNAMIC_TESTIDS.REQUIREMENT_TRANSITION(rule.to)}
              variant={rule.to === 'draft' ? 'secondary' : 'primary'}
              disabled={!rule.allowed}
              disabledReason={reason ?? undefined}
              onPress={() => onTransition(rule.to)}
            />
            {reason ? (
              <Text variant="small" tone="faint" testID={MOVIL_REQUIREMENTS_DYNAMIC_TESTIDS.TRANSITION_REASON(rule.to)}>
                {reason}
              </Text>
            ) : null}
          </View>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  field: { gap: SPACING.xs },
  flow: { gap: SPACING.md },
  step: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  stepBody: { flex: 1, gap: SPACING.sm },
  dot: { width: 24, height: 24, borderRadius: RADIUS.pill, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  transitions: { gap: SPACING.md, paddingTop: SPACING.xs },
  transition: { gap: SPACING.xs },
});
