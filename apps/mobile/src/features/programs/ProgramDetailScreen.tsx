import { DETALLE_TESTIDS, HITOS_TESTIDS, MOVIL_TESTIDS, REQUISITOS_TESTIDS, formatDate, formatMoney, toProgressTitle, type MilestoneDto, type ProgramDto } from '@sigpro/shared';
import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useI18n, useTexts } from '../../state/i18n';
import type { Resource } from '../../lib/resource';
import { Avatar } from '../../ui/Avatar';
import { Button } from '../../ui/Button';
import { ProgressBar } from '../../ui/ProgressBar';
import { Screen } from '../../ui/Screen';
import { ErrorState, LoadingState } from '../../ui/States';
import { Text } from '../../ui/Text';
import { MilestonesList } from './MilestonesList';
import { ProgramStatusBadge } from './ProgramStatusBadge';
import { PROGRAMS_TEXTS } from './texts';
import { MOVIL_PROGRAMS_TESTIDS } from './testids';
import { useProgramDetail, type ProgramLookup } from './useProgramDetail';
import { countDone } from './view';

interface Props {
  readonly code: string;
}

/**
 * Detalle de un programa (`/programs/:code`), solo lectura: cabecera con código, nombre y estado, progreso, responsable,
 * fechas, presupuesto, descripción e hitos. «Ver requisitos» enlaza con `/programs/:code/requirements`.
 */
export const ProgramDetailScreen = ({ code }: Props) => {
  const { t } = useI18n();
  const router = useRouter();
  const { program, milestones } = useProgramDetail(code);
  const found = program.data?.kind === 'found' ? program.data.program : null;

  const back = () => (router.canGoBack() ? router.back() : router.replace('/programs'));

  return (
    <Screen title={found?.name ?? t('common', 'detailTitle')} subtitle={found ? undefined : code} testID={MOVIL_TESTIDS.PROGRAM_DETAIL_PAGE}>
      <ProgramBody program={program} />
      {found ? <MilestonesSection code={found.code} milestones={milestones} /> : null}
      <Button label={t('common', 'backToPrograms')} testID={DETALLE_TESTIDS.PROGRAM_DETAIL_BACK} variant="ghost" onPress={back} />
    </Screen>
  );
};

/** Cuerpo del programa según su estado de carga: cargando, error, 404 o datos. */
const ProgramBody = ({ program }: { readonly program: Resource<ProgramLookup> }) => {
  const texts = useTexts(PROGRAMS_TEXTS);
  const router = useRouter();
  const lookup = program.data;

  if (lookup === null && program.error === null) return <LoadingState testID={MOVIL_PROGRAMS_TESTIDS.PROGRAM_DETAIL_LOADING} />;

  if (lookup === null) {
    return (
      <ErrorState
        testID={MOVIL_PROGRAMS_TESTIDS.PROGRAM_DETAIL_ERROR}
        retryTestID={MOVIL_PROGRAMS_TESTIDS.PROGRAM_DETAIL_ERROR_RETRY}
        title={texts.detailError}
        trace={program.error ?? undefined}
        onRetry={program.reload}
      />
    );
  }

  if (lookup.kind === 'missing') {
    return (
      <View testID={DETALLE_TESTIDS.PROGRAM_DETAIL_NOT_FOUND} role="alert" style={styles.block}>
        <Text variant="heading" tone="danger">
          {texts.notFound}
        </Text>
        <Text variant="mono" tone="muted">
          {lookup.trace}
        </Text>
      </View>
    );
  }

  const { program: found } = lookup;
  return (
    <>
      <ProgramDetail program={found} />
      <Button
        label={texts.openRequirements}
        testID={REQUISITOS_TESTIDS.PROGRAM_DETAIL_OPEN_REQUIREMENTS}
        variant="primary"
        onPress={() => router.push(`/programs/${encodeURIComponent(found.code)}/requirements`)}
      />
    </>
  );
};

