import type { TestRunDto } from '@sigpro/shared';
import { StyleSheet, View } from 'react-native';
import { useI18n } from '../../state/i18n';
import { Card } from '../../ui/Card';
import { Text } from '../../ui/Text';
import { EvidenceItem } from './EvidenceItem';
import { ResultBadge } from './ResultBadge';
import { VERIFICACION_DYNAMIC_TESTIDS, VERIFICACION_TESTIDS } from './testids';
import { dateTime } from './view';

interface Props {
  readonly runs: readonly TestRunDto[];
  readonly testCaseCode: string;
}

/**
 * Historial de ejecuciones (la tabla de la web, una tarjeta por ejecución): código y fecha, resultado con su badge
 * (`data-state`), notas, evidencias con miniatura y quién la ejecutó. Sin ejecuciones, el aviso de vacío.
 */
export const RunsHistory = ({ runs, testCaseCode }: Props) => {
  const { t, lang } = useI18n();

  if (runs.length === 0) {
    return (
      <Text variant="body" tone="faint" testID={VERIFICACION_TESTIDS.TESTCASE_RUNS_EMPTY}>
        {t('verificacion', 'runsEmpty')}
      </Text>
    );
  }

  return (
    <View role="list" aria-label={t('verificacion', 'runsTitle')} testID={VERIFICACION_TESTIDS.TESTCASE_RUNS} style={styles.list}>
      {runs.map((run) => (
        <Card key={run.id} role="listitem" aria-label={run.id} testID={VERIFICACION_DYNAMIC_TESTIDS.RUN_ROW(run.id)} dataSet={{ state: run.result }} style={styles.run}>
          <View style={styles.head}>
            <View style={styles.grow}>
              <Text variant="mono" weight="500">
                {run.id}
              </Text>
              <Text variant="small" tone="faint">
                {dateTime(run.executedAt, lang)}
              </Text>
            </View>
            <ResultBadge result={run.result} testID={VERIFICACION_DYNAMIC_TESTIDS.RUN_RESULT_BADGE(run.id)} />
          </View>

          <Text variant="body" tone="muted">
            {run.notes || '—'}
          </Text>

          {run.evidences.length === 0 ? (
            <Text variant="small" tone="faint">
              {t('verificacion', 'noEvidence')}
            </Text>
          ) : (
            <View style={styles.evidences}>
              {run.evidences.map((evidence) => (
                <EvidenceItem key={evidence.id} evidence={evidence} testCaseCode={testCaseCode} />
              ))}
            </View>
          )}

          <Text variant="small" tone="muted">
            {`${t('verificacion', 'runsColBy')}: ${run.executedByName ?? '—'}`}
          </Text>
        </Card>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  list: { gap: 10 },
  run: { gap: 10 },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  grow: { flex: 1, gap: 2 },
  evidences: { gap: 10 },
});
