import { NC_DYNAMIC_TESTIDS, NC_SEVERITIES, NC_SEVERITY_TONE, type NcSeverity } from '@sigpro/shared';
import { Pressable, StyleSheet, View } from 'react-native';
import { useI18n } from '../../state/i18n';
import { useTheme } from '../../state/theme';
import { RADIUS, SPACING, toneColors } from '../../theme/tokens';
import { Text } from '../../ui/Text';
import { pick, isChosen, type SeverityValue } from './severity';
import { SEVERITY_LABEL_KEY } from './texts';

interface Props {
  /** Nombre accesible del selector («Selector de severidad», el de la web). */
  readonly label: string;
  /** Severidad elegida; `null` en el alta (nada elegido). */
  readonly value: SeverityValue;
  readonly onChange: (severity: NcSeverity) => void;
  /** `data-testid` del selector (`nc-new-severity` en el alta, `nc-severity-picker` en la edición). */
  readonly testID: string;
  readonly disabled?: boolean;
  /** Motivo si está deshabilitado (se muestra como texto, regla de testabilidad). */
  readonly disabledReason?: string;
}

/**
 * Selector de severidad: el `<sigpro-severity-picker>` de la web, sin Shadow DOM. Mismas reglas (tres opciones, Menor ·
 * Mayor · Crítica, de selección única y sin valor inicial en el alta) y los mismos ids `severity-picker-option-<valor>`.
 * React Native no tiene los roles `listbox`/`option`: las opciones son `radio` (`aria-checked`) dentro de un `radiogroup`,
 * como el resto de selectores de la app. Cada una mide 44 px y la elegida se pinta con el tono de su severidad.
 */
export const NcSeverityPicker = ({ label, value, onChange, testID, disabled = false, disabledReason }: Props) => {
  const { t } = useI18n();
  const { colors } = useTheme();
  return (
    <View style={styles.wrap}>
      <View testID={testID} role="radiogroup" aria-label={label} aria-disabled={disabled} style={styles.row}>
        {NC_SEVERITIES.map((severity) => {
          const chosen = isChosen(value, severity);
          const tone = toneColors(colors, NC_SEVERITY_TONE[severity]);
          const name = t('nc', SEVERITY_LABEL_KEY[severity]);
          return (
            <Pressable
              key={severity}
              testID={NC_DYNAMIC_TESTIDS.SEVERITY_OPTION(severity)}
              role="radio"
              aria-label={name}
              aria-checked={chosen}
              aria-disabled={disabled}
              dataSet={{ severity }}
              disabled={disabled}
              onPress={() => {
                const next = pick(value, severity);
                if (next !== null) onChange(next);
              }}
              style={[
                styles.option,
                { backgroundColor: chosen ? tone.bg : colors.surface2, borderColor: chosen ? tone.fg : colors.border, opacity: disabled ? 0.5 : 1 },
              ]}
            >
              <Text variant="label" style={{ color: chosen ? tone.fg : colors.text2 }}>
                {name}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {disabled && disabledReason ? (
        <Text variant="small" tone="faint">
          {disabledReason}
        </Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { gap: SPACING.xs },
  row: { flexDirection: 'row', gap: SPACING.sm },
  option: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: RADIUS.md, borderWidth: 1, paddingHorizontal: SPACING.sm },
});
