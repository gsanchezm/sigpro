import {
  ApiError,
  LAB_DYNAMIC_TESTIDS,
  LAB_TESTIDS,
  can,
  type ChaosConfig,
  type TenantInfo,
  type TestUserDto,
} from '@sigpro/shared';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_URL, getTenant, setTenant } from '../../lib/env';
import { formatTrace } from '../../lib/errors';
import { useAuth } from '../../state/auth';
import { useConfig, useSaveLabel } from '../../state/config';
import { useI18n } from '../../state/i18n';
import { useToast } from '../../state/toast';
import { ACCESS_LABEL, LAB_ENDPOINTS, docsLinks } from './endpoints';

const sectionTitle = 'm-0 text-[15px] font-semibold';
const hint = 'm-0 text-[12.5px] text-fg-2';

type Health = 'checking' | 'ok' | 'down';

/** Descarga del proyecto de `examples/`: el zip lo genera `scripts/zip-examples.mjs` en cada build (y al arrancar `dev`). */
const EXAMPLES_ZIP = `${import.meta.env.BASE_URL}downloads/sigpro-examples.zip`;

/** Preguntas de la FAQ: pares de claves de i18n (las tres primeras son las de la fase 1). */
const FAQ_KEYS = [
  ['faqQ1', 'faqA1'],
  ['faqQ2', 'faqA2'],
  ['faqQ3', 'faqA3'],
  ['faqQ4', 'faqA4'],
  ['faqQ5', 'faqA5'],
  ['faqQ6', 'faqA6'],
  ['faqQ7', 'faqA7'],
  ['faqQ8', 'faqA8'],
] as const;

/** Un usuario `alumnoNN@sigpro.lab` por tenant de alumno; para `demo` u otros se muestra la plantilla. */
const studentEmail = (tenant: string): string => (/^alumno\d+$/.test(tenant) ? `${tenant}@sigpro.lab` : 'alumnoNN@sigpro.lab');

