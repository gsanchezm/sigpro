import type { Page } from '@playwright/test';
import { DEMO, TENANT_A, resetTenants, type Credentials } from '../../support/prepare';
import { defineBrowserRows, type BrowserRowHandler } from '../../support/rows';
import {
  REFERENCE_MS,
  REOPEN_APPROXIMATION,
  URL_APPROXIMATION,
  cell,
  check,
  conclude,
  goToProfile,
  landsOnLogin,
  loginFormEverSeen,
  mobileRow,
  onLoginForm,
  onPrograms,
  pathOf,
  recorderSeesForm,
  reachedAndHeld,
  requirePrepared,
  reopenApp,
  sessionStored,
  signInThroughApp,
  signOutFromProfile,
  slowNote,
  strict,
  waitUntil,
  withApproximation,
  yesNo,
  type Check,
} from './common';

// US-LOGIN-013 — [Móvil] Mantener la sesión al cerrar la app y cerrarla desde el perfil. La app móvil se ejecuta como web de
// Expo (390 × 844): NO es nativa. Preparación de cada fila: reinicio del tenant alumno01, la app sin sesión con alumno01 en
// «Tenant de trabajo» y la cuenta de la fila inicia sesión en la propia fila con el formulario de la app.

const ACCOUNTS: ReadonlyMap<string, Credentials> = new Map<string, Credentials>([
  [DEMO.gestor.email, DEMO.gestor],
  [DEMO.consultor.email, DEMO.consultor],
  [DEMO.auditor.email, DEMO.auditor],
]);

// ---------------------------------------------------------------------------------------------------------------------
// Esquema 1: la sesión sigue al cerrar la app y volver a abrirla
// ---------------------------------------------------------------------------------------------------------------------

const sessionSurvivesReopening = mobileRow(async (row, { page, context, snapshot }) => {
  await resetTenants([TENANT_A]);
  const account = strict('correo', ACCOUNTS, cell(row, 'correo'));
  const expected = 'cierra la app y la vuelve a abrir: ve /programs sin volver a iniciar sesión';
  // Haber iniciado sesión con el formulario de la app y estar en /programs es el «Dado» (preparación), igual que el control positivo
  // del registrador: en el documento de /login el formulario SÍ se pintó, así que la sonda tiene que haberlo visto
  const session = await signInThroughApp(page, account);
  const recorder = await recorderSeesForm(page);
  const premises = requirePrepared(row, [
    check(session.ok, `Antes: ${account.email} ha iniciado sesión en la app con alumno01 en «Tenant de trabajo» y está en /programs`, session.observed),
    check(recorder, 'Control: el registrador de «formulario pintado» vio el formulario al iniciar sesión', recorder ? 'lo vio' : 'no lo vio (la sonda está ciega)'),
  ]);
  const storedBefore = await sessionStored(page);
  // La app vuelve a abrirse por su ruta de arranque («/»): sin sesión llevaría a /login y con sesión a /programs. Fontanería: si falla, lanza.
  const reopened = await reopenApp(context, page, '/');
  const shown = await reachedAndHeld(() => onPrograms(reopened));
  const formSeen = await loginFormEverSeen(reopened);
  await snapshot(reopened);
  return withApproximation(
    conclude({
      checks: [
        ...premises,
        check(
          shown.reached && shown.held && !formSeen,
          expected,
          `la app reabierta está en ${pathOf(reopened)}${shown.reached ? ` (a los ${shown.elapsedMs} ms)` : ' (no llegó a /programs)'}; formulario de acceso pintado en algún momento: ${yesNo(formSeen)}`,
        ),
      ],
      notes: slowNote('llegar a /programs al reabrir', shown.elapsedMs, REFERENCE_MS.network),
      evidence: { elapsedMs: shown.elapsedMs, sessionStoredBeforeClosing: storedBefore ?? null, reopenedAt: '/ (ruta de arranque de la app)' },
    }),
    REOPEN_APPROXIMATION,
  );
});

// ---------------------------------------------------------------------------------------------------------------------
// Esquema 2: cerrar sesión descarta la sesión del dispositivo
// ---------------------------------------------------------------------------------------------------------------------

interface After {
  readonly expected: string;
  /** Lo que se hace y se observa tras llegar a /login; `approximation` si se apoya en el cierre y reapertura de la app. */
  readonly run: (page: Page, context: Parameters<typeof reopenApp>[0], snapshot: (target?: Page) => Promise<void>) => Promise<{ readonly check: Check; readonly approximation?: string; readonly evidence?: Readonly<Record<string, unknown>> }>;
}

