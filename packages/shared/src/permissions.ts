import { ROLES, type Role } from './domain';

/** Matriz de permisos del plan + reglas de Programas del handoff. */
export const PERMISSIONS = {
  'program.create': ['admin', 'program_manager'],
  'program.edit': ['admin', 'program_manager'],
  'program.archive': ['admin', 'program_manager'],
  'program.delete': ['admin'],
  'program.export': ROLES,
  'requirement.approve': ['admin', 'program_manager'],
  'requirement.validate': ['admin', 'auditor'],
  'document.viewRestricted': ['admin', 'program_manager', 'auditor'],
  'audit.view': ['admin', 'auditor'],
  'users.manage': ['admin'],
} as const satisfies Readonly<Record<string, readonly Role[]>>;

export type Permission = keyof typeof PERMISSIONS;

export const can = (role: Role, permission: Permission): boolean => (PERMISSIONS[permission] as readonly Role[]).includes(role);

/** Clave i18n (espacio `programas`) con el motivo por el que un botón está deshabilitado. */
export type DeniedReasonKey = 'roleNoCreate' | 'roleNoEdit' | 'roleNoArchive' | 'roleNoDelete' | 'roleNoPermission';

const DENIED_REASON: ReadonlyMap<Permission, DeniedReasonKey> = new Map<Permission, DeniedReasonKey>([
  ['program.create', 'roleNoCreate'],
  ['program.edit', 'roleNoEdit'],
  ['program.archive', 'roleNoArchive'],
  ['program.delete', 'roleNoDelete'],
]);

export const permissionDeniedReason = (permission: Permission): DeniedReasonKey => DENIED_REASON.get(permission) ?? 'roleNoPermission';
