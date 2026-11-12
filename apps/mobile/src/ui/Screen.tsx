import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../state/theme';
import { SPACING } from '../theme/tokens';
import { Text } from './Text';

interface Props {
  readonly title: string;
  readonly subtitle?: string;
  readonly testID: string;
  /** Contenido a la derecha del título (un botón, un indicador de conexión…). */
  readonly right?: ReactNode;
  /** `false` si el contenido gestiona su propio scroll (una `FlatList`, un tablero horizontal). */
  readonly scroll?: boolean;
  readonly children: ReactNode;
}

/** Pantalla: zona segura, título (`role="heading"`, nivel 1) y contenido con scroll opcional. */
export const Screen = ({ title, subtitle, testID, right, scroll = true, children }: Props) => {
  const { colors } = useTheme();
  const header = (
    <View style={styles.header}>
      <View style={styles.headerText}>
        <Text variant="title" role="heading" aria-level={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text variant="small" tone="muted">
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right}
    </View>
  );
  return (
    <SafeAreaView testID={testID} edges={['top']} style={[styles.root, { backgroundColor: colors.bg }]}>
      {scroll ? (
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {header}
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.content, styles.fill]}>
          {header}
          {children}
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  fill: { flex: 1 },
  content: { padding: SPACING.page, gap: SPACING.block },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  headerText: { flex: 1, gap: 2 },
});
