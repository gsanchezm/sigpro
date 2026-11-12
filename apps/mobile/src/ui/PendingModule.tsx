import { Screen } from './Screen';
import { Text } from './Text';

/** Marcador temporal de un módulo de la web que el móvil todavía no tiene: se sustituye por la pantalla real. */
export const PendingModule = ({ title, testID }: { readonly title: string; readonly testID: string }) => (
  <Screen title={title} testID={testID}>
    <Text variant="body" tone="muted">
      …
    </Text>
  </Screen>
);
