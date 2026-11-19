import type { Locator, Page } from '@playwright/test';
import { defineBrowserRows, type BrowserRowHandler } from '../../core/framework';
import { ACTION, quoted, safe } from '../../support/browser';
import { cell, check, strict, type Check } from '../../support/checks';
import { field } from '../../../story-runs/support/api';
import { ACCOUNT_OF, TENANT_A, act, loginAs, resetTenants, verdict } from '../api/common';
import { REQUISITOS_DYNAMIC_TESTIDS, REQUISITOS_TESTIDS } from '../../../../packages/shared/src/testids';
import { interact, noOkToast, toastShown, type WebAction } from '../web/common';
import { ACCOUNT_CREDENTIALS, mobileStateCheck, newButton, newDialog, onExpoWeb, outcomeOf, prepareMobile, textVisible, waitText } from './common';

// US-REQ-EDICION-012 — Dar de alta un requisito desde la lista (app móvil, Expo web 390 px). Preparación de cada fila: reinicio de
// alumno01, la app en /login con alumno01 en «Tenant de trabajo», inicio de sesión de la cuenta y llegada a /programs/PRG-001/requirements.

const TITLE = (page: Page): Locator => newDialog(page).getByRole('textbox', { name: 'Título', exact: true });
const DESCRIPTION = (page: Page): Locator => newDialog(page).getByRole('textbox', { name: 'Descripción', exact: true });

/** Abre el diálogo «Nuevo requisito» desde la lista. */
const openNew: WebAction = (page) => interact(newButton(page), 'pulsar «Nuevo requisito»', (element) => element.click(ACTION));
/** Escribe el título. */
const typeTitle = (text: string): WebAction => (page) => interact(TITLE(page), `escribir «${text}» en «Título»`, (element) => element.fill(text, ACTION));
/** Abre un selector del diálogo y elige la opción por su texto visible. */
const choose = (label: string, option: string): WebAction => async (page) => {
  const opened = await interact(newDialog(page).getByRole('combobox', { name: label, exact: true }), `abrir «${label}»`, (element) => element.click(ACTION));
  if (opened !== undefined) return opened;
  return interact(page.getByRole('radio', { name: option, exact: true }), `elegir «${option}» en «${label}»`, (element) => element.click(ACTION));
};
/** Marca una etiqueta del catálogo (su control lleva el id de la etiqueta). */
const tag = (value: string): WebAction => (page) => interact(newDialog(page).getByTestId(REQUISITOS_DYNAMIC_TESTIDS.REQUIREMENT_TAG_OPTION(value)), `marcar la etiqueta ${value}`, (element) => element.click(ACTION));
/** Escribe la descripción. */
const typeDescription = (text: string): WebAction => (page) => interact(DESCRIPTION(page), `escribir «${text}» en «Descripción»`, (element) => element.fill(text, ACTION));
/** Pulsa «Crear requisito». */
const submit: WebAction = (page) => interact(newDialog(page).getByRole('button', { name: 'Crear requisito', exact: true }), 'pulsar «Crear requisito»', (element) => element.click(ACTION));

/** Padre de la celda: la opción visible («Ninguno (raíz)» o un requisito) y el `parentCode` que debe quedar. */
const PARENT_OF: ReadonlyMap<string, { readonly option: string; readonly parentCode: string | null }> = new Map([
  ['«Ninguno (raíz)»', { option: 'Ninguno (raíz)', parentCode: null }],
  ['«REQ-001 · Disponibilidad del subsistema 001»', { option: 'REQ-001 · Disponibilidad del subsistema 001', parentCode: 'REQ-001' }],
]);

/** Prioridad de la celda: la opción visible y el valor que la API guarda. */
const PRIORITY_OF: ReadonlyMap<string, { readonly option: string; readonly value: string }> = new Map([
  ['«Alta»', { option: 'Alta', value: 'high' }],
  ['«Baja»', { option: 'Baja', value: 'low' }],
]);

/** Etiqueta del catálogo de la celda y su valor en la API. */
const TAG_OF: ReadonlyMap<string, string> = new Map([['«Ciberseguridad»', 'security']]);

/** Título de la celda (vacío, texto corto o largo). */
const TITLE_OF: ReadonlyMap<string, string> = new Map([
  ['(vacío)', ''],
  ['ab', 'ab'],
  ['(121 letras a)', 'a'.repeat(121)],
]);

