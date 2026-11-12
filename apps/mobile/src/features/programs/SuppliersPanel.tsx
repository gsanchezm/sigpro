import { PROVEEDORES_DYNAMIC_TESTIDS, PROVEEDORES_TESTIDS, MOVIL_PROGRAMS_TESTIDS, formatDate, formatMoney, type SupplierDto } from '@sigpro/shared';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useResource } from '../../lib/resource';
import { useAuth } from '../../state/auth';
import { useI18n, useTexts } from '../../state/i18n';
import { useTheme } from '../../state/theme';
import { RADIUS, SPACING } from '../../theme/tokens';
import { Badge } from '../../ui/Badge';
import { Card } from '../../ui/Card';
import { ErrorState, LoadingState } from '../../ui/States';
import { Text } from '../../ui/Text';
import { PROGRAMS_TEXTS } from './texts';
import { SupplierSearch } from './SupplierSearch';
import { approvalState, contractAmountFor } from './supplier-view';

interface Props {
  readonly code: string;
}

/** Badge de aprobación: «Aprobado» (ok) o «No aprobado» (aviso), con su `data-state`. */
const ApprovalBadge = ({ supplier, testID }: { readonly supplier: SupplierDto; readonly testID: string }) => {
  const { t } = useI18n();
  return (
    <Badge
      label={supplier.approved ? t('proveedores', 'approved') : t('proveedores', 'notApproved')}
      tone={supplier.approved ? 'ok' : 'warn'}
      state={approvalState(supplier)}
      testID={testID}
    />
  );
};

/**
 * Pestaña «Proveedores» del detalle: los contratados en este programa (lista con NIF, importe y aprobación), el buscador de
 * proveedores del tenant y la ficha del elegido, con sus contratos. Como la web, consultor y auditor ven lo mismo: solo lectura.
 */
export const SuppliersPanel = ({ code }: Props) => {
  const { t } = useI18n();
  const texts = useTexts(PROGRAMS_TEXTS);
  const { api } = useAuth();
  const contracted = useResource(() => api.suppliers.list({ program: code }), [api, code]);
  const [selected, setSelected] = useState<SupplierDto | null>(null);
  const items = contracted.data ?? [];

  return (
    <View testID={PROVEEDORES_TESTIDS.SUPPLIERS_PANEL} style={styles.block}>
      <View style={styles.headText}>
        <Text variant="heading" role="heading" aria-level={2}>
          {t('proveedores', 'title')}
        </Text>
        <Text variant="small" tone="muted">
          {texts.suppliersHint}
        </Text>
      </View>

      <Text variant="small" tone="muted" testID={PROVEEDORES_TESTIDS.SUPPLIERS_COUNT} aria-live="polite">
        {contracted.data ? (items.length === 1 ? t('proveedores', 'contractedOne') : t('proveedores', 'contractedCount', { count: items.length })) : ''}
      </Text>

      {contracted.loading && contracted.data === null ? <LoadingState testID={MOVIL_PROGRAMS_TESTIDS.SUPPLIERS_LOADING} /> : null}

      {contracted.error !== null && contracted.data === null ? (
        <ErrorState
          testID={PROVEEDORES_TESTIDS.SUPPLIERS_ERROR}
          retryTestID={PROVEEDORES_TESTIDS.SUPPLIERS_ERROR_RETRY}
          title={t('proveedores', 'errorTitle')}
          trace={contracted.error}
          onRetry={contracted.reload}
        />
      ) : null}

      {contracted.data !== null && items.length === 0 ? (
        <Text variant="small" tone="muted" testID={PROVEEDORES_TESTIDS.SUPPLIERS_EMPTY}>
          {t('proveedores', 'empty')}
        </Text>
      ) : null}

      {items.length > 0 ? (
        <View role="list" aria-label={t('proveedores', 'contractedTitle')} testID={PROVEEDORES_TESTIDS.SUPPLIERS_TABLE} style={styles.list}>
          {items.map((supplier) => (
            <SupplierRow key={supplier.id} supplier={supplier} programCode={code} />
          ))}
        </View>
      ) : null}

      <SupplierSearch selected={selected} onSelect={setSelected} />
      {selected ? <SupplierCard supplier={selected} /> : null}
    </View>
  );
};

