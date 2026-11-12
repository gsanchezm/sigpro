import { LANGS, PERFIL_TESTIDS, type Lang } from '@sigpro/shared';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useAuth } from '../../state/auth';
import { useI18n } from '../../state/i18n';
import { useTheme } from '../../state/theme';
import { useToast } from '../../state/toast';
import { SPACING, type Scheme } from '../../theme/tokens';
import { Avatar } from '../../ui/Avatar';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { CheckboxField } from '../../ui/CheckboxField';
import { Screen } from '../../ui/Screen';
import { Segmented, type SegmentedOption } from '../../ui/Segmented';
import { SelectField, type SelectOption } from '../../ui/SelectField';
import { SwitchField } from '../../ui/SwitchField';
import { Text } from '../../ui/Text';
import { useStoredFlags, type StoredFlags } from './useStoredFlags';
import { EMPTY_DRAFT, isDirty, permissionRows, resolveDraft, setDraftField, type Draft, type Preferences } from './view';

const THEMES: readonly Scheme[] = ['light', 'dark'];
const THEME_TESTIDS: Readonly<Record<Scheme, string>> = { light: PERFIL_TESTIDS.PROFILE_THEME_LIGHT, dark: PERFIL_TESTIDS.PROFILE_THEME_DARK };

interface FormProps {
  readonly flags: StoredFlags;
  readonly onSaveFlags: (next: StoredFlags) => Promise<void>;
  readonly onLogout: () => void;
}

/**
 * Preferencias: un borrador sobre idioma, tema, avisos en tiempo real y resumen semanal. Nada se aplica hasta «Guardar», que
 * lo aplica todo de una vez y avisa con el toast «Preferencias guardadas» (como la web). Con el borrador igual a lo guardado,
 * «Guardar» está desactivado y dice por qué.
 */
const PreferencesCard = ({ flags, onSaveFlags, onLogout }: FormProps) => {
  const { t, lang, setLang } = useI18n();
  const { scheme, setTheme } = useTheme();
  const toast = useToast();
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);

  const applied: Preferences = { lang, theme: scheme, live: flags.live, digest: flags.digest };
  const shown = resolveDraft(applied, draft);
  const dirty = isDirty(draft);
  const change = <K extends keyof Preferences>(key: K, value: Preferences[K]) => setDraft((current) => setDraftField(current, applied, key, value));

  const langOptions: readonly SelectOption<Lang>[] = LANGS.map((code) => ({ value: code, label: t('perfil', `lang_${code}`) }));
  const themeOptions: readonly SegmentedOption<Scheme>[] = THEMES.map((value) => ({ value, label: t('perfil', `theme_${value}`), testID: THEME_TESTIDS[value] }));

  const save = async () => {
    if (!dirty) return;
    // El aviso sale en el idioma que había antes de guardar, como en la web
    const message = t('perfil', 'saved');
    setLang(shown.lang);
    setTheme(shown.theme);
    await onSaveFlags({ live: shown.live, digest: shown.digest });
    setDraft(EMPTY_DRAFT);
    toast.push('ok', message);
  };

  return (
    <Card style={styles.card}>
      <Text variant="heading" role="heading" aria-level={2}>
        {t('perfil', 'preferencesTitle')}
      </Text>
      <SelectField label={t('perfil', 'language')} value={shown.lang} options={langOptions} onChange={(value) => change('lang', value)} testID={PERFIL_TESTIDS.PROFILE_LANG} />
      <View style={styles.field}>
        <Text variant="label" tone="muted">
          {t('perfil', 'theme')}
        </Text>
        <Segmented label={t('perfil', 'theme')} options={themeOptions} value={shown.theme} onChange={(value) => change('theme', value)} testID={PERFIL_TESTIDS.PROFILE_THEME} />
      </View>
      <SwitchField label={t('perfil', 'live')} hint={t('perfil', 'liveHint')} value={shown.live} onChange={(value) => change('live', value)} testID={PERFIL_TESTIDS.PROFILE_LIVE} />
      <CheckboxField label={t('perfil', 'digest')} checked={shown.digest} onChange={(value) => change('digest', value)} testID={PERFIL_TESTIDS.PROFILE_DIGEST} />
      <Button
        label={t('programas', 'save')}
        testID={PERFIL_TESTIDS.PROFILE_SAVE}
        variant="primary"
        disabled={!dirty}
        disabledReason={t('perfil', 'noChanges')}
        onPress={() => void save()}
      />
      {dirty ? null : (
        <Text variant="small" tone="faint">
          {t('perfil', 'noChanges')}
        </Text>
      )}
      <Button label={t('perfil', 'logout')} testID={PERFIL_TESTIDS.PROFILE_LOGOUT} variant="danger" onPress={onLogout} />
    </Card>
  );
};

