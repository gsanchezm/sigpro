import { ACCESO_TESTIDS, MOVIL_TESTIDS, toAuthError, type MessageKey } from '@sigpro/shared';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useAuth } from '../../state/auth';
import { useI18n } from '../../state/i18n';
import { useTheme } from '../../state/theme';
import { useToast } from '../../state/toast';
import { SPACING } from '../../theme/tokens';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { LoadingState } from '../../ui/States';
import { Text } from '../../ui/Text';
import { TextField } from '../../ui/TextField';
import { AuthShell } from './AuthShell';
import { parseForgot, withMinDelay, type FieldErrors } from './view';

/**
 * `/forgot` (solo sin sesión): pide un correo y la API responde siempre lo mismo («Si el correo existe, recibirás un enlace»),
 * exista o no. `?email=` trae el correo ya escrito en el login (la web comparte el campo entre las dos vistas). Si la
 * petición falla, la web no enseña nada; el móvil lo avisa con un toast de peligro con la traza.
 */
export const ForgotScreen = () => {
  const { t } = useI18n();
  const { colors } = useTheme();
  const { status, publicApi } = useAuth();
  const toast = useToast();
  const router = useRouter();
  const params = useLocalSearchParams<{ email?: string }>();

  const [email, setEmail] = useState(typeof params.email === 'string' ? params.email : '');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  if (status === 'loading') return <LoadingState testID={MOVIL_TESTIDS.SPLASH} />;
  if (status === 'authenticated') return <Redirect href="/programs" />;

  const emailKey = errors.email;
  const backToLogin = () => (router.canGoBack() ? router.back() : router.replace('/login'));

  const submit = async () => {
    const parsed = parseForgot(email);
    if (!parsed.ok) {
      setErrors(parsed.errors);
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      await withMinDelay(publicApi.auth.forgot(parsed.data));
      setSent(true);
    } catch (error) {
      const failure = toAuthError(error, t);
      toast.push('danger', failure.title, failure.trace);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell testID={MOVIL_TESTIDS.FORGOT_PAGE}>
      <Card testID={ACCESO_TESTIDS.FORGOT_FORM} aria-busy={busy} style={styles.form}>
        <Text variant="title" role="heading" aria-level={1}>
          {t('acceso', 'forgotTitle')}
        </Text>
        <Text variant="small" tone="muted">
          {t('acceso', 'forgotHint')}
        </Text>
        {sent ? (
          <View testID={ACCESO_TESTIDS.FORGOT_SENT} role="status" style={[styles.sent, { backgroundColor: colors.okSoft, borderColor: colors.ok }]}>
            <Text variant="label" tone="ok">
              {t('acceso', 'forgotSent')}
            </Text>
          </View>
        ) : null}
        <TextField
          label={t('acceso', 'email')}
          testID={ACCESO_TESTIDS.FORGOT_EMAIL}
          errorTestID={ACCESO_TESTIDS.FORGOT_EMAIL_ERROR}
          value={email}
          onChangeText={(value) => {
            setEmail(value);
            setErrors({});
          }}
          error={emailKey ? t('acceso', emailKey as MessageKey<'acceso'>) : undefined}
          placeholder="nombre@organizacion.es"
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          onSubmitEditing={() => void submit()}
        />
        <Button label={t('acceso', 'sendLink')} testID={ACCESO_TESTIDS.FORGOT_SUBMIT} variant="primary" busy={busy} onPress={() => void submit()} />
        <Button label={t('acceso', 'backToLogin')} testID={ACCESO_TESTIDS.FORGOT_BACK} variant="ghost" onPress={backToLogin} />
      </Card>
    </AuthShell>
  );
};

const styles = StyleSheet.create({
  form: { gap: 12, padding: SPACING.lg },
  sent: { borderWidth: 1, borderRadius: 6, padding: 10 },
});
