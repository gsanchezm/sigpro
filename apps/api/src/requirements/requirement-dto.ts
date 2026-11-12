import type { Prisma } from '@prisma/client';
import type { RequirementDto, RequirementNcRef, RequirementTag, RequirementTestRef } from '@sigpro/shared';
import { summarizeRuns } from '../verification/test-case-query';

/**
 * Qué se carga con cada requisito: sus casos enlazados y, de cada caso, las ejecuciones con sus NC. Con eso se calcula el
 * resultado de la última ejecución («Pruebas n/m») y las NC del requisito. Lo comparten TODAS las lecturas y escrituras
 * (alta, edición, transición, reordenación): la web sustituye la fila con lo que devuelven y no debe perder esas columnas.
 */
export const WITH_TESTS = {
  tests: {
    select: {
      testCaseCode: true,
      testCase: { select: { runs: { select: { id: true, executedAt: true, result: true, nonConformities: { select: { code: true, severity: true, state: true } } } } } },
    },
  },
} as const;

export type RequirementRow = Prisma.RequirementGetPayload<{ include: typeof WITH_TESTS }>;

const byCode = <T extends { readonly code: string }>(a: T, b: T): number => a.code.localeCompare(b.code);

export const toRequirementDto = (row: RequirementRow): RequirementDto => {
  const links = [...row.tests].sort((a, b) => a.testCaseCode.localeCompare(b.testCaseCode));
  const tests: readonly RequirementTestRef[] = links.map((link) => ({ code: link.testCaseCode, lastResult: summarizeRuns(link.testCase.runs).lastResult }));
  // Una misma NC puede colgar de varias ejecuciones o casos del requisito: se cuenta una vez
  const ncs = new Map<string, RequirementNcRef>(
    links.flatMap((link) => link.testCase.runs.flatMap((run) => run.nonConformities.map((nc): [string, RequirementNcRef] => [nc.code, { code: nc.code, severity: nc.severity, state: nc.state }]))),
  );
  return {
    code: row.code,
    programCode: row.programCode,
    parentCode: row.parentCode,
    title: row.title,
    description: row.description,
    priority: row.priority,
    state: row.state,
    tags: row.tags as RequirementTag[],
    position: row.position,
    testCaseCodes: links.map((link) => link.testCaseCode),
    tests,
    ncs: [...ncs.values()].sort(byCode),
  };
};
