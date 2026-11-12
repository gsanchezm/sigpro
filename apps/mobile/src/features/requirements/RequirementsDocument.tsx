import { REQUISITOS_DYNAMIC_TESTIDS, REQUISITOS_TESTIDS, buildTree, richTextToPlain, sectionNumbers, visibleRows, type RequirementDto } from '@sigpro/shared';
import { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useI18n } from '../../state/i18n';
import { useTheme } from '../../state/theme';
import { RADIUS, SPACING } from '../../theme/tokens';
import { Badge } from '../../ui/Badge';
import { Text } from '../../ui/Text';
import { stateTone } from './view';

const NONE: ReadonlySet<string> = new Set<string>();

interface Props {
  /** Requisitos a mostrar (ya filtrados por la búsqueda); se leen como un documento, en el orden del árbol. */
  readonly items: readonly RequirementDto[];
  readonly onOpen: (code: string) => void;
}

/**
 * Vista Documento (solo lectura): los requisitos como un texto continuo. Cada uno es una sección numerada (1, 1.1, 1.2…) con
 * el número y el código en la línea de margen, el título, la descripción en texto plano y su estado. Tocar el título abre la hoja.
 */
export const RequirementsDocument = ({ items, onOpen }: Props) => {
  const { t } = useI18n();
  const { colors } = useTheme();
  const tree = useMemo(() => buildTree(items), [items]);
  const numbers = useMemo(() => sectionNumbers(tree), [tree]);
  const rows = useMemo(() => visibleRows(tree, NONE), [tree]);

  return (
    <View testID={REQUISITOS_TESTIDS.REQUIREMENTS_DOCUMENT} role="group" aria-label={t('requisitos', 'docTitle')} style={[styles.doc, { backgroundColor: colors.surface, borderColor: colors.border, boxShadow: colors.shadow }]}>
      {rows.map(({ item, depth }, index) => {
        const number = numbers.get(item.code) ?? '';
        const description = richTextToPlain(item.description);
        return (
          <View
            key={item.code}
            role="article"
            aria-label={`${number} ${item.title}`}
            testID={REQUISITOS_DYNAMIC_TESTIDS.DOC_SECTION(item.code)}
            dataSet={{ state: item.state, depth: String(depth) }}
            style={[styles.section, index > 0 ? { borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth } : null]}
          >
            <View style={styles.margin}>
              <Text variant="mono" tone="faint">
                {`${number} · ${item.code}`}
              </Text>
              <Badge label={t('requisitos', `st_${item.state}`)} tone={stateTone(item.state)} state={item.state} />
            </View>
            <Pressable
              role="button"
              aria-label={t('requisitos', 'docOpen', { code: item.code })}
              testID={REQUISITOS_DYNAMIC_TESTIDS.DOC_OPEN(item.code)}
              onPress={() => onOpen(item.code)}
              style={styles.titleButton}
            >
              <Text variant={depth === 0 ? 'heading' : 'label'} weight="600">
                {`${number} ${item.title}`}
              </Text>
            </Pressable>
            {description ? (
              <Text variant="body" tone="muted">
                {description}
              </Text>
            ) : null}
          </View>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  doc: { borderWidth: 1, borderRadius: RADIUS.lg, overflow: 'hidden' },
  section: { paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md, gap: 6 },
  margin: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SPACING.sm, flexWrap: 'wrap' },
  titleButton: { minHeight: 32, justifyContent: 'center' },
});
