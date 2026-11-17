import type { Locator, Page } from '@playwright/test';
import { DEMO, TENANT_A, resetTenants } from '../../support/prepare';
import { defineBrowserRows, type BrowserRowHandler } from '../../support/rows';
import {
  ACTION,
  CEILING_MS,
  LOGIN_URL,
  REFERENCE_MS,
  alertReading,
  attrOf,
  browserRow,
  cell,
  check,
  conclude,
  countOf,
  detailEvidence,
  emailField,
  emailOf,
  enterButton,
  fieldNotice,
  fillCredentials,
  fromSteps,
  holdsFor,
  isChecked,
  isEnabled,
  isFocused,
  isVisible,
  lengthOf,
  loginFormEverSeen,
  loginHeading,
  noticeOf,
  onLoginForm,
  onPrograms,
  openLogin,
  optionNamed,
  passwordField,
  passwordOf,
  passwordToggle,
  pathOf,
  pressEnter,
  quoted,
  reachesPrograms,
  rememberBox,
  requirePrepared,
  runSteps,
  signInThroughForm,
  signOutFromUserMenu,
  slowNote,
  ssoButton,
  strict,
  textOf,
  trimmedEmailNote,
  valueOf,
  waitUntil,
  type Check,
} from './common';

// US-LOGIN-006 — Formulario de acceso: elementos, validación antes de enviar y mostrar la contraseña. Preparación de cada fila:
// reinicio del tenant alumno01 y /login?tenant=alumno01 en un contexto sin sesión; si la fila dice que alguien ha iniciado
// sesión, lo hace después del reinicio con el formulario de la propia fila.

const TITLE_TEXT = 'Accede con tu cuenta corporativa de SIGPRO.';

// ---------------------------------------------------------------------------------------------------------------------
// Esquema 1: estado inicial de cada elemento
// ---------------------------------------------------------------------------------------------------------------------

interface Reading {
  readonly ok: boolean;
  readonly observed: string;
}

type StateProbe = (target: Locator, page: Page) => Promise<Reading>;

const yesNo = (value: boolean): string => (value ? 'sí' : 'no');

/** El elemento de la celda `elemento`, localizado por su texto de la interfaz. */
const ELEMENTS: ReadonlyMap<string, (page: Page) => Locator> = new Map<string, (page: Page) => Locator>([
  ['«Iniciar sesión»', loginHeading],
  ['«Correo electrónico»', emailField],
  ['«Contraseña»', passwordField],
  ['«Mantener la sesión en este equipo»', rememberBox],
  ['«Entrar»', enterButton],
  ['«Acceder con certificado digital / SSO»', ssoButton],
]);

/** El estado de la celda `estado`, leído en la pantalla. */
const STATES: ReadonlyMap<string, StateProbe> = new Map<string, StateProbe>([
  [
    `es el título de la página, con el texto «${TITLE_TEXT}»`,
    async (target, page) => {
      const level1 = await isVisible(page.getByRole('heading', { level: 1, name: 'Iniciar sesión', exact: true }));
      const text = await isVisible(page.getByText(TITLE_TEXT, { exact: true }));
      return { ok: (await isVisible(target)) && level1 && text, observed: `título de nivel 1 «Iniciar sesión»: ${yesNo(level1)}; texto «${TITLE_TEXT}» visible: ${yesNo(text)}` };
    },
  ],
  [
    'está vacío y tiene el foco',
    async (target) => {
      const value = await valueOf(target);
      const focused = await isFocused(target);
      return { ok: value === '' && focused, observed: `vacío: ${yesNo(value === '')}${value ? ` (contiene longitud ${value.length})` : ''}; con el foco: ${yesNo(focused)}` };
    },
  ],
  [
    'está vacía y oculta lo que se escribe',
    async (target) => {
      const value = await valueOf(target);
      const type = await attrOf(target, 'type');
      return { ok: value === '' && type === 'password', observed: `vacía: ${yesNo(value === '')}; tipo del campo: ${type ?? 'no legible'} (oculta lo que se escribe: ${yesNo(type === 'password')})` };
    },
  ],
  ['está marcada', async (target) => ({ ok: await isChecked(target), observed: `marcada: ${yesNo(await isChecked(target))}` })],
  ['está habilitado', async (target) => ({ ok: await isEnabled(target), observed: `habilitado: ${yesNo(await isEnabled(target))}` })],
]);

