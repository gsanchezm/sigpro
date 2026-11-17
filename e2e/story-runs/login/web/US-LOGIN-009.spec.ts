import type { Page } from '@playwright/test';
import { TENANT_A, resetTenants } from '../../support/prepare';
import { defineBrowserRows, type BrowserRowHandler } from '../../support/rows';
import {
  CEILING_MS,
  REFERENCE_MS,
  browserRow,
  cell,
  check,
  conclude,
  detailEvidence,
  detailOf,
  emailField,
  fillCredentials,
  hasNoSession,
  holdsFor,
  isVisible,
  lengthOf,
  onLoginForm,
  openLogin,
  passwordField,
  runSteps,
  sleep,
  slowNote,
  ssoButton,
  strict,
  textOf,
  valueOf,
  waitUntil,
  type Check,
} from './common';

// US-LOGIN-009 — Avisar de que el acceso con certificado digital o SSO no está disponible. Preparación de cada fila: reinicio
// del tenant y /login?tenant=alumno01 en un contexto sin sesión. El aviso informativo se localiza por su mensaje dentro de la
// región de avisos de tipo informativo (el único rastro de que es «informativo»).

const MESSAGE = 'SSO no disponible en el prototipo';

const infoToast = (page: Page) => page.getByTestId('toast-info');
const messageIn = (page: Page) => infoToast(page).getByText(MESSAGE, { exact: true });

interface Written {
  readonly email: string;
  readonly password: string;
}

/** Lo que el formulario tiene escrito antes de pulsar el botón: la celda `escrito`. */
const WRITTEN: ReadonlyMap<string, Written> = new Map<string, Written>([
  ['(vacío)', { email: '', password: '' }],
  ['con el correo gestor@sigpro.test y la contraseña Gestor1234!', { email: 'gestor@sigpro.test', password: 'Gestor1234!' }],
]);

/** Esquema 1: el botón avisa, no inicia sesión ni borra lo escrito. */
const buttonWarns = browserRow(async (row, { page, snapshot }) => {
  await resetTenants([TENANT_A]);
  const written = strict('escrito', WRITTEN, cell(row, 'escrito'));
  const failure =
    (await openLogin(page)) ??
    (written.email === '' ? undefined : await fillCredentials(page, written.email, written.password)) ??
    (await runSteps([['pulsar «Acceder con certificado digital / SSO»', () => ssoButton(page).click({ timeout: CEILING_MS })]]));
  if (failure) return conclude({ checks: [check(false, `ve el aviso informativo con el mensaje «${MESSAGE}»`, failure)] });

  const appeared = await waitUntil(() => isVisible(messageIn(page)));
  const toastText = await textOf(infoToast(page));
  const stays = await holdsFor(() => onLoginForm(page));
  const email = await valueOf(emailField(page));
  const password = await valueOf(passwordField(page));
  const kept = email === written.email && password === written.password;
  await snapshot();
  const noSession = await hasNoSession(page);

  const checks: readonly Check[] = [
    check(appeared.reached, `ve el aviso informativo con el mensaje «${MESSAGE}»`, appeared.reached ? `aviso informativo con «${MESSAGE}» a los ${appeared.elapsedMs} ms` : `no apareció un aviso informativo con ese mensaje en ${CEILING_MS} ms`),
    check(stays.held, 'sigue en /login', stays.held ? 'sigue en /login (observado 2 s)' : `dejó /login a los ${stays.brokeAtMs} ms`),
    { ...noSession, expected: 'sin sesión iniciada' },
    // La contraseña de demostración no se copia al resultado: se dice qué se había escrito sin repetirla
    check(kept, `el formulario sigue ${written.email === '' ? '(vacío)' : `con el correo ${written.email} y la contraseña escrita`}`, `correo ${email === undefined ? 'no legible' : `«${email}»`}, contraseña ${lengthOf(password)}${kept ? ' (lo escrito se conserva)' : ' (lo escrito cambió)'}`),
  ];
  return conclude({
    checks,
    notes: slowNote('el aviso emergente', appeared.elapsedMs, REFERENCE_MS.toast),
    evidence: { elapsedMs: appeared.elapsedMs, ...detailEvidence(detailOf(toastText)) },
  });
});

/** Esquema 2: el aviso se cierra solo a los 3 segundos; los segundos de la celda son el momento en que se mira, contado desde que apareció. */
const autoCloses = browserRow(async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const seconds = Number(cell(row, 'segundos'));
  if (!Number.isInteger(seconds) || seconds < 0) throw new Error(`celda sin interpretación: segundos «${cell(row, 'segundos')}»`);
  const expectVisible = strict('estado', new Map<string, boolean>([['sigue visible', true], ['ya no está', false]]), cell(row, 'estado'));
  const failure = (await openLogin(page)) ?? (await runSteps([['pulsar «Acceder con certificado digital / SSO»', () => ssoButton(page).click({ timeout: CEILING_MS })]]));
  if (failure) return conclude({ checks: [check(false, `ve el aviso «${MESSAGE}»`, failure)] });

  const appeared = await waitUntil(() => isVisible(messageIn(page)));
  const shownAt = performance.now();
  if (!appeared.reached) return conclude({ checks: [check(false, `ve el aviso «${MESSAGE}»`, `el aviso no apareció en ${CEILING_MS} ms`)] });
  // Dato aparte: cuándo se cierra en realidad, medido por un observador que corre mientras se espera el momento pedido
  const closing: { goneAtMs?: number } = {};
  const watcher = waitUntil(async () => {
    const gone = !(await isVisible(messageIn(page)));
    if (gone && closing.goneAtMs === undefined) closing.goneAtMs = Math.round(performance.now() - shownAt);
    return gone;
  });
  // Una sola lectura instantánea en el momento pedido (no una espera con techo, que aprobaría un aviso que tarda en irse)
  await sleep(Math.max(0, seconds * 1000 - (performance.now() - shownAt)));
  const readAt = Math.round(performance.now() - shownAt);
  const visibleNow = await isVisible(messageIn(page));
  const closed = await watcher;
  return conclude({
    checks: [
      check(true, `ve el aviso «${MESSAGE}»`, `aviso visible a los ${appeared.elapsedMs} ms de pulsar`),
      check(visibleNow === expectVisible, `a los ${seconds} segundos de aparecer el aviso ${cell(row, 'estado')}`, `a los ${readAt} ms de verlo aparecer el aviso ${visibleNow ? 'sigue visible' : 'ya no está'}`),
    ],
    notes: [...slowNote('el aviso emergente', appeared.elapsedMs, REFERENCE_MS.toast), ...(closed.reached ? [] : [`el aviso no llegó a cerrarse en ${CEILING_MS} ms`])],
    evidence: { elapsedMs: appeared.elapsedMs, readAtMs: readAt, closedAfterMsFromFirstSighting: closing.goneAtMs ?? null },
  });
});

defineBrowserRows({
  story: 'US-LOGIN-009',
  surface: 'web',
  tenants: [TENANT_A],
  handlers: new Map<number, BrowserRowHandler>([
    [1, buttonWarns],
    [2, autoCloses],
  ]),
});
