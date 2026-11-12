import { MISION_DYNAMIC_TESTIDS, MISION_TESTIDS } from '@sigpro/shared';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useI18n } from '../../state/i18n';
import { useTheme } from '../../state/theme';
import { Card } from '../../ui/Card';
import { Sheet } from '../../ui/Sheet';
import { Text } from '../../ui/Text';
import { MOVIL_MISSION_TESTIDS } from './testids';
import type { KpiCardView, KpiKey } from './kpis';

interface Props {
  readonly cards: readonly KpiCardView[];
  /** Recarga en curso: la sección queda `aria-busy`, pero los valores anteriores siguen a la vista. */
  readonly busy: boolean;
  /** Todavía no hay resumen: los valores se sustituyen por «…». */
  readonly pending: boolean;
}

/** Cuatro indicadores clave (2×2). Móvil no tiene tooltip: el icono «i» abre una hoja con qué mide cada uno. */
export const KpiCards = ({ cards, busy, pending }: Props) => {
  const { t } = useI18n();
  const [openKey, setOpenKey] = useState<KpiKey | null>(null);
  const opened = cards.find((card) => card.key === openKey) ?? null;

  return (
    <View testID={MISION_TESTIDS.MISSION_KPIS} role="group" aria-label={t('mision', 'kpisLabel')} aria-busy={busy} style={styles.grid}>
      {cards.map((card) => (
        <KpiCard key={card.key} card={card} pending={pending} onHelp={() => setOpenKey(card.key)} />
      ))}
      <Sheet
        visible={opened !== null}
        title={opened ? t('mision', 'kpiInfo', { kpi: opened.label }) : ''}
        onClose={() => setOpenKey(null)}
        testID={MOVIL_MISSION_TESTIDS.MISSION_KPI_SHEET}
        closeTestID={MOVIL_MISSION_TESTIDS.MISSION_KPI_SHEET_CLOSE}
      >
        {opened ? (
          <Text testID={MISION_DYNAMIC_TESTIDS.MISSION_KPI_TOOLTIP(opened.key)} variant="body">
            {opened.help}
          </Text>
        ) : null}
      </Sheet>
    </View>
  );
};

interface CardProps {
  readonly card: KpiCardView;
  readonly pending: boolean;
  readonly onHelp: () => void;
}

const KpiCard = ({ card, pending, onHelp }: CardProps) => {
  const { t } = useI18n();
  const { colors } = useTheme();
  return (
    <Card testID={MISION_DYNAMIC_TESTIDS.MISSION_KPI(card.key)} role="group" aria-label={card.label} style={styles.card}>
      <View style={styles.head}>
        <Text variant="small" tone="muted" weight="500" style={styles.label} numberOfLines={2}>
          {card.label}
        </Text>
        <Pressable
          testID={MISION_DYNAMIC_TESTIDS.MISSION_KPI_INFO(card.key)}
          role="button"
          aria-label={t('mision', 'kpiInfo', { kpi: card.label })}
          onPress={onHelp}
          hitSlop={12}
          style={[styles.info, { borderColor: colors.borderStrong }]}
        >
          <Text variant="small" tone="muted" weight="600" aria-hidden style={styles.infoGlyph}>
            i
          </Text>
        </Pressable>
      </View>
      <Text testID={MISION_DYNAMIC_TESTIDS.MISSION_KPI_VALUE(card.key)} variant="metric" aria-live="polite">
        {pending ? '…' : card.value}
      </Text>
      <Text variant="small" tone="faint">
        {pending ? ' ' : card.sub}
      </Text>
    </Card>
  );
};

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  card: { flexBasis: '47%', flexGrow: 1, minWidth: 0, gap: 4 },
  head: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 6 },
  label: { flex: 1, minWidth: 0 },
  info: { width: 24, height: 24, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  infoGlyph: { lineHeight: 14 },
});
