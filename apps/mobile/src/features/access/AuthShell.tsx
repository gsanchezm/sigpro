import { ACCESO_TESTIDS, DETALLE_TESTIDS } from '@sigpro/shared';
import { Link, type Href } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useI18n } from '../../state/i18n';
import { useTheme } from '../../state/theme';
import { SPACING } from '../../theme/tokens';
import { Text } from '../../ui/Text';
import { PublicHeader } from './PublicHeader';

interface FooterLink {
  readonly href: Href;
  readonly testID: string;
  readonly label: 'privacy' | 'termsFooter' | 'help';
}

// Los tres enlaces del pie de Acceso, en el orden de la web: Privacidad · Condiciones · Ayuda
const FOOTER_LINKS: readonly FooterLink[] = [
  { href: '/legal/privacy', testID: DETALLE_TESTIDS.AUTH_FOOTER_PRIVACY, label: 'privacy' },
  { href: '/legal/terms', testID: DETALLE_TESTIDS.AUTH_FOOTER_TERMS, label: 'termsFooter' },
  { href: '/help', testID: DETALLE_TESTIDS.AUTH_FOOTER_HELP, label: 'help' },
];

/** Pie de Acceso (`contentinfo`): © y los enlaces a privacidad, condiciones y ayuda, que se leen sin sesión. */
export const AuthFooter = () => {
  const { t } = useI18n();
  const { colors } = useTheme();
  return (
    <View role="contentinfo" style={[styles.footer, { borderTopColor: colors.border }]}>
      <Text variant="mono" tone="faint">
        © 2026 SIGPRO
      </Text>
      {FOOTER_LINKS.map((link) => (
        <Link key={link.testID} href={link.href} asChild>
          <Pressable role="link" testID={link.testID} aria-label={t('acceso', link.label)} style={styles.link}>
            <Text variant="small" tone="faint">
              {t('acceso', link.label)}
            </Text>
          </Pressable>
        </Link>
      ))}
    </View>
  );
};

interface Props {
  /** Raíz de la pantalla (`login-page`, `register-page`…). */
  readonly testID: string;
  readonly children: ReactNode;
}

/**
 * Marco de Acceso: zona segura, cabecera pública (marca, idioma y tema), contenido con scroll y el pie con los enlaces
 * legales. El scroll permite que el registro y el login con usuarios de prueba quepan en pantallas pequeñas.
 */
export const AuthShell = ({ testID, children }: Props) => {
  const { t } = useI18n();
  const { colors } = useTheme();
  return (
    <SafeAreaView testID={testID} style={[styles.root, { backgroundColor: colors.bg }]}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <PublicHeader langTestID={ACCESO_TESTIDS.AUTH_LANG} themeTestID={ACCESO_TESTIDS.AUTH_THEME} langLabel={t('acceso', 'language')} themeLabel={t('acceso', 'toggleTheme')} />
        <View style={styles.content}>{children}</View>
        <AuthFooter />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { flexGrow: 1, padding: SPACING.lg, gap: SPACING.lg },
  content: { flex: 1, gap: SPACING.lg, justifyContent: 'center' },
  footer: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', columnGap: SPACING.lg, borderTopWidth: 1, paddingTop: SPACING.xs },
  link: { minHeight: 44, justifyContent: 'center' },
});
