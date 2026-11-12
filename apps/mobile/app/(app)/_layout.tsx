import { MOVIL_TESTIDS, PROGRAMAS_DYNAMIC_TESTIDS } from '@sigpro/shared';
import { Redirect, Tabs } from 'expo-router';
import type { ColorValue } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../src/state/auth';
import { useI18n, useTexts } from '../../src/state/i18n';
import { useTheme } from '../../src/state/theme';
import { FONT_FAMILY } from '../../src/theme/fonts';
import { LoadingState } from '../../src/ui/States';
import { Text } from '../../src/ui/Text';

/** Glyph de una letra por pestaña (como el menú de la web): sin dependencias de iconos. */
const Glyph = ({ glyph, color }: { readonly glyph: string; readonly color: ColorValue }) => (
  <Text variant="label" style={{ color }} aria-hidden>
    {glyph}
  </Text>
);

// Etiquetas visibles más cortas que el nombre accesible: «Panel de misión» no cabe en una pestaña de 390 px
const SHORT_LABELS = {
  es: { mission: 'Misión', nc: 'NC' },
  en: { mission: 'Mission', nc: 'NC' },
};

/**
 * Zona autenticada: sin sesión redirige a /login. Pestañas inferiores = las rutas de la web
 * (`/programs`, `/nc`, `/mission`, `/documents`, `/profile`). No existe /admin en móvil.
 */
export default function AppLayout() {
  const { status } = useAuth();
  const { t } = useI18n();
  const { colors } = useTheme();
  const short = useTexts(SHORT_LABELS);
  const insets = useSafeAreaInsets();

  if (status === 'loading') return <LoadingState testID={MOVIL_TESTIDS.SPLASH} />;
  if (status === 'anonymous') return <Redirect href="/login" />;

  const tab = (name: string, key: string, label: string, glyph: string, shortLabel: string = label) => (
    <Tabs.Screen
      name={name}
      options={{
        title: label,
        tabBarLabel: shortLabel,
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
        // Altura explícita (icono de 28 px + etiqueta + relleno del ítem) más la zona segura inferior: con la de por defecto la etiqueta se encogía y se recortaba
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border, height: 72 + insets.bottom, paddingTop: 4, paddingBottom: 4 + insets.bottom },
        // `lineHeight` explícito: con el de por defecto la caja de la etiqueta mide menos que la fuente y la recorta
        tabBarLabelStyle: { fontSize: 11, lineHeight: 14, fontFamily: FONT_FAMILY.medium },
        sceneStyle: { backgroundColor: colors.bg },
        tabBarButtonTestID: MOVIL_TESTIDS.MOBILE_TABS,
      }}
    >
      {tab('programs', 'programs', t('programas', 'nav_programs'), 'P')}
      {tab('nc', 'nc', t('programas', 'nav_nc'), '⚠', short.nc)}
      {tab('mission', 'mission', t('programas', 'nav_mission'), 'M', short.mission)}
      {tab('documents', 'documents', t('programas', 'nav_documents'), 'D')}
      {tab('profile', 'profile', t('programas', 'profile'), '☺')}
    </Tabs>
  );
}
