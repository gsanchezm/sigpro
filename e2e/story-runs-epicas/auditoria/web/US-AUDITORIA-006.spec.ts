import { requestAccount, TENANT_A } from '../../../story-runs/support/prepare';
import { ACTION, HOLD_MS, holdsFor, pathOf, quoted, waitUntil } from '../../support/browser';
import { cell, check, preparationFailedWeb, strict, type Check } from '../../support/checks';
import { defineBrowserRows, type BrowserRowHandler } from '../../core/framework';
import { verdictOf } from '../verdict';
import {
  ADMIN_AUDIT_PATH,
  AUDIT_PATH,
  act,
  actionFailed,
  countNow,
  countOfLocator,
  countText,
  cursorRequestsIn,
  endOf,
  errorOf,
  failAuditRequests,
  failureEvidence,
  feedOf,
  firstRow,
  forbiddenOf,
  linesIn,
  loadMoreOf,
  moreErrorAfterRows,
  moreErrorOf,
  noExtraCursorRequest,
  onWeb,
  openPath,
  presenceOf,
  presenceText,
  resetAlumno,
  retryOf,
  rowsOf,
  scrollFeedToEnd,
  sidebarOf,
  signIn,
  subtitleOf,
  titleOf,
  traceEvidence,
  waitCount,
  waitSettled,
  watchAuditRequests,
  type Failure,
  type RowFields,
} from './common';

// US-AUDITORIA-006 — Ver el registro de auditoría en /audit (web, 1440 px): filas, contador, carga al final y avisos por rol.
// Preparación de cada fila: alumno01 reiniciado con el token de su administrador; el navegador entra en /login?tenant=alumno01 sin
// sesión y cada cuenta de la fila entra con su correo y su contraseña. Los textos fijos de aquí son los de la historia (la semilla:
// 130 eventos, primero AL-130 y su actor); lo que se observa se mide en la pantalla.

const FIRST_PAGE = countText(20, 130);
const SEED_FIRST: Partial<RowFields> = { action: 'Requisito creado', code: 'requirement.created', entity: 'Requisito', entityId: 'REQ-011', actor: 'Lucía Fernández', summary: 'title: Cifrado del subsistema 011' };

/** Compara los campos que la historia fija de la primera fila (los que la historia no nombra no se comparan). */
const seedFirstChecks = (first: RowFields | undefined): readonly Check[] =>
  Object.entries(SEED_FIRST).map(([key, expected]) => {
    const observed = first === undefined ? '(sin fila)' : String(first[key as keyof RowFields] ?? '(vacío)');
    return check(first !== undefined && observed === expected, `primera fila: ${key} ${String(expected)}`, `primera fila: ${key} ${observed}`);
  });

/** Columna «resultado»: lo que se ve (la lista para admin y auditor; el aviso para el resto). */
const RESULTADO: ReadonlyMap<string, 'lista' | 'aviso'> = new Map<string, 'lista' | 'aviso'>([
  ['el título «Auditoría», el subtítulo «Registro de actividad del tenant» y la lista de eventos', 'lista'],
  ['el aviso «Tu rol no permite ver la auditoría», con la explicación «Solo admin y auditor pueden consultar el registro.», y ningún evento', 'aviso'],
]);
/** Columna «menu»: si «Auditoría» aparece en el menú lateral. */
const MENU: ReadonlyMap<string, boolean> = new Map<string, boolean>([
  ['aparece «Auditoría»', true],
  ['no aparece «Auditoría»', false],
]);

