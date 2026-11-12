import { PROGRAMAS_DYNAMIC_TESTIDS, type OwnerDto } from '@sigpro/shared';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useTheme } from '../../state/theme';
import { RADIUS, SPACING } from '../../theme/tokens';
import { Avatar } from '../../ui/Avatar';
import { Sheet } from '../../ui/Sheet';
import { Text } from '../../ui/Text';
import { TextField } from '../../ui/TextField';
import { filterOwners } from './view';

interface Props {
  /** Etiqueta visible y nombre accesible del campo (`getByLabel`). */
  readonly label: string;
  /** Id del responsable elegido, o `''`. */
  readonly value: string;
  readonly owners: readonly OwnerDto[];
  readonly onChange: (ownerId: string) => void;
  /** `data-testid` del campo. La hoja es `<testID>-dialog`, el buscador `<testID>-search`, la lista `<testID>-list` y cada persona `<testID>-option-<id>`. */
  readonly testID: string;
  /** `data-testid` del mensaje de error. */
  readonly errorTestID: string;
  readonly error?: string;
  /** Texto del campo cuando no hay responsable elegido. */
  readonly placeholder: string;
  /** Nombre del buscador dentro de la hoja. */
  readonly searchLabel: string;
  readonly searchPlaceholder: string;
  /** Mensaje cuando la búsqueda no encuentra a nadie. */
  readonly noMatch: string;
  readonly disabled?: boolean;
}

/**
 * Selector de responsable (el combobox de la web): un campo que muestra la persona elegida y abre una hoja con un buscador y
 * la lista de personas del tenant (`api.users.owners`). La persona elegida aparece como `radio` marcado. Tocarla la elige y
 * cierra la hoja.
 */
export const OwnerPicker = ({ label, value, owners, onChange, testID, errorTestID, error, placeholder, searchLabel, searchPlaceholder, noMatch, disabled = false }: Props) => {
  const { colors } = useTheme();
  const { height } = useWindowDimensions();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const selected = owners.find((owner) => owner.id === value) ?? null;
  const options = filterOwners(owners, query, value);
  // La hoja tiene altura máxima: la lista hace scroll dentro de ella (como SelectField)
  const listHeight = Math.max(200, height * 0.45);

  const pick = (ownerId: string) => {
    onChange(ownerId);
    setQuery('');
    setOpen(false);
  };

  return (
    <View style={styles.wrap}>
      <Text variant="label" tone="muted">
        {label}
      </Text>
      <Pressable
        testID={testID}
        role="combobox"
        aria-label={label}
        aria-expanded={open}
        aria-disabled={disabled}
        disabled={disabled}
        onPress={() => setOpen(true)}
        style={[styles.field, { backgroundColor: colors.surface, borderColor: error ? colors.danger : colors.borderStrong, opacity: disabled ? 0.5 : 1 }]}
      >
        <Text variant="body" tone={selected ? 'default' : 'faint'} numberOfLines={1} style={styles.value}>
          {selected?.name ?? placeholder}
        </Text>
        <Text variant="body" tone="muted" aria-hidden>
          ▾
        </Text>
      </Pressable>
      {error ? (
        <Text variant="small" tone="danger" role="alert" testID={errorTestID}>
          {error}
        </Text>
      ) : null}

      <Sheet visible={open} title={label} onClose={() => setOpen(false)} testID={`${testID}-dialog`}>
        <TextField
          label={searchLabel}
          placeholder={searchPlaceholder}
          testID={`${testID}-search`}
          value={query}
          onChangeText={setQuery}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
        />
        <ScrollView style={{ maxHeight: listHeight }} keyboardShouldPersistTaps="handled">
          <View role="radiogroup" aria-label={label} testID={`${testID}-list`} style={styles.options}>
            {options.length === 0 ? (
              <Text variant="small" tone="muted">
                {noMatch}
              </Text>
            ) : null}
            {options.map((owner) => {
              const chosen = owner.id === value;
              return (
                <Pressable
                  key={owner.id}
                  testID={PROGRAMAS_DYNAMIC_TESTIDS.COMBOBOX_OPTION(testID, owner.id)}
                  role="radio"
                  aria-label={owner.name}
                  aria-checked={chosen}
                  onPress={() => pick(owner.id)}
                  style={[styles.option, { backgroundColor: chosen ? colors.accentSoft : colors.surface2 }]}
                >
                  <Avatar name={owner.name} size={24} />
                  <Text variant="label" tone={chosen ? 'accent' : 'default'} style={styles.grow}>
                    {owner.name}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
      </Sheet>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { gap: 4 },
  field: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: RADIUS.md, paddingHorizontal: 12 },
  value: { flex: 1 },
  options: { gap: 6 },
  option: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, borderRadius: RADIUS.md, paddingHorizontal: 12 },
  grow: { flex: 1 },
});
