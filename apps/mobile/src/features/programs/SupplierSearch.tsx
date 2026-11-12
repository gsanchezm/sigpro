import { PROVEEDORES_DYNAMIC_TESTIDS, PROVEEDORES_TESTIDS, formatTrace, type SupplierDto } from '@sigpro/shared';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useAuth } from '../../state/auth';
import { useI18n } from '../../state/i18n';
import { useTheme } from '../../state/theme';
import { RADIUS, SPACING } from '../../theme/tokens';
import { Button } from '../../ui/Button';
import { Text } from '../../ui/Text';
import { TextField } from '../../ui/TextField';
import { SEARCH_DEBOUNCE_MS } from './params';
import { approvalState, limitOptions } from './supplier-view';

type SearchState = { readonly status: 'loading' } | { readonly status: 'ready'; readonly items: readonly SupplierDto[] } | { readonly status: 'error'; readonly trace: string };

interface Props {
  readonly selected: SupplierDto | null;
  readonly onSelect: (supplier: SupplierDto | null) => void;
}

/**
 * Buscador de proveedores del tenant (el combobox «Buscar proveedor…» de la web): pide al servidor los que cumplen el texto
 * (`GET /api/suppliers?q=`, 250 ms de espera tras teclear), enseña como mucho 5 y avisa de los que sobran. Al tocar una opción
 * queda elegida y se muestra su ficha; «Quitar» la borra.
 */
export const SupplierSearch = ({ selected, onSelect }: Props) => {
  const { t } = useI18n();
  const { api } = useAuth();
  const { colors } = useTheme();
  const [text, setText] = useState('');
  const [open, setOpen] = useState(false);
  const [debounced, setDebounced] = useState('');
  const [state, setState] = useState<SearchState>({ status: 'loading' });
  const typing = text.trim() !== debounced;

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(text.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [text]);

  // La petición va al servidor cuando la lista está abierta y el texto lleva 250 ms quieto
  useEffect(() => {
    if (!open || selected) return;
    let alive = true;
    setState({ status: 'loading' });
    api.suppliers.list({ q: debounced }).then(
      (items) => {
        if (alive) setState({ status: 'ready', items });
      },
      (error: unknown) => {
        if (alive) setState({ status: 'error', trace: formatTrace(error) || t('common', 'networkError') });
      },
    );
    return () => {
      alive = false;
    };
  }, [api, open, selected, debounced, t]);

  const ready = state.status === 'ready' && !typing ? state.items : [];
  const { shown, hidden } = limitOptions(ready);
  const showList = open && !selected && shown.length > 0;
  const loading = state.status === 'loading' || typing;

  const status = ((): string => {
    if (!open || selected) return '';
    if (loading) return t('proveedores', 'searching');
    if (state.status === 'error') return t('proveedores', 'searchError');
    if (shown.length === 0) return t('proveedores', 'noMatches');
    const count = ready.length;
    const summary = count === 1 ? t('proveedores', 'resultsOne') : t('proveedores', 'results', { count });
    return hidden > 0 ? `${summary} · ${t('proveedores', 'moreResults', { count: hidden })}` : summary;
  })();

  const pick = (supplier: SupplierDto) => {
    onSelect(supplier);
    setText('');
    setOpen(false);
  };

  const clear = () => {
    onSelect(null);
    setText('');
  };

  return (
    <View style={styles.wrap}>
      <TextField
        label={t('proveedores', 'searchLabel')}
        placeholder={t('proveedores', 'searchPlaceholder')}
        testID={PROVEEDORES_TESTIDS.SUPPLIER_SEARCH}
        value={selected ? selected.name : text}
        onChangeText={(value) => {
          setText(value);
          if (selected) onSelect(null);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        autoCorrect={false}
        autoCapitalize="none"
        returnKeyType="search"
      />
      {selected ? (
        <Button label={t('proveedores', 'clear')} testID={PROVEEDORES_TESTIDS.SUPPLIER_SEARCH_CLEAR} variant="ghost" onPress={clear} />
      ) : null}

      {open && !selected ? (
        <View style={[styles.results, { borderColor: colors.border, backgroundColor: colors.surface }]}>
          {showList ? (
            <View role="list" aria-label={t('proveedores', 'listLabel')} testID={PROVEEDORES_TESTIDS.SUPPLIER_SEARCH_LIST} style={styles.options}>
              {shown.map((supplier) => (
                <Pressable
                  key={supplier.id}
                  role="option"
                  aria-label={supplier.name}
                  aria-selected={false}
                  testID={PROVEEDORES_DYNAMIC_TESTIDS.SUPPLIER_OPTION(supplier.id)}
                  dataSet={{ state: approvalState(supplier) }}
                  onPress={() => pick(supplier)}
                  style={[styles.option, { backgroundColor: colors.surface2 }]}
                >
                  <Text variant="label" style={styles.grow} numberOfLines={1}>
                    {supplier.name}
                  </Text>
                  <Text variant="small" tone="faint">
                    {supplier.nif}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}
          <Text variant="small" tone="faint" role="status" aria-live="polite" testID={PROVEEDORES_TESTIDS.SUPPLIER_SEARCH_STATUS}>
            {status}
          </Text>
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { gap: SPACING.xs },
  results: { borderWidth: 1, borderRadius: RADIUS.md, padding: SPACING.xs, gap: SPACING.xs },
  options: { gap: 4 },
  option: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, borderRadius: RADIUS.md, paddingHorizontal: 10 },
  grow: { flex: 1 },
});
