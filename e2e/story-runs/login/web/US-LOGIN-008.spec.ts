import type { BrowserContext, Page } from '@playwright/test';
import { DEMO, TENANT_A, WRONG_PASSWORD, resetTenants, type Credentials } from '../../support/prepare';
import { defineBrowserRows, type BrowserRowHandler } from '../../support/rows';
import {
  ACTION,
  CEILING_MS,
  HOLD_MS,
  LOGIN_URL,
  REFERENCE_MS,
  SIGNED_OUT_MESSAGE,
  awaitLoginResult,
  browserRow,
  cell,
  check,
  conclude,
  describeResult,
  detailEvidence,
  fillCredentials,
  holdsFor,
  isVisible,
  loginFormEverSeen,
  loginHeading,
  messageMatches,
  onLoginForm,
  onPrograms,
  openLogin,
  optionNamed,
  pathOf,
  pressEnter,
  runSteps,
  safe,
  signInThroughForm,
  signOutFromUserMenu,
  signedOutNotice,
  slowNote,
  strict,
  waitUntil,
  type Check,
  type LoginResult,
} from './common';

// US-LOGIN-008 — Mantener la sesión en el navegador y cerrarla con el aviso de sesión cerrada. Preparación de cada fila:
// reinicio del tenant alumno01, /login?tenant=alumno01 en una sola pestaña sin sesión y, después, la cuenta de la fila inicia
// sesión en la propia fila, con el formulario y su contraseña de demostración.

const WRONG_NOTICE = 'Correo o contraseña incorrectos';

const ACCOUNTS: ReadonlyMap<string, Credentials> = new Map<string, Credentials>([
  [DEMO.gestor.email, DEMO.gestor],
  [DEMO.consultor.email, DEMO.consultor],
  [DEMO.auditor.email, DEMO.auditor],
]);

const yesNo = (value: boolean): string => (value ? 'sí' : 'no');

/** «Ve /programs sin volver a iniciar sesión»: llega a /programs, se queda y el formulario de acceso no llegó a pintarse. */
const programsWithoutLogin = async (target: Page): Promise<{ readonly ok: boolean; readonly observed: string; readonly elapsedMs: number }> => {
  const arrived = await waitUntil(() => onPrograms(target));
  const stays = await holdsFor(() => onPrograms(target));
  const formSeen = await loginFormEverSeen(target);
  return {
    ok: arrived.reached && stays.held && !formSeen,
    observed: `ruta ${pathOf(target)}${arrived.reached ? ` (a los ${arrived.elapsedMs} ms)` : ' (no llegó a /programs)'}${stays.held ? '' : `; salió de /programs a los ${stays.brokeAtMs ?? '?'} ms`}; formulario de acceso pintado en algún momento: ${yesNo(formSeen)}`,
    elapsedMs: arrived.elapsedMs,
  };
};

// ---------------------------------------------------------------------------------------------------------------------
// Esquema 1: la casilla decide dónde sigue valiendo la sesión
// ---------------------------------------------------------------------------------------------------------------------

const BOX: ReadonlyMap<string, boolean> = new Map<string, boolean>([
  ['marcada', true],
  ['desmarcada', false],
]);

interface Moved {
  /** Pantalla en la que se mira el resultado. */
  readonly target: Page;
  readonly failure?: string;
  readonly evidence?: Readonly<Record<string, unknown>>;
}

interface Fixtures {
  readonly page: Page;
  readonly context: BrowserContext;
}

