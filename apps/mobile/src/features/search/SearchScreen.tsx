import { BUSQUEDA_DYNAMIC_TESTIDS, BUSQUEDA_TESTIDS, MOVIL_SEARCH_DYNAMIC_TESTIDS, MOVIL_SEARCH_TESTIDS, MOVIL_TESTIDS, PROGRAMAS_TESTIDS, type MessageKey, type SearchGroupDto, type SearchGroupKind, type SearchItemDto } from '@sigpro/shared';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useI18n } from '../../state/i18n';
import { useTheme } from '../../state/theme';
import { SPACING } from '../../theme/tokens';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { Screen } from '../../ui/Screen';
import { Text } from '../../ui/Text';
import { TextField } from '../../ui/TextField';
import { useGlobalSearch } from './useGlobalSearch';
import { groupTotalText, hiddenCount, mobileHref, summaryKey, type SearchView } from './view';

interface ResultItemProps {
  readonly kind: SearchGroupKind;
  readonly item: SearchItemDto;
  readonly onOpen: (kind: SearchGroupKind, item: SearchItemDto) => void;
}

/** Un resultado: código en mono, subtítulo (responsable o programa) y el título. Tocarlo abre su pantalla. */
const ResultItem = ({ kind, item, onOpen }: ResultItemProps) => {
  const { colors } = useTheme();
  return (
    <Pressable
      testID={BUSQUEDA_DYNAMIC_TESTIDS.GLOBAL_SEARCH_ITEM(kind, item.id)}
      role="link"
      aria-label={[item.id, item.title, item.subtitle].filter(Boolean).join(' · ')}
      onPress={() => onOpen(kind, item)}
      style={({ pressed }) => [styles.item, { backgroundColor: pressed ? colors.accentSoft : 'transparent' }]}
    >
      <View style={styles.itemTop}>
        <Text variant="mono" tone="muted">
          {item.id}
        </Text>
        <Text variant="small" tone="faint" numberOfLines={1} style={styles.subtitle}>
          {item.subtitle}
        </Text>
      </View>
      <Text variant="body" numberOfLines={2}>
        {item.title}
      </Text>
    </Pressable>
  );
};

/** Un grupo (programas, requisitos, casos de prueba, NC o documentos): encabezado con su total, los ítems y, si hay más, el «N más». */
const ResultGroup = ({ group, onOpen }: { readonly group: SearchGroupDto; readonly onOpen: ResultItemProps['onOpen'] }) => {
  const { t } = useI18n();
  const label = t('busqueda', `group_${group.kind}` as MessageKey<'busqueda'>);
  const hidden = hiddenCount(group);
  return (
    <Card role="group" aria-label={label} testID={BUSQUEDA_DYNAMIC_TESTIDS.GLOBAL_SEARCH_GROUP(group.kind)} style={styles.group}>
      <View style={styles.groupHeader}>
        <Text variant="label" tone="faint" role="heading" aria-level={2}>
          {label}
        </Text>
        <Text variant="mono" tone="faint" testID={BUSQUEDA_DYNAMIC_TESTIDS.GLOBAL_SEARCH_GROUP_TOTAL(group.kind)}>
          {groupTotalText(group)}
        </Text>
      </View>
      {group.items.map((item) => (
        <ResultItem key={item.id} kind={group.kind} item={item} onOpen={onOpen} />
      ))}
      {hidden > 0 ? (
        <Text variant="small" tone="faint" testID={MOVIL_SEARCH_DYNAMIC_TESTIDS.GROUP_MORE(group.kind)}>
          {t('busqueda', 'moreInGroup', { count: hidden })}
        </Text>
      ) : null}
    </Card>
  );
};

/**
 * `/search` (desde «Más»): la búsqueda global de la cabecera de la web como pantalla propia. Campo con retraso de 250 ms y
 * mínimo de 2 caracteres, resultados agrupados con los mismos nombres y totales (`5 / 24`) y un único aviso de estado
 * (mínimo, «Buscando…», error con reintento, vacío o recuento). Tocar un resultado abre su pantalla.
 */
