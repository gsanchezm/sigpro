import { REQUISITOS_DYNAMIC_TESTIDS, REQUISITOS_TESTIDS, VERIFICACION_DYNAMIC_TESTIDS, PROGRAMAS_TESTIDS, can, type Role } from '@sigpro/shared';
import { Link } from 'react-router-dom';
import { formatTrace } from '../../lib/errors';
import { useAuth } from '../../state/auth';
import { useI18n } from '../../state/i18n';
import { useToast } from '../../state/toast';
import { useTraceability } from './useRequirementsData';

/** Matriz requisito ↔ caso de prueba: una casilla por cruce. Marcar/desmarcar enlaza o desenlaza (con vista optimista). */
export const TraceabilityMatrix = ({ programCode, role, onChanged }: { programCode: string; role: Role; onChanged: () => void }) => {
  const { t } = useI18n();
  const { api } = useAuth();
  const toast = useToast();
  const { status, data, error, reload, setLinks } = useTraceability(programCode);
  const canEdit = can(role, 'requirement.edit');

  if (status === 'error' && !data) {
    return (
      <div role="alert" className="alert alert-danger flex flex-wrap items-center justify-between gap-3">
        <span className="trace">{formatTrace(error) || t('common', 'networkError')}</span>
        <button type="button" data-testid={PROGRAMAS_TESTIDS.PROGRAMS_ERROR_RETRY} onClick={reload} className="btn btn-danger-outline !h-[30px] !px-3">
          {t('requisitos', 'retry')}
        </button>
      </div>
    );
  }

  if (!data) {
    return (
      <div role="status" aria-busy="true" className="flex flex-col gap-2">
        <span className="skeleton h-8 w-full" />
        <span className="skeleton h-8 w-full" />
        <span className="skeleton h-8 w-full" />
      </div>
    );
  }

  if (data.requirements.length === 0 || data.testCases.length === 0) {
    return (
      <div data-testid={REQUISITOS_TESTIDS.MATRIX_EMPTY} className="flex flex-col items-center gap-1 rounded-card border border-dashed border-border-strong px-4 py-10 text-center">
        <div className="font-medium">{t('requisitos', 'matrixTitle')}</div>
        <div className="text-[12.5px] text-fg-2">{t('requisitos', 'matrixEmpty')}</div>
      </div>
    );
  }

  const lastResult = new Map(data.testCases.map((testCase) => [testCase.code, testCase.lastResult]));
  /** Texto del resultado de la última ejecución del caso (el mismo vocabulario que Verificación). */
  const resultLabel = (testCaseCode: string): string => {
    const result = lastResult.get(testCaseCode);
    return result ? t('verificacion', `r_${result}`) : t('verificacion', 'neverRun');
  };
  const linked = new Set(data.links.map((link) => `${link.requirementCode}|${link.testCaseCode}`));
  const coverage = new Map(data.requirements.map((requirement) => [requirement.code, data.links.filter((link) => link.requirementCode === requirement.code).length]));
  const covered = [...coverage.values()].filter((count) => count > 0).length;

  const toggle = async (requirementCode: string, testCaseCode: string, checked: boolean) => {
    const before = data.links;
    // Vista optimista: se marca al instante y, si la API falla, se vuelve atrás
    setLinks(checked ? [...before, { requirementCode, testCaseCode }] : before.filter((link) => !(link.requirementCode === requirementCode && link.testCaseCode === testCaseCode)));
    try {
      if (checked) await api.requirements.link(requirementCode, testCaseCode);
      else await api.requirements.unlink(requirementCode, testCaseCode);
      toast.push('ok', t('requisitos', checked ? 'matrixLinked' : 'matrixUnlinked'), t('requisitos', 'matrixCell', { requirement: requirementCode, testCase: testCaseCode }));
      onChanged();
    } catch (failure) {
      setLinks(before);
      toast.push('danger', t('common', 'genericError'), formatTrace(failure) || t('common', 'networkError'));
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="m-0 text-[12.5px] text-fg-2">{t('requisitos', 'matrixHelp')}</p>
        <ul aria-label={t('requisitos', 'matrixKey')} className="m-0 flex list-none flex-wrap gap-x-3 gap-y-1 p-0 text-[12px] text-fg-2">
          {(
            [
              ['pass', '✓', 'r_pass'],
              ['fail', '✕', 'r_fail'],
              ['blocked', '!', 'r_blocked'],
            ] as const
          ).map(([result, glyph, key]) => (
            <li key={result} data-result={result} className="flex items-center gap-1">
              <span aria-hidden="true" className={`grid h-5 w-6 place-items-center rounded-ctl-sm text-[12px] font-semibold ${result === 'pass' ? 'bg-ok-soft text-ok' : result === 'fail' ? 'bg-danger-soft text-danger' : 'bg-warn-soft text-warn'}`}>
                {glyph}
              </span>
              {t('verificacion', key)}
            </li>
          ))}
          <li data-result="none" className="flex items-center gap-1">
            <span aria-hidden="true" className="grid h-5 w-6 place-items-center rounded-ctl-sm border border-dashed border-border-strong text-[12px] font-semibold text-fg-3">
              ·
            </span>
            {t('verificacion', 'neverRun')}
          </li>
        </ul>
        <p data-testid={REQUISITOS_TESTIDS.MATRIX_LEGEND} className="m-0 font-mono text-[12px] text-fg-2" aria-live="polite">
          {t('requisitos', 'matrixCoverage', { covered, total: data.requirements.length })}
        </p>
      </div>
      <div className="overflow-x-auto rounded-card border border-border bg-surface">
        <table data-testid={REQUISITOS_TESTIDS.MATRIX_TABLE} aria-label={t('requisitos', 'matrixTitle')} className="w-full border-collapse text-[12.5px]">
          <thead>
            <tr className="bg-surface-2">
              <th scope="col" className="sticky left-0 z-[1] min-w-[220px] border-b border-border bg-surface-2 px-3 py-2 text-left text-[12px] font-medium text-fg-2">
                {t('requisitos', 'matrixRowHeader')}
              </th>
              {data.testCases.map((testCase) => (
                <th key={testCase.code} scope="col" title={testCase.title} className="border-b border-l border-border px-2 py-2 text-center font-mono text-[11.5px] font-medium text-fg-2">
                  <Link to={`/verification/${testCase.code}`} data-testid={VERIFICACION_DYNAMIC_TESTIDS.TESTCASE_LINK(testCase.code)} className="!text-fg-2">
                    {testCase.code}
                  </Link>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.requirements.map((requirement) => {
              const count = coverage.get(requirement.code) ?? 0;
              return (
                <tr
                  key={requirement.code}
                  data-testid={REQUISITOS_DYNAMIC_TESTIDS.MATRIX_ROW(requirement.code)}
                  data-covered={count > 0}
                  title={count > 0 ? t('requisitos', 'matrixCoveredTitle', { n: count }) : t('requisitos', 'matrixUncovered')}
                  className="border-b border-border last:border-b-0 hover:bg-surface-2"
                >
                  <th scope="row" className="sticky left-0 z-[1] border-r border-border bg-surface px-3 py-1.5 text-left font-normal">
                    <span className="font-mono text-[12px] font-medium">{requirement.code}</span>
                    <span className="ml-2 text-fg-2">{requirement.title}</span>
                    {count === 0 ? <span className="ml-2 rounded-full bg-warn-soft px-2 text-[11px] text-warn">{t('requisitos', 'matrixUncovered')}</span> : null}
                  </th>
                  {data.testCases.map((testCase) => {
                    const checked = linked.has(`${requirement.code}|${testCase.code}`);
                    // Con enlace, el resultado del caso; sin enlace, la celda queda en --surface-2 (sin relación)
                    const result = checked ? (lastResult.get(testCase.code) ?? 'none') : 'unlinked';
                    const description = t('requisitos', 'matrixCellResult', { requirement: requirement.code, testCase: testCase.code, result: checked ? resultLabel(testCase.code) : t('requisitos', 'matrixNoLink') });
                    return (
                      <td key={testCase.code} className="border-l border-border px-2 py-1.5 text-center">
                        <input
                          type="checkbox"
                          data-testid={REQUISITOS_DYNAMIC_TESTIDS.MATRIX_CELL(requirement.code, testCase.code)}
                          aria-label={description}
                          data-result={result}
                          checked={checked}
                          disabled={!canEdit}
                          title={canEdit ? description : t('requisitos', 'roleNoEdit')}
                          onChange={(event) => void toggle(requirement.code, testCase.code, event.target.checked)}
                          className="matrix-box"
                        />
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
