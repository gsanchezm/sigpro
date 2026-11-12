import { ApiError, CLASSIFICATIONS, DOCUMENTOS_DYNAMIC_TESTIDS, DOCUMENTOS_TESTIDS, PROGRAMAS_TESTIDS, formatDate, type DocumentDto } from '@sigpro/shared';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { downloadBlob } from '../../lib/download';
import { formatTrace } from '../../lib/errors';
import { useDebouncedValue, useDelayedFlag } from '../../lib/hooks';
import { useIsMobileLayout } from '../../lib/layout';
import { useAuth } from '../../state/auth';
import { useI18n } from '../../state/i18n';
import { useToast } from '../../state/toast';
import { RowMenuButton, type MenuItemSpec } from '../../ui/ActionMenu';
import { SearchIcon } from '../../ui/icons';
import { useProgramOptions } from '../requirements/useRequirementsData';
import { ClassBadge } from './ClassBadge';
import { useDocumentsList, type DocumentFilters } from './useDocumentsData';

const SKELETON_ROWS = 5;

/** Módulo Documentos: lista con clasificación por rol (los restringidos no se ven con el rol consultor) y filtros. */
export const DocumentsPage = () => {
  const { t, lang } = useI18n();
  const { api } = useAuth();
  const toast = useToast();
  const mobile = useIsMobileLayout();
  const programs = useProgramOptions();
  const [search, setSearch] = useState('');
  const [program, setProgram] = useState('');
  const [classification, setClassification] = useState('');
  const q = useDebouncedValue(search.trim(), 250);
  const filters: DocumentFilters = { q, program, classification };
  const { status, data, error, reload } = useDocumentsList(filters);

  const rows = data?.items ?? [];
  const loading = status === 'loading';
  const isError = status === 'error';
  const slow = useDelayedFlag(loading, 250);
  const showSkeleton = loading && (data === null || slow);
  const isEmpty = !loading && !isError && rows.length === 0;
  const filtered = Boolean(q || program || classification);
  const clearFilters = () => {
    setSearch('');
    setProgram('');
    setClassification('');
  };

  const download = async (doc: DocumentDto) => {
    try {
      const { blob, filename } = await api.documents.download(doc.id);
      downloadBlob(blob, filename ?? `${doc.id}.pdf`);
      toast.push('info', t('documentos', 'downloadReady'), filename ?? doc.id);
    } catch (failure) {
      toast.push('danger', t('documentos', 'downloadFailed'), formatTrace(failure) || t('common', 'networkError'));
    }
  };

  const menuItems = (doc: DocumentDto): readonly MenuItemSpec[] => [
    { key: 'view', label: t('documentos', 'menuView'), testId: DOCUMENTOS_TESTIDS.DOCUMENT_MENU_VIEW, to: `/documents/${doc.id}` },
    { key: 'tab', label: t('documentos', 'menuOpenTab'), testId: DOCUMENTOS_TESTIDS.DOCUMENT_MENU_OPEN_TAB, href: `/documents/${doc.id}/view`, newTab: true },
    { key: 'download', label: t('documentos', 'menuDownload'), testId: DOCUMENTOS_TESTIDS.DOCUMENT_MENU_DOWNLOAD, onSelect: () => void download(doc) },
  ];

  const hidden = data?.hiddenCount ?? 0;

  return (
    <div data-testid={DOCUMENTOS_TESTIDS.DOCUMENTS_PAGE} className="flex flex-col gap-4">
      <div className="flex flex-col gap-0.5">
        {!mobile ? <h1 className="page-title">{t('documentos', 'title')}</h1> : null}
        <p className="m-0 text-[12.5px] text-fg-2" aria-live="polite">
          {data ? t('documentos', 'subtitle', { n: data.items.length }) : '…'}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1 sm:max-w-[320px]">
          <SearchIcon size={13} className="pointer-events-none absolute top-[10px] left-[9px] text-fg-3" />
          <input
            type="search"
            data-testid={DOCUMENTOS_TESTIDS.DOCUMENTS_SEARCH}
            aria-label={t('documentos', 'searchLabel')}
            placeholder={t('documentos', 'searchPlaceholder')}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="input input-filter !h-8 pl-7"
          />
        </div>
        <div className="flex items-center gap-1.5 text-[12px] text-fg-2">
          <label htmlFor="documents-program">{t('documentos', 'filterProgram')}</label>
          <select
            id="documents-program" data-testid={DOCUMENTOS_TESTIDS.DOCUMENTS_FILTER_PROGRAM} value={program} onChange={(event) => setProgram(event.target.value)} className="input input-filter !h-8 !w-auto max-w-[200px]">
            <option value="">{t('documentos', 'allPrograms')}</option>
            {programs.map((candidate) => (
              <option key={candidate.code} value={candidate.code}>
                {candidate.code}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-1.5 text-[12px] text-fg-2">
          <label htmlFor="documents-class">{t('documentos', 'filterClass')}</label>
          <select
            id="documents-class" data-testid={DOCUMENTOS_TESTIDS.DOCUMENTS_FILTER_CLASS} value={classification} onChange={(event) => setClassification(event.target.value)} className="input input-filter !h-8 !w-auto">
            <option value="">{t('documentos', 'allClasses')}</option>
            {CLASSIFICATIONS.map((value) => (
              <option key={value} value={value}>
                {t('documentos', `c_${value}`)}
              </option>
            ))}
          </select>
        </div>
        {filtered ? (
          <button type="button" data-testid={DOCUMENTOS_TESTIDS.DOCUMENTS_FILTERS_CLEAR} onClick={clearFilters} className="btn btn-ghost !h-8 !px-2.5">
            {t('documentos', 'clearFilters')}
          </button>
        ) : null}
      </div>

      {hidden > 0 ? (
        <p role="note" data-testid={DOCUMENTOS_TESTIDS.DOCUMENTS_HIDDEN_NOTE} className="alert alert-info m-0 text-[12.5px]">
          {t('documentos', 'hiddenNote', { n: hidden })}
        </p>
      ) : null}

      {isError ? (
        <div role="alert" data-testid={DOCUMENTOS_TESTIDS.DOCUMENTS_ERROR} className="alert alert-danger flex flex-wrap items-center justify-between gap-3 !px-3.5 !py-3">
          <div>
            <div className="font-semibold">{t('documentos', 'errorTitle')}</div>
            <div className="trace !text-[12.5px]">{error instanceof ApiError ? formatTrace(error) : t('common', 'networkError')}</div>
          </div>
          <button type="button" data-testid={DOCUMENTOS_TESTIDS.DOCUMENTS_ERROR_RETRY} onClick={reload} className="btn btn-danger-outline !h-[30px] !px-3">
            {t('documentos', 'retry')}
          </button>
        </div>
      ) : null}

      <div className="overflow-hidden rounded-card border border-border bg-surface">
        {!mobile ? (
          <div className="overflow-x-auto">
            <table data-testid={DOCUMENTOS_TESTIDS.DOCUMENTS_TABLE} aria-busy={loading} aria-describedby="documents-count" className="data-table w-full min-w-[760px] border-collapse text-[12.5px]">
              <thead>
                <tr className="border-b border-border text-left text-[11.5px] font-medium text-fg-2">
                  <th scope="col" className="h-9 w-[100px] px-3">
                    {t('documentos', 'colCode')}
                  </th>
                  <th scope="col" className="px-2">
                    {t('documentos', 'colTitle')}
                  </th>
                  <th scope="col" className="w-[100px] px-2">
                    {t('documentos', 'colProgram')}
                  </th>
                  <th scope="col" className="w-[140px] px-2">
                    {t('documentos', 'colClass')}
                  </th>
                  <th scope="col" className="w-[90px] px-2 text-right">
                    {t('documentos', 'colVersion')}
                  </th>
                  <th scope="col" className="w-[120px] px-2">
                    {t('documentos', 'colUpdated')}
                  </th>
                  <th scope="col" className="w-12 px-2">
                    <span className="sr-only">{t('documentos', 'colActions')}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {showSkeleton
                  ? Array.from({ length: SKELETON_ROWS }, (_, index) => (
                      <tr key={index} data-testid={PROGRAMAS_TESTIDS.SKELETON_ROW} className="border-b border-border">
                        {Array.from({ length: 7 }, (__, cell) => (
                          <td key={cell} className="px-3 py-3">
                            <span className="skeleton block h-4 w-3/4" />
                          </td>
                        ))}
                      </tr>
                    ))
                  : rows.map((doc) => (
                      <tr key={doc.id} data-testid={DOCUMENTOS_DYNAMIC_TESTIDS.DOCUMENT_ROW(doc.id)} data-state={doc.classification} className="border-b border-border last:border-b-0 hover:bg-surface-2">
                        <td className="px-3 py-1.5 font-mono text-[12px] font-medium">
                          <Link to={`/documents/${doc.id}`} data-testid={DOCUMENTOS_DYNAMIC_TESTIDS.DOCUMENT_LINK(doc.id)}>
                            {doc.id}
                          </Link>
                        </td>
                        <td className="max-w-[320px] truncate px-2 py-1.5" title={doc.title}>
                          {doc.title}
                        </td>
                        <td className="px-2 py-1.5 font-mono text-[12px] text-fg-2" title={doc.programName}>
                          {doc.programCode}
                        </td>
                        <td className="px-2 py-1.5">
                          <ClassBadge classification={doc.classification} />
                        </td>
                        <td className="px-2 py-1.5 text-right font-mono text-[12px]">v{doc.version}</td>
                        <td className="px-2 py-1.5 text-fg-2">{formatDate(doc.updatedAt.slice(0, 10), lang)}</td>
                        <td className="px-2 py-1.5">
                          <RowMenuButton
                            label={t('documentos', 'rowActions', { code: doc.id })}
                            buttonTestId={DOCUMENTOS_DYNAMIC_TESTIDS.DOCUMENT_ROW_MENU(doc.id)}
                            menuTestId={DOCUMENTOS_TESTIDS.DOCUMENT_MENU}
                            items={menuItems(doc)}
                          />
                        </td>
                      </tr>
                    ))}
              </tbody>
            </table>
          </div>
        ) : (
          <ul aria-busy={loading} className="m-0 flex list-none flex-col gap-2 p-2">
            {showSkeleton
              ? Array.from({ length: 3 }, (_, index) => (
                  <li key={index} data-testid={PROGRAMAS_TESTIDS.SKELETON_ROW} className="card flex flex-col gap-2 p-3">
                    <span className="skeleton h-4 w-1/3" />
                    <span className="skeleton h-4 w-full" />
                  </li>
                ))
              : rows.map((doc) => (
                  <li key={doc.id} data-testid={DOCUMENTOS_DYNAMIC_TESTIDS.DOCUMENT_ROW(doc.id)} data-state={doc.classification} className="card flex flex-col gap-1.5 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <Link to={`/documents/${doc.id}`} data-testid={DOCUMENTOS_DYNAMIC_TESTIDS.DOCUMENT_LINK(doc.id)} className="font-mono text-[12.5px] font-medium">
                        {doc.id}
                      </Link>
                      <ClassBadge classification={doc.classification} />
                    </div>
                    <div>{doc.title}</div>
                    <div className="flex items-center justify-between text-[12px] text-fg-2">
                      <span className="font-mono">{doc.programCode}</span>
                      <span>v{doc.version}</span>
                    </div>
                  </li>
                ))}
          </ul>
        )}

        {isEmpty ? (
          <div data-testid={DOCUMENTOS_TESTIDS.DOCUMENTS_EMPTY} className="flex flex-col items-center gap-1.5 border-t border-border px-4 py-12 text-center">
            <div className="font-medium">{t('documentos', 'emptyTitle')}</div>
            <div className="text-[12.5px] text-fg-2">{filtered ? t('documentos', 'emptyFiltered') : t('documentos', 'emptyNone')}</div>
            {filtered ? (
              <button type="button" data-testid={DOCUMENTOS_TESTIDS.DOCUMENTS_EMPTY_CLEAR} onClick={clearFilters} className="btn btn-secondary mt-1.5 !h-7 !px-2.5 !text-[12px]">
                {t('documentos', 'clearFilters')}
              </button>
            ) : null}
          </div>
        ) : null}

        <div className="border-t border-border px-3 py-2 text-[12px] text-fg-2">
          <span id="documents-count" data-testid={DOCUMENTOS_TESTIDS.DOCUMENTS_COUNT} aria-live="polite">
            {data ? t('documentos', 'count', { n: rows.length }) : '…'}
          </span>
        </div>
      </div>
    </div>
  );
};