const initialState = browserRow(async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const element = strict('elemento', ELEMENTS, cell(row, 'elemento'));
  const state = strict('estado', STATES, cell(row, 'estado'));
  const expected = `${cell(row, 'elemento')} ${cell(row, 'estado')}`;
  const failure = await openLogin(page);
  if (failure) return conclude({ checks: [check(false, expected, failure)] });
  let last: Reading = { ok: false, observed: 'sin lectura' };
  const waited = await waitUntil(async () => {
    last = await state(element(page), page);
    return last.ok;
  });
  return conclude({ checks: [check(waited.reached, expected, last.observed)], notes: slowNote('el estado inicial', waited.elapsedMs, REFERENCE_MS.local), evidence: { elapsedMs: waited.elapsedMs } });
});

// ---------------------------------------------------------------------------------------------------------------------
// Esquema 2: las opciones del formulario llevan a su pantalla
// ---------------------------------------------------------------------------------------------------------------------

const optionLeadsToScreen = browserRow(async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const option = quoted(cell(row, 'opcion'));
  const route = cell(row, 'ruta');
  const title = quoted(cell(row, 'titulo'));
  const expectedArrival = `pulsa ${cell(row, 'opcion')}: llega a ${route} y ve el título ${cell(row, 'titulo')}`;
  const expectedBack = 'al pulsar «Volver al inicio de sesión» regresa a /login';
  const failure = (await openLogin(page)) ?? (await runSteps([[`pulsar «${option}»`, () => optionNamed(page, option).click(ACTION)]]));
  if (failure) return conclude({ checks: [check(false, expectedArrival, failure)] });

  const headingNow = page.getByRole('heading', { name: title, exact: true });
  const arrived = await waitUntil(async () => pathOf(page) === route && (await isVisible(headingNow)));
  const arrivalReading = `ruta ${pathOf(page)}, título «${(await textOf(page.getByRole('heading', { level: 1 }))) ?? 'sin título'}»`;
  const backFailure = await runSteps([['pulsar «Volver al inicio de sesión»', () => optionNamed(page, 'Volver al inicio de sesión').click(ACTION)]]);
  const back = backFailure ? { reached: false, elapsedMs: 0 } : await waitUntil(() => onLoginForm(page));
  return conclude({
    checks: [check(arrived.reached, expectedArrival, arrivalReading), check(back.reached, expectedBack, backFailure ?? `ruta ${pathOf(page)}, formulario «Iniciar sesión» visible: ${yesNo(await onLoginForm(page))}`)],
    notes: [...slowNote('llegar a la pantalla', arrived.elapsedMs, REFERENCE_MS.network), ...slowNote('volver al inicio de sesión', back.elapsedMs, REFERENCE_MS.network)],
    evidence: { elapsedMs: arrived.elapsedMs, backElapsedMs: back.elapsedMs },
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// Esquema 3: con una sesión iniciada no se vuelve a pedir el acceso
// ---------------------------------------------------------------------------------------------------------------------

/** Inicia sesión con el formulario de la propia fila y devuelve la comprobación de que quedó /programs. */
const signedIn = async (page: Page, who: { readonly email: string; readonly password: string }): Promise<Check> => {
  const result = await signInThroughForm(page, who);
  return check(result.ok, `Antes: ${who.email} ha iniciado sesión en alumno01 y está en /programs`, result.observed);
};

const SITUATIONS: ReadonlyMap<string, (page: Page) => Promise<readonly Check[]>> = new Map<string, (page: Page) => Promise<readonly Check[]>>([
  ['nadie ha iniciado sesión', async () => []],
  ['gestor@sigpro.test ha iniciado sesión en alumno01 con Gestor1234!', async (page) => [await signedIn(page, DEMO.gestor)]],
  [
    'consultor@sigpro.test ha iniciado sesión en alumno01 y después ha pulsado «Cerrar sesión»',
    async (page) => {
      const before = await signedIn(page, DEMO.consultor);
      if (!before.ok) return [before];
      const failure = await signOutFromUserMenu(page);
      const out = failure ? { reached: false } : await waitUntil(() => onLoginForm(page));
      return [before, check(out.reached, 'Antes: consultor@sigpro.test pulsó «Cerrar sesión» y llegó a /login', failure ?? `ruta ${pathOf(page)}`)];
    },
  ],
]);

const RESULTS: ReadonlyMap<string, (page: Page) => Promise<{ readonly ok: boolean; readonly observed: string; readonly elapsedMs: number }>> = new Map([
  [
    've el formulario «Iniciar sesión»',
    async (page) => {
      const shown = await waitUntil(() => onLoginForm(page));
      const stays = await holdsFor(() => onLoginForm(page));
      return { ok: shown.reached && stays.held, observed: `ruta ${pathOf(page)}, formulario «Iniciar sesión» visible: ${yesNo(await onLoginForm(page))}`, elapsedMs: shown.elapsedMs };
    },
  ],
  [
    'llega a /programs sin ver el formulario',
    async (page) => {
      const arrived = await reachesPrograms(page);
      const stays = await holdsFor(() => onPrograms(page));
      const formSeen = await loginFormEverSeen(page);
      return {
        ok: arrived.reached && stays.held && !formSeen,
        observed: `ruta ${pathOf(page)}${arrived.reached ? ` (a los ${arrived.elapsedMs} ms)` : ' (no llegó a /programs)'}${stays.held ? ', sigue en /programs (observado 2 s)' : `, dejó /programs a los ${stays.brokeAtMs ?? '?'} ms`}; formulario de acceso pintado en algún momento: ${yesNo(formSeen)}`,
        elapsedMs: arrived.elapsedMs,
      };
    },
  ],
]);

const sessionOpensLogin = browserRow(async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const prepare = strict('situacion', SITUATIONS, cell(row, 'situacion'));
  const read = strict('resultado', RESULTS, cell(row, 'resultado'));
  const expected = `abre /login?tenant=alumno01: ${cell(row, 'resultado')}`;
  // Tener la sesión (o haberla cerrado) es PREPARACIÓN de la fila: si no se deja, la fila no se puede evaluar
  const before = requirePrepared(row, await prepare(page));
  const failure = await runSteps([['abrir /login?tenant=alumno01', () => page.goto(LOGIN_URL, { timeout: CEILING_MS })]]);
  if (failure) return conclude({ checks: [...before, check(false, expected, failure)] });
  const reading = await read(page);
  return conclude({ checks: [...before, check(reading.ok, expected, reading.observed)], notes: slowNote('la pantalla final', reading.elapsedMs, REFERENCE_MS.network), evidence: { elapsedMs: reading.elapsedMs } });
});

// ---------------------------------------------------------------------------------------------------------------------
// Esquema 4: cada campo no válido muestra su aviso y no se envía nada
// ---------------------------------------------------------------------------------------------------------------------

interface Submission {
  readonly sent: boolean;
  readonly then?: 'alert' | 'programs';
  readonly message?: string;
}

const SUBMISSIONS: ReadonlyMap<string, Submission> = new Map<string, Submission>([
  ['no se envía el formulario', { sent: false }],
  ['se envía y ve el aviso «Correo o contraseña incorrectos»', { sent: true, then: 'alert', message: 'Correo o contraseña incorrectos' }],
  ['se envía y llega a /programs', { sent: true, then: 'programs' }],
]);

const noticeText = (text: string | undefined): string => (text === undefined ? '(ninguno)' : `«${text}»`);

const validationBeforeSending = browserRow(async (row, { page, requests }) => {
  await resetTenants([TENANT_A]);
  const email = emailOf(cell(row, 'correo'));
  const password = passwordOf(cell(row, 'contraseña'));
  const wantEmail = noticeOf(cell(row, 'aviso_correo'));
  const wantPassword = noticeOf(cell(row, 'aviso_contraseña'));
  const submission = strict('envio', SUBMISSIONS, cell(row, 'envio'));
  const expectedEmail = `bajo el correo ve ${cell(row, 'aviso_correo')}`;
  const expectedPassword = `bajo la contraseña ve ${cell(row, 'aviso_contraseña')}`;
  const expectedSending = cell(row, 'envio');

  const failure = (await openLogin(page)) ?? (await fillCredentials(page, email, password));
  if (failure) return conclude({ checks: [check(false, `${expectedEmail}; ${expectedPassword}; ${expectedSending}`, failure)] });
  const typedEmail = await valueOf(emailField(page));
  const typedPasswordLength = (await valueOf(passwordField(page)))?.length;
  const pressFailure = await pressEnter(page);
  if (pressFailure) return conclude({ checks: [check(false, `${expectedEmail}; ${expectedPassword}; ${expectedSending}`, pressFailure)] });

  const readNotices = async () => ({ email: await fieldNotice(emailField(page), page), password: await fieldNotice(passwordField(page), page) });
  const matches = (read: Awaited<ReturnType<typeof readNotices>>): boolean => read.email.text === wantEmail && read.password.text === wantPassword;
  // Las filas que esperan un aviso lo esperan; las que no, se leen cuando el envío ya tuvo su resultado
  const timings: Record<string, number> = {};
  const extra: Check[] = [];
  const notes: string[] = [];
  let sendingReading = '';
  let sendingOk = false;
  let detail: string | undefined;

  if (!submission.sent) {
    const shown = await waitUntil(async () => matches(await readNotices()));
    timings.noticesMs = shown.elapsedMs;
    const held = await holdsFor(async () => requests.count() === 0 && pathOf(page) === '/login');
    sendingOk = held.held;
    sendingReading = held.held ? 'no se envió ninguna petición POST /api/auth/login en 2 s y sigue en /login' : `hubo ${requests.count()} petición(es) POST /api/auth/login o se dejó /login (ruta ${pathOf(page)})`;
    notes.push(...slowNote('el aviso de validación', shown.elapsedMs, REFERENCE_MS.local));
  } else {
    const result = await waitUntil(async () => requests.count() >= 1);
    const outcomeWait = submission.then === 'programs' ? await reachesPrograms(page) : await waitUntil(async () => (await alertReading(page)).message !== undefined);
    timings.resultMs = result.elapsedMs + outcomeWait.elapsedMs;
    const alert = await alertReading(page);
    detail = alert.detail;
    const sent = requests.count() >= 1;
    sendingOk = sent && (submission.then === 'programs' ? outcomeWait.reached : alert.message === submission.message);
    sendingReading = `${sent ? 'se envió' : 'no se envió'} la petición (${requests.count()}); ${submission.then === 'programs' ? `ruta ${pathOf(page)}` : `aviso de error ${alert.message === undefined ? 'ninguno' : `«${alert.message}»`}`}`;
    notes.push(...slowNote('el resultado del envío', timings.resultMs, REFERENCE_MS.network));
  }

  const final = await readNotices();
  const invalidNote = (name: string, want: string | undefined, invalid: string | undefined): readonly string[] =>
    want !== undefined && invalid !== 'true' ? [`la regla dice que el campo ${name} queda marcado como no válido y su estado de validez es ${invalid ?? 'ausente'}`] : want === undefined && invalid === 'true' ? [`el campo ${name} quedó marcado como no válido sin aviso esperado`] : [];
  const typedNote = trimmedEmailNote(email, typedEmail);
  extra.push(
    check(final.email.text === wantEmail, expectedEmail, noticeText(final.email.text)),
    check(final.password.text === wantPassword, expectedPassword, noticeText(final.password.text)),
    check(sendingOk, expectedSending, sendingReading),
  );
  return conclude({
    checks: extra,
    notes: [...notes, ...typedNote, ...invalidNote('correo', wantEmail, final.email.invalid), ...invalidNote('contraseña', wantPassword, final.password.invalid)],
    evidence: {
      ...timings,
      elapsedMs: timings.noticesMs ?? timings.resultMs,
      emailFieldValue: typedEmail,
      passwordFieldLength: typedPasswordLength,
      ariaInvalid: { email: final.email.invalid ?? null, password: final.password.invalid ?? null },
      ...detailEvidence(detail),
    },
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// Esquema 5: editar un campo borra los avisos
// ---------------------------------------------------------------------------------------------------------------------

const FIELDS: ReadonlyMap<string, (page: Page) => Locator> = new Map<string, (page: Page) => Locator>([
  ['«Correo electrónico»', emailField],
  ['«Contraseña»', passwordField],
]);

const editingClearsNotices = browserRow(async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const field = strict('campo', FIELDS, cell(row, 'campo'));
  const text = cell(row, 'texto');
  const expected = `escribe ${text} en el campo ${cell(row, 'campo')}: ya no ve ningún aviso bajo los campos`;
  const readNotices = async () => ({ email: await fieldNotice(emailField(page), page), password: await fieldNotice(passwordField(page), page) });
  const failure = (await openLogin(page)) ?? (await pressEnter(page));
  if (failure) return conclude({ checks: [check(false, expected, failure)] });
  const premise = await waitUntil(async () => {
    const read = await readNotices();
    return read.email.text === 'Campo obligatorio' && read.password.text === 'Campo obligatorio';
  });
  const before = await readNotices();
  const premiseCheck = check(premise.reached, 'Antes: ve «Campo obligatorio» bajo el correo y bajo la contraseña', `bajo el correo ${noticeText(before.email.text)}; bajo la contraseña ${noticeText(before.password.text)}`);
  // Los dos avisos tras «Entrar» con los campos vacíos son el «Dado» de esta fila (preparación); los evalúa el Esquema de validación
  requirePrepared(row, [premiseCheck]);
  const typeFailure = await runSteps([[`escribir ${text}`, () => field(page).pressSequentially(text, ACTION)]]);
  if (typeFailure) return conclude({ checks: [premiseCheck, check(false, expected, typeFailure)] });
  const cleared = await waitUntil(async () => {
    const read = await readNotices();
    return read.email.text === undefined && read.password.text === undefined;
  });
  const stays = cleared.reached ? await holdsFor(async () => (await readNotices()).email.text === undefined && (await readNotices()).password.text === undefined) : { held: false };
  const after = await readNotices();
  return conclude({
    checks: [premiseCheck, check(cleared.reached && stays.held, expected, `bajo el correo ${noticeText(after.email.text)}; bajo la contraseña ${noticeText(after.password.text)}${cleared.reached ? ` (a los ${cleared.elapsedMs} ms)` : ''}`)],
    notes: slowNote('desaparecer los avisos', cleared.elapsedMs, REFERENCE_MS.local),
    evidence: { elapsedMs: cleared.elapsedMs },
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// Esquema 6: el botón alterna la visibilidad de la contraseña
// ---------------------------------------------------------------------------------------------------------------------

const VISIBILITY: ReadonlyMap<string, string> = new Map<string, string>([
  ['oculta', 'password'],
  ['en claro', 'text'],
]);

const PRESSED: ReadonlyMap<string, string> = new Map<string, string>([
  ['no está marcado como pulsado', 'false'],
  ['está marcado como pulsado', 'true'],
]);

const toggleShowsPassword = browserRow(async (row, { page, requests }) => {
  await resetTenants([TENANT_A]);
  const typed = fromSteps(row, /ha escrito (\S+) en el campo «Contraseña»/);
  const times = Number(cell(row, 'veces'));
  if (!Number.isInteger(times) || times < 0) throw new Error(`celda sin interpretación: veces «${cell(row, 'veces')}»`);
  const wantType = strict('visibilidad', VISIBILITY, cell(row, 'visibilidad'));
  const wantText = quoted(cell(row, 'texto'));
  const wantName = quoted(cell(row, 'nombre'));
  const wantPressed = strict('pulsado', PRESSED, cell(row, 'pulsado'));
  const expectedAll = `pulsa el botón ${times} veces: la contraseña se ve ${cell(row, 'visibilidad')}; el botón muestra ${cell(row, 'texto')} y se llama ${cell(row, 'nombre')}; el botón ${cell(row, 'pulsado')}; el campo sigue conteniendo lo escrito y sigue en /login sin haber enviado nada`;

  const failure = (await openLogin(page)) ?? (await runSteps([['escribir la contraseña', () => passwordField(page).fill(typed, ACTION)]]));
  if (failure) return conclude({ checks: [check(false, expectedAll, failure)] });
  const clickFailure = await runSteps(Array.from({ length: times }, (_, index): readonly [string, () => Promise<unknown>] => [`pulsar el botón de la contraseña (pulsación ${index + 1})`, () => passwordToggle(page).click(ACTION)]));
  if (clickFailure) return conclude({ checks: [check(false, expectedAll, clickFailure)] });

  const read = async () => {
    const toggle = passwordToggle(page);
    return {
      type: await attrOf(passwordField(page), 'type'),
      text: await textOf(toggle),
      namedAsExpected: (await countOf(page.getByRole('button', { name: wantName, exact: true }))) > 0,
      pressed: await attrOf(toggle, 'aria-pressed'),
    };
  };
  let seen = await read();
  const settled = await waitUntil(async () => {
    seen = await read();
    return seen.type === wantType && seen.text === wantText && seen.namedAsExpected && seen.pressed === wantPressed;
  });
  const retained = await valueOf(passwordField(page));
  const quiet = await holdsFor(async () => requests.count() === 0 && pathOf(page) === '/login');
  const names = (await countOf(page.getByRole('button', { name: 'Ocultar contraseña', exact: true }))) > 0 ? 'Ocultar contraseña' : (await countOf(page.getByRole('button', { name: 'Mostrar contraseña', exact: true }))) > 0 ? 'Mostrar contraseña' : 'ninguno de los dos';
  return conclude({
    checks: [
      check(seen.type === wantType, `la contraseña se ve ${cell(row, 'visibilidad')}`, `campo de tipo ${seen.type ?? 'no legible'}`),
      check(seen.text === wantText && seen.namedAsExpected, `el botón muestra ${cell(row, 'texto')} y se llama ${cell(row, 'nombre')}`, `muestra «${seen.text ?? 'no legible'}» y su nombre accesible es «${names}»`),
      check(seen.pressed === wantPressed, `el botón ${cell(row, 'pulsado')}`, `estado de pulsado: ${seen.pressed ?? 'ausente'}`),
      check(retained === typed && quiet.held, 'el campo sigue conteniendo lo escrito y sigue en /login sin haber enviado nada', `${retained === typed ? 'conserva lo escrito' : 'no conserva lo escrito'} (${lengthOf(retained)}); ${quiet.held ? 'sin peticiones de acceso en 2 s' : `hubo ${requests.count()} petición(es) o se dejó /login`}; ruta ${pathOf(page)}`),
    ],
    notes: slowNote('el cambio de visibilidad', settled.elapsedMs, REFERENCE_MS.local),
    evidence: { elapsedMs: settled.elapsedMs },
  });
});

defineBrowserRows({
  story: 'US-LOGIN-006',
  surface: 'web',
  tenants: [TENANT_A],
  handlers: new Map<number, BrowserRowHandler>([
    [1, initialState],
    [2, optionLeadsToScreen],
    [3, sessionOpensLogin],
    [4, validationBeforeSending],
    [5, editingClearsNotices],
    [6, toggleShowsPassword],
  ]),
});