/** Proveedor contratado en el programa: nombre, NIF, importe del contrato y aprobación. */
const SupplierRow = ({ supplier, programCode }: { readonly supplier: SupplierDto; readonly programCode: string }) => {
  const { t, lang } = useI18n();
  return (
    <Card role="listitem" aria-label={supplier.name} testID={PROVEEDORES_DYNAMIC_TESTIDS.SUPPLIER_ROW(supplier.id)} dataSet={{ state: approvalState(supplier) }} style={styles.item}>
      <Text variant="label">{supplier.name}</Text>
      <View style={styles.row}>
        <Text variant="small" tone="muted" style={styles.grow}>
          {`${t('proveedores', 'colNif')} ${supplier.nif}`}
        </Text>
        <Text variant="small" tone="muted">
          {`${t('proveedores', 'colAmount')} ${formatMoney(contractAmountFor(supplier, programCode) ?? 0, lang)}`}
        </Text>
      </View>
      <View style={styles.row}>
        <ApprovalBadge supplier={supplier} testID={PROVEEDORES_DYNAMIC_TESTIDS.SUPPLIER_BADGE(supplier.id)} />
      </View>
    </Card>
  );
};

/** Ficha del proveedor elegido en el buscador: NIF, correo, estado y todos sus contratos (el código enlaza al programa). */
const SupplierCard = ({ supplier }: { readonly supplier: SupplierDto }) => {
  const { t, lang } = useI18n();
  const router = useRouter();
  const { colors } = useTheme();
  return (
    <Card testID={PROVEEDORES_TESTIDS.SUPPLIER_DETAIL} aria-label={`${t('proveedores', 'detailTitle')}: ${supplier.name}`} style={[styles.detail, { backgroundColor: colors.surface2 }]}>
      <Text variant="heading">{`${t('proveedores', 'detailTitle')}: ${supplier.name}`}</Text>
      <View style={styles.fact}>
        <Text variant="label" tone="muted">
          {t('proveedores', 'detailNif')}
        </Text>
        <Text variant="mono" testID={PROVEEDORES_TESTIDS.SUPPLIER_DETAIL_NIF}>
          {supplier.nif}
        </Text>
      </View>
      <View style={styles.fact}>
        <Text variant="label" tone="muted">
          {t('proveedores', 'detailEmail')}
        </Text>
        <Text testID={PROVEEDORES_TESTIDS.SUPPLIER_DETAIL_EMAIL}>{supplier.contactEmail}</Text>
      </View>
      <View style={styles.fact}>
        <Text variant="label" tone="muted">
          {t('proveedores', 'detailStatus')}
        </Text>
        <View testID={PROVEEDORES_TESTIDS.SUPPLIER_DETAIL_STATE}>
          <ApprovalBadge supplier={supplier} testID={PROVEEDORES_TESTIDS.SUPPLIER_DETAIL_BADGE} />
        </View>
      </View>
      <Text variant="label" tone="muted">
        {t('proveedores', 'contractsTitle')}
      </Text>
      {supplier.contracts.length === 0 ? (
        <Text variant="small" tone="faint">
          {t('proveedores', 'noContracts')}
        </Text>
      ) : (
        <View role="list" testID={PROVEEDORES_TESTIDS.SUPPLIER_DETAIL_CONTRACTS} style={styles.contracts}>
          {supplier.contracts.map((contract) => (
            <View key={contract.programCode} role="listitem" testID={PROVEEDORES_DYNAMIC_TESTIDS.SUPPLIER_CONTRACT(contract.programCode)} style={styles.contract}>
              <Pressable
                role="link"
                aria-label={contract.programCode}
                onPress={() => router.push(`/programs/${encodeURIComponent(contract.programCode)}`)}
                style={styles.contractLink}
              >
                <Text variant="mono" tone="accent">
                  {contract.programCode}
                </Text>
              </Pressable>
              <Text variant="small" style={styles.grow} numberOfLines={1}>
                {contract.programName}
              </Text>
              <Text variant="small" tone="muted">
                {formatMoney(contract.amountEur, lang)}
              </Text>
              <Text variant="small" tone="faint">
                {t('proveedores', 'signedOn', { date: formatDate(contract.signedAt, lang) })}
              </Text>
            </View>
          ))}
        </View>
      )}
    </Card>
  );
};

const styles = StyleSheet.create({
  block: { gap: SPACING.sm },
  headText: { gap: 2 },
  list: { gap: SPACING.sm },
  item: { gap: SPACING.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, flexWrap: 'wrap' },
  grow: { flex: 1 },
  detail: { gap: SPACING.sm, borderRadius: RADIUS.lg },
  fact: { gap: 2 },
  contracts: { gap: SPACING.sm },
  contract: { gap: 4 },
  contractLink: { minHeight: 44, justifyContent: 'center' },
});
