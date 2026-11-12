import {
  REQUISITOS_TESTIDS,
  can,
  descendantCodes,
  formatTrace,
  type Placement,
  type RequirementDto,
  type RequirementState,
  type Role,
  type UpdateRequirementInput,
} from '@sigpro/shared';
import { useState, type ReactNode } from 'react';
import { ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useI18n, useTexts } from '../../state/i18n';
import { useTheme } from '../../state/theme';
import { SPACING } from '../../theme/tokens';
import { Badge } from '../../ui/Badge';
import { Button } from '../../ui/Button';
import { ConfirmSheet } from '../../ui/ConfirmSheet';
import { Sheet } from '../../ui/Sheet';
import { Text } from '../../ui/Text';
import { RequirementEditForm } from './RequirementEditForm';
import { RequirementFlow } from './RequirementFlow';
import { RequirementMoveForm } from './RequirementMoveForm';
import { RequirementTrace } from './RequirementTrace';
import { REQUIREMENTS_TEXTS } from './texts';
import { MOVIL_REQUIREMENTS_DYNAMIC_TESTIDS, MOVIL_REQUIREMENTS_TESTIDS } from './testids';
import { descriptionToText } from './form';
import { moveTargetsOf, stateTone } from './view';

interface Props {
  /** Requisito abierto; `null` = hoja cerrada. */
  readonly item: RequirementDto | null;
  /** Todos los requisitos del programa (hermanos para «Mover a…», descendientes para el aviso de borrado). */
  readonly items: readonly RequirementDto[];
  readonly role: Role;
  readonly onClose: () => void;
  /** Cada acción llama a la API a través de la página. Las que fallan dejan el aviso en la propia hoja o en el diálogo. */
  readonly onSave: (code: string, changes: UpdateRequirementInput) => Promise<void>;
  readonly onTransition: (code: string, to: RequirementState) => Promise<void>;
  /** Resuelve `false` si falló (la página ya avisó con un toast). */
  readonly onDelete: (code: string) => Promise<boolean>;
  readonly onMove: (code: string, targetCode: string, placement: Placement) => Promise<boolean>;
}

/**
 * Detalle de un requisito en una hoja inferior, con todo lo que la web muestra en su panel: estado y flujo con transiciones,
 * etiquetas, descripción, casos de prueba con su último resultado y no conformidades. Además, edición, «Mover a…» y borrado,
 * cada uno con su permiso y su motivo visible cuando está deshabilitado.
 */
export const RequirementSheet = ({ item, items, role, onClose, onSave, onTransition, onDelete, onMove }: Props) => {
  const { t } = useI18n();
  return (
    <Sheet
      visible={item !== null}
      title={t('requisitos', 'detailTitle')}
      onClose={onClose}
      testID={REQUISITOS_TESTIDS.REQUIREMENT_DETAIL}
      closeTestID={REQUISITOS_TESTIDS.REQUIREMENT_DETAIL_CLOSE}
    >
      {item ? (
        <RequirementDetails
          // Cada requisito empieza sin edición ni formularios abiertos
          key={item.code}
          item={item}
          items={items}
          role={role}
          onClose={onClose}
          onSave={(changes) => onSave(item.code, changes)}
          onTransition={(to) => onTransition(item.code, to)}
          onDelete={() => onDelete(item.code)}
          onMove={(targetCode, placement) => onMove(item.code, targetCode, placement)}
        />
      ) : null}
    </Sheet>
  );
};

interface DetailsProps {
  readonly item: RequirementDto;
  readonly items: readonly RequirementDto[];
  readonly role: Role;
  readonly onClose: () => void;
  readonly onSave: (changes: UpdateRequirementInput) => Promise<void>;
  readonly onTransition: (to: RequirementState) => Promise<void>;
  readonly onDelete: () => Promise<boolean>;
  readonly onMove: (targetCode: string, placement: Placement) => Promise<boolean>;
}

