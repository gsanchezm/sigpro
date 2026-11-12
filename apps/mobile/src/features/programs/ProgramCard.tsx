import { PROGRAMAS_DYNAMIC_TESTIDS, PROGRAMAS_TESTIDS, formatDate, formatMoney, toProgressTitle, type ProgramDto } from '@sigpro/shared';
import { Pressable, StyleSheet, View } from 'react-native';
import { useI18n, useTexts } from '../../state/i18n';
import { useTheme } from '../../state/theme';
import { RADIUS } from '../../theme/tokens';
import { Avatar } from '../../ui/Avatar';
import { Card } from '../../ui/Card';
import { ProgressBar } from '../../ui/ProgressBar';
import { Text } from '../../ui/Text';
import { PROGRAMS_TEXTS } from './texts';
import { ProgramStatusBadge } from './ProgramStatusBadge';

interface Props {
  readonly program: ProgramDto;
  /** Modo selección: la tarjeta muestra una casilla y tocarla marca o desmarca el programa en lugar de abrirlo. */
  readonly selectMode: boolean;
  readonly selected: boolean;
  readonly onOpen: (code: string) => void;
  readonly onToggle: (code: string) => void;
  /** Abre el menú ⋯ de la fila (acciones: abrir, editar, duplicar, archivar, eliminar). */
  readonly onMenu: (code: string) => void;
}

/**
 * Tarjeta de programa. El `listitem` lleva el id de la fila y el código como nombre. El cuerpo es un enlace (tocarlo abre el
 * detalle, o marca la casilla en modo selección) y, a la derecha, el botón ⋯ que abre el menú de la fila (como `RowMenu`).
 */
export const ProgramCard = ({ program, selectMode, selected, onOpen, onToggle, onMenu }: Props) => {
  const { t, lang } = useI18n();
  const texts = useTexts(PROGRAMS_TEXTS);
  const { colors } = useTheme();
  const { code, name, ownerName, progress, budgetEur, startDate, endDate, status } = program;
  const press = () => (selectMode ? onToggle(code) : onOpen(code));

  return (
    <Card role="listitem" aria-label={code} testID={PROGRAMAS_DYNAMIC_TESTIDS.PROGRAMS_ROW(code)} style={[styles.item, selectMode && selected ? { borderColor: colors.accent } : null]}>
      <View style={styles.top}>
        {selectMode ? (
          <Pressable
            role="checkbox"
            aria-label={`${texts.selectOne} ${code}`}
            aria-checked={selected}
            testID={PROGRAMAS_DYNAMIC_TESTIDS.PROGRAMS_SELECT(code)}
            onPress={() => onToggle(code)}
            style={styles.check}
          >
            <View style={[styles.box, { borderColor: selected ? colors.accent : colors.borderStrong, backgroundColor: selected ? colors.accent : colors.surface }]}>
              {selected ? (
                <Text variant="small" weight="600" tone="onAccent" aria-hidden>
                  ✓
                </Text>
              ) : null}
            </View>
          </Pressable>
        ) : null}

        <Pressable role="link" aria-label={`${code} · ${name}`} onPress={press} style={({ pressed }) => [styles.press, pressed ? styles.pressed : null]}>
          <View style={styles.row}>
            <Text variant="mono" tone="muted" aria-hidden>
              {code}
            </Text>
            <ProgramStatusBadge status={status} testID={PROGRAMAS_TESTIDS.PROGRAMS_STATE_BADGE} />
          </View>
          <Text variant="heading">{name}</Text>
          <View style={styles.row}>
            <Avatar name={ownerName} size={24} />
            <Text variant="small" tone="muted" style={styles.grow}>
              {ownerName}
            </Text>
          </View>
          <View style={styles.row}>
            <View style={styles.grow}>
              <ProgressBar value={progress} label={toProgressTitle(progress, lang)} />
            </View>
            <Text variant="small" tone="muted" aria-hidden>
              {t('hitos', 'progressText', { value: progress })}
            </Text>
          </View>
          <Text variant="small" tone="muted">
            {`${formatMoney(budgetEur, lang)} · ${formatDate(startDate, lang)} → ${formatDate(endDate, lang)}`}
          </Text>
        </Pressable>

        <Pressable
          role="button"
          aria-label={t('common', 'actionsFor', { code })}
          testID={PROGRAMAS_DYNAMIC_TESTIDS.PROGRAMS_ROW_MENU(code)}
          onPress={() => onMenu(code)}
          style={({ pressed }) => [styles.menu, { borderColor: colors.border, backgroundColor: pressed ? colors.surface2 : colors.surface }]}
        >
          <Text variant="heading" tone="muted" aria-hidden>
            ⋯
          </Text>
        </Pressable>
      </View>
    </Card>
  );
};

const styles = StyleSheet.create({
  item: { padding: 0, gap: 0, overflow: 'hidden' },
  top: { flexDirection: 'row', alignItems: 'center' },
  press: { flex: 1, padding: 16, gap: 10 },
  pressed: { opacity: 0.85 },
  check: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center', paddingLeft: 12 },
  box: { width: 20, height: 20, borderRadius: 6, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  menu: { width: 44, height: 44, borderWidth: 1, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  grow: { flex: 1 },
});
