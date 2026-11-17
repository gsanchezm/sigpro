import type { Locator, Page } from '@playwright/test';
import { uniqueEmail, usersByEmail } from '../../support/api';
import { NEW_ACCOUNT_PASSWORD, TENANT_A, failedLogins, resetTenants, setAccountActive } from '../../support/prepare';
import { defineBrowserRows, type BrowserRowHandler } from '../../support/rows';
import {
  ACTION,
  CEILING_MS,
  REFERENCE_MS,
  SUCCESS_MESSAGE,
  attrOf,
  awaitLoginResult,
  browserRow,
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
  isDisabled,
  isVisible,
  lengthOf,
  messageMatches,
  onLoginForm,
  openLogin,
  passwordField,
  passwordOf,
  pathOf,
  pressEnter,
  quoted,
  reachesPrograms,
  requirePrepared,
  runSteps,
  alertReading,
  alertOf,
  slowNote,
  sleep,
  strict,
  TESTID,
  trimmedEmailNote,
  valueOf,
  waitUntil,
  type Check,
  type LoginResult,
} from './common';

// US-LOGIN-007 — Iniciar sesión: entrar en Programas o ver por qué no se puede. Preparación de cada fila: reinicio del tenant
// alumno01 y /login?tenant=alumno01 en un contexto sin sesión; los fallos previos y la desactivación de cuentas se provocan por
// HTTP después del reinicio (como permite la historia) y la cuenta recién solicitada se pide en /register con el formulario.

const PROGRAMS = 'llega a /programs';

/** Lo que se hace tras ver el resultado de un envío. */
interface Aftermath {
  /** «Y llega a /programs» tras el mensaje de sesión iniciada. */
  readonly reachesPrograms?: boolean;
  /** «Y sigue en /login sin sesión», con el correo escrito si la historia lo dice. */
  readonly staysOnLogin?: { readonly email?: string; readonly password?: string };
}

interface Observed {
  readonly checks: readonly Check[];
  readonly notes: readonly string[];
  readonly evidence: Readonly<Record<string, unknown>>;
  readonly result: LoginResult;
}

/** Pulsa «Entrar» ya hecho: espera el resultado y comprueba el mensaje y lo que la historia dice que ocurre después. */
const observeSubmission = async (page: Page, message: string, wording: 'aviso' | 'mensaje', aftermath: Aftermath, snapshot: () => Promise<void>): Promise<Observed> => {
  const result = await awaitLoginResult(page);
  const matched = messageMatches(message, result);
  const checks: Check[] = [check(matched, `ve ${wording === 'aviso' ? 'el aviso de error con el mensaje' : 'el mensaje'} «${message}»`, describeResult(result, page))];
  const notes: string[] = [...slowNote('el resultado del envío', result.elapsedMs, REFERENCE_MS.network)];
  const evidence: Record<string, unknown> = { elapsedMs: result.elapsedMs, ...detailEvidence(result.detail) };

  if (aftermath.reachesPrograms === true) {
    const arrived = await reachesPrograms(page, matched ? CEILING_MS : 2_000);
    checks.push(check(arrived.reached, PROGRAMS, `ruta ${pathOf(page)}${arrived.reached ? ` (${arrived.elapsedMs} ms después del mensaje)` : ''}`));
    notes.push(...slowNote('llegar a /programs', arrived.elapsedMs, REFERENCE_MS.network));
  }
  if (aftermath.staysOnLogin) {
    const stays = await holdsFor(() => onLoginForm(page));
    const email = await valueOf(emailField(page));
    const password = await valueOf(passwordField(page));
    const wantsEmail = aftermath.staysOnLogin.email;
    const emailKept = wantsEmail === undefined ? true : email === wantsEmail;
    checks.push(check(stays.held, 'sigue en /login', stays.held ? 'sigue en /login (observado 2 s)' : `ruta ${pathOf(page)}${stays.brokeAtMs === undefined ? '' : ` a los ${stays.brokeAtMs} ms`}`));
    if (wantsEmail !== undefined) checks.push(check(emailKept, 'con ese correo escrito', `correo del campo ${email === undefined ? 'no legible' : emailKept ? 'igual al escrito' : `distinto del escrito («${email}»)`}`));
    if (aftermath.staysOnLogin.password !== undefined) {
      const passwordKept = password === aftermath.staysOnLogin.password;
      evidence.passwordRetained = `${passwordKept ? 'sí' : 'no'} (${lengthOf(password)})`;
      if (!passwordKept) notes.push('la regla dice que el formulario conserva el correo y la contraseña escritos y la contraseña no se conserva');
    }
    await snapshot();
    // «Sin sesión», por comportamiento y al final: abrir /programs en esta pestaña acaba en /login
    checks.push({ ...(await hasNoSession(page)), expected: 'sin sesión' });
  }
  return { checks, notes, evidence, result };
};