const AFTER: ReadonlyMap<string, After> = new Map<string, After>([
  [
    'al abrir /programs, llega a /login',
    {
      expected: 'al abrir /programs, llega a /login',
      run: async (page, _context, snapshot) => {
        await snapshot();
        return { check: await landsOnLogin(page, '/programs'), approximation: URL_APPROXIMATION, evidence: { openedBy: 'dirección /programs (carga completa en Expo web)' } };
      },
    },
  ],
  [
    'al cerrar la app y volver a abrirla, ve /login',
    {
      expected: 'al cerrar la app y volver a abrirla, ve /login',
      run: async (page, context, snapshot) => {
        // Cerrar y volver a abrir la página es fontanería del arnés: si falla, lanza
        const reopened = await reopenApp(context, page, '/');
        const shown = await waitUntil(() => onLoginForm(reopened));
        const stays = shown.reached ? await reachedAndHeld(() => onLoginForm(reopened)) : { held: false };
        await snapshot(reopened);
        return {
          check: check(shown.reached && stays.held, 'al cerrar la app y volver a abrirla, ve /login', `la app reabierta está en ${pathOf(reopened)}, título «Iniciar sesión» visible: ${yesNo(shown.reached)}${shown.reached ? ` (a los ${shown.elapsedMs} ms)` : ''}`),
          approximation: REOPEN_APPROXIMATION,
          evidence: { elapsedMs: shown.elapsedMs, sessionStoredAfterReopening: (await sessionStored(reopened)) ?? null, reopenedAt: '/ (ruta de arranque de la app)' },
        };
      },
    },
  ],
  [
    'al abrir /nc, llega a /login',
    {
      expected: 'al abrir /nc, llega a /login',
      run: async (page, _context, snapshot) => {
        await snapshot();
        return { check: await landsOnLogin(page, '/nc'), approximation: URL_APPROXIMATION, evidence: { openedBy: 'dirección /nc (carga completa en Expo web)' } };
      },
    },
  ],
]);

const signOutDiscardsSession = mobileRow(async (row, { page, context, snapshot }) => {
  await resetTenants([TENANT_A]);
  const account = strict('correo', ACCOUNTS, cell(row, 'correo'));
  const after = strict('despues', AFTER, cell(row, 'despues'));
  // Haber iniciado sesión con el formulario de la app y estar en la página «Perfil» es el «Dado» (preparación)
  const session = await signInThroughApp(page, account);
  const signedIn = check(session.ok, `Antes: ${account.email} ha iniciado sesión en la app con alumno01 en «Tenant de trabajo»`, session.observed);
  const toProfile = session.ok ? await goToProfile(page) : 'no se abrió «Perfil»: no hubo sesión';
  const inProfile = check(toProfile === undefined, 'Antes: está en la página «Perfil»', toProfile ?? `en /profile (ruta ${pathOf(page)})`);
  requirePrepared(row, [signedIn, inProfile]);
  const storedBefore = await sessionStored(page);
  const out = await signOutFromProfile(page);
  const arrived = out === undefined ? await waitUntil(() => onLoginForm(page)) : { reached: false, elapsedMs: 0 };
  const onLogin = check(out === undefined && arrived.reached, 'llega a /login', out ?? `ruta ${pathOf(page)}, título «Iniciar sesión» visible: ${yesNo(arrived.reached)}`);
  const storedAfter = await sessionStored(page);
  if (!onLogin.ok) return conclude({ checks: [signedIn, inProfile, onLogin, check(false, after.expected, 'no se llegó a /login')] });
  const followed = await after.run(page, context, snapshot);
  const concluded = conclude({
    checks: [signedIn, inProfile, onLogin, followed.check],
    notes: slowNote('llegar a /login', arrived.elapsedMs, REFERENCE_MS.network),
    evidence: { elapsedMs: arrived.elapsedMs, sessionStoredBeforeSigningOut: storedBefore ?? null, sessionStoredAfterSigningOut: storedAfter ?? null, ...followed.evidence },
  });
  return followed.approximation === undefined ? concluded : withApproximation(concluded, followed.approximation);
});

defineBrowserRows({
  story: 'US-LOGIN-013',
  surface: 'expo-web',
  tenants: [TENANT_A],
  handlers: new Map<number, BrowserRowHandler>([
    [1, sessionSurvivesReopening],
    [2, signOutDiscardsSession],
  ]),
});