/** Cuenta de la fila de «Nuevo requisito» (solo las dos que aparecen en la historia). */
const OPEN_ACCOUNT_OF: ReadonlyMap<string, typeof ACCOUNT_CREDENTIALS.gestor> = new Map([
  ['gestor@sigpro.test', ACCOUNT_CREDENTIALS.gestor],
  ['auditor@sigpro.test', ACCOUNT_CREDENTIALS.auditor],
]);

/** Estado del botón «Nuevo requisito» de la celda: habilitado, o deshabilitado con su motivo visible. */
const OPEN_STATE_OF: ReadonlyMap<string, { readonly enabled: boolean; readonly reason?: string }> = new Map([
  ['está habilitado', { enabled: true }],
  ['está deshabilitado y debajo se lee «Tu rol no permite crear requisitos»', { enabled: false, reason: 'Tu rol no permite crear requisitos' }],
]);

/** Lectura de REQ-041 por la API con la cuenta gestor (persistencia). */
const storedRequirement = async () => {
  const session = await loginAs(strict('cuenta', ACCOUNT_OF, 'gestor@sigpro.test'));
  return session.token === undefined ? undefined : act('GET', '/requirements/REQ-041', session.token);
};

/** Ejecuta los pasos en orden; el primero que falla devuelve su diagnóstico como resultado de la fila. */
const runAll = async (page: Page, steps: readonly WebAction[], expected: string) => {
  for (const step of steps) {
    const blocked = await step(page);
    if (blocked !== undefined) return outcomeOf([check(false, expected, blocked.message)], blocked.note);
  }
  return undefined;
};

// --- Esquema 1: un alta válida nace en borrador con el padre y la prioridad elegidos ------------------------------------------

const createsValid: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const expected = `aviso «Requisito creado» con «REQ-041 se añadió al árbol»; el detalle de REQ-041 muestra «Borrador»; padre ${cell(row, 'padre')}; prioridad ${cell(row, 'prioridad')}`;
  const failure = await prepareMobile(page, ACCOUNT_CREDENTIALS.gestor, expected);
  if (failure !== undefined) return failure;
  const parent = strict('padre', PARENT_OF, cell(row, 'padre'));
  const priority = strict('prioridad', PRIORITY_OF, cell(row, 'prioridad'));
  const blocked = await runAll(page, [openNew, typeTitle('Requisito de prueba'), choose('Requisito padre', parent.option), choose('Prioridad', priority.option), submit], expected);
  if (blocked !== undefined) return blocked;
  const toast = await toastShown(page, 'ok', 'Requisito creado', 'REQ-041 se añadió al árbol');
  const badge = await safe(() => page.getByTestId(REQUISITOS_TESTIDS.REQUIREMENT_STATE_BADGE).innerText({ timeout: 2_000 }), undefined);
  const stored = await storedRequirement();
  return verdict([
    check(toast.seen, '«Requisito creado» con «REQ-041 se añadió al árbol»', `aviso ${toast.observed}`),
    check(badge?.trim() === 'Borrador', 'el detalle de REQ-041 muestra «Borrador»', `el detalle muestra «${badge ?? '(sin leer)'}»`),
    check(stored?.status === 200 && (field(stored.body, 'parentCode') ?? null) === parent.parentCode && field(stored.body, 'priority') === priority.value, `REQ-041 guardado con padre ${parent.parentCode ?? 'null'} y prioridad ${priority.value}`, `REQ-041 guardado con padre ${stored === undefined ? '(sin leer)' : String(field(stored.body, 'parentCode') ?? null)} y prioridad ${stored === undefined ? '(sin leer)' : String(field(stored.body, 'priority'))}`),
  ]);
};

// --- Esquema 2: la etiqueta y la descripción se guardan con el requisito nuevo -----------------------------------------------

