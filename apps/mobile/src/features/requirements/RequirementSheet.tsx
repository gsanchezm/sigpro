import { FLOW_STATES, REQUISITOS_DYNAMIC_TESTIDS, REQUISITOS_TESTIDS, flowStepStatus, richTextToPlain, type FlowStepStatus, type RequirementDto } from '@sigpro/shared';
import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useI18n, useTexts } from '../../state/i18n';
import { useTheme } from '../../state/theme';
import { RADIUS } from '../../theme/tokens';
import { Badge } from '../../ui/Badge';
import { Sheet } from '../../ui/Sheet';
import { Text } from '../../ui/Text';
import { REQUIREMENTS_TEXTS } from './texts';
import { stateTone } from './view';

interface Props {
  /** Requisito abierto; `null` = hoja cerrada. */
  readonly item: RequirementDto | null;
  readonly onClose: () => void;
}

/** Detalle de solo lectura en una hoja inferior (la alternativa móvil al panel lateral de la web). */
export const RequirementSheet = ({ item, onClose }: Props) => {
  const { t } = useI18n();
  return (
    <Sheet
      visible={item !== null}
      title={t('requisitos', 'detailTitle')}
      onClose={onClose}
      testID={REQUISITOS_TESTIDS.REQUIREMENT_DETAIL}
      closeTestID={REQUISITOS_TESTIDS.REQUIREMENT_DETAIL_CLOSE}
    >
      {item ? <RequirementDetails item={item} /> : null}
    </Sheet>
  );
};

/** Campo de la hoja: etiqueta visible y su valor. */
const Field = ({ label, children }: { readonly label: string; readonly children: ReactNode }) => (
  <View style={styles.field}>
    <Text variant="label" tone="muted">
      {label}
    </Text>
    {children}
  </View>
);

const RequirementDetails = ({ item }: { readonly item: RequirementDto }) => {
  const { t } = useI18n();
  const { colors } = useTheme();
  const texts = useTexts(REQUIREMENTS_TEXTS);
  // La descripción es HTML saneado: en móvil se muestra como texto plano
  const description = richTextToPlain(item.description);
  const tags = item.tags.map((tag) => t('requisitos', `tag_${tag}`)).join(' · ');

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <View style={styles.codeLine}>
        <Text variant="mono" tone="muted" testID={REQUISITOS_TESTIDS.REQUIREMENT_CODE}>
          {item.code}
        </Text>
        <Badge
          label={t('requisitos', `st_${item.state}`)}
          tone={stateTone(item.state)}
          state={item.state}
          testID={REQUISITOS_TESTIDS.REQUIREMENT_STATE_BADGE}
        />
      </View>
      <Text variant="heading" testID={REQUISITOS_TESTIDS.REQUIREMENT_TITLE}>
        {item.title}
      </Text>
      <Field label={t('requisitos', 'priorityLabel')}>
        <Text testID={REQUISITOS_TESTIDS.REQUIREMENT_PRIORITY}>{t('programas', item.priority)}</Text>
      </Field>
      <Field label={t('requisitos', 'tagsLabel')}>
        {tags ? (
          <Text testID={REQUISITOS_TESTIDS.REQUIREMENT_TAGS}>{tags}</Text>
        ) : (
          <Text tone="faint">{t('requisitos', 'tagsNone')}</Text>
        )}
      </Field>
      <Field label={t('requisitos', 'descriptionLabel')}>
        <Text testID={REQUISITOS_TESTIDS.REQUIREMENT_DESCRIPTION}>{description || texts.noDescription}</Text>
      </Field>
      <ApprovalFlow item={item} />
      <Field label={t('requisitos', 'linkedTests')}>
        {item.testCaseCodes.length === 0 ? (
          <Text tone="faint">{t('requisitos', 'noTests')}</Text>
        ) : (
          <View role="list" testID={REQUISITOS_TESTIDS.REQUIREMENT_TESTS} style={styles.tests}>
            {item.testCaseCodes.map((code) => (
              <View key={code} role="listitem" style={[styles.test, { backgroundColor: colors.surface2, borderColor: colors.border }]}>
                {/* Sin enlace: la ruta de Verificación no existe en la app móvil */}
                <Text variant="mono" testID={REQUISITOS_DYNAMIC_TESTIDS.REQUIREMENT_TEST_LINK(code)}>
                  {code}
                </Text>
              </View>
            ))}
          </View>
        )}
      </Field>
    </ScrollView>
  );
};

const STEP_STATUS_TEXT = { done: 'flowDone', current: 'flowCurrent', future: 'flowFuture' } as const satisfies Record<FlowStepStatus, string>;

/**
 * Flujo de aprobación en solo lectura: los cuatro pasos de la web (hecho ✓, actual con halo y pendiente) sin los botones de
 * transición, porque en móvil los requisitos no se editan. Cada paso nombra su estado («Aprobación (paso actual)»).
 */
const ApprovalFlow = ({ item }: { readonly item: RequirementDto }) => {
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
              <Text variant="label" weight={current ? '600' : '500'} tone={current ? 'default' : 'muted'}>
                {t('requisitos', `flow_${step}`)}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  flow: { gap: 10 },
  step: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dot: { width: 24, height: 24, borderRadius: RADIUS.pill, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  scroll: { flexShrink: 1 },
  content: { gap: 12, paddingBottom: 4 },
  codeLine: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' },
  field: { gap: 4 },
  tests: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  test: { borderWidth: 1, borderRadius: RADIUS.sm, paddingHorizontal: 8, paddingVertical: 4 },
});
