import { DETALLE_DYNAMIC_TESTIDS, DETALLE_TESTIDS, EDITAR_PROGRAMA_TESTIDS, MOVIL_TESTIDS, REQUISITOS_TESTIDS, formatDate, formatMoney, toProgressTitle, type ProgramDto } from '@sigpro/shared';
import { useRouter } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useAuth } from '../../state/auth';
import { useI18n, useTexts } from '../../state/i18n';
import { SPACING } from '../../theme/tokens';
import { Avatar } from '../../ui/Avatar';
import { Button } from '../../ui/Button';
import type { Resource } from '../../lib/resource';
import { ProgressBar } from '../../ui/ProgressBar';
import { Screen } from '../../ui/Screen';
import { Segmented } from '../../ui/Segmented';
import { ErrorState, LoadingState } from '../../ui/States';
import { Text } from '../../ui/Text';
import { MilestonesPanel } from './MilestonesPanel';
import { ProgramStatusBadge } from './ProgramStatusBadge';
import { SuppliersPanel } from './SuppliersPanel';
import { PROGRAMS_TEXTS } from './texts';
import { MOVIL_PROGRAMS_DYNAMIC_TESTIDS, MOVIL_PROGRAMS_TESTIDS } from './testids';
import { useProgramDetail, type ProgramLookup } from './useProgramDetail';
import { programPermissionsOf, type ProgramPermissions } from './view';

interface Props {
  readonly code: string;
}

type DetailTab = 'summary' | 'milestones' | 'suppliers';

/**
 * Detalle de un programa (`/programs/:code`). Cabecera con código, estado y el botón «Editar programa» (deshabilitado con su
 * motivo si el rol no puede); debajo, tres pestañas como el detalle de la web: «Resumen» (progreso, ficha, descripción y
 * «Ver requisitos»), «Hitos» (alta, edición, avance y borrado) y «Proveedores» (contratados y buscador).
 */
export const ProgramDetailScreen = ({ code }: Props) => {
  const { t } = useI18n();
  const router = useRouter();
  const { user } = useAuth();
  const permissions = programPermissionsOf(user?.role ?? 'auditor');
  const { program } = useProgramDetail(code);
  const found = program.data?.kind === 'found' ? program.data.program : null;

  const back = () => (router.canGoBack() ? router.back() : router.replace('/programs'));

  return (
    <Screen title={found?.name ?? t('common', 'detailTitle')} subtitle={found ? undefined : code} testID={MOVIL_TESTIDS.PROGRAM_DETAIL_PAGE}>
      <ProgramBody program={program} permissions={permissions} />
      <Button label={t('common', 'backToPrograms')} testID={DETALLE_TESTIDS.PROGRAM_DETAIL_BACK} variant="ghost" onPress={back} />
    </Screen>
  );
};

/** Cuerpo del programa según su estado de carga: cargando, error, 404 o datos con sus pestañas. */
const ProgramBody = ({ program, permissions }: { readonly program: Resource<ProgramLookup>; readonly permissions: ProgramPermissions }) => {
  const texts = useTexts(PROGRAMS_TEXTS);
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

  return <ProgramDetailView program={lookup.program} permissions={permissions} onChanged={program.reload} />;
};

interface ViewProps {
  readonly program: ProgramDto;
  readonly permissions: ProgramPermissions;
  /** Vuelve a pedir el programa (avance y hitos cumplidos) tras un cambio en sus hitos. */
  readonly onChanged: () => void;
}

/** Cabecera, pestañas y el panel de la pestaña elegida. */
const ProgramDetailView = ({ program, permissions, onChanged }: ViewProps) => {
  const { t } = useI18n();
  const router = useRouter();
  const [tab, setTab] = useState<DetailTab>('summary');
  const editReason = permissions.edit ? null : t('programas', 'editButtonDisabled');

  return (
    <View testID={DETALLE_TESTIDS.PROGRAM_DETAIL} style={styles.block}>
      <View style={styles.header}>
        <View style={styles.row}>
          <Text variant="mono" tone="muted">
            {program.code}
          </Text>
          <ProgramStatusBadge status={program.status} testID={DETALLE_TESTIDS.PROGRAM_DETAIL_STATE_BADGE} />
        </View>
        <Button
          label={t('programas', 'editButton')}
          testID={EDITAR_PROGRAMA_TESTIDS.PROGRAM_DETAIL_EDIT}
          variant="secondary"
          disabled={!permissions.edit}
          disabledReason={editReason ?? undefined}
          onPress={() => router.push(`/programs/${encodeURIComponent(program.code)}/edit`)}
        />
        {editReason ? (
          <Text variant="small" tone="faint" testID={MOVIL_PROGRAMS_DYNAMIC_TESTIDS.ACTION_REASON('edit')}>
            {editReason}
          </Text>
        ) : null}
      </View>

      <Segmented<DetailTab>
        testID={DETALLE_TESTIDS.PROGRAM_DETAIL_TABS}
        label={t('common', 'detailTitle')}
        value={tab}
        onChange={setTab}
        options={[
          { value: 'summary', label: t('common', 'tabSummary'), testID: DETALLE_DYNAMIC_TESTIDS.PROGRAM_DETAIL_TAB('summary') },
          { value: 'milestones', label: t('common', 'tabMilestones'), testID: DETALLE_DYNAMIC_TESTIDS.PROGRAM_DETAIL_TAB('milestones') },
          { value: 'suppliers', label: t('proveedores', 'title'), testID: MOVIL_PROGRAMS_TESTIDS.PROGRAM_DETAIL_TAB_SUPPLIERS },
        ]}
      />

      {tab === 'summary' ? (
        <View testID={DETALLE_DYNAMIC_TESTIDS.PROGRAM_DETAIL_PANEL('summary')} style={styles.block}>
          <SummaryPanel program={program} />
        </View>
      ) : null}

      {tab === 'milestones' ? (
        <View testID={DETALLE_DYNAMIC_TESTIDS.PROGRAM_DETAIL_PANEL('milestones')} style={styles.block}>
          <MilestonesPanel code={program.code} permissions={permissions} onChanged={onChanged} />
        </View>
      ) : null}

      {tab === 'suppliers' ? (
        <View testID={MOVIL_PROGRAMS_TESTIDS.PROGRAM_DETAIL_PANEL_SUPPLIERS} style={styles.block}>
          <SuppliersPanel code={program.code} />
        </View>
      ) : null}
    </View>
  );
};

/** Resumen: progreso, responsable, fechas, presupuesto y descripción; «Ver requisitos» enlaza con `/programs/:code/requirements`. */
const SummaryPanel = ({ program }: { readonly program: ProgramDto }) => {
  const { t, lang } = useI18n();
  const texts = useTexts(PROGRAMS_TEXTS);
  const router = useRouter();
  return (
    <>
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

      <Button
        label={texts.openRequirements}
        testID={REQUISITOS_TESTIDS.PROGRAM_DETAIL_OPEN_REQUIREMENTS}
        variant="primary"
        onPress={() => router.push(`/programs/${encodeURIComponent(program.code)}/requirements`)}
      />
    </>
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

const styles = StyleSheet.create({
  block: { gap: SPACING.sm },
  header: { gap: SPACING.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  grow: { flex: 1 },
  facts: { gap: 10 },
  fact: { gap: 4 },
});
