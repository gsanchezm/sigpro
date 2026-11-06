import { ApiError, VERIFICACION_DYNAMIC_TESTIDS, VERIFICACION_TESTIDS, can, formatDate, type TestRunDto } from '@sigpro/shared';
import { useEffect } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { downloadBlob } from '../../lib/download';
import { formatTrace } from '../../lib/errors';
import { useAuth } from '../../state/auth';
import { useI18n } from '../../state/i18n';
import { useToast } from '../../state/toast';
import { DownloadIcon } from '../../ui/icons';
import { EvidenceItem } from './EvidenceImage';
import { RunForm } from './RunForm';
import { useTestCaseDetail } from './useVerificationData';
import { ResultBadge } from './VerificationPage';

const dateTime = (iso: string, lang: 'es' | 'en'): string => `${formatDate(iso.slice(0, 10), lang)} ${iso.slice(11, 16)}`;

/** Detalle de un caso de prueba: pasos, requisitos verificados, historial con evidencias y formulario de ejecución. */
export const TestCaseDetailPage = () => {
  const { code = '' } = useParams();
  const { t, lang } = useI18n();
  const { api, user } = useAuth();
  const toast = useToast();
  const location = useLocation();
  const { status, data, error, reload } = useTestCaseDetail(code);
  const canExecute = user ? can(user.role, 'testrun.execute') : false;

  // `/verification/TC-001#run` (menú de la lista) lleva directo al formulario
  useEffect(() => {
    if (data && location.hash === '#run') document.getElementById('run')?.scrollIntoView({ block: 'start' });
  }, [data, location.hash]);

  const downloadReport = async () => {
    try {
      const { blob, filename } = await api.testCases.report({ codes: code });
      const name = filename ?? `informe-verificacion-${code}.pdf`;
      downloadBlob(blob, name);
      toast.push('info', t('verificacion', 'reportReady'), t('verificacion', 'reportReadyBody', { name }));
    } catch (failure) {
      toast.push('danger', t('verificacion', 'reportFailed'), formatTrace(failure) || t('common', 'networkError'));
    }
  };

  const onSaved = (run: TestRunDto) => {
    toast.push('ok', t('verificacion', 'runSaved'), `${t('verificacion', 'runSavedBody', { code: run.testCaseCode, result: t('verificacion', `r_${run.result}`) })} · ${run.id}${run.evidences.length > 0 ? ` ${t('verificacion', 'runSavedFiles', { n: run.evidences.length })}` : ''}`);
    reload();
  };

  if (status === 'error') {
    const missing = error instanceof ApiError && error.status === 404;
    return (
      <section role="alert" data-testid={VERIFICACION_TESTIDS.TESTCASE_NOT_FOUND} className="alert alert-danger flex max-w-[560px] flex-col gap-1">
        <h1 className="m-0 text-[16px] font-semibold">{missing ? t('verificacion', 'notFound') : t('common', 'genericError')}</h1>
        <span className="trace">{formatTrace(error)}</span>
        <Link to="/verification" data-testid={VERIFICACION_TESTIDS.TESTCASE_BACK} className="mt-1 self-start text-[12.5px] font-medium">
          {t('verificacion', 'back')}
        </Link>
      </section>
    );
  }

  if (!data) {
    return (
      <div aria-busy="true" role="status" className="flex flex-col gap-3">
        <span className="skeleton h-6 w-64" />
        <span className="skeleton h-32 w-full max-w-[860px] !rounded-[6px]" />
      </div>
    );
  }

  return (
    <article data-testid={VERIFICACION_TESTIDS.TESTCASE_DETAIL} aria-busy={status === 'loading'} className="flex max-w-[980px] flex-col gap-4">
      <header className="flex flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="font-mono text-[13px] font-medium text-fg-2">{data.code}</span>
          <ResultBadge result={data.lastResult} />
          <span className="font-mono text-[12px] text-fg-3" title={data.programName}>
            {data.programCode}
          </span>
          <button type="button" data-testid={VERIFICACION_TESTIDS.TESTCASE_REPORT} onClick={() => void downloadReport()} className="btn btn-secondary ml-auto !h-8 !px-3">
            <DownloadIcon size={12} />
            {t('verificacion', 'report')}
          </button>
        </div>
        <h1 className="m-0 text-[20px] font-semibold tracking-[-.01em]">{data.title}</h1>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        <section aria-labelledby="steps-title" className="card flex flex-col gap-2 p-4">
          <h2 id="steps-title" className="m-0 text-[14px] font-semibold">
            {t('verificacion', 'stepsTitle')}
          </h2>
          <ol data-testid={VERIFICACION_TESTIDS.TESTCASE_STEPS} className="m-0 flex list-decimal flex-col gap-1 pl-5">
            {data.steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
          <h3 className="m-0 mt-1 text-[12.5px] font-semibold">{t('verificacion', 'expectedTitle')}</h3>
          <p data-testid={VERIFICACION_TESTIDS.TESTCASE_EXPECTED} className="m-0 text-fg-2">
            {data.expected}
          </p>
        </section>

        <section aria-labelledby="requirements-title" className="card flex flex-col gap-2 p-4">
          <h2 id="requirements-title" className="m-0 text-[14px] font-semibold">
            {t('verificacion', 'requirementsTitle')}
          </h2>
          {data.requirements.length === 0 ? (
            <p className="m-0 text-fg-3">{t('verificacion', 'noRequirements')}</p>
          ) : (
            <ul data-testid={VERIFICACION_TESTIDS.TESTCASE_REQUIREMENTS} className="m-0 flex list-none flex-col gap-1.5 p-0">
              {data.requirements.map((requirement) => (
                <li key={requirement.code} className="flex items-baseline gap-2">
                  <Link to={`/programs/${data.programCode}/requirements?select=${requirement.code}`} data-testid={VERIFICACION_DYNAMIC_TESTIDS.TESTCASE_REQUIREMENT_LINK(requirement.code)} className="font-mono text-[12px] font-medium" title={t('verificacion', 'openInRequirements')}>
                    {requirement.code}
                  </Link>
                  <span className="text-fg-2">{requirement.title}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section aria-labelledby="runs-title" className="card flex flex-col gap-2 p-4">
        <h2 id="runs-title" className="m-0 text-[14px] font-semibold">
          {t('verificacion', 'runsTitle')}
        </h2>
        {data.runs.length === 0 ? (
          <p data-testid={VERIFICACION_TESTIDS.TESTCASE_RUNS_EMPTY} className="m-0 text-fg-3">
            {t('verificacion', 'runsEmpty')}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table data-testid={VERIFICACION_TESTIDS.TESTCASE_RUNS} aria-label={t('verificacion', 'runsTitle')} className="w-full min-w-[640px] border-collapse text-[12.5px]">
              <thead>
                <tr className="border-b border-border text-left text-[11.5px] font-medium text-fg-2">
                  <th scope="col" className="px-2 py-1.5">
                    {t('verificacion', 'executedAt')}
                  </th>
                  <th scope="col" className="px-2 py-1.5">
                    {t('verificacion', 'runsColResult')}
                  </th>
                  <th scope="col" className="px-2 py-1.5">
                    {t('verificacion', 'runsColNotes')}
                  </th>
                  <th scope="col" className="px-2 py-1.5">
                    {t('verificacion', 'runsColEvidence')}
                  </th>
                  <th scope="col" className="px-2 py-1.5">
                    {t('verificacion', 'runsColBy')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.runs.map((run) => (
                  <tr key={run.id} data-testid={VERIFICACION_DYNAMIC_TESTIDS.RUN_ROW(run.id)} data-state={run.result} className="border-b border-border align-top last:border-b-0">
                    <td className="px-2 py-2">
                      <div className="font-mono text-[12px] font-medium">{run.id}</div>
                      <div className="text-[11.5px] text-fg-3">{dateTime(run.executedAt, lang)}</div>
                    </td>
                    <td className="px-2 py-2">
                      <ResultBadge result={run.result} testId={VERIFICACION_DYNAMIC_TESTIDS.RUN_RESULT_BADGE(run.id)} />
                    </td>
                    <td className="max-w-[240px] px-2 py-2 text-fg-2">{run.notes || '—'}</td>
                    <td className="px-2 py-2">
                      {run.evidences.length === 0 ? (
                        <span className="text-fg-3">{t('verificacion', 'noEvidence')}</span>
                      ) : (
                        <div className="flex flex-col gap-2">
                          {run.evidences.map((evidence) => (
                            <EvidenceItem key={evidence.id} evidence={evidence} testCaseCode={data.code} />
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-2 py-2">{run.executedByName ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <RunForm testCaseCode={data.code} canExecute={canExecute} onSaved={onSaved} />

      <Link to="/verification" data-testid={VERIFICACION_TESTIDS.TESTCASE_BACK} className="self-start text-[12.5px] font-medium">
        {t('verificacion', 'back')}
      </Link>
    </article>
  );
};
