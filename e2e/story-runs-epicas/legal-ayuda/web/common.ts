import type { Locator, Page } from '@playwright/test';
import { DEMO, TENANT_A, resetTenants, type Credentials } from '../../../story-runs/support/prepare';
import { ACTION, holdsFor, isVisible, pathOf, quoted, safe, waitUntil } from '../../support/browser';
import { check, conclude, strict, type Check } from '../../support/checks';
import { notExecutable, outcome, pending, type BrowserRowHandler, type Outcome } from '../../core/framework';

// Piezas comunes de EP-LEGAL-AYUDA: la web (escritorio, 1440 × 900) y la app móvil servida como web (`mobile/`, Expo web a 390 × 844).
// Criterio: una lectura que decide un veredicto exige UN único elemento (cero o varios = no cumplido, nunca una lectura «no visible»).
// Toda acción pasa por `interact`: si la pantalla correcta está visible y el elemento no aparece, la app no lo ofrece (discrepa);
// si no se llega a la pantalla, o el localizador o el clic fallan, la fila no es ejecutable, con el error como evidencia.

/** Acceso de la cuenta de la fila: el tenant se fija entrando por /login?tenant=alumno01 (procedimiento de la historia). */
export const LOGIN_URL = `/login?tenant=${TENANT_A}`;
/** Tiempo que se observa para afirmar que algo NO ocurre («sigue en», «no aparece»): mayor que la vida del aviso (3 s). */
export const HOLD_MS = 3_500;
/** Línea de la última actualización, tal como la piden los Esquemas («Y ve la línea «…»»). */
export const UPDATED_LINE = 'Última actualización: 1 de noviembre de 2026';
/** Texto del pie de Acceso y sus enlaces, en el orden de la regla de la historia 002 (web) y 004 (móvil). */
export const FOOTER_TEXT = '© 2026 SIGPRO';
export const FOOTER_LINKS: readonly string[] = ['Privacidad', 'Condiciones', 'Ayuda'];
/** Enlace de la ayuda al laboratorio (solo en la web, solo en la ayuda). */
export const LAB_LINK = 'Ir a /lab';
/** Título de la ayuda («Ayuda», Regla de la historia 001). */
export const HELP_TITLE = 'Ayuda';

/** Rutas que citan los Esquemas; una celda con otra ruta lanza (no se ignora). */
export const ROUTES: ReadonlyMap<string, string> = new Map<string, string>([
  ['/legal/terms', '/legal/terms'],
  ['/legal/privacy', '/legal/privacy'],
  ['/help', '/help'],
  ['/login', '/login'],
  ['/login?tenant=alumno01', LOGIN_URL],
  ['/register', '/register'],
  ['/forgot', '/forgot'],
  ['/programs', '/programs'],
  ['/more', '/more'],
  ['/lab', '/lab'],
]);

/** Secciones de cada página, en orden (Regla de la historia: «Las secciones de cada página, en orden, son…»). */
export const SECTIONS: ReadonlyMap<string, readonly string[]> = new Map<string, readonly string[]>([
  ['/legal/terms', ['1. Uso del laboratorio', '2. Cuentas y datos de prueba', '3. Disponibilidad']],
  ['/legal/privacy', ['1. Qué se guarda', '2. Cookies', '3. Borrado']],
  ['/help', ['Acceso', 'Tu tenant', 'Atajos de teclado', 'Documentación de la API']],
]);

/** Persona de una fila: sin sesión, o con la cuenta de la fila iniciada en alumno01 (la historia da el correo y la contraseña). */
export type Persona = { readonly signedIn: false } | { readonly signedIn: true; readonly credentials: Credentials };

export const PERSONAS: ReadonlyMap<string, Persona> = new Map<string, Persona>([
  ['una persona sin sesión iniciada', { signedIn: false }],
  ['gestor@sigpro.test, que ha iniciado sesión en alumno01 con Gestor1234!', { signedIn: true, credentials: DEMO.gestor }],
  ['consultor@sigpro.test, que ha iniciado sesión en alumno01 con Consul1234!', { signedIn: true, credentials: DEMO.consultor }],
  ['auditor@sigpro.test, que ha iniciado sesión en alumno01 con Audit1234!', { signedIn: true, credentials: DEMO.auditor }],
]);

