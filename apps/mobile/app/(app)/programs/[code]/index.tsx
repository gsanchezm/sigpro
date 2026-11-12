import { useLocalSearchParams } from 'expo-router';
import { ProgramDetailScreen } from '../../../../src/features/programs/ProgramDetailScreen';
import { firstParam } from '../../../../src/features/programs/params';

/** `/programs/:code`: detalle de un programa (resumen, hitos y proveedores; editar desde aquí). */
export default function Page() {
  const { code } = useLocalSearchParams<{ code: string }>();
  return <ProgramDetailScreen code={firstParam(code) ?? ''} />;
}
