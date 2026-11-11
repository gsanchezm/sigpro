import { MOVIL_TESTIDS, PROGRAMAS_DYNAMIC_TESTIDS } from '@sigpro/shared';
import { Redirect, Tabs } from 'expo-router';
import type { ColorValue } from 'react-native';
import { useAuth } from '../../src/state/auth';
import { useI18n } from '../../src/state/i18n';
import { useTheme } from '../../src/state/theme';
import { LoadingState } from '../../src/ui/States';
import { Text } from '../../src/ui/Text';

/** Glyph de una letra por pestaña (como el menú de la web): sin dependencias de iconos. */
const Glyph = ({ glyph, color }: { readonly glyph: string; readonly color: ColorValue }) => (
  <Text variant="label" style={{ color }} aria-hidden>
    {glyph}
  </Text>
);

/**
 * Zona autenticada: sin sesión redirige a /login. Pestañas inferiores = las rutas de la web
 * (`/programs`, `/nc`, `/mission`, `/documents`, `/profile`). No existe /admin en móvil.
 */
export default function AppLayout() {
  const { status } = useAuth();
  const { t } = useI18n();
  const { colors } = useTheme();

  if (status === 'loading') return <LoadingState testID={MOVIL_TESTIDS.SPLASH} />;
  if (status === 'anonymous') return <Redirect href="/login" />;

  const tab = (name: string, key: string, label: string, glyph: string) => (
    <Tabs.Screen
      name={name}
      options={{
        title: label,
        tabBarLabel: label,
        tabBarAccessibilityLabel: label,
        tabBarButtonTestID: PROGRAMAS_DYNAMIC_TESTIDS.MOBILE_TAB(key),
        tabBarIcon: ({ color }) => <Glyph glyph={glyph} color={color} />,
      }}
    />
  );

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.text3,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
        tabBarLabelStyle: { fontSize: 11 },
        sceneStyle: { backgroundColor: colors.bg },
        tabBarButtonTestID: MOVIL_TESTIDS.MOBILE_TABS,
      }}
    >
      {tab('programs', 'programs', t('programas', 'nav_programs'), 'P')}
      {tab('nc', 'nc', t('programas', 'nav_nc'), 'NC')}
      {tab('mission', 'mission', t('programas', 'nav_mission'), 'M')}
      {tab('documents', 'documents', t('programas', 'nav_documents'), 'D')}
      {tab('profile', 'profile', t('programas', 'profile'), '☺')}
    </Tabs>
  );
}
