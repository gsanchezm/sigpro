import { TEST_RESULTS, type MessageKey, type TestResult, type TestRunDto } from '@sigpro/shared';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { useAuth } from '../../state/auth';
import { useI18n } from '../../state/i18n';
import { useTheme } from '../../state/theme';
import { RADIUS } from '../../theme/tokens';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { Text } from '../../ui/Text';
import { TextField } from '../../ui/TextField';
import { EvidencePicker } from './EvidencePicker';
import { addFiles, removeFileAt, type FileError, type PickedFile } from './files';
import { describeRunFailure, validateRun } from './run';
import { MOVIL_VERIFICATION_TESTIDS, VERIFICACION_DYNAMIC_TESTIDS, VERIFICACION_TESTIDS } from './testids';
import { buildRunForm } from './upload';

interface Props {
  readonly testCaseCode: string;
  readonly canExecute: boolean;
  readonly onSaved: (run: TestRunDto) => void;
}

interface ServerError {
  readonly status: string;
  readonly text: string;
}

/**
 * Registrar ejecución: resultado (obligatorio, uno de tres), notas y evidencias. Valida con el esquema compartido con la API y
 * envía el multipart con `api.testCases.execute`. Sin el permiso `testrun.execute` todo queda deshabilitado y el motivo se ve
 * como texto («Tu rol no permite registrar ejecuciones»). Los 422 se muestran con el mensaje del servidor.
 */
