import type { Page } from '@playwright/test';
import { ADMIN_TESTIDS, MOVIL_ADMIN_TESTIDS } from '../../../../packages/shared/src/testids';
import { TENANT_A } from '../../../story-runs/support/prepare';
import { ACTION, isVisible, linesOf, quoted, runSteps, safe, textOf, waitUntil } from '../../support/browser';
import { cell, check, preparationFailedWeb, sleep, strict } from '../../support/checks';
import { defineBrowserRows, type BrowserRowHandler } from '../../core/framework';
import { SEED_ID } from '../api/common';
import { corsFor, credentialsOf, errorBody, isApiPath, resetAlumno } from '../web/common';
import {
  cardOf,
  cardShowsName,
  cardsOf,
  comboLabel,
  onMobile,
  openAdminFromMore,
  signInMobile,
  statusBadgeOf,
  verdict,
  waitUsersReady,
} from './common';

// US-ADMIN-USUARIOS-010 — Ver a los usuarios del tenant en tarjetas y buscarlos (app móvil, Expo web a 390 × 844; NO es nativo).
// Preparación de cada fila: reinicio de alumno01; la app se abre en /login con alumno01 en «Tenant de trabajo»; la cuenta inicia sesión,
// va a «Más», abre «Administración» y elige «Usuarios». Para las esperas y los fallos, la prueba intercepta GET /api/admin/users.

const ROLE_LABELS: ReadonlyMap<string, string> = new Map<string, string>([
  ['Admin', 'Admin'],
  ['Consultor', 'Consultor'],
]);

const STATUS_LABELS: ReadonlyMap<string, string> = new Map<string, string>([
  ['Normal', 'Normal'],
  ['Bloqueado', 'Bloqueado'],
  ['Pendiente', 'Pendiente'],
]);

const SEARCH_TEXTS: ReadonlyMap<string, string> = new Map<string, string>([
  ['(GESTOR@SIGPRO.test con espacios delante y detrás)', ' GESTOR@SIGPRO.test '],
  ['zzz', 'zzz'],
]);

type Shown = { readonly kind: 'only'; readonly email: string } | { readonly kind: 'empty' };

const RESULT_CELLS: ReadonlyMap<string, Shown> = new Map<string, Shown>([
  ['solo se ve la tarjeta de gestor@sigpro.test', { kind: 'only', email: 'gestor@sigpro.test' }],
  ['se ve el aviso «Ningún usuario coincide con la búsqueda.»', { kind: 'empty' }],
]);

const DELAYS: ReadonlyMap<string, number> = new Map<string, number>([
  ['1 segundo', 1_000],
  ['3 segundos', 3_000],
]);

/** Campo «Buscar usuarios» de la app móvil (su nombre accesible o su testid). */
const searchField = (page: Page) => page.getByRole('textbox', { name: 'Buscar usuarios', exact: true }).or(page.getByTestId(ADMIN_TESTIDS.ADMIN_USERS_SEARCH));

// --- Esquema 1: cada tarjeta muestra el rol y el estado de su cuenta ----------------------------------------------------------

const cardShowsRoleAndStatus: BrowserRowHandler = async (row, { page }) => {
  const email = cell(row, 'correo');
  const id = strict('correo', SEED_ID, email);
  const name = cell(row, 'nombre');
  const role = strict('rol', ROLE_LABELS, cell(row, 'rol'));
  const status = strict('estado', STATUS_LABELS, quoted(cell(row, 'estado')));
  const expected = `la tarjeta de ${email} muestra el selector «Rol de ${name}» con ${role} y el estado «${status}»`;
  await resetAlumno();
  const signed = await signInMobile(page, 'alumno01@sigpro.lab', credentialsOf('alumno01@sigpro.lab').password);
  if (signed !== undefined) return preparationFailedWeb(expected, `iniciar sesión como alumno01@sigpro.lab: ${signed}`);
  const entered = await openAdminFromMore(page);
  if (entered !== undefined) return preparationFailedWeb(expected, entered);
  if (!(await waitUsersReady(page))) return preparationFailedWeb(expected, 'la lista de tarjetas no asienta');
  const card = await waitUntil(() => isVisible(cardOf(page, id)));
  const named = await cardShowsName(page, id, name);
  const combo = await safe<number | undefined>(() => page.getByRole('combobox', { name: `Rol de ${name}`, exact: true }).count(), undefined);
  const roleShown = await comboLabel(page, id);
  const statusShown = await textOf(statusBadgeOf(page, id));
  return verdict([
    check(card.reached, `aparece la tarjeta de ${email}`, card.reached ? `aparece la tarjeta de ${email}` : `no aparece la tarjeta de ${email}`),
    check(named, `la tarjeta muestra el nombre ${name}`, named ? `la tarjeta muestra el nombre ${name}` : `la tarjeta no muestra el nombre ${name}`),
    check(combo !== undefined && combo > 0, `el selector se llama «Rol de ${name}»`, combo === undefined ? 'no se pudo leer el selector' : combo > 0 ? `el selector se llama «Rol de ${name}»` : `no hay selector «Rol de ${name}»`),
    check(roleShown === role, `el selector de rol muestra «${role}»`, `el selector de rol muestra «${roleShown ?? '(sin leer)'}»`),
    check(statusShown === status, `la insignia de estado muestra «${status}»`, `la insignia de estado muestra «${statusShown ?? '(sin texto)'}»`),
  ]);
};

