import { ncEs, type MessageKey, type NcSeverity, type NcState } from '@sigpro/shared';

// Textos de la pantalla: las etiquetas de estado y severidad salen de `nc` (mapas tipados, sin claves construidas
// con plantillas); los textos propios de la pantalla móvil van en la tabla `{ es, en }` (`useTexts`).

export const STATE_LABEL_KEY: Readonly<Record<NcState, MessageKey<'nc'>>> = {
  open: 'state_open',
  in_analysis: 'state_in_analysis',
  corrective_action: 'state_corrective_action',
  closed: 'state_closed',
  rejected: 'state_rejected',
};

export const SEVERITY_LABEL_KEY: Readonly<Record<NcSeverity, MessageKey<'nc'>>> = {
  minor: 'sev_minor',
  major: 'sev_major',
  critical: 'sev_critical',
};

/** Clave que devuelve la API o un esquema (`closureShort`…) con texto en el espacio `nc`; si no existe, se usa el genérico. */
export const isNcMessageKey = (key: string): key is MessageKey<'nc'> => Object.keys(ncEs).includes(key);

export const NC_SCREEN_TEXTS = {
  es: {
    subtitle: 'Toca una tarjeta para ver su detalle y cambiar su estado.',
    allSeverities: 'Todas',
    moveHeading: 'Mover a…',
    deniedDetail: 'Tu rol no permite ver esta no conformidad.',
    moveFailed: 'No se pudo cambiar el estado',
  },
  en: {
    subtitle: 'Tap a card to see its detail and change its state.',
    allSeverities: 'All',
    moveHeading: 'Move to…',
    deniedDetail: 'Your role cannot view this nonconformity.',
    moveFailed: 'The state could not be changed',
  },
};
