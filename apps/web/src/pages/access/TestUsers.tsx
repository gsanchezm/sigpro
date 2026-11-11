import { ACCESO_DYNAMIC_TESTIDS, ACCESO_TESTIDS, initials, type TestUserDto } from '@sigpro/shared';
import { useEffect, useState } from 'react';
import { useAuth } from '../../state/auth';
import { useI18n } from '../../state/i18n';
import { Avatar } from '../../ui/Avatar';

interface TestUsersProps {
  readonly onPick: (user: TestUserDto) => void;
}

const badgeTone = (user: TestUserDto): 'danger' | 'warn' | 'info' | 'neutral' => {
  const byStatus: Readonly<Record<TestUserDto['status'], 'danger' | 'warn' | undefined>> = { locked: 'danger', pending: 'warn', active: undefined };
  return byStatus[user.status] ?? (user.role === 'admin' ? 'info' : 'neutral');
};

/** Panel "Usuarios de prueba" (solo dev/staging): un clic rellena correo y contraseña. */
export const TestUsers = ({ onPick }: TestUsersProps) => {
  const { t } = useI18n();
  const { publicApi } = useAuth();
  const [users, setUsers] = useState<readonly TestUserDto[]>([]);

  useEffect(() => {
    let alive = true;
    publicApi.config
      .testUsers()
      .then((list) => alive && setUsers(list))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [publicApi]);

  if (users.length === 0) return null;

  const badgeText = (user: TestUserDto): string => {
    if (user.status !== 'active') return t('acceso', user.status);
    return user.mfa ? `${user.role} · ${t('acceso', 'mfaBadge')}` : user.role;
  };

  return (
    <section
      aria-labelledby="test-users-title"
      data-testid={ACCESO_TESTIDS.TEST_USERS}
      className="flex w-[min(520px,100%)] flex-col gap-2 rounded-card border border-dashed border-border-strong px-3.5 py-3"
    >
      <div className="flex items-baseline justify-between gap-2">
        <h2 id="test-users-title" className="m-0 text-[12px] font-semibold tracking-[.06em] text-fg-2 uppercase">
          {t('acceso', 'testUsers')}
        </h2>
        <span className="font-mono text-[11px] text-fg-3">{t('acceso', 'clickToFill')}</span>
      </div>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(230px,1fr))] gap-1.5">
        {users.map((user) => (
          <button
            key={user.id}
            type="button"
            data-testid={ACCESO_DYNAMIC_TESTIDS.TEST_USER(user.role, user.status === 'active' ? undefined : user.status)}
            title={`${user.role} · ${user.status}${user.mfa ? ' · MFA' : ''}`}
            onClick={() => onPick(user)}
            className="flex cursor-pointer items-center gap-2.5 rounded-ctl border border-border bg-surface px-2.5 py-2 text-left text-fg hover:border-border-strong hover:bg-surface-2"
          >
            <Avatar name={user.name} size={28} />
            <span className="flex min-w-0 flex-1 flex-col leading-[1.25]">
              <span className="truncate text-[12.5px] font-medium">{user.name}</span>
              <span className="truncate font-mono text-[10.5px] text-fg-3">
                {user.email} · {user.password}
              </span>
            </span>
            <span data-testid={ACCESO_TESTIDS.TEST_USER_BADGE} data-initials={initials(user.name)} className="pill" data-tone={badgeTone(user)}>
              {badgeText(user)}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
};