const savesTagAndDescription: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const expected = `aviso «Requisito creado» con «REQ-041 se añadió al árbol»; el detalle de REQ-041 muestra la etiqueta ${cell(row, 'etiqueta')}`;
  const failure = await prepareMobile(page, ACCOUNT_CREDENTIALS.gestor, expected);
  if (failure !== undefined) return failure;
  const value = strict('etiqueta', TAG_OF, cell(row, 'etiqueta'));
  const description = cell(row, 'descripcion');
  const blocked = await runAll(page, [openNew, typeTitle('Requisito de prueba'), tag(value), typeDescription(description), submit], expected);
  if (blocked !== undefined) return blocked;
  const toast = await toastShown(page, 'ok', 'Requisito creado', 'REQ-041 se añadió al árbol');
  const shownTag = await textVisible(page, 'Ciberseguridad');
  const stored = await storedRequirement();
  const tags = field(stored?.body ?? null, 'tags');
  const bare = String(field(stored?.body ?? null, 'description') ?? '').replace(/^<p>([\s\S]*)<\/p>$/, '$1');
  return verdict([
    check(toast.seen, '«Requisito creado» con «REQ-041 se añadió al árbol»', `aviso ${toast.observed}`),
    check(shownTag, 'el detalle de REQ-041 muestra la etiqueta «Ciberseguridad»', shownTag ? 'el detalle muestra la etiqueta «Ciberseguridad»' : 'el detalle no muestra «Ciberseguridad»'),
    check(Array.isArray(tags) && tags.includes(value), `REQ-041 guardado con la etiqueta ${value}`, `REQ-041 guardado con etiquetas ${JSON.stringify(tags ?? null)}`),
    check(bare === description, `REQ-041 guardado con la descripción «${description}»`, `REQ-041 guardado con la descripción «${bare}»`),
  ]);
};

// --- Esquema 3: un título no válido muestra su aviso bajo el campo y no se envía ---------------------------------------------

const rejectsTitle: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const notice = quoted(cell(row, 'aviso'));
  const expected = `bajo «Título» el aviso «${notice}»; el diálogo sigue abierto; no aparece «Requisito creado»`;
  const failure = await prepareMobile(page, ACCOUNT_CREDENTIALS.gestor, expected);
  if (failure !== undefined) return failure;
  const title = strict('título', TITLE_OF, cell(row, 'titulo'));
  const blocked = await runAll(page, [openNew, typeTitle(title), submit], expected);
  if (blocked !== undefined) return blocked;
  const shown = await waitText(page, notice);
  const dialogOpen = await safe(() => newDialog(page).isVisible(), false);
  const quiet = await noOkToast(page, Date.now());
  return verdict([
    check(shown, `bajo «Título» el aviso «${notice}»`, shown ? `bajo «Título» el aviso «${notice}»` : `no aparece «${notice}»`),
    check(dialogOpen, 'el diálogo sigue abierto', dialogOpen ? 'el diálogo sigue abierto' : 'el diálogo se cerró'),
    check(quiet.held, 'no aparece «Requisito creado»', quiet.held ? 'no aparece «Requisito creado»' : `aparece ${quiet.seen}`),
  ]);
};

// --- Esquema 4: solo los roles con permiso de alta pueden abrir el diálogo ---------------------------------------------------

const onlyCreatorsOpen: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const credentials = strict('cuenta', OPEN_ACCOUNT_OF, cell(row, 'cuenta'));
  const want = strict('estado', OPEN_STATE_OF, cell(row, 'estado'));
  const expected = want.enabled ? '«Nuevo requisito» está habilitado' : `«Nuevo requisito» está deshabilitado y debajo se lee «${want.reason ?? ''}»`;
  const failure = await prepareMobile(page, credentials, expected);
  if (failure !== undefined) return failure;
  const state = await mobileStateCheck(newButton(page), want.enabled ? 'habilitado' : 'deshabilitado', want.reason);
  const checks: Check[] = [state];
  if (want.reason !== undefined) {
    const shown = await textVisible(page, want.reason);
    checks.push(check(shown, `debajo se lee «${want.reason}»`, shown ? `debajo se lee «${want.reason}»` : `no se lee «${want.reason}»`));
  }
  return verdict(checks);
};

defineBrowserRows({
  story: 'US-REQ-EDICION-012',
  surface: 'expo-web',
  tenants: [TENANT_A],
  handlers: new Map<number, BrowserRowHandler>([
    [1, onExpoWeb(createsValid)],
    [2, onExpoWeb(savesTagAndDescription)],
    [3, onExpoWeb(rejectsTitle)],
    [4, onExpoWeb(onlyCreatorsOpen)],
  ]),
});