export const RunForm = ({ testCaseCode, canExecute, onSaved }: Props) => {
  const { t } = useI18n();
  const { api } = useAuth();
  const { colors } = useTheme();
  const [result, setResult] = useState<TestResult | ''>('');
  const [notes, setNotes] = useState('');
  const [files, setFiles] = useState<readonly PickedFile[]>([]);
  const [fileErrors, setFileErrors] = useState<readonly FileError[]>([]);
  const [resultError, setResultError] = useState<string | null>(null);
  const [notesError, setNotesError] = useState<string | null>(null);
  const [serverError, setServerError] = useState<ServerError | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const message = (key: string) => t('verificacion', key as MessageKey<'verificacion'>);
  const denied = canExecute ? undefined : t('verificacion', 'denied');

  const pickFiles = (incoming: readonly PickedFile[]) => {
    const added = addFiles(files, incoming);
    setFiles(added.files);
    setFileErrors(added.errors);
  };

  const removeFile = (index: number) => {
    setFiles((current) => removeFileAt(current, index));
    setFileErrors([]);
  };

  const submit = async () => {
    const validation = validateRun(result, notes);
    if (!validation.success) {
      setResultError(validation.errors.result ?? null);
      setNotesError(validation.errors.notes ?? null);
      return;
    }
    setResultError(null);
    setNotesError(null);
    setSubmitting(true);
    setServerError(null);
    try {
      const form = await buildRunForm(validation.data, files, { isWeb: Platform.OS === 'web' });
      const run = await api.testCases.execute(testCaseCode, form);
      setResult('');
      setNotes('');
      setFiles([]);
      setFileErrors([]);
      onSaved(run);
    } catch (error) {
      const failure = describeRunFailure(error, message, t('common', 'genericError'));
      if (failure.resultError) setResultError(failure.resultError);
      setServerError({ status: failure.status, text: failure.text });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card testID={MOVIL_VERIFICATION_TESTIDS.RUN_SECTION} style={styles.card}>
      <Text variant="heading" role="heading" aria-level={2}>
        {t('verificacion', 'runFormTitle')}
      </Text>

      {canExecute ? null : (
        <View role="note" testID={VERIFICACION_TESTIDS.RUN_DENIED} style={[styles.denied, { borderColor: colors.warn, backgroundColor: colors.warnSoft }]}>
          <Text variant="small" tone="default">
            {t('verificacion', 'denied')}
          </Text>
        </View>
      )}

      {serverError ? (
        <View role="alert" testID={VERIFICACION_TESTIDS.RUN_SERVER_ERROR} style={[styles.denied, { borderColor: colors.danger, backgroundColor: colors.dangerSoft }]}>
          <Text variant="small">
            <Text variant="mono" weight="500">
              {serverError.status}
            </Text>
            {` · ${serverError.text}`}
          </Text>
        </View>
      ) : null}

      <View testID={VERIFICACION_TESTIDS.RUN_FORM} aria-busy={submitting} style={styles.form}>
        <View style={styles.group}>
          <Text variant="label" tone="muted">
            {`${t('verificacion', 'resultLabel')} *`}
          </Text>
          <View role="radiogroup" aria-label={t('verificacion', 'resultLabel')} testID={VERIFICACION_TESTIDS.RUN_RESULT} style={styles.radios}>
            {TEST_RESULTS.map((value) => (
              <ResultOption key={value} value={value} selected={result === value} disabled={!canExecute} onPress={() => {
                setResult(value);
                setResultError(null);
              }} />
            ))}
          </View>
          {resultError ? (
            <Text variant="small" tone="danger" role="alert" testID={VERIFICACION_TESTIDS.RUN_RESULT_ERROR}>
              {message(resultError)}
            </Text>
          ) : null}
        </View>

        <TextField
          label={t('verificacion', 'notesLabel')}
          placeholder={t('verificacion', 'notesPlaceholder')}
          testID={VERIFICACION_TESTIDS.RUN_NOTES}
          value={notes}
          onChangeText={setNotes}
          multiline
          editable={canExecute}
          error={notesError ? message(notesError) : undefined}
          errorTestID={MOVIL_VERIFICATION_TESTIDS.RUN_NOTES_ERROR}
        />

        <EvidencePicker files={files} errors={fileErrors} disabled={!canExecute} disabledReason={denied} onPick={pickFiles} onRemove={removeFile} />

        <Button
          label={t('verificacion', 'submit')}
          testID={VERIFICACION_TESTIDS.RUN_SUBMIT}
          variant="primary"
          disabled={!canExecute}
          disabledReason={denied}
          busy={submitting}
          onPress={() => void submit()}
        />
      </View>
    </Card>
  );
};

interface OptionProps {
  readonly value: TestResult;
  readonly selected: boolean;
  readonly disabled: boolean;
  readonly onPress: () => void;
}

/** Opción de resultado: `radio` con `aria-checked` y 44 px de alto (`Chip` no tiene estado deshabilitado). */
const ResultOption = ({ value, selected, disabled, onPress }: OptionProps) => {
  const { t } = useI18n();
  const { colors } = useTheme();
  const label = t('verificacion', `r_${value}`);
  return (
    <Pressable
      testID={VERIFICACION_DYNAMIC_TESTIDS.RUN_RESULT_OPTION(value)}
      role="radio"
      aria-label={label}
      aria-checked={selected}
      aria-disabled={disabled}
      disabled={disabled}
      onPress={onPress}
      style={[styles.option, { backgroundColor: selected ? colors.accentSoft : colors.surface, borderColor: selected ? colors.accent : colors.borderStrong, opacity: disabled ? 0.5 : 1 }]}
    >
      <View aria-hidden style={[styles.dot, { borderColor: selected ? colors.accent : colors.borderStrong, backgroundColor: selected ? colors.accent : 'transparent' }]} />
      <Text variant="label" tone={selected ? 'accent' : 'default'}>
        {label}
      </Text>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  card: { gap: 14 },
  form: { gap: 14 },
  group: { gap: 6 },
  denied: { borderWidth: 1, borderRadius: RADIUS.md, padding: 10 },
  radios: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  option: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: RADIUS.pill, paddingHorizontal: 14 },
  dot: { width: 14, height: 14, borderRadius: RADIUS.pill, borderWidth: 2 },
});
