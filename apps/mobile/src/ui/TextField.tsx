import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';
import { useTheme } from '../state/theme';
import { FONT_FAMILY } from '../theme/fonts';
import { RADIUS } from '../theme/tokens';
import { Text } from './Text';

interface Props
  extends Pick<TextInputProps, 'value' | 'onChangeText' | 'placeholder' | 'secureTextEntry' | 'keyboardType' | 'autoCapitalize' | 'autoCorrect' | 'maxLength' | 'multiline' | 'onSubmitEditing' | 'returnKeyType' | 'editable' | 'onFocus' | 'onBlur'> {
  /** Etiqueta visible y nombre accesible del campo (`getByLabel`). Distinta del placeholder. */
  readonly label: string;
  readonly testID: string;
  readonly error?: string;
  readonly errorTestID?: string;
}

/** Campo de texto con etiqueta visible, `aria-label` y mensaje de error en `role="alert"`. */
export const TextField = ({ label, testID, error, errorTestID, multiline, ...input }: Props) => {
  const { colors } = useTheme();
  return (
    <View style={styles.wrap}>
      <Text variant="label" tone="muted">
        {label}
      </Text>
      <TextInput
        {...input}
        testID={testID}
        aria-label={label}
        aria-invalid={error ? true : undefined}
        multiline={multiline}
        placeholderTextColor={colors.text3}
        style={[
          styles.input,
          multiline ? styles.multiline : null,
          { backgroundColor: colors.surface, borderColor: error ? colors.danger : colors.borderStrong, color: colors.text },
        ]}
      />
      {error ? (
        <Text variant="small" tone="danger" role="alert" testID={errorTestID}>
          {error}
        </Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { gap: 4 },
  input: { minHeight: 44, borderWidth: 1, borderRadius: RADIUS.md, paddingHorizontal: 12, fontSize: 14, fontFamily: FONT_FAMILY.regular },
  multiline: { minHeight: 88, paddingTop: 10, textAlignVertical: 'top' },
});