/** Esquema 1: solo admin y auditor ven el registro; el resto ve el aviso de rol y el menú no ofrece «Auditoría». */
const roleGate: BrowserRowHandler = onWeb(async (row, { page }) => {
  const cuenta = cell(row, 'cuenta');
  const contrasena = cell(row, 'contraseña');
  const resultado = strict('resultado', RESULTADO, cell(row, 'resultado'));
  const menu = strict('menu', MENU, cell(row, 'menu'));
  const expected = `${cell(row, 'resultado')}; menú: ${cell(row, 'menu')}`;
  await resetAlumno();
  const entered = await signIn(page, cuenta, contrasena);
  if (entered !== undefined) return preparationFailedWeb(expected, `${cuenta} entra en /login?tenant=alumno01: ${entered}`);
  const opened = await openPath(page, AUDIT_PATH);
  if (opened !== undefined) return preparationFailedWeb(expected, opened);
  const checks: Check[] = [];
  if (resultado === 'lista') {
    await waitSettled(page);
    const title = await presenceOf(titleOf(page));
    const subtitle = await presenceOf(subtitleOf(page));
    const feed = await presenceOf(feedOf(page));
    const rows = await countOfLocator(rowsOf(page));
    checks.push(check(title === 'visible', 'título «Auditoría» (encabezado de nivel 1)', `título ${presenceText(title)}`));
    checks.push(check(subtitle === 'visible', 'subtítulo «Registro de actividad del tenant»', `subtítulo ${presenceText(subtitle)}`));
    checks.push(check(feed === 'visible' && (rows ?? 0) > 0, 'la lista de eventos muestra filas', `lista ${presenceText(feed)} con ${rows ?? '(sin leer)'} filas`));
  } else {
    // Espera el aviso (la pantalla ya asentada) antes de leer: sin esto, un «no hay lista» podría ser una carga a medias
    await waitUntil(async () => (await presenceOf(forbiddenOf(page))) === 'visible');
    const notice = await presenceOf(forbiddenOf(page));
    const lines = await linesIn(forbiddenOf(page));
    const feed = await presenceOf(feedOf(page));
    const rows = await countOfLocator(rowsOf(page));
    checks.push(check(notice === 'visible' && lines.includes('Tu rol no permite ver la auditoría'), 'aviso «Tu rol no permite ver la auditoría»', notice === 'visible' ? `aviso con «${lines[0] ?? '(vacío)'}»` : `aviso ${presenceText(notice)}`));
    checks.push(check(lines.includes('Solo admin y auditor pueden consultar el registro.'), 'explicación «Solo admin y auditor pueden consultar el registro.»', `explicación ${lines.includes('Solo admin y auditor pueden consultar el registro.') ? 'presente' : 'ausente'}`));
    // Con el aviso visible (control), la ausencia de la lista y de filas es real
    checks.push(check(notice === 'visible' && feed === 'hidden' && rows === 0, 'ningún evento en la pantalla', `lista ${presenceText(feed)}; filas ${rows ?? '(sin leer)'}`));
  }
  // El menú solo se lee cuando el control «Programas» se ve: sin él, «no aparece» no tendría valor
  await waitUntil(async () => (await presenceOf(sidebarOf(page).getByRole('link', { name: /Programas/ }))) === 'visible');
  const navLink = await presenceOf(sidebarOf(page).getByRole('link', { name: /Auditoría/ }));
  const control = await presenceOf(sidebarOf(page).getByRole('link', { name: /Programas/ }));
  const menuOk = menu ? navLink === 'visible' : navLink === 'hidden' && control === 'visible';
  checks.push(check(menuOk, menu ? '«Auditoría» aparece en el menú lateral' : '«Auditoría» no aparece en el menú lateral (el menú sí se ve)', `menú: «Auditoría» ${presenceText(navLink)}; control «Programas» ${presenceText(control)}`));
  return verdictOf(checks);
});

/** Esquema 2: el enlace de la pantalla sin permiso vuelve a Programas. */
const backToPrograms: BrowserRowHandler = onWeb(async (row, { page }) => {
  const ruta = cell(row, 'ruta');
  const expected = `llega a ${ruta} desde «Volver a Programas»`;
  await resetAlumno();
  const entered = await signIn(page, 'gestor@sigpro.test', 'Gestor1234!');
  if (entered !== undefined) return preparationFailedWeb(expected, `gestor@sigpro.test entra en /login?tenant=alumno01: ${entered}`);
  const opened = await openPath(page, AUDIT_PATH);
  if (opened !== undefined) return preparationFailedWeb(expected, opened);
  const notice = await waitUntil(async () => (await presenceOf(forbiddenOf(page))) === 'visible');
  if (!notice.reached) return verdictOf([check(false, 'el aviso de rol aparece antes de pulsar el enlace', `aviso de rol ${presenceText(await presenceOf(forbiddenOf(page)))} tras ${notice.elapsedMs} ms`)]);
  const link = page.getByRole('link', { name: 'Volver a Programas', exact: true });
  const blocked = await act(link, 'pulsar «Volver a Programas»', (element) => element.click(ACTION));
  if (blocked !== undefined) return actionFailed(expected, blocked);
  const arrived = await waitUntil(async () => pathOf(page) === ruta);
  return verdictOf([check(arrived.reached, expected, `llega a ${pathOf(page)}`)]);
});

