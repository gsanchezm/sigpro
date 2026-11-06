import type { Role } from '@sigpro/shared';

export type NavKey = 'mission' | 'programs' | 'requirements' | 'verification' | 'nc' | 'documents' | 'audit' | 'admin' | 'lab';

export interface NavItem {
  readonly key: NavKey;
  readonly href: string;
  readonly glyph: string;
  readonly badge?: number;
  readonly roles?: readonly Role[];
}

const NAV_ITEMS: readonly NavItem[] = [
  { key: 'mission', href: '/mission', glyph: 'M' },
  { key: 'programs', href: '/programs', glyph: 'P' },
  { key: 'requirements', href: '/programs/PRG-001/requirements', glyph: 'R' },
  { key: 'verification', href: '/verification', glyph: 'V' },
  { key: 'nc', href: '/nc', glyph: 'NC', badge: 3 },
  { key: 'documents', href: '/documents', glyph: 'D' },
  { key: 'audit', href: '/audit', glyph: 'A', roles: ['admin', 'auditor'] },
  { key: 'admin', href: '/admin', glyph: '⚙', roles: ['admin'] },
  { key: 'lab', href: '/lab', glyph: 'L' },
];

/** Elementos del menú visibles para el rol (Auditoría: admin y auditor; Administración: admin). */
export const navFor = (role: Role): readonly NavItem[] => NAV_ITEMS.filter((item) => !item.roles || item.roles.includes(role));

export const MOBILE_TABS: readonly NavItem[] = [
  { key: 'programs', href: '/programs', glyph: 'P' },
  { key: 'nc', href: '/nc', glyph: 'NC' },
  { key: 'mission', href: '/mission', glyph: 'M' },
  { key: 'lab', href: '/lab', glyph: '…' },
];

export const isNavCurrent = (pathname: string, item: NavItem): boolean => {
  const isRequirements = pathname.endsWith('/requirements');
  if (item.key === 'requirements') return isRequirements;
  if (item.key === 'programs') return !isRequirements && (pathname === '/programs' || pathname.startsWith('/programs/'));
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
};

export interface Crumb {
  readonly label: string;
  readonly to?: string;
}

interface CrumbLabels {
  readonly home: string;
  readonly programs: string;
  readonly requirements: string;
  readonly other: (key: string) => string;
}

/** Migas de pan por ruta: Inicio / Programas / PRG-001 / Requisitos. */
export const breadcrumbsFor = (pathname: string, labels: CrumbLabels): readonly Crumb[] => {
  const [section, code, sub] = pathname.split('/').filter(Boolean);
  const home: Crumb = { label: labels.home, to: '/' };
  if (section !== 'programs') return [home, { label: labels.other(section ?? '') }];
  if (!code) return [home, { label: labels.programs }];
  if (sub === 'requirements') return [home, { label: labels.programs, to: '/programs' }, { label: code, to: `/programs/${code}` }, { label: labels.requirements }];
  return [home, { label: labels.programs, to: '/programs' }, { label: code }];
};
