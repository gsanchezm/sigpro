import { VERIFICACION_TESTIDS, type TestResult } from '@sigpro/shared';
import { useI18n } from '../../state/i18n';
import { Badge } from '../../ui/Badge';
import { Text } from '../../ui/Text';
import { resultTone } from './view';

interface Props {
  readonly result: TestResult | null;
  /** `testcase-result-badge` en la lista y el detalle; `run-result-badge-<id>` en cada ejecución. */
  readonly testID?: string;
}

/** Badge del último resultado (`data-state` pass/fail/blocked) o el texto «Sin ejecutar», como la web. */
export const ResultBadge = ({ result, testID = VERIFICACION_TESTIDS.TESTCASE_RESULT_BADGE }: Props) => {
  const { t } = useI18n();
  if (!result) {
    return (
      <Text variant="small" tone="faint">
        {t('verificacion', 'neverRun')}
      </Text>
    );
  }
  return <Badge label={t('verificacion', `r_${result}`)} tone={resultTone(result)} state={result} testID={testID} />;
};
