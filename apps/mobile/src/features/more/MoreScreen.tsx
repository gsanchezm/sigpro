import { MOVIL_DYNAMIC_TESTIDS, MOVIL_TESTIDS, can } from '@sigpro/shared';
import { useRouter, type Href } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { useAuth } from '../../state/auth';
import { useI18n } from '../../state/i18n';
import { useTheme } from '../../state/theme';
import { RADIUS, SPACING } from '../../theme/tokens';
import { Screen } from '../../ui/Screen';
import { Text } from '../../ui/Text';

interface MoreItem {
  readonly key: string;
  readonly href: Href;
  /** Clave de `programas` con el nombre (el mismo que el menú de la web). */
  readonly label: 'nav_documents' | 'nav_audit' | 'nav_admin' | 'profile';
  readonly visible: (role: Parameters<typeof can>[0]) => boolean;
}

// Lo que la barra inferior no puede alojar. La web lo muestra en la barra lateral; Auditoría solo a quien tiene `audit.view`
// y Administración a quien tiene `users.manage`, con los mismos permisos que la web.
const ITEMS: readonly MoreItem[] = [
  { key: 'documents', href: '/documents', label: 'nav_documents', visible: () => true },
  { key: 'audit', href: '/audit', label: 'nav_audit', visible: (role) => can(role, 'audit.view') },
  { key: 'admin', href: '/admin', label: 'nav_admin', visible: (role) => can(role, 'users.manage') },
  { key: 'profile', href: '/profile', label: 'profile', visible: () => true },
];

/** Pestaña «Más»: Documentos, Auditoría, Administración y Perfil, filtrados por el rol de la sesión. */
export const MoreScreen = () => {
  const { t } = useI18n();
  const { user } = useAuth();
  const { colors } = useTheme();
  const router = useRouter();
  const role = user?.role ?? 'consultant';

  return (
    <Screen title={t('programas', 'nav_more')} testID={MOVIL_TESTIDS.MORE_PAGE}>
      <View role="list" style={styles.list}>
        {ITEMS.filter((item) => item.visible(role)).map((item) => (
          <Pressable
            key={item.key}
            testID={MOVIL_DYNAMIC_TESTIDS.MORE_ITEM(item.key)}
            role="link"
            aria-label={t('programas', item.label)}
            onPress={() => router.push(item.href)}
            style={({ pressed }) => [styles.item, { backgroundColor: pressed ? colors.surface2 : colors.surface, borderColor: colors.border, boxShadow: colors.shadow }]}
          >
            <Text variant="heading">{t('programas', item.label)}</Text>
            <Text variant="body" tone="faint" aria-hidden>
              ›
            </Text>
          </Pressable>
        ))}
      </View>
    </Screen>
  );
};

const styles = StyleSheet.create({
  list: { gap: SPACING.sm },
  item: { minHeight: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderRadius: RADIUS.lg, paddingHorizontal: SPACING.lg },
});
