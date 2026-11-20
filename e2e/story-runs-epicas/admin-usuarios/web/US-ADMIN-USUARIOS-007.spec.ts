import type { Page } from '@playwright/test';
import { PROGRAMAS_TESTIDS } from '../../../../packages/shared/src/testids';
import { TENANT_A } from '../../../story-runs/support/prepare';
import { ACTION, CEILING_MS, isVisible, linesOf, quoted, runSteps, safe, textOf, valueOf, waitUntil } from '../../support/browser';
import { check, cell, preparationFailedWeb, sleep, strict } from '../../support/checks';
import { defineBrowserRows, type BrowserRowHandler } from '../../core/framework';
import { SEED_ID } from '../api/common';
import {
  ADMIN_PATH,
  activeSwitchOf,
  corsFor,
  errorBody,
  isApiPath,
  onWeb,
  resetAlumno,
  roleSelectOf,
  rowOf,
  selectedRoleLabel,
  signInWeb,
  statusBadgeOf,
  switchChecked,
  textCheck,
  userRows,
  usersCount,
  usersEmpty,
  usersError,
  usersRetry,
  usersSearch,
  verdict,
  visibleEmails,
  waitTableReady,
} from './common';

// US-ADMIN-USUARIOS-007 — Tabla de usuarios, búsqueda y avisos de carga, vacío y error (web, escritorio 1440 × 900).
// Preparación de cada fila: reinicio de alumno01; la cuenta alumno01@sigpro.lab inicia sesión en la web y abre «Usuarios» de Administración.
// Para las esperas y los fallos, la prueba intercepta en el navegador la petición GET /api/admin/users de la fila.

const ROLE_LABELS: ReadonlyMap<string, string> = new Map<string, string>([
  ['Admin', 'Admin'],
  ['Consultor', 'Consultor'],
]);

const ACTIVE_LABELS: ReadonlyMap<string, string> = new Map<string, string>([
  ['encendido', 'encendido'],
  ['apagado', 'apagado'],
]);

const STATUS_LABELS: ReadonlyMap<string, string> = new Map<string, string>([
  ['Normal', 'Normal'],
  ['Bloqueado', 'Bloqueado'],
  ['Pendiente', 'Pendiente'],
]);

const SEARCH_TEXTS: ReadonlyMap<string, string> = new Map<string, string>([
  ['ortega', 'ortega'],
  ['(GESTOR@SIGPRO.test con un espacio delante y otro detrás)', ' GESTOR@SIGPRO.test '],
  ['alumno', 'alumno'],
  ['zzz', 'zzz'],
]);

/** Lo que muestra la lista tras buscar: una sola fila con ese correo, o el aviso de ninguna coincidencia. */
type Shown = { readonly kind: 'only'; readonly email: string } | { readonly kind: 'empty' };

const RESULT_CELLS: ReadonlyMap<string, Shown> = new Map<string, Shown>([
  ['solo se ve la fila de gestor@sigpro.test', { kind: 'only', email: 'gestor@sigpro.test' }],
  ['solo se ve la fila de alumno01@sigpro.lab', { kind: 'only', email: 'alumno01@sigpro.lab' }],
  ['se ve el aviso «Ningún usuario coincide con la búsqueda.»', { kind: 'empty' }],
]);

const CODES: ReadonlyMap<string, number> = new Map<string, number>([
  ['500', 500],
  ['503', 503],
]);

const DELAYS: ReadonlyMap<string, number> = new Map<string, number>([
  ['1 segundo', 1_000],
  ['3 segundos', 3_000],
]);

/** Número de filas de cuentas en la tabla (0 si no se puede leer). */
const rowCount = (page: Page): Promise<number> => safe(() => userRows(page).count(), 0);

// --- Esquema 1: la tabla muestra cada cuenta con su rol y su estado ------------------------------------------------------------

