import type { Locator, Page } from '@playwright/test';
import { uniqueEmail } from '../../support/api';
import { TENANT_A, failedLogins, resetTenants, setAccountActive } from '../../support/prepare';
import { defineBrowserRows, type BrowserRowHandler, type ManifestRow } from '../../support/rows';
import {
  ACTION,
  CEILING_MS,
  EMAIL_TRIM_APPROXIMATION,
  EMAIL_TRIM_NOTE,
  HOLD_MS,
  KEYBOARD_APPROXIMATION,
  REFERENCE_MS,
  accountIs,
  attrOf,
  awaitLoginResult,
  cell,
  check,
  conclude,
  describeResult,
  detailEvidence,
  emailField,
  emailOf,
  enterButton,
  fillCredentials,
  fromSteps,
  hasNoSession,
  holdsFor,
  isEnabled,
  lengthOf,
  messageMatches,
  mobileRow,
  onLoginForm,
  openLoginWithTenant,
  passwordField,
  passwordOf,
  pathOf,
  pressEnter,
  pressSubmitKey,
  quoted,
  requestAccountThroughApp,
  runSteps,
  seen,
  serverAlert,
  alertMessage,
  slowNote,
  sleep,
  strict,
  valueOf,
  waitUntil,
  withApproximation,
  type Check,
  type LoginResult,
} from './common';

// US-LOGIN-012 — [Móvil] Iniciar sesión: entrar en Programas o ver por qué no se puede. La app móvil se ejecuta como web de
// Expo (390 × 844): NO es nativa. Preparación de cada fila: reinicio del tenant alumno01 y /login sin sesión con alumno01 en
// «Tenant de trabajo»; los fallos previos y la desactivación de cuentas se provocan por HTTP después del reinicio (como permite
// la historia, con la cabecera x-tenant: alumno01) y la cuenta recién solicitada se pide con «Solicitar acceso» de la app.

const PROGRAMS = 'llega a /programs';
const WRONG_NOTICE = 'Correo o contraseña incorrectos';
const LOCKED_MESSAGE = 'Cuenta bloqueada tras varios intentos fallidos. Contacta con un administrador.';

/** Lo que se hace tras ver el resultado de un envío. */
interface Aftermath {
  /** «Y sigue en /login sin sesión»; con el correo y la contraseña escritos, que son datos aparte (Reglas) y no deciden el veredicto. */
  readonly staysOnLogin?: { readonly email?: string; readonly password?: string };
}

interface Observed {
  readonly checks: readonly Check[];
  readonly notes: readonly string[];
  readonly evidence: Readonly<Record<string, unknown>>;
  readonly result: LoginResult;
}

/** «Pulsa «Entrar»» ya hecho: espera el resultado y comprueba el mensaje y lo que la historia dice que ocurre después. */
const observeSubmission = async (page: Page, expected: { readonly text: string; readonly wording: string; readonly programs?: boolean }, aftermath: Aftermath, snapshot: () => Promise<void>): Promise<Observed> => {
  const result = await awaitLoginResult(page);
  const matched = expected.programs === true ? result.kind === 'programs' : messageMatches(expected.text, result);
  const checks: Check[] = [check(matched, expected.wording, describeResult(result, page))];
  const notes: string[] = [...slowNote('el resultado del envío', result.elapsedMs, REFERENCE_MS.network)];
  const evidence: Record<string, unknown> = { elapsedMs: result.elapsedMs, ...detailEvidence(result.detail) };

  if (expected.programs === true && result.kind === 'programs') {
    const stays = await holdsFor(async () => pathOf(page) === '/programs');
    checks.push(check(stays.held, 'se queda en /programs', stays.held ? `ruta ${pathOf(page)} (a los ${result.elapsedMs} ms; observado 2 s)` : `salió de /programs a los ${stays.brokeAtMs ?? '?'} ms (ruta ${pathOf(page)})`));
  }
  if (aftermath.staysOnLogin) {
    const stays = await holdsFor(() => onLoginForm(page));
    const email = await valueOf(emailField(page));
    const password = await valueOf(passwordField(page));
    checks.push(check(stays.held, 'sigue en /login', stays.held ? 'sigue en /login (observado 2 s)' : `ruta ${pathOf(page)}${stays.brokeAtMs === undefined ? '' : ` a los ${stays.brokeAtMs} ms`}`));
    // Las Reglas dicen que se sigue «con el correo y la contraseña escritos»: dato aparte, no un paso de la fila
    const wantedEmail = aftermath.staysOnLogin.email;
    if (wantedEmail !== undefined) {
      const kept = email === wantedEmail;
      evidence.emailRetained = `${kept ? 'sí' : 'no'} (${lengthOf(email)})`;
      if (!kept) notes.push('la regla dice que el formulario conserva el correo escrito y el campo no lo conserva');
    }
    if (aftermath.staysOnLogin.password !== undefined) {
      const kept = password === aftermath.staysOnLogin.password;
      evidence.passwordRetained = `${kept ? 'sí' : 'no'} (${lengthOf(password)})`;
      if (!kept) notes.push('la regla dice que el formulario conserva la contraseña escrita y el campo no la conserva');
    }
    await snapshot();
    // «Sin sesión», por comportamiento y al final: abrir /programs en esta página acaba en /login
    checks.push({ ...(await hasNoSession(page)), expected: 'sin sesión' });
  }
  return { checks, notes, evidence, result };
};

