import { Text as RNText, type TextProps } from 'react-native';
import { useTheme } from '../state/theme';

export type TextVariant = 'title' | 'heading' | 'body' | 'label' | 'small' | 'mono';
export type TextTone = 'default' | 'muted' | 'faint' | 'accent' | 'danger' | 'onAccent';

const VARIANT_STYLE: Readonly<Record<TextVariant, { fontSize: number; fontWeight: '400' | '500' | '600'; fontFamily?: string }>> = {
  title: { fontSize: 20, fontWeight: '600' },
  heading: { fontSize: 15, fontWeight: '600' },
  body: { fontSize: 14, fontWeight: '400' },
  label: { fontSize: 13, fontWeight: '500' },
  small: { fontSize: 12, fontWeight: '400' },
  mono: { fontSize: 12, fontWeight: '400', fontFamily: 'monospace' },
};

interface Props extends TextProps {
  readonly variant?: TextVariant;
  readonly tone?: TextTone;
}

/** Texto con la escala tipográfica y los colores del design system (cambian con el tema). */
export const Text = ({ variant = 'body', tone = 'default', style, ...rest }: Props) => {
  const { colors } = useTheme();
  const color: Readonly<Record<TextTone, string>> = {
    default: colors.text,
    muted: colors.text2,
    faint: colors.text3,
    accent: colors.accent,
    danger: colors.danger,
    onAccent: colors.onAccent,
  };
  return <RNText {...rest} style={[VARIANT_STYLE[variant], { color: color[tone] }, style]} />;
};
