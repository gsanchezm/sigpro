// Textos de Documentos que no existen en `@sigpro/shared`. El resto sale de `t('documentos', …)` y `t('auditoria', 'loadMore')`.
// Se usan con `useTexts(DOCUMENTS_TEXTS)`: la tabla tiene que tener las mismas claves en `es` y en `en`.

const es = {
  contentEmpty: 'Este documento todavía no tiene contenido.',
};

const en: typeof es = {
  contentEmpty: 'This document has no content yet.',
};

export const DOCUMENTS_TEXTS = { es, en };