/** Textos que la historia DESCRIBE («(describe: …)») en vez de citar. Cada hecho es una lista de palabras de la propia historia: basta
 *  con que el cuerpo las contenga. Se omiten los parafraseos que la app no repite (p. ej. «página del laboratorio» o «tarea nocturna»). */
const DESCRIBED: ReadonlyMap<string, readonly (readonly string[])[]> = new Map<string, readonly (readonly string[])[]>([
  [
    '(describe: SIGPRO es una aplicación ficticia para practicar la automatización de pruebas, y al usarla se aceptan estas condiciones)',
    [['aplicación ficticia'], ['automatización de pruebas'], ['al usarla'], ['estas condiciones']],
  ],
  [
    '(describe: no se garantiza la disponibilidad del servicio, y se pueden activar, a propósito, latencia y errores)',
    [['no se garantiza la disponibilidad del servicio'], ['activar'], ['latencia'], ['errores'], ['a propósito']],
  ],
  [
    '(describe: los datos del tenant se pueden reiniciar con el botón de reinicio de la página del laboratorio, y una tarea nocturna restaura todos los tenants)',
    [['reiniciar'], ['restaura todos los tenants']],
  ],
  [
    '(describe: se pueden usar los usuarios de prueba de la pantalla de acceso y de la página del laboratorio, y el administrador pide un código de segundo factor de prueba)',
    [['usuarios de prueba'], ['pantalla de acceso'], ['administrador'], ['código']],
  ],
  [
    '(describe: cada persona trabaja en su propio tenant, y los datos de los demás no se ven ni se modifican)',
    [['su propio tenant'], ['los datos de los demás'], ['no se ven ni se modifican']],
  ],
  [
    '(describe: la referencia de la API está en /api/docs y puede protegerse con usuario y contraseña)',
    [['/api/docs'], ['usuario y contraseña']],
  ],
]);

/** Nota que se añade a las filas con un texto descrito: su veredicto no compara una cadena exacta. */
export const DESCRIBED_NOTE =
  'Algún texto de esta fila está descrito en la historia, no citado: su cuerpo se compara por las palabras que la historia usa para describirlo (basta con que aparezcan), y el título de la sección o de la página, de forma exacta.';

/** Lo que el Esquema pide y la app no ofrece con la pantalla visible discrepa; el resto (localizador, clic, pantalla no alcanzada) no es ejecutable. */
export interface Blocked {
  /** `ausente`: la app no ofrece el elemento con la pantalla visible (discrepa). `estado`: la preparación no produjo el estado de la historia (discrepa). `arnés`: fallo de localizador, de clic o de pantalla (no ejecutable). */
  readonly kind: 'ausente' | 'estado' | 'arnés';
  readonly message: string;
  readonly note: string;
  readonly evidence?: Readonly<Record<string, unknown>>;
}

const firstLine = (error: unknown): string =>
  (error instanceof Error ? error.message : String(error))
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line !== '') ?? 'error';

const harness = (what: string, error: unknown): Blocked => ({ kind: 'arnés', message: `${what}: ${firstLine(error)}`, note: 'Error del arnés al navegar (no es un hallazgo sobre la app).' });

/** Pantalla que no se llegó a ver: la fila no se puede ejecutar aquí. `what` nombra lo que se necesitaba. */
export const screenNotReached = (what: string): Blocked => ({ kind: 'arnés', message: `no se llegó a ver la pantalla necesaria para ${what}`, note: 'Pantalla no alcanzada: la fila no es ejecutable aquí.' });

// --- Lecturas --------------------------------------------------------------------------------------------------------------

/** Espacios tipográficos y repetidos colapsados (NBSP incluido); nunca cambia letras, cifras ni signos. */
export const norm = (text: string): string => text.replace(/\s+/g, ' ').trim();

/** Texto de un único elemento; `undefined` si no hay exactamente uno o la lectura falla (no cuenta como cumplido). */
export const soleText = (target: Locator): Promise<string | undefined> =>
  safe<string | undefined>(async () => ((await target.count()) === 1 ? norm(await target.innerText({ timeout: 2_000 })) : undefined), undefined);

export const sameList = (actual: readonly string[], expected: readonly string[]): boolean =>
  actual.length === expected.length && actual.every((text, index) => text === expected[index]);

