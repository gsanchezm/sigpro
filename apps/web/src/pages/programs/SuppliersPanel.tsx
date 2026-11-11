import { PROVEEDORES_DYNAMIC_TESTIDS, PROVEEDORES_TESTIDS, formatDate, formatMoney, type SupplierDto } from '@sigpro/shared';
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { formatTrace } from '../../lib/errors';
import { useAuth } from '../../state/auth';
import { useI18n } from '../../state/i18n';
import { ToneBadge } from '../../ui/ToneBadge';
import { SupplierSearch } from './SupplierSearch';
import { approvalState, contractAmountFor } from './supplier-view';

type ContractedState = { readonly status: 'loading' } | { readonly status: 'error'; readonly trace: string } | { readonly status: 'ready'; readonly items: readonly SupplierDto[] };

const ApprovalBadge = ({ supplier, testId }: { supplier: SupplierDto; testId: string }) => {
  const { t } = useI18n();
  const state = approvalState(supplier);
  return <ToneBadge state={state} tone={supplier.approved ? 'ok' : 'warn'} label={supplier.approved ? t('proveedores', 'approved') : t('proveedores', 'notApproved')} testId={testId} />;
};

/** Ficha del proveedor elegido en el combobox: NIF, correo, estado y todos sus contratos. */
const SupplierCard = ({ supplier }: { supplier: SupplierDto }) => {
  const { t, lang } = useI18n();
  return (
    <article data-testid={PROVEEDORES_TESTIDS.SUPPLIER_DETAIL} aria-labelledby="supplier-detail-title" className="flex max-w-[640px] flex-col gap-2 rounded-card border border-border bg-surface-2 p-3">
      <h4 id="supplier-detail-title" className="m-0 text-[13px] font-semibold">
        {t('proveedores', 'detailTitle')}: {supplier.name}
      </h4>
      <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-6 gap-y-1 text-[12.5px]">
        <dt className="text-fg-3">{t('proveedores', 'detailNif')}</dt>
        <dd data-testid={PROVEEDORES_TESTIDS.SUPPLIER_DETAIL_NIF} className="m-0 font-mono">
          {supplier.nif}
        </dd>
        <dt className="text-fg-3">{t('proveedores', 'detailEmail')}</dt>
        <dd data-testid={PROVEEDORES_TESTIDS.SUPPLIER_DETAIL_EMAIL} className="m-0">
          {supplier.contactEmail}
        </dd>
        <dt className="text-fg-3">{t('proveedores', 'detailStatus')}</dt>
        <dd data-testid={PROVEEDORES_TESTIDS.SUPPLIER_DETAIL_STATE} className="m-0">
          <ApprovalBadge supplier={supplier} testId={PROVEEDORES_TESTIDS.SUPPLIER_DETAIL_BADGE} />
        </dd>
      </dl>
      <h5 className="m-0 text-[12px] font-medium text-fg-2">{t('proveedores', 'contractsTitle')}</h5>
      {supplier.contracts.length === 0 ? (
        <p className="m-0 text-[12.5px] text-fg-3">{t('proveedores', 'noContracts')}</p>
      ) : (
        <ul data-testid={PROVEEDORES_TESTIDS.SUPPLIER_DETAIL_CONTRACTS} className="m-0 flex list-none flex-col gap-1 p-0 text-[12.5px]">
          {supplier.contracts.map((contract) => (
            <li key={contract.programCode} data-testid={PROVEEDORES_DYNAMIC_TESTIDS.SUPPLIER_CONTRACT(contract.programCode)} className="flex flex-wrap items-baseline gap-x-3">
              <Link to={`/programs/${contract.programCode}`} className="font-mono font-medium">
                {contract.programCode}
              </Link>
              <span className="min-w-0 flex-1 truncate text-fg-2">{contract.programName}</span>
              <span className="font-mono">{formatMoney(contract.amountEur, lang)}</span>
              <span className="text-[11.5px] text-fg-3">{t('proveedores', 'signedOn', { date: formatDate(contract.signedAt, lang) })}</span>
            </li>
          ))}
        </ul>
      )}
    </article>
  );
};