/** Esquema 3: la primera página muestra los 20 eventos más recientes (contador, primera fila y sin fin de lista). */
const firstPageRows: BrowserRowHandler = onWeb(async (row, { page }) => {
  const cuenta = cell(row, 'cuenta');
  const contrasena = cell(row, 'contraseña');
  const expected = `contador «${FIRST_PAGE}»; primera fila Requisito creado, REQ-011, Lucía Fernández; sin «No hay más eventos»`;
  await resetAlumno();
  const entered = await signIn(page, cuenta, contrasena);
  if (entered !== undefined) return preparationFailedWeb(expected, `${cuenta} entra en /login?tenant=alumno01: ${entered}`);
  const opened = await openPath(page, AUDIT_PATH);
  if (opened !== undefined) return preparationFailedWeb(expected, opened);
  await waitCount(page, FIRST_PAGE);
  const first = await firstRow(page);
  const end = await presenceOf(endOf(page));
  const count = await countNow(page);
  return verdictOf([
    check(count === FIRST_PAGE, `contador «${FIRST_PAGE}»`, `contador «${count ?? '(sin leer)'}»`),
    ...seedFirstChecks(first),
    check(end === 'hidden', 'no aparece «No hay más eventos»', `«No hay más eventos» ${presenceText(end)}`),
  ]);
});

/** Columna «fin» del Esquema 4. */
const END_TEXT: ReadonlyMap<string, boolean> = new Map<string, boolean>([
  ['no aparece «No hay más eventos»', false],
  ['aparece «No hay más eventos»', true],
]);

/** Esquema 4: desplazarse hasta el final carga la página siguiente, sin repetir eventos y sin desviarse del recuento. */
const scrollLoads: BrowserRowHandler = onWeb(async (row, { page }) => {
  const cargas = Number(cell(row, 'cargas'));
  if (!Number.isInteger(cargas) || cargas < 1) throw new Error(`celda sin interpretación: cargas «${cell(row, 'cargas')}»`);
  const contador = cell(row, 'contador');
  const endWanted = strict('fin', END_TEXT, cell(row, 'fin'));
  const expected = `tras ${cargas} desplazamiento(s): contador «${contador}»; ${cell(row, 'fin')}`;
  await resetAlumno();
  const entered = await signIn(page, 'auditor@sigpro.test', 'Audit1234!');
  if (entered !== undefined) return preparationFailedWeb(expected, `auditor@sigpro.test entra en /login?tenant=alumno01: ${entered}`);
  const requests = watchAuditRequests(page);
  const opened = await openPath(page, AUDIT_PATH);
  if (opened !== undefined) return preparationFailedWeb(expected, opened);
  const control = await waitCount(page, FIRST_PAGE);
  if (!control) return preparationFailedWeb(expected, `el contador no llega a «${FIRST_PAGE}» antes de desplazarse (control)`);
  let reached = true;
  for (let step = 1; step <= cargas && reached; step += 1) {
    const shown = Math.min(20 + 20 * step, 130);
    const scrolled = await act(feedOf(page), 'desplazar el feed hasta el final', () => scrollFeedToEnd(page));
    if (scrolled !== undefined) return actionFailed(expected, scrolled);
    reached = await waitCount(page, countText(shown, 130));
  }
  const held = await holdsFor(async () => (await countNow(page)) === contador, HOLD_MS);
  const end = await presenceOf(endOf(page));
  const count = await countNow(page);
  return verdictOf(
    [
      check(reached && held.held, `contador «${contador}» tras ${cargas} desplazamiento(s)`, `contador «${count ?? '(sin leer)'}»${reached ? '' : ' (no llegó a la cifra esperada)'}`),
      check(end === (endWanted ? 'visible' : 'hidden'), cell(row, 'fin'), `${end === 'visible' ? 'aparece' : end === 'hidden' ? 'no aparece' : 'sin leer'} «No hay más eventos»`),
    ],
    { evidence: { peticionesConCursor: cursorRequestsIn(requests), desplazamientos: cargas } },
  );
});