export const SearchScreen = () => {
  const { t } = useI18n();
  const router = useRouter();
  const [text, setText] = useState('');
  const { view, retry } = useGlobalSearch(text);

  // Como la web (que vacía el campo al navegar): al salir de la pantalla, por un resultado o por otra pestaña, se borra lo escrito
  useFocusEffect(useCallback(() => () => setText(''), []));
  const loading = view.kind === 'loading';

  const open = (kind: SearchGroupKind, item: SearchItemDto) => {
    const href = mobileHref(kind, item);
    if (href) router.push(href);
  };

  // Un único mensaje de estado (región `aria-live`): el mínimo, la carga, el error, el vacío o el recuento
  const message = (current: SearchView): { readonly testID: string | undefined; readonly text: string } => {
    if (current.kind === 'hint') return { testID: undefined, text: t('busqueda', 'minChars') };
    if (current.kind === 'loading') return { testID: BUSQUEDA_TESTIDS.GLOBAL_SEARCH_LOADING, text: t('busqueda', 'searching') };
    if (current.kind === 'error') return { testID: BUSQUEDA_TESTIDS.GLOBAL_SEARCH_ERROR, text: t('busqueda', 'error') };
    if (current.kind === 'empty') return { testID: BUSQUEDA_TESTIDS.GLOBAL_SEARCH_EMPTY, text: t('busqueda', 'empty', { query: current.query }) };
    const key = summaryKey(current.count);
    return { testID: undefined, text: key === 'summaryOne' ? t('busqueda', 'summaryOne') : t('busqueda', 'summary', { count: current.count, groups: current.groups.length }) };
  };
  const status = message(view);

  // Sin nada escrito solo hay la pista (la web no abre el popover hasta que se teclea algo)
  const panel =
    text.trim() === '' ? (
      <Text variant="small" tone="muted">
        {t('busqueda', 'minChars')}
      </Text>
    ) : (
      <View testID={BUSQUEDA_TESTIDS.GLOBAL_SEARCH_RESULTS} aria-busy={loading} style={styles.results}>
        {view.kind === 'results' ? (
          <View testID={BUSQUEDA_TESTIDS.GLOBAL_SEARCH_LIST} role="list" aria-label={t('busqueda', 'listLabel')} style={styles.list}>
            {view.groups.map((group) => (
              <ResultGroup key={group.kind} group={group} onOpen={open} />
            ))}
          </View>
        ) : null}
        <View role="status" aria-live="polite" testID={BUSQUEDA_TESTIDS.GLOBAL_SEARCH_STATUS}>
          <Text variant="small" tone={view.kind === 'error' ? 'danger' : 'muted'} testID={status.testID}>
            {status.text}
          </Text>
        </View>
        {view.kind === 'error' ? <Button label={t('programas', 'retry')} testID={MOVIL_SEARCH_TESTIDS.ERROR_RETRY} onPress={retry} /> : null}
      </View>
    );

  return (
    <Screen title={t('programas', 'globalSearch')} testID={MOVIL_TESTIDS.SEARCH_PAGE}>
      <TextField
        label={t('programas', 'globalSearch')}
        testID={PROGRAMAS_TESTIDS.LAYOUT_SEARCH}
        value={text}
        onChangeText={setText}
        placeholder={t('programas', 'searchPlaceholder')}
        autoCapitalize="none"
        autoCorrect={false}
        autoFocus
        returnKeyType="search"
      />
      {panel}
    </Screen>
  );
};

const styles = StyleSheet.create({
  results: { gap: SPACING.md },
  list: { gap: SPACING.md },
  group: { gap: 2, paddingHorizontal: SPACING.sm },
  groupHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.sm, paddingTop: SPACING.xs },
  item: { minHeight: 44, justifyContent: 'center', gap: 2, paddingHorizontal: SPACING.sm, paddingVertical: SPACING.sm, borderRadius: 8 },
  itemTop: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: SPACING.sm },
  subtitle: { flex: 1, textAlign: 'right' },
});
