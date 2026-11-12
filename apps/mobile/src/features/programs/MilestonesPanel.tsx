import { HITOS_DYNAMIC_TESTIDS, HITOS_TESTIDS, MILESTONE_PROGRESS_STEP, MOVIL_PROGRAMS_DYNAMIC_TESTIDS, MOVIL_PROGRAMS_TESTIDS, formatDate, formatTrace, type MilestoneDto, type UpdateMilestoneInput } from '@sigpro/shared';
import { useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useAuth } from '../../state/auth';
import { useI18n, useTexts } from '../../state/i18n';
import { useToast } from '../../state/toast';
import { useTheme } from '../../state/theme';
import { RADIUS, SPACING } from '../../theme/tokens';
import { Badge } from '../../ui/Badge';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { ConfirmSheet } from '../../ui/ConfirmSheet';
import { Sheet } from '../../ui/Sheet';
import { StepSlider } from '../../ui/StepSlider';
import { ErrorState, LoadingState } from '../../ui/States';
import { Text } from '../../ui/Text';
import { ActionItem } from './ActionItem';
import { MilestoneCreateDialog, MilestoneEditDialog } from './MilestoneDialogs';
import { PROGRAMS_TEXTS } from './texts';
import { useMilestones } from './useMilestones';
import { MILESTONE_STATUS_TONE, countDone, milestoneStatusOf, type ProgramPermissions } from './view';

interface Props {
  readonly code: string;
  readonly permissions: ProgramPermissions;
  /** Tras cada cambio guardado: el detalle vuelve a pedir el programa (avance y hitos cumplidos de la cabecera). */
  readonly onChanged: () => void;
}

/**
 * Hitos del programa (pestaña «Hitos» del detalle): lista de tarjetas con estado, fecha y un slider de avance (− y +, de 5 en 5,
 * como el slider de la web). Alta y edición en hojas, borrado con confirmación y menú ⋯ por hito. Con el 100 % el hito queda
 * cumplido (lo decide el `done` del servidor). Cada acción sigue el permiso del rol y deja su motivo visible.
 */
