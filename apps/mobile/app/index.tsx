import { MOVIL_TESTIDS } from '@sigpro/shared';
import { Redirect } from 'expo-router';
import { useAuth } from '../src/state/auth';
import { LoadingState } from '../src/ui/States';

/** `/` → Programas con sesión; Acceso sin ella (como la web). */
export default function Index() {
  const { status } = useAuth();
  if (status === 'loading') return <LoadingState testID={MOVIL_TESTIDS.SPLASH} />;
  return <Redirect href={status === 'authenticated' ? '/programs' : '/login'} />;
}
