import { TENANT_A } from '../../../story-runs/support/prepare';
import { ACTION, HOLD_MS, quoted, waitUntil } from '../../support/browser';
import { cell, check, preparationFailedWeb, sleep, strict, type Check } from '../../support/checks';
import { defineBrowserRows, notExecutable, type BrowserRowHandler } from '../../core/framework';
import { STRICTMODE_NOTE, TRACE_NOTE, verdictOf } from '../verdict';
import {
  act,
  actionFailed,
  countNow,
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
  noExtraCursorRequest,
  notShown,
  presenceOf,
  presenceText,
  resetAlumno,
  retryOf,
  rowKeysOf,
  rowsOf,
  waitCount,
  waitSettled,
  watchAuditRequests,
  type Failure,
} from '../web/common';
import { ADMIN_AUDIT_PATH, AUDIT_PATH, adminTitle, moreErrorBox, onExpoWeb, openPath, scrollListToEnd, settleCount, signIn, titleHeading } from './common';

// US-AUDITORIA-008 — Ver el registro de auditoría en /audit (app móvil, Expo web a 390 px): lista, «Cargar más» y avisos por rol.
// Preparación de cada fila: alumno01 reiniciado con el token de su administrador; la app en /login sin sesión, con alumno01 en
// «Tenant de trabajo», y cada cuenta de la fila entra con su correo y su contraseña. Las cifras (130 eventos, primero AL-130) son las de
// la historia; lo observado se mide en la pantalla.

const FIRST_PAGE = countText(20, 130);
const SEED_FIRST = { action: 'Requisito creado', code: 'requirement.created' } as const;
/** Nota de las filas de fallo provocado: traza solo por presencia y fallo de todas las peticiones coincidentes. */
const FAILURE_NOTE = `${TRACE_NOTE} ${STRICTMODE_NOTE}`;

/** Columna «resultado» del Esquema 1. */
const RESULTADO: ReadonlyMap<string, 'lista' | 'aviso'> = new Map<string, 'lista' | 'aviso'>([
  ['el título «Auditoría» y la lista de eventos', 'lista'],
  ['el aviso «Tu rol no permite ver la auditoría», con la explicación «Solo admin y auditor pueden consultar el registro.», y ningún evento', 'aviso'],
]);

/** Esquema 1: solo admin y auditor ven el registro; el resto ve el aviso de rol sin eventos. */
const roleGate: BrowserRowHandler = onExpoWeb(async (row, { page }) => {
  const cuenta = cell(row, 'cuenta');
  const contrasena = cell(row, 'contraseña');
  const resultado = strict('resultado', RESULTADO, cell(row, 'resultado'));
  const expected = cell(row, 'resultado');
  await resetAlumno();
  const entered = await signIn(page, cuenta, contrasena);
  if (entered !== undefined) return preparationFailedWeb(expected, `${cuenta} entra en /login con alumno01: ${entered}`);
  const opened = await openPath(page, AUDIT_PATH);
  if (opened !== undefined) return preparationFailedWeb(expected, opened);
  const checks: Check[] = [];
  if (resultado === 'lista') {
    // La lista se asienta (la carga muestra la fila de carga, sin filas): se espera a su recuento antes de contar filas
    await waitSettled(page);
    const title = await presenceOf(titleHeading(page));
    const feed = await presenceOf(feedOf(page));
    const rows = await rowsOf(page).count().catch(() => undefined);
    checks.push(check(title === 'visible', 'título «Auditoría» (encabezado de nivel 1)', `título ${presenceText(title)}`));
    checks.push(check(feed === 'visible' && (rows ?? 0) > 0, 'la lista de eventos muestra filas', `lista ${presenceText(feed)} con ${rows ?? '(sin leer)'} filas`));
  } else {
    await waitUntil(async () => (await presenceOf(forbiddenOf(page))) === 'visible');
    const notice = await presenceOf(forbiddenOf(page));
    const lines = await linesIn(forbiddenOf(page));
    const feed = await presenceOf(feedOf(page));
    const rows = await rowsOf(page).count().catch(() => undefined);
    checks.push(check(notice === 'visible' && lines.includes('Tu rol no permite ver la auditoría'), 'aviso «Tu rol no permite ver la auditoría»', notice === 'visible' ? `aviso con «${lines[0] ?? '(vacío)'}»` : `aviso ${presenceText(notice)}`));
    checks.push(check(lines.includes('Solo admin y auditor pueden consultar el registro.'), 'explicación «Solo admin y auditor pueden consultar el registro.»', `explicación ${lines.includes('Solo admin y auditor pueden consultar el registro.') ? 'presente' : 'ausente'}`));
    // Con el aviso visible (control), la ausencia de la lista y de filas es real
    checks.push(check(notice === 'visible' && notShown(feed) && rows === 0, 'ningún evento en la pantalla', `lista ${presenceText(feed)}; filas ${rows ?? '(sin leer)'}`));
  }
  return verdictOf(checks);
});

