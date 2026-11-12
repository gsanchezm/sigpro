// Textos de la pantalla de Requisitos que no existen en `@sigpro/shared`. El resto sale de `t('requisitos', …)`.
// Se usan con `useTexts(REQUIREMENTS_TEXTS)`: la tabla tiene que tener las mismas claves en `es` y en `en`.

const es = {
  openDetail: 'Abrir detalle de',
  noDescription: 'Sin descripción',
  actionsLabel: 'Acciones del requisito',
  editAction: 'Editar',
  editHeading: 'Editar requisito',
  moveAction: 'Mover a…',
  moveHeading: 'Mover requisito',
  moveHint: 'Reordena entre hermanos: el requisito conserva su padre.',
  moveTarget: 'Junto a',
  movePlacement: 'Colocar',
  placeBefore: 'Antes',
  placeAfter: 'Después',
  moveSubmit: 'Mover',
  onlyChild: 'Es el único de su nivel: no hay con quién cambiar su posición.',
  descriptionHint: 'Un párrafo por línea. El formato (negrita, listas) se pierde al editar el texto.',
  matrixScroll: 'Desliza a los lados para ver todos los casos de prueba.',
};

const en: typeof es = {
  openDetail: 'Open detail of',
  noDescription: 'No description',
  actionsLabel: 'Requirement actions',
  editAction: 'Edit',
  editHeading: 'Edit requirement',
  moveAction: 'Move to…',
  moveHeading: 'Move requirement',
  moveHint: 'Reorders among siblings: the requirement keeps its parent.',
  moveTarget: 'Next to',
  movePlacement: 'Place',
  placeBefore: 'Before',
  placeAfter: 'After',
  moveSubmit: 'Move',
  onlyChild: 'It is the only one at its level: there is no position to swap with.',
  descriptionHint: 'One paragraph per line. Formatting (bold, lists) is lost when the text is edited.',
  matrixScroll: 'Swipe sideways to see every test case.',
};

export const REQUIREMENTS_TEXTS = { es, en };
