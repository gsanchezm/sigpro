// Lógica pura del Perfil móvil (web: `ProfilePage.tsx`): la lista de permisos del rol y el borrador de preferencias (idioma, tema,
// avisos en tiempo real y resumen semanal) con su «Guardar». Sin imports de react-native: se prueba con Vitest en Node (`view.test.ts`).
import { can, type Lang, type MessageKey, type Permission, type Role } from '@sigpro/shared';
import type { Scheme } from '../../theme/tokens';

/** Los seis permisos que enseña la web, en su orden, con la clave del texto de cada uno. */
const PERMISSION_ROWS: readonly (readonly [Permission, MessageKey<'perfil'>])[] = [
  ['nc.create', 'perm_nc_create'],
  ['nc.transition', 'perm_nc_transition'],
  ['nc.close', 'perm_nc_close'],
  ['milestone.edit', 'perm_milestone_edit'],
  ['users.manage', 'perm_users_manage'],
  ['audit.view', 'perm_audit_view'],
];

export interface PermissionRow {
  readonly permission: Permission;
  readonly labelKey: MessageKey<'perfil'>;
  readonly allowed: boolean;
}

/** «Qué puedes hacer con tu rol»: cada permiso con si el rol lo tiene (la misma función `can` que usan las pantallas). */
export const permissionRows = (role: Role): readonly PermissionRow[] => PERMISSION_ROWS.map(([permission, labelKey]) => ({ permission, labelKey, allowed: can(role, permission) }));

/** Preferencias editables del Perfil. Idioma y tema los aplica la app; avisos y resumen se guardan en el almacenamiento. */
export interface Preferences {
  readonly lang: Lang;
  readonly theme: Scheme;
  readonly live: boolean;
  readonly digest: boolean;
}

/** Lo que el usuario ha tocado y aún no se ha guardado: solo los campos cuyo valor difiere del aplicado. */
export type Draft = Partial<Preferences>;

export const EMPTY_DRAFT: Draft = {};

/**
 * Cambia un campo del borrador. Si el nuevo valor es el que ya está aplicado el campo sale del borrador: volver al valor
 * guardado deja «Guardar» desactivado (como la web). Guardar solo diferencias evita, además, que un valor aplicado más tarde
 * (el idioma se lee del almacenamiento al arrancar) quede como cambio pendiente.
 */
export const setDraftField = <K extends keyof Preferences>(draft: Draft, applied: Preferences, key: K, value: Preferences[K]): Draft => {
  const { [key]: _removed, ...rest } = draft;
  return value === applied[key] ? rest : { ...rest, [key]: value };
};

/** Preferencias tal como quedarían al guardar: lo aplicado más el borrador. */
export const resolveDraft = (applied: Preferences, draft: Draft): Preferences => ({ ...applied, ...draft });

export const isDirty = (draft: Draft): boolean => Object.keys(draft).length > 0;

// Los avisos en tiempo real están activos salvo que se guarde `off`; el resumen semanal, inactivo salvo que se guarde `on`
// (los mismos valores que escribe la web en `sigpro.live` y `sigpro.digest`).
export const parseLive = (raw: string | null): boolean => raw !== 'off';
export const parseDigest = (raw: string | null): boolean => raw === 'on';
export const flagValue = (on: boolean): 'on' | 'off' => (on ? 'on' : 'off');