/** Columna «accion» del Esquema 2: qué hace la persona en la lista. */
const ACCION: ReadonlyMap<string, 'boton' | 'desplazar'> = new Map<string, 'boton' | 'desplazar'>([
  ['pulsa «Cargar más»', 'boton'],
  ['se desplaza hasta el final de la lista', 'desplazar'],
]);
/** Columna «fin»: qué se ve al final del recorrido (el fin de la lista y el botón de carga). */
const FIN: ReadonlyMap<string, { readonly end: boolean; readonly loadMore: boolean }> = new Map([
  ['no aparece «No hay más eventos» y sigue «Cargar más»', { end: false, loadMore: true }],
  ['aparece «No hay más eventos» y no hay «Cargar más»', { end: true, loadMore: false }],
]);

/**
 * Esquema 2: la lista carga la página siguiente con «Cargar más» o al llegar al final. El procedimiento literal exige que cada paso sea
 * una pulsación (o un desplazamiento) y que la única carga con cursor sea la de ese paso: si la lista se agota o carga sola, la fila no
 * es ejecutable tal como está escrita y no se da por coincidente.
 */
const loadMore: BrowserRowHandler = onExpoWeb(async (row, { page }) => {
  const accion = strict('accion', ACCION, cell(row, 'accion'));
  const veces = Number(cell(row, 'veces'));
  if (!Number.isInteger(veces) || veces < 1) throw new Error(`celda sin interpretación: veces «${cell(row, 'veces')}»`);
  const contador = cell(row, 'contador');
  const fin = strict('fin', FIN, cell(row, 'fin'));
  const expected = `${cell(row, 'accion')} ${veces} vez/veces; contador «${contador}»; ${cell(row, 'fin')}`;
  await resetAlumno();
  const entered = await signIn(page, 'auditor@sigpro.test', 'Audit1234!');
  if (entered !== undefined) return preparationFailedWeb(expected, `auditor@sigpro.test entra en /login con alumno01: ${entered}`);
  const requests = watchAuditRequests(page);
  const opened = await openPath(page, AUDIT_PATH);
  if (opened !== undefined) return preparationFailedWeb(expected, opened);
  const control = await waitCount(page, FIRST_PAGE);
  if (!control) return preparationFailedWeb(expected, `el contador no llega a «${FIRST_PAGE}» antes de cargar (control)`);
  let clicks = 0;
  let scrolls = 0;
  let stopped: string | undefined;
  // Peticiones con cursor que trajo cada paso: cada clic (o desplazamiento) debe traer exactamente una
  const perStep: number[] = [];
  for (let step = 0; step < veces; step += 1) {
    // Antes de cada paso la lista debe asentar: «Cargar más» o «No hay más eventos» visibles (no «cargando», que oculta el botón)
    const settled = await waitUntil(async () => (await presenceOf(loadMoreOf(page))) === 'visible' || (await presenceOf(endOf(page))) === 'visible');
    if (!settled.reached) {
      stopped = `en el paso ${step + 1} la lista no muestra «Cargar más» ni «No hay más eventos» en ${settled.elapsedMs} ms`;
      break;
    }
    if ((await presenceOf(loadMoreOf(page))) !== 'visible') {
      stopped = `en el paso ${step + 1} ya no hay «Cargar más» (la lista se agotó antes de los ${veces} pasos)`;
      break;
    }
    const before = await countNow(page);
    const cursorBefore = cursorRequestsIn(requests);
    if (accion === 'boton') {
      clicks += 1;
      const blocked = await act(loadMoreOf(page), 'pulsar «Cargar más»', (element) => element.click(ACTION));
      if (blocked !== undefined) return actionFailed(expected, blocked);
    } else {
      scrolls += 1;
      const scrolled = await scrollListToEnd(page);
      if (!scrolled) {
        // Sin contenedor desplazable: si la pantalla correcta se ve, es un hallazgo; si no, la fila no se puede ejecutar
        const feedVisible = (await presenceOf(feedOf(page))) === 'visible';
        return feedVisible
          ? verdictOf([check(false, expected, 'la lista se ve, pero no hay contenedor desplazable para llevar el scroll al final')], {
              note: 'La pantalla correcta está visible, pero no se encontró el contenedor con scroll: el desplazamiento no se puede hacer en esta pantalla.',
            })
          : notExecutable(expected, 'No se pudo comprobar la lista (no se ve el feed) y no hay contenedor desplazable: la fila no se ejecuta.');
      }
    }
    await waitUntil(async () => (await countNow(page)) !== before);
    perStep.push(cursorRequestsIn(requests) - cursorBefore);
  }
  const cursor = cursorRequestsIn(requests);
  const steps = accion === 'boton' ? clicks : scrolls;
  if (steps !== veces || cursor !== steps || !perStep.every((delta) => delta === 1)) {
    const motivo = stopped ?? `se hicieron ${clicks} clic(s) y ${scrolls} desplazamiento(s) de ${veces}`;
    return notExecutable(expected, `El procedimiento literal no se puede hacer tal como está escrito: ${motivo}; peticiones con cursor: ${cursor}, por paso: [${perStep.join(', ')}] (cargas automáticas: ${Math.max(0, cursor - steps)}). No se da por coincidente.`);
  }
  const count = await settleCount(() => countNow(page));
  const end = await presenceOf(endOf(page));
  const more = await presenceOf(loadMoreOf(page));
  const keys = await rowKeysOf(page);
  const shown = Number((count ?? '').match(/Mostrando (\d+) de/)?.[1] ?? Number.NaN);
  const evidence = { peticionesConCursor: cursor, clics: clicks, desplazamientos: scrolls };
  return verdictOf(
    [
      check(count === contador, `contador «${contador}»`, `contador «${count ?? '(sin leer)'}»`),
      check(fin.end ? end === 'visible' : notShown(end) && count === contador, cell(row, 'fin'), `«No hay más eventos» ${presenceText(end)}; contador «${count ?? '(sin leer)'}»`),
      check(fin.loadMore ? more === 'visible' : notShown(more) && count === contador, fin.loadMore ? '«Cargar más» sigue visible' : '«Cargar más» no aparece', `«Cargar más» ${presenceText(more)}`),
      check(keys !== undefined && keys.rows === shown && keys.distinct === shown, 'las filas cargadas son todas distintas (acción, entityId y hora), sin repetir ninguna', keys === undefined ? '(sin leer)' : `${keys.rows} filas, ${keys.distinct} distintas`),
    ],
    { evidence },
  );
});

