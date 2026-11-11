import { NC_DYNAMIC_TESTIDS, NC_TESTIDS, type NcState, type Role } from '@sigpro/shared';
import { StyleSheet, View } from 'react-native';
import { useI18n, useTexts } from '../../state/i18n';
import { SPACING } from '../../theme/tokens';
import { Button } from '../../ui/Button';
import { Text } from '../../ui/Text';
import { opensClosureForm, moveOptions } from './transitions';
import { NcCloseForm } from './NcCloseForm';
import { NC_SCREEN_TEXTS, STATE_LABEL_KEY } from './texts';
import { MOVIL_NC_TESTIDS } from './testids';

interface Props {
  readonly state: NcState;
  readonly role: Role;
  /** Destino en vuelo (su botón muestra `busy`). */
  readonly moving: NcState | null;
  readonly closing: boolean;
  readonly closureFieldError: string | null;
  readonly serverError: string | null;
  readonly onMove: (to: NcState) => void;
  readonly onOpenClosure: () => void;
  readonly onCancelClosure: () => void;
  readonly onSubmitClosure: (comment: string) => void;
}

/**
 * «Mover a…»: la alternativa móvil al arrastre. Lista solo los destinos de la máquina de estados desde el estado
 * actual; los que el rol no puede elegir quedan deshabilitados con su motivo visible y en `disabledReason`.
 * «Cerrada» no se envía directamente: abre el comentario de cierre.
 */
export const NcTransitions = ({
  state,
  role,
  moving,
  closing,
  closureFieldError,
  serverError,
  onMove,
  onOpenClosure,
  onCancelClosure,
  onSubmitClosure,
}: Props) => {
  const { t } = useI18n();
  const texts = useTexts(NC_SCREEN_TEXTS);
  const options = moveOptions(state, role);
  const firstDenied = options.find((option) => option.deniedKey !== null);
  const reason = firstDenied?.deniedKey ? t('nc', firstDenied.deniedKey) : null;

  const pick = (to: NcState) => {
    if (opensClosureForm(to)) return onOpenClosure();
    onMove(to);
  };

  return (
    <View testID={NC_TESTIDS.NC_TRANSITIONS} role="group" aria-label={texts.moveHeading} style={styles.group}>
      <Text variant="heading">{texts.moveHeading}</Text>
      {options.length === 0 ? (
        <Text variant="small" tone="muted">
          {t('nc', 'transitionNone')}
        </Text>
      ) : null}
      {options.map((option) => (
        <Button
          key={option.to}
          testID={NC_DYNAMIC_TESTIDS.NC_TRANSITION(option.to)}
          label={t('nc', 'menuMove', { state: t('nc', STATE_LABEL_KEY[option.to]) })}
          disabled={!option.allowed || moving !== null}
          disabledReason={option.deniedKey ? t('nc', option.deniedKey) : moving !== null ? t('common', 'processing') : undefined}
          busy={moving === option.to}
          onPress={() => pick(option.to)}
        />
      ))}
      {reason ? (
        <Text variant="small" tone="muted" testID={MOVIL_NC_TESTIDS.TRANSITION_REASON}>
          {reason}
        </Text>
      ) : null}
      {closing ? (
        <NcCloseForm
          fieldError={closureFieldError}
          serverError={serverError}
          submitting={moving === 'closed'}
          onSubmit={onSubmitClosure}
          onCancel={onCancelClosure}
        />
      ) : serverError ? (
        <Text variant="small" tone="danger" role="alert" testID={NC_TESTIDS.NC_SERVER_ERROR}>
          {serverError}
        </Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  group: { gap: SPACING.sm },
});