/** Esquema 5, columnas «pagina_fallida» y «accion»: qué petición falla y qué hace la persona. */
const FAILED_PAGE: ReadonlyMap<string, 'primera' | 'siguiente'> = new Map<string, 'primera' | 'siguiente'>([
  ['la primera página de GET /api/audit', 'primera'],
  ['la página siguiente de GET /api/audit', 'siguiente'],
]);
const ACTION_OF: ReadonlyMap<string, 'primera' | 'siguiente'> = new Map<string, 'primera' | 'siguiente'>([
  ['abre /audit', 'primera'],
  ['abre /audit y se desplaza hasta el final de la lista', 'siguiente'],
]);
/** Columna «aviso»: el aviso de la primera página o la traza bajo los eventos cargados. */
const NOTICE: ReadonlyMap<string, 'titulo' | 'traza'> = new Map<string, 'titulo' | 'traza'>([
  ['«No se pudo cargar la auditoría» con la traza del error', 'titulo'],
  ['la traza del error debajo de los eventos cargados', 'traza'],
]);

/** Esquema 5: un fallo al pedir una página muestra su aviso, y el botón lo vuelve a pedir con la API disponible. */
const pageFailure: BrowserRowHandler = onWeb(async (row, { page }) => {
  const pagina = strict('pagina_fallida', FAILED_PAGE, cell(row, 'pagina_fallida'));
  const accion = strict('accion', ACTION_OF, cell(row, 'accion'));
  if (pagina !== accion) throw new Error(`celda sin interpretación: la acción «${cell(row, 'accion')}» no corresponde a «${cell(row, 'pagina_fallida')}»`);
  strict('aviso', NOTICE, cell(row, 'aviso'));
  const boton = quoted(cell(row, 'boton'));
  const contadorTras = cell(row, 'contador_tras_reintentar');
  const expected = `${cell(row, 'aviso')} y el botón «${boton}»; al pulsarlo con la API disponible: ${contadorTras}`;
  await resetAlumno();
  const entered = await signIn(page, 'auditor@sigpro.test', 'Audit1234!');
  if (entered !== undefined) return preparationFailedWeb(expected, `auditor@sigpro.test entra en /login?tenant=alumno01: ${entered}`);
  const failure: Failure = { on: true, failed: 0, passed: 0 };
  const requests = watchAuditRequests(page);
  await failAuditRequests(page, pagina === 'primera' ? (url) => !url.searchParams.has('cursor') : (url) => url.searchParams.has('cursor'), failure);
  const opened = await openPath(page, AUDIT_PATH);
  if (opened !== undefined) return preparationFailedWeb(expected, opened);
  if (pagina === 'primera') {
    await waitUntil(async () => (await presenceOf(errorOf(page))) === 'visible');
    const lines = await linesIn(errorOf(page));
    const trace = lines.slice(1).filter((line) => line !== 'Reintentar').join(' | ');
    const retry = await presenceOf(retryOf(page));
    const error = await presenceOf(errorOf(page));
    failure.on = false;
    const blocked = await act(retryOf(page), `pulsar «${boton}»`, (element) => element.click(ACTION));
    if (blocked !== undefined) return actionFailed(expected, blocked);
    const back = await waitCount(page, contadorTras);
    const count = await countNow(page);
    return verdictOf(
      [
        check(error === 'visible' && lines[0] === 'No se pudo cargar la auditoría', 'aviso «No se pudo cargar la auditoría»', error === 'visible' ? `aviso «${lines[0] ?? '(vacío)'}»` : `aviso ${presenceText(error)}`),
        check(trace.length > 0, 'el aviso lleva la traza del error', `traza: ${trace || '(vacía)'}`),
        check(retry === 'visible' && boton === 'Reintentar', `botón «${boton}»`, `botón «Reintentar» ${presenceText(retry)}`),
        check(back && count === contadorTras, `contador «${contadorTras}» tras pulsar «${boton}»`, `contador «${count ?? '(sin leer)'}»`),
      ],
      { evidence: { traza: await traceEvidence(errorOf(page)), ...failureEvidence(failure, requests) } },
    );
  }
  await waitCount(page, FIRST_PAGE);
  const scrolled = await act(feedOf(page), 'desplazar el feed hasta el final', () => scrollFeedToEnd(page));
  if (scrolled !== undefined) return actionFailed(expected, scrolled);
  const shown = await waitUntil(async () => (await presenceOf(moreErrorOf(page))) === 'visible');
  const lines = (await linesIn(moreErrorOf(page))).filter((line) => line !== 'Cargar más');
  const afterRows = await moreErrorAfterRows(page);
  const count = await countNow(page);
  const quiet = await noExtraCursorRequest(requests, cursorRequestsIn(requests), HOLD_MS);
  failure.on = false;
  const blocked = await act(loadMoreOf(page), `pulsar «${boton}»`, (element) => element.click(ACTION));
  if (blocked !== undefined) return actionFailed(expected, blocked);
  const back = await waitCount(page, contadorTras);
  const after = await countNow(page);
  return verdictOf(
    [
      check(shown.reached && lines.length > 0, 'aviso con la traza del error debajo de los eventos cargados', shown.reached ? `aviso con ${lines.length} línea(s) de traza` : 'no aparece el aviso bajo los eventos'),
      check(afterRows === true, 'el aviso va después del último evento cargado', afterRows === true ? 'va después del último evento' : afterRows === false ? 'no va después del último evento' : 'sin leer'),
      check(count === FIRST_PAGE, `sigue «${FIRST_PAGE}» tras el fallo`, `contador «${count ?? '(sin leer)'}» tras el fallo`),
      quiet,
      check(back && after === contadorTras, `contador «${contadorTras}» tras pulsar «${boton}»`, `contador «${after ?? '(sin leer)'}»`),
    ],
    { evidence: { traza: lines.join(' | '), ...failureEvidence(failure, requests) } },
  );
});

