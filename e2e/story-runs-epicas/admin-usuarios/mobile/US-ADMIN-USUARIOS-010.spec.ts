import type { Page } from '@playwright/test';
import { ADMIN_TESTIDS, MOVIL_ADMIN_TESTIDS } from '../../../../packages/shared/src/testids';
import { TENANT_A } from '../../../story-runs/support/prepare';
import { ACTION, attrOf, isVisible, linesOf, quoted, runSteps, safe, textOf, valueOf, waitUntil } from '../../support/browser';
import { cell, check, preparationFailedWeb, sleep, strict } from '../../support/checks';
import { defineBrowserRows, type BrowserRowHandler } from '../../core/framework';
import { SEED_ID } from '../api/common';
import { corsFor, credentialsOf, errorBody, isApiPath, resetAlumno } from '../web/common';
import { cardOf, cardShowsName, cardsOf, comboLabel, onMobile, openAdminFromMore, signInMobile, statusBadgeOf, verdict, waitUsersReady } from './common';

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

/** Nota y texto de ayuda que la historia pone encima de la lista (los fija la historia). */
const NOTE = 'No puedes desactivarte ni cambiar tu propio rol, y siempre debe quedar al menos un admin activo.';
const PLACEHOLDER = 'Nombre o correo…';
/** Orden de las tarjetas: el de la lista de la API (cuenta más antigua primero, u1…u7 en el seed). */
const SEED_ORDER = ['u1', 'u2', 'u3', 'u4', 'u5', 'u6', 'u7'].map((id) => `admin-user-row-${id}`).join(',');

/** Campo «Buscar usuarios» de la app móvil (su nombre accesible o su testid). */
const searchField = (page: Page) => page.getByRole('textbox', { name: 'Buscar usuarios', exact: true }).or(page.getByTestId(ADMIN_TESTIDS.ADMIN_USERS_SEARCH));

