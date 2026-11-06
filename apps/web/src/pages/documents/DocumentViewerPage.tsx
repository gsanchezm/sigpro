import { ApiError, DOCUMENTOS_DYNAMIC_TESTIDS, DOCUMENTOS_TESTIDS, formatDate, type DocumentContentDto } from '@sigpro/shared';
import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { formatTrace } from '../../lib/errors';
import { useAuth } from '../../state/auth';
import { useI18n } from '../../state/i18n';
import { ClassBadge } from './ClassBadge';

const HEADING = /^\d+\. /;

/**
 * Visor HTML de un documento (`/documents/:id/view?version=2`). Es una ruta del mismo origen sin el shell: se carga dentro
 * del `<iframe title="Visor de documento">` de la ficha y también en una pestaña nueva. Comparte sesión (localStorage) y tema.
 */
export const DocumentViewerPage = () => {
  const { id = '' } = useParams();
  const [search] = useSearchParams();
  const { t, lang } = useI18n();
  const { api } = useAuth();
  const wanted = Number.parseInt(search.get('version') ?? '', 10);
  const [content, setContent] = useState<DocumentContentDto | null>(null);
  const [failure, setFailure] = useState<unknown>(null);

  useEffect(() => {
    let cancelled = false;
    setContent(null);
    setFailure(null);
    api.documents.content(id, Number.isInteger(wanted) && wanted > 0 ? wanted : undefined).then(
      (data) => !cancelled && setContent(data),
      (error: unknown) => !cancelled && setFailure(error),
    );
    return () => {
      cancelled = true;
    };
  }, [api, id, wanted]);

  if (failure) {
    const status = failure instanceof ApiError ? failure.status : 0;
    return (
      <main data-testid={DOCUMENTOS_TESTIDS.VIEWER_PAGE} className="min-h-screen bg-bg p-4 text-[13px] text-fg">
        <section role="alert" data-testid={DOCUMENTOS_TESTIDS.VIEWER_ERROR} data-status={status} className="alert alert-danger mx-auto flex max-w-[560px] flex-col gap-1">
          <h1 className="m-0 text-[15px] font-semibold">{status === 403 ? t('documentos', 'forbidden') : status === 404 ? t('documentos', 'notFound') : t('documentos', 'viewerError')}</h1>
          {status === 403 ? <p className="m-0">{t('documentos', 'forbiddenBody')}</p> : null}
          <span className="trace">{formatTrace(failure)}</span>
        </section>
      </main>
    );
  }

  if (!content) {
    return (
      <main data-testid={DOCUMENTOS_TESTIDS.VIEWER_PAGE} aria-busy="true" className="grid min-h-screen place-items-center bg-bg text-[13px] text-fg-2">
        <span role="status" data-testid={DOCUMENTOS_TESTIDS.VIEWER_LOADING} className="flex items-center gap-3">
          <span aria-hidden="true" className="spinner spinner-lg" />
          {t('documentos', 'viewerLoading')}
        </span>
      </main>
    );
  }

  const total = content.pages.length;
  return (
    <main data-testid={DOCUMENTOS_TESTIDS.VIEWER_PAGE} className="min-h-screen bg-bg px-4 py-5 text-[13px] leading-[1.55] text-fg">
      <div className="mx-auto flex max-w-[720px] flex-col gap-4">
        <header className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-[12px] text-fg-2">{content.id}</span>
            <ClassBadge classification={content.classification} testId={DOCUMENTOS_TESTIDS.VIEWER_CLASS} />
            <span data-testid={DOCUMENTOS_TESTIDS.VIEWER_VERSION} className="font-mono text-[12px] text-fg-2">
              {t('documentos', 'versionN', { n: content.version })}
            </span>
            <span className="text-[12px] text-fg-3">{formatDate(content.createdAt.slice(0, 10), lang)}</span>
          </div>
          <h1 data-testid={DOCUMENTOS_TESTIDS.VIEWER_TITLE} className="m-0 text-[20px] font-semibold tracking-[-.01em]">
            {content.title}
          </h1>
          {content.note ? <p className="m-0 text-fg-2">{content.note}</p> : null}
        </header>

        {content.pages.map((lines, index) => {
          const n = index + 1;
          return (
            <section
              key={n}
              data-testid={DOCUMENTOS_DYNAMIC_TESTIDS.VIEWER_PAGE_N(n)}
              aria-label={t('documentos', 'pageOf', { n, total })}
              className="flex min-h-[260px] flex-col gap-1 rounded-[6px] border border-border bg-surface px-7 py-6 shadow-card"
            >
              <h2 className="m-0 mb-2 border-b border-border pb-1.5 font-mono text-[11.5px] font-normal text-fg-3">{t('documentos', 'pageOf', { n, total })}</h2>
              {lines.map((line, lineIndex) =>
                line === '' ? (
                  <div key={lineIndex} aria-hidden="true" className="h-2" />
                ) : (
                  <p key={lineIndex} className={`m-0 ${HEADING.test(line) ? 'mt-1 font-semibold' : ''}`}>
                    {line}
                  </p>
                ),
              )}
            </section>
          );
        })}

        <footer className="text-center text-[11.5px] text-fg-3">{t('documentos', 'viewerFooter')}</footer>
      </div>
    </main>
  );
};