const conclusion = (observed: Observed, before: readonly Check[] = [], history: readonly string[] = [], extraEvidence: Readonly<Record<string, unknown>> = {}) =>
  conclude({
    checks: [...before, ...observed.checks.map((item, index) => (index === 0 && history.length > 0 ? { ...item, observed: `${history.join('; ')}; ${item.observed}` } : item))],
    notes: observed.notes,
    evidence: { ...observed.evidence, ...extraEvidence },
  });

/** La app en /login con alumno01 y las credenciales escritas: deja pulsar «Entrar» (o la tecla de envío) a quien llama. */
const typeCredentials = async (page: Page, email: string, password: string): Promise<string | undefined> => (await openLoginWithTenant(page)) ?? (await fillCredentials(page, email, password));

const attempt = async (page: Page, email: string, password: string): Promise<string | undefined> => (await typeCredentials(page, email, password)) ?? (await pressEnter(page));

/** Fallos previos por HTTP (después del reinicio), con el correo de la fila. Devuelve su descripción para el `observed`. */
const priorFailures = async (email: string, count: number): Promise<string> => {
  const done = await failedLogins(TENANT_A, email, count);
  return `Previos: ${count} fallos${count === 0 ? '' : ` (HTTP ${done.map((item) => item.status).join(', ')})`}`;
};

const countOfCell = (row: ManifestRow, key: string): number => {
  const count = Number(cell(row, key));
  if (!Number.isInteger(count) || count < 0) throw new Error(`celda sin interpretación: ${key} «${cell(row, key)}»`);
  return count;
};

// ---------------------------------------------------------------------------------------------------------------------
// Esquema 1: una cuenta activa entra en «Programas»
// ---------------------------------------------------------------------------------------------------------------------

type Submit = { readonly run: (page: Page) => Promise<string | undefined>; readonly approximation?: string };

const SUBMITS: ReadonlyMap<string, Submit> = new Map<string, Submit>([
  ['pulsa «Entrar»', { run: pressEnter }],
  ['pulsa la tecla de envío del teclado en la contraseña', { run: pressSubmitKey, approximation: KEYBOARD_APPROXIMATION }],
]);

type Result1 = { readonly kind: 'programs' } | { readonly kind: 'mfa'; readonly title: string };

const RESULTS_1: ReadonlyMap<string, Result1> = new Map<string, Result1>([
  ['llega a /programs', { kind: 'programs' }],
  ['ve el título «Verificación en dos pasos» y no tiene sesión iniciada', { kind: 'mfa', title: 'Verificación en dos pasos' }],
]);

