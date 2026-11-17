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
  runSteps,
  alertReading,
  alertOf,
  slowNote,
  sleep,
  strict,
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

const conclusion = (observed: Observed, before: readonly Check[] = [], history: readonly string[] = [], extraEvidence: Readonly<Record<string, unknown>> = {}) =>
  conclude({
    checks: [...before, ...observed.checks.map((item, index) => (index === 0 && history.length > 0 ? { ...item, observed: `${history.join('; ')}; ${item.observed}` } : item))],
    notes: observed.notes,
    evidence: { ...observed.evidence, ...extraEvidence },
  });

const attempt = async (page: Page, email: string, password: string): Promise<string | undefined> => (await openLogin(page)) ?? (await fillCredentials(page, email, password)) ?? (await pressEnter(page));

/** Fallos previos por HTTP (después del reinicio), con el correo de la fila. Devuelve su descripción para el `observed`. */
const priorFailures = async (email: string, count: number): Promise<string> => {
  const done = await failedLogins(TENANT_A, email, count);
  return `Previos: ${count} fallos${count === 0 ? '' : ` (HTTP ${done.map((item) => item.status).join(', ')})`}`;
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
  return conclusion(observed, [], [], { emailFieldValue: typed });
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

  const form = page.getByTestId('login-form');
  const reading = { busy: undefined as string | undefined, disabled: false, title: undefined as string | undefined, spinner: false, beforeRelease: false, atMs: 0 };
  await waitUntil(async () => {
    reading.busy = await attrOf(form, 'aria-busy');
    reading.disabled = !(await enterButton(page).first().isEnabled({ timeout: 500 }));
    reading.title = await attrOf(enterButton(page), 'title');
    reading.spinner = await isVisible(enterButton(page).getByTestId('spinner'));
    reading.beforeRelease = gate.releasedAt === undefined;
    reading.atMs = Math.round(performance.now() - clickedAt);
    return (reading.busy === 'true' && reading.disabled && reading.title === 'Procesando…') || gate.releasedAt !== undefined;
  });
  const busyOk = reading.busy === 'true' && reading.disabled && reading.title === 'Procesando…' && reading.beforeRelease;
  const result = await awaitLoginResult(page);
  const arrivedOk = messageMatches(MESSAGE_OK, result);
  const releasedAfterMs = gate.releasedAt === undefined ? null : Math.round(gate.releasedAt - clickedAt);
  return conclude({
    checks: [
      check(
        busyOk,
        expectedBusy,
        `a los ${reading.atMs} ms de pulsar${reading.beforeRelease ? ', antes de liberar la respuesta' : ', DESPUÉS de liberar la respuesta'}: formulario ocupado ${reading.busy ?? 'sin dato'}, «Entrar» ${reading.disabled ? 'deshabilitado' : 'habilitado'}, explicación ${reading.title === undefined ? 'ninguna' : `«${reading.title}»`}`,
      ),
      check(arrivedOk, expectedAfter, describeResult(result, page)),
    ],
    notes: slowNote('el mensaje tras la respuesta', result.elapsedMs, REFERENCE_MS.network),
    evidence: { injectedDelayMs: delayMs, releasedAfterMs, busyObservedAtMs: reading.atMs, spinnerVisibleInButton: reading.spinner, elapsedMs: result.elapsedMs, loginRequestsSent: requests.count() },
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
  const previous = await priorFailures(email, countOfCell(row, 'fallos_previos'));
  const failure = await attempt(page, email, password);
  const message = 'Correo o contraseña incorrectos';
  if (failure) return conclude({ checks: [check(false, `ve el aviso de error con el mensaje «${message}»`, `${previous}; ${failure}`)] });
  const observed = await observeSubmission(page, message, 'aviso', { staysOnLogin: { email, password } }, snapshot);
  return conclusion(observed, [], [previous]);
});

/** Esquema 5: según los fallos previos, el aviso de credenciales incorrectas o el de cuenta bloqueada. */
const fifthFailureLocks = browserRow(async (row, { page, snapshot }) => {
  await resetTenants([TENANT_A]);
  const email = emailOf(cell(row, 'correo'));
  const password = passwordOf(cell(row, 'contraseña'));
  const message = quoted(cell(row, 'mensaje'));
  const previous = await priorFailures(email, countOfCell(row, 'fallos_previos'));
  const failure = await attempt(page, email, password);
  if (failure) return conclude({ checks: [check(false, `ve el mensaje «${message}»`, `${previous}; ${failure}`)] });
  const observed = await observeSubmission(page, message, 'mensaje', { staysOnLogin: { password } }, snapshot);
  return conclusion(observed, [], [previous]);
});

/** Esquema 6: con 3 o 4 fallos la cuenta sigue activa y la contraseña correcta entra. */
const belowFiveStillEnters = browserRow(async (row, { page, snapshot }) => {
  await resetTenants([TENANT_A]);
  const email = fromSteps(row, /^Dado que .*, (\S+@\S+) acumula/);
  const password = fromSteps(row, /escribe ese correo y la contraseña (\S+)$/);
  const previous = await priorFailures(email, countOfCell(row, 'fallos_previos'));
  const failure = await attempt(page, email, password);
  if (failure) return conclude({ checks: [check(false, `ve el mensaje «${MESSAGE_OK}»; ${PROGRAMS}`, `${previous}; ${failure}`)] });
  const observed = await observeSubmission(page, MESSAGE_OK, 'mensaje', { reachesPrograms: true }, snapshot);
  return conclusion(observed, [], [previous]);
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
  const premise = await accountIs(`la cuenta ${email} está bloqueada`, email, 'locked', true);
  const failure = await attempt(page, email, password);
  if (failure) return conclude({ checks: [premise, check(false, `ve el mensaje «${LOCKED_MESSAGE}»`, failure)] });
  const observed = await observeSubmission(page, LOCKED_MESSAGE, 'mensaje', { staysOnLogin: { password } }, snapshot);
  return conclusion(observed, [premise]);
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

const ACCOUNT_STATES: ReadonlyMap<string, (page: Page, emailCell: string) => Promise<Prepared>> = new Map<string, (page: Page, emailCell: string) => Promise<Prepared>>([
  [
    'pendiente de aprobación',
    async (page, emailCell) => {
      if (emailCell === '(cuenta recién solicitada)') {
        const requested = await requestAccountThroughForm(page);
        return { email: requested.email, premises: [requested.check, await accountIs(`${requested.email} está pendiente de aprobación`, requested.email, 'pending', true)] };
      }
      return { email: emailCell, premises: [await accountIs(`la cuenta ${emailCell} está pendiente de aprobación`, emailCell, 'pending', true)] };
    },
  ],
  [
    'desactivada',
    async (_page, emailCell) => {
      const patch = await setAccountActive(TENANT_A, emailCell, false);
      return { email: emailCell, premises: [check(patch.status === 200, `Antes: el administrador desactiva ${emailCell}`, `PATCH /api/admin/users respondió ${patch.status}`), await accountIs(`la cuenta ${emailCell} está desactivada`, emailCell, 'active', false)] };
    },
  ],
  [
    'desactivada y vuelta a activar',
    async (_page, emailCell) => {
      const off = await setAccountActive(TENANT_A, emailCell, false);
      const on = await setAccountActive(TENANT_A, emailCell, true);
      return {
        email: emailCell,
        premises: [
          check(off.status === 200 && on.status === 200, `Antes: el administrador desactiva y vuelve a activar ${emailCell}`, `PATCH /api/admin/users respondió ${off.status} y después ${on.status}`),
          await accountIs(`la cuenta ${emailCell} está activa`, emailCell, 'active', true),
        ],
      };
    },
  ],
]);

const pendingOrDisabled = browserRow(async (row, { page, snapshot }) => {
  await resetTenants([TENANT_A]);
  const message = quoted(cell(row, 'mensaje'));
  const prepared = await strict('estado', ACCOUNT_STATES, cell(row, 'estado'))(page, cell(row, 'correo'));
  const password = passwordOf(cell(row, 'contraseña'));
  if (prepared.premises.some((item) => !item.ok)) return conclude({ checks: [...prepared.premises, check(false, `ve el mensaje «${message}»`, 'no se llegó a escribir: no se cumple lo que la historia da por hecho')] });
  const failure = await attempt(page, prepared.email, password);
  if (failure) return conclude({ checks: [...prepared.premises, check(false, `ve el mensaje «${message}»`, failure)] });
  const observed = await observeSubmission(page, message, 'mensaje', {}, snapshot);
  return conclusion(observed, prepared.premises);
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
  const premise = check(shown.reached, `Antes: ve el aviso «${WRONG_NOTICE}»`, shown.reached ? `aviso «${WRONG_NOTICE}»` : `no apareció el aviso (aviso visible: ${(await alertReading(page)).message ?? 'ninguno'})`);
  if (!shown.reached) return conclude({ checks: [premise, check(false, expected, 'no se llegó a cambiar el campo: no se cumple lo que la historia da por hecho')] });
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
