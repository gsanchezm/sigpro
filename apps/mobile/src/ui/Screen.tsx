import type { ReactNode, Ref } from 'react';
import { ScrollView, StyleSheet, View, type NativeScrollEvent, type NativeSyntheticEvent, type ScrollViewInstance } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { isNearEnd, SCROLL_EVENT_THROTTLE_MS } from '../lib/scroll';
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
  /** Referencia al `ScrollView` de la pantalla (para llevar el scroll a una sección, p. ej. «Registrar ejecución»). */
  readonly scrollRef?: Ref<ScrollViewInstance>;
  /** Se llama cada vez que el scroll llega cerca del final (carga continua de listas largas). Solo con `scroll`. */
  readonly onNearEnd?: () => void;
  readonly children: ReactNode;
}

/** Pantalla: zona segura, título (`role="heading"`, nivel 1) y contenido con scroll opcional. */
export const Screen = ({ title, subtitle, testID, right, scroll = true, scrollRef, onNearEnd, children }: Props) => {
  const { colors } = useTheme();
  const handleScroll = onNearEnd
    ? (event: NativeSyntheticEvent<NativeScrollEvent>) => {
        const { contentOffset, layoutMeasurement, contentSize } = event.nativeEvent;
        if (isNearEnd({ offset: contentOffset.y, viewport: layoutMeasurement.height, content: contentSize.height })) onNearEnd();
      }
    : undefined;
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
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          onScroll={handleScroll}
          scrollEventThrottle={handleScroll ? SCROLL_EVENT_THROTTLE_MS : undefined}
        >
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
  header: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  headerText: { flexGrow: 1, flexShrink: 1, flexBasis: 200, gap: 2 },
});
