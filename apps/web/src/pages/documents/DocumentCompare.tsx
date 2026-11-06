import { DOCUMENTOS_DYNAMIC_TESTIDS, DOCUMENTOS_TESTIDS, type DocumentCompareDto, type DocumentDetailDto } from '@sigpro/shared';
import { useEffect, useState } from 'react';
import { formatTrace } from '../../lib/errors';
import { useAuth } from '../../state/auth';
import { useI18n } from '../../state/i18n';

/** Comparación de dos versiones: selectores «Desde/Hasta» y tabla de dos columnas con el diff resaltado (`data-diff`). */
export const DocumentCompare = ({ doc }: { doc: DocumentDetailDto }) => {
  const { t } = useI18n();
  const { api } = useAuth();
  const latest = doc.version;
  const [from, setFrom] = useState(Math.max(1, latest - 1));
  const [to, setTo] = useState(latest);
  const [result, setResult] = useState<DocumentCompareDto | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Al publicar una versión nueva, la comparación por defecto pasa a «anterior → última»
  useEffect(() => {
    setFrom(Math.max(1, latest - 1));
    setTo(latest);
  }, [latest, doc.id]);

  const comparable = doc.versions.length >= 2 && from !== to;

  useEffect(() => {
    if (!comparable) {
      setResult(null);
      return;
    }
    let cancelled = false;
    setError(null);
    api.documents.compare(doc.id, from, to).then(
      (data) => !cancelled && setResult(data),
      (failure: unknown) => {
        if (cancelled) return;
        setResult(null);
        setError(formatTrace(failure) || t('common', 'genericError'));
      },
    );
    return () => {
      cancelled = true;
    };
    // `t` cambia con el idioma, pero no debe volver a pedir la comparación
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, doc.id, from, to, comparable]);

  const versions = doc.versions.map((v) => v.version);
  const stale = result !== null && (result.from !== from || result.to !== to);

  return (
    <section aria-labelledby="compare-title" data-testid={DOCUMENTOS_TESTIDS.DOCUMENT_COMPARE} className="card flex flex-col gap-3 p-4">
      <h2 id="compare-title" className="m-0 text-[14px] font-semibold">
        {t('documentos', 'compareTitle')}
      </h2>

      {doc.versions.length < 2 ? (
        <p data-testid={DOCUMENTOS_TESTIDS.DOCUMENT_COMPARE_ONE} className="m-0 text-fg-3">
          {t('documentos', 'compareOne')}
        </p>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5 text-[12px] text-fg-2">
          <label htmlFor="document-compare-from-select">{t('documentos', 'compareFrom')}</label>
          <select
            id="document-compare-from-select" data-testid={DOCUMENTOS_TESTIDS.DOCUMENT_COMPARE_FROM} value={from} onChange={(event) => setFrom(Number(event.target.value))} className="input input-filter !h-8 !w-auto">
                {versions.map((v) => (
                  <option key={v} value={v}>
                    {t('documentos', 'versionN', { n: v })}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-1.5 text-[12px] text-fg-2">
          <label htmlFor="document-compare-to-select">{t('documentos', 'compareTo')}</label>
          <select
            id="document-compare-to-select" data-testid={DOCUMENTOS_TESTIDS.DOCUMENT_COMPARE_TO} value={to} onChange={(event) => setTo(Number(event.target.value))} className="input input-filter !h-8 !w-auto">
                {versions.map((v) => (
                  <option key={v} value={v}>
                    {t('documentos', 'versionN', { n: v })}
                  </option>
                ))}
              </select>
            </div>
            {result ? (
              <p data-testid={DOCUMENTOS_TESTIDS.DOCUMENT_DIFF_STATS} aria-live="polite" className="m-0 ml-auto font-mono text-[12px] text-fg-2">
                {t('documentos', 'diffStats', { added: result.stats.added, removed: result.stats.removed, changed: result.stats.changed })}
              </p>
            ) : null}
          </div>

          {from === to ? <p className="m-0 text-fg-3">{t('documentos', 'compareSame')}</p> : null}
          {error ? (
            <div role="alert" className="alert alert-danger text-[12.5px]">
              {error}
            </div>
          ) : null}

          {comparable && !result && !error ? (
            <div role="status" aria-busy="true" className="text-fg-3">
              {t('documentos', 'compareLoading')}
            </div>
          ) : null}

          {result ? (
            <div className="overflow-x-auto" aria-busy={stale}>
              <table data-testid={DOCUMENTOS_TESTIDS.DOCUMENT_DIFF} aria-label={t('documentos', 'compareTitle')} className="w-full min-w-[560px] table-fixed border-collapse text-[12.5px]">
                <thead>
                  <tr className="border-b border-border bg-surface-2 text-left text-[11.5px] font-medium text-fg-2">
                    <th scope="col" className="w-1/2 px-3 py-1.5">
                      {t('documentos', 'diffOld', { n: result.from })}
                    </th>
                    <th scope="col" className="w-1/2 px-3 py-1.5">
                      {t('documentos', 'diffNew', { n: result.to })}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {result.rows.map((row, index) => (
                    <tr
                      key={index}
                      data-testid={DOCUMENTOS_DYNAMIC_TESTIDS.DOCUMENT_DIFF_ROW(index + 1)}
                      data-diff={row.kind}
                      title={t('documentos', `d_${row.kind}`)}
                      className="diff-row border-b border-border align-top last:border-b-0"
                    >
                      <td className="px-3 py-1">
                        {row.left ? (
                          <span className="flex gap-2">
                            <span className="w-5 flex-none text-right font-mono text-[11px] text-fg-3">{row.left.line}</span>
                            {row.kind === 'same' ? <span>{row.left.text || ' '}</span> : <del>{row.left.text || ' '}</del>}
                          </span>
                        ) : null}
                      </td>
                      <td className="px-3 py-1">
                        {row.right ? (
                          <span className="flex gap-2">
                            <span className="w-5 flex-none text-right font-mono text-[11px] text-fg-3">{row.right.line}</span>
                            {row.kind === 'same' ? <span>{row.right.text || ' '}</span> : <ins>{row.right.text || ' '}</ins>}
                          </span>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
};
