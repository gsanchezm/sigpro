import { ADMIN_DYNAMIC_TESTIDS, ADMIN_TESTIDS, MOVIL_DYNAMIC_TESTIDS, MOVIL_TESTIDS } from '../../../../packages/shared/src/testids';
import { TENANT_A } from '../../../story-runs/support/prepare';
import { ACTION, CEILING_MS, isVisible, linesOf, runSteps, safe, textOf, waitUntil } from '../../support/browser';
import { check, cell, preparationFailedWeb, strict } from '../../support/checks';
import { defineBrowserRows, type BrowserRowHandler } from '../../core/framework';
import { credentialsOf, resetAlumno, toastLog } from '../web/common';
import { ADMIN_PATH, onMobile, openAdminFromMore, openMoreTab, pathAndQuery, selectedTab, signInMobile, tabOf, verdict, waitUsersReady } from './common';

// US-ADMIN-USUARIOS-009 — Entrar en Administración según el rol y elegir sus pestañas (app móvil, Expo web a 390 × 844; NO es nativo).
// Preparación de cada fila: reinicio de alumno01 con su administrador; la app se abre sin sesión, en /login, con alumno01 en «Tenant de
// trabajo»; la cuenta de la fila inicia sesión con su correo y su contraseña.

const PASSWORDS: ReadonlyMap<string, string> = new Map<string, string>([
  ['Alumno1234!', 'Alumno1234!'],
  ['Gestor1234!', 'Gestor1234!'],
  ['Audit1234!', 'Audit1234!'],
]);

const VISIBILITY: ReadonlyMap<string, boolean> = new Map<string, boolean>([
  ['ve', true],
  ['no ve', false],
]);

interface TabCell {
  readonly key: 'users' | 'audit';
  readonly address: string;
  readonly heading: string;
}

const TAB_CELLS: ReadonlyMap<string, TabCell> = new Map<string, TabCell>([
  ['«Auditoría»', { key: 'audit', address: '/admin?tab=audit', heading: 'Registro de auditoría' }],
  ['«Usuarios»', { key: 'users', address: '/admin', heading: 'Usuarios del tenant' }],
]);

const UNKNOWN_SECTIONS: ReadonlyMap<string, string> = new Map<string, string>([
  ['otra', '/admin?tab=otra'],
  ['AUDIT', '/admin?tab=AUDIT'],
]);

const NON_ADMIN: ReadonlyMap<string, string> = new Map<string, string>([
  ['gestor@sigpro.test', 'gestor@sigpro.test'],
  ['auditor@sigpro.test', 'auditor@sigpro.test'],
]);

// --- Esquema 1: solo el admin ve la entrada Administración en Más -------------------------------------------------------------

const moreShowsAdmin: BrowserRowHandler = async (row, { page }) => {
  const email = cell(row, 'correo');
  const password = strict('contraseña', PASSWORDS, cell(row, 'contraseña'));
  const visible = strict('visibilidad', VISIBILITY, cell(row, 'visibilidad'));
  const expected = `${cell(row, 'visibilidad')} la entrada «Administración» en «Más»`;
  await resetAlumno();
  const signed = await signInMobile(page, email, password);
  if (signed !== undefined) return preparationFailedWeb(expected, `iniciar sesión como ${email}: ${signed}`);
  const opened = await openMoreTab(page);
  if (opened !== undefined) return preparationFailedWeb(expected, opened);
  const moreReady = await waitUntil(() => isVisible(page.getByTestId(MOVIL_TESTIDS.MORE_PAGE)));
  const documents = await waitUntil(() => isVisible(page.getByTestId(MOVIL_DYNAMIC_TESTIDS.MORE_ITEM('documents'))));
  const admin = page.getByTestId(MOVIL_DYNAMIC_TESTIDS.MORE_ITEM('admin'));
  // Lectura sin conversión: si no se puede leer el elemento, el resultado es «no leído», nunca «no visible»
  const count = await safe<number | undefined>(() => admin.count(), undefined);
  const shown = count === undefined ? undefined : count > 0;
  return verdict([
    check(moreReady.reached && documents.reached, '«Más» está montado con sus entradas', `pantalla «Más» visible=${String(moreReady.reached)}; entrada «Documentos» visible=${String(documents.reached)}`),
    check(shown !== undefined && shown === visible, `${visible ? 've' : 'no ve'} la entrada «Administración»`, shown === undefined ? 'no se pudo leer la entrada «Administración»' : `entradas «Administración» en «Más»: ${String(count)}`),
  ]);
};