/** Sección «Proveedores» del resumen del programa: los contratados aquí y el buscador de proveedores del tenant. */
export const SuppliersPanel = ({ programCode }: { programCode: string }) => {
  const { t, lang } = useI18n();
  const { api } = useAuth();
  const [state, setState] = useState<ContractedState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [selected, setSelected] = useState<SupplierDto | null>(null);
  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  useEffect(() => {
    let alive = true;
    setState({ status: 'loading' });
    api.suppliers.list({ program: programCode }).then(
      (items) => alive && setState({ status: 'ready', items }),
      (error: unknown) => alive && setState({ status: 'error', trace: formatTrace(error) || t('common', 'networkError') }),
    );
    return () => {
      alive = false;
    };
  }, [api, programCode, attempt, t]);

  return (
    <section data-testid={PROVEEDORES_TESTIDS.SUPPLIERS_PANEL} aria-labelledby="program-suppliers-title" className="mt-4 flex flex-col gap-3 border-t border-border pt-4">
      <div className="flex flex-wrap items-baseline gap-3">
        <h3 id="program-suppliers-title" className="m-0 text-[13px] font-semibold">
          {t('proveedores', 'title')}
        </h3>
        <span className="text-[12px] text-fg-3">{t('proveedores', 'contractedTitle')}</span>
        {state.status === 'ready' ? (
          <span data-testid={PROVEEDORES_TESTIDS.SUPPLIERS_COUNT} className="font-mono text-[12px] text-fg-2">
            {state.items.length === 1 ? t('proveedores', 'contractedOne') : t('proveedores', 'contractedCount', { count: state.items.length })}
          </span>
        ) : null}
      </div>

      {state.status === 'error' ? (
        <div role="alert" data-testid={PROVEEDORES_TESTIDS.SUPPLIERS_ERROR} className="alert alert-danger flex flex-wrap items-center justify-between gap-3 !px-3 !py-2.5">
          <div>
            <div className="font-semibold">{t('proveedores', 'errorTitle')}</div>
            <div className="trace !text-[12px]">{state.trace}</div>
          </div>
          <button type="button" data-testid={PROVEEDORES_TESTIDS.SUPPLIERS_ERROR_RETRY} onClick={retry} className="btn btn-danger-outline !h-7 !px-2.5">
            {t('proveedores', 'retry')}
          </button>
        </div>
      ) : state.status === 'loading' ? (
        <div role="status" aria-busy="true" className="flex flex-col gap-2">
          <span className="skeleton h-5 w-full max-w-[560px]" />
          <span className="skeleton h-5 w-full max-w-[560px]" />
        </div>
      ) : state.items.length === 0 ? (
        <p data-testid={PROVEEDORES_TESTIDS.SUPPLIERS_EMPTY} className="m-0 text-[12.5px] text-fg-3">
          {t('proveedores', 'empty')}
        </p>
      ) : (
        <table data-testid={PROVEEDORES_TESTIDS.SUPPLIERS_TABLE} className="data-table w-full max-w-[640px] border-collapse text-[12.5px]">
          <caption className="sr-only">{t('proveedores', 'contractedTitle')}</caption>
          <thead>
            <tr className="text-left text-fg-3">
              <th scope="col" className="py-1 pr-3 font-medium">{t('proveedores', 'colName')}</th>
              <th scope="col" className="py-1 pr-3 font-medium">{t('proveedores', 'colNif')}</th>
              <th scope="col" className="py-1 pr-3 text-right font-medium">{t('proveedores', 'colAmount')}</th>
              <th scope="col" className="py-1 font-medium">{t('proveedores', 'colStatus')}</th>
            </tr>
          </thead>
          <tbody>
            {state.items.map((supplier) => (
              <tr key={supplier.id} data-testid={PROVEEDORES_DYNAMIC_TESTIDS.SUPPLIER_ROW(supplier.id)} data-state={approvalState(supplier)} className="border-t border-border">
                <th scope="row" className="py-1.5 pr-3 text-left font-normal">{supplier.name}</th>
                <td className="py-1.5 pr-3 font-mono text-[11.5px]">{supplier.nif}</td>
                <td className="py-1.5 pr-3 text-right font-mono">{formatMoney(contractAmountFor(supplier, programCode) ?? 0, lang)}</td>
                <td className="py-1.5">
                  <ApprovalBadge supplier={supplier} testId={PROVEEDORES_DYNAMIC_TESTIDS.SUPPLIER_BADGE(supplier.id)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <SupplierSearch selected={selected} onSelect={setSelected} />
      {selected ? <SupplierCard supplier={selected} /> : null}
    </section>
  );
};