/** Encabezado de nivel 1 de la pantalla (cualquiera; para comprobar que hay una pantalla). */
export const titleHeading = (page: Page): Locator => page.getByRole('heading', { level: 1 });
/** Encabezado de nivel 1 con el título exacto: en Expo web una pantalla anterior puede seguir montada, así que se compara por nombre. */
export const titleHeadingNamed = (page: Page, title: string): Locator => page.getByRole('heading', { level: 1, name: title, exact: true });
/** ¿Hay exactamente un encabezado de nivel 1 con ese título? (la espera de los manejadores usa este predicado). */
export const titleIs = (page: Page, title: string): Promise<boolean> => safe(async () => (await titleHeadingNamed(page, title).count()) === 1, false);
export const footerOf = (page: Page): Locator => page.getByRole('contentinfo');
export const footerLink = (page: Page, name: string): Locator => footerOf(page).getByRole('link', { name, exact: true });
export const labLink = (page: Page): Locator => page.getByRole('link', { name: LAB_LINK, exact: true });

/** Número de enlaces a /lab por nombre o por destino; `-1` si no se puede leer (ante la duda, no cumple «no aparece»). */
export const labLinkCount = async (page: Page): Promise<number> => {
  const byName = await safe(() => page.getByRole('link', { name: /\/lab/ }).count(), -1);
  const byHref = await safe(() => page.locator('a[href^="/lab"]').count(), -1);
  return byName < 0 || byHref < 0 ? -1 : byName + byHref;
};

/** Textos hoja del pie, en orden del documento (el © y cada enlace). Se ejecuta en el navegador: no usa variables de fuera. */
const leafTexts = (root: Element): string[] =>
  Array.from(root.querySelectorAll('*'))
    .filter((node) => node.children.length === 0 && (node.textContent ?? '').trim() !== '')
    .map((node) => (node.textContent ?? '').replace(/\s+/g, ' ').trim());

/** Nombres accesibles de los enlaces del pie, en orden. Se ejecuta en el navegador. */
const linkNames = (links: Element[]): string[] => links.map((link) => (link.getAttribute('aria-label') ?? link.textContent ?? '').replace(/\s+/g, ' ').trim());

/** Encabezados de nivel 2 en orden del documento. Se ejecuta en el navegador. */
const headingTexts = (headings: Element[]): string[] => headings.map((heading) => (heading.textContent ?? '').replace(/\s+/g, ' ').trim());

export const sectionHeading = (page: Page, title: string): Locator => page.getByRole('heading', { level: 2, name: title, exact: true });
export const sectionTitles = (page: Page): Promise<readonly string[]> => safe<readonly string[]>(() => page.getByRole('heading', { level: 2 }).evaluateAll(headingTexts), []);

// --- Comprobaciones (cada una con lo que la historia espera y lo observado) ------------------------------------------------

/** Texto exacto (tras normalizar solo la tipografía de los espacios en ambos lados): `what «expected»` frente a lo leído; sin lectura = no cumplido. */
export const textCheck = (what: string, expected: string, observed: string | undefined): Check => {
  const wanted = norm(expected);
  return check(observed === wanted, `${what} «${wanted}»`, observed === undefined ? `${what}: no legible` : `${what} «${observed}»`);
};

const isDescribed = (text: string): boolean => text.startsWith('(describe:');

/** Cuerpo de un texto: exacto si la historia lo cita; por palabras de la historia si lo describe. */
export const bodyCheck = (what: string, cellText: string, observed: string | undefined): Check => {
  if (!isDescribed(cellText)) return textCheck(what, quoted(cellText), observed);
  const facts = strict('texto descrito', DESCRIBED, cellText);
  const lower = (observed ?? '').toLowerCase();
  const missing = facts.filter((words) => !words.some((word) => lower.includes(word.toLowerCase())));
  const described = cellText.slice('(describe: '.length, -1);
  const expected = `${what} que describe la historia: ${described}`;
  if (observed === undefined) return check(false, expected, `${what}: no legible`);
  return check(missing.length === 0, expected, missing.length === 0 ? `${what} «${observed}»` : `${what} «${observed}» (no menciona ${missing.map((words) => words.join(' o ')).join(', ')})`);
};

/** Nota de la fila si alguna de sus celdas describe un texto. */
export const describedNote = (cells: readonly string[]): { readonly note?: string } => (cells.some(isDescribed) ? { note: DESCRIBED_NOTE } : {});

