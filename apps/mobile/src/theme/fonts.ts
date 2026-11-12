import { Geist_400Regular } from '@expo-google-fonts/geist/400Regular';
import { Geist_500Medium } from '@expo-google-fonts/geist/500Medium';
import { Geist_600SemiBold } from '@expo-google-fonts/geist/600SemiBold';
import { GeistMono_400Regular } from '@expo-google-fonts/geist-mono/400Regular';
import { GeistMono_500Medium } from '@expo-google-fonts/geist-mono/500Medium';

// Geist (interfaz) y Geist Mono (códigos y cifras), como en la web. En nativo cada peso es una familia aparte
// (un `fontWeight` sobre una fuente personalizada no se sintetiza): por eso el peso se elige por familia, nunca con `fontWeight`.
// Se importa cada peso por su ruta para que el bundle solo lleve los cinco TTF que se usan.

export type FontWeight = '400' | '500' | '600';

export const FONT_FAMILY = {
  regular: 'Geist_400Regular',
  medium: 'Geist_500Medium',
  semibold: 'Geist_600SemiBold',
  mono: 'GeistMono_400Regular',
  monoMedium: 'GeistMono_500Medium',
} as const;

/** Archivos que carga `useFonts` (clave = nombre de la familia). */
export const FONT_ASSETS = {
  [FONT_FAMILY.regular]: Geist_400Regular,
  [FONT_FAMILY.medium]: Geist_500Medium,
  [FONT_FAMILY.semibold]: Geist_600SemiBold,
  [FONT_FAMILY.mono]: GeistMono_400Regular,
  [FONT_FAMILY.monoMedium]: GeistMono_500Medium,
} as const;

const SANS: Readonly<Record<FontWeight, string>> = { '400': FONT_FAMILY.regular, '500': FONT_FAMILY.medium, '600': FONT_FAMILY.semibold };
const MONO: Readonly<Record<FontWeight, string>> = { '400': FONT_FAMILY.mono, '500': FONT_FAMILY.monoMedium, '600': FONT_FAMILY.monoMedium };

/** Familia para un peso (400/500/600); en mono, el 600 usa el 500 (Geist Mono solo se carga en 400 y 500). */
export const familyFor = (weight: FontWeight, mono = false): string => (mono ? MONO : SANS)[weight];
