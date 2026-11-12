import { Text as RNText, type TextProps } from 'react-native';
import { useTheme } from '../state/theme';
import { familyFor, type FontWeight } from '../theme/fonts';

export type TextVariant = 'title' | 'heading' | 'body' | 'label' | 'small' | 'mono' | 'metric';
export type TextTone = 'default' | 'muted' | 'faint' | 'accent' | 'danger' | 'onAccent';

interface VariantStyle {
  readonly fontSize: number;
  /** Explícito siempre: con el de por defecto la caja de texto mide menos que la fuente y la recorta. */
  readonly lineHeight: number;
  readonly weight: FontWeight;
  readonly mono?: boolean;
  readonly letterSpacing?: number;
}

// Escala del design system en móvil: base 14/1,5; título de página 22/600 con -0,02 em (la web usa 22 px por debajo de 640 px);
// título de sección 16/600; cifra de métrica 26/600 con cifras tabulares; código mono a 12,5 px.
const VARIANT_STYLE: Readonly<Record<TextVariant, VariantStyle>> = {
  title: { fontSize: 22, lineHeight: 28, weight: '600', letterSpacing: -0.44 },
  heading: { fontSize: 16, lineHeight: 22, weight: '600' },
  body: { fontSize: 14, lineHeight: 21, weight: '400' },
  label: { fontSize: 13, lineHeight: 18, weight: '500' },
  small: { fontSize: 12, lineHeight: 17, weight: '400' },
  mono: { fontSize: 12.5, lineHeight: 18, weight: '400', mono: true },
  metric: { fontSize: 26, lineHeight: 30, weight: '600' },
};

interface Props extends TextProps {
  readonly variant?: TextVariant;
  readonly tone?: TextTone;
  /** Peso distinto al de la variante (se traduce a otra familia de Geist; no uses `fontWeight`). */
  readonly weight?: FontWeight;
}

/** Texto con la escala tipográfica y los colores del design system (cambian con el tema). */
export const Text = ({ variant = 'body', tone = 'default', weight, style, ...rest }: Props) => {
  const { colors } = useTheme();
  const color: Readonly<Record<TextTone, string>> = {
    default: colors.text,
    muted: colors.text2,
    faint: colors.text3,
    accent: colors.accent,
    danger: colors.danger,
    onAccent: colors.onAccent,
  };
  const { weight: baseWeight, mono, ...metrics } = VARIANT_STYLE[variant];
  return (
    <RNText
      {...rest}
      style={[
        metrics,
        { fontFamily: familyFor(weight ?? baseWeight, mono === true), color: color[tone] },
        variant === 'metric' ? { fontVariant: ['tabular-nums'] } : null,
        style,
      ]}
    />
  );
};
