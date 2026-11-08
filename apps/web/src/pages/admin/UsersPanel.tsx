import { ADMIN_DYNAMIC_TESTIDS, ADMIN_TESTIDS, ApiError, PROGRAMAS_TESTIDS, ROLES, type AdminUserDto, type MessageKey, type Role, type UpdateUserInput } from '@sigpro/shared';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { formatTrace } from '../../lib/errors';
import { useAuth } from '../../state/auth';
import { useI18n } from '../../state/i18n';
import { useToast } from '../../state/toast';
import { Avatar } from '../../ui/Avatar';
import { Switch } from '../../ui/Switch';
import { ToneBadge } from '../../ui/ToneBadge';
import { USER_STATUS_TONE, filterUsers, userStatus } from './admin-view';

type LoadState = { readonly status: 'loading' } | { readonly status: 'error'; readonly error: unknown } | { readonly status: 'ready'; readonly items: readonly AdminUserDto[] };

// Código de error de la API → clave del texto (mapa de despacho, sin switch)
const ERROR_KEY: ReadonlyMap<string, MessageKey<'admin'>> = new Map<string, MessageKey<'admin'>>([
  ['self_change', 'errorSelfChange'],
  ['last_admin', 'errorLastAdmin'],
  ['user_not_found', 'errorUserNotFound'],
]);

const SKELETON_ROWS = 5;
const NO_USERS: readonly AdminUserDto[] = [];

