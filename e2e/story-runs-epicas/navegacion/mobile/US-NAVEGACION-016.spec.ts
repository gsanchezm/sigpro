import { ACCOUNTS } from '../api/common';
import { cell, strict } from '../../support/checks';
import { defineBrowserRows, notExecutable, type BrowserRowHandler } from '../../core/framework';

// US-NAVEGACION-016 — Entrada de Requisitos en la navegación de la app móvil. Historia `no-implementada`: la navegación principal
// de la app (pestañas y «Más») no tiene entrada de requisitos; solo se llega con «Ver requisitos» desde la ficha de un programa.
// Ninguna fila se ejecuta contra la app: cada una devuelve notExecutable con su motivo; sus celdas se leen con la tabla de cuentas.

const MOTIVE = 'capacidad futura, no se prueba contra la app: la navegación principal de la app móvil no tiene entrada «Requisitos» (decisión pendiente sobre su lugar, programa y roles).';

const notYet: BrowserRowHandler = async (row) => {
  const account = strict('cuenta', ACCOUNTS, cell(row, 'cuenta'));
  return notExecutable(cell(row, 'resultado'), `${MOTIVE} Cuenta de la fila: ${account.credentials.email}.`);
};

defineBrowserRows({
  story: 'US-NAVEGACION-016',
  surface: 'expo-web',
  tenants: ['alumno01'],
  handlers: new Map<number, BrowserRowHandler>([[1, notYet]]),
});
