import type { MessageKey } from '@sigpro/shared';

// Endpoints de la API que más se usan en las prácticas (lista curada de /lab). La descripción es una clave de i18n.

export type LabAccess = 'public' | 'any' | 'manager' | 'consultant' | 'audit' | 'admin';
export type LabMethod = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

export interface LabEndpoint {
  /** Sufijo del `data-testid` (`lab-endpoint-<id>`): único y estable. */
  readonly id: string;
  readonly method: LabMethod;
  /** Ruta relativa al prefijo `/api`. */
  readonly path: string;
  readonly access: LabAccess;
  readonly description: MessageKey<'lab'>;
}

export const LAB_ENDPOINTS: readonly LabEndpoint[] = [
  { id: 'auth-login', method: 'POST', path: '/auth/login', access: 'public', description: 'epAuthLogin' },
  { id: 'auth-mfa', method: 'POST', path: '/auth/mfa', access: 'public', description: 'epAuthMfa' },
  { id: 'auth-refresh', method: 'POST', path: '/auth/refresh', access: 'public', description: 'epAuthRefresh' },
  { id: 'config', method: 'GET', path: '/config', access: 'public', description: 'epConfig' },
  { id: 'health', method: 'GET', path: '/health', access: 'public', description: 'epHealth' },
  { id: 'programs-list', method: 'GET', path: '/programs', access: 'any', description: 'epProgramsList' },
  { id: 'programs-create', method: 'POST', path: '/programs', access: 'manager', description: 'epProgramsCreate' },
  { id: 'programs-delete', method: 'DELETE', path: '/programs/:code', access: 'manager', description: 'epProgramsDelete' },
  { id: 'requirements-list', method: 'GET', path: '/programs/:code/requirements', access: 'any', description: 'epRequirementsList' },
  { id: 'requirements-transition', method: 'POST', path: '/requirements/:code/transition', access: 'any', description: 'epRequirementsTransition' },
  { id: 'test-runs', method: 'POST', path: '/test-cases/:code/runs', access: 'consultant', description: 'epTestRuns' },
  { id: 'verification-report', method: 'GET', path: '/verification/report', access: 'any', description: 'epVerificationReport' },
  { id: 'documents-list', method: 'GET', path: '/documents', access: 'any', description: 'epDocumentsList' },
  { id: 'documents-detail', method: 'GET', path: '/documents/:id', access: 'any', description: 'epDocumentsDetail' },
  { id: 'nc-list', method: 'GET', path: '/nc', access: 'any', description: 'epNcList' },
  { id: 'nc-transition', method: 'POST', path: '/nc/:code/transition', access: 'consultant', description: 'epNcTransition' },
  { id: 'mission-summary', method: 'GET', path: '/mission/summary', access: 'any', description: 'epMissionSummary' },
  { id: 'mission-tick', method: 'POST', path: '/mission/tick', access: 'admin', description: 'epMissionTick' },
  { id: 'search', method: 'GET', path: '/search?q=', access: 'any', description: 'epSearch' },
  { id: 'audit', method: 'GET', path: '/audit', access: 'audit', description: 'epAudit' },
  { id: 'admin-reset', method: 'POST', path: '/admin/reset', access: 'admin', description: 'epAdminReset' },
  { id: 'admin-chaos', method: 'PATCH', path: '/admin/chaos', access: 'admin', description: 'epAdminChaos' },
];

/** Clave de i18n del texto de cada nivel de acceso (mapa de despacho, sin `switch`). */
export const ACCESS_LABEL: Readonly<Record<LabAccess, MessageKey<'lab'>>> = {
  public: 'accessPublic',
  any: 'accessAny',
  manager: 'accessManager',
  consultant: 'accessConsultant',
  audit: 'accessAudit',
  admin: 'accessAdmin',
};

/** Qué usuarios demo pueden llamar al endpoint (el rol «admin» siempre puede). */
export const ACCESS_ROLES: Readonly<Record<LabAccess, readonly string[] | 'all'>> = {
  public: 'all',
  any: 'all',
  manager: ['admin', 'program_manager'],
  consultant: ['admin', 'consultant'],
  audit: ['admin', 'auditor'],
  admin: ['admin'],
};

/** Base de la API (`/api` en local; absoluta en Render) → enlaces a Swagger UI y al JSON de OpenAPI. */
export const docsLinks = (apiBase: string): { readonly swagger: string; readonly json: string } => {
  const base = apiBase.replace(/\/+$/, '');
  return { swagger: `${base}/docs`, json: `${base}/docs-json` };
};
