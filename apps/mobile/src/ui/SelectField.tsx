import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useTheme } from '../state/theme';
import { RADIUS } from '../theme/tokens';
import { Sheet } from './Sheet';
import { Text } from './Text';

export interface SelectOption<T extends string> {
  readonly value: T;
  readonly label: string;
}

interface Props<T extends string> {
  /** Etiqueta visible y nombre accesible del campo (`getByLabel`). */
  readonly label: string;
  readonly value: T;
  readonly options: readonly SelectOption<T>[];
  readonly onChange: (value: T) => void;
  /** `data-testid` del campo; el diálogo es `<testID>-dialog` y cada opción `<testID>-option-<valor>`. */
  readonly testID: string;
  readonly disabled?: boolean;
  /** Motivo si está deshabilitado (se muestra como texto, regla de testabilidad). */
  readonly disabledReason?: string;
  readonly error?: string;
  /** `data-testid` del mensaje de error (el de la web, p. ej. `nc-new-program-error`). */
  readonly errorTestID?: string;
}

/**
 * Selector de una opción (el `<select>` de la web): un campo que muestra el valor y abre una hoja con las opciones como
 * `radio` (`aria-checked`) dentro de un `radiogroup`. Tocar una opción la elige y cierra la hoja.
 */
export const SelectField = <T extends string>({ label, value, options, onChange, testID, disabled = false, disabledReason, error, errorTestID }: Props<T>) => {
  const { colors } = useTheme();
  const { height } = useWindowDimensions();
  const [open, setOpen] = useState(false);
  const current = options.find((option) => option.value === value);
  // La hoja tiene altura máxima: con muchas opciones (p. ej. todos los requisitos del programa) la lista hace scroll dentro
  const listHeight = Math.max(200, height * 0.5);

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
        <Text variant="body" style={styles.value} numberOfLines={1}>
          {current?.label ?? ''}
        </Text>
        <Text variant="body" tone="muted" aria-hidden>
          ▾
        </Text>
      </Pressable>
      {disabled && disabledReason ? (
        <Text variant="small" tone="faint">
          {disabledReason}
        </Text>
      ) : null}
      {error ? (
        <Text variant="small" tone="danger" role="alert" testID={errorTestID}>
          {error}
        </Text>
      ) : null}
      <Sheet visible={open} title={label} onClose={() => setOpen(false)} testID={`${testID}-dialog`}>
        <ScrollView style={{ maxHeight: listHeight }} keyboardShouldPersistTaps="handled">
          <View role="radiogroup" aria-label={label} style={styles.options}>
            {options.map((option) => {
              const selected = option.value === value;
              return (
                <Pressable
                  key={option.value}
                  testID={`${testID}-option-${option.value}`}
                  role="radio"
                  aria-label={option.label}
                  aria-checked={selected}
                  onPress={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                  style={[styles.option, { backgroundColor: selected ? colors.accentSoft : colors.surface2 }]}
                >
                  <Text variant="label" tone={selected ? 'accent' : 'default'}>
                    {option.label}
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
  option: { minHeight: 44, justifyContent: 'center', borderRadius: RADIUS.md, paddingHorizontal: 12 },
});
