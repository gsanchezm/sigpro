import { CLASSIFICATION_TONE, DOCUMENTOS_TESTIDS, type Classification } from '@sigpro/shared';
import { useI18n } from '../../state/i18n';
import { ToneBadge } from '../../ui/ToneBadge';

/** Badge de clasificación (`data-state="public|restricted"`). */
export const ClassBadge = ({ classification, testId = DOCUMENTOS_TESTIDS.DOCUMENT_CLASS_BADGE }: { classification: Classification; testId?: string }) => {
  const { t } = useI18n();
  return <ToneBadge state={classification} tone={CLASSIFICATION_TONE[classification]} label={t('documentos', `c_${classification}`)} testId={testId} />;
};