const conclusion = (observed: Observed, before: readonly Check[] = [], extraEvidence: Readonly<Record<string, unknown>> = {}, extraNotes: readonly string[] = []) =>
  conclude({
    checks: [...before, ...observed.checks],
    notes: [...observed.notes, ...extraNotes],
    evidence: { ...observed.evidence, ...extraEvidence },
  });

const attempt = async (page: Page, email: string, password: string): Promise<string | undefined> => (await openLogin(page)) ?? (await fillCredentials(page, email, password)) ?? (await pressEnter(page));

/**
 * Fallos previos por HTTP (después del reinicio), con el correo de la fila, y la premisa «acumula N intentos fallidos consecutivos»:
 * cada intento previo se rechazó como un intento fallido. Los cuatro primeros son siempre 401 (con 4 la cuenta sigue activa); del 5.º
 * en adelante vale 401 o 423, porque qué ocurre en el 5.º es justo lo que evalúan las filas del Esquema 5 y no se puede suponer aquí.
 */
const priorFailures = async (who: string, email: string, count: number): Promise<Check> => {
  const done = await failedLogins(TENANT_A, email, count);
  const codes = done.map((item) => item.status);
  const ok = codes.every((code, index) => (index < 4 ? code === 401 : code === 401 || code === 423));
  return check(ok, `Antes: ${who} acumula ${count} intentos fallidos consecutivos`, `Previos: ${count} fallos${count === 0 ? '' : ` (HTTP ${codes.join(', ')})`}`);
};

const countOfCell = (row: Parameters<BrowserRowHandler>[0], key: string): number => {
  const count = Number(cell(row, key));
  if (!Number.isInteger(count) || count < 0) throw new Error(`celda sin interpretación: ${key} «${cell(row, key)}»`);
  return count;
};

const MESSAGE_OK = SUCCESS_MESSAGE;

// ---------------------------------------------------------------------------------------------------------------------
// Esquema 1: una cuenta activa entra en «Programas»
// ---------------------------------------------------------------------------------------------------------------------

const activeAccountEnters = browserRow(async (row, { page, snapshot }) => {
  await resetTenants([TENANT_A]);
  const email = emailOf(cell(row, 'correo'));
  const password = passwordOf(cell(row, 'contraseña'));
  const failure = await attempt(page, email, password);
  if (failure) return conclude({ checks: [check(false, `ve el mensaje «${MESSAGE_OK}»; ${PROGRAMS}`, failure)] });
  const typed = await valueOf(emailField(page));
  const observed = await observeSubmission(page, MESSAGE_OK, 'mensaje', { reachesPrograms: true }, snapshot);
  return conclusion(observed, [], { emailFieldValue: typed }, trimmedEmailNote(email, typed));
});

// ---------------------------------------------------------------------------------------------------------------------
// Esquema 2: una cuenta con segundo factor pasa a la verificación
// ---------------------------------------------------------------------------------------------------------------------