/** El título: exacto, como único encabezado de nivel 1 con ese nombre. Si no está, se dice qué títulos se ven. */
export const titleCheck = async (page: Page, title: string): Promise<Check> => {
  if (await titleIs(page, title)) return check(true, `ve el título «${title}»`, `ve el título «${title}»`);
  const shown = await safe<readonly string[]>(() => titleHeading(page).evaluateAll(headingTexts), []);
  return check(false, `ve el título «${title}»`, shown.length === 0 ? 've ningún título' : `ve ${shown.map((text) => `«${text}»`).join(', ')}`);
};

/** Título, introducción (hermano siguiente del título) y línea de actualización (el segundo hermano). */
export const introChecks = async (page: Page, title: string, introCell: string): Promise<readonly Check[]> => {
  const heading = titleHeadingNamed(page, title);
  const intro = await soleText(heading.locator('xpath=following-sibling::*[1]'));
  const updated = await soleText(heading.locator('xpath=following-sibling::*[2]'));
  return [await titleCheck(page, title), bodyCheck('la introducción', introCell, intro), textCheck('la línea', UPDATED_LINE, updated)];
};

/** Sección: el orden de todas las secciones de la página, la presencia de la sección pedida y su texto. */
export const sectionChecks = async (page: Page, route: string, section: string, bodyCell: string): Promise<readonly Check[]> => {
  const order = strict('ruta', SECTIONS, route);
  const titles = await sectionTitles(page);
  const found = await safe(() => sectionHeading(page, section).count(), -1);
  const body = await soleText(sectionHeading(page, section).locator('xpath=following-sibling::*[1]'));
  return [
    check(sameList(titles, order), `las secciones de la página, en orden: ${order.join(' · ')}`, `las secciones: ${titles.length === 0 ? '(ninguna)' : titles.join(' · ')}`),
    check(found === 1, `aparece la sección «${section}»`, found === 1 ? `aparece la sección «${section}»` : `no aparece la sección «${section}»`),
    bodyCheck('el texto', bodyCell, body),
  ];
};

/** El pie: el texto «© 2026 SIGPRO» y los tres enlaces, en ese orden y como enlaces. */
export const footerCheck = async (page: Page): Promise<Check> => {
  const footer = footerOf(page);
  const texts = await safe<readonly string[] | undefined>(() => footer.evaluate(leafTexts, undefined, { timeout: 2_000 }), undefined);
  const names = await safe<readonly string[] | undefined>(() => footer.getByRole('link').evaluateAll(linkNames), undefined);
  const ok = texts !== undefined && names !== undefined && sameList(texts, [FOOTER_TEXT, ...FOOTER_LINKS]) && sameList(names, FOOTER_LINKS);
  return check(
    ok,
    `el pie muestra «${FOOTER_TEXT}» seguido de los enlaces «Privacidad», «Condiciones» y «Ayuda», en ese orden`,
    texts === undefined ? 'el pie no es legible' : `el pie muestra ${texts.map((text) => `«${text}»`).join(' ')}`,
  );
};

/** Que la página no se va: la ruta sigue siendo `route` durante la ventana de observación. */
export const stayCheck = async (page: Page, route: string): Promise<Check> => {
  const stays = await holdsFor(async () => pathOf(page) === route, HOLD_MS);
  return check(stays.held, `sigue en ${route}, sin llegar a /login ni a /programs`, stays.held ? `sigue en ${route}` : `pasa a ${pathOf(page)} a los ${stays.brokeAtMs ?? '?'} ms`);
};

/** Enlace a /lab: aparece (uno, visible) o no aparece (ningún enlace a /lab durante la ventana). */
export const labLinkCheck = async (page: Page, appears: boolean): Promise<Check> => {
  if (appears) {
    const shown = await waitUntil(() => isVisible(labLink(page)));
    const count = await safe(() => labLink(page).count(), -1);
    const ok = shown.reached && count === 1;
    return check(ok, `aparece el enlace «${LAB_LINK}»`, ok ? `aparece el enlace «${LAB_LINK}»` : `no aparece el enlace «${LAB_LINK}»`);
  }
  const held = await holdsFor(async () => (await labLinkCount(page)) === 0, HOLD_MS);
  return check(held.held, `no aparece el enlace «${LAB_LINK}» ni ningún otro enlace a /lab`, held.held ? `no aparece ningún enlace a /lab` : `aparece un enlace a /lab (a los ${held.brokeAtMs ?? '?'} ms)`);
};

