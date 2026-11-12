// Textos de Programas en móvil que no existen en `@sigpro/shared` (el resto sale de `t('programas' | 'hitos' | …)`).
// Se usan con `useTexts(PROGRAMS_TEXTS)`: siempre `es` y `en` a la vez.

const es = {
  allStatuses: 'Todos',
  loadMore: 'Cargar más',
  notFound: 'Programa no encontrado',
  detailError: 'No se pudo cargar el programa',
  openRequirements: 'Ver requisitos',
  select: 'Seleccionar',
  selectOne: 'Seleccionar',
  selectAll: 'Seleccionar todos',
  ownersLoading: 'Cargando personas…',
  ownerEmpty: 'Elige un responsable',
  ownerSearch: 'Buscar responsable',
  dateFormat: 'AAAA-MM-DD',
  milestonesHint: 'Toca un hito para renombrarlo o cambiar su fecha, mueve su avance con − y + y elimínalo desde su menú ⋯.',
  milestoneEditTitle: 'Editar hito',
  milestoneSave: 'Guardar hito',
  suppliersHint: 'Proveedores contratados en este programa y búsqueda de cualquier proveedor del tenant.',
};

const en: typeof es = {
  allStatuses: 'All',
  loadMore: 'Load more',
  notFound: 'Program not found',
  detailError: 'The program could not be loaded',
  openRequirements: 'View requirements',
  select: 'Select',
  selectOne: 'Select',
  selectAll: 'Select all',
  ownersLoading: 'Loading people…',
  ownerEmpty: 'Choose an owner',
  ownerSearch: 'Search owner',
  dateFormat: 'YYYY-MM-DD',
  milestonesHint: 'Tap a milestone to rename it or change its date, move its progress with − and +, and delete it from its ⋯ menu.',
  milestoneEditTitle: 'Edit milestone',
  milestoneSave: 'Save milestone',
  suppliersHint: 'Suppliers contracted in this program and search across every supplier of the tenant.',
};

export const PROGRAMS_TEXTS = { es, en };
