import { ApiError, DETALLE_TESTIDS, EDITAR_PROGRAMA_TESTIDS, PROGRAM_STATUSES, formatTrace, type MessageKey, type OwnerDto, type ProgramDto } from '@sigpro/shared';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useResource } from '../../lib/resource';
import { useAuth } from '../../state/auth';
import { useI18n } from '../../state/i18n';
import { useToast } from '../../state/toast';
import { SPACING } from '../../theme/tokens';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { Screen } from '../../ui/Screen';
import { ErrorState, LoadingState } from '../../ui/States';
import { Text } from '../../ui/Text';
import { BasicFields, PlanFields, type ProgramFieldIds } from './ProgramFields';
import { MOVIL_PROGRAMS_DYNAMIC_TESTIDS, MOVIL_PROGRAMS_TESTIDS } from './testids';
import { draftOfProgram, fieldErrorsOf, isDirty, validateUpdate, withoutErrors, type Errors, type ProgramDraft } from './form';
import { isNotFound, programPermissionsOf } from './view';

/** Ids de la web para la edición (`program-edit-*`). */
const EDIT_IDS: ProgramFieldIds = {
  name: EDITAR_PROGRAMA_TESTIDS.PROGRAM_EDIT_NAME,
  nameError: EDITAR_PROGRAMA_TESTIDS.PROGRAM_EDIT_NAME_ERROR,
  description: EDITAR_PROGRAMA_TESTIDS.PROGRAM_EDIT_DESCRIPTION,
  owner: EDITAR_PROGRAMA_TESTIDS.PROGRAM_EDIT_OWNER,
  ownerError: EDITAR_PROGRAMA_TESTIDS.PROGRAM_EDIT_OWNER_ERROR,
  status: EDITAR_PROGRAMA_TESTIDS.PROGRAM_EDIT_STATUS,
  start: EDITAR_PROGRAMA_TESTIDS.PROGRAM_EDIT_START,
  startError: EDITAR_PROGRAMA_TESTIDS.PROGRAM_EDIT_START_ERROR,
  end: EDITAR_PROGRAMA_TESTIDS.PROGRAM_EDIT_END,
  endError: EDITAR_PROGRAMA_TESTIDS.PROGRAM_EDIT_END_ERROR,
  budget: EDITAR_PROGRAMA_TESTIDS.PROGRAM_EDIT_BUDGET,
  budgetError: EDITAR_PROGRAMA_TESTIDS.PROGRAM_EDIT_BUDGET_ERROR,
  priority: {
    low: EDITAR_PROGRAMA_TESTIDS.PROGRAM_EDIT_PRIORITY_LOW,
    medium: EDITAR_PROGRAMA_TESTIDS.PROGRAM_EDIT_PRIORITY_MEDIUM,
    high: EDITAR_PROGRAMA_TESTIDS.PROGRAM_EDIT_PRIORITY_HIGH,
  },
  classified: EDITAR_PROGRAMA_TESTIDS.PROGRAM_EDIT_CLASSIFIED,
};

interface Props {
  readonly code: string;
}

type LoadState = { readonly status: 'loading' } | { readonly status: 'error'; readonly failure: unknown } | { readonly status: 'ready'; readonly program: ProgramDto };

/**
 * Edición de un programa (`/programs/:code/edit`), como `ProgramEditPage`: mismos campos y validaciones que el alta, PATCH
 * parcial con los campos del formulario, 422 bajo cada campo, «Guardar» y «Guardar y cerrar» (vuelve al detalle). Sin permiso
 * `program.edit` se muestra el aviso en lugar del formulario; un programa que no existe, la pantalla de 404.
 */
