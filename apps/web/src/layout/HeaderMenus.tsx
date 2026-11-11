import { MISION_DYNAMIC_TESTIDS, MISION_TESTIDS, PROGRAMAS_TESTIDS, type MissionEventDto } from '@sigpro/shared';
import { useCallback, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDismiss, type Breakpoint } from '../lib/hooks';
import { missionEventText } from '../pages/mission/event-text';
import { useAuth } from '../state/auth';
import { useI18n } from '../state/i18n';
import { useLiveFeed } from '../state/live';
import { useToast } from '../state/toast';
import { Avatar } from '../ui/Avatar';
import { BellIcon } from '../ui/icons';

const SEVERITY_COLOR: Readonly<Record<MissionEventDto['severity'], string>> = {
  info: 'var(--info)',
  ok: 'var(--ok)',
  warn: 'var(--warn)',
  danger: 'var(--danger)',
};

/** Campana con contador y popover de notificaciones en tiempo real (los avisos que llegan por Socket.IO). */
export const NotificationsMenu = () => {
  const { t, lang } = useI18n();
  const { notifications, unread, markAllRead } = useLiveFeed();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useDismiss(open, [rootRef], close);
  const time = (iso: string): string => new Date(iso).toLocaleTimeString(lang === 'es' ? 'es-ES' : 'en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        data-testid={PROGRAMAS_TESTIDS.LAYOUT_NOTIFICATIONS}
        aria-label={unread > 0 ? t('mision', 'notificationsAria', { count: unread }) : t('programas', 'notifications')}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="icon-btn relative"
      >
        <BellIcon />
        {unread > 0 ? (
          <span
            aria-hidden="true"
            data-testid={MISION_TESTIDS.LAYOUT_NOTIFICATIONS_COUNT}
            className="absolute -top-px -right-px grid h-[15px] min-w-[15px] place-items-center rounded-full border-[1.5px] border-surface bg-danger px-[3px] font-mono text-[9.5px] leading-none font-semibold text-on-accent"
          >
            {unread > 9 ? '9+' : unread}
          </span>
        ) : null}
      </button>
      {open ? (
        <div
          role="dialog"
          aria-label={t('programas', 'notifications')}
          data-testid={PROGRAMAS_TESTIDS.LAYOUT_NOTIFICATIONS_POPOVER}
          className="absolute top-[38px] right-0 z-40 flex w-[min(320px,calc(100vw-24px))] flex-col rounded-card border border-border bg-surface shadow-pop"
        >
          <div className="flex items-center justify-between border-b border-border px-3 py-2.5 font-semibold">
            {t('programas', 'notifications')}
            <button
              type="button"
              data-testid={PROGRAMAS_TESTIDS.LAYOUT_NOTIFICATIONS_MARKREAD}
              onClick={() => {
                markAllRead();
                setOpen(false);
              }}
              className="link-btn text-[12px]"
            >
              {t('programas', 'markRead')}
            </button>
          </div>
          <div aria-live="polite" data-testid={MISION_TESTIDS.LAYOUT_NOTIFICATIONS_LIVE} className="max-h-[320px] overflow-y-auto">
            {notifications.length === 0 ? (
              <p data-testid={MISION_TESTIDS.LAYOUT_NOTIFICATIONS_EMPTY} className="m-0 px-3 py-6 text-center text-[12.5px] text-fg-3">
                {t('mision', 'notificationsEmpty')}
              </p>
            ) : (
              notifications.map((item) => (
                <div key={item.id} data-testid={MISION_DYNAMIC_TESTIDS.LAYOUT_NOTIFICATION(item.seq)} data-severity={item.severity} className="flex gap-2.5 border-b border-border px-3 py-2.5 last:border-b-0">
                  <span aria-hidden="true" className="mt-1.5 size-2 flex-none rounded-full" style={{ background: SEVERITY_COLOR[item.severity] }} />
                  <div className="min-w-0 flex-1">
                    <div className="text-[12.5px]">{missionEventText(item, t)}</div>
                    <div className="font-mono text-[11px] text-fg-3">{time(item.at)}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
};

/** Menú de usuario: avatar + nombre + rol; Perfil, Atajos y Cerrar sesión. */
export const UserMenu = ({ breakpoint }: { breakpoint: Breakpoint }) => {
  const { t } = useI18n();
  const { user, signOut } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useDismiss(open, [rootRef], close);

  if (!user) return null;

  const logout = async () => {
    setOpen(false);
    // signOut vacía la sesión de forma síncrona; navegar justo después evita que RequireAuth redirija sin el aviso
    const done = signOut();
    navigate('/login', { state: { signedOut: true } });
    await done;
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        data-testid={PROGRAMAS_TESTIDS.LAYOUT_USER_MENU}
        aria-label={t('programas', 'userMenu')}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="flex h-8 cursor-pointer items-center gap-2 rounded-ctl border border-border bg-surface py-0 pr-1 pl-0.5 text-fg hover:bg-surface-2"
      >
        <Avatar name={user.name} size={26} fontPx={10.5} />
        {breakpoint !== 'mobile' ? (
          <span className="flex flex-col items-start pr-1.5 leading-[1.15]">
            <span className="text-[12.5px] font-medium">{user.name}</span>
            <span className="font-mono text-[10.5px] text-fg-3">{user.role}</span>
          </span>
        ) : null}
      </button>
      {open ? (
        <div
          role="menu"
          data-testid={PROGRAMAS_TESTIDS.LAYOUT_USER_MENU_POPOVER}
          className="absolute top-[38px] right-0 z-40 flex w-[200px] flex-col rounded-card border border-border bg-surface p-1.5 shadow-pop"
        >
          <button
            type="button"
            role="menuitem"
            data-testid={PROGRAMAS_TESTIDS.LAYOUT_USER_PROFILE}
            onClick={() => {
              close();
              navigate('/profile');
            }}
            className="menu-item"
          >
            {t('programas', 'profile')}
          </button>
          <button
            type="button"
            role="menuitem"
            data-testid={PROGRAMAS_TESTIDS.LAYOUT_USER_SHORTCUTS}
            onClick={() => {
              close();
              toast.push('info', t('common', 'shortcutsTitle'), t('common', 'shortcutsBody'));
            }}
            className="menu-item justify-between"
          >
            {t('programas', 'shortcuts')}
            <kbd className="font-mono text-[10.5px] text-fg-3">?</kbd>
          </button>
          <div role="separator" className="menu-sep" />
          <button
            type="button"
            role="menuitem"
            data-testid={PROGRAMAS_TESTIDS.LAYOUT_USER_LOGOUT}
            onClick={() => void logout()}
            className="menu-item !text-danger hover:!bg-danger-soft"
          >
            {t('programas', 'logout')}
          </button>
        </div>
      ) : null}
    </div>
  );
};