/** Usuarios del tenant: cambio de rol (select) y activación (switch) con vista optimista y reversión si la API rechaza. */
export const UsersPanel = () => {
  const { t } = useI18n();
  const { api, user: me } = useAuth();
  const toast = useToast();
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [search, setSearch] = useState('');

  const load = useCallback(() => {
    setState({ status: 'loading' });
    api.admin.users().then(
      (items) => setState({ status: 'ready', items }),
      (error: unknown) => setState({ status: 'error', error }),
    );
  }, [api]);

  useEffect(load, [load]);

  const replace = (id: string, apply: (user: AdminUserDto) => AdminUserDto) =>
    setState((current) => (current.status === 'ready' ? { status: 'ready', items: current.items.map((item) => (item.id === id ? apply(item) : item)) } : current));

  const change = async (target: AdminUserDto, input: UpdateUserInput) => {
    const previous = target;
    replace(target.id, (item) => ({ ...item, ...(input.active !== undefined ? { active: input.active } : {}), ...(input.role !== undefined ? { role: input.role } : {}) }));
    try {
      const saved = await api.admin.updateUser(target.id, input);
      replace(target.id, () => saved);
      const detail =
        input.role !== undefined
          ? t('admin', 'changeRole', { value: t('admin', `role_${input.role}`) })
          : t('admin', 'changeActive', { value: t('admin', input.active ? 'yes' : 'no') });
      toast.push('ok', t('admin', 'userUpdated'), t('admin', 'userUpdatedBody', { name: target.name, change: detail }));
    } catch (failure) {
      replace(target.id, () => previous);
      const code = failure instanceof ApiError ? failure.body.code : undefined;
      const key = code ? ERROR_KEY.get(code) : undefined;
      toast.push('danger', t('admin', 'updateErrorTitle'), key ? t('admin', key) : formatTrace(failure) || t('common', 'networkError'));
    }
  };

  const items = state.status === 'ready' ? state.items : NO_USERS;
  const visible = useMemo(() => filterUsers(items, search), [items, search]);

  const loading = state.status === 'loading';

  return (
    <section aria-labelledby="admin-users-title" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 id="admin-users-title" className="m-0 text-[15px] font-semibold">
          {t('admin', 'usersTitle')}
        </h2>
        <div className="flex w-full flex-col gap-1 sm:w-[260px]">
          <label htmlFor="admin-users-search" className="label">
            {t('admin', 'usersSearchLabel')}
          </label>
          <input
            id="admin-users-search"
            type="search"
            data-testid={ADMIN_TESTIDS.ADMIN_USERS_SEARCH}
            placeholder={t('admin', 'usersSearchPlaceholder')}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="input input-filter !h-8"
          />
        </div>
      </div>

      <p data-testid={ADMIN_TESTIDS.ADMIN_USERS_COUNT} aria-live="polite" className="m-0 font-mono text-[12px] text-fg-2">
        {loading ? '…' : t('admin', 'usersCount', { shown: visible.length, total: items.length })}
      </p>
      <p data-testid={ADMIN_TESTIDS.ADMIN_USERS_NOTE} className="m-0 text-[12px] text-fg-3">
        {t('admin', 'usersNote')}
      </p>

      {state.status === 'error' ? (
        <div role="alert" data-testid={ADMIN_TESTIDS.ADMIN_USERS_ERROR} className="alert alert-danger flex flex-wrap items-center justify-between gap-3 !px-3.5 !py-3">
          <div>
            <div className="font-semibold">{t('admin', 'usersErrorTitle')}</div>
            <div className="trace !text-[12.5px]">{formatTrace(state.error) || t('common', 'networkError')}</div>
          </div>
          <button type="button" data-testid={ADMIN_TESTIDS.ADMIN_USERS_ERROR_RETRY} onClick={load} className="btn btn-danger-outline !h-[30px] !px-3">
            {t('admin', 'retry')}
          </button>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table data-testid={ADMIN_TESTIDS.ADMIN_USERS_TABLE} aria-busy={loading} className="w-full min-w-[760px] border-collapse text-[12.5px]">
              <thead>
                <tr className="border-b border-border bg-surface-2">
                  {(['colUser', 'colEmail', 'colRole', 'colActive', 'colStatus'] as const).map((key) => (
                    <th key={key} scope="col" className="h-9 px-3 text-left text-[11.5px] font-medium text-fg-2">
                      {t('admin', key)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading
                  ? Array.from({ length: SKELETON_ROWS }, (_, index) => (
                      <tr key={index} data-testid={PROGRAMAS_TESTIDS.SKELETON_ROW} className="border-b border-border">
                        {[0, 1, 2, 3, 4].map((cell) => (
                          <td key={cell} className="px-3 py-3">
                            <span className="skeleton block h-4 w-3/4" />
                          </td>
                        ))}
                      </tr>
                    ))
                  : visible.map((item) => {
                      const self = item.id === me?.id;
                      const status = userStatus(item);
                      return (
                        <tr key={item.id} data-testid={ADMIN_DYNAMIC_TESTIDS.ADMIN_USER_ROW(item.id)} data-role={item.role} data-active={item.active} className="border-b border-border last:border-b-0 hover:bg-surface-2">
                          <td className="px-3 py-2">
                            <span className="flex items-center gap-2">
                              <Avatar name={item.name} size={24} fontPx={9.5} />
                              <span className="font-medium">{item.name}</span>
                              {self ? <span className="pill" data-tone="info">{t('admin', 'you')}</span> : null}
                            </span>
                          </td>
                          <td className="px-3 py-2 font-mono text-[12px] text-fg-2">{item.email}</td>
                          <td className="px-3 py-2">
                            <select
                              aria-label={t('admin', 'roleOf', { name: item.name })}
                              data-testid={ADMIN_DYNAMIC_TESTIDS.ADMIN_USER_ROLE(item.id)}
                              value={item.role}
                              disabled={self}
                              title={self ? t('admin', 'selfDenied') : undefined}
                              onChange={(event) => void change(item, { role: event.target.value as Role })}
                              className="input input-filter !h-8 !w-auto"
                            >
                              {ROLES.map((role) => (
                                <option key={role} value={role}>
                                  {t('admin', `role_${role}`)}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="px-3 py-2">
                            <Switch
                              checked={item.active}
                              label={t('admin', 'activeOf', { name: item.name })}
                              testId={ADMIN_DYNAMIC_TESTIDS.ADMIN_USER_ACTIVE(item.id)}
                              disabled={self}
                              title={self ? t('admin', 'selfDenied') : undefined}
                              onChange={(active) => void change(item, { active })}
                            />
                          </td>
                          <td className="px-3 py-2">
                            <ToneBadge state={status} tone={USER_STATUS_TONE[status]} label={t('admin', `status_${status}`)} testId={ADMIN_DYNAMIC_TESTIDS.ADMIN_USER_STATUS(item.id)} />
                          </td>
                        </tr>
                      );
                    })}
              </tbody>
            </table>
          </div>
          {state.status === 'ready' && visible.length === 0 ? (
            <p data-testid={ADMIN_TESTIDS.ADMIN_USERS_EMPTY} className="m-0 px-4 py-10 text-center text-[12.5px] text-fg-2">
              {t('admin', 'usersEmpty')}
            </p>
          ) : null}
        </div>
      )}
    </section>
  );
};
