import type { Locator, Page } from '@playwright/test';
import { DEMO, TENANT_A, TENANT_B, resetTenants } from '../../support/prepare';
import { defineBrowserRows, type BrowserRowHandler } from '../../support/rows';
import {
  ACTION,
  CEILING_MS,
  EMAIL_TRIM_APPROXIMATION,
  EMAIL_TRIM_NOTE,
  HOLD_MS,
  REFERENCE_MS,
  REOPEN_APPROXIMATION,
  URL_APPROXIMATION,
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
  goToProfile,
  hasNoSession,
  headingNamed,
  holdsFor,
  isChecked,
  lengthOf,
  linesOf,
  loginFormEverSeen,
  messageMatches,
  mustPrepare,
  mobileRow,
  noticeText,
  onLoginForm,
  onPrograms,
  openLogin,
  openLoginWithTenant,
  optionButton,
  passwordField,
  passwordOf,
  pathOf,
  pressEnter,
  profileTenantValue,
  quoted,
  quotedNotice,
  reachedAndHeld,
  reopenApp,
  recorderSeesForm,
  requestAccountThroughApp,
  requirePrepared,
  runSteps,
  seen,
  sessionStored,
  signInThroughApp,
  signedInAndOut,
  slowNote,
  storedTenant,
  strict,
  tenantField,
  textOf,
  typeTenant,
  valueOf,
  waitUntil,
  withApproximation,
  yesNo,
  type Check,
} from './common';

// US-LOGIN-011 — [Móvil] Formulario de acceso: elementos, tenant de trabajo y validación antes de enviar. La app móvil se
// ejecuta como web de Expo (390 × 844): NO es nativo. Preparación de cada fila: reinicio del tenant (o tenants) de la fila,
// /login en un contexto sin sesión y el tenant escrito en «Tenant de trabajo»; si la fila dice que alguien ha iniciado sesión, lo
// hace en la propia fila con el formulario de la app.

// ---------------------------------------------------------------------------------------------------------------------
// Esquema 1: las opciones del formulario llevan a su pantalla
// ---------------------------------------------------------------------------------------------------------------------

interface Reading {
  readonly ok: boolean;
  readonly observed: string;
  readonly evidence?: Readonly<Record<string, unknown>>;
}

const OPTIONS: ReadonlyMap<string, string> = new Map<string, string>([
  ['«¿Olvidaste la contraseña?»', '¿Olvidaste la contraseña?'],
  ['«Solicitar acceso»', 'Solicitar acceso'],
]);

const emailReading =
  (wanted: string): ((page: Page) => Promise<Reading>) =>
  async (page) => {
    const value = await valueOf(emailField(page));
    return { ok: value === wanted, observed: `el campo «Correo electrónico» ${value === undefined ? 'no se pudo leer' : value === '' ? 'está vacío' : `contiene «${value}»`}` };
  };

/** Todos los campos de texto del formulario de solicitud, leídos de uno en uno (la lectura de cada uno es estricta). */
const requestFormEmpty = async (page: Page): Promise<Reading> => {
  const fields = await page.getByRole('textbox').all();
  const values = await Promise.all(fields.map(async (field) => ({ name: (await attrOf(field, 'aria-label')) ?? '(sin nombre)', value: await valueOf(field) })));
  const filled = values.filter((item) => item.value !== '');
  const terms = await isChecked(page.getByRole('checkbox', { name: /He leído y acepto/ }));
  const role = linesOf(await textOf(page.getByRole('combobox', { name: 'Rol solicitado', exact: true })))[0];
  return {
    ok: values.length > 0 && filled.length === 0 && !terms,
    observed: `${values.length} campos de texto, ${filled.length} con contenido${filled.length === 0 ? '' : ` (${filled.map((item) => item.name).join(', ')})`}; casilla de condiciones ${terms ? 'marcada' : 'sin marcar'}; «Rol solicitado» con su valor por defecto «${role ?? 'no legible'}»`,
    evidence: { requestFormFields: values.map((item) => `${item.name}: ${item.value === '' ? 'vacío' : item.value === undefined ? 'no legible' : lengthOf(item.value)}`) },
  };
};