const ACTIONS: ReadonlyMap<string, (fixtures: Fixtures) => Promise<Moved>> = new Map<string, (fixtures: Fixtures) => Promise<Moved>>([
  ['recarga /programs', async ({ page }) => ({ target: page, failure: await runSteps([['recargar /programs', () => page.reload({ timeout: CEILING_MS })]]) })],
  [
    'escribe la dirección de /programs en una pestaña nueva del mismo navegador',
    async ({ page, context }) => {
      const opened: { tab?: Page } = {};
      const failure = await runSteps([
        ['abrir una pestaña nueva del mismo navegador', async () => void (opened.tab = await context.newPage())],
        ['escribir la dirección /programs', () => (opened.tab ?? page).goto('/programs', { timeout: CEILING_MS })],
      ]);
      return { target: opened.tab ?? page, ...(failure === undefined ? {} : { failure }) };
    },
  ],
  [
    'abre /profile en la misma pestaña y después vuelve a /programs',
    async ({ page }) => {
      // «Vuelve a /programs» se interpreta como escribir la dirección: la historia no dice si es el botón atrás o la dirección
      const toProfile = await runSteps([['abrir /profile en la misma pestaña', () => page.goto('/profile', { timeout: CEILING_MS })]]);
      const inProfile = await waitUntil(async () => pathOf(page) === '/profile' && (await isVisible(page.getByRole('heading', { level: 1 }))));
      const failure = toProfile ?? (await runSteps([['volver a /programs', () => page.goto('/programs', { timeout: CEILING_MS })]]));
      return { target: page, ...(failure === undefined ? {} : { failure }), evidence: { profileReached: inProfile.reached } };
    },
  ],
]);

const RESULTS: ReadonlyMap<string, (target: Page) => Promise<{ readonly ok: boolean; readonly observed: string; readonly elapsedMs: number }>> = new Map([
  ['ve /programs sin volver a iniciar sesión', programsWithoutLogin],
  ['ve /programs sin iniciar sesión', programsWithoutLogin],
  [
    'llega a /login y tiene que iniciar sesión',
    async (target: Page) => {
      const arrived = await waitUntil(() => onLoginForm(target));
      const stays = await holdsFor(() => onLoginForm(target));
      return { ok: arrived.reached && stays.held, observed: `ruta ${pathOf(target)}, formulario «Iniciar sesión» visible: ${yesNo(await onLoginForm(target))}${arrived.reached ? ` (a los ${arrived.elapsedMs} ms)` : ''}`, elapsedMs: arrived.elapsedMs };
    },
  ],
]);

