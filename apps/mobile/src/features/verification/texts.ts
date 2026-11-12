// Textos de Verificación en móvil que no existen en `@sigpro/shared` (el resto sale de `t('verificacion', …)`).
// Se usan con `useTexts(VERIFICATION_TEXTS)`: la tabla tiene las mismas claves en `es` y en `en`.

const es = {
  sortBy: 'Ordenar por',
  loadMore: 'Cargar más',
  select: 'Seleccionar',
  attachPdf: 'Adjuntar PDF',
  pickFailed: 'No se pudo abrir el selector de archivos',
  enlarge: 'Ampliar',
  previewPdf: 'PDF',
};

const en: typeof es = {
  sortBy: 'Sort by',
  loadMore: 'Load more',
  select: 'Select',
  attachPdf: 'Attach a PDF',
  pickFailed: 'The file picker could not be opened',
  enlarge: 'Enlarge',
  previewPdf: 'PDF',
};

export const VERIFICATION_TEXTS = { es, en };
