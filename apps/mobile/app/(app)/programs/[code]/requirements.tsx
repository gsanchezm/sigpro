import { REQUISITOS_TESTIDS } from '@sigpro/shared';
import { Screen } from '../../../../src/ui/Screen';
import { Text } from '../../../../src/ui/Text';

// TODO(T33): pantalla pendiente de implementar.
export default function Page() {
  return (
    <Screen title="Requisitos" testID={REQUISITOS_TESTIDS.REQUIREMENTS_PAGE}>
      <Text>…</Text>
    </Screen>
  );
}
