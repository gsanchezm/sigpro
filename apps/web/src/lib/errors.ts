import { ApiError, type ApiErrorBody, type MessageKey, type Translator } from '@sigpro/shared';

type AccesoKey = MessageKey<'acceso'>;

// Código de error de la API → clave de texto (mapa de despacho, sin switch)
const AUTH_TITLE_KEY: ReadonlyMap<string, AccesoKey> = new Map<string, AccesoKey>([
  ['invalid_credentials', 'e401'],
  ['account_locked', 'e423'],
  ['pending_approval', 'e403'],
  ['account_disabled', 'e403'],
  ['email_exists', 'e409'],
  ['invalid_mfa', 'eMfa'],
]);

// Detalle que el handoff añade a la traza para cada código
const TRACE_SUFFIX: ReadonlyMap<string, (body: ApiErrorBody) => string> = new Map<string, (body: ApiErrorBody) => string>([
  ['invalid_credentials', (body) => ` · attempts=${body.attempts ?? 0}`],
  ['pending_approval', () => ' · reason=pending_approval'],
  ['email_exists', () => ' · field=email'],
]);

export interface AuthErrorView {
  readonly title: string;
  readonly trace: string;
}

/** Error de las pantallas de Acceso: título traducido + traza HTTP en mono. */
export const toAuthError = (error: unknown, t: Translator): AuthErrorView => {
  if (!(error instanceof ApiError)) return { title: t('common', 'genericError'), trace: '' };
  const code = error.body.code ?? '';
  const key = AUTH_TITLE_KEY.get(code);
  const title = error.status === 0 ? t('common', 'networkError') : key ? t('acceso', key) : t('common', 'genericError');
  return { title, trace: `${error.trace}${TRACE_SUFFIX.get(code)?.(error.body) ?? ''}` };
};

/** Traza para listas con error: `GET /api/programs → 503 Service Unavailable · trace 7f3a-c21d`. */
export const formatTrace = (error: unknown): string => {
  if (!(error instanceof ApiError)) return '';
  return error.body.traceId ? `${error.trace} · trace ${error.body.traceId}` : error.trace;
};