const boxDecidesScope = browserRow(async (row, { page, context, snapshot }) => {
  await resetTenants([TENANT_A]);
  const remember = strict('casilla', BOX, cell(row, 'casilla'));
  const act = strict('accion', ACTIONS, cell(row, 'accion'));
  const read = strict('resultado', RESULTS, cell(row, 'resultado'));
  const expected = `${cell(row, 'accion')}: ${cell(row, 'resultado')}`;
  const session = await signInThroughForm(page, DEMO.gestor, remember);
  const before = check(session.ok, `Antes: gestor@sigpro.test ha iniciado sesión con la casilla «Mantener la sesión en este equipo» ${cell(row, 'casilla')} y está en /programs`, session.observed);
  if (!session.ok) return conclude({ checks: [before, check(false, expected, 'no se llegó a la acción: no se cumple lo que la historia da por hecho')] });
  const moved = await act({ page, context });
  if (moved.failure) return conclude({ checks: [before, check(false, expected, moved.failure)] });
  const reading = await read(moved.target);
  await snapshot(moved.target);
  return conclude({
    checks: [before, check(reading.ok, expected, reading.observed)],
    notes: slowNote('la pantalla final', reading.elapsedMs, REFERENCE_MS.network),
    evidence: { elapsedMs: reading.elapsedMs, rememberBox: cell(row, 'casilla'), ...moved.evidence },
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// Esquema 2: cerrar sesión desde cada punto lleva al acceso con el aviso
// ---------------------------------------------------------------------------------------------------------------------

const WIDTHS: ReadonlyMap<string, { readonly width: number; readonly height: number }> = new Map([
  ['1440 px', { width: 1440, height: 900 }],
  ['390 px', { width: 390, height: 844 }],
]);

/** Cómo se llega a la pantalla de la celda `pantalla` desde /programs (donde deja la sesión el formulario). */
const SCREENS: ReadonlyMap<string, (page: Page) => Promise<string | undefined>> = new Map<string, (page: Page) => Promise<string | undefined>>([
  ['/programs', async () => undefined],
  [
    '/profile',
    async (page) =>
      (await runSteps([
        ['abrir el «Menú de usuario»', () => page.getByRole('button', { name: 'Menú de usuario', exact: true }).click(ACTION)],
        ['pulsar «Perfil»', () => page.getByRole('menuitem', { name: 'Perfil', exact: true }).click(ACTION)],
      ])) ?? ((await waitUntil(async () => pathOf(page) === '/profile')).reached ? undefined : `no llegó a /profile (ruta ${pathOf(page)})`),
  ],
]);

/** Dónde se pulsa «Cerrar sesión». */
const PLACES: ReadonlyMap<string, (page: Page) => Promise<string | undefined>> = new Map<string, (page: Page) => Promise<string | undefined>>([
  ['el «Menú de usuario» de la cabecera', signOutFromUserMenu],
  [
    'el menú de navegación',
    (page) =>
      runSteps([
        ['abrir el menú de navegación', () => page.getByRole('button', { name: 'Menú', exact: true }).click(ACTION)],
        ['pulsar «Cerrar sesión»', () => page.getByRole('button', { name: 'Cerrar sesión', exact: true }).click(ACTION)],
      ]),
  ],
  ['la página «Perfil»', (page) => runSteps([['pulsar «Cerrar sesión» en la página «Perfil»', () => page.getByRole('button', { name: 'Cerrar sesión', exact: true }).click(ACTION)]])],
]);

/** Abrir /programs en `target` acaba en /login (y se queda ahí). */
const programsLandsOnLogin = async (target: Page, where: string): Promise<Check> => {
  await safe(() => target.goto('/programs', { timeout: CEILING_MS }), undefined);
  await waitUntil(async () => (await onLoginForm(target)) || (await onPrograms(target)));
  const stays = await holdsFor(() => onLoginForm(target));
  return check(stays.held, `al abrir /programs ${where}, llega a /login`, stays.held ? `ruta /login, formulario «Iniciar sesión» visible` : `ruta ${pathOf(target)}`);
};

const signOutFromWhere = browserRow(async (row, { page, context, snapshot }) => {
  await resetTenants([TENANT_A]);
  const account = strict('correo', ACCOUNTS, cell(row, 'correo'));
  const size = strict('ancho', WIDTHS, cell(row, 'ancho'));
  const goToScreen = strict('pantalla', SCREENS, cell(row, 'pantalla'));
  const press = strict('lugar', PLACES, cell(row, 'lugar'));
  const where = cell(row, 'lugar');
  const expected = `pulsa «Cerrar sesión» en ${where}`;
  await page.setViewportSize(size);
  const session = await signInThroughForm(page, account);
  const moved = session.ok ? await goToScreen(page) : undefined;
  const before = check(session.ok && moved === undefined, `Antes: ${account.email} ha iniciado sesión con la casilla marcada y está en ${cell(row, 'pantalla')} con una ventana de ${cell(row, 'ancho')}`, session.ok ? (moved ?? `en ${cell(row, 'pantalla')} (ruta ${pathOf(page)})`) : session.observed);
  if (!before.ok) return conclude({ checks: [before, check(false, expected, 'no se llegó a pulsar: no se cumple lo que la historia da por hecho')] });
  const failure = await press(page);
  if (failure) return conclude({ checks: [before, check(false, expected, failure)] });

  const onLogin = await waitUntil(() => onLoginForm(page));
  const notice = await waitUntil(() => isVisible(signedOutNotice(page)));
  await snapshot();
  const sameTab = await programsLandsOnLogin(page, 'en esa pestaña');
  const opened: { tab?: Page } = {};
  const newTabFailure = await runSteps([['abrir una pestaña nueva', async () => void (opened.tab = await context.newPage())]]);
  const newTab = newTabFailure ? check(false, 'al abrir /programs en una nueva, llega a /login', newTabFailure) : await programsLandsOnLogin(opened.tab ?? page, 'en una nueva');
  return conclude({
    checks: [
      before,
      check(onLogin.reached, 'llega a /login', `ruta ${onLogin.reached ? '/login' : pathOf(page)}, formulario «Iniciar sesión» visible: ${yesNo(onLogin.reached)}`),
      check(notice.reached, `ve el aviso «${SIGNED_OUT_MESSAGE}»`, notice.reached ? `aviso «${SIGNED_OUT_MESSAGE}» visible (${notice.elapsedMs} ms)` : `no se vio el aviso en ${CEILING_MS} ms`),
      sameTab,
      newTab,
    ],
    notes: [...slowNote('llegar a /login', onLogin.elapsedMs, REFERENCE_MS.network), ...slowNote('el aviso de sesión cerrada', notice.elapsedMs, REFERENCE_MS.network)],
    evidence: { elapsedMs: onLogin.elapsedMs, viewport: size },
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// Esquema 3: el aviso de sesión cerrada solo acompaña al cierre de sesión
// ---------------------------------------------------------------------------------------------------------------------

/** Inicia sesión con gestor@sigpro.test en alumno01 y pulsa «Cerrar sesión» (como en la situación de la historia). */
const justSignedOut = async (page: Page): Promise<Check> => {
  const session = await signInThroughForm(page, DEMO.gestor);
  const failure = session.ok ? await signOutFromUserMenu(page) : undefined;
  const out = session.ok && failure === undefined ? await waitUntil(() => onLoginForm(page)) : { reached: false, elapsedMs: 0 };
  return check(out.reached, 'Antes: gestor@sigpro.test ha iniciado sesión en alumno01 y acaba de pulsar «Cerrar sesión»', session.ok ? (failure ?? `en /login (ruta ${pathOf(page)})`) : session.observed);
};

const SITUATIONS: ReadonlyMap<string, (page: Page) => Promise<readonly Check[]>> = new Map<string, (page: Page) => Promise<readonly Check[]>>([
  ['gestor@sigpro.test ha iniciado sesión en alumno01 y acaba de pulsar «Cerrar sesión»', async (page) => [await justSignedOut(page)]],
  ['nadie ha iniciado sesión', async () => []],
]);

interface Done {
  readonly failure?: string;
  readonly login?: LoginResult;
}

const ACTIONS_3: ReadonlyMap<string, (page: Page) => Promise<Done>> = new Map<string, (page: Page) => Promise<Done>>([
  ['mira /login', async () => ({})],
  [
    'escribe el correo gestor@sigpro.test y la contraseña incorrecta y pulsa «Entrar»',
    async (page) => {
      const failure = (await fillCredentials(page, DEMO.gestor.email, WRONG_PASSWORD)) ?? (await pressEnter(page));
      return failure ? { failure } : { login: await awaitLoginResult(page) };
    },
  ],
  [
    'pulsa «¿Olvidaste la contraseña?» y vuelve con «Volver al inicio de sesión»',
    async (page) => {
      const failure = await runSteps([
        ['pulsar «¿Olvidaste la contraseña?»', () => optionNamed(page, '¿Olvidaste la contraseña?').click(ACTION)],
        ['ver «Recuperar contraseña»', () => page.getByRole('heading', { name: 'Recuperar contraseña', exact: true }).waitFor({ timeout: CEILING_MS })],
        ['pulsar «Volver al inicio de sesión»', () => optionNamed(page, 'Volver al inicio de sesión').click(ACTION)],
      ]);
      return failure ? { failure } : {};
    },
  ],
  [
    'abre /login?tenant=alumno01',
    async (page) => {
      const failure = await openLogin(page, LOGIN_URL);
      return failure ? { failure } : {};
    },
  ],
]);

/** El aviso de sesión cerrada, ¿sigue ausente durante un tiempo? («ya no ve» se observa 2 s, no se muestrea una vez.) */
const noticeStaysAway = async (page: Page): Promise<Check> => {
  const away = await holdsFor(async () => !(await isVisible(signedOutNotice(page))));
  return check(away.held, `ya no ve «${SIGNED_OUT_MESSAGE}»`, away.held ? `el aviso de sesión cerrada no está (observado ${HOLD_MS / 1000} s)` : 'el aviso de sesión cerrada sigue visible');
};

/** Lo que se lee tras la acción: las comprobaciones y el tiempo que tardó en llegarse al estado de la historia. */
interface Reading {
  readonly checks: readonly Check[];
  readonly elapsedMs: number;
}

const NOTICES: ReadonlyMap<string, (page: Page, done: Done) => Promise<Reading>> = new Map<string, (page: Page, done: Done) => Promise<Reading>>([
  [
    've «Sesión cerrada correctamente.»',
    async (page) => {
      const shown = await waitUntil(() => isVisible(signedOutNotice(page)));
      return { checks: [check(shown.reached, `ve «${SIGNED_OUT_MESSAGE}»`, shown.reached ? `aviso visible (${shown.elapsedMs} ms)` : `no se vio el aviso en ${CEILING_MS} ms`)], elapsedMs: shown.elapsedMs };
    },
  ],
  [
    'ya no ve «Sesión cerrada correctamente.» y ve «Correo o contraseña incorrectos»',
    async (page, done) => ({
      checks: [await noticeStaysAway(page), check(done.login !== undefined && messageMatches(WRONG_NOTICE, done.login), `ve «${WRONG_NOTICE}»`, done.login ? describeResult(done.login, page) : 'no se envió el formulario')],
      elapsedMs: done.login?.elapsedMs ?? 0,
    }),
  ],
  [
    'está de vuelta en /login y ya no ve «Sesión cerrada correctamente.»',
    async (page) => {
      const back = await waitUntil(() => onLoginForm(page));
      return { checks: [check(back.reached, 'está de vuelta en /login', `ruta ${pathOf(page)}, formulario «Iniciar sesión» visible: ${yesNo(back.reached)}`), await noticeStaysAway(page)], elapsedMs: back.elapsedMs };
    },
  ],
  [
    've el formulario «Iniciar sesión» y no ve «Sesión cerrada correctamente.»',
    async (page) => {
      const shown = await waitUntil(() => isVisible(loginHeading(page)));
      return { checks: [check(shown.reached, 've el formulario «Iniciar sesión»', `formulario «Iniciar sesión» visible: ${yesNo(shown.reached)}`), await noticeStaysAway(page)], elapsedMs: shown.elapsedMs };
    },
  ],
]);

const noticeOnlyAfterSignOut = browserRow(async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const prepare = strict('situacion', SITUATIONS, cell(row, 'situacion'));
  const act = strict('accion', ACTIONS_3, cell(row, 'accion'));
  const readNotice = strict('aviso', NOTICES, cell(row, 'aviso'));
  const expected = `${cell(row, 'accion')}: ${cell(row, 'aviso')}`;
  const before = await prepare(page);
  if (before.some((item) => !item.ok)) return conclude({ checks: [...before, check(false, expected, 'no se llegó a la acción: no se cumple lo que la historia da por hecho')] });
  // «Nadie ha iniciado sesión» no tiene pantalla previa: la acción abre /login por sí misma o parte de una página en blanco
  const done = await act(page);
  if (done.failure) return conclude({ checks: [...before, check(false, expected, done.failure)] });
  const reading = await readNotice(page, done);
  return conclude({
    checks: [...before, ...reading.checks],
    notes: slowNote('llegar al estado final', reading.elapsedMs, REFERENCE_MS.network),
    evidence: { elapsedMs: reading.elapsedMs, ...detailEvidence(done.login?.detail) },
  });
});

defineBrowserRows({
  story: 'US-LOGIN-008',
  surface: 'web',
  tenants: [TENANT_A],
  handlers: new Map<number, BrowserRowHandler>([
    [1, boxDecidesScope],
    [2, signOutFromWhere],
    [3, noticeOnlyAfterSignOut],
  ]),
});