/** Esquema 3, columnas «pagina_fallida» y «accion»: qué petición falla y qué hace la persona. */
const FAILED_PAGE: ReadonlyMap<string, 'primera' | 'siguiente'> = new Map<string, 'primera' | 'siguiente'>([
  ['la primera página de GET /api/audit', 'primera'],
  ['la página siguiente de GET /api/audit', 'siguiente'],
]);
const ACCION_FALLO: ReadonlyMap<string, 'primera' | 'siguiente'> = new Map<string, 'primera' | 'siguiente'>([
  ['abre /audit', 'primera'],
  ['abre /audit y pulsa «Cargar más»', 'siguiente'],
]);
const AVISO: ReadonlyMap<string, 'titulo' | 'traza'> = new Map<string, 'titulo' | 'traza'>([
  ['el título «No se pudo cargar la auditoría» con la traza del error', 'titulo'],
  ['la traza del error debajo de los eventos cargados', 'traza'],
]);

/** Esquema 3: un fallo al pedir una página muestra su aviso, y el botón lo vuelve a pedir con la API disponible. */
const pageFailure: BrowserRowHandler = onExpoWeb(async (row, { page }) => {
  const pagina = strict('pagina_fallida', FAILED_PAGE, cell(row, 'pagina_fallida'));
  strict('accion', ACCION_FALLO, cell(row, 'accion'));
  strict('aviso', AVISO, cell(row, 'aviso'));
  const boton = quoted(cell(row, 'boton'));
  const contadorTras = cell(row, 'contador_tras_reintentar');
  const expected = `${cell(row, 'aviso')} y el botón «${boton}»; con la API disponible: ${contadorTras}`;
  await resetAlumno();
  const entered = await signIn(page, 'auditor@sigpro.test', 'Audit1234!');
  if (entered !== undefined) return preparationFailedWeb(expected, `auditor@sigpro.test entra en /login con alumno01: ${entered}`);
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
    failure.on = false;
    const blocked = await act(retryOf(page), 'pulsar «Reintentar»', (element) => element.click(ACTION));
    if (blocked !== undefined) return actionFailed(expected, blocked);
    const back = await waitCount(page, contadorTras);
    const count = await countNow(page);
    return verdictOf(
      [
        check(lines[0] === 'No se pudo cargar la auditoría', 'aviso «No se pudo cargar la auditoría»', `aviso «${lines[0] ?? '(vacío)'}»`),
        check(trace.length > 0, 'el aviso lleva la traza del error', `traza: ${trace || '(vacía)'}`),
        check(retry === 'visible', 'botón «Reintentar» visible', `botón «Reintentar» ${presenceText(retry)}`),
        check(back && count === contadorTras, `contador «${contadorTras}» tras «Reintentar»`, `contador «${count ?? '(sin leer)'}»`),
      ],
      { note: FAILURE_NOTE, evidence: { traza: trace, ...failureEvidence(failure, requests) } },
    );
  }
  await waitCount(page, FIRST_PAGE);
  const press = await act(loadMoreOf(page), 'pulsar «Cargar más»', (element) => element.click(ACTION));
  if (press !== undefined) return actionFailed(expected, press);
  const shown = await waitUntil(async () => (await presenceOf(moreErrorBox(page))) === 'visible');
  const trace = (await linesIn(moreErrorBox(page))).join(' | ');
  const afterRows = await moreErrorAfterRows(page);
  const count = await countNow(page);
  const more = await presenceOf(loadMoreOf(page));
  // Tras el fallo la lista no vuelve a pedir la página por su cuenta (el botón «Cargar más» es el único camino)
  const quiet = await noExtraCursorRequest(requests, cursorRequestsIn(requests), HOLD_MS);
  failure.on = false;
  const retried = await act(loadMoreOf(page), 'pulsar «Cargar más» con la API disponible', (element) => element.click(ACTION));
  if (retried !== undefined) return actionFailed(expected, retried);
  const back = await waitCount(page, contadorTras);
  const after = await countNow(page);
  await sleep(HOLD_MS);
  return verdictOf(
    [
      check(shown.reached && trace.length > 0, `aviso con la traza del error (${cell(row, 'aviso')})`, shown.reached ? `aviso con traza de ${trace.length} caracteres` : 'no aparece el aviso'),
      check(afterRows === true, 'el aviso va debajo de los eventos cargados', afterRows === true ? 'va debajo del último evento' : afterRows === false ? 'no va debajo' : 'sin leer'),
      check(count === FIRST_PAGE && more === 'visible', `sigue «${FIRST_PAGE}» y «Cargar más» visible`, `contador «${count ?? '(sin leer)'}»; «Cargar más» ${presenceText(more)}`),
      quiet,
      check(back && after === contadorTras, `contador «${contadorTras}» tras «Cargar más»`, `contador «${after ?? '(sin leer)'}»`),
    ],
    { note: FAILURE_NOTE, evidence: { traza: trace, ...failureEvidence(failure, requests) } },
  );
});

