import { ACCESO_TESTIDS, DETALLE_TESTIDS, MOVIL_TESTIDS, toAuthError, type AuthErrorView, type MessageKey } from '@sigpro/shared';
import { Link, Redirect, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useAuth } from '../../state/auth';
import { useI18n } from '../../state/i18n';
import { useTheme } from '../../state/theme';
import { useToast } from '../../state/toast';
import { SPACING } from '../../theme/tokens';
import { Badge } from '../../ui/Badge';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { CheckboxField } from '../../ui/CheckboxField';
import { SelectField } from '../../ui/SelectField';
import { LoadingState } from '../../ui/States';
import { Text } from '../../ui/Text';
import { TextField } from '../../ui/TextField';
import { ToggleButton } from '../../ui/ToggleButton';
import { AuthShell } from './AuthShell';
import { ServerAlert } from './ServerAlert';
import { EMPTY_REGISTER, REGISTER_ROLE_OPTIONS, parseRegister, passwordMeter, withMinDelay, type FieldErrors, type RegisterValues } from './view';

// Las cuatro reglas del medidor, en el orden de `passwordRules`
const RULE_KEYS = ['r1', 'r2', 'r3', 'r4'] as const;

interface Verified {
  readonly email: string;
  readonly role: string;
  readonly requestId: string;
}

/**
 * `/register` (solo sin sesión): solicitud de acceso con la misma validación Zod que la API, medidor de contraseña y, tras el
 * 201, el panel «Solicitud enviada» con el reenvío del correo. Un 409 (correo ya registrado) y cualquier otro error del
 * servidor se muestran con su traza HTTP, como en la web.
 */
