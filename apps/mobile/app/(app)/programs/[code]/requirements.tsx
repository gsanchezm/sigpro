import { useLocalSearchParams } from 'expo-router';
import { RequirementsPage } from '../../../../src/features/requirements/RequirementsPage';

/** `/programs/:code/requirements`. La `key` reinicia búsqueda, plegado y selección al cambiar de programa. */
export default function Page() {
  const params = useLocalSearchParams<{ code: string }>();
  const code = typeof params.code === 'string' ? params.code : '';
  return <RequirementsPage key={code} programCode={code} />;
}
