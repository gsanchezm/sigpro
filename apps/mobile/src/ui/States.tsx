import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useI18n } from '../state/i18n';
import { useTheme } from '../state/theme';
import { Button } from './Button';
import { Text } from './Text';

// Estados de toda lista (regla de testabilidad): cargando (`aria-busy`), vacío y error con reintento.

export const LoadingState = ({ testID }: { readonly testID: string }) => {
  const { t } = useI18n();
  const { colors } = useTheme();
  return (
    <View testID={testID} role="status" aria-busy aria-live="polite" aria-label={t('common', 'loading')} style={styles.center}>
      <ActivityIndicator color={colors.accent} />
      <Text variant="small" tone="muted">
        {t('common', 'loading')}
      </Text>
    </View>
  );
};

interface EmptyProps {
  readonly testID: string;
  readonly title: string;
  readonly hint?: string;
  readonly action?: { readonly label: string; readonly testID: string; readonly onPress: () => void };
}

export const EmptyState = ({ testID, title, hint, action }: EmptyProps) => (
  <View testID={testID} role="status" style={styles.center}>
    <Text variant="heading">{title}</Text>
    {hint ? (
      <Text variant="small" tone="muted" style={styles.centerText}>
        {hint}
      </Text>
    ) : null}
    {action ? <Button label={action.label} testID={action.testID} onPress={action.onPress} /> : null}
  </View>
);

interface ErrorProps {
  readonly testID: string;
  readonly retryTestID: string;
  readonly title: string;
  /** Traza HTTP (`GET /api/programs → 503 Service Unavailable · trace 7f3a-c21d`). */
  readonly trace?: string;
  readonly onRetry: () => void;
}

export const ErrorState = ({ testID, retryTestID, title, trace, onRetry }: ErrorProps) => {
  const { t } = useI18n();
  return (
    <View testID={testID} role="alert" style={styles.center}>
      <Text variant="heading" tone="danger">
        {title}
      </Text>
      {trace ? (
        <Text variant="mono" tone="muted" style={styles.centerText}>
          {trace}
        </Text>
      ) : null}
      <Button label={t('programas', 'retry')} testID={retryTestID} onPress={onRetry} />
    </View>
  );
};

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 32, paddingHorizontal: 16 },
  centerText: { textAlign: 'center' },
});
