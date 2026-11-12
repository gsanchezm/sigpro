import { useLocalSearchParams } from 'expo-router';
import { ProgramEditScreen } from '../../../../src/features/programs/ProgramEditScreen';
import { firstParam } from '../../../../src/features/programs/params';

/** `/programs/:code/edit`: edición de un programa (mismos campos y validaciones que el alta, como la web). */
export default function Page() {
  const { code } = useLocalSearchParams<{ code: string }>();
  return <ProgramEditScreen code={firstParam(code) ?? ''} />;
}