export const RegisterScreen = () => {
  const { t } = useI18n();
  const { colors } = useTheme();
  const { status, publicApi } = useAuth();
  const toast = useToast();
  const router = useRouter();

  const [reg, setReg] = useState<RegisterValues>(EMPTY_REGISTER);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [serverError, setServerError] = useState<AuthErrorView | null>(null);
  const [busy, setBusy] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [verified, setVerified] = useState<Verified | null>(null);

  if (status === 'loading') return <LoadingState testID={MOVIL_TESTIDS.SPLASH} />;
  if (status === 'authenticated') return <Redirect href="/programs" />;

  // Como en la web: editar cualquier campo borra los avisos anteriores
  const setField = <K extends keyof RegisterValues>(key: K, value: RegisterValues[K]) => {
    setReg((current) => ({ ...current, [key]: value }));
    setErrors({});
    setServerError(null);
  };
  const fieldError = (field: string): string | undefined => {
    const key = errors[field];
    return key ? t('acceso', key as MessageKey<'acceso'>) : undefined;
  };
  const backToLogin = () => (router.canGoBack() ? router.back() : router.replace('/login'));

  const submit = async () => {
    const parsed = parseRegister(reg);
    if (!parsed.ok) {
      setErrors(parsed.errors);
      return;
    }
    setErrors({});
    setServerError(null);
    setBusy(true);
    try {
      const result = await withMinDelay(publicApi.auth.register(parsed.data));
      setVerified({ email: result.email, role: result.role, requestId: result.requestId });
      toast.push('ok', t('acceso', 'verifyTitle'), 'POST /api/auth/register → 201 Created');
    } catch (error) {
      setServerError(toAuthError(error, t));
    } finally {
      setBusy(false);
    }
  };

  // La web ignora el fallo del reenvío y avisa siempre (202): se mantiene
  const resend = async () => {
    if (!verified) return;
    await publicApi.auth.resend(verified.email).catch(() => undefined);
    toast.push('ok', t('acceso', 'resent'), 'POST /api/auth/resend → 202');
  };

  if (verified) {
    return (
      <AuthShell testID={MOVIL_TESTIDS.REGISTER_PAGE}>
        <Card testID={ACCESO_TESTIDS.VERIFY_PANEL} role="status" style={styles.form}>
          <View aria-hidden style={[styles.check, { backgroundColor: colors.okSoft }]}>
            <Text variant="label" tone="ok">
              ✓
            </Text>
          </View>
          <Text variant="title" role="heading" aria-level={1}>
            {t('acceso', 'verifyTitle')}
          </Text>
          <Text variant="small" tone="muted">{`${t('acceso', 'verifyText')} ${verified.email}.`}</Text>
          <View style={[styles.summary, { backgroundColor: colors.surface2, borderColor: colors.border }]}>
            <View style={styles.summaryRow}>
              <Text variant="small" tone="faint">
                {t('acceso', 'status')}
              </Text>
              <Badge label={t('acceso', 'pendingApproval')} tone="warn" state="pending_approval" testID={ACCESO_TESTIDS.VERIFY_STATUS_BADGE} />
            </View>
            <View style={styles.summaryRow}>
              <Text variant="small" tone="faint">
                {t('acceso', 'requestedRole')}
              </Text>
              <Text variant="mono">{verified.role}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text variant="small" tone="faint">
                ID
              </Text>
              <Text variant="mono">{verified.requestId}</Text>
            </View>
          </View>
          <Button label={t('acceso', 'resend')} testID={ACCESO_TESTIDS.VERIFY_RESEND} onPress={() => void resend()} />
          <Button label={t('acceso', 'backToLogin')} testID={ACCESO_TESTIDS.VERIFY_BACK} variant="ghost" onPress={backToLogin} />
        </Card>
      </AuthShell>
    );
  }

  const meter = passwordMeter(reg.password);
  const toggleLabel = showPass ? t('acceso', 'hidePw') : t('acceso', 'showPw');
  const termsSentence = `${t('acceso', 'terms1')} ${t('acceso', 'terms2')} ${t('acceso', 'terms3')} ${t('acceso', 'terms4')}.`;

  return (
    <AuthShell testID={MOVIL_TESTIDS.REGISTER_PAGE}>
      <Card testID={ACCESO_TESTIDS.REGISTER_FORM} aria-busy={busy} style={styles.form}>
        <Text variant="title" role="heading" aria-level={1}>
          {t('acceso', 'registerTitle')}
        </Text>
        <Text variant="small" tone="muted">
          {t('acceso', 'registerHint')}
        </Text>
        {serverError ? <ServerAlert error={serverError} testID={ACCESO_TESTIDS.REGISTER_ERROR} /> : null}

        <TextField
          label={t('acceso', 'firstName')}
          testID={ACCESO_TESTIDS.REGISTER_FIRST_NAME}
          errorTestID={ACCESO_TESTIDS.REGISTER_FIRST_NAME_ERROR}
          value={reg.first}
          onChangeText={(value) => setField('first', value)}
          error={fieldError('first')}
        />
        <TextField
          label={t('acceso', 'lastName')}
          testID={ACCESO_TESTIDS.REGISTER_LAST_NAME}
          errorTestID={ACCESO_TESTIDS.REGISTER_LAST_NAME_ERROR}
          value={reg.last}
          onChangeText={(value) => setField('last', value)}
          error={fieldError('last')}
        />
        <View style={styles.field}>
          <TextField
            label={t('acceso', 'workEmail')}
            testID={ACCESO_TESTIDS.REGISTER_EMAIL}
            errorTestID={ACCESO_TESTIDS.REGISTER_EMAIL_ERROR}
            value={reg.email}
            onChangeText={(value) => setField('email', value)}
            error={fieldError('email')}
            placeholder="nombre@organizacion.es"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Text variant="small" tone="faint">
            {t('acceso', 'emailHelp')}
          </Text>
        </View>
        <TextField label={t('acceso', 'org')} testID={ACCESO_TESTIDS.REGISTER_ORG} errorTestID={ACCESO_TESTIDS.REGISTER_ORG_ERROR} value={reg.org} onChangeText={(value) => setField('org', value)} error={fieldError('org')} />
        <View style={styles.field}>
          <SelectField label={t('acceso', 'requestedRole')} value={reg.role} options={REGISTER_ROLE_OPTIONS} onChange={(value) => setField('role', value)} testID={ACCESO_TESTIDS.REGISTER_ROLE} />
          <Text variant="small" tone="faint">
            {t('acceso', 'roleHelp')}
          </Text>
        </View>
        <TextField
          label={t('acceso', 'password')}
          testID={ACCESO_TESTIDS.REGISTER_PASSWORD}
          errorTestID={ACCESO_TESTIDS.REGISTER_PASSWORD_ERROR}
          value={reg.password}
          onChangeText={(value) => setField('password', value)}
          error={fieldError('password')}
          secureTextEntry={!showPass}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <TextField
          label={t('acceso', 'confirmPassword')}
          testID={ACCESO_TESTIDS.REGISTER_PASSWORD_CONFIRM}
          errorTestID={ACCESO_TESTIDS.REGISTER_PASSWORD_CONFIRM_ERROR}
          value={reg.confirm}
          onChangeText={(value) => setField('confirm', value)}
          error={fieldError('confirm')}
          secureTextEntry={!showPass}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <ToggleButton label={toggleLabel} pressed={showPass} onPress={() => setShowPass((current) => !current)} testID={ACCESO_TESTIDS.REGISTER_TOGGLE_PASSWORD} />

        {/* Medidor: cuatro barras, la fuerza en texto y las cuatro reglas con ✓ / · (`data-ok`) */}
        <View testID={ACCESO_TESTIDS.REGISTER_PASSWORD_METER} dataSet={{ strength: meter.strength }} style={styles.meter}>
          <View aria-hidden style={styles.bars}>
            {meter.segments.map((filled, index) => (
              <View key={index} style={[styles.bar, { backgroundColor: filled ? colors[meter.tone] : colors.border }]} />
            ))}
          </View>
          {meter.strength === 'none' ? null : (
            <Text variant="label" tone="muted">
              {t('acceso', meter.strength)}
            </Text>
          )}
          <View role="list" style={styles.rules}>
            {RULE_KEYS.map((key, index) => (
              <View key={key} role="listitem" dataSet={{ ok: meter.rules[index] === true }} style={styles.rule}>
                <Text variant="mono" tone={meter.rules[index] ? 'ok' : 'faint'} aria-hidden>
                  {meter.rules[index] ? '✓' : '·'}
                </Text>
                <Text variant="small" tone={meter.rules[index] ? 'ok' : 'faint'}>
                  {t('acceso', key)}
                </Text>
              </View>
            ))}
          </View>
        </View>

        <CheckboxField label={termsSentence} checked={reg.terms} onChange={(value) => setField('terms', value)} testID={ACCESO_TESTIDS.REGISTER_TERMS} invalid={Boolean(errors.terms)} />
        <View style={styles.links}>
          <Link href="/legal/terms" asChild>
            <Pressable role="link" testID={ACCESO_TESTIDS.REGISTER_TERMS_LINK} aria-label={t('acceso', 'terms2')} style={styles.link}>
              <Text variant="label" tone="accent">
                {t('acceso', 'terms2')}
              </Text>
            </Pressable>
          </Link>
          <Link href="/legal/privacy" asChild>
            <Pressable role="link" testID={DETALLE_TESTIDS.REGISTER_PRIVACY_LINK} aria-label={t('acceso', 'terms4')} style={styles.link}>
              <Text variant="label" tone="accent">
                {t('acceso', 'terms4')}
              </Text>
            </Pressable>
          </Link>
        </View>
        {fieldError('terms') ? (
          <Text variant="small" tone="danger" role="alert" testID={ACCESO_TESTIDS.REGISTER_TERMS_ERROR}>
            {fieldError('terms')}
          </Text>
        ) : null}

        <Button label={t('acceso', 'registerBtn')} testID={ACCESO_TESTIDS.REGISTER_SUBMIT} variant="primary" busy={busy} onPress={() => void submit()} />
        <Button label={t('acceso', 'backToLogin')} testID={ACCESO_TESTIDS.REGISTER_BACK} variant="ghost" onPress={backToLogin} />
        <Text variant="small" tone="faint">
          {t('acceso', 'registerServerHint')}
        </Text>
      </Card>
    </AuthShell>
  );
};

const styles = StyleSheet.create({
  form: { gap: 12, padding: SPACING.lg },
  field: { gap: 4 },
  check: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  summary: { borderWidth: 1, borderRadius: 10, padding: 12, gap: 8 },
  summaryRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  meter: { gap: 6 },
  bars: { flexDirection: 'row', gap: 4 },
  bar: { flex: 1, height: 4, borderRadius: 2 },
  rules: { gap: 2 },
  rule: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  links: { flexDirection: 'row', flexWrap: 'wrap', columnGap: SPACING.lg },
  link: { minHeight: 44, justifyContent: 'center' },
});