// --- Acciones con diagnóstico ----------------------------------------------------------------------------------------------

interface Hit {
  readonly hit: string;
  readonly inside: boolean;
}

/** Qué recibe el clic en el centro del elemento. Se ejecuta en el navegador: no usa variables de fuera. */
const hitAtCenter = (node: Element): Hit => {
  const box = node.getBoundingClientRect();
  const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
  if (hit === null) return { hit: '(ninguno)', inside: false };
  const testid = hit.getAttribute('data-testid');
  return { hit: `${hit.tagName.toLowerCase()}${testid === null ? '' : `[data-testid="${testid}"]`}`, inside: hit === node || node.contains(hit) };
};

/** Diagnóstico de una acción que falla sobre un elemento que existe: primeras líneas del error y quién recibe el clic. */
const describeFailure = async (target: Locator, label: string, error: unknown): Promise<Blocked> => {
  const lines = (error instanceof Error ? error.message : String(error))
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '');
  const intercept = lines.find((line) => line.includes('intercepts pointer events'));
  const probe = await safe<Hit | undefined>(() => target.evaluate(hitAtCenter, undefined, { timeout: 2_000 }), undefined);
  const receives = probe === undefined ? '(no legible)' : probe.hit;
  return {
    kind: 'arnés',
    message: `no se pudo usar ${label}: ${lines.slice(0, 3).join(' · ')}${intercept === undefined ? '' : ` · ${intercept}`} · recibe el clic: ${receives}`,
    note: probe?.inside ? 'el elemento existe y recibe el clic, pero la acción no se completa (ver el mensaje de Playwright)' : 'el elemento existe pero otro elemento lo tapa, o no se pudo comprobar (error de clic del arnés)',
    evidence: { recibeElClic: receives },
  };
};

/** Actúa sobre un elemento con la pantalla `screen` como referencia. Sin elemento y con la pantalla visible: `ausente` (discrepa). */
export const interact = async (target: Locator, label: string, screen: Locator, run: (element: Locator) => Promise<unknown>): Promise<Blocked | undefined> => {
  const shown = await waitUntil(() => isVisible(target));
  if (!shown.reached) {
    if (await isVisible(screen)) return { kind: 'ausente', message: `no aparece ${label} con la pantalla visible`, note: 'La historia nombra un elemento que la pantalla no ofrece.' };
    return screenNotReached(label);
  }
  const count = await safe(() => target.count(), -1);
  if (count !== 1) {
    return {
      kind: 'arnés',
      message: `${label}: ${count < 0 ? 'lectura no disponible' : `${count} coincidencias`}`,
      note: 'Error de localizador (no es un hallazgo sobre la app): el nombre no identifica un único elemento.',
    };
  }
  try {
    await run(target);
    return undefined;
  } catch (error) {
    return describeFailure(target, label, error);
  }
};

/** Resultado de una acción bloqueada: `ausente` y `estado` discrepan; `arnés` no es ejecutable, con el error como evidencia. */
export const actionFailed = (expected: string, blocked: Blocked): Outcome => {
  const evidence = blocked.evidence === undefined ? {} : { evidence: blocked.evidence };
  if (blocked.kind === 'arnés') return { ...notExecutable(expected, `${blocked.note} ${blocked.message}`), ...evidence };
  return outcome(false, expected, blocked.message, { note: blocked.note, ...evidence });
};

/** Resultado de una preparación bloqueada: el estado que la historia da por hecho no se produjo (discrepa), salvo fallo del arnés. */
export const prepFailed = (expected: string, blocked: Blocked): Outcome =>
  blocked.kind === 'arnés'
    ? actionFailed(expected, blocked)
    : outcome(false, expected, `la preparación no se cumplió: ${blocked.message}`, {
        note: 'No se pudo reproducir el estado inicial que da por hecho la historia; la app no hace lo que la preparación describe.',
      });

// --- Preparación ------------------------------------------------------------------------------------------------------------

/** Va a `route` (la ruta tal como se abre: una carga completa). Un fallo de navegación no es un hallazgo sobre la app. */
export const openRoute = async (page: Page, route: string): Promise<Blocked | undefined> => {
  try {
    await page.goto(route, ACTION);
    return undefined;
  } catch (error) {
    return harness(`no se pudo abrir ${route}`, error);
  }
};

