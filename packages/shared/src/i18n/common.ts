// Textos transversales que no vienen de los prototipos (estados de carga, errores de red, motivos de permisos…).

export const commonEs = {
  appName: 'SIGPRO',
  loading: 'Cargando…',
  genericError: 'Ha ocurrido un error inesperado',
  networkError: 'No se pudo contactar con el servidor',
  sessionExpired: 'La sesión ha caducado. Vuelve a iniciar sesión.',
  skipToContent: 'Saltar al contenido',
  tenant: 'Tenant',
  chaosActive: 'Modo caos activo',
  csvFilename: 'programas.csv',
};

export const commonEn: typeof commonEs = {
  appName: 'SIGPRO',
  loading: 'Loading…',
  genericError: 'An unexpected error occurred',
  networkError: 'Could not reach the server',
  sessionExpired: 'Your session has expired. Please sign in again.',
  skipToContent: 'Skip to content',
  tenant: 'Tenant',
  chaosActive: 'Chaos mode on',
  csvFilename: 'programs.csv',
};
