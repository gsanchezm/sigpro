import { ACCESO_DYNAMIC_TESTIDS, ACCESO_TESTIDS, ApiError, MOVIL_TESTIDS, loginSchema, toAuthError, type TestUserDto } from '@sigpro/shared';
import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../src/state/auth';
import { useI18n } from '../src/state/i18n';
import { useTheme } from '../src/state/theme';
import { Button } from '../src/ui/Button';
import { Card } from '../src/ui/Card';
import { Chip } from '../src/ui/Chip';
import { LoadingState } from '../src/ui/States';
import { Text } from '../src/ui/Text';
import { TextField } from '../src/ui/TextField';

type Step = 'credentials' | 'mfa';

/** Acceso: correo + contraseña y, si el usuario lo exige (admin), el segundo paso con el código de 6 dígitos. */
export default function Login() {
  const { status, publicApi, signIn, tenant, setTenant } = useAuth();
  const { t } = useI18n();
  const { colors, scheme, toggleTheme } = useTheme();

  const [step, setStep] = useState<Step>('credentials');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mfaToken, setMfaToken] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [failure, setFailure] = useState<{ title: string; trace: string } | null>(null);
  const [testUsers, setTestUsers] = useState<readonly TestUserDto[]>([]);

  // Panel de usuarios de prueba (solo si el entorno lo permite, como en la web)
  useEffect(() => {
    let alive = true;
    publicApi.config.testUsers().then((list) => alive && setTestUsers(list), () => undefined);
    return () => {
      alive = false;
    };
  }, [publicApi, tenant]);

  if (status === 'loading') return <LoadingState testID={MOVIL_TESTIDS.SPLASH} />;
  if (status === 'authenticated') return <Redirect href="/programs" />;

  const submitCredentials = async () => {
    // La misma validación Zod que la web: mensajes = claves de i18n de `acceso`
    const parsed = loginSchema.safeParse({ email, password, remember: true });
    if (!parsed.success) {
      const fields = parsed.error.flatten().fieldErrors;
      setErrors({
        email: fields.email?.[0] ? t('acceso', fields.email[0] as 'required' | 'badEmail') : undefined,
        password: fields.password?.[0] ? t('acceso', fields.password[0] as 'required') : undefined,
      });
      return;
    }
    setErrors({});
    setFailure(null);
    setBusy(true);
    try {
      const result = await publicApi.auth.login(parsed.data);
      if (result.mfaRequired) {
        setMfaToken(result.mfaToken);
        setStep('mfa');
        return;
      }
      signIn(result);
    } catch (error) {
      setFailure(toAuthError(error, t));
    } finally {
      setBusy(false);
    }
  };

  const submitMfa = async () => {
    setFailure(null);
    setBusy(true);
    try {
      signIn(await publicApi.auth.mfa({ mfaToken, code }));
    } catch (error) {
      setFailure(error instanceof ApiError ? toAuthError(error, t) : { title: t('common', 'genericError'), trace: '' });
    } finally {
      setBusy(false);
    }
  };

  const backToLogin = () => {
    setStep('credentials');
    setCode('');
    setFailure(null);
  };

  const failureBox = failure ? (
    <View testID={step === 'mfa' ? ACCESO_TESTIDS.MFA_ERROR : ACCESO_TESTIDS.LOGIN_ERROR} role="alert" style={[styles.failure, { backgroundColor: colors.dangerSoft, borderColor: colors.danger }]}>
      <Text variant="label" tone="danger">
        {failure.title}
      </Text>
      {failure.trace ? (
        <Text variant="mono" tone="muted">
          {failure.trace}
        </Text>
      ) : null}
    </View>
  ) : null;

  return (
    <SafeAreaView testID={MOVIL_TESTIDS.LOGIN_PAGE} style={[styles.root, { backgroundColor: colors.bg }]}>
      <View style={styles.content}>
        <View style={styles.top}>
          <Text variant="heading" tone="accent">
            SIGPRO
          </Text>
          <Button label={t('acceso', 'toggleTheme')} testID={ACCESO_TESTIDS.AUTH_THEME} variant="ghost" onPress={toggleTheme} accessibilityLabel={`${t('acceso', 'toggleTheme')} (${scheme})`} />
        </View>

        {step === 'credentials' ? (
          <Card testID={ACCESO_TESTIDS.LOGIN_FORM} aria-busy={busy} style={styles.form}>
            <Text variant="title" role="heading" aria-level={1}>
              {t('acceso', 'signIn')}
            </Text>
            <Text variant="small" tone="muted">
              {t('acceso', 'signInHint')}
            </Text>
            <TextField
              label={t('acceso', 'email')}
              testID={ACCESO_TESTIDS.LOGIN_EMAIL}
              errorTestID={ACCESO_TESTIDS.LOGIN_EMAIL_ERROR}
              value={email}
              onChangeText={setEmail}
              error={errors.email}
              placeholder="nombre@organizacion.es"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TextField
              label={t('acceso', 'password')}
              testID={ACCESO_TESTIDS.LOGIN_PASSWORD}
              errorTestID={ACCESO_TESTIDS.LOGIN_PASSWORD_ERROR}
              value={password}
              onChangeText={setPassword}
              error={errors.password}
              secureTextEntry
              autoCapitalize="none"
              onSubmitEditing={() => void submitCredentials()}
            />
            <TextField label={t('lab', 'tenantSelect')} testID={MOVIL_TESTIDS.LOGIN_TENANT} value={tenant} onChangeText={setTenant} autoCapitalize="none" autoCorrect={false} />
            {failureBox}
            <Button label={t('acceso', 'signInBtn')} testID={ACCESO_TESTIDS.LOGIN_SUBMIT} variant="primary" busy={busy} onPress={() => void submitCredentials()} />
          </Card>
        ) : (
          <Card testID={ACCESO_TESTIDS.MFA_FORM} aria-busy={busy} style={styles.form}>
            <Text variant="title" role="heading" aria-level={1}>
              {t('acceso', 'mfaTitle')}
            </Text>
            <Text variant="small" tone="muted">
              {`${t('acceso', 'mfaHint')} ${email}`}
            </Text>
            <TextField
              label={t('acceso', 'mfaCode')}
              testID={ACCESO_TESTIDS.MFA_CODE}
              value={code}
              onChangeText={(value) => setCode(value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
              keyboardType="number-pad"
              maxLength={6}
              onSubmitEditing={() => code.length === 6 && void submitMfa()}
            />
            <Text variant="small" tone="faint">
              {t('acceso', 'mfaDemo')}
            </Text>
            {failureBox}
            <Button
              label={t('acceso', 'verify')}
              testID={ACCESO_TESTIDS.MFA_SUBMIT}
              variant="primary"
              busy={busy}
              disabled={code.length !== 6}
              disabledReason={t('acceso', 'mfaCode')}
              onPress={() => void submitMfa()}
            />
            <Button label={t('acceso', 'backToLogin')} testID={ACCESO_TESTIDS.MFA_BACK} variant="ghost" onPress={backToLogin} />
          </Card>
        )}

        {step === 'credentials' && testUsers.length > 0 ? (
          <View testID={ACCESO_TESTIDS.TEST_USERS} role="radiogroup" aria-label={t('acceso', 'testUsers')} style={styles.users}>
            <Text variant="small" tone="muted">{`${t('acceso', 'testUsers')} · ${t('acceso', 'clickToFill')}`}</Text>
            <View style={styles.chips}>
              {testUsers.map((user) => (
                <Chip
                  key={user.id}
                  label={`${user.name} · ${user.role}`}
                  selected={email === user.email}
                  testID={ACCESO_DYNAMIC_TESTIDS.TEST_USER(user.role, user.status === 'active' ? undefined : user.status)}
                  onPress={() => {
                    setEmail(user.email);
                    setPassword(user.password);
                    setErrors({});
                    setFailure(null);
                  }}
                />
              ))}
            </View>
          </View>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { flex: 1, padding: 16, gap: 16, justifyContent: 'center' },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  form: { gap: 12, padding: 16 },
  failure: { borderWidth: 1, borderRadius: 6, padding: 10, gap: 2 },
  users: { gap: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
