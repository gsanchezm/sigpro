import { REQUISITOS_DYNAMIC_TESTIDS, type RequirementDto, type VisibleRow } from '@sigpro/shared';
import { Pressable, StyleSheet, View } from 'react-native';
import { useI18n, useTexts } from '../../state/i18n';
import { useTheme } from '../../state/theme';
import { Badge } from '../../ui/Badge';
import { Text } from '../../ui/Text';
import { MOVIL_REQUIREMENTS_DYNAMIC_TESTIDS } from './testids';
import { REQUIREMENTS_TEXTS } from './texts';
import { indentOf, stateTone } from './view';

interface Props {
  readonly row: VisibleRow<RequirementDto>;
  readonly onToggle: (code: string) => void;
  readonly onOpen: (code: string) => void;
}

/**
 * Fila del árbol: `role="listitem"` con su nombre accesible («REQ-017 título») y `aria-level` (nivel + 1).
 * Dentro hay dos botones: el de plegar (solo si tiene hijos, con `aria-expanded`) y el que abre el detalle.
 */
export const RequirementRow = ({ row, onToggle, onOpen }: Props) => {
  const { t } = useI18n();
  const texts = useTexts(REQUIREMENTS_TEXTS);
  const { colors } = useTheme();
  const { item, depth, hasChildren, expanded } = row;
  const { code } = item;
  const tags = item.tags.map((tag) => t('requisitos', `tag_${tag}`)).join(' · ');
  // `aria-level` no está tipado en las props de RN, pero RN Web lo pasa al DOM tal cual (nivel 1 = raíz)
  const level: Record<string, number> = { 'aria-level': depth + 1 };

  return (
    <View
      role="listitem"
      aria-label={`${code} ${item.title}`}
      {...level}
      testID={REQUISITOS_DYNAMIC_TESTIDS.REQUIREMENT_ROW(code)}
      dataSet={{ state: item.state, priority: item.priority }}
      style={[styles.row, { borderBottomColor: colors.border, paddingLeft: 12 + indentOf(depth) }]}
    >
      {hasChildren ? (
        <Pressable
          role="button"
          aria-expanded={expanded}
          aria-label={t('requisitos', expanded ? 'collapse' : 'expand', { code })}
          testID={REQUISITOS_DYNAMIC_TESTIDS.REQUIREMENT_TOGGLE(code)}
          hitSlop={HIT_SLOP}
          onPress={() => onToggle(code)}
          style={styles.toggle}
        >
          <Text variant="body" tone="muted" aria-hidden>
            {expanded ? '▾' : '▸'}
          </Text>
        </Pressable>
      ) : (
        <View style={styles.toggle} aria-hidden />
      )}
      <Pressable
        role="button"
        aria-label={`${texts.openDetail} ${code}`}
        testID={REQUISITOS_DYNAMIC_TESTIDS.REQUIREMENT_OPEN(code)}
        onPress={() => onOpen(code)}
        style={styles.body}
      >
        <View style={styles.codeLine}>
          <Text variant="mono" tone="muted">
            {code}
          </Text>
          <Badge
            label={t('requisitos', `st_${item.state}`)}
            tone={stateTone(item.state)}
            state={item.state}
            testID={MOVIL_REQUIREMENTS_DYNAMIC_TESTIDS.ROW_STATE(code)}
          />
        </View>
        <Text variant="body">{item.title}</Text>
        <Text variant="small" tone="muted" testID={MOVIL_REQUIREMENTS_DYNAMIC_TESTIDS.ROW_PRIORITY(code)}>
          {`${t('requisitos', 'priorityLabel')}: ${t('programas', item.priority)}`}
        </Text>
        {tags ? (
          <Text variant="small" tone="faint" testID={MOVIL_REQUIREMENTS_DYNAMIC_TESTIDS.ROW_TAGS(code)}>
            {tags}
          </Text>
        ) : null}
      </Pressable>
    </View>
  );
};

/** Área táctil del botón de plegado más allá de su dibujo (el objetivo mínimo son 44 px). */
const HIT_SLOP = { top: 10, bottom: 10, left: 6, right: 6 } as const;

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 4, paddingRight: 12, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  // Alineado con la primera línea (el código): el chevron queda a la altura del texto, no a mitad de la fila
  toggle: { width: 32, height: 22, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, gap: 4, minHeight: 44, justifyContent: 'center' },
  codeLine: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' },
});