const RequirementDetails = ({ item, items, role, onClose, onSave, onTransition, onDelete, onMove }: DetailsProps) => {
  const { t } = useI18n();
  const texts = useTexts(REQUIREMENTS_TEXTS);
  const { colors } = useTheme();
  const { height } = useWindowDimensions();
  const canEdit = can(role, 'requirement.edit');
  const canDelete = can(role, 'requirement.delete');
  const [editing, setEditing] = useState(false);
  const [moving, setMoving] = useState(false);
  const [moveBusy, setMoveBusy] = useState(false);
  const [transitionTo, setTransitionTo] = useState<RequirementState | null>(null);
  const [transitionBusy, setTransitionBusy] = useState(false);
  const [transitionError, setTransitionError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const siblings = moveTargetsOf(items, item);
  const descendants = descendantCodes(items, item.code).length;
  // El `Sheet` no tiene scroll propio: el contenido se desplaza dentro de una altura máxima explícita (como la hoja de NC)
  const bodyHeight = Math.max(240, height * 0.85 - 120);
  const tags = item.tags.map((tag) => t('requisitos', `tag_${tag}`)).join(' · ');
  const description = descriptionToText(item.description);
  const stateLabel = t('requisitos', `st_${item.state}`);

  // Motivo visible de cada acción deshabilitada (la regla de testabilidad pide texto, no solo `title`)
  const editReason = canEdit ? null : t('requisitos', 'roleNoEdit');
  const moveReason = canEdit ? (siblings.length === 0 ? texts.onlyChild : null) : t('requisitos', 'roleNoEdit');
  const deleteReason = canDelete ? null : t('requisitos', 'roleNoDelete');

  const confirmTransition = async () => {
    if (transitionTo === null) return;
    setTransitionBusy(true);
    setTransitionError(null);
    try {
      await onTransition(transitionTo);
      setTransitionTo(null);
    } catch (failure) {
      setTransitionError(formatTrace(failure) || t('common', 'genericError'));
    } finally {
      setTransitionBusy(false);
    }
  };

  const confirmRemove = async () => {
    setDeleteBusy(true);
    const removed = await onDelete();
    setDeleteBusy(false);
    // Si se borró, la página cierra la hoja; si falló, ya hay un aviso y el diálogo se cierra
    if (!removed) setConfirmDelete(false);
  };

  const moveNow = async (targetCode: string, placement: Placement): Promise<boolean> => {
    setMoveBusy(true);
    const moved = await onMove(targetCode, placement);
    setMoveBusy(false);
    if (moved) setMoving(false);
    return moved;
  };

  return (
    <>
      <ScrollView style={{ maxHeight: bodyHeight }} contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <View style={styles.codeLine}>
          <Text variant="mono" tone="muted" testID={REQUISITOS_TESTIDS.REQUIREMENT_CODE}>
            {item.code}
          </Text>
          <Badge label={stateLabel} tone={stateTone(item.state)} state={item.state} testID={REQUISITOS_TESTIDS.REQUIREMENT_STATE_BADGE} />
        </View>

        {editing ? (
          <RequirementEditForm
            item={item}
            onSave={onSave}
            onDone={(closeAfter) => {
              setEditing(false);
              if (closeAfter) onClose();
            }}
            onCancel={() => setEditing(false)}
          />
        ) : (
          <>
            <Text variant="heading" testID={REQUISITOS_TESTIDS.REQUIREMENT_TITLE}>
              {item.title}
            </Text>
            <Field label={t('requisitos', 'priorityLabel')}>
              <Text testID={REQUISITOS_TESTIDS.REQUIREMENT_PRIORITY}>{t('programas', item.priority)}</Text>
            </Field>
            <Field label={t('requisitos', 'tagsLabel')}>
              {tags ? (
                <Text testID={REQUISITOS_TESTIDS.REQUIREMENT_TAGS}>{tags}</Text>
              ) : (
                <Text tone="faint" testID={REQUISITOS_TESTIDS.REQUIREMENT_TAGS}>
                  {t('requisitos', 'tagsNone')}
                </Text>
              )}
            </Field>
            <Field label={t('requisitos', 'descriptionLabel')}>
              <Text testID={REQUISITOS_TESTIDS.REQUIREMENT_DESCRIPTION}>{description || texts.noDescription}</Text>
            </Field>

            <View testID={MOVIL_REQUIREMENTS_TESTIDS.ACTIONS} style={styles.actions}>
              <Button
                label={texts.editAction}
                testID={MOVIL_REQUIREMENTS_TESTIDS.EDIT}
                disabled={!canEdit}
                disabledReason={editReason ?? undefined}
                onPress={() => setEditing(true)}
              />
              <Button
                label={texts.moveAction}
                testID={MOVIL_REQUIREMENTS_TESTIDS.MOVE}
                disabled={!canEdit || siblings.length === 0}
                disabledReason={moveReason ?? undefined}
                onPress={() => setMoving(true)}
              />
              <Button
                label={t('requisitos', 'menuDelete')}
                testID={REQUISITOS_TESTIDS.REQUIREMENT_MENU_DELETE}
                variant="danger"
                disabled={!canDelete}
                disabledReason={deleteReason ?? undefined}
                onPress={() => setConfirmDelete(true)}
              />
            </View>
            {editReason ? <ActionReason action="edit" text={editReason} /> : null}
            {moveReason ? <ActionReason action="move" text={moveReason} /> : null}
            {deleteReason ? <ActionReason action="delete" text={deleteReason} /> : null}

            {moving ? (
              <View style={[styles.moveBox, { borderColor: colors.border }]}>
                <RequirementMoveForm targets={siblings} busy={moveBusy} onSubmit={moveNow} onCancel={() => setMoving(false)} />
              </View>
            ) : null}

            <RequirementFlow
              item={item}
              role={role}
              onTransition={(to) => {
                setTransitionError(null);
                setTransitionTo(to);
              }}
            />
            <RequirementTrace item={item} />
          </>
        )}
      </ScrollView>

      <ConfirmSheet
        visible={transitionTo !== null}
        title={t('requisitos', 'transitionDialog', { code: item.code })}
        message={
          transitionTo === null
            ? ''
            : t('requisitos', 'transitionBody', { code: item.code, from: stateLabel, to: t('requisitos', `st_${transitionTo}`) })
        }
        confirmLabel={t('requisitos', 'confirm')}
        cancelLabel={t('requisitos', 'cancel')}
        busy={transitionBusy}
        error={transitionError}
        onConfirm={() => void confirmTransition()}
        onCancel={() => setTransitionTo(null)}
        testID={REQUISITOS_TESTIDS.REQUIREMENT_TRANSITION_DIALOG}
      />

      <ConfirmSheet
        visible={confirmDelete}
        title={t('requisitos', 'deleteDialog')}
        message={descendants === 0 ? t('requisitos', 'deleteOne', { code: item.code }) : t('requisitos', 'deleteMany', { code: item.code, n: descendants })}
        confirmLabel={t('requisitos', 'deleteConfirm')}
        cancelLabel={t('requisitos', 'cancel')}
        danger
        busy={deleteBusy}
        onConfirm={() => void confirmRemove()}
        onCancel={() => setConfirmDelete(false)}
        testID={REQUISITOS_TESTIDS.REQUIREMENT_DELETE_DIALOG}
      />
    </>
  );
};

/** Campo de la hoja: etiqueta visible y su valor. */
const Field = ({ label, children }: { readonly label: string; readonly children: ReactNode }) => (
  <View style={styles.field}>
    <Text variant="label" tone="muted">
      {label}
    </Text>
    {children}
  </View>
);

/** Motivo visible de una acción deshabilitada (su `data-testid` es el de la acción, con sufijo). */
const ActionReason = ({ action, text }: { readonly action: 'edit' | 'move' | 'delete'; readonly text: string }) => (
  <Text variant="small" tone="faint" testID={MOVIL_REQUIREMENTS_DYNAMIC_TESTIDS.ACTION_REASON(action)}>
    {text}
  </Text>
);

const styles = StyleSheet.create({
  body: { gap: SPACING.md, paddingBottom: SPACING.sm },
  codeLine: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SPACING.sm, flexWrap: 'wrap' },
  field: { gap: SPACING.xs },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  moveBox: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: SPACING.xs },
});
