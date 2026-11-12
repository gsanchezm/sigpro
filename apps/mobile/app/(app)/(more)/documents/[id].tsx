import { useLocalSearchParams } from 'expo-router';
import { DocumentDetailPage } from '../../../../src/features/documents/DocumentDetailPage';

/** `/documents/:id`. La `key` reinicia la versión elegida al cambiar de documento. */
export default function Page() {
  const params = useLocalSearchParams<{ id: string }>();
  const id = typeof params.id === 'string' ? params.id : '';
  return <DocumentDetailPage key={id} id={id} />;
}