const secondFactor = browserRow(async (row, { page, snapshot }) => {
  await resetTenants([TENANT_A]);
  const title = quoted(cell(row, 'titulo'));
  const expectedTitle = `ve el título ${cell(row, 'titulo')}`;
  const failure = await attempt(page, emailOf(cell(row, 'correo')), passwordOf(cell(row, 'contraseña')));
  if (failure) return conclude({ checks: [check(false, `${expectedTitle}; no tiene sesión iniciada hasta completar ese paso`, failure)] });
  const shown = await waitUntil(() => isVisible(page.getByRole('heading', { name: title, exact: true })));
  const stays = await holdsFor(async () => pathOf(page) !== '/programs');
  await snapshot();
  const noSession = await hasNoSession(page);
  return conclude({
    checks: [
      check(shown.reached, expectedTitle, shown.reached ? `título «${title}» visible (${shown.elapsedMs} ms)` : `no apareció el título «${title}» en ${CEILING_MS} ms (ruta ${pathOf(page)})`),
      check(stays.held && noSession.ok, 'no tiene sesión iniciada hasta completar ese paso', `${stays.held ? 'no entró en /programs en 2 s' : 'entró en /programs'}; ${noSession.observed}`),
    ],
    notes: slowNote('el paso de verificación', shown.elapsedMs, REFERENCE_MS.network),
    evidence: { elapsedMs: shown.elapsedMs },
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// Esquema 3: mientras espera la respuesta no se puede volver a enviar
// ---------------------------------------------------------------------------------------------------------------------

const DELAYS: ReadonlyMap<string, number> = new Map<string, number>([
  ['1 segundo', 1_000],
  ['3 segundos', 3_000],
]);

const PROCESSING = 'Procesando…';
const SAMPLE_MS = 50;
/** Margen tras el retraso inyectado para dar por perdida la liberación (si la petición nunca llega, el muestreo no es infinito). */
const SAMPLING_GRACE_MS = 2_000;

interface BusySample {
  readonly atMs: number;
  readonly busy: boolean;
  readonly disabled: boolean;
  readonly explained: boolean;
  readonly spinner: boolean;
}

const busyWhileWaiting = browserRow(async (row, { page, requests }) => {
  await resetTenants([TENANT_A]);
  const delayMs = strict('espera', DELAYS, cell(row, 'espera'));
  const [, email, password] = /ha escrito (\S+) y (\S+)$/.exec(row.resolvedSteps[0] ?? '') ?? [];
  if (email === undefined || password === undefined) throw new Error(`celda sin interpretación: no se encontraron el correo y la contraseña en el primer paso de ${row.rowId}`);
  const expectedBusy = 'durante la espera el formulario está ocupado y «Entrar» está deshabilitado con la explicación «Procesando…»';
  const expectedAfter = `al llegar la respuesta ve el mensaje «${MESSAGE_OK}»`;

  // La prueba retrasa la respuesta de POST /api/auth/login en el navegador (retrasa y continúa; no cambia el caos del tenant)
  const gate: { releasedAt?: number } = {};
  await page.route(
    (url) => url.pathname === '/api/auth/login',
    async (route) => {
      await sleep(delayMs);
      gate.releasedAt = performance.now();
      await route.continue();
    },
  );
  const failure = (await openLogin(page)) ?? (await fillCredentials(page, email, password));
  if (failure) return conclude({ checks: [check(false, `${expectedBusy}; ${expectedAfter}`, failure)] });
  const clickedAt = performance.now();
  const clickFailure = await pressEnter(page);
  if (clickFailure) return conclude({ checks: [check(false, `${expectedBusy}; ${expectedAfter}`, clickFailure)] });

  // «Durante la espera» es una condición MANTENIDA: se muestrea cada ~50 ms desde que se pulsa hasta que la prueba libera la
  // respuesta retrasada, y el veredicto exige que TODAS las muestras cumplan las tres condiciones del paso. Una lectura que cruza
  // la liberación no cuenta (ya no es «durante la espera»).
  const form = page.getByTestId(TESTID.loginForm);
  const submit = enterButton(page);
  const samples: BusySample[] = [];
  const sampleUntil = clickedAt + delayMs + SAMPLING_GRACE_MS;
  while (gate.releasedAt === undefined && performance.now() < sampleUntil) {
    const sample: BusySample = {
      atMs: Math.round(performance.now() - clickedAt),
      busy: (await attrOf(form, 'aria-busy')) === 'true',
      disabled: await isDisabled(submit),
      explained: (await attrOf(submit, 'title')) === PROCESSING,
      spinner: await isVisible(submit.getByTestId(TESTID.spinner)),
    };
    if (gate.releasedAt === undefined) samples.push(sample);
    await sleep(SAMPLE_MS);
  }
  const requestsAtRelease = requests.count();
  const minSamples = Math.max(3, Math.floor(delayMs / 200));
  const count = (pick: (sample: BusySample) => boolean): number => samples.filter(pick).length;
  const everyMet = samples.length >= minSamples && samples.every((sample) => sample.busy && sample.disabled && sample.explained);
  const releasedAfterMs = gate.releasedAt === undefined ? null : Math.round(gate.releasedAt - clickedAt);
  const result = await awaitLoginResult(page);
  const arrivedOk = messageMatches(MESSAGE_OK, result);
  return conclude({
    checks: [
      check(
        everyMet,
        expectedBusy,
        `${samples.length} muestras entre los ${samples[0]?.atMs ?? '?'} y los ${samples.at(-1)?.atMs ?? '?'} ms de pulsar, antes de liberar la respuesta (liberada a los ${releasedAfterMs ?? '?'} ms; se exigían al menos ${minSamples}): formulario ocupado en ${count((s) => s.busy)}/${samples.length}, «Entrar» deshabilitado en ${count((s) => s.disabled)}/${samples.length}, explicación «${PROCESSING}» en ${count((s) => s.explained)}/${samples.length}`,
      ),
      check(arrivedOk, expectedAfter, describeResult(result, page)),
    ],
    notes: slowNote('el mensaje tras la respuesta', result.elapsedMs, REFERENCE_MS.network),
    evidence: {
      injectedDelayMs: delayMs,
      releasedAfterMs,
      samples: samples.length,
      samplesMeetingAllConditions: count((s) => s.busy && s.disabled && s.explained),
      firstSampleAtMs: samples[0]?.atMs ?? null,
      lastSampleAtMs: samples.at(-1)?.atMs ?? null,
      observedWaitMs: samples.length === 0 ? 0 : (samples.at(-1)?.atMs ?? 0) - (samples[0]?.atMs ?? 0),
      // Dato de las Reglas (indicador de carga) y del título del Esquema (no se puede volver a enviar): evidencia, no veredicto
      spinnerVisibleInSamples: count((s) => s.spinner),
      loginRequestsWhenReleased: requestsAtRelease,
      elapsedMs: result.elapsedMs,
    },
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// Esquemas 4 y 5: credenciales incorrectas con menos de 5 fallos; el quinto fallo bloquea
// ---------------------------------------------------------------------------------------------------------------------

/** Esquema 4: el aviso «Correo o contraseña incorrectos»; sigue en /login sin sesión, con el correo escrito. */
const wrongBelowFive = browserRow(async (row, { page, snapshot }) => {
  await resetTenants([TENANT_A]);
  const email = emailOf(cell(row, 'correo'));
  const password = passwordOf(cell(row, 'contraseña'));
  const previous = requirePrepared(row, [await priorFailures(cell(row, 'correo'), email, countOfCell(row, 'fallos_previos'))]);
  const failure = await attempt(page, email, password);
  const message = 'Correo o contraseña incorrectos';
  if (failure) return conclude({ checks: [...previous, check(false, `ve el aviso de error con el mensaje «${message}»`, failure)] });
  const observed = await observeSubmission(page, message, 'aviso', { staysOnLogin: { email, password } }, snapshot);
  return conclusion(observed, previous);
});

/** Esquema 5: según los fallos previos, el aviso de credenciales incorrectas o el de cuenta bloqueada. */
const fifthFailureLocks = browserRow(async (row, { page, snapshot }) => {
  await resetTenants([TENANT_A]);
  const email = emailOf(cell(row, 'correo'));
  const password = passwordOf(cell(row, 'contraseña'));
  const message = quoted(cell(row, 'mensaje'));
  const previous = requirePrepared(row, [await priorFailures(cell(row, 'correo'), email, countOfCell(row, 'fallos_previos'))]);
  const failure = await attempt(page, email, password);
  if (failure) return conclude({ checks: [...previous, check(false, `ve el mensaje «${message}»`, failure)] });
  const observed = await observeSubmission(page, message, 'mensaje', { staysOnLogin: { password } }, snapshot);
  return conclusion(observed, previous);
});

/** Esquema 6: con 3 o 4 fallos la cuenta sigue activa y la contraseña correcta entra. */
const belowFiveStillEnters = browserRow(async (row, { page, snapshot }) => {
  await resetTenants([TENANT_A]);
  const email = fromSteps(row, /^Dado que .*, (\S+@\S+) acumula/);
  const password = fromSteps(row, /escribe ese correo y la contraseña (\S+)$/);
  const previous = requirePrepared(row, [await priorFailures(email, email, countOfCell(row, 'fallos_previos'))]);
  const failure = await attempt(page, email, password);
  if (failure) return conclude({ checks: [...previous, check(false, `ve el mensaje «${MESSAGE_OK}»; ${PROGRAMS}`, failure)] });
  const observed = await observeSubmission(page, MESSAGE_OK, 'mensaje', { reachesPrograms: true }, snapshot);
  return conclusion(observed, previous);
});

// ---------------------------------------------------------------------------------------------------------------------
// Esquema 7: una cuenta bloqueada no entra ni con su contraseña
// ---------------------------------------------------------------------------------------------------------------------

const LOCKED_MESSAGE = 'Cuenta bloqueada tras varios intentos fallidos. Contacta con un administrador.';

/** Estado de una cuenta del tenant, leído por HTTP (la historia lo da por hecho antes de actuar). */
const accountIs = async (label: string, email: string, key: 'locked' | 'pending' | 'active', value: boolean): Promise<Check> => {
  const user = (await usersByEmail(TENANT_A)).get(email);
  return check(user !== undefined && user[key] === value, `Antes: ${label}`, user === undefined ? `${email} no está en el listado de usuarios` : `${key} ${String(user[key])}`);
};

const lockedAccount = browserRow(async (row, { page, snapshot }) => {
  await resetTenants([TENANT_A]);
  const email = fromSteps(row, /la cuenta (\S+@\S+) está bloqueada/);
  const password = passwordOf(cell(row, 'contraseña'));
  // La cuenta bloqueada es PREPARACIÓN (estado del seed tras el reinicio): si no está bloqueada, la fila no se puede evaluar
  const premise = requirePrepared(row, [await accountIs(`la cuenta ${email} está bloqueada`, email, 'locked', true)]);
  const failure = await attempt(page, email, password);
  if (failure) return conclude({ checks: [...premise, check(false, `ve el mensaje «${LOCKED_MESSAGE}»`, failure)] });
  const observed = await observeSubmission(page, LOCKED_MESSAGE, 'mensaje', { staysOnLogin: { password } }, snapshot);
  return conclusion(observed, premise);
});

// ---------------------------------------------------------------------------------------------------------------------
// Esquema 8: cuenta pendiente de aprobación o desactivada
// ---------------------------------------------------------------------------------------------------------------------

/** Solicita una cuenta con el formulario de /register?tenant=alumno01, con un correo nuevo y la contraseña de la historia. */
const requestAccountThroughForm = async (page: Page): Promise<{ readonly email: string; readonly check: Check }> => {
  const email = uniqueEmail('nueva').replace(/@.*$/, '@organizacion.es');
  const failure = await runSteps([
    ['abrir /register?tenant=alumno01', () => page.goto('/register?tenant=alumno01', { timeout: CEILING_MS })],
    ['escribir el nombre', () => page.getByLabel('Nombre', { exact: true }).fill('Ana', ACTION)],
    ['escribir los apellidos', () => page.getByLabel('Apellidos', { exact: true }).fill('Prueba', ACTION)],
    ['escribir el correo corporativo', () => page.getByLabel('Correo corporativo', { exact: true }).fill(email, ACTION)],
    ['escribir la organización', () => page.getByLabel('Organización / Unidad', { exact: true }).fill('Unidad de pruebas', ACTION)],
    ['escribir la contraseña', () => page.getByLabel('Contraseña', { exact: true }).fill(NEW_ACCOUNT_PASSWORD, ACTION)],
    ['confirmar la contraseña', () => page.getByLabel('Confirmar contraseña', { exact: true }).fill(NEW_ACCOUNT_PASSWORD, ACTION)],
    ['aceptar las condiciones', () => page.getByRole('checkbox', { name: /He leído y acepto/ }).check(ACTION)],
    ['pulsar «Enviar solicitud»', () => page.getByRole('button', { name: 'Enviar solicitud', exact: true }).click(ACTION)],
    ['ver «Solicitud enviada»', () => page.getByRole('heading', { name: 'Solicitud enviada', exact: true }).waitFor({ timeout: CEILING_MS })],
  ]);
  return { email, check: check(failure === undefined, 'Antes: solicita la cuenta en /register?tenant=alumno01', failure ?? 'solicitud enviada con el formulario («Solicitud enviada»)') };
};

interface Prepared {
  readonly email: string;
  readonly premises: readonly Check[];
}

/** Las cuentas que citan los ejemplos del Esquema 8: dos del seed y la recién solicitada en la propia fila. */
const REQUESTED = '(cuenta recién solicitada)';
const ACCOUNTS: ReadonlyMap<string, string> = new Map<string, string>([
  ['pendiente@sigpro.test', 'pendiente@sigpro.test'],
  ['auditor@sigpro.test', 'auditor@sigpro.test'],
  [REQUESTED, REQUESTED],
]);

const ACCOUNT_STATES: ReadonlyMap<string, (page: Page, account: string) => Promise<Prepared>> = new Map<string, (page: Page, account: string) => Promise<Prepared>>([
  [
    'pendiente de aprobación',
    async (page, account) => {
      if (account === REQUESTED) {
        const requested = await requestAccountThroughForm(page);
        return { email: requested.email, premises: [requested.check, await accountIs(`${requested.email} está pendiente de aprobación`, requested.email, 'pending', true)] };
      }
      return { email: account, premises: [await accountIs(`la cuenta ${account} está pendiente de aprobación`, account, 'pending', true)] };
    },
  ],
  [
    'desactivada',
    async (_page, account) => {
      const patch = await setAccountActive(TENANT_A, account, false);
      return { email: account, premises: [check(patch.status === 200, `Antes: el administrador desactiva ${account}`, `PATCH /api/admin/users respondió ${patch.status}`), await accountIs(`la cuenta ${account} está desactivada`, account, 'active', false)] };
    },
  ],
  [
    'desactivada y vuelta a activar',
    async (_page, account) => {
      const off = await setAccountActive(TENANT_A, account, false);
      const on = await setAccountActive(TENANT_A, account, true);
      return {
        email: account,
        premises: [
          check(off.status === 200 && on.status === 200, `Antes: el administrador desactiva y vuelve a activar ${account}`, `PATCH /api/admin/users respondió ${off.status} y después ${on.status}`),
          await accountIs(`la cuenta ${account} está activa`, account, 'active', true),
        ],
      };
    },
  ],
]);

const pendingOrDisabled = browserRow(async (row, { page, snapshot }) => {
  await resetTenants([TENANT_A]);
  const message = quoted(cell(row, 'mensaje'));
  // El correo es una cuenta del seed o la recién solicitada: cualquier otro texto lanza «celda sin interpretación»
  const account = strict('correo', ACCOUNTS, cell(row, 'correo'));
  const prepared = await strict('estado', ACCOUNT_STATES, cell(row, 'estado'))(page, account);
  const password = passwordOf(cell(row, 'contraseña'));
  // Dejar la cuenta pendiente o desactivada es PREPARACIÓN: si no queda así, la fila no se puede evaluar
  const premises = requirePrepared(row, prepared.premises);
  const failure = await attempt(page, prepared.email, password);
  if (failure) return conclude({ checks: [...premises, check(false, `ve el mensaje «${message}»`, failure)] });
  const observed = await observeSubmission(page, message, 'mensaje', {}, snapshot);
  return conclusion(observed, premises);
});

// ---------------------------------------------------------------------------------------------------------------------
// Esquema 9: el aviso de error desaparece al corregir los datos
// ---------------------------------------------------------------------------------------------------------------------

const WRONG_NOTICE = 'Correo o contraseña incorrectos';

const FIELDS: ReadonlyMap<string, (page: Page) => Locator> = new Map<string, (page: Page) => Locator>([
  ['«Correo electrónico»', emailField],
  ['«Contraseña»', passwordField],
]);

const noticeDisappears = browserRow(async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const email = fromSteps(row, /ha escrito (\S+@\S+) con la contraseña incorrecta/);
  const password = passwordOf('incorrecta');
  const field = strict('campo', FIELDS, cell(row, 'campo'));
  const expected = `cambia el contenido del campo ${cell(row, 'campo')}: deja de ver el aviso de error`;
  const failure = await attempt(page, email, password);
  if (failure) return conclude({ checks: [check(false, expected, failure)] });
  const shown = await waitUntil(async () => (await alertReading(page)).message === WRONG_NOTICE);
  // El aviso visible antes de corregir es el «Dado» de esta fila (preparación); el rechazo lo evalúan los Esquemas 4 y 5
  const [premise] = requirePrepared(row, [check(shown.reached, `Antes: ve el aviso «${WRONG_NOTICE}»`, shown.reached ? `aviso «${WRONG_NOTICE}»` : `no apareció el aviso (aviso visible: ${(await alertReading(page)).message ?? 'ninguno'})`)]);
  const changeFailure = await runSteps([['cambiar el contenido del campo', () => field(page).pressSequentially('x', ACTION)]]);
  if (changeFailure) return conclude({ checks: [premise, check(false, expected, changeFailure)] });
  const gone = await waitUntil(async () => !(await isVisible(alertOf(page))));
  const stays = gone.reached ? await holdsFor(async () => !(await isVisible(alertOf(page)))) : { held: false };
  return conclude({
    checks: [premise, check(gone.reached && stays.held, expected, gone.reached ? `el aviso desapareció a los ${gone.elapsedMs} ms` : `el aviso sigue visible tras ${CEILING_MS} ms: «${(await alertReading(page)).message ?? 'ninguno'}»`)],
    notes: slowNote('desaparecer el aviso', gone.elapsedMs, REFERENCE_MS.local),
    evidence: { elapsedMs: gone.elapsedMs },
  });
});

defineBrowserRows({
  story: 'US-LOGIN-007',
  surface: 'web',
  tenants: [TENANT_A],
  handlers: new Map<number, BrowserRowHandler>([
    [1, activeAccountEnters],
    [2, secondFactor],
    [3, busyWhileWaiting],
    [4, wrongBelowFive],
    [5, fifthFailureLocks],
    [6, belowFiveStillEnters],
    [7, lockedAccount],
    [8, pendingOrDisabled],
    [9, noticeDisappears],
  ]),
});
