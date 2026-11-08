import { LANGS, PERFIL_TESTIDS, can, type Lang, type MessageKey, type Permission } from '@sigpro/shared';
import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { STORAGE_KEYS, readStorage, writeStorage } from '../../lib/storage';
import { useAuth } from '../../state/auth';
import { useSaveLabel } from '../../state/config';
import { isSupportedLang, useI18n } from '../../state/i18n';
import { useLive } from '../../state/live';
import { useTheme, type Theme } from '../../state/theme';
import { useToast } from '../../state/toast';
import { Avatar } from '../../ui/Avatar';
import { Switch } from '../../ui/Switch';

const PERMISSION_ROWS: readonly (readonly [Permission, MessageKey<'perfil'>])[] = [
  ['nc.create', 'perm_nc_create'],
  ['nc.transition', 'perm_nc_transition'],
  ['nc.close', 'perm_nc_close'],
  ['milestone.edit', 'perm_milestone_edit'],
  ['users.manage', 'perm_users_manage'],
  ['audit.view', 'perm_audit_view'],
];

const THEMES: readonly Theme[] = ['light', 'dark'];
const THEME_TESTIDS: Readonly<Record<Theme, string>> = { light: PERFIL_TESTIDS.PROFILE_THEME_LIGHT, dark: PERFIL_TESTIDS.PROFILE_THEME_DARK };

/**
 * Perfil: datos de la sesión, lo que permite el rol y las preferencias de este navegador (idioma, tema, avisos en tiempo
 * real y resumen semanal). Las preferencias son un borrador: «Guardar» las aplica todas a la vez.
 */
