import { MISION_DYNAMIC_TESTIDS, MISION_TESTIDS, NC_SEVERITIES, NC_SEVERITY_TONE, type MessageKey, type MilestoneBar, type NcSeverity } from '@sigpro/shared';
import { useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useI18n } from '../../state/i18n';
import { useTheme } from '../../state/theme';
import { Card } from '../../ui/Card';
import { Text } from '../../ui/Text';
import { ToggleButton } from '../../ui/ToggleButton';
import { toneColors } from '../../theme/tokens';
import { columnHeights, milestoneBarViews } from './chart-data';
import type { NcBySeverity } from './kpis';
import { MOVIL_MISSION_TESTIDS } from './testids';

// Gráficas del panel con `View` (sin librerías). Cada barra es un `role="img"` con su valor en el nombre accesible; la
// leyenda aparece con 2 o más series y cada gráfica se puede ver como tabla, como en la web.

/** Altura del área de columnas (px). */
const COLUMN_AREA_PX = 120;
const COLUMN_WIDTH_PX = 28;

const SEVERITY_LABEL: Readonly<Record<NcSeverity, MessageKey<'nc'>>> = { minor: 'sev_minor', major: 'sev_major', critical: 'sev_critical' };

interface LegendItem {
  readonly color: string;
  readonly label: string;
}

/** Leyenda solo cuando hay 2 o más series (regla del panel). */
const Legend = ({ testID, items }: { readonly testID: string; readonly items: readonly LegendItem[] }) => {
  if (items.length < 2) return null;
  return (
    <View testID={testID} style={styles.legend}>
      {items.map((item) => (
        <View key={item.label} style={styles.legendItem}>
          <View aria-hidden style={[styles.swatch, { backgroundColor: item.color }]} />
          <Text variant="small" tone="muted">
            {item.label}
          </Text>
        </View>
      ))}
    </View>
  );
};

interface CardProps {
  readonly testID: string;
  readonly title: string;
  readonly toggleTestID: string;
  readonly asTable: boolean;
  readonly onToggle: () => void;
  readonly children: ReactNode;
}

/** Tarjeta de una gráfica: título y el botón que alterna gráfica / tabla. */
const ChartCard = ({ testID, title, toggleTestID, asTable, onToggle, children }: CardProps) => {
  const { t } = useI18n();
  return (
    <Card testID={testID} role="group" aria-label={title}>
      <View style={styles.cardHead}>
        <Text variant="heading" style={styles.cardTitle}>
          {title}
        </Text>
        <ToggleButton testID={toggleTestID} label={asTable ? t('mision', 'viewChart') : t('mision', 'viewTable')} pressed={asTable} onPress={onToggle} />
      </View>
      {children}
    </Card>
  );
};

const EmptyChart = ({ testID }: { readonly testID: string }) => {
  const { t } = useI18n();
  return (
    <Text testID={testID} variant="small" tone="faint" style={styles.empty}>
      {t('mision', 'chartEmpty')}
    </Text>
  );
};

