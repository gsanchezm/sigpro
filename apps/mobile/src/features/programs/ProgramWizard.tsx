import { ApiError, DETALLE_TESTIDS, MOVIL_PROGRAMS_DYNAMIC_TESTIDS, MOVIL_PROGRAMS_TESTIDS, PROGRAMAS_DYNAMIC_TESTIDS, PROGRAMAS_TESTIDS, formatDate, formatMoney, nextProgramCode, type CreateProgramInput, type MessageKey, type OwnerDto } from '@sigpro/shared';
import { useState } from 'react';
import { ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useResource } from '../../lib/resource';
import { useAuth } from '../../state/auth';
import { useI18n } from '../../state/i18n';
import { useTheme } from '../../state/theme';
import { RADIUS, SPACING } from '../../theme/tokens';
import { Button } from '../../ui/Button';
import { Sheet } from '../../ui/Sheet';
import { SwitchField } from '../../ui/SwitchField';
import { Text } from '../../ui/Text';
import { ActionItem } from './ActionItem';
import { BasicFields, PlanFields, type ProgramFieldIds } from './ProgramFields';
import { EMPTY_DRAFT, fieldErrorsOf, stepErrors, validateCreate, withoutErrors, type Errors, type ProgramDraft, type WizardStep } from './form';

/** Último paso: el botón pasa de «Siguiente» a «Crear programa». */
const LAST_STEP: WizardStep = 3;
const NEXT_STEP: Readonly<Record<WizardStep, WizardStep>> = { 1: 2, 2: 3, 3: 3 };
const PREVIOUS_STEP: Readonly<Record<WizardStep, WizardStep>> = { 1: 1, 2: 1, 3: 2 };

/** Ids de la web: el asistente de alta se localiza con los mismos `programs-wizard-*`. */
const WIZARD_IDS: ProgramFieldIds = {
  name: PROGRAMAS_TESTIDS.PROGRAMS_WIZARD_NAME,
  nameError: PROGRAMAS_TESTIDS.PROGRAMS_WIZARD_NAME_ERROR,
  description: PROGRAMAS_TESTIDS.PROGRAMS_WIZARD_DESCRIPTION,
  owner: PROGRAMAS_TESTIDS.PROGRAMS_WIZARD_OWNER,
  ownerError: PROGRAMAS_TESTIDS.PROGRAMS_WIZARD_OWNER_ERROR,
  status: PROGRAMAS_TESTIDS.PROGRAMS_WIZARD_STATUS,
  start: PROGRAMAS_TESTIDS.PROGRAMS_WIZARD_START,
  startError: PROGRAMAS_TESTIDS.PROGRAMS_WIZARD_START_ERROR,
  end: PROGRAMAS_TESTIDS.PROGRAMS_WIZARD_END,
  endError: PROGRAMAS_TESTIDS.PROGRAMS_WIZARD_END_ERROR,
  budget: PROGRAMAS_TESTIDS.PROGRAMS_WIZARD_BUDGET,
  budgetError: PROGRAMAS_TESTIDS.PROGRAMS_WIZARD_BUDGET_ERROR,
  priority: {
    low: PROGRAMAS_TESTIDS.PROGRAMS_WIZARD_PRIORITY_LOW,
    medium: PROGRAMAS_TESTIDS.PROGRAMS_WIZARD_PRIORITY_MEDIUM,
    high: PROGRAMAS_TESTIDS.PROGRAMS_WIZARD_PRIORITY_HIGH,
  },
  classified: PROGRAMAS_TESTIDS.PROGRAMS_WIZARD_CLASSIFIED,
};

/** Estados que ofrece el alta (la web solo deja «Borrador» y «Activo»). */
const INITIAL_STATUSES = ['draft', 'active'] as const;

interface Props {
  readonly onClose: () => void;
  /** Crea el programa; rechaza con `ApiError` (un 422 trae los errores por campo). */
  readonly onSubmit: (input: CreateProgramInput) => Promise<void>;
}

/**
 * Asistente de alta en tres pasos (datos básicos · planificación · revisión), en una hoja inferior. Las reglas de cada paso y
 * el envío son los de la web: el paso se valida con los esquemas Zod compartidos; un 422 del servidor (nombre repetido o con
 * «duplicado») vuelve al paso 1 con el aviso; «Atrás» en el primer paso queda deshabilitado con su motivo.
 */
