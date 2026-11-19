import type { Page } from '@playwright/test';
import { defineBrowserRows, type BrowserRowHandler } from '../../core/framework';
import { cell, check, conclude, preparationFailedWeb, strict, type Check } from '../../support/checks';
import { isVisible, quoted, waitUntil } from '../../support/browser';
import { TENANT_A, resetTenants } from '../../../story-runs/support/prepare';
import { accountOf, actionFailed, noOkToast, recountText, settle, toastShown } from '../web/common';
import {
  actionSheet,
  cardCodes,
  cardTokens,
  confirmAction,
  confirmDialog,
  onExpoWeb,
  openCardMenu,
  parseVisible,
  pressSheetAction,
  reasonOf,
  signIn,
  stateOfCard,
  visibleStateCheck,
} from './common';

// US-PROG-GESTION-011 — Archivar, duplicar y eliminar desde el menú de la tarjeta (app móvil, Expo web, 390 × 844; NO es nativo).
// Preparación de cada fila: reinicio de alumno01 con el token de su administrador; la app en /login con alumno01 en «Tenant de
// trabajo», la cuenta de la fila y llegada a /programs. Los avisos, efectos y resultados se leen de las celdas (mapas estrictos).

/** Columna de la historia → nombre de la acción en la hoja y clave de su motivo visible. */
const ITEMS: ReadonlyMap<string, { readonly name: string; readonly key: string }> = new Map<string, { readonly name: string; readonly key: string }>([
  ['editar', { name: 'Editar', key: 'edit' }],
  ['duplicar', { name: 'Duplicar', key: 'duplicate' }],
  ['archivar', { name: 'Archivar', key: 'archive' }],
  ['eliminar', { name: 'Eliminar', key: 'delete' }],
]);

// --- Esquema 1: cada rol ve habilitadas solo las acciones de la tarjeta que su permiso permite --------------------------------

const cardRoles: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const expected = 'Editar, Duplicar, Archivar y Eliminar en la hoja de PRG-001 con el estado que da su rol';
  const prepared = await signIn(page, accountOf(cell(row, 'cuenta')));
  if (prepared !== undefined) return preparationFailedWeb(expected, prepared);
  const opened = await openCardMenu('PRG-001')(page);
  if (opened !== undefined) return actionFailed(expected, opened);
  const results: Check[] = [];
  for (const column of ['editar', 'duplicar', 'archivar', 'eliminar']) {
    const item = strict('acción', ITEMS, column);
    const target = actionSheet(page, 'PRG-001').getByRole('button', { name: item.name, exact: true });
    results.push(await visibleStateCheck(target, reasonOf(page, item.key), parseVisible(cell(row, column)), `«${item.name}»`));
  }
  return conclude(results);
};

// --- Esquema 2: archivar y duplicar desde la tarjeta actúan sin confirmación y avisan del resultado ----------------------------

/** Aviso de éxito de cada celda «aviso»: título y, si lo hay, cuerpo. */
const AVISOS: ReadonlyMap<string, { readonly title: string; readonly body?: string }> = new Map<string, { readonly title: string; readonly body?: string }>([
  ['«PRG-001 archivado»', { title: 'PRG-001 archivado' }],
  ['«PRG-025 programa creado» con el texto «Copia creada como borrador»', { title: 'PRG-025 programa creado', body: 'Copia creada como borrador' }],
]);

/** Efecto en la lista de cada celda «efecto», comprobado sobre la tarjeta observada. */
const EFECTOS: ReadonlyMap<string, (page: Page) => Promise<Check>> = new Map<string, (page: Page) => Promise<Check>>([
  [
    'la tarjeta de PRG-001 muestra el estado «Cerrado»',
    async (page) => {
      const state = await stateOfCard(page, 'PRG-001');
      return check(state === 'Cerrado', 'la tarjeta de PRG-001 muestra «Cerrado»', `la tarjeta de PRG-001 muestra «${state ?? '(sin estado)'}»`);
    },
  ],
  [
    'la primera tarjeta es PRG-025, Sistema de mando táctico Ártemis (copia), con el estado «Borrador»',
    async (page) => {
      const first = (await cardCodes(page))[0];
      const tokens = await cardTokens(page, 'PRG-025');
      const state = await stateOfCard(page, 'PRG-025');
      const named = tokens.includes('Sistema de mando táctico Ártemis (copia)');
      return check(
        first === 'PRG-025' && named && state === 'Borrador',
        'la primera tarjeta es PRG-025, Sistema de mando táctico Ártemis (copia), con «Borrador»',
        `la primera tarjeta es ${first ?? '(ninguna)'}, nombre ${named ? 'coincide' : 'no coincide'}, estado «${state ?? '(sin estado)'}»`,
      );
    },
  ],
]);