export const MilestonesPanel = ({ code, permissions, onChanged }: Props) => {
  const { t } = useI18n();
  const texts = useTexts(PROGRAMS_TEXTS);
  const { api } = useAuth();
  const toast = useToast();
  const data = useMilestones(code);
  const { state } = data;
  const [menuId, setMenuId] = useState<string | null>(null);
  const [editing, setEditing] = useState<MilestoneDto | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<MilestoneDto | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  // Número de la última pulsación de cada hito: una respuesta vieja no pisa el avance de una pulsación posterior
  const progressSeq = useRef(new Map<string, number>());

  const items = state.status === 'ready' ? state.items : [];
  const loading = state.status === 'loading';
  const doneCount = countDone(items);
  const menuMilestone = items.find((item) => item.id === menuId) ?? null;
  const newReason = permissions.milestoneEdit ? null : t('hitos', 'newDenied');
  const traceOf = (failure: unknown): string => formatTrace(failure) || t('common', 'networkError');

  /** Guarda un cambio: si la API lo acepta, sustituye el hito y avisa; si no, restaura el valor anterior y avisa con la traza. */
  const save = async (previous: MilestoneDto, patch: UpdateMilestoneInput, detail: string, isLatest: () => boolean = () => true): Promise<void> => {
    try {
      const saved = await api.milestones.update(previous.id, patch);
      if (isLatest()) {
        data.put(saved);
        toast.push('ok', t('hitos', 'updated'), t('hitos', 'updatedBody', { name: saved.name, detail }));
        onChanged();
      }
    } catch (failure) {
      if (isLatest()) data.put(previous);
      toast.push('danger', t('hitos', 'saveErrorTitle'), traceOf(failure));
    }
  };

  /** Avance del slider: optimista (la barra se mueve al instante) y se guarda; las pulsaciones rápidas se resuelven por número. */
  const commitProgress = (milestone: MilestoneDto, progress: number) => {
    if (progress === milestone.progress) return;
    const seq = (progressSeq.current.get(milestone.id) ?? 0) + 1;
    progressSeq.current.set(milestone.id, seq);
    data.put({ ...milestone, progress });
    void save(milestone, { progress }, t('hitos', 'detailProgress', { value: progress }), () => progressSeq.current.get(milestone.id) === seq);
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    setDeleteBusy(true);
    try {
      await api.milestones.remove(deleting.id);
      data.remove(deleting.id);
      toast.push('ok', t('hitos', 'deleted'), deleting.name);
      setDeleting(null);
      onChanged();
    } catch (failure) {
      toast.push('danger', t('hitos', 'saveErrorTitle'), traceOf(failure));
      setDeleting(null);
    } finally {
      setDeleteBusy(false);
    }
  };

  return (
    <View testID={HITOS_TESTIDS.MILESTONES_PANEL} style={styles.block}>
      <View style={styles.head}>
        <View style={styles.headText}>
          <Text variant="heading" role="heading" aria-level={2}>
            {t('hitos', 'title')}
          </Text>
          <Text variant="small" tone="muted" testID={HITOS_TESTIDS.MILESTONES_COUNT} aria-live="polite">
            {loading ? '…' : t('hitos', 'count', { done: doneCount, total: items.length })}
          </Text>
        </View>
        <Button
          label={t('hitos', 'newButton')}
          testID={HITOS_TESTIDS.MILESTONES_NEW}
          variant="primary"
          disabled={!permissions.milestoneEdit}
          disabledReason={newReason ?? undefined}
          onPress={() => setCreating(true)}
        />
      </View>
      {newReason ? (
        <Text variant="small" tone="faint" testID={MOVIL_PROGRAMS_TESTIDS.MILESTONES_NEW_REASON}>
          {newReason}
        </Text>
      ) : (
        <Text variant="small" tone="faint">
          {texts.milestonesHint}
        </Text>
      )}

      {loading ? <LoadingState testID={MOVIL_PROGRAMS_TESTIDS.MILESTONES_LOADING} /> : null}

      {state.status === 'error' ? (
        <ErrorState
          testID={HITOS_TESTIDS.MILESTONES_ERROR}
          retryTestID={HITOS_TESTIDS.MILESTONES_ERROR_RETRY}
          title={t('hitos', 'errorTitle')}
          trace={traceOf(state.error)}
          onRetry={data.reload}
        />
      ) : null}

      {state.status === 'ready' && items.length === 0 ? (
        <Text variant="small" tone="muted" testID={HITOS_TESTIDS.MILESTONES_EMPTY}>
          {t('hitos', 'empty')}
        </Text>
      ) : null}

      {items.length > 0 ? (
        <View role="list" aria-label={t('hitos', 'table', { code })} aria-busy={loading} testID={HITOS_TESTIDS.MILESTONES_TABLE} style={styles.list}>
          {items.map((milestone) => (
            <MilestoneRow
              key={milestone.id}
              milestone={milestone}
              canEdit={permissions.milestoneEdit}
              onOpenMenu={setMenuId}
              onProgress={commitProgress}
            />
          ))}
        </View>
      ) : null}

      <Sheet visible={menuMilestone !== null} title={t('hitos', 'rowActions', { name: menuMilestone?.name ?? '' })} onClose={() => setMenuId(null)} testID={HITOS_TESTIDS.MILESTONE_MENU}>
        {menuMilestone ? (
          <View style={styles.menu}>
            <ActionItem
              label={t('hitos', 'menuRename')}
              testID={HITOS_TESTIDS.MILESTONE_MENU_RENAME}
              reason={permissions.milestoneEdit ? null : t('hitos', 'editDenied')}
              reasonTestID={MOVIL_PROGRAMS_DYNAMIC_TESTIDS.ACTION_REASON('milestone-rename')}
              onPress={() => {
                setMenuId(null);
                setEditing(menuMilestone);
              }}
            />
            <ActionItem
              label={t('hitos', 'menuDelete')}
              testID={HITOS_TESTIDS.MILESTONE_MENU_DELETE}
              variant="danger"
              reason={permissions.milestoneDelete ? null : t('hitos', 'deleteDenied')}
              reasonTestID={MOVIL_PROGRAMS_DYNAMIC_TESTIDS.ACTION_REASON('milestone-delete')}
              onPress={() => {
                setMenuId(null);
                setDeleting(menuMilestone);
              }}
            />
          </View>
        ) : null}
      </Sheet>

      {creating ? (
        <MilestoneCreateDialog
          programCode={code}
          onClose={() => setCreating(false)}
          onCreated={(milestone) => {
            data.append(milestone);
            setCreating(false);
            toast.push('ok', t('hitos', 'created'), t('hitos', 'createdBody', { name: milestone.name, id: milestone.id }));
            onChanged();
          }}
        />
      ) : null}

      {editing ? (
        <MilestoneEditDialog
          milestone={editing}
          onClose={() => setEditing(null)}
          onSaved={(saved, detail) => {
            data.put(saved);
            setEditing(null);
            toast.push('ok', t('hitos', 'updated'), t('hitos', 'updatedBody', { name: saved.name, detail }));
            onChanged();
          }}
        />
      ) : null}

      <ConfirmSheet
        visible={deleting !== null}
        title={t('hitos', 'deleteTitle')}
        message={deleting ? t('hitos', 'deleteBody', { name: deleting.name }) : ''}
        confirmLabel={t('hitos', 'deleteConfirm')}
        cancelLabel={t('hitos', 'deleteCancel')}
        danger
        busy={deleteBusy}
        onConfirm={() => void confirmDelete()}
        onCancel={() => setDeleting(null)}
        testID={HITOS_TESTIDS.MILESTONE_DELETE_DIALOG}
      />
    </View>
  );
};

