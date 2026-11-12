import { REQUISITOS_DYNAMIC_TESTIDS, REQUISITOS_TESTIDS, can, type Role } from '@sigpro/shared';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useAuth } from '../../state/auth';
import { useI18n, useTexts } from '../../state/i18n';
import { useTheme } from '../../state/theme';
import { useToast } from '../../state/toast';
import { RADIUS, SPACING, type Palette } from '../../theme/tokens';
import { EmptyState, ErrorState, LoadingState } from '../../ui/States';
import { Text } from '../../ui/Text';
import { REQUIREMENTS_TEXTS } from './texts';
import { MOVIL_REQUIREMENTS_TESTIDS } from './testids';
import { cellResultOf, coverageOf, coveredCount, failureTrace, linkKey, withLink, type CellResult } from './view';
import { useTraceability } from './useRequirementsData';

// Columnas: 128 px para el requisito (código y título) y 56 px por caso de prueba; la casilla táctil mide 44 px.
const ROW_HEAD_WIDTH = 128;
const COLUMN_WIDTH = 56;
const CELL_HIT = 44;

interface Props {
  readonly programCode: string;
  readonly role: Role;
  /** Tras enlazar o desenlazar: la página recarga la lista (los contadores «Pruebas» y «NC» dependen de los enlaces). */
  readonly onChanged: () => void;
}

/** Glifo de cada resultado de la celda (el mismo que la web). Sin enlace, vacío. */
const GLYPH: Readonly<Record<CellResult, string>> = { pass: '✓', fail: '✕', blocked: '!', none: '·', unlinked: '' };

/** Colores de una celda según su resultado, con los tokens del tema (nunca un hex). */
const cellColors = (colors: Palette, result: CellResult): { readonly bg: string; readonly fg: string; readonly dashed: boolean } => {
  const map: Readonly<Record<CellResult, { readonly bg: string; readonly fg: string; readonly dashed: boolean }>> = {
    pass: { bg: colors.okSoft, fg: colors.ok, dashed: false },
    fail: { bg: colors.dangerSoft, fg: colors.danger, dashed: false },
    blocked: { bg: colors.warnSoft, fg: colors.warn, dashed: false },
    none: { bg: colors.surface, fg: colors.text3, dashed: true },
    unlinked: { bg: colors.surface2, fg: colors.text3, dashed: false },
  };
  return map[result];
};

/**
 * Matriz de trazabilidad: requisitos en filas y casos de prueba en columnas, con el resultado de la última ejecución de cada
 * caso. Se desplaza a los lados (en 390 px no caben todas las columnas). Tocar una casilla enlaza o desenlaza, con vista
 * optimista y vuelta atrás si la API falla (igual que la web). Sin `requirement.edit` las casillas quedan deshabilitadas.
 */
