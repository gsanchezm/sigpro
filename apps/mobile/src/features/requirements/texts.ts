// Textos de la pantalla de Requisitos que no existen en `@sigpro/shared`. El resto sale de `t('requisitos', …)`.
// Se usan con `useTexts(REQUIREMENTS_TEXTS)`: la tabla tiene que tener las mismas claves en `es` y en `en`.

const es = {
  openDetail: 'Abrir detalle de',
  noDescription: 'Sin descripción',
};

const en: typeof es = {
  openDetail: 'Open detail of',
  noDescription: 'No description',
};

export const REQUIREMENTS_TEXTS = { es, en };
