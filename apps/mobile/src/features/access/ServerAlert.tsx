import type { AuthErrorView } from '@sigpro/shared';
import { StyleSheet, View } from 'react-native';
import { useTheme } from '../../state/theme';
import { RADIUS } from '../../theme/tokens';
import { Text } from '../../ui/Text';

interface Props {
  readonly error: AuthErrorView;
  /** `data-testid` de la web (`login-error`, `mfa-error`, `register-error`). */
  readonly testID: string;
}

/** Aviso de error del servidor (`role="alert"`): título traducido y, debajo, la traza HTTP en mono. */
export const ServerAlert = ({ error, testID }: Props) => {
  const { colors } = useTheme();
  return (
    <View testID={testID} role="alert" style={[styles.box, { backgroundColor: colors.dangerSoft, borderColor: colors.danger }]}>
      <Text variant="label" tone="danger">
        {error.title}
      </Text>
      {error.trace ? (
        <Text variant="mono" tone="muted">
          {error.trace}
        </Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  box: { borderWidth: 1, borderRadius: RADIUS.sm, padding: 10, gap: 2 },
});
