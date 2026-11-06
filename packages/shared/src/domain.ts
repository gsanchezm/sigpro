// Dominio compartido por API y web: roles, estados y constantes. Todo inmutable (`as const`).

export const ROLES = ['admin', 'program_manager', 'consultant', 'auditor'] as const;
export type Role = (typeof ROLES)[number];

/** Roles que se pueden pedir en el registro (admin solo se asigna a mano). */
export const REGISTER_ROLES = ['consultant', 'program_manager', 'auditor'] as const;
export type RegisterRole = (typeof REGISTER_ROLES)[number];

export const PROGRAM_STATUSES = ['draft', 'active', 'on_hold', 'closed', 'cancelled'] as const;
export type ProgramStatus = (typeof PROGRAM_STATUSES)[number];

export const PRIORITIES = ['low', 'medium', 'high'] as const;
export type Priority = (typeof PRIORITIES)[number];

export type Tone = 'neutral' | 'info' | 'warn' | 'ok' | 'danger' | 'purple';

/** Tono del badge por estado (vocabulario del design system). */
export const STATUS_TONE: Readonly<Record<ProgramStatus, Tone>> = {
  draft: 'neutral',
  active: 'info',
  on_hold: 'warn',
  closed: 'ok',
  cancelled: 'danger',
};

export const PROGRAM_SORT_COLUMNS = ['code', 'name', 'status', 'owner', 'dates', 'budget'] as const;
export type ProgramSortColumn = (typeof PROGRAM_SORT_COLUMNS)[number];
export type SortDir = 'asc' | 'desc';

export const PAGE_SIZE = 10;
export const MAX_LOGIN_ATTEMPTS = 5;
export const TOAST_MS = 3000;
export const DEFAULT_TENANT = 'demo';
export const TENANT_HEADER = 'x-tenant';
export const ADMIN_KEY_HEADER = 'x-admin-key';

export const LOCK_THRESHOLD_REASON = 'locked';

/** Textos de estado HTTP (en HTTP/2 `statusText` llega vacío). */
export const HTTP_STATUS_TEXT: Readonly<Record<number, string>> = {
  200: 'OK',
  201: 'Created',
  202: 'Accepted',
  204: 'No Content',
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  409: 'Conflict',
  422: 'Unprocessable Entity',
  423: 'Locked',
  500: 'Internal Server Error',
  501: 'Not Implemented',
  503: 'Service Unavailable',
};