/** Hitos cumplidos frente al total por programa: una barra fina partida en cumplidos | pendientes. */
const MilestonesChart = ({ bars }: { readonly bars: readonly MilestoneBar[] }) => {
  const { t } = useI18n();
  const { colors } = useTheme();
  const [asTable, setAsTable] = useState(false);
  const views = milestoneBarViews(bars);
  const label = t('mision', 'chartMilestonesLabel', { count: views.length });
  const legend: readonly LegendItem[] = [
    { color: colors.accent, label: t('mision', 'chartMilestonesDone') },
    { color: colors.borderStrong, label: t('mision', 'chartMilestonesRest') },
  ];

  return (
    <ChartCard
      testID={MISION_TESTIDS.MISSION_CHART_MILESTONES}
      title={t('mision', 'chartMilestonesTitle')}
      toggleTestID={MISION_TESTIDS.MISSION_CHART_MILESTONES_TOGGLE}
      asTable={asTable}
      onToggle={() => setAsTable((current) => !current)}
    >
      {views.length === 0 ? (
        <EmptyChart testID={MISION_TESTIDS.MISSION_CHART_EMPTY} />
      ) : asTable ? (
        <View testID={MISION_TESTIDS.MISSION_CHART_MILESTONES_TABLE} role="table" aria-label={label} style={styles.table}>
          <View role="row" style={styles.tableRow}>
            <Text role="columnheader" variant="small" tone="muted" style={styles.tableGrow}>
              {t('mision', 'tableProgram')}
            </Text>
            <Text role="columnheader" variant="small" tone="muted" style={styles.tableNum}>
              {t('mision', 'tableDone')}
            </Text>
            <Text role="columnheader" variant="small" tone="muted" style={styles.tableNum}>
              {t('mision', 'tableTotal')}
            </Text>
          </View>
          {views.map((bar) => (
            <View key={bar.programCode} role="row" style={styles.tableRow}>
              <Text role="rowheader" variant="mono" style={styles.tableGrow}>
                {bar.programCode}
              </Text>
              <Text role="cell" variant="mono" style={styles.tableNum}>
                {String(bar.done)}
              </Text>
              <Text role="cell" variant="mono" style={styles.tableNum}>
                {String(bar.total)}
              </Text>
            </View>
          ))}
        </View>
      ) : (
        <View style={styles.bars}>
          <Legend testID={MOVIL_MISSION_TESTIDS.MISSION_CHART_MILESTONES_LEGEND} items={legend} />
          <View role="list" aria-label={label} style={styles.bars}>
            {views.map((bar) => {
              const tip = t('mision', 'barTipMilestones', { program: bar.programCode, done: bar.done, total: bar.total });
              return (
                <View key={bar.programCode} role="listitem" style={styles.barRow}>
                  <Text variant="mono" tone="muted" aria-hidden style={styles.code}>
                    {bar.programCode}
                  </Text>
                  <View style={styles.track}>
                    <View
                      testID={MISION_DYNAMIC_TESTIDS.MISSION_BAR_MILESTONES(bar.programCode)}
                      role="img"
                      aria-label={tip}
                      dataSet={{ done: bar.done, total: bar.total }}
                      style={[styles.barTrack, { width: `${bar.widthPct}%`, backgroundColor: colors.borderStrong }]}
                    >
                      <View style={[styles.barDone, { width: `${bar.donePct}%`, backgroundColor: colors.accent }]} />
                    </View>
                  </View>
                  <Text variant="small" tone="muted" aria-hidden style={styles.count}>
                    {`${bar.done}/${bar.total}`}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>
      )}
    </ChartCard>
  );
};

/** NC abiertas por severidad: tres columnas con el tono de la severidad (el mismo de las tarjetas del tablero). */
const NcChart = ({ counts }: { readonly counts: NcBySeverity }) => {
  const { t } = useI18n();
  const { colors } = useTheme();
  const [asTable, setAsTable] = useState(false);
  const heights = columnHeights(counts, COLUMN_AREA_PX);
  const total = NC_SEVERITIES.reduce((sum, severity) => sum + counts[severity], 0);
  const label = t('mision', 'chartNcLabel', { minor: counts.minor, major: counts.major, critical: counts.critical });
  const toneOf = (severity: NcSeverity): string => toneColors(colors, NC_SEVERITY_TONE[severity]).fg;
  const legend: readonly LegendItem[] = NC_SEVERITIES.map((severity) => ({ color: toneOf(severity), label: t('nc', SEVERITY_LABEL[severity]) }));

  return (
    <ChartCard
      testID={MISION_TESTIDS.MISSION_CHART_NC}
      title={t('mision', 'chartNcTitle')}
      toggleTestID={MISION_TESTIDS.MISSION_CHART_NC_TOGGLE}
      asTable={asTable}
      onToggle={() => setAsTable((current) => !current)}
    >
      {asTable ? (
        <View testID={MISION_TESTIDS.MISSION_CHART_NC_TABLE} role="table" aria-label={label} style={styles.table}>
          <View role="row" style={styles.tableRow}>
            <Text role="columnheader" variant="small" tone="muted" style={styles.tableGrow}>
              {t('mision', 'tableSeverity')}
            </Text>
            <Text role="columnheader" variant="small" tone="muted" style={styles.tableNum}>
              {t('mision', 'tableCount')}
            </Text>
          </View>
          {NC_SEVERITIES.map((severity) => (
            <View key={severity} role="row" dataSet={{ severity }} style={styles.tableRow}>
              <Text role="rowheader" variant="body" style={styles.tableGrow}>
                {t('nc', SEVERITY_LABEL[severity])}
              </Text>
              <Text role="cell" variant="mono" style={styles.tableNum}>
                {String(counts[severity])}
              </Text>
            </View>
          ))}
        </View>
      ) : total === 0 ? (
        <EmptyChart testID={MOVIL_MISSION_TESTIDS.MISSION_CHART_NC_EMPTY} />
      ) : (
        <View style={styles.bars}>
          <Legend testID={MOVIL_MISSION_TESTIDS.MISSION_CHART_NC_LEGEND} items={legend} />
          <View role="list" aria-label={label} style={styles.columns}>
            {NC_SEVERITIES.map((severity) => {
              const tip = t('mision', 'barTipNc', { severity: t('nc', SEVERITY_LABEL[severity]), count: counts[severity] });
              return (
                <View key={severity} role="listitem" style={styles.column}>
                  <Text variant="small" weight="600" aria-hidden>
                    {String(counts[severity])}
                  </Text>
                  <View style={styles.columnArea}>
                    <View
                      testID={MISION_DYNAMIC_TESTIDS.MISSION_BAR_NC(severity)}
                      role="img"
                      aria-label={tip}
                      dataSet={{ severity, value: counts[severity] }}
                      style={[styles.columnBar, { height: heights[severity], backgroundColor: toneOf(severity) }]}
                    />
                  </View>
                  <Text variant="small" tone="muted" aria-hidden style={styles.columnLabel}>
                    {t('nc', SEVERITY_LABEL[severity])}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>
      )}
    </ChartCard>
  );
};

interface Props {
  readonly bars: readonly MilestoneBar[];
  readonly ncBySeverity: NcBySeverity;
}

export const MissionCharts = ({ bars, ncBySeverity }: Props) => (
  <View style={styles.stack}>
    <MilestonesChart bars={bars} />
    <NcChart counts={ncBySeverity} />
  </View>
);

const styles = StyleSheet.create({
  stack: { gap: 12 },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  cardTitle: { flex: 1, minWidth: 0 },
  empty: { textAlign: 'center', paddingVertical: 24 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  swatch: { width: 14, height: 3, borderRadius: 2 },
  bars: { gap: 8 },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  code: { width: 60, fontSize: 11.5 },
  track: { flex: 1, minWidth: 0, height: 22, justifyContent: 'center' },
  barTrack: { height: 10, borderRadius: 4, overflow: 'hidden' },
  barDone: { height: '100%' },
  count: { width: 44, textAlign: 'right' },
  columns: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'flex-end', gap: 8, paddingTop: 4 },
  column: { alignItems: 'center', gap: 6, flex: 1 },
  columnArea: { height: COLUMN_AREA_PX, justifyContent: 'flex-end', alignItems: 'center' },
  columnBar: { width: COLUMN_WIDTH_PX, borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  columnLabel: { textAlign: 'center', borderTopWidth: 1, paddingTop: 6, alignSelf: 'stretch' },
  table: { gap: 4 },
  tableRow: { flexDirection: 'row', alignItems: 'center', gap: 8, borderTopWidth: StyleSheet.hairlineWidth, paddingVertical: 4 },
  tableGrow: { flex: 1, minWidth: 0 },
  tableNum: { width: 64, textAlign: 'right' },
});