// --- Esquema 2: elegir una pestaña muestra su sección y la ruta la recoge -----------------------------------------------------

const chooseTab: BrowserRowHandler = async (row, { page }) => {
  const target = strict('pestana', TAB_CELLS, cell(row, 'pestana'));
  const expected = `la pestaña ${cell(row, 'pestana')} seleccionada, la ruta ${target.address} y la pantalla muestra esa sección`;
  await resetAlumno();
  const signed = await signInMobile(page, 'alumno01@sigpro.lab', credentialsOf('alumno01@sigpro.lab').password);
  if (signed !== undefined) return preparationFailedWeb(expected, `iniciar sesión como alumno01@sigpro.lab: ${signed}`);
  const entered = await openAdminFromMore(page);
  if (entered !== undefined) return preparationFailedWeb(expected, entered);
  const ready = await waitUsersReady(page);
  if (!ready) return preparationFailedWeb(expected, 'la pestaña «Usuarios» no asienta su lista');
  // «Usuarios» no puede ser trivial: parte de «Auditoría» (ruta ?tab=audit) y vuelve a «Usuarios» (ruta sin parámetro)
  if (target.key === 'users') {
    const away = await runSteps([['elegir «Auditoría»', () => tabOf(page, 'audit').click(ACTION)]]);
    const awayReached = await waitUntil(async () => pathAndQuery(page) === '/admin?tab=audit');
    if (away !== undefined || !awayReached.reached) return preparationFailedWeb(expected, away ?? `la ruta no pasa a /admin?tab=audit (${pathAndQuery(page)})`);
  }
  const clicked = await runSteps([[`elegir «${cell(row, 'pestana')}»`, () => tabOf(page, target.key).click(ACTION)]]);
  const selected = await waitUntil(async () => (await selectedTab(page, target.key)) === 'true');
  const address = await waitUntil(async () => pathAndQuery(page) === target.address);
  const panel = page.getByTestId(ADMIN_DYNAMIC_TESTIDS.ADMIN_PANEL(target.key));
  const panelShown = await waitUntil(() => isVisible(panel));
  // El encabezado de la sección no lo fija la historia: se anota como evidencia, no se compara
  const heading = await textOf(panel.getByRole('heading').first());
  return verdict(
    [
      check(clicked === undefined && selected.reached, `la pestaña ${cell(row, 'pestana')} seleccionada`, clicked ?? `la pestaña ${cell(row, 'pestana')} está ${String(await selectedTab(page, target.key))}`),
      check(address.reached, `la ruta es ${target.address}`, `la ruta es ${pathAndQuery(page)}`),
      check(panelShown.reached, 'la pantalla muestra esa sección', `la sección ${target.key} visible=${String(panelShown.reached)}`),
    ],
    undefined,
    { encabezadoDeLaSeccion: heading ?? '(sin texto)', rutaMedida: pathAndQuery(page) },
  );
};

// --- Esquema 3: una pestaña que no existe en la ruta muestra Usuarios ---------------------------------------------------------