export const ProgramEditScreen = ({ code }: Props) => {
  const { t } = useI18n();
  const router = useRouter();
  const { api, user } = useAuth();
  const permissions = programPermissionsOf(user?.role ?? 'auditor');
  const [load, setLoad] = useState<LoadState>({ status: 'loading' });
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let alive = true;
    setLoad({ status: 'loading' });
    api.programs.get(code).then(
      (program) => {
        if (alive) setLoad({ status: 'ready', program });
      },
      (failure: unknown) => {
        if (alive) setLoad({ status: 'error', failure });
      },
    );
    return () => {
      alive = false;
    };
  }, [api, code, version]);

  /** Vuelve al detalle (o a la lista si no hay pantalla anterior). */
  const back = () => (router.canGoBack() ? router.back() : router.replace('/programs'));

  if (load.status === 'error') {
    const missing = isNotFound(load.failure);
    return (
      <Screen title={t('programas', 'editProgram')} subtitle={code} testID={EDITAR_PROGRAMA_TESTIDS.PROGRAM_EDIT_PAGE}>
        {missing ? (
          <View role="alert" testID={EDITAR_PROGRAMA_TESTIDS.PROGRAM_EDIT_NOT_FOUND} style={styles.notice}>
            <Text variant="heading" tone="danger">
              {t('common', 'notFound')}
            </Text>
            <Text variant="mono" tone="muted">
              {formatTrace(load.failure)}
            </Text>
            <Button label={t('common', 'backToPrograms')} testID={DETALLE_TESTIDS.PROGRAM_DETAIL_BACK} variant="ghost" onPress={() => router.replace('/programs')} />
          </View>
        ) : (
          <ErrorState
            testID={MOVIL_PROGRAMS_TESTIDS.PROGRAM_DETAIL_ERROR}
            retryTestID={MOVIL_PROGRAMS_TESTIDS.PROGRAM_DETAIL_ERROR_RETRY}
            title={t('common', 'genericError')}
            trace={formatTrace(load.failure) || t('common', 'networkError')}
            onRetry={() => setVersion((current) => current + 1)}
          />
        )}
      </Screen>
    );
  }

  if (load.status === 'loading') {
    return (
      <Screen title={t('programas', 'editProgram')} testID={EDITAR_PROGRAMA_TESTIDS.PROGRAM_EDIT_PAGE}>
        <LoadingState testID={MOVIL_PROGRAMS_TESTIDS.PROGRAM_DETAIL_LOADING} />
      </Screen>
    );
  }

  const { program } = load;

  if (!permissions.edit) {
    return (
      <Screen title={t('programas', 'editProgram')} subtitle={`${program.code} · ${program.name}`} testID={EDITAR_PROGRAMA_TESTIDS.PROGRAM_EDIT_PAGE}>
        <View role="alert" testID={EDITAR_PROGRAMA_TESTIDS.PROGRAM_EDIT_DENIED} style={styles.notice}>
          <Text variant="heading">{t('programas', 'editProgram')}</Text>
          <Text variant="body" tone="muted">
            {t('programas', 'editDenied')}
          </Text>
          <Button label={t('programas', 'backToDetail')} testID={EDITAR_PROGRAMA_TESTIDS.PROGRAM_EDIT_BACK} variant="ghost" onPress={back} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen title={t('programas', 'editProgram')} subtitle={`${program.code} · ${program.name}`} testID={EDITAR_PROGRAMA_TESTIDS.PROGRAM_EDIT_PAGE}>
      <ProgramEditForm
        program={program}
        onSaved={(updated, closeAfter) => {
          setLoad({ status: 'ready', program: updated });
          if (closeAfter) router.replace(`/programs/${encodeURIComponent(updated.code)}`);
        }}
        onCancel={back}
      />
    </Screen>
  );
};

interface FormProps {
  readonly program: ProgramDto;
  /** Guardado correcto: `closeAfter` indica «Guardar y cerrar». */
  readonly onSaved: (program: ProgramDto, closeAfter: boolean) => void;
  readonly onCancel: () => void;
}