const activeAccountEnters = mobileRow(async (row, { page, snapshot }) => {
  await resetTenants([TENANT_A]);
  const email = emailOf(cell(row, 'correo'));
  const password = passwordOf(cell(row, 'contraseña'));
  const submit = strict('envia', SUBMITS, cell(row, 'envia'));
  const wanted = strict('resultado', RESULTS_1, cell(row, 'resultado'));
  const expected = `${cell(row, 'envia')}: ${cell(row, 'resultado')}`;
  const failure = (await typeCredentials(page, email, password)) ?? (await submit.run(page));
  if (failure) return conclude({ checks: [check(false, expected, failure)] });
  const typed = await valueOf(emailField(page));
  const typedNote = typed !== email ? [`al escribir el correo «${email}» el campo quedó con «${typed ?? 'no legible'}»: ${EMAIL_TRIM_NOTE}`] : [];
  const outcomeOf = async () => {
    if (wanted.kind === 'programs') {
      const observed = await observeSubmission(page, { text: '', wording: expected, programs: true }, {}, snapshot);
      return conclude({ checks: observed.checks, notes: [...observed.notes, ...typedNote], evidence: { ...observed.evidence, emailFieldValue: typed } });
    }
    const result = await awaitLoginResult(page);
    const shown = result.kind === 'mfa' && result.message === wanted.title;
    const stays = await holdsFor(async () => pathOf(page) !== '/programs');
    await snapshot();
    const noSession = await hasNoSession(page);
    return conclude({
      checks: [
        check(shown, `ve el título «${wanted.title}»`, describeResult(result, page)),
        check(stays.held && noSession.ok, 'no tiene sesión iniciada', `${stays.held ? 'no entró en /programs en 2 s' : 'entró en /programs'}; ${noSession.observed}`),
      ],
      notes: [...slowNote('el paso de verificación', result.elapsedMs, REFERENCE_MS.network), ...typedNote],
      evidence: { elapsedMs: result.elapsedMs, emailFieldValue: typed },
    });
  };
  const concluded = await outcomeOf();
  const approximation = submit.approximation ?? (typedNote.length > 0 ? EMAIL_TRIM_APPROXIMATION : undefined);
  return approximation === undefined ? concluded : withApproximation(concluded, approximation);
});

// ---------------------------------------------------------------------------------------------------------------------
// Esquema 2: mientras espera la respuesta no se puede volver a enviar
// ---------------------------------------------------------------------------------------------------------------------

const DELAYS: ReadonlyMap<string, number> = new Map<string, number>([
  ['1 segundo', 1_000],
  ['3 segundos', 3_000],
]);