const unknownSection: BrowserRowHandler = async (row, { page }) => {
  const address = strict('seccion', UNKNOWN_SECTIONS, cell(row, 'seccion'));
  const expected = `${address} muestra la pestaña «Usuarios» seleccionada y la sección «Usuarios del tenant»`;
  await resetAlumno();
  const signed = await signInMobile(page, 'alumno01@sigpro.lab', credentialsOf('alumno01@sigpro.lab').password);
  if (signed !== undefined) return preparationFailedWeb(expected, `iniciar sesión como alumno01@sigpro.lab: ${signed}`);
  const opened = await runSteps([[`abrir ${address}`, () => page.goto(address, { timeout: CEILING_MS })]]);
  if (opened !== undefined) return preparationFailedWeb(expected, opened);
  const ready = await waitUsersReady(page);
  if (!ready) return preparationFailedWeb(expected, 'la pestaña «Usuarios» no asienta su lista');
  const users = await waitUntil(async () => (await selectedTab(page, 'users')) === 'true');
  const heading = await waitUntil(() => isVisible(page.getByRole('heading', { name: 'Usuarios del tenant', exact: true })));
  return verdict([
    check(users.reached, 'la pestaña «Usuarios» seleccionada', `la pestaña «Usuarios» está ${String(await selectedTab(page, 'users'))}`),
    check(heading.reached, 'la pantalla muestra la sección «Usuarios del tenant»', `encabezado «Usuarios del tenant» visible=${String(heading.reached)}`),
  ]);
};

// --- Esquema 4: quien no es admin abre la ruta /admin y ve el aviso sin ninguna sección ---------------------------------------

const forbiddenFor: BrowserRowHandler = async (row, { page }) => {
  const email = strict('correo', NON_ADMIN, cell(row, 'correo'));
  const password = strict('contraseña', PASSWORDS, cell(row, 'contraseña'));
  const expected = '«Tu rol no permite administrar el tenant» con «Solo admin puede entrar en Administración.», sin pestañas, y «Volver a Programas» lleva a /programs';
  await resetAlumno();
  const signed = await signInMobile(page, email, password);
  if (signed !== undefined) return preparationFailedWeb(expected, `iniciar sesión como ${email}: ${signed}`);
  const opened = await runSteps([['abrir /admin', () => page.goto(ADMIN_PATH, { timeout: CEILING_MS })]]);
  if (opened !== undefined) return preparationFailedWeb(expected, opened);
  const notice = page.getByTestId(ADMIN_TESTIDS.ADMIN_FORBIDDEN);
  const shown = await waitUntil(() => isVisible(notice));
  if (!shown.reached) return preparationFailedWeb(expected, 'el aviso de rol no aparece en /admin');
  const lines = linesOf(await textOf(notice));
  const tabs = await safe<number | undefined>(() => page.getByTestId(ADMIN_TESTIDS.ADMIN_TABS).count(), undefined);
  const panels = await safe<number | undefined>(() => page.locator('[data-testid^="admin-panel-"]').count(), undefined);
  const back = page.getByTestId(ADMIN_TESTIDS.ADMIN_FORBIDDEN_BACK);
  const backText = await textOf(back);
  const clicked = await runSteps([['pulsar «Volver a Programas»', () => back.click(ACTION)]]);
  const arrived = await waitUntil(async () => pathAndQuery(page) === '/programs');
  const toasts = await toastLog(page);
  return verdict(
    [
      check(lines.includes('Tu rol no permite administrar el tenant'), 'el aviso dice «Tu rol no permite administrar el tenant»', `el aviso dice ${JSON.stringify(lines.slice(0, 2))}`),
      check(lines.includes('Solo admin puede entrar en Administración.'), 'la explicación «Solo admin puede entrar en Administración.»', `líneas del aviso: ${JSON.stringify(lines.slice(0, 3))}`),
      check(tabs === 0 && panels === 0, 'no ve pestañas ni ninguna sección de Administración', `pestañas ${String(tabs)}, paneles ${String(panels)}`),
      check(clicked === undefined && backText === 'Volver a Programas' && arrived.reached, 'el enlace «Volver a Programas» lleva a /programs', `el enlace dice «${backText ?? '(sin texto)'}» y la ruta es ${pathAndQuery(page)}`),
    ],
    `Registro de avisos leído: ${toasts === undefined ? 'no legible' : `${toasts.length} avisos`}.`,
  );
};

defineBrowserRows({
  story: 'US-ADMIN-USUARIOS-009',
  surface: 'expo-web',
  tenants: [TENANT_A],
  handlers: new Map<number, BrowserRowHandler>([
    [1, onMobile(moreShowsAdmin)],
    [2, onMobile(chooseTab)],
    [3, onMobile(unknownSection)],
    [4, onMobile(forbiddenFor)],
  ]),
});