interface RowProps {
  readonly milestone: MilestoneDto;
  readonly canEdit: boolean;
  readonly onOpenMenu: (id: string) => void;
  readonly onProgress: (milestone: MilestoneDto, progress: number) => void;
}

/** Hito: nombre, estado, fecha límite, slider de avance y el botón ⋯ con «Renombrar» y «Eliminar». */
const MilestoneRow = ({ milestone, canEdit, onOpenMenu, onProgress }: RowProps) => {
  const { t, lang } = useI18n();
  const { colors } = useTheme();
  const { id, name, dueDate, progress } = milestone;
  const status = milestoneStatusOf(milestone);

  return (
    <Card role="listitem" aria-label={name} testID={HITOS_DYNAMIC_TESTIDS.MILESTONE_ROW(id)} dataSet={{ state: status }} style={styles.item}>
      <View style={styles.row}>
        <Text variant="label" testID={HITOS_DYNAMIC_TESTIDS.MILESTONE_NAME(id)} style={styles.grow}>
          {name}
        </Text>
        <Badge label={t('hitos', `status_${status}`)} tone={MILESTONE_STATUS_TONE[status]} state={status} testID={HITOS_DYNAMIC_TESTIDS.MILESTONE_STATUS(id)} />
        <Pressable
          role="button"
          aria-label={t('hitos', 'rowActions', { name })}
          testID={HITOS_DYNAMIC_TESTIDS.MILESTONE_ROW_MENU(id)}
          onPress={() => onOpenMenu(id)}
          style={[styles.menuButton, { borderColor: colors.border, backgroundColor: colors.surface }]}
        >
          <Text variant="heading" tone="muted" aria-hidden>
            ⋯
          </Text>
        </Pressable>
      </View>
      <Text variant="small" tone="muted" testID={HITOS_DYNAMIC_TESTIDS.MILESTONE_DATE(id)}>
        {formatDate(dueDate, lang)}
      </Text>
      <StepSlider
        testID={HITOS_DYNAMIC_TESTIDS.MILESTONE_PROGRESS(id)}
        label={t('hitos', 'progressOf', { name })}
        min={0}
        max={100}
        step={MILESTONE_PROGRESS_STEP}
        value={progress}
        valueText={t('hitos', 'progressText', { value: progress })}
        disabled={!canEdit}
        onChange={(value) => onProgress(milestone, value)}
      />
      {canEdit ? null : (
        <Text variant="small" tone="faint" testID={MOVIL_PROGRAMS_DYNAMIC_TESTIDS.MILESTONE_PROGRESS_REASON(id)}>
          {t('hitos', 'editDenied')}
        </Text>
      )}
    </Card>
  );
};

const styles = StyleSheet.create({
  block: { gap: SPACING.sm },
  head: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: SPACING.sm, flexWrap: 'wrap' },
  headText: { flex: 1, minWidth: 160, gap: 2 },
  list: { gap: SPACING.sm },
  item: { gap: SPACING.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  grow: { flex: 1 },
  menuButton: { width: 44, height: 44, borderWidth: 1, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center' },
  menu: { gap: SPACING.sm },
});
