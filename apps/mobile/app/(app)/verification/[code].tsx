import { useLocalSearchParams } from 'expo-router';
import { TestCaseDetailScreen } from '../../../src/features/verification/TestCaseDetailScreen';
import { firstParam } from '../../../src/features/verification/params';

/** `/verification/:code`: detalle de un caso de prueba. `?run=1` lleva el scroll al formulario «Registrar ejecución». La `key` reinicia el formulario al cambiar de caso. */
export default function TestCaseRoute() {
  const params = useLocalSearchParams<{ code: string; run?: string }>();
  const code = firstParam(params.code) ?? '';
  return <TestCaseDetailScreen key={code} code={code} focusRun={firstParam(params.run) === '1'} />;
}
