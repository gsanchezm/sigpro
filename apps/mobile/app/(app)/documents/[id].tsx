import { MOVIL_TESTIDS } from '@sigpro/shared';
import { Screen } from '../../../src/ui/Screen';
import { Text } from '../../../src/ui/Text';

// TODO(T33): pantalla pendiente de implementar.
export default function Page() {
  return (
    <Screen title="Documento" testID={MOVIL_TESTIDS.DOCUMENT_DETAIL_PAGE}>
      <Text>…</Text>
    </Screen>
  );
}
