import { ApiError, DOCUMENTOS_DYNAMIC_TESTIDS, DOCUMENTOS_TESTIDS, can, formatDate, type PublishVersionInput } from '@sigpro/shared';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { downloadBlob } from '../../lib/download';
import { formatTrace } from '../../lib/errors';
import { useAuth } from '../../state/auth';
import { useI18n } from '../../state/i18n';
import { useToast } from '../../state/toast';
import { DownloadIcon } from '../../ui/icons';
import { ClassBadge } from './ClassBadge';
import { DocumentCompare } from './DocumentCompare';
import { PublishVersionDialog } from './PublishVersionDialog';
import { useDocumentDetail } from './useDocumentsData';

/** Ficha de un documento: visor en `<iframe>`, nueva pestaña, descarga, historial de versiones, comparación y nueva versión. */
export const DocumentDetailPage = () => {
  const { id = '' } = useParams();
  const { t, lang } = useI18n();
  const { api, user } = useAuth();
  const toast = useToast();
  const { status, data, error, reload } = useDocumentDetail(id);
  const canPublish = user ? can(user.role, 'document.publish') : false;
  /** Versión que muestra el visor; `null` = la última. */
  const [chosen, setChosen] = useState<number | null>(null);
  const [publishing, setPublishing] = useState(false);

  if (status === 'error') {
    const code = error instanceof ApiError ? error.status : 0;
    const forbidden = code === 403;
    return (
      <section role="alert" data-testid={forbidden ? DOCUMENTOS_TESTIDS.DOCUMENT_FORBIDDEN : DOCUMENTOS_TESTIDS.DOCUMENT_NOT_FOUND} className="alert alert-danger flex max-w-[560px] flex-col gap-1">
        <h1 className="m-0 text-[16px] font-semibold">{forbidden ? t('documentos', 'forbidden') : code === 404 ? t('documentos', 'notFound') : t('common', 'genericError')}</h1>
        {forbidden ? <p className="m-0">{t('documentos', 'forbiddenBody')}</p> : null}
        <span className="trace">{formatTrace(error)}</span>
        <Link to="/documents" data-testid={DOCUMENTOS_TESTIDS.DOCUMENT_BACK} className="mt-1 self-start text-[12.5px] font-medium">
          {t('documentos', 'back')}
        </Link>
      </section>
    );
  }

  if (!data) {
    return (
      <div aria-busy="true" role="status" className="flex flex-col gap-3">
        <span className="skeleton h-6 w-64" />
        <span className="skeleton h-80 w-full max-w-[860px] !rounded-[6px]" />
      </div>
    );
  }

  const shown = chosen ?? data.version;
  const viewerPath = `/documents/${data.id}/view?version=${shown}`;
  const versionsDesc = [...data.versions].sort((a, b) => b.version - a.version);

  const download = async () => {
    try {
      const { blob, filename } = await api.documents.download(data.id, shown);
      downloadBlob(blob, filename ?? `${data.id}-v${shown}.pdf`);
      toast.push('info', t('documentos', 'downloadReady'), filename ?? data.id);
    } catch (failure) {
      toast.push('danger', t('documentos', 'downloadFailed'), formatTrace(failure) || t('common', 'networkError'));
    }
  };

  const publish = async (input: PublishVersionInput) => {
    const updated = await api.documents.publish(data.id, input);
    setPublishing(false);
    setChosen(null);
    toast.push('ok', t('documentos', 'published'), t('documentos', 'publishedBody', { code: updated.id, n: updated.version }));
    reload();
  };

  return (
    <article data-testid={DOCUMENTOS_TESTIDS.DOCUMENT_DETAIL} aria-busy={status === 'loading'} className="flex max-w-[980px] flex-col gap-4">
      <header className="flex flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="font-mono text-[13px] font-medium text-fg-2">{data.id}</span>
          <ClassBadge classification={data.classification} />
          <Link to={`/programs/${data.programCode}`} data-testid={DOCUMENTOS_TESTIDS.DOCUMENT_PROGRAM_LINK} className="font-mono text-[12px]" title={data.programName}>
            {data.programCode}
          </Link>
        </div>
        <h1 data-testid={DOCUMENTOS_TESTIDS.DOCUMENT_TITLE} className="m-0 text-[20px] font-semibold tracking-[-.01em]">
          {data.title}
        </h1>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5 text-[12px] text-fg-2">
          <label htmlFor="document-version">{t('documentos', 'versionLabel')}</label>
          <select
            id="document-version"
            data-testid={DOCUMENTOS_TESTIDS.DOCUMENT_VERSION_SELECT}
            value={shown}
            onChange={(event) => setChosen(Number(event.target.value))}
            className="input input-filter !h-8 !w-auto"
          >
            {versionsDesc.map((v) => (
              <option key={v.version} value={v.version}>
                {t('documentos', 'versionN', { n: v.version })}
                {v.version === data.version ? ` (${t('documentos', 'latest')})` : ''}
              </option>
            ))}
          </select>
        </div>
        {/* Enlace real con target=_blank (no window.open): `context.waitForEvent('page')` */}
        <a href={viewerPath} target="_blank" rel="noopener" data-testid={DOCUMENTOS_TESTIDS.DOCUMENT_OPEN_TAB} className="btn btn-secondary !h-8 !px-3 no-underline">
          {t('documentos', 'openTab')}
        </a>
        <button type="button" data-testid={DOCUMENTOS_TESTIDS.DOCUMENT_DOWNLOAD} onClick={() => void download()} className="btn btn-secondary !h-8 !px-3">
          <DownloadIcon size={12} />
          {t('documentos', 'download')}
        </button>
        <button
          type="button"
          data-testid={DOCUMENTOS_TESTIDS.DOCUMENT_PUBLISH}
          disabled={!canPublish}
          title={canPublish ? undefined : t('documentos', 'publishDenied')}
          onClick={() => setPublishing(true)}
          className="btn btn-primary ml-auto !h-8 !px-3"
        >
          {t('documentos', 'publish')}
        </button>
      </div>

      {/* El visor es una ruta HTML del mismo origen: `frameLocator('[title="Visor de documento"]')` ve su contenido */}
      <iframe
        key={`${data.id}-${shown}-${data.versions.length}`}
        title={t('documentos', 'viewerTitle')}
        src={viewerPath}
        data-testid={DOCUMENTOS_TESTIDS.DOCUMENT_VIEWER}
        className="h-[540px] w-full rounded-[6px] border border-border bg-bg"
      />

      <section aria-labelledby="versions-title" className="card flex flex-col gap-2 p-4">
        <h2 id="versions-title" className="m-0 text-[14px] font-semibold">
          {t('documentos', 'versionsTitle')}
        </h2>
        <ol data-testid={DOCUMENTOS_TESTIDS.DOCUMENT_VERSIONS} className="m-0 flex list-none flex-col gap-1.5 p-0">
          {versionsDesc.map((v) => (
            <li key={v.version} data-testid={DOCUMENTOS_DYNAMIC_TESTIDS.DOCUMENT_VERSION_ROW(v.version)} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
              <span className="font-mono text-[12px] font-medium">v{v.version}</span>
              <span>{v.note || '—'}</span>
              <span className="text-[12px] text-fg-3">
                {v.authorName ? `${t('documentos', 'byAuthor', { name: v.authorName })} · ` : ''}
                {formatDate(v.createdAt.slice(0, 10), lang)}
              </span>
            </li>
          ))}
        </ol>
      </section>

      <DocumentCompare doc={data} />

      <Link to="/documents" data-testid={DOCUMENTOS_TESTIDS.DOCUMENT_BACK} className="self-start text-[12.5px] font-medium">
        {t('documentos', 'back')}
      </Link>

      {publishing ? <PublishVersionDialog doc={data} onClose={() => setPublishing(false)} onSubmit={publish} /> : null}
    </article>
  );
};