export const ProfilePage = () => {
  const { t, lang, setLang } = useI18n();
  const { user, signOut } = useAuth();
  const { theme, setTheme } = useTheme();
  const { liveEnabled, setLiveEnabled } = useLive();
  const toast = useToast();
  const navigate = useNavigate();
  const saveLabel = useSaveLabel();
  const [savedDigest, setSavedDigest] = useState(() => readStorage(STORAGE_KEYS.digest) === 'on');
  const [draftLang, setDraftLang] = useState<Lang>(lang);
  const [draftTheme, setDraftTheme] = useState<Theme>(theme);
  const [draftLive, setDraftLive] = useState(liveEnabled);
  const [draftDigest, setDraftDigest] = useState(savedDigest);

  if (!user) return null;

  const dirty = draftLang !== lang || draftTheme !== theme || draftLive !== liveEnabled || draftDigest !== savedDigest;

  const save = (event: FormEvent) => {
    event.preventDefault();
    if (!dirty) return;
    setLang(draftLang);
    setTheme(draftTheme);
    setLiveEnabled(draftLive);
    writeStorage(STORAGE_KEYS.digest, draftDigest ? 'on' : 'off');
    setSavedDigest(draftDigest);
    toast.push('ok', t('perfil', 'saved'));
  };

  const logout = async () => {
    // signOut vacía la sesión de forma síncrona; navegar justo después evita que RequireAuth redirija sin el aviso
    const done = signOut();
    navigate('/login', { state: { signedOut: true } });
    await done;
  };

  const accountRows: readonly (readonly [string, string, string])[] = [
    [t('perfil', 'name'), user.name, PERFIL_TESTIDS.PROFILE_NAME],
    [t('perfil', 'email'), user.email, PERFIL_TESTIDS.PROFILE_EMAIL],
    [t('perfil', 'role'), t('admin', `role_${user.role}`), PERFIL_TESTIDS.PROFILE_ROLE],
    [t('perfil', 'tenant'), user.tenant, PERFIL_TESTIDS.PROFILE_TENANT],
  ];

  return (
    <div data-testid={PERFIL_TESTIDS.PROFILE_PAGE} className="flex max-w-[720px] flex-col gap-4">
      <div className="flex flex-col gap-0.5">
        <h1 className="m-0 text-[20px] font-semibold tracking-[-.01em]">{t('perfil', 'title')}</h1>
        <p className="m-0 text-[12.5px] text-fg-2">{t('perfil', 'subtitle')}</p>
      </div>

      <section aria-labelledby="profile-account-title" className="card flex flex-col gap-3 p-4">
        <h2 id="profile-account-title" className="m-0 text-[14px] font-semibold">
          {t('perfil', 'accountTitle')}
        </h2>
        <div className="flex items-center gap-4">
          <span data-testid={PERFIL_TESTIDS.PROFILE_AVATAR} className="flex-none">
            <Avatar name={user.name} size={56} fontPx={20} />
          </span>
          <dl className="m-0 grid min-w-0 grid-cols-[auto_1fr] gap-x-5 gap-y-1.5 text-[12.5px]">
            {accountRows.map(([label, value, testId]) => (
              <div key={testId} className="contents">
                <dt className="text-fg-3">{label}</dt>
                <dd data-testid={testId} className="m-0 min-w-0 truncate font-medium">
                  {value}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section aria-labelledby="profile-permissions-title" className="card flex flex-col gap-2 p-4">
        <h2 id="profile-permissions-title" className="m-0 text-[14px] font-semibold">
          {t('perfil', 'permissionsTitle')}
        </h2>
        <ul data-testid={PERFIL_TESTIDS.PROFILE_PERMISSIONS} className="m-0 grid list-none grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-x-4 gap-y-1.5 p-0 text-[12.5px]">
          {PERMISSION_ROWS.map(([permission, labelKey]) => {
            const allowed = can(user.role, permission);
            return (
              <li key={permission} data-permission={permission} data-allowed={allowed} className="flex items-center gap-2">
                <span aria-hidden="true" className={`grid size-4 flex-none place-items-center rounded-full text-[10px] font-bold ${allowed ? 'bg-ok-soft text-ok' : 'bg-neutral-soft text-fg-3'}`}>
                  {allowed ? '✓' : '—'}
                </span>
                <span className={allowed ? '' : 'text-fg-3'}>{t('perfil', labelKey)}</span>
                <span className="sr-only">{allowed ? t('perfil', 'permAllowed') : t('perfil', 'permDenied')}</span>
              </li>
            );
          })}
        </ul>
      </section>

      <form noValidate onSubmit={save} className="card flex flex-col gap-4 p-4">
        <h2 className="m-0 text-[14px] font-semibold">{t('perfil', 'preferencesTitle')}</h2>

        <div className="flex max-w-[260px] flex-col gap-1">
          <label htmlFor="profile-lang" className="label">
            {t('perfil', 'language')}
          </label>
          <select
            id="profile-lang"
            data-testid={PERFIL_TESTIDS.PROFILE_LANG}
            value={draftLang}
            onChange={(event) => isSupportedLang(event.target.value) && setDraftLang(event.target.value as Lang)}
            className="input !h-8 !bg-surface"
          >
            {LANGS.map((code) => (
              <option key={code} value={code}>
                {t('perfil', `lang_${code}`)}
              </option>
            ))}
          </select>
        </div>

        <fieldset data-testid={PERFIL_TESTIDS.PROFILE_THEME} className="m-0 flex flex-col gap-1.5 border-0 p-0">
          <legend className="label p-0">{t('perfil', 'theme')}</legend>
          <div className="flex gap-4">
            {THEMES.map((value) => (
              <label key={value} className="flex cursor-pointer items-center gap-1.5 text-[12.5px]">
                <input type="radio" name="profile-theme" value={value} data-testid={THEME_TESTIDS[value]} checked={draftTheme === value} onChange={() => setDraftTheme(value)} className="size-4 cursor-pointer accent-accent" />
                {t('perfil', `theme_${value}`)}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="flex items-start gap-3">
          <Switch id="profile-live" testId={PERFIL_TESTIDS.PROFILE_LIVE} labelledBy="profile-live-label" checked={draftLive} onChange={setDraftLive} />
          <div className="flex flex-col gap-0.5">
            <span id="profile-live-label" className="text-[12.5px] font-medium">
              {t('perfil', 'live')}
            </span>
            <span className="text-[12px] text-fg-3">{t('perfil', 'liveHint')}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <input id="profile-digest" type="checkbox" data-testid={PERFIL_TESTIDS.PROFILE_DIGEST} checked={draftDigest} onChange={(event) => setDraftDigest(event.target.checked)} className="size-4 cursor-pointer accent-accent" />
          <label htmlFor="profile-digest" className="cursor-pointer text-[12.5px]">
            {t('perfil', 'digest')}
          </label>
        </div>

        <div className="flex flex-wrap justify-between gap-2 border-t border-border pt-3">
          <button type="button" data-testid={PERFIL_TESTIDS.PROFILE_LOGOUT} onClick={() => void logout()} className="btn btn-ghost">
            {t('perfil', 'logout')}
          </button>
          <button type="submit" data-testid={PERFIL_TESTIDS.PROFILE_SAVE} disabled={!dirty} title={dirty ? undefined : t('perfil', 'noChanges')} className="btn btn-primary">
            {saveLabel}
          </button>
        </div>
      </form>
    </div>
  );
};