/** Formulario de edición: el borrador arranca del programa guardado y «Guardar» solo se habilita si algo cambió. */
const ProgramEditForm = ({ program, onSaved, onCancel }: FormProps) => {
  const { t } = useI18n();
  const { api } = useAuth();
  const toast = useToast();
  const owners = useResource<readonly OwnerDto[]>(() => api.users.owners(), [api]);
  const baseline = useMemo(() => draftOfProgram(program), [program]);
  const [draft, setDraft] = useState<ProgramDraft>(baseline);
  const [errors, setErrors] = useState<Errors>({});
  const [serverError, setServerError] = useState<{ readonly status: string; readonly text: string } | null>(null);
  const [saving, setSaving] = useState<'save' | 'close' | null>(null);
  const message = (key: string) => t('programas', key as MessageKey<'programas'>);
  const dirty = isDirty(draft, baseline);
  const noChanges = dirty ? undefined : t('programas', 'noChanges');
  const busy = saving !== null;

  const change = (patch: Partial<ProgramDraft>) => {
    setDraft((current) => ({ ...current, ...patch }));
    setErrors((current) => withoutErrors(current, Object.keys(patch)));
  };

  const save = async (closeAfter: boolean) => {
    const result = validateUpdate(draft);
    if (!result.success) {
      setErrors(result.errors);
      return;
    }
    setSaving(closeAfter ? 'close' : 'save');
    setServerError(null);
    try {
      const updated = await api.programs.update(program.code, result.data);
      setDraft(draftOfProgram(updated));
      setErrors({});
      toast.push('ok', t('programas', 'updated'), t('programas', 'updatedBody', { code: updated.code }));
      onSaved(updated, closeAfter);
    } catch (failure) {
      const fields = fieldErrorsOf(failure);
      if (fields) {
        setErrors(fields);
        setServerError({ status: '422', text: message(Object.values(fields)[0] ?? 'dupName') });
      } else {
        setServerError({ status: failure instanceof ApiError ? String(failure.status || '—') : '—', text: formatTrace(failure) || t('common', 'genericError') });
      }
    } finally {
      setSaving(null);
    }
  };

  return (
    <>
      {serverError ? (
        <Text variant="small" tone="danger" role="alert" testID={EDITAR_PROGRAMA_TESTIDS.PROGRAM_EDIT_SERVER_ERROR}>
          {`${serverError.status} · ${serverError.text}`}
        </Text>
      ) : null}

      <Card testID={EDITAR_PROGRAMA_TESTIDS.PROGRAM_EDIT_FORM} style={styles.form}>
        <BasicFields
          draft={draft}
          onChange={change}
          errors={errors}
          ids={EDIT_IDS}
          owners={owners.data ?? []}
          statuses={PROGRAM_STATUSES}
          statusLabel={t('programas', 'status')}
          code={{ value: program.code, testID: EDITAR_PROGRAMA_TESTIDS.PROGRAM_EDIT_CODE }}
        />
        <PlanFields draft={draft} onChange={change} errors={errors} ids={EDIT_IDS} />

        <View style={styles.actions}>
          <Button label={t('programas', 'cancel')} testID={EDITAR_PROGRAMA_TESTIDS.PROGRAM_EDIT_CANCEL} variant="ghost" onPress={onCancel} disabled={busy} />
          <Button
            label={t('programas', 'saveAndClose')}
            testID={EDITAR_PROGRAMA_TESTIDS.PROGRAM_EDIT_SAVE_CLOSE}
            variant="secondary"
            disabled={!dirty || busy}
            disabledReason={saving !== null ? t('common', 'processing') : noChanges}
            busy={saving === 'close'}
            onPress={() => void save(true)}
          />
          <Button
            label={t('programas', 'save')}
            testID={EDITAR_PROGRAMA_TESTIDS.PROGRAM_EDIT_SAVE}
            variant="primary"
            disabled={!dirty || busy}
            disabledReason={saving !== null ? t('common', 'processing') : noChanges}
            busy={saving === 'save'}
            onPress={() => void save(false)}
          />
        </View>
        {dirty ? null : (
          <Text variant="small" tone="faint" testID={MOVIL_PROGRAMS_DYNAMIC_TESTIDS.ACTION_REASON('save')}>
            {t('programas', 'noChanges')}
          </Text>
        )}
      </Card>
    </>
  );
};

const styles = StyleSheet.create({
  notice: { alignItems: 'flex-start', gap: SPACING.sm, paddingVertical: SPACING.md },
  form: { gap: SPACING.md },
  actions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: SPACING.sm },
});
