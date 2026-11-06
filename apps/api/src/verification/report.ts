import type { TestCaseDto, TestResult } from '@sigpro/shared';
import type { PdfLine } from '../common/pdf';

const RESULT_LABEL: Readonly<Record<TestResult | 'none', string>> = { pass: 'Superado', fail: 'Fallido', blocked: 'Bloqueado', none: 'Sin ejecutar' };

const day = (iso: string | null): string => (iso ? iso.slice(0, 10) : '—');

/** Líneas del informe PDF del plan de verificación: resumen por resultado y una ficha por caso. */
export const buildReportLines = (scope: string, generatedAt: string, cases: readonly TestCaseDto[]): readonly PdfLine[] => {
  const count = (result: TestResult | null): number => cases.filter((testCase) => testCase.lastResult === result).length;
  const executed = cases.filter((testCase) => testCase.runCount > 0).length;

  const header: readonly PdfLine[] = [
    { text: 'SIGPRO - Informe del plan de verificación', size: 18, bold: true },
    { text: scope, size: 11, gapBefore: 4 },
    { text: `Generado el ${generatedAt}`, size: 9, gapBefore: 2 },
    { text: 'Resumen', size: 13, bold: true, gapBefore: 16 },
    { text: `Casos de prueba: ${cases.length} · Ejecutados: ${executed} · Sin ejecutar: ${cases.length - executed}`, gapBefore: 4 },
    { text: `Último resultado - Superados: ${count('pass')} · Fallidos: ${count('fail')} · Bloqueados: ${count('blocked')}`, gapBefore: 2 },
  ];

  const sheets = cases.flatMap<PdfLine>((testCase) => [
    { text: `${testCase.code} · ${testCase.title}`, size: 11, bold: true, gapBefore: 14 },
    { text: `Programa ${testCase.programCode} · ${testCase.programName}`, size: 9, gapBefore: 3 },
    { text: `Requisitos verificados: ${testCase.requirementCodes.length > 0 ? testCase.requirementCodes.join(', ') : 'ninguno'}`, size: 9, gapBefore: 1 },
    ...testCase.steps.map((step, index) => ({ text: `   ${index + 1}. ${step}`, gapBefore: index === 0 ? 4 : 0 })),
    { text: `Esperado: ${testCase.expected}`, gapBefore: 3 },
    { text: `Último resultado: ${RESULT_LABEL[testCase.lastResult ?? 'none']} (${day(testCase.lastRunAt)}) · Ejecuciones: ${testCase.runCount}`, size: 9, gapBefore: 3 },
  ]);

  return [...header, ...sheets];
};