const rowShows: BrowserRowHandler = async (row, { page }) => {
  const id = strict('correo', SEED_ID, cell(row, 'correo'));
  const role = strict('rol', ROLE_LABELS, cell(row, 'rol'));
  const active = strict('activo', ACTIVE_LABELS, cell(row, 'activo'));
  const status = strict('estado', STATUS_LABELS, quoted(cell(row, 'estado')));
  const expected = `la fila de ${cell(row, 'correo')} muestra el rol ${role} en «Rol», el interruptor de «Activo» ${active} y el estado «${status}»`;
  await resetAlumno();
  const signed = await signInWeb(page, 'alumno01@sigpro.lab');
  if (signed !== undefined) return preparationFailedWeb(expected, `iniciar sesión como alumno01@sigpro.lab: ${signed}`);
  const opened = await runSteps([['abrir /admin', () => page.goto(ADMIN_PATH, { timeout: CEILING_MS })]]);
  if (opened !== undefined) return preparationFailedWeb(expected, opened);
  const ready = await waitTableReady(page);
  if (!ready) return preparationFailedWeb(expected, 'la tabla de usuarios no asienta su lista');
  const present = await waitUntil(() => isVisible(rowOf(page, id)));
  const roleShown = await selectedRoleLabel(roleSelectOf(page, id));
  const activeShown = (await switchChecked(activeSwitchOf(page, id))) === 'true' ? 'encendido' : 'apagado';
  const statusShown = await textOf(statusBadgeOf(page, id));
  return verdict([
    check(present.reached, `aparece la fila de ${cell(row, 'correo')}`, present.reached ? `aparece la fila de ${cell(row, 'correo')}` : `no aparece la fila de ${cell(row, 'correo')}`),
    textCheck(roleShown, role, 'el selector «Rol» muestra'),
    check(activeShown === active, `el interruptor de «Activo» está ${active}`, `el interruptor de «Activo» está ${activeShown}`),
    textCheck(statusShown, status, 'la insignia de «Estado» muestra'),
  ]);
};

// --- Esquema 2: la búsqueda filtra por nombre o correo y cambia el recuento ----------------------------------------------------

const searchFilters: BrowserRowHandler = async (row, { page }) => {
  const typed = strict('busqueda', SEARCH_TEXTS, cell(row, 'busqueda'));
  const count = quoted(cell(row, 'recuento'));
  const shown = strict('resultado', RESULT_CELLS, cell(row, 'resultado'));
  const expected = `«${count}»; ${cell(row, 'resultado')}`;
  await resetAlumno();
  const signed = await signInWeb(page, 'alumno01@sigpro.lab');
  if (signed !== undefined) return preparationFailedWeb(expected, `iniciar sesión como alumno01@sigpro.lab: ${signed}`);
  const opened = await runSteps([['abrir /admin', () => page.goto(ADMIN_PATH, { timeout: CEILING_MS })]]);
  if (opened !== undefined) return preparationFailedWeb(expected, opened);
  const ready = await waitTableReady(page);
  if (!ready) return preparationFailedWeb(expected, 'la tabla de usuarios no asienta su lista');
  const typing = await runSteps([[`escribir ${JSON.stringify(typed)} en «Buscar usuarios»`, () => usersSearch(page).fill(typed, ACTION)]]);
  if (typing !== undefined) return preparationFailedWeb(expected, typing);
  const counted = await waitUntil(async () => (await textOf(usersCount(page))) === count);
  const recount = await textOf(usersCount(page));
  const fieldValue = await valueOf(usersSearch(page));
  const emails = await visibleEmails(page);
  const emptyText = await textOf(usersEmpty(page));
  const resultCheck =
    shown.kind === 'only'
      ? check(emails.length === 1 && emails[0] === shown.email, `solo se ve la fila de ${shown.email}`, `se ven ${emails.length} filas: ${emails.join(', ') || '(ninguna)'}`)
      : check(emails.length === 0 && emptyText === 'Ningún usuario coincide con la búsqueda.', 'se ve el aviso «Ningún usuario coincide con la búsqueda.» y ninguna fila', `filas ${emails.length}; aviso «${emptyText ?? '(sin texto)'}»`);
  return verdict([
    textCheck(recount, count, 'el recuento dice'),
    check(counted.reached, `el recuento llega a «${count}»`, counted.reached ? 'el recuento llega al valor esperado' : `el recuento queda en «${recount ?? '(sin texto)'}»`),
    check(fieldValue === typed, `el campo «Buscar usuarios» conserva ${JSON.stringify(typed)}`, `el campo «Buscar usuarios» tiene ${JSON.stringify(fieldValue ?? '(sin leer)')}`),
    resultCheck,
  ]);
};

// --- Esquema 3: si la lista no se puede cargar, el aviso ofrece reintentar -----------------------------------------------------

