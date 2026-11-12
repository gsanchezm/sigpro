import { type Placement, type RequirementDto } from '@sigpro/shared';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useI18n, useTexts } from '../../state/i18n';
import { SPACING } from '../../theme/tokens';
import { Button } from '../../ui/Button';
import { SelectField } from '../../ui/SelectField';
import { Text } from '../../ui/Text';
import { REQUIREMENTS_TEXTS } from './texts';
import { MOVIL_REQUIREMENTS_TESTIDS } from './testids';
import { MOVE_PLACEMENTS } from './view';

interface Props {
  /** Hermanos del requisito (mismo padre, sin él): las únicas posiciones válidas en la API. */
  readonly targets: readonly RequirementDto[];
  readonly busy: boolean;
  /** Reordena; resuelve `true` si se aplicó (entonces la hoja cierra el formulario). */
  readonly onSubmit: (targetCode: string, placement: Placement) => Promise<boolean>;
  readonly onCancel: () => void;
}

/**
 * «Mover a…»: la alternativa móvil al arrastre. Elige el hermano de referencia y si el requisito va antes o después.
 * La API solo reordena entre hermanos (un destino de otro padre se rechaza con 422), así que no cambia de padre.
 */
export const RequirementMoveForm = ({ targets, busy, onSubmit, onCancel }: Props) => {
  const { t } = useI18n();
  const texts = useTexts(REQUIREMENTS_TEXTS);
  const [target, setTarget] = useState<string>(targets[0]?.code ?? '');
  const [placement, setPlacement] = useState<Placement>('before');
  const none = targets.length === 0;
  const options = targets.map((item) => ({ value: item.code, label: `${item.code} · ${item.title}` }));
  const placementOptions = MOVE_PLACEMENTS.map((value) => ({ value, label: value === 'before' ? texts.placeBefore : texts.placeAfter }));

  return (
    <View testID={MOVIL_REQUIREMENTS_TESTIDS.MOVE_FORM} style={styles.form}>
      <Text variant="heading">{texts.moveHeading}</Text>
      <Text variant="small" tone="muted">
        {texts.moveHint}
      </Text>
      {none ? (
        <Text variant="small" tone="faint" testID={MOVIL_REQUIREMENTS_TESTIDS.MOVE_REASON}>
          {texts.onlyChild}
        </Text>
      ) : (
        <>
          <SelectField<string> label={texts.moveTarget} value={target} options={options} onChange={setTarget} testID={MOVIL_REQUIREMENTS_TESTIDS.MOVE_TARGET} />
          <SelectField<Placement> label={texts.movePlacement} value={placement} options={placementOptions} onChange={setPlacement} testID={MOVIL_REQUIREMENTS_TESTIDS.MOVE_PLACEMENT} />
        </>
      )}
      <View style={styles.actions}>
        <Button label={t('programas', 'cancel')} testID={MOVIL_REQUIREMENTS_TESTIDS.MOVE_CANCEL} onPress={onCancel} disabled={busy} />
        <Button
          label={texts.moveSubmit}
          testID={MOVIL_REQUIREMENTS_TESTIDS.MOVE_SUBMIT}
          variant="primary"
          onPress={() => void onSubmit(target, placement)}
          disabled={none || busy}
          disabledReason={none ? texts.onlyChild : busy ? t('common', 'processing') : undefined}
          busy={busy}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  form: { gap: SPACING.sm, paddingTop: SPACING.sm },
  actions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: SPACING.sm },
});
