import { ROLES, formatTrace, type AdminUserDto, type Role, type UpdateUserInput } from '@sigpro/shared';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useAuth } from '../../state/auth';
import { useI18n } from '../../state/i18n';
import { useToast } from '../../state/toast';
import { Avatar } from '../../ui/Avatar';
import { Badge } from '../../ui/Badge';
import { Card } from '../../ui/Card';
import { SelectField, type SelectOption } from '../../ui/SelectField';
import { EmptyState, ErrorState, LoadingState } from '../../ui/States';
import { SwitchField } from '../../ui/SwitchField';
import { Text } from '../../ui/Text';
import { TextField } from '../../ui/TextField';
import { useAdminUsers } from './hooks';
import { ADMIN_DYNAMIC_TESTIDS, ADMIN_TESTIDS, MOVIL_ADMIN_DYNAMIC_TESTIDS, MOVIL_ADMIN_TESTIDS } from './testids';
import { USER_STATUS_TONE, filterUsers, rejectionKey, traceOr, userStatus } from './view';

/**
 * Usuarios del tenant (web: `UsersPanel`): búsqueda, cambio de rol (selector) y de activo (interruptor) con vista optimista y
 * reversión si la API rechaza. La propia cuenta no se puede tocar (la web lo marca con `title`; aquí, con el motivo a la vista).
 */
export const UsersPanel = () => {
  const { t } = useI18n();
  const { user: me } = useAuth();
  const toast = useToast();
  const users = useAdminUsers();
  const [search, setSearch] = useState('');
  const { items, loaded, loading, error } = users;
  const visible = useMemo(() => filterUsers(items, search), [items, search]);

  const roleOptions: readonly SelectOption<Role>[] = ROLES.map((role) => ({ value: role, label: t('admin', `role_${role}`) }));

  const change = async (target: AdminUserDto, input: UpdateUserInput) => {
    const result = await users.change(target, input);
    if (result.ok) {
      const detail =
        input.role !== undefined
          ? t('admin', 'changeRole', { value: t('admin', `role_${input.role}`) })
          : t('admin', 'changeActive', { value: t('admin', input.active ? 'yes' : 'no') });
      toast.push('ok', t('admin', 'userUpdated'), t('admin', 'userUpdatedBody', { name: target.name, change: detail }));
      return;
    }
    const key = rejectionKey(result.failure);
    toast.push('danger', t('admin', 'updateErrorTitle'), key ? t('admin', key) : traceOr(formatTrace(result.failure), t('common', 'networkError')));
  };

  return (
    <View style={styles.root}>
      <Text variant="heading" role="heading" aria-level={2}>
        {t('admin', 'usersTitle')}
      </Text>
      <TextField
        label={t('admin', 'usersSearchLabel')}
        placeholder={t('admin', 'usersSearchPlaceholder')}
        testID={ADMIN_TESTIDS.ADMIN_USERS_SEARCH}
        value={search}
        onChangeText={setSearch}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
      />
      <View aria-live="polite">
        <Text variant="mono" tone="muted" testID={ADMIN_TESTIDS.ADMIN_USERS_COUNT}>
          {loaded ? t('admin', 'usersCount', { shown: visible.length, total: items.length }) : '…'}
        </Text>
      </View>
      <Text variant="small" tone="faint" testID={ADMIN_TESTIDS.ADMIN_USERS_NOTE}>
        {t('admin', 'usersNote')}
      </Text>

      {!loaded && error ? (
        <ErrorState
          testID={ADMIN_TESTIDS.ADMIN_USERS_ERROR}
          retryTestID={ADMIN_TESTIDS.ADMIN_USERS_ERROR_RETRY}
          title={t('admin', 'usersErrorTitle')}
          trace={traceOr(error, t('common', 'networkError'))}
          onRetry={users.reload}
        />
      ) : null}

      {!loaded && !error ? <LoadingState testID={MOVIL_ADMIN_TESTIDS.USERS_LOADING} /> : null}

      {loaded ? (
        <View role="list" aria-label={t('admin', 'usersTitle')} aria-busy={loading} testID={ADMIN_TESTIDS.ADMIN_USERS_TABLE} style={styles.list}>
          {visible.map((item) => (
            <UserCard key={item.id} item={item} self={item.id === me?.id} roleOptions={roleOptions} onChange={(input) => void change(item, input)} />
          ))}
        </View>
      ) : null}

      {loaded && visible.length === 0 ? <EmptyState testID={ADMIN_TESTIDS.ADMIN_USERS_EMPTY} title={t('admin', 'usersEmpty')} /> : null}
    </View>
  );
};

interface CardProps {
  readonly item: AdminUserDto;
  readonly self: boolean;
  readonly roleOptions: readonly SelectOption<Role>[];
  readonly onChange: (input: UpdateUserInput) => void;
}

/** Un usuario: quién es, su rol (selector), si está activo (interruptor) y su estado (Normal, Bloqueado, Pendiente o Desactivado). */
const UserCard = ({ item, self, roleOptions, onChange }: CardProps) => {
  const { t } = useI18n();
  const status = userStatus(item);
  return (
    <Card role="listitem" aria-label={item.name} testID={ADMIN_DYNAMIC_TESTIDS.ADMIN_USER_ROW(item.id)} dataSet={{ role: item.role, active: String(item.active) }}>
      <View style={styles.top}>
        <View style={styles.who}>
          <Avatar name={item.name} size={28} />
          <Text variant="label" numberOfLines={1} style={styles.name}>
            {item.name}
          </Text>
          {self ? <Badge label={t('admin', 'you')} tone="info" /> : null}
        </View>
        <Badge label={t('admin', `status_${status}`)} tone={USER_STATUS_TONE[status]} state={status} testID={ADMIN_DYNAMIC_TESTIDS.ADMIN_USER_STATUS(item.id)} />
      </View>
      <Text variant="mono" tone="muted">
        {item.email}
      </Text>
      <SelectField
        label={t('admin', 'roleOf', { name: item.name })}
        value={item.role}
        options={roleOptions}
        onChange={(role) => role !== item.role && onChange({ role })}
        testID={ADMIN_DYNAMIC_TESTIDS.ADMIN_USER_ROLE(item.id)}
        disabled={self}
      />
      <SwitchField label={t('admin', 'activeOf', { name: item.name })} value={item.active} onChange={(active) => onChange({ active })} testID={ADMIN_DYNAMIC_TESTIDS.ADMIN_USER_ACTIVE(item.id)} disabled={self} />
      {self ? (
        <Text variant="small" tone="faint" testID={MOVIL_ADMIN_DYNAMIC_TESTIDS.USER_REASON(item.id)}>
          {t('admin', 'selfDenied')}
        </Text>
      ) : null}
    </Card>
  );
};

const styles = StyleSheet.create({
  root: { gap: 12 },
  list: { gap: 10 },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  who: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 },
  name: { flexShrink: 1 },
});
