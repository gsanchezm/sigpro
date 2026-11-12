import { PROGRAMAS_TESTIDS } from '@sigpro/shared';
import { useState } from 'react';
import { STORAGE_KEYS, readStorage, writeStorage } from '../lib/storage';
import { useI18n } from '../state/i18n';

/** Banner de cookies en la primera visita: aceptar o rechazar lo recuerda (`sigpro.cookies`). */
export const CookieBanner = () => {
  const { t } = useI18n();
  const [visible, setVisible] = useState(() => readStorage(STORAGE_KEYS.cookies) === null);
  if (!visible) return null;

  const answer = (value: 'accepted' | 'rejected') => {
    writeStorage(STORAGE_KEYS.cookies, value);
    setVisible(false);
  };

  return (
    <div
      role="region"
      aria-label={t('programas', 'cookiesTitle')}
      data-testid={PROGRAMAS_TESTIDS.COOKIE_BANNER}
      className="fixed right-4 bottom-4 left-4 z-[55] mx-auto flex max-w-[720px] flex-wrap items-center gap-3 rounded-card bg-fg px-4 py-3 text-[12.5px] text-bg shadow-pop"
    >
      <span className="min-w-[200px] flex-1">{t('programas', 'cookiesText')}</span>
      <div className="flex gap-2">
        <button
          type="button"
          data-testid={PROGRAMAS_TESTIDS.COOKIE_BANNER_ACCEPT}
          onClick={() => answer('accepted')}
          className="h-[30px] cursor-pointer rounded-ctl border-0 bg-bg px-3 text-[12px] font-medium text-fg"
        >
          {t('programas', 'accept')}
        </button>
        <button
          type="button"
          data-testid={PROGRAMAS_TESTIDS.COOKIE_BANNER_REJECT}
          onClick={() => answer('rejected')}
          className="h-[30px] cursor-pointer rounded-ctl border border-fg-3 bg-transparent px-3 text-[12px] font-medium text-bg"
        >
          {t('programas', 'reject')}
        </button>
      </div>
    </div>
  );
};
