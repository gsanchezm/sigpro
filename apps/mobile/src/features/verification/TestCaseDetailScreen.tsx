import type { TestCaseDetailDto, TestRunDto } from '@sigpro/shared';
import { useNavigation, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View, type ScrollViewInstance } from 'react-native';
import { useAuth } from '../../state/auth';
import { useI18n } from '../../state/i18n';
import { useToast } from '../../state/toast';
import { SPACING } from '../../theme/tokens';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { Screen } from '../../ui/Screen';
import { ErrorState, LoadingState } from '../../ui/States';
import { Text } from '../../ui/Text';
import { ResultBadge } from './ResultBadge';
import { RunForm } from './RunForm';
import { RunsHistory } from './RunsHistory';
import { savedToastBody } from './run';
import { MOVIL_VERIFICATION_TESTIDS, VERIFICACION_DYNAMIC_TESTIDS, VERIFICACION_TESTIDS } from './testids';
import { useReport } from './useReport';
import { useTestCaseDetail } from './useTestCaseDetail';
import { canExecute } from './view';

interface Props {
  readonly code: string;
  /** `?run=1` (menú ⋯ de la lista): lleva el scroll al formulario «Registrar ejecución», como el ancla `#run` de la web. */
  readonly focusRun: boolean;
}

/**
 * Detalle de un caso de prueba (`/verification/:code`): código, último resultado, programa e informe PDF del caso; pasos y
 * resultado esperado; requisitos verificados (tocar uno lo abre en su programa); historial de ejecuciones con evidencias y el
 * formulario para registrar una ejecución. Guardar una ejecución recarga el historial sin mover el scroll ni vaciar el formulario.
 */
export const TestCaseDetailScreen = ({ code, focusRun }: Props) => {
  const { t } = useI18n();
  const router = useRouter();
  const navigation = useNavigation();
  const { user } = useAuth();
  const toast = useToast();
  const report = useReport();
  const detail = useTestCaseDetail(code);
  const lookup = detail.data;
  const found = lookup?.kind === 'found' ? lookup.testCase : null;
  const canRun = canExecute(user?.role ?? 'auditor');

  // `?run=1`: una vez pintado el formulario, el scroll baja a él (una sola vez)
  const scrollRef = useRef<ScrollViewInstance>(null);
  const [bodyY, setBodyY] = useState<number | null>(null);
  const [runY, setRunY] = useState<number | null>(null);
  const scrolled = useRef(false);
  useEffect(() => {
    if (!focusRun || scrolled.current || bodyY === null || runY === null) return;
    scrolled.current = true;
    scrollRef.current?.scrollTo({ y: bodyY + runY, animated: false });
  }, [focusRun, bodyY, runY]);

  // «Volver» retrocede si la lista está debajo en la pila de Verificación; con un enlace directo (recarga, URL compartida) no la hay
  // y `router.canGoBack()` mentiría (las pestañas saben volver a la primera, Programas): se abre la lista en su lugar
  const back = () => (navigation.getState()?.routes.length ?? 0) > 1 ? router.back() : router.replace('/verification');
  const backButton = <Button label={t('verificacion', 'back')} testID={VERIFICACION_TESTIDS.TESTCASE_BACK} variant="ghost" onPress={back} />;

  const onSaved = (run: TestRunDto) => {
    const result = t('verificacion', `r_${run.result}`);
    toast.push('ok', t('verificacion', 'runSaved'), savedToastBody(run, { body: t('verificacion', 'runSavedBody', { code: run.testCaseCode, result }), files: (n) => t('verificacion', 'runSavedFiles', { n }) }));
    detail.reload();
  };

  const title = found?.title ?? t('verificacion', 'title');

  const body = () => {
    if (lookup === null && detail.error === null) return <LoadingState testID={MOVIL_VERIFICATION_TESTIDS.DETAIL_LOADING} />;
    if (lookup === null) {
      return (
        <>
          <ErrorState
            testID={MOVIL_VERIFICATION_TESTIDS.DETAIL_ERROR}
            retryTestID={MOVIL_VERIFICATION_TESTIDS.DETAIL_ERROR_RETRY}
            title={t('common', 'genericError')}
            trace={detail.error ?? undefined}
            onRetry={detail.reload}
          />
          {backButton}
        </>
      );
    }
    if (lookup.kind === 'missing') {
      return (
        <View testID={VERIFICACION_TESTIDS.TESTCASE_NOT_FOUND} role="alert" style={styles.block}>
          <Text variant="heading" tone="danger">
            {t('verificacion', 'notFound')}
          </Text>
          <Text variant="mono" tone="muted">
            {lookup.trace}
          </Text>
          {backButton}
        </View>
      );
    }
    return (
      <View testID={VERIFICACION_TESTIDS.TESTCASE_DETAIL} aria-busy={detail.loading} onLayout={(event) => setBodyY(event.nativeEvent.layout.y)} style={styles.body}>
        <CaseSummary testCase={lookup.testCase} busy={report.busy} onReport={() => void report.download({ codes: lookup.testCase.code }, `informe-verificacion-${lookup.testCase.code}.pdf`)} />
        <StepsCard testCase={lookup.testCase} />
        <RequirementsCard testCase={lookup.testCase} onOpen={(requirement) => router.push(`/programs/${encodeURIComponent(lookup.testCase.programCode)}/requirements?select=${encodeURIComponent(requirement)}`)} />
        <Card style={styles.card}>
          <Text variant="heading" role="heading" aria-level={2}>
            {t('verificacion', 'runsTitle')}
          </Text>
          <RunsHistory runs={lookup.testCase.runs} testCaseCode={lookup.testCase.code} />
        </Card>
        <View onLayout={(event) => setRunY(event.nativeEvent.layout.y)}>
          <RunForm testCaseCode={lookup.testCase.code} canExecute={canRun} onSaved={onSaved} />
        </View>
        {backButton}
      </View>
    );
  };

  return (
    <Screen title={title} subtitle={found ? undefined : code} testID={MOVIL_VERIFICATION_TESTIDS.DETAIL_PAGE} scrollRef={scrollRef}>
      {body()}
    </Screen>
  );
};