export const RequirementMatrix = ({ programCode, role, onChanged }: Props) => {
  const { t } = useI18n();
  const texts = useTexts(REQUIREMENTS_TEXTS);
  const { colors } = useTheme();
  const { api } = useAuth();
  const toast = useToast();
  const { status, data, failure, reload, setLinks } = useTraceability(programCode);
  const canEdit = can(role, 'requirement.edit');

  if (status === 'error' && data === null) {
    return (
      <ErrorState
        testID={MOVIL_REQUIREMENTS_TESTIDS.MATRIX_ERROR}
        retryTestID={MOVIL_REQUIREMENTS_TESTIDS.MATRIX_ERROR_RETRY}
        title={t('requisitos', 'errorTitle')}
        trace={failureTrace(failure, t('common', 'networkError'))}
        onRetry={reload}
      />
    );
  }

  if (data === null) return <LoadingState testID={MOVIL_REQUIREMENTS_TESTIDS.LOADING} />;

  if (data.requirements.length === 0 || data.testCases.length === 0) {
    return <EmptyState testID={REQUISITOS_TESTIDS.MATRIX_EMPTY} title={t('requisitos', 'matrixTitle')} hint={t('requisitos', 'matrixEmpty')} />;
  }

  const linked = new Set(data.links.map((link) => linkKey(link.requirementCode, link.testCaseCode)));
  const lastResult = new Map(data.testCases.map((testCase) => [testCase.code, testCase.lastResult]));
  const covered = coveredCount(data.requirements, data.links);

  /** Texto del resultado de una celda, con el vocabulario de Verificación. */
  const resultText = (result: CellResult): string => {
    const labels: Readonly<Record<CellResult, () => string>> = {
      pass: () => t('verificacion', 'r_pass'),
      fail: () => t('verificacion', 'r_fail'),
      blocked: () => t('verificacion', 'r_blocked'),
      none: () => t('verificacion', 'neverRun'),
      unlinked: () => t('requisitos', 'matrixNoLink'),
    };
    return labels[result]();
  };

  const toggle = async (requirementCode: string, testCaseCode: string, checked: boolean) => {
    const before = data.links;
    // Vista optimista: la casilla cambia al instante y, si la API falla, vuelve atrás
    setLinks(withLink(before, requirementCode, testCaseCode, checked));
    try {
      if (checked) await api.requirements.link(requirementCode, testCaseCode);
      else await api.requirements.unlink(requirementCode, testCaseCode);
      toast.push('ok', t('requisitos', checked ? 'matrixLinked' : 'matrixUnlinked'), t('requisitos', 'matrixCell', { requirement: requirementCode, testCase: testCaseCode }));
      onChanged();
    } catch (failureOfLink) {
      setLinks(before);
      toast.push('danger', t('common', 'genericError'), failureTrace(failureOfLink, t('common', 'networkError')));
    }
  };

  const keyItems: readonly CellResult[] = ['pass', 'fail', 'blocked', 'none'];

  return (
    <View style={styles.wrap}>
      <Text variant="small" tone="muted">
        {t('requisitos', 'matrixHelp')}
      </Text>
      <Text variant="mono" tone="muted" testID={REQUISITOS_TESTIDS.MATRIX_LEGEND}>
        {t('requisitos', 'matrixCoverage', { covered, total: data.requirements.length })}
      </Text>
      <View role="list" aria-label={t('requisitos', 'matrixKey')} style={styles.key}>
        {keyItems.map((result) => {
          const palette = cellColors(colors, result);
          return (
            <View key={result} role="listitem" style={styles.keyItem}>
              <View style={[styles.glyphBox, { backgroundColor: palette.bg, borderColor: colors.borderStrong, borderStyle: palette.dashed ? 'dashed' : 'solid' }]}>
                <Text variant="small" weight="600" style={{ color: palette.fg }}>
                  {GLYPH[result]}
                </Text>
              </View>
              <Text variant="small" tone="muted">
                {resultText(result)}
              </Text>
            </View>
          );
        })}
      </View>
      {canEdit ? null : (
        <Text variant="small" tone="faint" testID={MOVIL_REQUIREMENTS_TESTIDS.MATRIX_REASON}>
          {t('requisitos', 'roleNoEdit')}
        </Text>
      )}
      <Text variant="small" tone="faint" testID={MOVIL_REQUIREMENTS_TESTIDS.MATRIX_HINT}>
        {texts.matrixScroll}
      </Text>

      <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={styles.scrollContent}>
        <View testID={REQUISITOS_TESTIDS.MATRIX_TABLE} aria-label={t('requisitos', 'matrixTitle')} style={[styles.table, { borderColor: colors.border, backgroundColor: colors.surface }]}>
          <View style={[styles.line, styles.separated, { backgroundColor: colors.surface2, borderBottomColor: colors.border }]}>
            <View style={styles.rowHead}>
              <Text variant="small" tone="muted">
                {t('requisitos', 'matrixRowHeader')}
              </Text>
            </View>
            {data.testCases.map((testCase) => (
              <View key={testCase.code} style={styles.column}>
                <Text variant="mono" tone="muted" numberOfLines={1}>
                  {testCase.code}
                </Text>
              </View>
            ))}
          </View>

          {data.requirements.map((requirement) => {
            const count = coverageOf(data.links, requirement.code);
            return (
              <View
                key={requirement.code}
                testID={REQUISITOS_DYNAMIC_TESTIDS.MATRIX_ROW(requirement.code)}
                dataSet={{ covered: String(count > 0) }}
                style={[styles.line, styles.separated, { borderTopColor: colors.border, borderBottomColor: colors.border }]}
              >
                <View style={styles.rowHead}>
                  <Text variant="mono">{requirement.code}</Text>
                  <Text variant="small" numberOfLines={2}>
                    {requirement.title}
                  </Text>
                  {count === 0 ? (
                    <Text variant="small" tone="danger">
                      {t('requisitos', 'matrixUncovered')}
                    </Text>
                  ) : null}
                </View>
                {data.testCases.map((testCase) => {
                  const isLinked = linked.has(linkKey(requirement.code, testCase.code));
                  const result = cellResultOf(isLinked, lastResult.get(testCase.code) ?? null);
                  const palette = cellColors(colors, result);
                  const description = `${requirement.code} ↔ ${testCase.code}, ${isLinked ? resultText(result) : t('requisitos', 'matrixNoLink')}`;
                  return (
                    <Pressable
                      key={testCase.code}
                      role="checkbox"
                      aria-label={description}
                      aria-checked={isLinked}
                      aria-disabled={!canEdit}
                      disabled={!canEdit}
                      testID={REQUISITOS_DYNAMIC_TESTIDS.MATRIX_CELL(requirement.code, testCase.code)}
                      dataSet={{ result }}
                      onPress={() => void toggle(requirement.code, testCase.code, !isLinked)}
                      style={styles.cellHit}
                    >
                      <View style={[styles.cell, { backgroundColor: palette.bg, borderColor: colors.borderStrong, borderStyle: palette.dashed ? 'dashed' : 'solid', opacity: canEdit ? 1 : 0.6 }]}>
                        <Text variant="small" weight="600" style={{ color: palette.fg }}>
                          {GLYPH[result]}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { gap: SPACING.sm },
  key: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.md },
  keyItem: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs },
  glyphBox: { width: 24, height: 20, borderRadius: RADIUS.sm - 2, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  scrollContent: { paddingBottom: SPACING.xs },
  table: { borderWidth: 1, borderRadius: RADIUS.lg, overflow: 'hidden' },
  line: { flexDirection: 'row', alignItems: 'center' },
  separated: { borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth },
  rowHead: { width: ROW_HEAD_WIDTH, paddingHorizontal: SPACING.sm, paddingVertical: SPACING.xs, gap: 2 },
  column: { width: COLUMN_WIDTH, alignItems: 'center', justifyContent: 'center', paddingVertical: SPACING.sm },
  cellHit: { width: COLUMN_WIDTH, height: CELL_HIT, alignItems: 'center', justifyContent: 'center' },
  cell: { width: 30, height: 24, borderRadius: RADIUS.sm - 2, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
});
