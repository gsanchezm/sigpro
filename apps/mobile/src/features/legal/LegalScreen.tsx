import { LEGAL_TESTIDS } from '@sigpro/shared';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../state/auth';
import { useI18n } from '../../state/i18n';
import { useTheme } from '../../state/theme';
import { SPACING } from '../../theme/tokens';
import { Card } from '../../ui/Card';
import { Text } from '../../ui/Text';
import { PublicHeader } from '../access/PublicHeader';
import { LEGAL_CONTENT, backTarget, type LegalKind } from './view';

/**
 * Términos de uso, privacidad y ayuda (`/legal/terms`, `/legal/privacy`, `/help`): páginas públicas con cabecera mínima
 * (idioma y tema) y enlace de retorno. Mismos textos y secciones que la web. El enlace a `/lab` de la ayuda no existe en el
 * móvil (esa pantalla es del instructor y solo vive en la web).
 */
export const LegalScreen = ({ kind }: { readonly kind: LegalKind }) => {
  const { t } = useI18n();
  const { colors } = useTheme();
  const { status } = useAuth();
  const router = useRouter();
  const content = LEGAL_CONTENT[kind];
  const target = backTarget(status === 'authenticated');
  // Con historial se vuelve atrás (así el registro conserva lo escrito); sin él (enlace directo), a donde lleva el enlace de la web
  const back = () => (router.canGoBack() ? router.back() : router.replace(target.href));

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.bg }]}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <PublicHeader langTestID={LEGAL_TESTIDS.LEGAL_LANG} themeTestID={LEGAL_TESTIDS.LEGAL_THEME} langLabel={t('legal', 'language')} themeLabel={t('legal', 'toggleTheme')} />
        <View testID={content.pageTestId} role="article" style={styles.article}>
          <View style={styles.intro}>
            <Text variant="title" role="heading" aria-level={1} testID={LEGAL_TESTIDS.LEGAL_TITLE}>
              {t('legal', content.title)}
            </Text>
            <Text variant="body" tone="muted">
              {t('legal', content.intro)}
            </Text>
            <Text variant="mono" tone="faint">
              {t('legal', 'updated')}
            </Text>
          </View>
          {content.sections.map((section) => (
            <Card key={section.title}>
              <Text variant="heading" role="heading" aria-level={2}>
                {t('legal', section.title)}
              </Text>
              <Text variant="body" tone="muted">
                {t('legal', section.body)}
              </Text>
            </Card>
          ))}
        </View>
        <Pressable role="link" testID={LEGAL_TESTIDS.LEGAL_BACK} aria-label={t('legal', target.label)} onPress={back} style={styles.back}>
          <Text variant="label" tone="accent">
            {t('legal', target.label)}
          </Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { padding: SPACING.page, gap: SPACING.block },
  article: { gap: SPACING.md },
  intro: { gap: 6 },
  back: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
});