/** Página /lab: credenciales de demo, tenants, reset, modo caos, contraejemplos y FAQ. Pública (sirve también antes de iniciar sesión). */
export const LabPage = () => {
  const { t } = useI18n();
  const { user, api, publicApi, signOut } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const isAdmin = user ? can(user.role, 'users.manage') : false;

  const [tenant, setTenantState] = useState(getTenant());
  const [tenants, setTenants] = useState<readonly TenantInfo[]>([]);
  const [testUsers, setTestUsers] = useState<readonly TestUserDto[] | null>(null);
  const [health, setHealth] = useState<Health>('checking');
  const [chaos, setChaos] = useState<ChaosConfig>({ latencyMs: 0, errorRate: 0, flakyLabels: false });
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const { flakyLabels } = useConfig();
  const flakySaveLabel = useSaveLabel();
  const docs = docsLinks(API_URL);

  useEffect(() => {
    let alive = true;
    publicApi.config.tenants().then((list) => alive && setTenants(list), () => undefined);
    publicApi.config.testUsers().then((list) => alive && setTestUsers(list), () => alive && setTestUsers([]));
    publicApi.health().then(
      () => alive && setHealth('ok'),
      () => alive && setHealth('down'),
    );
    return () => {
      alive = false;
    };
  }, [publicApi]);

  useEffect(() => {
    if (!isAdmin) return;
    let alive = true;
    api.admin.getChaos().then((current) => alive && setChaos(current), () => undefined);
    return () => {
      alive = false;
    };
  }, [api, isAdmin]);

  const attempt = useCallback(
    async (work: () => Promise<void>) => {
      setBusy(true);
      try {
        await work();
      } catch (failure) {
        toast.push('danger', t('common', 'genericError'), formatTrace(failure) || (failure instanceof ApiError ? failure.message : t('common', 'networkError')));
      } finally {
        setBusy(false);
      }
    },
    [toast, t],
  );

  const switchTenant = async () => {
    setTenant(tenant);
    if (user) await signOut();
    toast.push('info', t('lab', 'tenantInfo', { tenant }));
    if (user) navigate('/login');
  };

  const reset = () => {
    // Diálogo NATIVO a propósito (el borrado de programas usa un alertdialog propio): page.on('dialog')
    if (!window.confirm(t('lab', 'resetConfirm'))) return;
    void attempt(async () => {
      const result = await api.admin.reset();
      toast.push('ok', t('lab', 'resetDone'), `${result.tenant} · ${result.ms} ms`);
    });
  };

  const applyChaos = (next: ChaosConfig) =>
    attempt(async () => {
      setChaos(await api.admin.setChaos(next));
      toast.push('ok', t('lab', 'chaosApplied'));
    });

  const credentialNote = (u: TestUserDto): string => (u.status === 'locked' ? t('lab', 'noteLocked') : u.status === 'pending' ? t('lab', 'notePending') : u.mfa ? t('lab', 'noteMfa') : t('lab', 'noteNone'));
  const faq = FAQ_KEYS.map(([question, answer]) => ({ q: t('lab', question), a: t('lab', answer) }));
  const resetTitle = isAdmin ? undefined : t('lab', 'resetNeedsLogin');
  const chaosTitle = isAdmin ? undefined : t('lab', 'chaosNeedsLogin');

  return (
    <div data-testid={LAB_TESTIDS.LAB_PAGE} className="flex max-w-[980px] flex-col gap-5">
      <header className="flex flex-col gap-1">
        <h1 className="m-0 text-[20px] font-semibold tracking-[-.01em]">{t('lab', 'title')}</h1>
        <p className={hint}>{t('lab', 'subtitle')}</p>
        <p data-testid={LAB_TESTIDS.LAB_TENANT_INFO} className="m-0 font-mono text-[12px] text-fg-2">
          {t('lab', 'tenantInfo', { tenant: getTenant() })}
        </p>
      </header>

      <section aria-labelledby="lab-credentials-title" className="card flex flex-col gap-3 p-4">
        <div>
          <h2 id="lab-credentials-title" className={sectionTitle}>
            {t('lab', 'credentials')}
          </h2>
          <p className={hint}>{t('lab', 'credentialsHint')}</p>
        </div>
        <div className="overflow-x-auto">
          <table data-testid={LAB_TESTIDS.LAB_CREDENTIALS} aria-busy={testUsers === null} className="w-full min-w-[640px] border-collapse text-[12.5px]">
            <thead>
              <tr className="border-b border-border bg-surface-2 text-left text-[11.5px] tracking-[.04em] text-fg-2 uppercase">
                {(['colName', 'colEmail', 'colPassword', 'colRole', 'colNote'] as const).map((key) => (
                  <th key={key} scope="col" className="h-8 px-2 font-medium">
                    {t('lab', key)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {testUsers === null
                ? Array.from({ length: 3 }, (_, index) => (
                    <tr key={index} aria-hidden="true" className="h-9 border-b border-border">
                      <td colSpan={5} className="px-2">
                        <span className="skeleton h-3 w-2/3" />
                      </td>
                    </tr>
                  ))
                : testUsers.map((u) => (
                    <tr key={u.id} data-testid={LAB_DYNAMIC_TESTIDS.LAB_CREDENTIAL(u.role, u.status === 'active' ? undefined : u.status)} className="h-9 border-b border-border last:border-b-0">
                      <td className="px-2">{u.name}</td>
                      <td className="px-2 font-mono text-[12px]">{u.email}</td>
                      <td className="px-2 font-mono text-[12px]">{u.password}</td>
                      <td className="px-2">
                        <span className="pill" data-tone={u.role === 'admin' ? 'info' : 'neutral'}>
                          {u.role}
                        </span>
                      </td>
                      <td className="px-2 text-fg-2">{credentialNote(u)}</td>
                    </tr>
                  ))}
              {testUsers !== null && testUsers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-2 py-4 text-fg-2">
                    —
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <p data-testid={LAB_TESTIDS.LAB_STUDENT_USER} className="m-0 flex flex-col gap-0.5">
          <span className="font-mono text-[12px]">{t('lab', 'studentUser', { email: studentEmail(getTenant()), password: 'Alumno1234!' })}</span>
          <span className={hint}>{t('lab', 'studentUserHint')}</span>
        </p>
      </section>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(320px,1fr))] gap-5">
        <section aria-labelledby="lab-tenants-title" className="card flex flex-col gap-3 p-4">
          <div>
            <h2 id="lab-tenants-title" className={sectionTitle}>
              {t('lab', 'tenants')}
            </h2>
            <p className={hint}>{t('lab', 'tenantsHint')}</p>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="lab-tenant-select" className="label">
              {t('lab', 'tenantSelect')}
            </label>
            <select id="lab-tenant-select" data-testid={LAB_TESTIDS.LAB_TENANT_SELECT} value={tenant} onChange={(event) => setTenantState(event.target.value)} className="input">
              {(tenants.length > 0 ? tenants : [{ id: tenant, name: tenant }]).map((item) => (
                <option key={item.id} value={item.id}>
                  {item.id}
                </option>
              ))}
            </select>
          </div>
          <button type="button" data-testid={LAB_TESTIDS.LAB_TENANT_USE} onClick={() => void switchTenant()} className="btn btn-secondary self-start">
            {t('lab', 'tenantUse')}
          </button>
        </section>

        <section aria-labelledby="lab-reset-title" className="card flex flex-col gap-3 p-4">
          <div>
            <h2 id="lab-reset-title" className={sectionTitle}>
              {t('lab', 'reset')}
            </h2>
            <p className={hint}>{t('lab', 'resetHint')}</p>
          </div>
          <button type="button" data-testid={LAB_TESTIDS.LAB_RESET} onClick={reset} disabled={!isAdmin || busy} title={busy ? t('common', 'processing') : resetTitle} className="btn btn-danger self-start">
            {t('lab', 'resetButton')}
          </button>
        </section>
      </div>

      <section aria-labelledby="lab-chaos-title" className="card flex flex-col gap-3 p-4">
        <div>
          <h2 id="lab-chaos-title" className={sectionTitle}>
            {t('lab', 'chaos')}
          </h2>
          <p className={hint}>{t('lab', 'chaosHint')}</p>
        </div>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-3">
          <div className="flex flex-col gap-1">
            <label htmlFor="lab-chaos-latency" className="label">
              {t('lab', 'chaosLatency')}
            </label>
            <input
              id="lab-chaos-latency"
              type="number"
              min={0}
              max={5000}
              step={100}
              data-testid={LAB_TESTIDS.LAB_CHAOS_LATENCY}
              value={chaos.latencyMs}
              disabled={!isAdmin}
              title={chaosTitle}
              onChange={(event) => setChaos({ ...chaos, latencyMs: Number(event.target.value) })}
              className="input"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="lab-chaos-error-rate" className="label">
              {t('lab', 'chaosErrorRate')}
            </label>
            <input
              id="lab-chaos-error-rate"
              type="number"
              min={0}
              max={1}
              step={0.1}
              data-testid={LAB_TESTIDS.LAB_CHAOS_ERROR_RATE}
              value={chaos.errorRate}
              disabled={!isAdmin}
              title={chaosTitle}
              onChange={(event) => setChaos({ ...chaos, errorRate: Number(event.target.value) })}
              className="input"
            />
          </div>
        </div>
        <label className="flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            data-testid={LAB_TESTIDS.LAB_CHAOS_FLAKY}
            checked={chaos.flakyLabels}
            disabled={!isAdmin}
            title={chaosTitle}
            onChange={(event) => setChaos({ ...chaos, flakyLabels: event.target.checked })}
            className="m-0 size-4 accent-accent"
          />
          {t('lab', 'chaosFlaky')}
        </label>
        <div className="flex gap-2">
          <button type="button" data-testid={LAB_TESTIDS.LAB_CHAOS_APPLY} onClick={() => void applyChaos(chaos)} disabled={!isAdmin || busy} title={busy ? t('common', 'processing') : chaosTitle} className="btn btn-primary">
            {t('lab', 'chaosApply')}
          </button>
          <button
            type="button"
            data-testid={LAB_TESTIDS.LAB_CHAOS_OFF}
            onClick={() => void applyChaos({ latencyMs: 0, errorRate: 0, flakyLabels: false })}
            disabled={!isAdmin || busy}
            title={busy ? t('common', 'processing') : chaosTitle}
            className="btn btn-secondary"
          >
            {t('lab', 'chaosOff')}
          </button>
        </div>
      </section>

      <section aria-labelledby="lab-endpoints-title" data-testid={LAB_TESTIDS.LAB_ENDPOINTS} className="card flex flex-col gap-3 p-4">
        <div>
          <h2 id="lab-endpoints-title" className={sectionTitle}>
            {t('lab', 'endpoints')}
          </h2>
          <p className={hint}>{t('lab', 'endpointsHint', { base: API_URL })}</p>
        </div>
        <div className="flex flex-wrap gap-3 text-[12.5px]">
          <a href={docs.swagger} target="_blank" rel="noreferrer" data-testid={LAB_TESTIDS.LAB_ENDPOINTS_SWAGGER}>
            {t('lab', 'endpointsSwagger')}
          </a>
          <a href={docs.json} target="_blank" rel="noreferrer" data-testid={LAB_TESTIDS.LAB_ENDPOINTS_JSON}>
            {t('lab', 'endpointsJson')}
          </a>
        </div>
        <div className="overflow-x-auto">
          <table data-testid={LAB_TESTIDS.LAB_ENDPOINTS_TABLE} aria-label={t('lab', 'endpoints')} className="w-full min-w-[720px] border-collapse text-[12.5px]">
            <thead>
              <tr className="border-b border-border bg-surface-2 text-left text-[11.5px] tracking-[.04em] text-fg-2 uppercase">
                {(['colMethod', 'colPath', 'colAccess', 'colWhat'] as const).map((key) => (
                  <th key={key} scope="col" className="h-8 px-2 font-medium">
                    {t('lab', key)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {LAB_ENDPOINTS.map((endpoint) => (
                <tr key={endpoint.id} data-testid={LAB_DYNAMIC_TESTIDS.LAB_ENDPOINT(endpoint.id)} data-method={endpoint.method} className="h-9 border-b border-border last:border-b-0">
                  <td className="px-2 font-mono text-[12px] font-semibold">{endpoint.method}</td>
                  <td className="px-2 font-mono text-[12px]">{endpoint.path}</td>
                  <td className="px-2">
                    <span className="pill" data-tone={endpoint.access === 'public' ? 'ok' : endpoint.access === 'admin' ? 'info' : 'neutral'} data-access={endpoint.access}>
                      {t('lab', ACCESS_LABEL[endpoint.access])}
                    </span>
                  </td>
                  <td className="px-2 text-fg-2">{t('lab', endpoint.description)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="lab-counter-title" className="card flex flex-col gap-3 p-4">
        <div>
          <h2 id="lab-counter-title" className={sectionTitle}>
            {t('lab', 'counterExamples')}
          </h2>
          <p className={hint}>{t('lab', 'counterExamplesHint')}</p>
        </div>
        <div className="flex flex-col gap-1">
          <span className="label">{t('lab', 'xpathExample')}</span>
          <table data-testid={LAB_TESTIDS.LAB_XPATH_TABLE} className="w-full max-w-[420px] border-collapse font-mono text-[12px]">
            <tbody>
              {['PRG-003', 'PRG-004', 'PRG-005'].map((code) => (
                <tr key={code} className="h-7 border-b border-border">
                  <td className="px-2">{code}</td>
                  <td className="px-2 text-fg-2">…</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className={hint}>{t('lab', 'xpathWhy')}</p>
        </div>
        <div role="group" aria-labelledby="lab-overlap-title" className="flex flex-col gap-2">
          <span id="lab-overlap-title" className="label">
            {t('lab', 'overlapExample')}
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" data-testid={LAB_TESTIDS.LAB_OVERLAP_SAVE} className="btn btn-primary" onClick={() => toast.push('ok', t('lab', 'overlapSave'))}>
              {t('lab', 'overlapSave')}
            </button>
            <button type="button" data-testid={LAB_TESTIDS.LAB_OVERLAP_SAVE_CLOSE} className="btn btn-secondary" onClick={() => toast.push('ok', t('lab', 'overlapSaveClose'))}>
              {t('lab', 'overlapSaveClose')}
            </button>
            <span data-testid={LAB_TESTIDS.LAB_OVERLAP_ACTIVE} className="badge" data-tone="info" data-state="active">
              {t('lab', 'overlapActive')}
            </span>
            <span data-testid={LAB_TESTIDS.LAB_OVERLAP_ACTIVE_COUNT} className="badge" data-tone="info" data-state="active-count">
              {t('lab', 'overlapActiveCount')}
            </span>
          </div>
        </div>
        <div role="group" aria-labelledby="lab-flaky-title" data-testid={LAB_TESTIDS.LAB_FLAKY_GROUP} className="flex flex-col gap-2">
          <span id="lab-flaky-title" className="label">
            {t('lab', 'flakyExample')}
          </span>
          <div className="flex flex-wrap items-center gap-2">
            {/* El texto de este botón lo decide el modo caos (useSaveLabel): es justo lo que NO se debe localizar por texto exacto */}
            <button type="button" data-testid={LAB_TESTIDS.LAB_FLAKY_SAVE} className="btn btn-primary" onClick={() => toast.push('ok', t('lab', 'flakySaved'))}>
              {flakySaveLabel}
            </button>
            <span data-testid={LAB_TESTIDS.LAB_FLAKY_STATE} data-state={flakyLabels ? 'on' : 'off'} className="badge" data-tone={flakyLabels ? 'warn' : 'neutral'}>
              {flakyLabels ? t('lab', 'flakyStateOn') : t('lab', 'flakyStateOff')}
            </span>
          </div>
          <p className={hint}>{t('lab', 'flakyExampleHint')}</p>
        </div>
      </section>

      <section aria-labelledby="lab-material-title" data-testid={LAB_TESTIDS.LAB_COURSE_MATERIAL} className="card flex flex-col gap-3 p-4">
        <div>
          <h2 id="lab-material-title" className={sectionTitle}>
            {t('lab', 'courseMaterial')}
          </h2>
          <p className={hint}>{t('lab', 'courseMaterialHint')}</p>
        </div>
        <ul className="m-0 flex list-disc flex-col gap-0.5 pl-5 text-[12.5px] text-fg-2">
          <li>{t('lab', 'courseMaterialIncludes1')}</li>
          <li>{t('lab', 'courseMaterialIncludes2')}</li>
          <li>{t('lab', 'courseMaterialIncludes3')}</li>
        </ul>
        <a href={EXAMPLES_ZIP} download="sigpro-examples.zip" data-testid={LAB_TESTIDS.LAB_DOWNLOAD_EXAMPLES} className="btn btn-secondary self-start no-underline">
          {t('lab', 'downloadExamples')}
        </a>
      </section>

      <section aria-labelledby="lab-faq-title" data-testid={LAB_TESTIDS.LAB_FAQ} className="card flex flex-col gap-2 p-4">
        <h2 id="lab-faq-title" className={sectionTitle}>
          {t('lab', 'faq')}
        </h2>
        {faq.map((item, index) => {
          const open = openFaq === index;
          return (
            <div key={item.q} data-testid={LAB_DYNAMIC_TESTIDS.LAB_FAQ_ITEM(index + 1)} className="border-b border-border pb-2 last:border-b-0">
              <h3 className="m-0">
                <button
                  type="button"
                  id={`faq-button-${index}`}
                  data-testid={LAB_DYNAMIC_TESTIDS.LAB_FAQ_TOGGLE(index + 1)}
                  aria-expanded={open}
                  aria-controls={`faq-panel-${index}`}
                  onClick={() => setOpenFaq(open ? null : index)}
                  className="flex w-full cursor-pointer items-center justify-between gap-2 border-0 bg-transparent px-0 py-1 text-left text-[13px] font-medium text-fg"
                >
                  {item.q}
                  <span aria-hidden="true" className="text-fg-3">
                    {open ? '−' : '+'}
                  </span>
                </button>
              </h3>
              {open ? (
                <div id={`faq-panel-${index}`} role="region" aria-labelledby={`faq-button-${index}`} className="pt-1 text-[12.5px] text-fg-2">
                  {item.a}
                </div>
              ) : null}
            </div>
          );
        })}
      </section>

      <footer className="flex flex-wrap items-center gap-4 text-[12.5px] text-fg-2">
        <a href={docs.swagger} target="_blank" rel="noreferrer" data-testid={LAB_TESTIDS.LAB_API_DOCS}>
          {t('lab', 'apiDocs')}
        </a>
        <span data-testid={LAB_TESTIDS.LAB_HEALTH} data-state={health} role="status" className="badge" data-tone={health === 'ok' ? 'ok' : health === 'down' ? 'danger' : 'neutral'}>
          {health === 'ok' ? t('lab', 'healthOk') : health === 'down' ? t('lab', 'healthDown') : t('common', 'loading')}
        </span>
      </footer>
    </div>
  );
};
