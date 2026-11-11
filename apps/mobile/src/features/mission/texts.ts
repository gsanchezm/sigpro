import { useTexts } from '../../state/i18n';

// Textos del panel que no existen en el paquete compartido (el resto sale de `t('mision', …)`).

interface MissionTexts {
  readonly emit: string;
}

const MISSION_TEXTS = {
  es: { emit: 'Emitir evento de prueba' },
  en: { emit: 'Emit test event' },
} satisfies { readonly es: MissionTexts; readonly en: MissionTexts };

export const useMissionTexts = (): MissionTexts => useTexts(MISSION_TEXTS);