/**
 * `/profile`: la cuenta (avatar, nombre, correo, rol y tenant), lo que permite el rol (`profile-permissions`, seis filas con
 * `data-allowed`) y las preferencias con borrador y «Guardar». Misma estructura, textos e ids que la web.
 */
export const ProfileScreen = () => {
  const { t } = useI18n();
  const { colors } = useTheme();
  const { user, signOut } = useAuth();
  const router = useRouter();
  const { flags, save } = useStoredFlags();

  if (!user) return null;

  const logout = async () => {
    await signOut();
    router.replace('/login');
  };

  const accountRows: readonly (readonly [string, string, string])[] = [
    [t('perfil', 'name'), user.name, PERFIL_TESTIDS.PROFILE_NAME],
    [t('perfil', 'email'), user.email, PERFIL_TESTIDS.PROFILE_EMAIL],
    [t('perfil', 'role'), t('admin', `role_${user.role}`), PERFIL_TESTIDS.PROFILE_ROLE],
    [t('perfil', 'tenant'), user.tenant, PERFIL_TESTIDS.PROFILE_TENANT],
  ];

  return (
    <Screen title={t('perfil', 'title')} subtitle={t('perfil', 'subtitle')} testID={PERFIL_TESTIDS.PROFILE_PAGE}>
      <Card style={styles.card}>
        <Text variant="heading" role="heading" aria-level={2}>
          {t('perfil', 'accountTitle')}
        </Text>
        <View style={styles.account}>
          <View testID={PERFIL_TESTIDS.PROFILE_AVATAR}>
            <Avatar name={user.name} size={56} />
          </View>
          <View style={styles.accountRows}>
            {accountRows.map(([label, value, testID]) => (
              <View key={testID} style={styles.accountRow}>
                <Text variant="small" tone="faint">
                  {label}
                </Text>
                <Text variant="label" testID={testID}>
                  {value}
                </Text>
              </View>
            ))}
          </View>
        </View>
      </Card>

      <Card style={styles.card}>
        <Text variant="heading" role="heading" aria-level={2}>
          {t('perfil', 'permissionsTitle')}
        </Text>
        <View testID={PERFIL_TESTIDS.PROFILE_PERMISSIONS} role="list" style={styles.permissions}>
          {permissionRows(user.role).map((row) => (
            <View key={row.permission} role="listitem" dataSet={{ permission: row.permission, allowed: row.allowed }} style={styles.permission}>
              <View aria-hidden style={[styles.glyph, { backgroundColor: row.allowed ? colors.okSoft : colors.neutralSoft }]}>
                <Text variant="small" weight="600" tone={row.allowed ? 'ok' : 'faint'}>
                  {row.allowed ? '✓' : '—'}
                </Text>
              </View>
              <Text variant="body" tone={row.allowed ? 'default' : 'faint'} style={styles.permissionLabel}>
                {t('perfil', row.labelKey)}
              </Text>
              <Text variant="small" tone="faint">
                {row.allowed ? t('perfil', 'permAllowed') : t('perfil', 'permDenied')}
              </Text>
            </View>
          ))}
        </View>
      </Card>

      {/* El formulario espera a leer las preferencias guardadas (milisegundos): así «Guardar» no parpadea */}
      {flags === null ? null : <PreferencesCard flags={flags} onSaveFlags={save} onLogout={() => void logout()} />}
    </Screen>
  );
};

const styles = StyleSheet.create({
  card: { gap: SPACING.md },
  field: { gap: 4 },
  account: { flexDirection: 'row', alignItems: 'center', gap: SPACING.lg },
  accountRows: { flex: 1, gap: SPACING.sm },
  accountRow: { gap: 1 },
  permissions: { gap: SPACING.sm },
  permission: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, minHeight: 28 },
  permissionLabel: { flex: 1 },
  glyph: { width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
});
