import { ADMIN_DYNAMIC_TESTIDS, ADMIN_TESTIDS, can } from '@sigpro/shared';
import type { KeyboardEvent, ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../state/auth';
import { useI18n } from '../../state/i18n';
import { AuditFeed } from '../audit/AuditFeed';
import { ChaosPanel } from './ChaosPanel';
import { DataPanel } from './DataPanel';
import { UsersPanel } from './UsersPanel';

type TabKey = 'users' | 'audit' | 'chaos' | 'data';
const TABS: readonly TabKey[] = ['users', 'audit', 'chaos', 'data'];

const isTab = (value: string | null): value is TabKey => (TABS as readonly (string | null)[]).includes(value);

/** Administración (solo admin): usuarios, auditoría con rango de fechas, modo caos y reinicio de datos del tenant. */
export const AdminPage = () => {
  const { t } = useI18n();
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const allowed = user ? can(user.role, 'users.manage') : false;
  const requested = params.get('tab');
  const tab: TabKey = isTab(requested) ? requested : 'users';

  const select = (next: TabKey) => setParams(next === 'users' ? {} : { tab: next }, { replace: true });

  if (!allowed) {
    return (
      <section role="alert" data-testid={ADMIN_TESTIDS.ADMIN_FORBIDDEN} className="alert alert-warn flex max-w-[560px] flex-col gap-1">
        <h1 className="m-0 text-[16px] font-semibold">{t('admin', 'forbidden')}</h1>
        <p className="m-0">{t('admin', 'forbiddenBody')}</p>
        <Link to="/programs" data-testid={ADMIN_TESTIDS.ADMIN_FORBIDDEN_BACK} className="mt-1 self-start text-[12.5px] font-medium">
          {t('common', 'backToPrograms')}
        </Link>
      </section>
    );
  }

  const onKeyDown = (key: TabKey, event: KeyboardEvent) => {
    const index = TABS.indexOf(key);
    const target: Readonly<Record<string, TabKey | undefined>> = {
      ArrowRight: TABS[(index + 1) % TABS.length],
      ArrowLeft: TABS[(index + TABS.length - 1) % TABS.length],
      Home: TABS[0],
      End: TABS[TABS.length - 1],
    };
    const next = target[event.key];
    if (!next) return;
    event.preventDefault();
    select(next);
    document.getElementById(ADMIN_DYNAMIC_TESTIDS.ADMIN_TAB(next))?.focus();
  };

  const panels: Readonly<Record<TabKey, () => ReactNode>> = {
    users: () => <UsersPanel />,
    audit: () => (
      <section aria-labelledby="admin-audit-title" className="flex flex-col gap-3">
        <h2 id="admin-audit-title" className="m-0 text-[15px] font-semibold">
          {t('admin', 'auditTitle')}
        </h2>
        <AuditFeed />
      </section>
    ),
    chaos: () => <ChaosPanel />,
    data: () => <DataPanel />,
  };

  return (
    <div data-testid={ADMIN_TESTIDS.ADMIN_PAGE} className="flex flex-col gap-4">
      <div className="flex flex-col gap-0.5">
        <h1 className="m-0 text-[20px] font-semibold tracking-[-.01em]">{t('admin', 'title')}</h1>
        <p className="m-0 text-[12.5px] text-fg-2">{t('admin', 'subtitle')}</p>
      </div>

      <div className="flex flex-col">
        <div role="tablist" aria-label={t('admin', 'tabs')} data-testid={ADMIN_TESTIDS.ADMIN_TABS} className="flex gap-1 overflow-x-auto border-b border-border">
          {TABS.map((key) => (
            <button
              key={key}
              type="button"
              role="tab"
              id={ADMIN_DYNAMIC_TESTIDS.ADMIN_TAB(key)}
              aria-selected={tab === key}
              aria-controls={ADMIN_DYNAMIC_TESTIDS.ADMIN_PANEL(key)}
              tabIndex={tab === key ? 0 : -1}
              data-testid={ADMIN_DYNAMIC_TESTIDS.ADMIN_TAB(key)}
              onClick={() => select(key)}
              onKeyDown={(event) => onKeyDown(key, event)}
              className={`-mb-px cursor-pointer border-0 border-b-2 bg-transparent px-3.5 py-2 text-[12.5px] whitespace-nowrap ${tab === key ? 'border-accent font-medium text-fg' : 'border-transparent text-fg-2 hover:text-fg'}`}
            >
              {t('admin', `tab_${key}`)}
            </button>
          ))}
        </div>
        <div
          role="tabpanel"
          id={ADMIN_DYNAMIC_TESTIDS.ADMIN_PANEL(tab)}
          aria-labelledby={ADMIN_DYNAMIC_TESTIDS.ADMIN_TAB(tab)}
          data-testid={ADMIN_DYNAMIC_TESTIDS.ADMIN_PANEL(tab)}
          className="mt-3"
        >
          {panels[tab]()}
        </div>
      </div>
    </div>
  );
};
