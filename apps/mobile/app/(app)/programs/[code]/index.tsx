import { useLocalSearchParams } from 'expo-router';
import { ProgramDetailScreen } from '../../../../src/features/programs/ProgramDetailScreen';
import { firstParam } from '../../../../src/features/programs/params';

/** `/programs/:code`: detalle de solo lectura de un programa. */
export default function Page() {
  const { code } = useLocalSearchParams<{ code: string }>();
  return <ProgramDetailScreen code={firstParam(code) ?? ''} />;
}