const effectOfAction: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const accion = quoted(cell(row, 'accion'));
  const expected = `${cell(row, 'aviso')}; ${cell(row, 'efecto')}`;
  const prepared = await signIn(page, 'gestor');
  if (prepared !== undefined) return preparationFailedWeb(expected, prepared);
  const opened = await openCardMenu('PRG-001')(page);
  if (opened !== undefined) return actionFailed(expected, opened);
  const pressed = await pressSheetAction('PRG-001', accion)(page);
  if (pressed !== undefined) return actionFailed(expected, pressed);
  const aviso = strict('aviso', AVISOS, cell(row, 'aviso'));
  const toast = await toastShown(page, 'ok', aviso.title, aviso.body);
  const efecto = strict('efecto', EFECTOS, cell(row, 'efecto'));
  await waitUntil(async () => (await efecto(page)).ok);
  return conclude([check(toast.seen, `aviso de éxito ${cell(row, 'aviso')}`, `avisos de éxito: ${toast.observed}`), await efecto(page)]);
};

// --- Esquema 3: eliminar desde la tarjeta pide confirmación y solo al confirmar borra el programa ------------------------------

/** Resultado de cada celda «resultado», comprobado sobre el aviso, la lista y el recuento. */
const DELETE_RESULTS: ReadonlyMap<string, (page: Page) => Promise<readonly Check[]>> = new Map<string, (page: Page) => Promise<readonly Check[]>>([
  [
    'no aparece ningún aviso de éxito y PRG-001 sigue en la lista',
    async (page) => {
      const quiet = await noOkToast(page);
      const codes = await cardCodes(page);
      return [
        check(quiet.held, 'no aparece ningún aviso de éxito', quiet.held ? 'no aparece ningún aviso de éxito' : 'aparece un aviso de éxito'),
        check(codes.includes('PRG-001'), 'PRG-001 sigue en la lista', `la lista es ${codes.join(', ') || '(vacía)'}`),
      ];
    },
  ],
  [
    'aparece el aviso de éxito «PRG-001 eliminado» y PRG-001 ya no está en la lista',
    async (page) => {
      const toast = await toastShown(page, 'ok', 'PRG-001 eliminado');
      const codes = await cardCodes(page);
      return [
        check(toast.seen, 'aparece el aviso de éxito «PRG-001 eliminado»', `avisos de éxito: ${toast.observed}`),
        check(!codes.includes('PRG-001'), 'PRG-001 ya no está en la lista', `la lista es ${codes.join(', ') || '(vacía)'}`),
      ];
    },
  ],
]);

const deleteFromCard: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const salida = quoted(cell(row, 'salida'));
  const recuento = quoted(cell(row, 'recuento'));
  const expected = `${cell(row, 'resultado')}; recuento «${recuento}»`;
  const prepared = await signIn(page, 'admin');
  if (prepared !== undefined) return preparationFailedWeb(expected, prepared);
  const opened = await openCardMenu('PRG-001')(page);
  if (opened !== undefined) return actionFailed(expected, opened);
  const removing = await pressSheetAction('PRG-001', 'Eliminar')(page);
  if (removing !== undefined) return actionFailed(expected, removing);
  const dialog = await waitUntil(() => isVisible(confirmDialog(page)));
  if (!dialog.reached) return actionFailed(expected, { message: 'no se abrió la hoja «Eliminar programa»', note: 'Eliminar desde la tarjeta no abrió la hoja de confirmación.' });
  const answered = await confirmAction(salida)(page);
  if (answered !== undefined) return actionFailed(expected, answered);
  await waitUntil(async () => (await recountText(page)) === recuento);
  await settle();
  const verify = strict('resultado', DELETE_RESULTS, cell(row, 'resultado'));
  const checks = await verify(page);
  const count = await recountText(page);
  return conclude([...checks, check(count === recuento, `el recuento dice «${recuento}»`, `el recuento dice «${count ?? '(sin recuento)'}»`)]);
};

defineBrowserRows({
  story: 'US-PROG-GESTION-011',
  surface: 'expo-web',
  tenants: [TENANT_A],
  handlers: new Map<number, BrowserRowHandler>([
    [1, onExpoWeb(cardRoles)],
    [2, onExpoWeb(effectOfAction)],
    [3, onExpoWeb(deleteFromCard)],
  ]),
});
