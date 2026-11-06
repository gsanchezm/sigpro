import { PROGRAMAS_TESTIDS } from '@sigpro/shared';
import { useCallback, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDismiss, type Breakpoint } from '../lib/hooks';
import { useAuth } from '../state/auth';
import { useI18n } from '../state/i18n';
import { useToast } from '../state/toast';
import { Avatar } from '../ui/Avatar';
import { BellIcon } from '../ui/icons';

const NOTIFICATIONS = [
  { key: 'notif1', time: '09:42', tone: 'var(--danger)' },
  { key: 'notif2', time: '08:15', tone: 'var(--ok)' },
  { key: 'notif3', time: 'yesterday', tone: 'var(--warn)' },
] as const;

/** Campana con popover de notificaciones (estáticas en la fase 1; en tiempo real en la fase 3). */
export const NotificationsMenu = () => {
  const { t, lang } = useI18n();
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(true);
  const rootRef = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useDismiss(open, [rootRef], close);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        data-testid={PROGRAMAS_TESTIDS.LAYOUT_NOTIFICATIONS}
        aria-label={t('programas', 'notifications')}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="icon-btn relative"
      >
        <BellIcon />
        {unread ? <span aria-hidden="true" className="absolute top-[5px] right-[5px] size-[7px] rounded-full border-[1.5px] border-surface bg-danger" /> : null}
      </button>
      {open ? (
        <div
          role="dialog"
          aria-label={t('programas', 'notifications')}
          data-testid={PROGRAMAS_TESTIDS.LAYOUT_NOTIFICATIONS_POPOVER}
          className="absolute top-[38px] right-0 z-40 flex w-[300px] flex-col rounded-[6px] border border-border bg-surface shadow-pop"
        >
          <div className="flex items-center justify-between border-b border-border px-3 py-2.5 font-semibold">
            {t('programas', 'notifications')}
            <button
              type="button"
              data-testid={PROGRAMAS_TESTIDS.LAYOUT_NOTIFICATIONS_MARKREAD}
              onClick={() => {
                setUnread(false);
                setOpen(false);
              }}
              className="link-btn text-[12px]"
            >
              {t('programas', 'markRead')}
            </button>
          </div>
          {NOTIFICATIONS.map((item) => (
            <div key={item.key} className="flex gap-2.5 border-b border-border px-3 py-2.5 last:border-b-0">
              <span aria-hidden="true" className="mt-1.5 size-2 flex-none rounded-full" style={{ background: item.tone }} />
              <div className="min-w-0 flex-1">
                <div className="text-[12.5px]">{t('programas', item.key)}</div>
                <div className="font-mono text-[11px] text-fg-3">{item.time === 'yesterday' ? (lang === 'es' ? 'ayer' : 'yesterday') : item.time}</div>
              </div>
            </div>
          ))}
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
        className="flex h-8 cursor-pointer items-center gap-2 rounded-[4px] border border-border bg-surface py-0 pr-1 pl-0.5 text-fg hover:bg-surface-2"
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
          className="absolute top-[38px] right-0 z-40 flex w-[200px] flex-col rounded-[6px] border border-border bg-surface p-1.5 shadow-pop"
        >
          <button type="button" role="menuitem" data-testid={PROGRAMAS_TESTIDS.LAYOUT_USER_PROFILE} onClick={close} className="menu-item">
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
