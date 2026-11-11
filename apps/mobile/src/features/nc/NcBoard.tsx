import { NC_DYNAMIC_TESTIDS, NC_TESTIDS, type NcDto, type NcListResponse } from '@sigpro/shared';
import { ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useI18n } from '../../state/i18n';
import { useTheme } from '../../state/theme';
import { SPACING, RADIUS } from '../../theme/tokens';
import { LoadingState } from '../../ui/States';
import { Text } from '../../ui/Text';
import { boardColumns, columnLabel, type BoardColumn } from './board';
import { NcCard } from './NcCard';
import { STATE_LABEL_KEY } from './texts';
import { MOVIL_NC_TESTIDS } from './testids';

/** Ancho máximo de una columna en pantallas grandes; en un móvil la columna ocupa todo el tablero. */
const MAX_COLUMN_WIDTH = 420;

interface Props {
  /** `null` hasta la primera respuesta. */
  readonly data: NcListResponse | null;
  readonly loading: boolean;
  readonly onOpen: (code: string) => void;
}

/**
 * Tablero de cinco columnas. Es un `ScrollView` horizontal con `pagingEnabled`: cada columna ocupa el ancho del
 * tablero y el desplazamiento se ajusta columna a columna (snap). `aria-busy` mientras carga.
 */
export const NcBoard = ({ data, loading, onOpen }: Props) => {
  const { t } = useI18n();
  const { width } = useWindowDimensions();
  const columnWidth = Math.min(width - 2 * SPACING.lg, MAX_COLUMN_WIDTH);
  const columns = data ? boardColumns(data.items) : boardColumns([]);

  return (
    <View role="group" aria-label={t('nc', 'board')} aria-busy={loading} testID={NC_TESTIDS.NC_BOARD} style={styles.board}>
      {data === null && loading ? (
        <LoadingState testID={MOVIL_NC_TESTIDS.BOARD_LOADING} />
      ) : (
        <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} style={styles.scroller}>
          {columns.map((column) => (
            <NcColumn key={column.state} column={column} width={columnWidth} onOpen={onOpen} />
          ))}
        </ScrollView>
      )}
    </View>
  );
};

interface ColumnProps {
  readonly column: BoardColumn<NcDto>;
  readonly width: number;
  readonly onOpen: (code: string) => void;
}

/** Columna: `role="region"` cuyo nombre es el estado y el recuento («En análisis · 2»). */
const NcColumn = ({ column, width, onOpen }: ColumnProps) => {
  const { t } = useI18n();
  const { colors } = useTheme();
  const { state, cards } = column;
  const stateLabel = t('nc', STATE_LABEL_KEY[state]);

  return (
    <View
      role="region"
      aria-label={columnLabel(stateLabel, cards.length)}
      testID={NC_DYNAMIC_TESTIDS.NC_COLUMN(state)}
      dataSet={{ state }}
      style={[styles.column, { width, backgroundColor: colors.surface2, borderColor: colors.border }]}
    >
      <View style={styles.header}>
        <Text variant="heading">{stateLabel}</Text>
        <Text variant="mono" tone="muted" testID={NC_DYNAMIC_TESTIDS.NC_COLUMN_COUNT(state)}>
          {cards.length}
        </Text>
      </View>
      <ScrollView style={styles.cards} contentContainerStyle={styles.cardsContent}>
        <View role="list" aria-label={t('nc', 'columnCards', { state: stateLabel })} style={styles.list}>
          {cards.map((card) => (
            <NcCard key={card.code} nc={card} onOpen={onOpen} />
          ))}
        </View>
        {cards.length === 0 ? (
          <Text variant="small" tone="muted" style={styles.empty} testID={NC_DYNAMIC_TESTIDS.NC_COLUMN_EMPTY(state)}>
            {t('nc', 'columnEmpty')}
          </Text>
        ) : null}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  board: { flex: 1, minHeight: 200 },
  scroller: { flex: 1 },
  column: { borderWidth: 1, borderRadius: RADIUS.lg, padding: SPACING.sm, gap: SPACING.sm },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.xs },
  cards: { flex: 1 },
  cardsContent: { gap: SPACING.sm, paddingBottom: SPACING.lg },
  list: { gap: SPACING.sm },
  empty: { textAlign: 'center', paddingVertical: SPACING.lg },
});
