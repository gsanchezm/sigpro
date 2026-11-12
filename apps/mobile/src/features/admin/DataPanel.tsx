import { formatTrace } from '@sigpro/shared';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useAuth } from '../../state/auth';
import { useI18n, useTexts } from '../../state/i18n';
import { useToast } from '../../state/toast';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { ConfirmSheet } from '../../ui/ConfirmSheet';
import { Sheet } from '../../ui/Sheet';
import { Text } from '../../ui/Text';
import { ADMIN_TESTIDS, MOVIL_ADMIN_TESTIDS } from './testids';
import { ADMIN_TEXTS } from './texts';
import { tenantInfoLines, traceOr } from './view';

/**
 * Datos del tenant (web: `DataPanel`): «Información del tenant» (el `alert()` de la web, aquí un diálogo) y «Restaurar datos
 * del tenant», que pide confirmación en un diálogo de la app (el `confirm()` de la web) y deja el seed determinista del tenant.
 */
export const DataPanel = () => {
  const { t } = useI18n();
  const texts = useTexts(ADMIN_TEXTS);
  const { api, user } = useAuth();
  const toast = useToast();
  const [working, setWorking] = useState<'info' | 'reset' | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [info, setInfo] = useState<readonly string[] | null>(null);

  const fail = (failure: unknown) => toast.push('danger', t('common', 'genericError'), traceOr(formatTrace(failure), t('common', 'networkError')));

  const busy = working !== null;

  const reset = async () => {
    setWorking('reset');
    try {
      const result = await api.admin.reset();
      setConfirming(false);
      toast.push('ok', t('admin', 'resetDone'), `${result.tenant} · ${result.ms} ms`);
    } catch (failure) {
      setConfirming(false);
      fail(failure);
    } finally {
      setWorking(null);
    }
  };

  const showInfo = async () => {
    setWorking('info');
    try {
      const users = await api.admin.users();
      setInfo(
        tenantInfoLines(
          { tenant: user?.tenant ?? '', users },
          { tenant: (tenant) => t('admin', 'tenantInfoTenant', { tenant }), users: (total, active) => t('admin', 'tenantInfoUsers', { total, active }) },
        ),
      );
    } catch (failure) {
      fail(failure);
    } finally {
      setWorking(null);
    }
  };

  return (
    <Card role="region" aria-label={t('admin', 'dataTitle')} testID={ADMIN_TESTIDS.ADMIN_DATA_PANEL} style={styles.panel}>
      <Text variant="heading" role="heading" aria-level={2}>
        {t('admin', 'dataTitle')}
      </Text>
      <Text variant="small" tone="muted">
        {t('admin', 'dataHint')}
      </Text>
      {user ? (
        <Text variant="mono" tone="faint" testID={MOVIL_ADMIN_TESTIDS.DATA_TENANT}>
          {`${t('common', 'tenant')}: ${user.tenant}`}
        </Text>
      ) : null}

      <View style={styles.actions}>
        <Button label={t('admin', 'tenantInfo')} testID={ADMIN_TESTIDS.ADMIN_TENANT_INFO} onPress={() => void showInfo()} disabled={busy} disabledReason={t('common', 'processing')} busy={working === 'info'} />
        <Button label={t('admin', 'reset')} testID={ADMIN_TESTIDS.ADMIN_RESET} variant="danger" onPress={() => setConfirming(true)} disabled={busy} disabledReason={t('common', 'processing')} busy={working === 'reset'} />
      </View>
      <Text variant="small" tone="faint">
        {texts.tenantInfoHint}
      </Text>
      {busy ? (
        <Text variant="small" tone="faint" role="status">
          {t('common', 'processing')}
        </Text>
      ) : null}

      <ConfirmSheet
        visible={confirming}
        title={t('admin', 'reset')}
        message={t('admin', 'resetConfirm')}
        confirmLabel={t('admin', 'reset')}
        danger
        busy={busy}
        onConfirm={() => void reset()}
        onCancel={() => setConfirming(false)}
        testID={MOVIL_ADMIN_TESTIDS.RESET_DIALOG}
      />

      <Sheet visible={info !== null} title={t('admin', 'tenantInfoTitle')} onClose={() => setInfo(null)} testID={MOVIL_ADMIN_TESTIDS.TENANT_INFO_DIALOG}>
        {(info ?? []).map((line) => (
          <Text key={line} variant="body">
            {line}
          </Text>
        ))}
      </Sheet>
    </Card>
  );
};

const styles = StyleSheet.create({
  panel: { gap: 12 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