/** Esquema 6: un evento sin actor se muestra como Sistema (la solicitud de acceso de la fila). */
const systemActor: BrowserRowHandler = onWeb(async (row, { page }) => {
  const cuenta = cell(row, 'cuenta');
  const contrasena = cell(row, 'contraseña');
  const expected = 'primera fila: actor Sistema, entidad Usuario, acción auth.register';
  await resetAlumno();
  const registered = await requestAccount(TENANT_A);
  if (registered.result.status !== 201) return preparationFailedWeb(expected, `POST /api/auth/register responde ${registered.result.status}`);
  const entered = await signIn(page, cuenta, contrasena);
  if (entered !== undefined) return preparationFailedWeb(expected, `${cuenta} entra en /login?tenant=alumno01: ${entered}`);
  const opened = await openPath(page, AUDIT_PATH);
  if (opened !== undefined) return preparationFailedWeb(expected, opened);
  // Tras la solicitud el total es 131: se espera a que la lista asiente, no a la cifra de la semilla
  await waitSettled(page);
  const first = await firstRow(page);
  return verdictOf([
    check(first?.actor === 'Sistema', 'actor «Sistema»', `actor «${first?.actor ?? '(sin leer)'}»`),
    check(first?.entity === 'Usuario', 'entidad «Usuario»', `entidad «${first?.entity ?? '(sin leer)'}»`),
    check(first?.code === 'auth.register', 'acción con el código auth.register', `código «${first?.code ?? '(sin leer)'}»`),
  ]);
});

/** Esquema 7: la sección Auditoría de Administración muestra el mismo registro. */
const adminSection: BrowserRowHandler = onWeb(async (row, { page }) => {
  const contador = cell(row, 'contador');
  const expected = `título «Registro de auditoría», contador «${contador}», primera fila Requisito creado de Lucía Fernández`;
  await resetAlumno();
  const entered = await signIn(page, 'alumno01@sigpro.lab', 'Alumno1234!');
  if (entered !== undefined) return preparationFailedWeb(expected, `alumno01@sigpro.lab entra en /login?tenant=alumno01: ${entered}`);
  const opened = await openPath(page, ADMIN_AUDIT_PATH);
  if (opened !== undefined) return preparationFailedWeb(expected, opened);
  await waitCount(page, contador);
  const heading = await presenceOf(page.getByRole('heading', { name: 'Registro de auditoría', level: 2, exact: true }));
  const count = await countNow(page);
  const first = await firstRow(page);
  return verdictOf([
    check(heading === 'visible', 'título «Registro de auditoría»', `título ${presenceText(heading)}`),
    check(count === contador, `contador «${contador}»`, `contador «${count ?? '(sin leer)'}»`),
    check(first?.action === 'Requisito creado' && first.code === 'requirement.created' && first.actor === 'Lucía Fernández', 'primera fila: Requisito creado, requirement.created, Lucía Fernández', `primera fila: ${first?.action ?? '(sin leer)'}, ${first?.code ?? '(sin leer)'}, ${first?.actor ?? '(sin leer)'}`),
  ]);
});

defineBrowserRows({
  story: 'US-AUDITORIA-006',
  surface: 'web',
  tenants: [TENANT_A],
  handlers: new Map<number, BrowserRowHandler>([
    [1, roleGate],
    [2, backToPrograms],
    [3, firstPageRows],
    [4, scrollLoads],
    [5, pageFailure],
    [6, systemActor],
    [7, adminSection],
  ]),
});
