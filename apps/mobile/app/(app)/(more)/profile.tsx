import { LANGS, PERFIL_TESTIDS, type Lang } from '@sigpro/shared';
import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useAuth } from '../../../src/state/auth';
import { useI18n } from '../../../src/state/i18n';
import { useTheme } from '../../../src/state/theme';
import { Avatar } from '../../../src/ui/Avatar';
import { Button } from '../../../src/ui/Button';
import { Card } from '../../../src/ui/Card';
import { Chip } from '../../../src/ui/Chip';
import { Screen } from '../../../src/ui/Screen';
import { Text } from '../../../src/ui/Text';

/** `/profile`: cuenta, idioma, tema y cierre de sesión (sin permisos ni notificaciones: eso es de la web). */
export default function Profile() {
  const { user, tenant, signOut } = useAuth();
  const { t, lang, setLang } = useI18n();
  const { scheme, toggleTheme } = useTheme();
  const router = useRouter();

  if (!user) return null;

  const logout = async () => {
    await signOut();
    router.replace('/login');
  };

  return (
    <Screen title={t('perfil', 'title')} testID={PERFIL_TESTIDS.PROFILE_PAGE}>
      <Card style={styles.account}>
        <View testID={PERFIL_TESTIDS.PROFILE_AVATAR}>
          <Avatar name={user.name} size={48} />
        </View>
        <View style={styles.accountText}>
          <Text variant="heading" testID={PERFIL_TESTIDS.PROFILE_NAME}>
            {user.name}
          </Text>
          <Text variant="small" tone="muted" testID={PERFIL_TESTIDS.PROFILE_EMAIL}>
            {user.email}
          </Text>
          <Text variant="mono" tone="muted" testID={PERFIL_TESTIDS.PROFILE_ROLE}>
            {user.role}
          </Text>
          <Text variant="mono" tone="faint" testID={PERFIL_TESTIDS.PROFILE_TENANT}>
            {tenant}
          </Text>
        </View>
      </Card>

      <View role="radiogroup" aria-label={t('programas', 'language')} testID={PERFIL_TESTIDS.PROFILE_LANG} style={styles.row}>
        {LANGS.map((code: Lang) => (
          <Chip key={code} label={code.toUpperCase()} selected={lang === code} testID={`${PERFIL_TESTIDS.PROFILE_LANG}-${code}`} onPress={() => setLang(code)} />
        ))}
      </View>

      <Button label={t('programas', 'toggleTheme')} accessibilityLabel={`${t('programas', 'toggleTheme')} (${scheme})`} testID={PERFIL_TESTIDS.PROFILE_THEME} onPress={toggleTheme} />
      <Button label={t('programas', 'logout')} testID={PERFIL_TESTIDS.PROFILE_LOGOUT} variant="danger" onPress={() => void logout()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  account: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  accountText: { flex: 1, gap: 2 },
  row: { flexDirection: 'row', gap: 8 },
});