const listFails: BrowserRowHandler = async (row, { page }) => {
  const code = strict('codigo', CODES, cell(row, 'codigo'));
  const expected = `aviso «No se pudieron cargar los usuarios» con la traza GET /api/admin/users → ${code} y «Reintentar»; al reintentar, siete cuentas`;
  await resetAlumno();
  const signed = await signInWeb(page, 'alumno01@sigpro.lab');
  if (signed !== undefined) return preparationFailedWeb(expected, `iniciar sesión como alumno01@sigpro.lab: ${signed}`);
  // La prueba responde el código a cada GET de la lista mientras esté «fallando»; «Reintentar» la deja pasar.
  // En desarrollo StrictMode pide la lista dos veces al montar: con solo la primera petición fallida, la segunda taparía el error.
  let failing = true;
  let served = 0;
  await page.route(
    (url) => isApiPath(url, '/admin/users'),
    (route) => {
      if (!failing || route.request().method() !== 'GET') return route.continue();
      served += 1;
      return route.fulfill({ status: code, contentType: 'application/json', headers: corsFor(route), body: errorBody(code, 'internal_error') });
    },
  );
  const opened = await runSteps([['abrir /admin', () => page.goto(ADMIN_PATH, { timeout: CEILING_MS })]]);
  if (opened !== undefined) return preparationFailedWeb(expected, opened);
  const errorShown = await waitUntil(() => isVisible(usersError(page)));
  if (!errorShown.reached) return preparationFailedWeb(expected, 'el aviso de error no aparece tras la petición fallida');
  const lines = linesOf(await textOf(usersError(page)));
  const trace = lines.find((line) => line.startsWith('GET /api/admin/users'));
  const retryShown = await isVisible(usersRetry(page));
  failing = false;
  const retried = await runSteps([['pulsar «Reintentar»', () => usersRetry(page).click(ACTION)]]);
  const back = await waitUntil(async () => (await rowCount(page)) === 7);
  const rows = await rowCount(page);
  return verdict(
    [
      textCheck(lines[0], 'No se pudieron cargar los usuarios', 'el aviso dice'),
      check(trace !== undefined && trace.startsWith(`GET /api/admin/users → ${code}`), `la traza es GET /api/admin/users → ${code}`, `la traza es «${trace ?? '(no aparece)'}»`),
      check(retryShown, 'el aviso tiene el botón «Reintentar»', `botón «Reintentar» visible=${String(retryShown)}`),
      check(retried === undefined && back.reached, 'al reintentar aparecen las siete cuentas del tenant', retried ?? `la tabla muestra ${rows} cuentas`),
    ],
    `La prueba respondió ${code} a ${served} petición(es) de la lista antes de «Reintentar».`,
  );
};

// --- Esquema 4: mientras la lista carga, el recuento muestra puntos suspensivos ------------------------------------------------

const slowList: BrowserRowHandler = async (row, { page }) => {
  const delay = strict('espera', DELAYS, cell(row, 'espera'));
  const expected = `durante ${cell(row, 'espera')} el recuento muestra «…» y la tabla muestra filas de carga; al llegar la respuesta, siete cuentas`;
  await resetAlumno();
  const signed = await signInWeb(page, 'alumno01@sigpro.lab');
  if (signed !== undefined) return preparationFailedWeb(expected, `iniciar sesión como alumno01@sigpro.lab: ${signed}`);
  await page.route(
    (url) => isApiPath(url, '/admin/users'),
    async (route) => {
      if (route.request().method() !== 'GET') return route.continue();
      await sleep(delay);
      return route.continue();
    },
  );
  const opened = await runSteps([['abrir /admin', () => page.goto(ADMIN_PATH, { timeout: CEILING_MS })]]);
  if (opened !== undefined) return preparationFailedWeb(expected, opened);
  let during = '(sin leer)';
  const loading = await waitUntil(async () => {
    const count = await textOf(usersCount(page));
    const skeletons = await safe(() => page.getByTestId(PROGRAMAS_TESTIDS.SKELETON_ROW).count(), 0);
    during = `recuento «${count ?? '(sin texto)'}», filas de carga ${skeletons}`;
    return count === '…' && skeletons > 0;
  });
  const ready = await waitTableReady(page);
  const rows = await rowCount(page);
  return verdict([
    check(loading.reached, 'durante la espera el recuento muestra «…» y la tabla muestra filas de carga', `durante la espera ${during}`),
    check(ready && rows === 7, 'al llegar la respuesta la tabla muestra las siete cuentas', ready ? `la tabla muestra ${rows} cuentas` : 'la tabla no asienta tras la respuesta'),
  ]);
};

defineBrowserRows({
  story: 'US-ADMIN-USUARIOS-007',
  surface: 'web',
  tenants: [TENANT_A],
  handlers: new Map<number, BrowserRowHandler>([
    [1, onWeb(rowShows)],
    [2, onWeb(searchFilters)],
    [3, onWeb(listFails)],
    [4, onWeb(slowList)],
  ]),
});

