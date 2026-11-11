import {
  ACCESO_TESTIDS,
  DETALLE_TESTIDS,
  REGISTER_ROLES,
  flattenIssues,
  forgotSchema,
  loginSchema,
  passwordRules,
  passwordStrength,
  registerSchema,
  type RegisterRole,
  type SessionResponse,
  type TestUserDto,
} from '@sigpro/shared';
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { toAuthError, type AuthErrorView } from '../../lib/errors';
import { useAuth } from '../../state/auth';
import { useI18n } from '../../state/i18n';
import { useToast } from '../../state/toast';
import { Spinner } from '../../ui/Spinner';
import { TextField } from '../../ui/TextField';
import { AuthLayout } from './AuthLayout';
import { TestUsers } from './TestUsers';
import { AuthForm, AuthHeading, AuthPanel, PasswordToggle, ServerAlert } from './parts';

type RouteView = 'login' | 'register' | 'forgot';
type Errors = Readonly<Record<string, string>>;

const REDIRECT_MS = 1400;
// Mantiene el spinner visible un instante (el prototipo simulaba 600–800 ms de red)
const MIN_BUSY_MS = 400;

const withMinDelay = async <T,>(work: Promise<T>): Promise<T> => {
  const [result] = await Promise.all([work, new Promise((resolve) => setTimeout(resolve, MIN_BUSY_MS))]);
  return result;
};

interface Redirecting {
  readonly session: SessionResponse;
  readonly remember: boolean;
  readonly endpoint: string;
}

interface Verified {
  readonly email: string;
  readonly role: string;
  readonly requestId: string;
}

// Campo del esquema → data-testid del input (para enfocar el primero con error)
const REGISTER_FOCUS: Readonly<Record<string, string>> = {
  first: ACCESO_TESTIDS.REGISTER_FIRST_NAME,
  last: ACCESO_TESTIDS.REGISTER_LAST_NAME,
  email: ACCESO_TESTIDS.REGISTER_EMAIL,
  org: ACCESO_TESTIDS.REGISTER_ORG,
  password: ACCESO_TESTIDS.REGISTER_PASSWORD,
  confirm: ACCESO_TESTIDS.REGISTER_PASSWORD_CONFIRM,
  terms: ACCESO_TESTIDS.REGISTER_TERMS,
};

