import { can } from '@sigpro/shared';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { useAuth } from '../../state/auth';
import { useI18n } from '../../state/i18n';
import { ForbiddenScreen } from '../../ui/ForbiddenScreen';
import { Screen } from '../../ui/Screen';
import { Segmented, type SegmentedOption } from '../../ui/Segmented';
import { Text } from '../../ui/Text';
import { AuditFeed } from '../audit/AuditFeed';
import { ChaosPanel } from './ChaosPanel';
import { DataPanel } from './DataPanel';
import { UsersPanel } from './UsersPanel';
import { ADMIN_DYNAMIC_TESTIDS, ADMIN_TESTIDS, MOVIL_ADMIN_TESTIDS } from './testids';
import { ADMIN_TABS, parseTab, tabParam, type AdminTab } from './view';

/**
 * `/admin` (solo admin): usuarios, auditoría con rango de fechas, modo caos y datos del tenant, en pestañas que la URL
 * recuerda (`?tab=audit`). Sin permiso `users.manage` se muestra el aviso de la web y no se monta ninguna sección, así que
 * no se pide nada a la API.
 */
export const AdminScreen = () => {
  const { t } = useI18n();
  const { user } = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams<{ tab?: string | string[] }>();
  const nearEnd = useRef<(() => void) | null>(null);
  const allowed = user ? can(user.role, 'users.manage') : false;
  const requested = Array.isArray(params.tab) ? params.tab[0] : params.tab;
  const tab = parseTab(requested);

  if (!allowed) {
    return (
      <ForbiddenScreen
        title={t('admin', 'title')}
        pageTestID={MOVIL_ADMIN_TESTIDS.FORBIDDEN_PAGE}
        noticeTestID={ADMIN_TESTIDS.ADMIN_FORBIDDEN}
        heading={t('admin', 'forbidden')}
        body={t('admin', 'forbiddenBody')}
        backTestID={ADMIN_TESTIDS.ADMIN_FORBIDDEN_BACK}
      />
    );
  }

  const options: readonly SegmentedOption<AdminTab>[] = ADMIN_TABS.map((key) => ({ value: key, label: t('admin', `tab_${key}`), testID: ADMIN_DYNAMIC_TESTIDS.ADMIN_TAB(key) }));
  const select = (next: AdminTab) => router.setParams({ tab: tabParam(next) });

  return (
    <Screen title={t('admin', 'title')} subtitle={t('admin', 'subtitle')} testID={ADMIN_TESTIDS.ADMIN_PAGE} onNearEnd={() => nearEnd.current?.()}>
      <Segmented<AdminTab> label={t('admin', 'tabs')} options={options} value={tab} onChange={select} testID={ADMIN_TESTIDS.ADMIN_TABS} semantics="tabs" />
      <View role="tabpanel" aria-label={t('admin', `tab_${tab}`)} testID={ADMIN_DYNAMIC_TESTIDS.ADMIN_PANEL(tab)} style={styles.panel}>
        {tab === 'users' ? <UsersPanel /> : null}
        {tab === 'audit' ? (
          <View style={styles.panel}>
            <Text variant="heading" role="heading" aria-level={2}>
              {t('admin', 'auditTitle')}
            </Text>
            <AuditFeed nearEndRef={nearEnd} />
          </View>
        ) : null}
        {tab === 'chaos' ? <ChaosPanel /> : null}
        {tab === 'data' ? <DataPanel /> : null}
      </View>
    </Screen>
  );
};

const styles = StyleSheet.create({
  panel: { gap: 12 },
});