// --- Esquema 2: la búsqueda filtra las tarjetas por nombre o correo ----------------------------------------------------------

const searchCards: BrowserRowHandler = async (row, { page }) => {
  const typed = strict('busqueda', SEARCH_TEXTS, cell(row, 'busqueda'));
  const count = quoted(cell(row, 'recuento'));
  const shown = strict('resultado', RESULT_CELLS, cell(row, 'resultado'));
  const expected = `«${count}»; ${cell(row, 'resultado')}`;
  await resetAlumno();
  const signed = await signInMobile(page, 'alumno01@sigpro.lab', credentialsOf('alumno01@sigpro.lab').password);
  if (signed !== undefined) return preparationFailedWeb(expected, `iniciar sesión como alumno01@sigpro.lab: ${signed}`);
  const entered = await openAdminFromMore(page);
  if (entered !== undefined) return preparationFailedWeb(expected, entered);
  if (!(await waitUsersReady(page))) return preparationFailedWeb(expected, 'la lista de tarjetas no asienta');
  await searchField(page).fill(typed, ACTION);
  const counted = await waitUntil(async () => (await textOf(page.getByTestId(ADMIN_TESTIDS.ADMIN_USERS_COUNT))) === count);
  const recount = await textOf(page.getByTestId(ADMIN_TESTIDS.ADMIN_USERS_COUNT));
  const fieldValue = await safe<string | undefined>(() => searchField(page).first().inputValue({ timeout: 1_000 }), undefined);
  const cards = await safe(() => cardsOf(page).count(), 0);
  const emptyText = await textOf(page.getByTestId(ADMIN_TESTIDS.ADMIN_USERS_EMPTY));
  const onlyShown = shown.kind === 'only' ? await isVisible(cardsOf(page).first().getByText(shown.email, { exact: true })) : false;
  const resultCheck =
    shown.kind === 'only'
      ? check(cards === 1 && onlyShown, `solo se ve la tarjeta de ${shown.email}`, `se ven ${cards} tarjetas${onlyShown ? `, con ${shown.email}` : ''}`)
      : check(cards === 0 && emptyText === 'Ningún usuario coincide con la búsqueda.', 'se ve el aviso «Ningún usuario coincide con la búsqueda.» y ninguna tarjeta', `tarjetas ${cards}; aviso «${emptyText ?? '(sin texto)'}»`);
  return verdict([
    check(counted.reached, `el recuento dice «${count}»`, `el recuento dice «${recount ?? '(sin texto)'}»`),
    check(fieldValue === typed, `el campo «Buscar usuarios» conserva ${JSON.stringify(typed)}`, `el campo «Buscar usuarios» tiene ${JSON.stringify(fieldValue ?? '(sin leer)')}`),
    resultCheck,
  ]);
};

// --- Esquema 3: si la lista no se puede cargar, el aviso ofrece reintentar ----------------------------------------------------