/** Cabecera, progreso, ficha y descripción de un programa encontrado. */
const ProgramDetail = ({ program }: { readonly program: ProgramDto }) => {
  const { t, lang } = useI18n();
  return (
    <View testID={DETALLE_TESTIDS.PROGRAM_DETAIL} style={styles.block}>
      <View style={styles.row}>
        <Text variant="mono" tone="muted">
          {program.code}
        </Text>
        <ProgramStatusBadge status={program.status} testID={DETALLE_TESTIDS.PROGRAM_DETAIL_STATE_BADGE} />
      </View>

      <View style={styles.block}>
        <Text variant="small" tone="muted">
          {t('common', 'progressLabelShort')}
        </Text>
        <View style={styles.row}>
          <View style={styles.grow}>
            <ProgressBar testID={DETALLE_TESTIDS.PROGRAM_DETAIL_PROGRESS} value={program.progress} label={toProgressTitle(program.progress, lang)} />
          </View>
          <Text variant="small" tone="muted" aria-hidden>
            {t('hitos', 'progressText', { value: program.progress })}
          </Text>
        </View>
      </View>

      <View style={styles.facts}>
        <Fact label={t('programas', 'owner')}>
          <View style={styles.row}>
            <Avatar name={program.ownerName} size={24} />
            <Text testID={MOVIL_PROGRAMS_TESTIDS.PROGRAM_DETAIL_OWNER} style={styles.grow}>
              {program.ownerName}
            </Text>
          </View>
        </Fact>
        <Fact label={t('programas', 'dates')}>
          <Text testID={MOVIL_PROGRAMS_TESTIDS.PROGRAM_DETAIL_DATES}>{`${formatDate(program.startDate, lang)} → ${formatDate(program.endDate, lang)}`}</Text>
        </Fact>
        <Fact label={t('programas', 'budget')}>
          <Text testID={MOVIL_PROGRAMS_TESTIDS.PROGRAM_DETAIL_BUDGET}>{formatMoney(program.budgetEur, lang)}</Text>
        </Fact>
      </View>

      {program.description ? (
        <Text variant="body" tone="muted" testID={MOVIL_PROGRAMS_TESTIDS.PROGRAM_DETAIL_DESCRIPTION}>
          {program.description}
        </Text>
      ) : null}
    </View>
  );
};

/** Dato de la ficha: etiqueta y valor. */
const Fact = ({ label, children }: { readonly label: string; readonly children: ReactNode }) => (
  <View style={styles.fact}>
    <Text variant="label" tone="muted">
      {label}
    </Text>
    {children}
  </View>
);

/** Sección de hitos: contador, lista de solo lectura, o estados de carga, vacío y error. */
const MilestonesSection = ({ code, milestones }: { readonly code: string; readonly milestones: Resource<readonly MilestoneDto[]> }) => {
  const { t } = useI18n();
  const { data: items, error, reload, loading } = milestones;
  const loadFailed = error !== null && items === null;

  return (
    <View testID={HITOS_TESTIDS.MILESTONES_PANEL} style={styles.block}>
      <Text variant="heading" role="heading" aria-level={2}>
        {t('hitos', 'title')}
      </Text>
      {items ? (
        <Text variant="small" tone="muted" testID={HITOS_TESTIDS.MILESTONES_COUNT} aria-live="polite">
          {t('hitos', 'count', { done: countDone(items), total: items.length })}
        </Text>
      ) : null}

      {items === null && !loadFailed && loading ? <LoadingState testID={MOVIL_PROGRAMS_TESTIDS.MILESTONES_LOADING} /> : null}

      {loadFailed ? (
        <ErrorState testID={HITOS_TESTIDS.MILESTONES_ERROR} retryTestID={HITOS_TESTIDS.MILESTONES_ERROR_RETRY} title={t('hitos', 'errorTitle')} trace={error ?? undefined} onRetry={reload} />
      ) : null}

      {items && items.length === 0 ? (
        <Text variant="small" tone="muted" testID={HITOS_TESTIDS.MILESTONES_EMPTY}>
          {t('hitos', 'empty')}
        </Text>
      ) : null}

      {items && items.length > 0 ? <MilestonesList code={code} milestones={items} /> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  block: { gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  grow: { flex: 1 },
  facts: { gap: 10 },
  fact: { gap: 4 },
});