const busyWhileWaiting = mobileRow(async (row, { page, requests }) => {
  await resetTenants([TENANT_A]);
  const delayMs = strict('espera', DELAYS, cell(row, 'espera'));
  const [, email, password] = /ha escrito (\S+) y (\S+)$/.exec(row.resolvedSteps[0] ?? '') ?? [];
  if (email === undefined || password === undefined) throw new Error(`celda sin interpretación: no se encontraron el correo y la contraseña en el primer paso de ${row.rowId}`);
  const expectedBusy = 'durante la espera «Entrar» muestra que está ocupado y no se puede volver a pulsar';
  const expectedAfter = 'al llegar la respuesta está en /programs';

  // La prueba retrasa la respuesta de POST /api/auth/login en el navegador (retrasa y continúa; no cambia el caos del tenant).
  // Solo se retrasa el POST: la petición previa de comprobación entre orígenes (si la hay) no debe retrasarse.
  const gate: { releasedAt?: number } = {};
  await page.route(
    (url) => url.pathname === '/api/auth/login',
    async (route) => {
      if (route.request().method() !== 'POST') return route.continue();
      await sleep(delayMs);
      gate.releasedAt = performance.now();
      return route.continue();
    },
  );
  const failure = await typeCredentials(page, email, password);
  if (failure) return conclude({ checks: [check(false, `${expectedBusy}; ${expectedAfter}`, failure)] });
  const clickedAt = performance.now();
  const clickFailure = await pressEnter(page);
  if (clickFailure) return conclude({ checks: [check(false, `${expectedBusy}; ${expectedAfter}`, clickFailure)] });

  const button = enterButton(page);
  const reading = { busy: undefined as string | undefined, ariaDisabled: undefined as string | undefined, enabled: true, beforeRelease: false, atMs: 0 };
  const isBusy = (): boolean => reading.busy === 'true' && !reading.enabled;
  await waitUntil(async () => {
    reading.busy = await attrOf(button, 'aria-busy');
    reading.ariaDisabled = await attrOf(button, 'aria-disabled');
    reading.enabled = await isEnabled(button);
    reading.beforeRelease = gate.releasedAt === undefined;
    reading.atMs = Math.round(performance.now() - clickedAt);
    return isBusy() || gate.releasedAt !== undefined;
  });
  const busyOk = isBusy() && reading.beforeRelease;
  // «No se puede volver a pulsar»: se intenta pulsar de nuevo durante la espera (aun forzando la pulsación) y se cuentan los envíos
  const secondPress = busyOk ? await runSteps([['volver a pulsar «Entrar» durante la espera', () => button.click({ force: true, timeout: 1_500 })]]) : undefined;
  const result = await awaitLoginResult(page);
  const arrived = result.kind === 'programs' && (await waitUntil(async () => pathOf(page) === '/programs')).reached;
  const sent = requests.count();
  const releasedAfterMs = gate.releasedAt === undefined ? null : Math.round(gate.releasedAt - clickedAt);
  return conclude({
    checks: [
      check(
        busyOk && sent === 1,
        expectedBusy,
        `a los ${reading.atMs} ms de pulsar${reading.beforeRelease ? ', antes de liberar la respuesta' : ', DESPUÉS de liberar la respuesta'}: «Entrar» ${reading.busy === 'true' ? 'ocupado (aria-busy true)' : `no ocupado (aria-busy ${reading.busy ?? 'ausente'})`}, ${reading.enabled ? 'habilitado' : 'deshabilitado'} (aria-disabled ${reading.ariaDisabled ?? 'ausente'}); segunda pulsación ${secondPress === undefined && busyOk ? 'hecha sin efecto' : 'no efectuada'}; peticiones POST /api/auth/login enviadas: ${sent}`,
      ),
      check(arrived, expectedAfter, describeResult(result, page)),
    ],
    notes: [
      ...slowNote('llegar a /programs tras la respuesta', result.elapsedMs, REFERENCE_MS.network),
      ...(releasedAfterMs !== null && (releasedAfterMs < delayMs || releasedAfterMs > delayMs + 1_500) ? [`la respuesta se liberó a los ${releasedAfterMs} ms y el retraso inyectado era ${delayMs} ms: la medida no es la prevista`] : []),
    ],
    evidence: { injectedDelayMs: delayMs, releasedAfterMs, busyObservedAtMs: reading.atMs, ariaBusy: reading.busy ?? null, ariaDisabled: reading.ariaDisabled ?? null, secondPress: { attempted: busyOk, clickCompleted: busyOk && secondPress === undefined, failure: secondPress ?? null }, loginRequestsSent: sent, elapsedMs: result.elapsedMs },
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// Esquemas 3 y 4: credenciales incorrectas con menos de 5 fallos; el quinto fallo bloquea
// ---------------------------------------------------------------------------------------------------------------------

/** Esquema 3: el aviso «Correo o contraseña incorrectos»; sigue en /login sin sesión, con el correo escrito. */
const wrongBelowFive = mobileRow(async (row, { page, snapshot }) => {
  await resetTenants([TENANT_A]);
  const email = emailOf(cell(row, 'correo'));
  const password = passwordOf('incorrecta');
  const previous = await priorFailures(email, countOfCell(row, 'fallos_previos'));
  const failure = await attempt(page, email, password);
  const wording = `ve el aviso de error con el mensaje «${WRONG_NOTICE}»`;
  if (failure) return conclude({ checks: [check(false, wording, `${previous}; ${failure}`)] });
  const observed = await observeSubmission(page, { text: WRONG_NOTICE, wording }, { staysOnLogin: { email, password } }, snapshot);
  return conclusion(observed, [], [previous]);
});

/** Esquema 4: según los fallos previos, el aviso de credenciales incorrectas o el de cuenta bloqueada. */
const fifthFailureLocks = mobileRow(async (row, { page, snapshot }) => {
  await resetTenants([TENANT_A]);
  const email = emailOf(cell(row, 'correo'));
  const password = passwordOf(cell(row, 'contraseña'));
  const message = quoted(cell(row, 'mensaje'));
  const previous = await priorFailures(email, countOfCell(row, 'fallos_previos'));
  const failure = await attempt(page, email, password);
  const wording = `ve el mensaje «${message}»`;
  if (failure) return conclude({ checks: [check(false, wording, `${previous}; ${failure}`)] });
  const observed = await observeSubmission(page, { text: message, wording }, { staysOnLogin: { email, password } }, snapshot);
  return conclusion(observed, [], [previous]);
});

/** Esquema 5: con 3 o 4 fallos la cuenta sigue activa y la contraseña correcta entra. */
const belowFiveStillEnters = mobileRow(async (row, { page, snapshot }) => {
  await resetTenants([TENANT_A]);
  const email = fromSteps(row, /^Dado que .*, (\S+@\S+) acumula/);
  const password = fromSteps(row, /escribe ese correo y la contraseña (\S+)$/);
  const previous = await priorFailures(email, countOfCell(row, 'fallos_previos'));
  const failure = await attempt(page, email, password);
  if (failure) return conclude({ checks: [check(false, PROGRAMS, `${previous}; ${failure}`)] });
  const observed = await observeSubmission(page, { text: '', wording: PROGRAMS, programs: true }, {}, snapshot);
  return conclusion(observed, [], [previous]);
});

// ---------------------------------------------------------------------------------------------------------------------
// Esquema 6: una cuenta bloqueada no entra ni con su contraseña
// ---------------------------------------------------------------------------------------------------------------------

const lockedAccount = mobileRow(async (row, { page, snapshot }) => {
  await resetTenants([TENANT_A]);
  const email = fromSteps(row, /la cuenta (\S+@\S+) está bloqueada/);
  const password = passwordOf(cell(row, 'contraseña'));
  const premise = await accountIs(TENANT_A, `la cuenta ${email} está bloqueada`, email, 'locked', true);
  const wording = `ve el mensaje «${LOCKED_MESSAGE}»`;
  const failure = await attempt(page, email, password);
  if (failure) return conclude({ checks: [premise, check(false, wording, failure)] });
  const observed = await observeSubmission(page, { text: LOCKED_MESSAGE, wording }, { staysOnLogin: { email, password } }, snapshot);
  return conclusion(observed, [premise]);
});

// ---------------------------------------------------------------------------------------------------------------------
// Esquema 7: cuenta pendiente de aprobación o desactivada
// ---------------------------------------------------------------------------------------------------------------------

interface Prepared {
  readonly email: string;
  readonly premises: readonly Check[];
}

const REQUESTED = '(cuenta recién solicitada)';

const ACCOUNT_STATES: ReadonlyMap<string, (page: Page, emailCell: string) => Promise<Prepared>> = new Map<string, (page: Page, emailCell: string) => Promise<Prepared>>([
  [
    'pendiente de aprobación',
    async (page, emailCell) => {
      if (emailCell === REQUESTED) {
        // La solicitud se hace con «Solicitar acceso» y alumno01 en «Tenant de trabajo»; deja la app otra vez en /login
        const typed = (await openLoginWithTenant(page)) === undefined;
        const requested = typed ? await requestAccountThroughApp(page) : { email: uniqueEmail('nueva').replace(/@.*$/, '@organizacion.es'), check: check(false, 'Antes: solicita la cuenta con «Solicitar acceso» de la app', 'no se pudo abrir /login con alumno01 en «Tenant de trabajo»') };
        return { email: requested.email, premises: [requested.check, await accountIs(TENANT_A, `${requested.email} está pendiente de aprobación`, requested.email, 'pending', true)] };
      }
      return { email: emailCell, premises: [await accountIs(TENANT_A, `la cuenta ${emailCell} está pendiente de aprobación`, emailCell, 'pending', true)] };
    },
  ],
  [
    'desactivada',
    async (_page, emailCell) => {
      const patch = await setAccountActive(TENANT_A, emailCell, false);
      return { email: emailCell, premises: [check(patch.status === 200, `Antes: el administrador desactiva ${emailCell}`, `PATCH /api/admin/users respondió ${patch.status}`), await accountIs(TENANT_A, `la cuenta ${emailCell} está desactivada`, emailCell, 'active', false)] };
    },
  ],
]);

const pendingOrDisabled = mobileRow(async (row, { page, snapshot }) => {
  await resetTenants([TENANT_A]);
  const message = quoted(cell(row, 'mensaje'));
  const prepared = await strict('estado', ACCOUNT_STATES, cell(row, 'estado'))(page, cell(row, 'correo'));
  const password = passwordOf(cell(row, 'contraseña'));
  const wording = `ve el mensaje «${message}»`;
  if (prepared.premises.some((item) => !item.ok)) return conclude({ checks: [...prepared.premises, check(false, wording, 'no se llegó a escribir: no se cumple lo que la historia da por hecho')] });
  const failure = await attempt(page, prepared.email, password);
  if (failure) return conclude({ checks: [...prepared.premises, check(false, wording, failure)] });
  const observed = await observeSubmission(page, { text: message, wording }, {}, snapshot);
  return conclusion(observed, prepared.premises);
});

// ---------------------------------------------------------------------------------------------------------------------
// Esquema 8: el aviso de error desaparece al corregir los datos
// ---------------------------------------------------------------------------------------------------------------------

const FIELDS: ReadonlyMap<string, (page: Page) => Locator> = new Map<string, (page: Page) => Locator>([
  ['«Correo electrónico»', emailField],
  ['«Contraseña»', passwordField],
]);

const noticeDisappears = mobileRow(async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const email = fromSteps(row, /ha escrito (\S+@\S+) con la contraseña incorrecta/);
  const password = passwordOf('incorrecta');
  const field = strict('campo', FIELDS, cell(row, 'campo'));
  const expected = `cambia el contenido del campo ${cell(row, 'campo')}: deja de ver el aviso de error`;
  const failure = await attempt(page, email, password);
  if (failure) return conclude({ checks: [check(false, expected, failure)] });
  const shown = await waitUntil(async () => (await alertMessage(page)) === WRONG_NOTICE);
  const premise = check(shown.reached, `Antes: ve el aviso «${WRONG_NOTICE}»`, shown.reached ? `aviso «${WRONG_NOTICE}»` : `no apareció el aviso (aviso visible: ${(await alertMessage(page)) ?? 'ninguno'})`);
  if (!shown.reached) return conclude({ checks: [premise, check(false, expected, 'no se llegó a cambiar el campo: no se cumple lo que la historia da por hecho')] });
  const changeFailure = await runSteps([['cambiar el contenido del campo', () => field(page).pressSequentially('x', ACTION)]]);
  if (changeFailure) return conclude({ checks: [premise, check(false, expected, changeFailure)] });
  const gone = await waitUntil(async () => !(await seen(serverAlert(page))));
  const stays = gone.reached ? await holdsFor(async () => !(await seen(serverAlert(page)))) : { held: false };
  const still = await alertMessage(page);
  return conclude({
    checks: [premise, check(gone.reached && stays.held, expected, gone.reached ? `el aviso desapareció a los ${gone.elapsedMs} ms` : `el aviso sigue visible tras ${CEILING_MS / 1000} s: «${still ?? 'ninguno'}»`)],
    notes: gone.reached ? slowNote('desaparecer el aviso', gone.elapsedMs, REFERENCE_MS.local) : [],
    evidence: { elapsedMs: gone.elapsedMs, fieldAfterTyping: lengthOf(await valueOf(field(page))), holdMs: HOLD_MS, typedBy: 'escribir una x en el campo, tecla a tecla' },
  });
});

defineBrowserRows({
  story: 'US-LOGIN-012',
  surface: 'expo-web',
  tenants: [TENANT_A],
  handlers: new Map<number, BrowserRowHandler>([
    [1, activeAccountEnters],
    [2, busyWhileWaiting],
    [3, wrongBelowFive],
    [4, fifthFailureLocks],
    [5, belowFiveStillEnters],
    [6, lockedAccount],
    [7, pendingOrDisabled],
    [8, noticeDisappears],
  ]),
});
