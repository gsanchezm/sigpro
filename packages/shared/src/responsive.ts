import { LAYOUT_BREAKPOINT_PX, RESPONSIVE_DYNAMIC_TESTIDS, RESPONSIVE_TESTIDS } from './testids';

/** Los dos diseños de la app: un solo corte en `LAYOUT_BREAKPOINT_PX` (móvil y tablet comparten el responsive). */
export const LAYOUTS = ['desktop', 'mobile'] as const;
export type Layout = (typeof LAYOUTS)[number];

/** Consulta `matchMedia` de escritorio: la única fuente del corte (el CSS de la app no tiene otro). */
export const DESKTOP_MEDIA_QUERY = `(min-width: ${LAYOUT_BREAKPOINT_PX}px)`;

/** Diseño para un ancho de ventana en px (el mismo criterio que `DESKTOP_MEDIA_QUERY`). */
export const layoutForWidth = (width: number): Layout => (width >= LAYOUT_BREAKPOINT_PX ? 'desktop' : 'mobile');

export type ResponsiveFamilyKey =
  | 'nav'
  | 'search'
  | 'userMenu'
  | 'programsList'
  | 'programsCreate'
  | 'programsFilters'
  | 'rowActions'
  | 'detailTabs'
  | 'requirementDetail'
  | 'ncBoard';

export interface ResponsiveFamily {
  readonly key: ResponsiveFamilyKey;
  /** Ruta donde se ve la familia (la de las pruebas y la de la tabla de `/lab`). */
  readonly route: string;
  readonly desktop: { readonly testId: string; readonly role: string };
  readonly responsive: { readonly testId: string; readonly role: string };
  /** Nombre accesible común a las dos variantes (salvo que `nameDiffers` lo explique). */
  readonly name: { readonly es: string; readonly en: string };
  readonly nameDiffers?: { readonly es: string; readonly en: string };
}

/**
 * Las 10 familias con su id «ancla»: el elemento que sustituye la variante responsive al de escritorio. Es la tabla del
 * `/lab`, de la guía del alumno y de los specs. Los ids de escritorio salen de `testids.ts` y nunca cambian.
 */
export const RESPONSIVE_FAMILIES: readonly ResponsiveFamily[] = [
  {
    key: 'nav',
    route: '/programs',
    desktop: { testId: 'layout-sidebar', role: 'complementary' },
    responsive: { testId: RESPONSIVE_TESTIDS.LAYOUT_SIDEBAR, role: 'complementary' },
    name: { es: 'Navegación principal', en: 'Main navigation' },
  },
  {
    key: 'search',
    route: '/requirements',
    desktop: { testId: 'layout-search', role: 'combobox' },
    responsive: { testId: RESPONSIVE_TESTIDS.LAYOUT_SEARCH, role: 'combobox' },
    name: { es: 'Búsqueda global', en: 'Global search' },
  },
  {
    key: 'userMenu',
    route: '/programs',
    desktop: { testId: 'layout-user-menu', role: 'button' },
    responsive: { testId: RESPONSIVE_TESTIDS.LAYOUT_USER_MENU, role: 'group' },
    name: { es: 'Menú de usuario', en: 'User menu' },
  },
  {
    key: 'programsList',
    route: '/programs',
    desktop: { testId: 'programs-row-PRG-001', role: 'row' },
    responsive: { testId: RESPONSIVE_DYNAMIC_TESTIDS.PROGRAMS_ROW('PRG-001'), role: 'listitem' },
    name: { es: 'El enlace «PRG-001» (el código del programa)', en: 'The «PRG-001» link (the program code)' },
  },
  {
    key: 'programsCreate',
    route: '/programs',
    desktop: { testId: 'programs-new', role: 'button' },
    responsive: { testId: RESPONSIVE_TESTIDS.PROGRAMS_NEW, role: 'button' },
    name: { es: '+ Nuevo programa', en: '+ New program' },
  },
  {
    key: 'programsFilters',
    route: '/programs',
    desktop: { testId: 'programs-filters', role: 'search' },
    responsive: { testId: RESPONSIVE_TESTIDS.PROGRAMS_FILTERS, role: 'button' },
    name: { es: 'Filtros', en: 'Filters' },
  },
  {
    key: 'rowActions',
    route: '/programs',
    desktop: { testId: 'programs-row-menu', role: 'menu' },
    responsive: { testId: RESPONSIVE_TESTIDS.PROGRAMS_ROW_MENU, role: 'dialog' },
    name: { es: 'Acciones para PRG-001', en: 'Actions for PRG-001' },
  },
  {
    key: 'detailTabs',
    route: '/programs/PRG-001',
    desktop: { testId: 'program-detail-tabs', role: 'tablist' },
    responsive: { testId: RESPONSIVE_TESTIDS.PROGRAM_DETAIL_TABS, role: 'combobox' },
    name: { es: 'Detalle del programa', en: 'Program detail' },
  },
  {
    key: 'requirementDetail',
    route: '/programs/PRG-001/requirements',
    desktop: { testId: 'requirement-detail', role: 'complementary' },
    responsive: { testId: RESPONSIVE_TESTIDS.REQUIREMENT_DETAIL, role: 'dialog' },
    name: { es: 'Detalle del requisito', en: 'Requirement detail' },
    nameDiffers: { es: 'El botón de cierre se llama «Cerrar» en escritorio y «Volver» en responsive', en: 'The close button is «Close» on desktop and «Back» on responsive' },
  },
  {
    key: 'ncBoard',
    route: '/nc',
    desktop: { testId: 'nc-board', role: 'group' },
    responsive: { testId: RESPONSIVE_TESTIDS.NC_BOARD, role: 'group' },
    name: { es: 'Tablero de no conformidades', en: 'Nonconformity board' },
  },
];