const DESTINATIONS: ReadonlyMap<string, (page: Page) => Promise<Reading>> = new Map<string, (page: Page) => Promise<Reading>>([
  ['el campo de correo está vacío', emailReading('')],
  ['el campo de correo contiene gestor@sigpro.test', emailReading('gestor@sigpro.test')],
  ['el formulario de solicitud está vacío', requestFormEmpty],
]);

const optionLeadsToScreen = mobileRow(async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const email = emailOf(cell(row, 'correo'));
  const optionName = strict('opcion', OPTIONS, cell(row, 'opcion'));
  const destination = strict('correo_destino', DESTINATIONS, cell(row, 'correo_destino'));
  const route = cell(row, 'ruta');
  const title = quoted(cell(row, 'titulo'));
  const expectedArrival = `pulsa ${cell(row, 'opcion')}: llega a ${route} y ve el título ${cell(row, 'titulo')}`;
  // Abrir /login con el tenant y escribir el correo son el «Dado» (preparación); pulsar la opción es el «Cuando»
  mustPrepare(row, 'la app está en /login sin sesión, con alumno01 en «Tenant de trabajo»', await openLoginWithTenant(page));
  if (email !== '') mustPrepare(row, `ha escrito el correo ${email}`, await runSteps([['escribir el correo', () => emailField(page).fill(email, ACTION)]]));
  const failure = await runSteps([[`pulsar «${optionName}»`, () => optionButton(page, optionName).click(ACTION)]]);
  if (failure) return conclude({ checks: [check(false, expectedArrival, failure)] });

  const arrived = await waitUntil(async () => pathOf(page) === route && (await seen(headingNamed(page, title))));
  const arrivalReading = `ruta ${pathOf(page)}, título «${title}» ${(await seen(headingNamed(page, title))) ? 'visible' : 'no visible'}`;
  const read = await destination(page);
  // «Desde las dos, «Volver al inicio de sesión» regresa a /login» es una Regla, no un paso del Esquema: se mide, pero NO decide el
  // veredicto (queda en la evidencia y, si falla, en la nota)
  const backFailure = await runSteps([['pulsar «Volver al inicio de sesión»', () => optionButton(page, 'Volver al inicio de sesión').click(ACTION)]]);
  const back = backFailure ? { reached: false, elapsedMs: 0 } : await waitUntil(() => onLoginForm(page));
  const backNote = back.reached ? [] : [`Dato aparte (Regla de la historia, no un paso de la fila): al pulsar «Volver al inicio de sesión» NO se regresó a /login (${backFailure ?? `ruta ${pathOf(page)}`})`];
  return conclude({
    checks: [check(arrived.reached, expectedArrival, arrivalReading), check(read.ok, cell(row, 'correo_destino'), read.observed)],
    notes: [...backNote, ...slowNote('llegar a la pantalla', arrived.elapsedMs, REFERENCE_MS.network)],
    evidence: { elapsedMs: arrived.elapsedMs, backToLogin: { reached: back.reached, elapsedMs: back.elapsedMs, ...(backFailure === undefined ? {} : { failure: backFailure }) }, ...read.evidence },
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// Esquema 2: con una sesión iniciada no se vuelve a pedir el acceso
// ---------------------------------------------------------------------------------------------------------------------

const SITUATIONS: ReadonlyMap<string, (page: Page) => Promise<readonly Check[]>> = new Map<string, (page: Page) => Promise<readonly Check[]>>([
  [
    'nadie ha iniciado sesión',
    async (page) => {
      const failure = await openLoginWithTenant(page);
      // Control positivo: en este documento el formulario SÍ se pintó, así que el registrador tiene que haberlo visto
      const recorder = await recorderSeesForm(page);
      return [
        check(failure === undefined, 'Antes: la app está en /login sin sesión, con alumno01 en «Tenant de trabajo»', failure ?? 'en /login, sin sesión'),
        check(recorder, 'Control: el registrador de «formulario pintado» ve el formulario al abrir /login', recorder ? 'lo ve' : 'no lo ve (la sonda está ciega)'),
      ];
    },
  ],
  [
    'gestor@sigpro.test ha iniciado sesión en alumno01 con Gestor1234!',
    async (page) => {
      const session = await signInThroughApp(page, DEMO.gestor);
      const recorder = await recorderSeesForm(page);
      return [
        check(session.ok, 'Antes: gestor@sigpro.test ha iniciado sesión en alumno01 y está en /programs', session.observed),
        check(recorder, 'Control: el registrador de «formulario pintado» vio el formulario al iniciar sesión', recorder ? 'lo vio' : 'no lo vio (la sonda está ciega)'),
      ];
    },
  ],
]);

const RESULTS_2: ReadonlyMap<string, (page: Page) => Promise<{ readonly ok: boolean; readonly observed: string; readonly elapsedMs: number }>> = new Map([
  [
    've el título «Iniciar sesión» con el formulario de acceso',
    async (page) => {
      const shown = await reachedAndHeld(async () => (await onLoginForm(page)) && (await seen(enterButton(page))) && (await seen(emailField(page))) && (await seen(passwordField(page))));
      return { ok: shown.reached && shown.held, observed: `ruta ${pathOf(page)}, título «Iniciar sesión» y formulario (correo, contraseña, «Entrar») visibles: ${yesNo(shown.reached && shown.held)}`, elapsedMs: shown.elapsedMs };
    },
  ],
  [
    'llega a /programs sin ver el formulario',
    async (page) => {
      const shown = await reachedAndHeld(() => onPrograms(page));
      const formSeen = await loginFormEverSeen(page);
      return {
        ok: shown.reached && shown.held && !formSeen,
        observed: `ruta ${pathOf(page)}${shown.reached ? ` (a los ${shown.elapsedMs} ms)` : ' (no llegó a /programs)'}; formulario de acceso pintado en algún momento: ${yesNo(formSeen)}`,
        elapsedMs: shown.elapsedMs,
      };
    },
  ],
]);

const sessionOpensLogin = mobileRow(async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const prepare = strict('situacion', SITUATIONS, cell(row, 'situacion'));
  const read = strict('resultado', RESULTS_2, cell(row, 'resultado'));
  const expected = `abre /login: ${cell(row, 'resultado')}`;
  // La sesión (o la app sin ella) y el registrador funcionando son PREPARACIÓN de la fila
  const before = requirePrepared(row, await prepare(page));
  // «Abre /login»: en Expo web, abrir la dirección (carga completa de la página; la sesión guardada se recupera al arrancar). La
  // carga es fontanería: si falla, lanza.
  await page.goto('/login', { timeout: CEILING_MS });
  const reading = await read(page);
  return withApproximation(
    conclude({ checks: [...before, check(reading.ok, expected, reading.observed)], notes: slowNote('la pantalla final', reading.elapsedMs, REFERENCE_MS.network), evidence: { elapsedMs: reading.elapsedMs, openedBy: 'dirección /login (carga completa en Expo web)' } }),
    URL_APPROXIMATION,
  );
});

// ---------------------------------------------------------------------------------------------------------------------
// Esquema 3: el inicio de sesión ocurre en el tenant escrito
// ---------------------------------------------------------------------------------------------------------------------

type Expectation = { readonly kind: 'profile'; readonly tenant: string } | { readonly kind: 'rejected'; readonly message: string };

const RESULTS_3: ReadonlyMap<string, Expectation> = new Map<string, Expectation>([
  ['llega a /programs y la página «Perfil» muestra el tenant alumno01', { kind: 'profile', tenant: 'alumno01' }],
  ['llega a /programs y la página «Perfil» muestra el tenant alumno02', { kind: 'profile', tenant: 'alumno02' }],
  ['ve «Correo o contraseña incorrectos» y sigue sin sesión', { kind: 'rejected', message: 'Correo o contraseña incorrectos' }],
]);

const REQUESTED_IN_A = '(cuenta recién solicitada en alumno01)';

const tenantOfSignIn = mobileRow(async (row, { page, requests, snapshot }) => {
  await resetTenants([TENANT_A, TENANT_B]);
  const tenant = cell(row, 'tenant');
  const expectation = strict('resultado', RESULTS_3, cell(row, 'resultado'));
  const password = passwordOf(cell(row, 'contraseña'));
  const expected = `escribe ${cell(row, 'correo')} y la contraseña con ${tenant} en «Tenant de trabajo» y pulsa «Entrar»: ${cell(row, 'resultado')}`;
  // «Una persona sin sesión iniciada en /login escribe <tenant>» y, si la fila lo dice, la cuenta recién solicitada: PREPARACIÓN
  mustPrepare(row, 'la app está en /login sin sesión', await openLogin(page));
  let email = '';
  const premises: Check[] = [];
  if (cell(row, 'correo') === REQUESTED_IN_A) {
    // La cuenta se solicita en alumno01 (con alumno01 en el campo) y después se escribe el tenant de la fila
    mustPrepare(row, 'alumno01 en «Tenant de trabajo»', await typeTenant(page, TENANT_A));
    const requested = await requestAccountThroughApp(page);
    email = requested.email;
    premises.push(...requirePrepared(row, [requested.check, await accountIs(TENANT_A, 'la cuenta recién solicitada está pendiente de aprobación en alumno01', requested.email, 'pending', true)]));
  } else {
    email = emailOf(cell(row, 'correo'));
  }
  mustPrepare(row, `${tenant} en «Tenant de trabajo»`, await typeTenant(page, tenant));
  // «Cuando escribe el correo y la contraseña y pulsa «Entrar»»: si un elemento falta, es una discrepancia de la app
  const failure = (await fillCredentials(page, email, password)) ?? (await pressEnter(page));
  if (failure) return conclude({ checks: [...premises, check(false, expected, failure)] });

  const result = await awaitLoginResult(page);
  const notes = [...slowNote('el resultado del envío', result.elapsedMs, REFERENCE_MS.network)];
  const evidence: Record<string, unknown> = { elapsedMs: result.elapsedMs, tenantTyped: tenant, ...detailEvidence(result.detail) };

  if (expectation.kind === 'profile') {
    const arrived = check(result.kind === 'programs', 'llega a /programs', describeResult(result, page));
    const toProfile = result.kind === 'programs' ? await goToProfile(page) : 'no se abrió «Perfil»: no llegó a /programs';
    const shown = toProfile === undefined ? await textOf(profileTenantValue(page)) : undefined;
    return conclude({
      checks: [...premises, arrived, check(shown === expectation.tenant, `la página «Perfil» muestra el tenant ${expectation.tenant}`, toProfile ?? `la página «Perfil» muestra el tenant «${shown ?? 'no legible'}»`)],
      notes,
      evidence: { ...evidence, profileTenant: shown ?? null, ...(email === '' ? {} : { accountEmail: email }) },
    });
  }
  const matched = messageMatches(expectation.message, result);
  const stays = await holdsFor(() => onLoginForm(page));
  const attempted = requests.list().at(-1);
  await snapshot();
  return conclude({
    checks: [...premises, check(matched, `ve «${expectation.message}»`, describeResult(result, page)), check(stays.held, 'sigue en /login', stays.held ? 'sigue en /login (observado 2 s)' : `ruta ${pathOf(page)}`), await hasNoSession(page)],
    notes,
    evidence: { ...evidence, tenantHeaderOfTheAttempt: attempted?.tenantHeader ?? null, accountEmail: email },
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// Esquema 4: la app recuerda el último tenant usado
// ---------------------------------------------------------------------------------------------------------------------

const remembersTenant = mobileRow(async (row, { page, context, snapshot }) => {
  const previous = cell(row, 'anterior');
  await resetTenants([previous]);
  const expected = `cierra la app y la vuelve a abrir en /login: «Tenant de trabajo» contiene ${previous}`;
  // Haber iniciado sesión con `previous` en el campo y haber pulsado «Cerrar sesión» en «Perfil» es el «Dado»: PREPARACIÓN
  const before = requirePrepared(row, await signedInAndOut(page, DEMO.gestor, previous));
  const storedBefore = await storedTenant(page);
  // «Cierra la app y la vuelve a abrir en /login»: fontanería del arnés (si falla, lanza)
  const reopened = await reopenApp(context, page, '/login');
  const shown = await waitUntil(() => onLoginForm(reopened));
  const value = await valueOf(tenantField(reopened));
  await snapshot(reopened);
  return withApproximation(
    conclude({
      checks: [...before, check(shown.reached && value === previous, expected, `la app reabierta está en ${pathOf(reopened)} y «Tenant de trabajo» contiene «${value ?? 'no legible'}»`)],
      notes: [
        ...slowNote('abrir /login', shown.elapsedMs, REFERENCE_MS.network),
        'La app guarda el tenant en cuanto se escribe en el campo (no solo al iniciar sesión): esta fila no distingue «el último tenant con el que se inició sesión» de «el último tenant escrito» (la historia dice «último tenant usado» sin precisar).',
      ],
      evidence: { elapsedMs: shown.elapsedMs, tenantStoredBeforeClosing: storedBefore ?? null, sessionStoredAfterReopening: (await sessionStored(reopened)) ?? null },
    }),
    REOPEN_APPROXIMATION,
  );
});

// ---------------------------------------------------------------------------------------------------------------------
// Esquema 5: el campo de tenant no se queda vacío
// ---------------------------------------------------------------------------------------------------------------------

const tenantNeverEmpty = mobileRow(async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const tenant = cell(row, 'tenant');
  const expected = `borra todo el contenido del campo «Tenant de trabajo» (tenía ${tenant}): el campo muestra demo`;
  mustPrepare(row, 'la app está en /login sin sesión', await openLogin(page));
  const initial = await valueOf(tenantField(page));
  const typing = initial === tenant ? undefined : await typeTenant(page, tenant);
  // «Tiene <tenant> en «Tenant de trabajo»» es el «Dado» (preparación)
  const premises = requirePrepared(row, [check(typing === undefined, `Antes: «Tenant de trabajo» tiene ${tenant}`, typing ?? `el campo contiene «${tenant}»${initial === tenant ? ' (valor inicial de la app, sin escribir nada)' : ''}`)]);
  // Borrar todo el contenido: seleccionar el texto y pulsar «Retroceso»
  const cleared = await runSteps([
    ['seleccionar el contenido del campo', () => tenantField(page).selectText(ACTION)],
    ['pulsar «Retroceso»', () => page.keyboard.press('Backspace')],
  ]);
  if (cleared) return conclude({ checks: [...premises, check(false, expected, cleared)] });
  const shown = await reachedAndHeld(async () => (await valueOf(tenantField(page))) === 'demo');
  const value = await valueOf(tenantField(page));
  return conclude({
    checks: [...premises, check(shown.reached && shown.held, expected, `el campo contiene «${value ?? 'no legible'}»${shown.reached ? ` (a los ${shown.elapsedMs} ms, estable ${HOLD_MS / 1000} s)` : ''}`)],
    notes: [
      ...slowNote('mostrar demo', shown.elapsedMs, REFERENCE_MS.local),
      ...(initial === tenant
        ? [`El valor inicial de la app ya era ${tenant} y es también el valor esperado tras borrar: esta fila pasa por construcción (un Retroceso que no borrara nada daría el mismo resultado); el cambio real lo mide la fila con otro tenant de partida`]
        : []),
    ],
    evidence: { elapsedMs: shown.elapsedMs, startedFromAppDefault: initial === tenant, clearedBy: 'seleccionar todo el texto y pulsar Retroceso', tenantStoredAfter: (await storedTenant(page)) ?? null },
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// Esquema 6: cada campo no válido muestra su aviso y no se envía nada
// ---------------------------------------------------------------------------------------------------------------------

interface Submission {
  readonly sent: boolean;
  readonly then?: 'alert' | 'programs';
  readonly message?: string;
}

const SUBMISSIONS: ReadonlyMap<string, Submission> = new Map<string, Submission>([
  ['no se envía nada', { sent: false }],
  ['se envía y ve «Correo o contraseña incorrectos»', { sent: true, then: 'alert', message: 'Correo o contraseña incorrectos' }],
  ['se envía y llega a /programs', { sent: true, then: 'programs' }],
]);

const validationBeforeSending = mobileRow(async (row, { page, requests }) => {
  await resetTenants([TENANT_A]);
  const email = emailOf(cell(row, 'correo'));
  const password = passwordOf(cell(row, 'contraseña'));
  const wantEmail = cell(row, 'aviso_correo') === '(ninguno)' ? undefined : quoted(cell(row, 'aviso_correo'));
  const wantPassword = cell(row, 'aviso_contraseña') === '(ninguno)' ? undefined : quoted(cell(row, 'aviso_contraseña'));
  const submission = strict('envio', SUBMISSIONS, cell(row, 'envio'));
  const expectedEmail = `bajo el correo ve ${cell(row, 'aviso_correo')}`;
  const expectedPassword = `bajo la contraseña ve ${cell(row, 'aviso_contraseña')}`;
  const expectedSending = cell(row, 'envio');
  const expectedAll = `${expectedEmail}; ${expectedPassword}; ${expectedSending}`;

  mustPrepare(row, 'la app está en /login sin sesión, con alumno01 en «Tenant de trabajo»', await openLoginWithTenant(page));
  const failure = await fillCredentials(page, email, password);
  if (failure) return conclude({ checks: [check(false, expectedAll, failure)] });
  const typedEmail = await valueOf(emailField(page));
  const typedPasswordLength = (await valueOf(passwordField(page)))?.length;
  const pressFailure = await pressEnter(page);
  if (pressFailure) return conclude({ checks: [check(false, expectedAll, pressFailure)] });

  const readNotices = async () => ({ email: await noticeText(emailField(page)), password: await noticeText(passwordField(page)) });
  const timings: Record<string, number> = {};
  const notes: string[] = [];
  let sendingReading = '';
  let sendingOk = false;
  let detail: string | undefined;

  if (!submission.sent) {
    const shown = await waitUntil(async () => {
      const read = await readNotices();
      return read.email === wantEmail && read.password === wantPassword;
    });
    timings.noticesMs = shown.elapsedMs;
    const held = await holdsFor(async () => requests.count() === 0 && pathOf(page) === '/login');
    sendingOk = held.held;
    sendingReading = held.held ? 'no se envió ninguna petición POST /api/auth/login en 2 s y sigue en /login' : `hubo ${requests.count()} petición(es) POST /api/auth/login o se dejó /login (ruta ${pathOf(page)})`;
    notes.push(...slowNote('el aviso de validación', shown.elapsedMs, REFERENCE_MS.local));
  } else {
    const result = await awaitLoginResult(page);
    timings.resultMs = result.elapsedMs;
    detail = result.detail;
    const sent = requests.count() >= 1;
    sendingOk = sent && (submission.then === 'programs' ? result.kind === 'programs' : messageMatches(submission.message ?? '', result));
    sendingReading = `${sent ? 'se envió' : 'no se envió'} la petición (${requests.count()}); ${describeResult(result, page)}`;
    notes.push(...slowNote('el resultado del envío', result.elapsedMs, REFERENCE_MS.network));
  }

  const final = await readNotices();
  const invalid = { email: await attrOf(emailField(page), 'aria-invalid'), password: await attrOf(passwordField(page), 'aria-invalid') };
  const typedNote = typedEmail !== email ? [`al escribir el correo «${email}» el campo quedó con «${typedEmail ?? 'no legible'}»: ${EMAIL_TRIM_NOTE}`] : [];
  const concluded = conclude({
    checks: [
      check(final.email === wantEmail, expectedEmail, quotedNotice(final.email)),
      check(final.password === wantPassword, expectedPassword, quotedNotice(final.password)),
      check(sendingOk, expectedSending, sendingReading),
    ],
    notes: [...notes, ...typedNote],
    evidence: { ...timings, elapsedMs: timings.noticesMs ?? timings.resultMs, emailFieldValue: typedEmail, passwordFieldLength: typedPasswordLength, ariaInvalid: { email: invalid.email ?? null, password: invalid.password ?? null }, ...detailEvidence(detail) },
  });
  return typedNote.length === 0 ? concluded : withApproximation(concluded, EMAIL_TRIM_APPROXIMATION);
});

// ---------------------------------------------------------------------------------------------------------------------
// Esquema 7: editar un campo borra los avisos de los campos
// ---------------------------------------------------------------------------------------------------------------------

const FIELDS: ReadonlyMap<string, (page: Page) => Locator> = new Map<string, (page: Page) => Locator>([
  ['«Correo electrónico»', emailField],
  ['«Contraseña»', passwordField],
]);

const editingClearsNotices = mobileRow(async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const field = strict('campo', FIELDS, cell(row, 'campo'));
  const text = cell(row, 'texto');
  const expected = `escribe ${text} en el campo ${cell(row, 'campo')}: ya no ve ningún aviso bajo los campos`;
  const readNotices = async () => ({ email: await noticeText(emailField(page)), password: await noticeText(passwordField(page)) });
  mustPrepare(row, 'la app está en /login sin sesión, con alumno01 en «Tenant de trabajo»', await openLoginWithTenant(page));
  // «Ha pulsado «Entrar» con los dos campos vacíos y ve «Campo obligatorio»…» es el «Dado» (preparación)
  mustPrepare(row, 'ha pulsado «Entrar» con los dos campos vacíos', await pressEnter(page));
  const premise = await waitUntil(async () => {
    const read = await readNotices();
    return read.email === 'Campo obligatorio' && read.password === 'Campo obligatorio';
  });
  const before = await readNotices();
  const premiseCheck = check(premise.reached, 'Antes: ve «Campo obligatorio» bajo el correo y bajo la contraseña', `Antes: bajo el correo ${quotedNotice(before.email)}; bajo la contraseña ${quotedNotice(before.password)}`);
  requirePrepared(row, [premiseCheck]);
  const typeFailure = await runSteps([[`escribir ${text} en el campo ${cell(row, 'campo')}`, () => field(page).pressSequentially(text, ACTION)]]);
  if (typeFailure) return conclude({ checks: [premiseCheck, check(false, expected, typeFailure)] });
  const noNotices = async (): Promise<boolean> => {
    const read = await readNotices();
    return read.email === undefined && read.password === undefined;
  };
  const cleared = await waitUntil(noNotices);
  const stays = cleared.reached ? await holdsFor(noNotices) : { held: false };
  const after = await readNotices();
  return conclude({
    checks: [premiseCheck, check(cleared.reached && stays.held, expected, `bajo el correo ${quotedNotice(after.email)}; bajo la contraseña ${quotedNotice(after.password)}${cleared.reached ? ` (a los ${cleared.elapsedMs} ms)` : ` (tras ${CEILING_MS / 1000} s de espera)`}`)],
    notes: cleared.reached ? slowNote('desaparecer los avisos', cleared.elapsedMs, REFERENCE_MS.local) : [],
    evidence: { elapsedMs: cleared.elapsedMs, fieldAfterTyping: lengthOf(await valueOf(field(page))) },
  });
});

defineBrowserRows({
  story: 'US-LOGIN-011',
  surface: 'expo-web',
  // alumno02 y alumno25 solo los usan las filas que la propia historia dice (Preparación): E3 y E4/F2
  tenants: [TENANT_A, TENANT_B, 'alumno25'],
  handlers: new Map<number, BrowserRowHandler>([
    [1, optionLeadsToScreen],
    [2, sessionOpensLogin],
    [3, tenantOfSignIn],
    [4, remembersTenant],
    [5, tenantNeverEmpty],
    [6, validationBeforeSending],
    [7, editingClearsNotices],
  ]),
});