/** Esquema 4: la sección Auditoría de Administración muestra el mismo registro (solo para admin). */
const adminSection: BrowserRowHandler = onExpoWeb(async (row, { page }) => {
  const contador = cell(row, 'contador');
  const expected = `título «Registro de auditoría» y contador «${contador}»`;
  await resetAlumno();
  const entered = await signIn(page, 'alumno01@sigpro.lab', 'Alumno1234!');
  if (entered !== undefined) return preparationFailedWeb(expected, `alumno01@sigpro.lab entra en /login con alumno01: ${entered}`);
  const opened = await openPath(page, ADMIN_AUDIT_PATH);
  if (opened !== undefined) return preparationFailedWeb(expected, opened);
  await waitCount(page, contador);
  const title = await presenceOf(adminTitle(page));
  const count = await countNow(page);
  const first = await firstRow(page);
  return verdictOf([
    check(title === 'visible', 'título «Registro de auditoría»', `título ${presenceText(title)}`),
    check(count === contador, `contador «${contador}»`, `contador «${count ?? '(sin leer)'}»`),
    check(first?.action === SEED_FIRST.action && first.code === SEED_FIRST.code, 'primera fila con Requisito creado (requirement.created)', `primera fila: ${first?.action ?? '(sin leer)'} (${first?.code ?? '(sin leer)'})`),
  ]);
});

defineBrowserRows({
  story: 'US-AUDITORIA-008',
  surface: 'expo-web',
  tenants: [TENANT_A],
  handlers: new Map<number, BrowserRowHandler>([
    [1, roleGate],
    [2, loadMore],
    [3, pageFailure],
    [4, adminSection],
  ]),
});