/** Espera (con techo) a que la página esté en `route`; si no, la pantalla no se alcanzó. */
export const reachedRoute = async (page: Page, route: string): Promise<Blocked | undefined> => {
  const arrived = await waitUntil(async () => pathOf(page) === route);
  return arrived.reached ? undefined : screenNotReached(`llegar a ${route} (la ruta es ${pathOf(page)})`);
};

const emailField = (page: Page): Locator => page.getByLabel('Correo electrónico', { exact: true });
const passwordField = (page: Page): Locator => page.getByLabel('Contraseña', { exact: true });
const enterButton = (page: Page): Locator => page.getByRole('button', { name: 'Entrar', exact: true });
const loginHeading = (page: Page): Locator => page.getByRole('heading', { name: 'Iniciar sesión', exact: true });

/** Sin sesión: entra por /login?tenant=alumno01 (el tenant queda guardado para la página que sigue). */
export const enterAnonymous = async (page: Page): Promise<Blocked | undefined> => {
  const opened = await openRoute(page, LOGIN_URL);
  if (opened) return opened;
  const shown = await waitUntil(() => isVisible(loginHeading(page)));
  return shown.reached ? undefined : screenNotReached('«Iniciar sesión» en /login?tenant=alumno01');
};

/** Con sesión: entra por el formulario de /login?tenant=alumno01 y espera a /programs. */
export const signInWeb = async (page: Page, credentials: Credentials): Promise<Blocked | undefined> => {
  const entered = await enterAnonymous(page);
  if (entered) return entered;
  const email = await interact(emailField(page), 'el campo «Correo electrónico»', loginHeading(page), (element) => element.fill(credentials.email, ACTION));
  if (email) return email;
  const password = await interact(passwordField(page), 'el campo «Contraseña»', loginHeading(page), (element) => element.fill(credentials.password, ACTION));
  if (password) return password;
  const submit = await interact(enterButton(page), 'el botón «Entrar»', loginHeading(page), (element) => element.click(ACTION));
  if (submit) return submit;
  const arrived = await waitUntil(async () => pathOf(page) === '/programs');
  return arrived.reached ? undefined : { kind: 'estado', message: `no llega a /programs tras «Entrar» (ruta ${pathOf(page)})`, note: 'El inicio de sesión de la preparación no llega a Programas.' };
};

/** Prepara la persona de la fila: sin sesión, o con sesión iniciada. */
export const prepare = (page: Page, persona: Persona): Promise<Blocked | undefined> => (persona.signedIn ? signInWeb(page, persona.credentials) : enterAnonymous(page));

/** Antes y después de cada fila, alumno01 se reinicia (la historia lo pide al terminar, también si la fila lanza). */
export const withAlumno =
  (handler: BrowserRowHandler): BrowserRowHandler =>
  async (row, fixtures) => {
    await resetTenants([TENANT_A]);
    let result: Outcome;
    try {
      result = await handler(row, fixtures);
    } catch (error) {
      await resetTenants([TENANT_A]).catch(() => undefined);
      throw error;
    }
    await resetTenants([TENANT_A]);
    return result;
  };

/** Pulsa un enlace del pie de la pantalla actual. */
export const footerClick = (page: Page, name: string): Promise<Blocked | undefined> =>
  interact(footerLink(page, name), `el enlace «${name}» del pie`, footerOf(page), (element) => element.click(ACTION));

/** Pulsa el enlace de retorno y comprueba a dónde lleva. Con `decision`, el veredicto se anota sin juzgarlo (decisión pendiente). */
export const backLinkOutcome = async (page: Page, expected: string, label: string, destination: string, decision?: string): Promise<Outcome> => {
  const blocked = await interact(page.getByRole('link', { name: label, exact: true }), `el enlace «${label}»`, titleHeading(page), (element) => element.click(ACTION));
  if (blocked) return actionFailed(expected, blocked);
  const landed = await waitUntil(async () => pathOf(page) === destination);
  const landing = check(landed.reached, `llega a ${destination}`, `llega a ${pathOf(page)}`);
  return decision === undefined ? conclude([landing]) : pending(expected, landing.observed, decision);
};