export const ProgramWizard = ({ onClose, onSubmit }: Props) => {
  const { t, lang } = useI18n();
  const { colors } = useTheme();
  const { height } = useWindowDimensions();
  const { api } = useAuth();
  const [step, setStep] = useState<WizardStep>(1);
  const [draft, setDraft] = useState<ProgramDraft>(EMPTY_DRAFT);
  const [errors, setErrors] = useState<Errors>({});
  const [serverError, setServerError] = useState<{ readonly status: string; readonly text: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // Código previsto: el siguiente libre (la API lo asigna de verdad al crear), como la web
  const nextCodeLoad = useResource(async () => {
    const latest = await api.programs.list({ sort: 'code', dir: 'desc', pageSize: 1 });
    return nextProgramCode(latest.items.map((item) => item.code));
  }, [api]);
  const owners = useResource<readonly OwnerDto[]>(() => api.users.owners(), [api]);
  const message = (key: string) => t('programas', key as MessageKey<'programas'>);
  const nextCode = nextCodeLoad.data ?? (nextCodeLoad.error ? '—' : '…');
  const ownerList = owners.data ?? [];
  const ownerName = ownerList.find((owner) => owner.id === draft.ownerId)?.name ?? '';
  // El cuerpo hace scroll dentro de la hoja; la altura descuenta cabecera, pasos y pie
  const bodyHeight = Math.max(240, height * 0.85 - 230);

  const change = (patch: Partial<ProgramDraft>) => {
    setDraft((current) => ({ ...current, ...patch }));
    setErrors((current) => withoutErrors(current, Object.keys(patch)));
  };

  const goBack = () => {
    setStep(PREVIOUS_STEP[step]);
    setErrors({});
    setServerError(null);
  };

  /** «Siguiente» valida el paso actual; en el último, valida el alta completa y la envía. */
  const advance = async () => {
    if (step !== LAST_STEP) {
      const found = stepErrors(step, draft);
      if (Object.keys(found).length > 0) {
        setErrors(found);
        return;
      }
      setErrors({});
      setStep(NEXT_STEP[step]);
      return;
    }
    const result = validateCreate(draft);
    if (!result.success) {
      setErrors(result.errors);
      return;
    }
    setSubmitting(true);
    setServerError(null);
    try {
      await onSubmit(result.data);
    } catch (failure) {
      const fields = fieldErrorsOf(failure);
      if (fields) {
        setErrors(fields);
        setServerError({ status: '422', text: message(Object.values(fields)[0] ?? 'dupName') });
        setStep(1);
      } else {
        setServerError({ status: failure instanceof ApiError ? String(failure.status || '—') : '—', text: t('common', 'genericError') });
      }
    } finally {
      setSubmitting(false);
    }
  };

  const stepNames = [t('programas', 'step1'), t('programas', 'step2'), t('programas', 'step3')];
  const isLast = step === LAST_STEP;

  const footer = (
    <View style={styles.row}>
      <ActionItem
        label={t('programas', 'back')}
        testID={PROGRAMAS_TESTIDS.PROGRAMS_WIZARD_BACK}
        reason={step === 1 ? t('common', 'wizardFirstStep') : null}
        reasonTestID={MOVIL_PROGRAMS_DYNAMIC_TESTIDS.ACTION_REASON('back')}
        onPress={goBack}
      />
      <Button label={t('programas', 'cancel')} testID={PROGRAMAS_TESTIDS.PROGRAMS_WIZARD_CANCEL} variant="ghost" onPress={onClose} disabled={submitting} />
      <Button
        label={isLast ? t('programas', 'create') : t('programas', 'next')}
        testID={isLast ? DETALLE_TESTIDS.PROGRAMS_WIZARD_SUBMIT : DETALLE_TESTIDS.PROGRAMS_WIZARD_NEXT}
        variant="primary"
        busy={submitting}
        onPress={() => void advance()}
      />
    </View>
  );

  return (
    <Sheet visible title={t('programas', 'newProgram')} onClose={onClose} testID={PROGRAMAS_TESTIDS.PROGRAMS_WIZARD} footer={footer}>
      <Text variant="small" tone="muted" testID={MOVIL_PROGRAMS_TESTIDS.WIZARD_STEP_TEXT}>
        {`${t('programas', 'step')} ${step} ${t('programas', 'of')} 3`}
      </Text>

      <View role="list" aria-label={t('programas', 'steps')} style={styles.steps}>
        {stepNames.map((name, index) => {
          const n = (index + 1) as WizardStep;
          const current = n === step;
          const done = n < step;
          const filled = current || done;
          return (
            <View key={n} role="listitem" aria-current={current ? 'step' : undefined} testID={PROGRAMAS_DYNAMIC_TESTIDS.PROGRAMS_WIZARD_STEP(n)} style={styles.stepItem}>
              <View aria-hidden style={[styles.dot, { backgroundColor: filled ? colors.accent : colors.surface2, borderColor: filled ? colors.accent : colors.borderStrong }]}>
                <Text variant="small" weight="600" tone={filled ? 'onAccent' : 'faint'}>
                  {done ? '✓' : String(n)}
                </Text>
              </View>
              <Text variant="small" weight={current ? '600' : '500'} tone={current ? 'default' : 'muted'} numberOfLines={1} style={styles.stepName}>
                {name}
              </Text>
            </View>
          );
        })}
      </View>

      {serverError ? (
        <Text variant="small" tone="danger" role="alert" testID={PROGRAMAS_TESTIDS.PROGRAMS_WIZARD_SERVER_ERROR}>
          {`${serverError.status} · ${serverError.text}`}
        </Text>
      ) : null}

      <ScrollView style={{ maxHeight: bodyHeight }} contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
        {step === 1 ? (
          <BasicFields
            draft={draft}
            onChange={change}
            errors={errors}
            ids={WIZARD_IDS}
            owners={ownerList}
            statuses={INITIAL_STATUSES}
            statusLabel={t('programas', 'initialStatus')}
            code={{ value: nextCode, testID: PROGRAMAS_TESTIDS.PROGRAMS_WIZARD_CODE }}
          />
        ) : null}

        {step === 2 ? <PlanFields draft={draft} onChange={change} errors={errors} ids={WIZARD_IDS} /> : null}

        {step === 3 ? (
          <View style={styles.review}>
            <View testID={PROGRAMAS_TESTIDS.PROGRAMS_WIZARD_SUMMARY} style={[styles.summary, { borderColor: colors.border, backgroundColor: colors.surface2 }]}>
              <SummaryRow label={t('programas', 'code')} value={nextCode} />
              <SummaryRow label={t('programas', 'name')} value={draft.name} />
              <SummaryRow label={t('programas', 'owner')} value={ownerName} />
              <SummaryRow label={t('programas', 'dates')} value={`${formatDate(draft.startDate, lang)} → ${formatDate(draft.endDate, lang)}`} />
              <SummaryRow label={t('programas', 'budget')} value={draft.budget ? formatMoney(Number(draft.budget), lang) : '—'} />
              <SummaryRow label={t('programas', 'priority')} value={t('programas', draft.priority)} />
              <SummaryRow label={t('programas', 'classified')} value={draft.classified ? t('programas', 'yes') : t('programas', 'no')} />
            </View>
            <SwitchField
              label={t('programas', 'notifyTeam')}
              hint={t('programas', 'serverHint')}
              value={draft.notify}
              onChange={(notify) => change({ notify })}
              testID={PROGRAMAS_TESTIDS.PROGRAMS_WIZARD_NOTIFY}
            />
          </View>
        ) : null}
      </ScrollView>
    </Sheet>
  );
};

/** Fila del resumen: etiqueta y valor (la `dl` de la web). */
const SummaryRow = ({ label, value }: { readonly label: string; readonly value: string }) => (
  <View style={styles.summaryRow}>
    <Text variant="small" tone="faint" style={styles.summaryLabel}>
      {label}
    </Text>
    <Text variant="body" style={styles.summaryValue}>
      {value}
    </Text>
  </View>
);

const styles = StyleSheet.create({
  steps: { flexDirection: 'row', gap: SPACING.sm },
  stepItem: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, minWidth: 0 },
  stepName: { flexShrink: 1 },
  dot: { width: 22, height: 22, borderRadius: RADIUS.pill, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  form: { gap: SPACING.md, paddingBottom: SPACING.xs },
  review: { gap: SPACING.md },
  summary: { borderWidth: 1, borderRadius: RADIUS.md, padding: SPACING.md, gap: SPACING.sm },
  summaryRow: { flexDirection: 'row', gap: SPACING.md, alignItems: 'flex-start' },
  summaryLabel: { width: 96 },
  summaryValue: { flex: 1 },
  row: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', alignItems: 'flex-start', gap: SPACING.sm },
});
