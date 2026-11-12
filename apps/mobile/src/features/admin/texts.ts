// Textos de Administración que no existen en `@sigpro/shared`. El resto sale de `t('admin', …)`, `t('common', …)` y
// `t('perfil', 'noChanges')`. Se usan con `useTexts(ADMIN_TEXTS)`: la tabla tiene que tener las mismas claves en `es` y en `en`.

const es = {
  // La web lanza un `alert()` del navegador; en móvil es un diálogo de la app
  tenantInfoHint: 'Muestra un diálogo con los datos del tenant.',
};

const en: typeof es = {
  tenantInfoHint: 'Shows a dialog with the tenant data.',
};

export const ADMIN_TEXTS = { es, en };
