import { useLocalSearchParams } from 'expo-router';
import { RequirementsPage } from '../../../../src/features/requirements/RequirementsPage';

/** `/programs/:code/requirements`. La `key` reinicia búsqueda, plegado y selección al cambiar de programa. `?select=REQ-017` (enlace desde Verificación) abre el detalle de ese requisito. */
export default function Page() {
  const params = useLocalSearchParams<{ code: string; select?: string }>();
  const code = typeof params.code === 'string' ? params.code : '';
  const select = typeof params.select === 'string' ? params.select : undefined;
  return <RequirementsPage key={code} programCode={code} initialSelect={select} />;
}