const listFails: BrowserRowHandler = async (row, { page }) => {
  const code = strict('codigo', new Map<string, number>([['500', 500]]), cell(row, 'codigo'));
  const expected = `aviso «No se pudieron cargar los usuarios» con la traza GET /api/admin/users → ${code} y «Reintentar»; al reintentar, siete tarjetas`;
  await resetAlumno();
  const signed = await signInMobile(page, 'alumno01@sigpro.lab', credentialsOf('alumno01@sigpro.lab').password);
  if (signed !== undefined) return preparationFailedWeb(expected, `iniciar sesión como alumno01@sigpro.lab: ${signed}`);
  // La prueba responde el código a cada GET de la lista mientras esté «fallando» (StrictMode pide la lista dos veces al montar)
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
  const entered = await openAdminFromMore(page);
  if (entered !== undefined) return preparationFailedWeb(expected, entered);
  const errorShown = await waitUntil(() => isVisible(page.getByTestId(ADMIN_TESTIDS.ADMIN_USERS_ERROR)));
  if (!errorShown.reached) return preparationFailedWeb(expected, 'el aviso de error no aparece tras la petición fallida');
  const lines = linesOf(await textOf(page.getByTestId(ADMIN_TESTIDS.ADMIN_USERS_ERROR)));
  const trace = lines.find((line) => line.startsWith('GET /api/admin/users'));
  const retryShown = await isVisible(page.getByTestId(ADMIN_TESTIDS.ADMIN_USERS_ERROR_RETRY));
  failing = false;
  const retried = await runSteps([['pulsar «Reintentar»', () => page.getByTestId(ADMIN_TESTIDS.ADMIN_USERS_ERROR_RETRY).click(ACTION)]]);
  const back = await waitUntil(async () => (await cardsOf(page).count()) === 7);
  const cards = await safe(() => cardsOf(page).count(), 0);
  return verdict(
    [
      check(lines[0] === 'No se pudieron cargar los usuarios', 'el aviso dice «No se pudieron cargar los usuarios»', `el aviso dice «${lines[0] ?? '(sin texto)'}»`),
      check(trace !== undefined && trace.startsWith(`GET /api/admin/users → ${code}`), `la traza es GET /api/admin/users → ${code}`, `la traza es «${trace ?? '(no aparece)'}»`),
      check(retryShown, 'el aviso tiene el botón «Reintentar»', `botón «Reintentar» visible=${String(retryShown)}`),
      check(retried === undefined && back.reached, 'al reintentar aparecen las siete tarjetas', retried ?? `aparecen ${cards} tarjetas`),
    ],
    `La prueba respondió ${code} a ${served} petición(es) de la lista antes de «Reintentar».`,
  );
};

// --- Esquema 4: mientras la lista carga, el recuento muestra puntos suspensivos -----------------------------------------------

const slowList: BrowserRowHandler = async (row, { page }) => {
  const delay = strict('espera', DELAYS, cell(row, 'espera'));
  const expected = `durante ${cell(row, 'espera')} el recuento muestra «…» y se ve el indicador de carga; al llegar, siete tarjetas`;
  await resetAlumno();
  const signed = await signInMobile(page, 'alumno01@sigpro.lab', credentialsOf('alumno01@sigpro.lab').password);
  if (signed !== undefined) return preparationFailedWeb(expected, `iniciar sesión como alumno01@sigpro.lab: ${signed}`);
  await page.route(
    (url) => isApiPath(url, '/admin/users'),
    async (route) => {
      if (route.request().method() !== 'GET') return route.continue();
      await sleep(delay);
      return route.continue();
    },
  );
  const entered = await openAdminFromMore(page);
  if (entered !== undefined) return preparationFailedWeb(expected, entered);
  let during = '(sin leer)';
  const loading = await waitUntil(async () => {
    const count = await textOf(page.getByTestId(ADMIN_TESTIDS.ADMIN_USERS_COUNT));
    const indicator = await isVisible(page.getByTestId(MOVIL_ADMIN_TESTIDS.USERS_LOADING));
    during = `recuento «${count ?? '(sin texto)'}», indicador de carga visible=${String(indicator)}`;
    return count === '…' && indicator;
  });
  const ready = await waitUsersReady(page);
  const cards = await safe(() => cardsOf(page).count(), 0);
  return verdict([
    check(loading.reached, 'durante la espera el recuento muestra «…» y se ve el indicador de carga', `durante la espera ${during}`),
    check(ready && cards === 7, 'al llegar la respuesta se ven las siete tarjetas', ready ? `se ven ${cards} tarjetas` : 'la lista no asienta tras la respuesta'),
  ]);
};

defineBrowserRows({
  story: 'US-ADMIN-USUARIOS-010',
  surface: 'expo-web',
  tenants: [TENANT_A],
  handlers: new Map<number, BrowserRowHandler>([
    [1, onMobile(cardShowsRoleAndStatus)],
    [2, onMobile(searchCards)],
    [3, onMobile(listFails)],
    [4, onMobile(slowList)],
  ]),
});