/** Testids de las tarjetas en su orden en el DOM. */
const cardOrder = (page: Page): Promise<string> => safe(() => cardsOf(page).evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-testid') ?? '').join(',')), '');

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
  // Reglas de la lista que la fila da por hechas: orden de la API, texto de ayuda y nota
  const order = await cardOrder(page);
  const placeholder = await attrOf(searchField(page), 'placeholder');
  const note = await textOf(page.getByTestId(ADMIN_TESTIDS.ADMIN_USERS_NOTE));
  return verdict([
    check(card.reached, `aparece la tarjeta de ${email}`, card.reached ? `aparece la tarjeta de ${email}` : `no aparece la tarjeta de ${email}`),
    check(named, `la tarjeta muestra el nombre ${name}`, named ? `la tarjeta muestra el nombre ${name}` : `la tarjeta no muestra el nombre ${name}`),
    check(combo !== undefined && combo > 0, `el selector se llama «Rol de ${name}»`, combo === undefined ? 'no se pudo leer el selector' : combo > 0 ? `el selector se llama «Rol de ${name}»` : `no hay selector «Rol de ${name}»`),
    check(roleShown === role, `el selector de rol muestra «${role}»`, `el selector de rol muestra «${roleShown ?? '(sin leer)'}»`),
    check(statusShown === status, `la insignia de estado muestra «${status}»`, `la insignia de estado muestra «${statusShown ?? '(sin texto)'}»`),
    check(order === SEED_ORDER, 'las tarjetas salen en el orden de la lista de la API (u1…u7)', `orden de las tarjetas: ${order || '(ninguna)'}`),
    check(note === NOTE && placeholder === PLACEHOLDER, 'la lista muestra el campo «Nombre o correo…» y la nota', `ayuda «${placeholder ?? '(sin leer)'}»; nota «${note ?? '(sin texto)'}»`),
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
  const cards = await safe(() => cardsOf(page).count(), 0);
  const emptyText = await textOf(page.getByTestId(ADMIN_TESTIDS.ADMIN_USERS_EMPTY));
  const onlyShown = shown.kind === 'only' ? await isVisible(cardsOf(page).first().getByText(shown.email, { exact: true })) : false;
  const resultCheck =
    shown.kind === 'only'
      ? check(cards === 1 && onlyShown, `solo se ve la tarjeta de ${shown.email}`, `se ven ${cards} tarjetas${onlyShown ? `, con ${shown.email}` : ''}`)
      : check(cards === 0 && emptyText === 'Ningún usuario coincide con la búsqueda.', 'se ve el aviso «Ningún usuario coincide con la búsqueda.» y ninguna tarjeta', `tarjetas ${cards}; aviso «${emptyText ?? '(sin texto)'}»`);
  // El valor que queda en el campo no lo fija la historia: se anota como evidencia
  const fieldValue = await valueOf(searchField(page).first());
  return verdict(
    [
      check(counted.reached, `el recuento dice «${count}»`, `el recuento dice «${recount ?? '(sin texto)'}»`),
      resultCheck,
    ],
    undefined,
    { valorDelCampoTrasEscribir: fieldValue ?? '(sin leer)', escrito: typed },
  );
};

// --- Esquema 3: si la lista no se puede cargar, el aviso ofrece reintentar ----------------------------------------------------

const listFails: BrowserRowHandler = async (row, { page }) => {
  const code = strict('codigo', new Map<string, number>([['500', 500]]), cell(row, 'codigo'));
  const expected = 'aviso «No se pudieron cargar los usuarios» con la traza del error y «Reintentar»; al reintentar, siete tarjetas';
  await resetAlumno();
  const signed = await signInMobile(page, 'alumno01@sigpro.lab', credentialsOf('alumno01@sigpro.lab').password);
  if (signed !== undefined) return preparationFailedWeb(expected, `iniciar sesión como alumno01@sigpro.lab: ${signed}`);
  // Se responde el código a la PRIMERA petición GET de la lista (precondición de la historia). Las siguientes pasan y se cuentan.
  let answered = 0;
  let passed = 0;
  await page.route(
    (url) => isApiPath(url, '/admin/users'),
    (route) => {
      if (route.request().method() !== 'GET') return route.continue();
      if (answered === 0) {
        answered += 1;
        return route.fulfill({ status: code, contentType: 'application/json', headers: corsFor(route), body: errorBody(code, 'internal_error') });
      }
      passed += 1;
      return route.continue();
    },
  );
  const entered = await openAdminFromMore(page);
  if (entered !== undefined) return preparationFailedWeb(expected, entered);
  const errorShown = await waitUntil(() => isVisible(page.getByTestId(ADMIN_TESTIDS.ADMIN_USERS_ERROR)));
  if (!errorShown.reached) return preparationFailedWeb(expected, 'el aviso de error no aparece tras la petición fallida');
  const lines = linesOf(await textOf(page.getByTestId(ADMIN_TESTIDS.ADMIN_USERS_ERROR)));
  const trace = lines.find((line) => line.startsWith('GET /api/admin/users'));
  const passedBeforeRetry = passed;
  const retryShown = await isVisible(page.getByTestId(ADMIN_TESTIDS.ADMIN_USERS_ERROR_RETRY));
  const retried = await runSteps([['pulsar «Reintentar»', () => page.getByTestId(ADMIN_TESTIDS.ADMIN_USERS_ERROR_RETRY).click(ACTION)]]);
  const back = await waitUntil(async () => (await cardsOf(page).count()) === 7);
  const cards = await safe(() => cardsOf(page).count(), 0);
  const note =
    passedBeforeRetry > 0
      ? `La app pidió la lista ${passedBeforeRetry + 1} veces antes de «Reintentar» (StrictMode en desarrollo); la prueba falló solo la primera y la fila lo anota.`
      : undefined;
  return verdict(
    [
      check(lines[0] === 'No se pudieron cargar los usuarios', 'el aviso dice «No se pudieron cargar los usuarios»', `el aviso dice «${lines[0] ?? '(sin texto)'}»`),
      check(trace !== undefined, 'el aviso muestra la traza del error', `traza visible: «${trace ?? '(ninguna)'}»`),
      check(retryShown, 'el aviso tiene el botón «Reintentar»', `botón «Reintentar» visible=${String(retryShown)}`),
      check(retried === undefined && back.reached, 'al reintentar aparecen las siete tarjetas', retried ?? `aparecen ${cards} tarjetas`),
    ],
    note,
    { trazaMedida: trace ?? '(no aparece)', codigoInterceptado: code, peticionesGETFalladas: answered, peticionesGETDejadasPasar: passed },
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