/** Código, último resultado, programa e informe PDF del caso (la cabecera de la ficha de la web). */
const CaseSummary = ({ testCase, busy, onReport }: { readonly testCase: TestCaseDetailDto; readonly busy: boolean; readonly onReport: () => void }) => {
  const { t } = useI18n();
  return (
    <View style={styles.block}>
      <View style={styles.row}>
        <Text variant="mono" tone="muted" weight="500">
          {testCase.code}
        </Text>
        <ResultBadge result={testCase.lastResult} />
        <Text variant="mono" tone="faint" aria-label={testCase.programName}>
          {testCase.programCode}
        </Text>
      </View>
      <Button label={t('verificacion', 'report')} testID={VERIFICACION_TESTIDS.TESTCASE_REPORT} busy={busy} onPress={onReport} />
    </View>
  );
};

/** Pasos numerados y resultado esperado. */
const StepsCard = ({ testCase }: { readonly testCase: TestCaseDetailDto }) => {
  const { t } = useI18n();
  return (
    <Card style={styles.card}>
      <Text variant="heading" role="heading" aria-level={2}>
        {t('verificacion', 'stepsTitle')}
      </Text>
      <View role="list" testID={VERIFICACION_TESTIDS.TESTCASE_STEPS} style={styles.steps}>
        {testCase.steps.map((step, index) => (
          <View key={`${index}-${step}`} role="listitem" style={styles.step}>
            <Text variant="body" tone="muted" aria-hidden>
              {`${index + 1}.`}
            </Text>
            <Text variant="body" style={styles.grow}>
              {step}
            </Text>
          </View>
        ))}
      </View>
      <Text variant="label" role="heading" aria-level={3}>
        {t('verificacion', 'expectedTitle')}
      </Text>
      <Text variant="body" tone="muted" testID={VERIFICACION_TESTIDS.TESTCASE_EXPECTED}>
        {testCase.expected}
      </Text>
    </Card>
  );
};

/** Requisitos verificados: cada uno es un enlace al requisito dentro de su programa (`?select=`, como la web). */
const RequirementsCard = ({ testCase, onOpen }: { readonly testCase: TestCaseDetailDto; readonly onOpen: (requirementCode: string) => void }) => {
  const { t } = useI18n();
  return (
    <Card style={styles.card}>
      <Text variant="heading" role="heading" aria-level={2}>
        {t('verificacion', 'requirementsTitle')}
      </Text>
      {testCase.requirements.length === 0 ? (
        <Text variant="body" tone="faint">
          {t('verificacion', 'noRequirements')}
        </Text>
      ) : (
        <View role="list" testID={VERIFICACION_TESTIDS.TESTCASE_REQUIREMENTS} style={styles.steps}>
          {testCase.requirements.map((requirement) => (
            <Pressable
              key={requirement.code}
              role="link"
              aria-label={`${requirement.code} · ${requirement.title}`}
              aria-description={t('verificacion', 'openInRequirements')}
              testID={VERIFICACION_DYNAMIC_TESTIDS.TESTCASE_REQUIREMENT_LINK(requirement.code)}
              onPress={() => onOpen(requirement.code)}
              style={({ pressed }) => [styles.requirement, pressed ? styles.pressed : null]}
            >
              <Text variant="mono" tone="accent" weight="500" aria-hidden>
                {requirement.code}
              </Text>
              <Text variant="body" tone="muted" style={styles.grow} aria-hidden>
                {requirement.title}
              </Text>
            </Pressable>
          ))}
        </View>
      )}
    </Card>
  );
};

const styles = StyleSheet.create({
  body: { gap: SPACING.block },
  block: { gap: SPACING.sm },
  card: { gap: SPACING.md },
  row: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 10 },
  steps: { gap: 8 },
  step: { flexDirection: 'row', gap: 8 },
  requirement: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 10 },
  pressed: { opacity: 0.85 },
  grow: { flex: 1 },
});
