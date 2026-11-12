// Textos de Auditoría que no existen en `@sigpro/shared`. El resto sale de `t('auditoria', …)`, `t('hitos', 'dateInvalid')` y
// `t('common', …)`. Se usan con `useTexts(AUDIT_TEXTS)`: la tabla tiene que tener las mismas claves en `es` y en `en`.

const es = {
  dateFormat: 'AAAA-MM-DD',
  rangeInvalid: 'La fecha «Hasta» no puede ser anterior a «Desde»',
};

const en: typeof es = {
  dateFormat: 'YYYY-MM-DD',
  rangeInvalid: 'The “To” date cannot be earlier than “From”',
};

export const AUDIT_TEXTS = { es, en };