export const AccessPage = ({ routeView }: { routeView: RouteView }) => {
  const { t } = useI18n();
  const { publicApi, signIn } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const signedOut = (location.state as { signedOut?: boolean } | null)?.signedOut === true;

  const [login, setLogin] = useState({ email: '', password: '', remember: true });
  const [reg, setReg] = useState({ first: '', last: '', email: '', org: '', role: 'consultant' as RegisterRole, password: '', confirm: '', terms: false });
  const [errors, setErrors] = useState<Errors>({});
  const [serverError, setServerError] = useState<AuthErrorView | null>(null);
  const [busy, setBusy] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [mfa, setMfa] = useState<{ token: string; email: string; remember: boolean } | null>(null);
  const [mfaCode, setMfaCode] = useState('');
  const [forgotSent, setForgotSent] = useState(false);
  const [verified, setVerified] = useState<Verified | null>(null);
  const [redirecting, setRedirecting] = useState<Redirecting | null>(null);
  const [info, setInfo] = useState(signedOut);

  const emailRef = useRef<HTMLInputElement>(null);
  const mfaRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  const view = mfa ? 'mfa' : verified ? 'verify' : routeView;

  const resetTransient = useCallback(() => {
    setErrors({});
    setServerError(null);
    setBusy(false);
    setMfaCode('');
    setForgotSent(false);
    setInfo(false);
  }, []);

  const goTo = useCallback(
    (target: RouteView) => {
      resetTransient();
      setMfa(null);
      setVerified(null);
      navigate(`/${target}`);
    },
    [navigate, resetTransient],
  );

  // El cambio de vista mueve el foco al primer campo (correo o código MFA)
  useEffect(() => {
    (view === 'mfa' ? mfaRef : emailRef).current?.focus();
  }, [view]);

  // Esc vuelve a login desde cualquier subvista (salvo ocupado)
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && view !== 'login' && !busy) goTo('login');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [view, busy, goTo]);

  // Overlay de redirección: 1,4 s y entra en Programas con la sesión ya validada
  useEffect(() => {
    if (!redirecting) return;
    const timer = setTimeout(() => {
      signIn(redirecting.session, redirecting.remember);
      navigate('/programs', { replace: true });
    }, REDIRECT_MS);
    return () => clearTimeout(timer);
  }, [redirecting, signIn, navigate]);

  const fail = (error: unknown) => setServerError(toAuthError(error, t));

  const fieldErrors = Object.fromEntries(Object.entries(errors).map(([field, key]) => [field, t('acceso', key as 'required')]));

  const finishLogin = (session: SessionResponse, remember: boolean, endpoint: string) => {
    setRedirecting({ session, remember, endpoint });
  };

  const submitLogin = async (event: FormEvent) => {
    event.preventDefault();
    const parsed = loginSchema.safeParse(login);
    if (!parsed.success) return setErrors(flattenIssues(parsed.error.issues));
    setErrors({});
    setServerError(null);
    setInfo(false);
    setBusy(true);
    try {
      const response = await withMinDelay(publicApi.auth.login(parsed.data));
      if (response.mfaRequired) {
        setMfa({ token: response.mfaToken, email: response.email, remember: parsed.data.remember });
        setMfaCode('');
      } else {
        finishLogin(response, parsed.data.remember, 'POST /api/auth/login → 200');
      }
    } catch (error) {
      fail(error);
    } finally {
      setBusy(false);
    }
  };

  const submitMfa = async (event: FormEvent) => {
    event.preventDefault();
    if (!mfa || mfaCode.length !== 6) return;
    setServerError(null);
    setBusy(true);
    try {
      const session = await withMinDelay(publicApi.auth.mfa({ mfaToken: mfa.token, code: mfaCode }));
      finishLogin(session, mfa.remember, 'POST /api/auth/mfa → 200');
    } catch (error) {
      fail(error);
    } finally {
      setBusy(false);
    }
  };

  const submitForgot = async (event: FormEvent) => {
    event.preventDefault();
    const parsed = forgotSchema.safeParse({ email: login.email });
    if (!parsed.success) return setErrors(flattenIssues(parsed.error.issues));
    setErrors({});
    setBusy(true);
    try {
      await withMinDelay(publicApi.auth.forgot(parsed.data));
      setForgotSent(true);
    } catch (error) {
      fail(error);
    } finally {
      setBusy(false);
    }
  };

  const submitRegister = async (event: FormEvent) => {
    event.preventDefault();
    const parsed = registerSchema.safeParse(reg);
    if (!parsed.success) {
      const flat = flattenIssues(parsed.error.issues);
      setErrors(flat);
      const first = Object.keys(flat)[0];
      const testId = first ? REGISTER_FOCUS[first] : undefined;
      if (testId) rootRef.current?.querySelector<HTMLElement>(`[data-testid="${testId}"]`)?.focus();
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
      fail(error);
    } finally {
      setBusy(false);
    }
  };

  const onSso = async () => {
    const trace = await publicApi.auth.sso().then(
      () => '',
      (error: unknown) => toAuthError(error, t).trace,
    );
    toast.push('info', t('acceso', 'ssoToast'), trace);
  };

  const onResend = async () => {
    if (!verified) return;
    await publicApi.auth.resend(verified.email).catch(() => undefined);
    toast.push('ok', t('acceso', 'resent'), 'POST /api/auth/resend → 202');
  };

  const fillFromTestUser = (user: TestUserDto) => {
    resetTransient();
    setMfa(null);
    setVerified(null);
    setLogin((current) => ({ ...current, email: user.email, password: user.password }));
    if (routeView !== 'login') navigate('/login');
    setTimeout(() => emailRef.current?.focus(), 0);
  };

  const setLoginField = <K extends keyof typeof login>(key: K, value: (typeof login)[K]) => {
    setLogin((current) => ({ ...current, [key]: value }));
    setErrors({});
    setServerError(null);
  };
  const setRegField = <K extends keyof typeof reg>(key: K, value: (typeof reg)[K]) => {
    setReg((current) => ({ ...current, [key]: value }));
    setErrors({});
    setServerError(null);
  };

  const passType = showPass ? 'text' : 'password';
  const toggleLabel = showPass ? t('acceso', 'hidePw') : t('acceso', 'showPw');
  const toggleText = showPass ? t('acceso', 'hide') : t('acceso', 'show');
  const rules = passwordRules(reg.password);
  const score = rules.filter(Boolean).length;
  const strengthColor = ['var(--border)', 'var(--danger)', 'var(--warn)', 'var(--info)', 'var(--ok)'][score];
  const submitLabelBusy = (label: string) => (
    <>
      {busy ? <Spinner /> : null}
      {label}
    </>
  );

  const overlay = redirecting ? (
    <div
      data-testid={ACCESO_TESTIDS.AUTH_REDIRECTING}
      role="status"
      className="absolute inset-0 z-[70] flex flex-col items-center justify-center gap-3 bg-bg"
    >
      <span aria-hidden="true" className="spinner spinner-lg" />
      <span className="text-[12.5px] text-fg-2">{t('acceso', 'redirecting')}</span>
      <span className="font-mono text-[11px] text-fg-3">
        {redirecting.endpoint} · role={redirecting.session.user.role}
      </span>
    </div>
  ) : null;

  const strength = passwordStrength(reg.password);
  const strengthLabel = strength === 'none' ? '' : t('acceso', strength);
  const showTestUsers = view === 'login' || view === 'register';

  return (
    <AuthLayout overlay={overlay}>
      <div ref={rootRef} className="contents">
        {view === 'login' ? (
          <AuthForm testId={ACCESO_TESTIDS.LOGIN_FORM} busy={busy} onSubmit={submitLogin}>
            <AuthHeading title={t('acceso', 'signIn')} hint={t('acceso', 'signInHint')} />
            {serverError ? <ServerAlert error={serverError} testId={ACCESO_TESTIDS.LOGIN_ERROR} /> : null}
            {info ? (
              <div role="status" data-testid={ACCESO_TESTIDS.LOGIN_INFO} className="alert alert-ok text-[12.5px]">
                {t('acceso', 'signedOut')}
              </div>
            ) : null}
            <TextField
              id="login-email"
              label={t('acceso', 'email')}
              type="email"
              autoComplete="username"
              testId={ACCESO_TESTIDS.LOGIN_EMAIL}
              errorTestId={ACCESO_TESTIDS.LOGIN_EMAIL_ERROR}
              value={login.email}
              onValueChange={(value) => setLoginField('email', value)}
              error={fieldErrors.email}
              inputRef={emailRef}
            />
            <TextField
              id="login-password"
              label={t('acceso', 'password')}
              type={passType}
              autoComplete="current-password"
              testId={ACCESO_TESTIDS.LOGIN_PASSWORD}
              errorTestId={ACCESO_TESTIDS.LOGIN_PASSWORD_ERROR}
              value={login.password}
              onValueChange={(value) => setLoginField('password', value)}
              error={fieldErrors.password}
              labelAside={
                <button type="button" data-testid={ACCESO_TESTIDS.LOGIN_FORGOT} onClick={() => goTo('forgot')} className="link-btn text-[12px]">
                  {t('acceso', 'forgot')}
                </button>
              }
              endSlot={
                <PasswordToggle
                  testId={ACCESO_TESTIDS.LOGIN_TOGGLE_PASSWORD}
                  label={toggleLabel}
                  pressed={showPass}
                  text={toggleText}
                  onToggle={() => setShowPass((current) => !current)}
                />
              }
            />
            <label className="flex cursor-pointer items-center gap-2 text-[12.5px]">
              <input
                type="checkbox"
                data-testid={ACCESO_TESTIDS.LOGIN_REMEMBER}
                checked={login.remember}
                onChange={(event) => setLoginField('remember', event.target.checked)}
                className="m-0 size-4 accent-accent"
              />
              {t('acceso', 'remember')}
            </label>
            <button
              type="submit"
              data-testid={ACCESO_TESTIDS.LOGIN_SUBMIT}
              disabled={busy}
              title={busy ? t('common', 'processing') : undefined}
              className="btn btn-primary btn-wide btn-lg"
            >
              {submitLabelBusy(t('acceso', 'signInBtn'))}
            </button>
            <div className="flex items-center gap-2.5 text-[11.5px] text-fg-3">
              <span className="h-px flex-1 bg-border" />
              {t('acceso', 'or')}
              <span className="h-px flex-1 bg-border" />
            </div>
            <button type="button" data-testid={ACCESO_TESTIDS.LOGIN_SSO} onClick={() => void onSso()} className="btn btn-secondary btn-wide">
              <span aria-hidden="true" className="grid size-4 place-items-center rounded-[3px] border-[1.5px] border-current text-[8px] font-semibold">
                ID
              </span>
              {t('acceso', 'sso')}
            </button>
            <p className="mt-1 mb-0 text-center text-[12.5px] text-fg-2">
              {t('acceso', 'noAccount')}{' '}
              <button type="button" data-testid={ACCESO_TESTIDS.LOGIN_GO_REGISTER} onClick={() => goTo('register')} className="link-btn font-medium">
                {t('acceso', 'requestAccess')}
              </button>
            </p>
          </AuthForm>
        ) : null}

        {view === 'mfa' && mfa ? (
          <AuthForm testId={ACCESO_TESTIDS.MFA_FORM} busy={busy} onSubmit={submitMfa}>
            <AuthHeading title={t('acceso', 'mfaTitle')} hint={`${t('acceso', 'mfaHint')} ${mfa.email}.`} />
            {serverError ? <ServerAlert error={serverError} testId={ACCESO_TESTIDS.MFA_ERROR} /> : null}
            <TextField
              id="mfa-code"
              label={t('acceso', 'mfaCode')}
              testId={ACCESO_TESTIDS.MFA_CODE}
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder="000000"
              value={mfaCode}
              onValueChange={(value) => {
                setMfaCode(value.replace(/\D/g, '').slice(0, 6));
                setServerError(null);
              }}
              help={t('acceso', 'mfaDemo')}
              inputRef={mfaRef}
              inputClassName="!h-11 !px-3 text-center font-mono !text-[22px] tracking-[.4em]"
            />
            <button
              type="submit"
              data-testid={ACCESO_TESTIDS.MFA_SUBMIT}
              disabled={busy || mfaCode.length !== 6}
              title={busy ? t('common', 'processing') : mfaCode.length !== 6 ? t('common', 'mfaIncomplete') : undefined}
              className="btn btn-primary btn-wide btn-lg"
            >
              {submitLabelBusy(t('acceso', 'verify'))}
            </button>
            <button type="button" data-testid={ACCESO_TESTIDS.MFA_BACK} onClick={() => goTo('login')} className="btn btn-ghost btn-wide">
              {t('acceso', 'backToLogin')}
            </button>
          </AuthForm>
        ) : null}

        {view === 'forgot' ? (
          <AuthForm testId={ACCESO_TESTIDS.FORGOT_FORM} busy={busy} onSubmit={submitForgot}>
            <AuthHeading title={t('acceso', 'forgotTitle')} hint={t('acceso', 'forgotHint')} />
            {forgotSent ? (
              <div role="status" data-testid={ACCESO_TESTIDS.FORGOT_SENT} className="alert alert-ok text-[12.5px]">
                {t('acceso', 'forgotSent')}
              </div>
            ) : null}
            <TextField
              id="forgot-email"
              label={t('acceso', 'email')}
              type="email"
              testId={ACCESO_TESTIDS.FORGOT_EMAIL}
              errorTestId={ACCESO_TESTIDS.FORGOT_EMAIL_ERROR}
              value={login.email}
              onValueChange={(value) => setLoginField('email', value)}
              error={fieldErrors.email}
              inputRef={emailRef}
            />
            <button
              type="submit"
              data-testid={ACCESO_TESTIDS.FORGOT_SUBMIT}
              disabled={busy}
              title={busy ? t('common', 'processing') : undefined}
              className="btn btn-primary btn-wide btn-lg"
            >
              {submitLabelBusy(t('acceso', 'sendLink'))}
            </button>
            <button type="button" data-testid={ACCESO_TESTIDS.FORGOT_BACK} onClick={() => goTo('login')} className="btn btn-ghost btn-wide">
              {t('acceso', 'backToLogin')}
            </button>
          </AuthForm>
        ) : null}

        {view === 'register' ? (
          <AuthForm testId={ACCESO_TESTIDS.REGISTER_FORM} busy={busy} onSubmit={submitRegister} wide>
            <AuthHeading title={t('acceso', 'registerTitle')} hint={t('acceso', 'registerHint')} />
            {serverError ? <ServerAlert error={serverError} testId={ACCESO_TESTIDS.REGISTER_ERROR} /> : null}
            <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3">
              <TextField
                id="register-first-name"
                label={t('acceso', 'firstName')}
                autoComplete="given-name"
                testId={ACCESO_TESTIDS.REGISTER_FIRST_NAME}
                errorTestId={ACCESO_TESTIDS.REGISTER_FIRST_NAME_ERROR}
                value={reg.first}
                onValueChange={(value) => setRegField('first', value)}
                error={fieldErrors.first}
                inputRef={emailRef}
              />
              <TextField
                id="register-last-name"
                label={t('acceso', 'lastName')}
                autoComplete="family-name"
                testId={ACCESO_TESTIDS.REGISTER_LAST_NAME}
                errorTestId={ACCESO_TESTIDS.REGISTER_LAST_NAME_ERROR}
                value={reg.last}
                onValueChange={(value) => setRegField('last', value)}
                error={fieldErrors.last}
              />
            </div>
            <TextField
              id="register-email"
              label={t('acceso', 'workEmail')}
              type="email"
              autoComplete="email"
              placeholder="nombre@organizacion.es"
              testId={ACCESO_TESTIDS.REGISTER_EMAIL}
              errorTestId={ACCESO_TESTIDS.REGISTER_EMAIL_ERROR}
              value={reg.email}
              onValueChange={(value) => setRegField('email', value)}
              error={fieldErrors.email}
              help={t('acceso', 'emailHelp')}
            />
            <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3">
              <TextField
                id="register-org"
                label={t('acceso', 'org')}
                autoComplete="organization"
                testId={ACCESO_TESTIDS.REGISTER_ORG}
                errorTestId={ACCESO_TESTIDS.REGISTER_ORG_ERROR}
                value={reg.org}
                onValueChange={(value) => setRegField('org', value)}
                error={fieldErrors.org}
              />
              <div className="flex flex-col gap-1">
                <label htmlFor="register-role" className="label">
                  {t('acceso', 'requestedRole')}
                </label>
                <select
                  id="register-role"
                  data-testid={ACCESO_TESTIDS.REGISTER_ROLE}
                  value={reg.role}
                  onChange={(event) => setRegField('role', event.target.value as RegisterRole)}
                  aria-describedby="register-role-help"
                  className="input"
                >
                  {REGISTER_ROLES.map((role) => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))}
                </select>
                <span id="register-role-help" className="field-help">
                  {t('acceso', 'roleHelp')}
                </span>
              </div>
            </div>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3">
              <TextField
                id="register-password"
                label={t('acceso', 'password')}
                type={passType}
                autoComplete="new-password"
                testId={ACCESO_TESTIDS.REGISTER_PASSWORD}
                errorTestId={ACCESO_TESTIDS.REGISTER_PASSWORD_ERROR}
                value={reg.password}
                onValueChange={(value) => setRegField('password', value)}
                error={fieldErrors.password}
                endSlot={
                  <PasswordToggle
                    testId={ACCESO_TESTIDS.REGISTER_TOGGLE_PASSWORD}
                    label={toggleLabel}
                    pressed={showPass}
                    text={toggleText}
                    onToggle={() => setShowPass((current) => !current)}
                  />
                }
              />
              <TextField
                id="register-password-confirm"
                label={t('acceso', 'confirmPassword')}
                type={passType}
                autoComplete="new-password"
                testId={ACCESO_TESTIDS.REGISTER_PASSWORD_CONFIRM}
                errorTestId={ACCESO_TESTIDS.REGISTER_PASSWORD_CONFIRM_ERROR}
                value={reg.confirm}
                onValueChange={(value) => setRegField('confirm', value)}
                error={fieldErrors.confirm}
              />
            </div>
            <div data-testid={ACCESO_TESTIDS.REGISTER_PASSWORD_METER} data-strength={strength} className="flex flex-col gap-1.5">
              <div className="flex gap-1" aria-hidden="true">
                {[1, 2, 3, 4].map((segment) => (
                  <span key={segment} className="h-1 flex-1 rounded-[2px]" style={{ background: segment <= score && score > 0 ? strengthColor : 'var(--border)' }} />
                ))}
              </div>
              <span className="sr-only">{strengthLabel}</span>
              <ul className="m-0 grid list-none grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-x-3 gap-y-0.5 p-0 text-[11.5px]">
                {(['r1', 'r2', 'r3', 'r4'] as const).map((key, index) => (
                  <li key={key} data-ok={rules[index]} className="flex items-center gap-1" style={{ color: rules[index] ? 'var(--ok)' : 'var(--text-3)' }}>
                    <span aria-hidden="true" className="inline-block w-3 font-mono">
                      {rules[index] ? '✓' : '·'}
                    </span>
                    {t('acceso', key)}
                  </li>
                ))}
              </ul>
            </div>
            <label className="flex cursor-pointer items-start gap-2 text-[12.5px]">
              <input
                type="checkbox"
                data-testid={ACCESO_TESTIDS.REGISTER_TERMS}
                aria-invalid={errors.terms ? true : undefined}
                checked={reg.terms}
                onChange={(event) => setRegField('terms', event.target.checked)}
                className="mt-0.5 mr-0 mb-0 ml-0 size-4 flex-none accent-accent"
              />
              <span>
                {t('acceso', 'terms1')}{' '}
                <a href="/legal/terms" target="_blank" rel="noopener" data-testid={ACCESO_TESTIDS.REGISTER_TERMS_LINK}>
                  {t('acceso', 'terms2')}
                </a>{' '}
                {t('acceso', 'terms3')} <a href="/legal/privacy" target="_blank" rel="noopener" data-testid={DETALLE_TESTIDS.REGISTER_PRIVACY_LINK}>
                  {t('acceso', 'terms4')}
                </a>.
              </span>
            </label>
            {fieldErrors.terms ? (
              <span data-testid={ACCESO_TESTIDS.REGISTER_TERMS_ERROR} className="field-error -mt-2">
                {fieldErrors.terms}
              </span>
            ) : null}
            <div className="flex justify-between gap-2 border-t border-border pt-2">
              <button type="button" data-testid={ACCESO_TESTIDS.REGISTER_BACK} onClick={() => goTo('login')} className="btn btn-ghost">
                {t('acceso', 'backToLogin')}
              </button>
              <button
                type="submit"
                data-testid={ACCESO_TESTIDS.REGISTER_SUBMIT}
                disabled={busy}
                title={busy ? t('common', 'processing') : undefined}
                className="btn btn-primary"
              >
                {submitLabelBusy(t('acceso', 'registerBtn'))}
              </button>
            </div>
            <p className="m-0 text-[11.5px] text-fg-3">{t('acceso', 'registerServerHint')}</p>
          </AuthForm>
        ) : null}

        {view === 'verify' && verified ? (
          <AuthPanel testId={ACCESO_TESTIDS.VERIFY_PANEL}>
            <div aria-hidden="true" className="grid size-9 place-items-center rounded-full bg-ok-soft font-semibold text-ok">
              ✓
            </div>
            <AuthHeading title={t('acceso', 'verifyTitle')} hint={`${t('acceso', 'verifyText')} ${verified.email}.`} />
            <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-3.5 gap-y-1.5 rounded-card border border-border bg-surface-2 p-3 text-[12px]">
              <dt className="text-fg-3">{t('acceso', 'status')}</dt>
              <dd className="m-0">
                <span data-testid={ACCESO_TESTIDS.VERIFY_STATUS_BADGE} className="badge" data-tone="warn" data-state="pending_approval">
                  {t('acceso', 'pendingApproval')}
                </span>
              </dd>
              <dt className="text-fg-3">{t('acceso', 'requestedRole')}</dt>
              <dd className="m-0 font-mono">{verified.role}</dd>
              <dt className="text-fg-3">ID</dt>
              <dd className="m-0 font-mono">{verified.requestId}</dd>
            </dl>
            <button type="button" data-testid={ACCESO_TESTIDS.VERIFY_RESEND} onClick={() => void onResend()} className="btn btn-secondary btn-wide">
              {t('acceso', 'resend')}
            </button>
            <button type="button" data-testid={ACCESO_TESTIDS.VERIFY_BACK} onClick={() => goTo('login')} className="btn btn-ghost btn-wide">
              {t('acceso', 'backToLogin')}
            </button>
          </AuthPanel>
        ) : null}

        {showTestUsers ? <TestUsers onPick={fillFromTestUser} /> : null}
      </div>
    </AuthLayout>
  );
};

