import { ADMIN_TESTIDS } from '@sigpro/shared';
import { useState } from 'react';
import { formatTrace } from '../../lib/errors';
import { useAuth } from '../../state/auth';
import { useI18n } from '../../state/i18n';
import { useToast } from '../../state/toast';
import { Spinner } from '../../ui/Spinner';

/** Datos del tenant: restaura el seed con un `confirm()` NATIVO (el borrado de programas usa un `alertdialog` propio). */
export const DataPanel = () => {
  const { t } = useI18n();
  const { api, user } = useAuth();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  const reset = async () => {
    // Diálogo nativo a propósito: Playwright lo gestiona con page.on('dialog') / page.once('dialog')
    if (!window.confirm(t('admin', 'resetConfirm'))) return;
    setBusy(true);
    try {
      const result = await api.admin.reset();
      toast.push('ok', t('admin', 'resetDone'), `${result.tenant} · ${result.ms} ms`);
    } catch (failure) {
      toast.push('danger', t('common', 'genericError'), formatTrace(failure) || t('common', 'networkError'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section data-testid={ADMIN_TESTIDS.ADMIN_DATA_PANEL} aria-labelledby="admin-data-title" className="card flex max-w-[640px] flex-col gap-3 p-4">
      <div className="flex flex-col gap-1">
        <h2 id="admin-data-title" className="m-0 text-[15px] font-semibold">
          {t('admin', 'dataTitle')}
        </h2>
        <p className="m-0 text-[12.5px] text-fg-2">{t('admin', 'dataHint')}</p>
        {user ? <p className="m-0 font-mono text-[12px] text-fg-3">{t('common', 'tenant')}: {user.tenant}</p> : null}
      </div>
      <div>
        <button type="button" data-testid={ADMIN_TESTIDS.ADMIN_RESET} onClick={() => void reset()} disabled={busy} aria-busy={busy} title={busy ? t('common', 'processing') : undefined} className="btn btn-danger-outline">
          {busy ? <Spinner /> : null}
          {t('admin', 'reset')}
        </button>
      </div>
    </section>
  );
};
