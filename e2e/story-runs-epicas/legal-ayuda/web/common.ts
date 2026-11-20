import type { Locator, Page } from '@playwright/test';
import { DEMO, TENANT_A, resetTenants, type Credentials } from '../../../story-runs/support/prepare';
import { ACTION, CEILING_MS, attrOf, holdsFor, isVisible, pathOf, quoted, safe, waitUntil } from '../../support/browser';
import { check, conclude, sleep, strict, type Check } from '../../support/checks';
import { notExecutable, outcome, pending, type BrowserRowHandler, type Outcome } from '../../core/framework';

// Piezas comunes de EP-LEGAL-AYUDA: la web (escritorio, 1440 × 900) y la app móvil servida como web (`mobile/`, Expo web a 390 × 844).
// Criterio: una lectura que decide un veredicto exige UN único elemento (cero o varios = no cumplido, nunca una lectura «no visible»).
// Toda acción pasa por `interact`: si la pantalla correcta está visible y el elemento no aparece, la app no lo ofrece (discrepa);
// si no se llega a la pantalla, o el localizador o el clic fallan, la fila no es ejecutable, con el error como evidencia.
// Los observados se derivan de lo leído (ruta, encabezados, enlaces, texto); nunca son un texto fijo del esperado.

/** Acceso de la cuenta de la fila: el tenant se fija entrando por /login?tenant=alumno01 (procedimiento de la historia). */
export const LOGIN_URL = `/login?tenant=${TENANT_A}`;
/** Tiempo que se observa para afirmar que algo NO ocurre («sigue en», «no aparece»): mayor que la vida del aviso (3 s). */
export const HOLD_MS = 3_500;
/** Tiempo que la ruta debe quedarse en el destino antes de dar por buena una llegada (detecta una redirección posterior). */
const SETTLE_MS = 1_000;
/** Línea de la última actualización, tal como la piden los Esquemas («Y ve la línea «…»»). */
export const UPDATED_LINE = 'Última actualización: 1 de noviembre de 2026';
/** Texto del pie de Acceso y sus enlaces, en el orden de la regla de las historias 002 y 004. */
export const FOOTER_TEXT = '© 2026 SIGPRO';
export const FOOTER_LINKS: readonly string[] = ['Privacidad', 'Condiciones', 'Ayuda'];
/** Destino de cada enlace del pie (Regla de las historias 002 y 004). */
export const FOOTER_HREFS: ReadonlyMap<string, string> = new Map<string, string>([
  ['Privacidad', '/legal/privacy'],
  ['Condiciones', '/legal/terms'],
  ['Ayuda', '/help'],
]);
/** Enlace de la ayuda al laboratorio. Cualquier enlace con uno de estos nombres (o con /lab) cuenta como enlace al laboratorio. */
export const LAB_LINK = 'Ir a /lab';
export const LAB_NAMES: readonly string[] = [LAB_LINK, 'Laboratorio'];
/** Título de la ayuda («Ayuda», Regla de la historia 001). */
export const HELP_TITLE = 'Ayuda';
/** Enlaces de retorno («Volver al acceso» sin sesión; «Volver» con sesión). */
export const BACK_ACCESS = 'Volver al acceso';
export const BACK_PROGRAMS = 'Volver';
/** Sección con decisión pendiente en la historia 003 («Decisiones pendientes»): su orden no se juzga con las demás. */
export const ATAJOS = 'Atajos de teclado';

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

/** Título de cada página legal o de la ayuda (Esquema 1 de la historia 001). */
export const PAGE_TITLES: ReadonlyMap<string, string> = new Map<string, string>([
  ['/legal/terms', 'Términos de uso'],
  ['/legal/privacy', 'Política de privacidad'],
  ['/help', HELP_TITLE],
]);

/**
 * Pantallas de acceso: ruta y encabezado. La historia del pie no cita el encabezado, así que se toma del catálogo `acceso`
 * (`signIn`, `registerTitle`, `forgotTitle`); es el único texto de esta tabla que no sale de la historia.
 */
export const ACCESS_PAGES: ReadonlyMap<string, { readonly path: string; readonly title: string }> = new Map<string, { readonly path: string; readonly title: string }>([
  ['/login?tenant=alumno01', { path: '/login', title: 'Iniciar sesión' }],
  ['/login', { path: '/login', title: 'Iniciar sesión' }],
  ['/register', { path: '/register', title: 'Solicitar acceso' }],
  ['/forgot', { path: '/forgot', title: 'Recuperar contraseña' }],
]);

/** Secciones de cada página, en orden (Regla de la historia: «Las secciones de cada página, en orden, son…»). */
export const SECTIONS: ReadonlyMap<string, readonly string[]> = new Map<string, readonly string[]>([
  ['/legal/terms', ['1. Uso del laboratorio', '2. Cuentas y datos de prueba', '3. Disponibilidad']],
  ['/legal/privacy', ['1. Qué se guarda', '2. Cookies', '3. Borrado']],
  ['/help', ['Acceso', 'Tu tenant', ATAJOS, 'Documentación de la API']],
]);

/** Persona de una fila: sin sesión, o con la cuenta de la fila iniciada en alumno01 (la historia da el correo y la contraseña). */
export type Persona = { readonly signedIn: false } | { readonly signedIn: true; readonly credentials: Credentials };

export const PERSONAS: ReadonlyMap<string, Persona> = new Map<string, Persona>([
  ['una persona sin sesión iniciada', { signedIn: false }],
  ['gestor@sigpro.test, que ha iniciado sesión en alumno01 con Gestor1234!', { signedIn: true, credentials: DEMO.gestor }],
  ['consultor@sigpro.test, que ha iniciado sesión en alumno01 con Consul1234!', { signedIn: true, credentials: DEMO.consultor }],
  ['auditor@sigpro.test, que ha iniciado sesión en alumno01 con Audit1234!', { signedIn: true, credentials: DEMO.auditor }],
]);

/** Enlace de retorno que debe verse para cada persona (Regla: «Volver» si hay sesión, «Volver al acceso» si no). */
export const backLabelFor = (persona: Persona): string => (persona.signedIn ? BACK_PROGRAMS : BACK_ACCESS);

/**
 * Textos que la historia DESCRIBE («(describe: …)») en vez de citar. Cada hecho es una lista de alternativas: basta con que el cuerpo
 * contenga una de ellas. Las frases son de la propia historia; donde la app redacta distinto, la alternativa es un equivalente declarado
 * (aproximación, anotada en la nota de la fila). Nunca se usa una palabra suelta como hecho.
 */
const DESCRIBED: ReadonlyMap<string, readonly (readonly string[])[]> = new Map<string, readonly (readonly string[])[]>([
  [
    '(describe: SIGPRO es una aplicación ficticia para practicar la automatización de pruebas, y al usarla se aceptan estas condiciones)',
    [['aplicación ficticia'], ['automatización de pruebas'], ['al usarla'], ['estas condiciones']],
  ],
  [
    '(describe: no se garantiza la disponibilidad del servicio, y se pueden activar, a propósito, latencia y errores)',
    [['no se garantiza la disponibilidad del servicio'], ['se pueden activar', 'puede activar'], ['latencia y errores'], ['a propósito']],
  ],
  [
    '(describe: los datos del tenant se pueden reiniciar con el botón de reinicio de la página del laboratorio, y una tarea nocturna restaura todos los tenants)',
    [['se pueden reiniciar', 'puedes reiniciar'], ['botón de reinicio', 'botón de reset'], ['página del laboratorio', '/lab'], ['tarea nocturna', 'cron nocturno'], ['restaura todos los tenants']],
  ],
  [
    '(describe: se pueden usar los usuarios de prueba de la pantalla de acceso y de la página del laboratorio, y el administrador pide un código de segundo factor de prueba)',
    [['usuarios de prueba'], ['pantalla de acceso'], ['página del laboratorio', '/lab'], ['el administrador'], ['segundo factor', 'MFA'], ['pide un código', 'pide el código']],
  ],
  [
    '(describe: cada persona trabaja en su propio tenant, y los datos de los demás no se ven ni se modifican)',
    [['trabaja en su propio tenant'], ['los datos de los demás'], ['no se ven ni se modifican']],
  ],
  [
    '(describe: la referencia de la API está en /api/docs y puede protegerse con usuario y contraseña)',
    [['/api/docs'], ['usuario y contraseña'], ['la referencia de la API', 'referencia OpenAPI']],
  ],
]);

/** Nota de las filas con un texto descrito: se comprueba por frases de la historia, no por la cadena exacta. */
export const DESCRIBED_NOTE =
  'Texto descrito en la historia, no citado: su cuerpo se comprueba por las frases de la historia que describen cada hecho; donde la app redacta distinto, se admite un equivalente declarado en el arnés. Es una aproximación, no una comparación exacta: revisar antes de publicar.';

/** Nota de las filas cuya página de partida se abre con una carga directa y no por la interfaz. */
export const GOTO_NOTE = 'La página de partida de esta fila se abre con una carga directa de la dirección, no por la interfaz; el enlace se pulsa en esa página.';

/** Lo que el Esquema pide y la app no ofrece con la pantalla visible discrepa; el resto (localizador, clic, pantalla no alcanzada) no es ejecutable. */
export interface Blocked {
  /** `ausente`: la app no ofrece el elemento con la pantalla visible (discrepa). `estado`: la preparación no produjo el estado de la historia (discrepa). `arnés`: fallo de localizador, de clic o de pantalla (no ejecutable). */
  readonly kind: 'ausente' | 'estado' | 'arnés';
  readonly message: string;
  readonly note: string;
  readonly evidence?: Readonly<Record<string, unknown>>;
}

/** Una llegada a la página de la fila: la página donde queda la persona y, si la llegada falló, el motivo. */
export interface Arrival {
  readonly page: Page;
  readonly blocked: Blocked | undefined;
}

export const arrivedAt = (page: Page, blocked: Blocked | undefined): Arrival => ({ page, blocked });

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

/** Texto de un único elemento VISIBLE; `undefined` si no hay exactamente uno, no es visible o la lectura falla. */
export const soleText = (target: Locator): Promise<string | undefined> =>
  safe<string | undefined>(async () => {
    if ((await target.count()) !== 1) return undefined;
    if (!(await target.isVisible())) return undefined;
    return norm(await target.innerText({ timeout: 2_000 }));
  }, undefined);

export const sameList = (actual: readonly string[], expected: readonly string[]): boolean =>
  actual.length === expected.length && actual.every((text, index) => text === expected[index]);

/** Lista legible de textos entre comillas (o «(ninguno)»). */
export const listOf = (texts: readonly string[]): string => (texts.length === 0 ? '(ninguno)' : texts.map((text) => `«${text}»`).join(', '));

/** Encabezado de nivel 1 de la pantalla (cualquiera; para comprobar que hay una pantalla). */
export const titleHeading = (page: Page): Locator => page.getByRole('heading', { level: 1 });
/** Encabezado de nivel 1 con el título exacto: en Expo web una pantalla anterior puede seguir montada, así que se compara por nombre. */
export const titleHeadingNamed = (page: Page, title: string): Locator => page.getByRole('heading', { level: 1, name: title, exact: true });
/** ¿Hay exactamente un encabezado de nivel 1 con ese título? (la espera de los manejadores usa este predicado). */
export const titleIs = (page: Page, title: string): Promise<boolean> => safe(async () => (await titleHeadingNamed(page, title).count()) === 1, false);
/** ¿Hay exactamente un encabezado (de cualquier nivel) con ese nombre? Para los encabezados de las pantallas de acceso. */
export const accessTitleIs = (page: Page, title: string): Promise<boolean> => safe(async () => (await page.getByRole('heading', { name: title, exact: true }).count()) === 1, false);
export const footerOf = (page: Page): Locator => page.getByRole('contentinfo');
export const footerLink = (page: Page, name: string): Locator => footerOf(page).getByRole('link', { name, exact: true });
export const labLink = (page: Page): Locator => page.getByRole('link', { name: LAB_LINK, exact: true });
export const backLink = (page: Page, label: string): Locator => page.getByRole('link', { name: label, exact: true });
export const sectionHeading = (page: Page, title: string): Locator => page.getByRole('heading', { level: 2, name: title, exact: true });

/** Textos hoja VISIBLES del pie, en orden del documento. Se ejecuta en el navegador: no usa variables de fuera. */
const leafTexts = (root: Element): string[] =>
  Array.from(root.querySelectorAll('*'))
    .filter((node) => node.children.length === 0 && node.getClientRects().length > 0 && (node.textContent ?? '').trim() !== '')
    .map((node) => (node.textContent ?? '').replace(/\s+/g, ' ').trim());

/** Nombres accesibles de los enlaces, en orden (aria-label o texto). Se ejecuta en el navegador. */
const linkNames = (links: Element[]): string[] => links.map((link) => (link.getAttribute('aria-label') ?? link.textContent ?? '').replace(/\s+/g, ' ').trim());

/** Textos de los encabezados, en orden del documento. Se ejecuta en el navegador. */
const headingTexts = (headings: Element[]): string[] => headings.map((heading) => (heading.textContent ?? '').replace(/\s+/g, ' ').trim());

/** Nombres de TODOS los enlaces de la página (los que no llevan dirección también). */
export const linkNamesOf = (page: Page): Promise<readonly string[]> => safe<readonly string[]>(() => page.getByRole('link').evaluateAll(linkNames), []);
export const sectionTitles = (page: Page): Promise<readonly string[]> => safe<readonly string[]>(() => page.getByRole('heading', { level: 2 }).evaluateAll(headingTexts), []);

/** Enlaces del laboratorio por dirección (`a[href^="/lab"]`); `-1` si no se puede leer. */
const hrefToLab = (page: Page): Promise<number> => safe(() => page.locator('a[href^="/lab"]').count(), -1);

// --- Comprobaciones (cada una con lo que la historia espera y lo observado) ------------------------------------------------

/** Texto exacto (tras normalizar solo la tipografía de los espacios en ambos lados): `what «expected»` frente a lo leído; sin lectura = no cumplido. */
export const textCheck = (what: string, expected: string, observed: string | undefined): Check => {
  const wanted = norm(expected);
  return check(observed === wanted, `${what} «${wanted}»`, observed === undefined ? `${what}: no legible` : `${what} «${observed}»`);
};

const isDescribed = (text: string): boolean => text.startsWith('(describe:');

/** Cuerpo de un texto: exacto si la historia lo cita; por frases de la historia si lo describe. */
export const bodyCheck = (what: string, cellText: string, observed: string | undefined): Check => {
  if (!isDescribed(cellText)) return textCheck(what, quoted(cellText), observed);
  const facts = strict('texto descrito', DESCRIBED, cellText);
  const lower = (observed ?? '').toLowerCase();
  const missing = facts.filter((alternatives) => !alternatives.some((phrase) => lower.includes(phrase.toLowerCase())));
  const described = cellText.slice('(describe: '.length, -1);
  const expected = `${what} que describe la historia: ${described}`;
  if (observed === undefined) return check(false, expected, `${what}: no legible`);
  return check(missing.length === 0, expected, missing.length === 0 ? `${what} «${observed}»` : `${what} «${observed}» (no recoge ${missing.map((alternatives) => alternatives.join(' o ')).join(', ')})`);
};

/** Nota de la fila si alguna de sus celdas describe un texto. */
export const describedNote = (cells: readonly string[]): { readonly note?: string } => (cells.some(isDescribed) ? { note: DESCRIBED_NOTE } : {});

/** Añade una nota al resultado sin borrar la que ya tenga. */
export const withNote = (result: Outcome, extra: string): Outcome => ({ ...result, note: result.note === undefined ? extra : `${result.note} ${extra}` });

/**
 * Decisión pendiente: si la fila mide algo que la historia deja sin decidir, se anota sin juzgarla SOLO si todas sus comprobaciones
 * se cumplen. Si alguna falla, el veredicto es `discrepa` (la decisión se añade como nota, no lo tapa).
 */
export const decided = (result: Outcome, decision: string | undefined): Outcome => {
  if (decision === undefined) return result;
  return result.verdict === 'coincide' ? pending(result.expected, result.observed, decision) : { ...result, note: result.note === undefined ? decision : `${decision} ${result.note}` };
};

/** El título: como único encabezado de nivel 1 con ese nombre; el observado lista los encabezados de nivel 1 que se ven. */
export const titleCheck = async (page: Page, title: string): Promise<Check> => {
  const ok = await titleIs(page, title);
  const shown = await safe<readonly string[]>(() => titleHeading(page).evaluateAll(headingTexts), []);
  return check(ok, `ve el título «${title}»`, shown.length === 0 ? 'no hay encabezado de nivel 1' : `encabezados de nivel 1: ${listOf(shown)}`);
};

/** El encabezado de una pantalla de acceso (sin nivel fijo): exacto, único. El observado lista todos los encabezados. */
export const accessTitleCheck = async (page: Page, title: string): Promise<Check> => {
  const ok = await accessTitleIs(page, title);
  const shown = await safe<readonly string[]>(() => page.getByRole('heading').evaluateAll(headingTexts), []);
  return check(ok, `muestra el encabezado «${title}»`, shown.length === 0 ? 'no hay encabezados' : `encabezados: ${listOf(shown)}`);
};

/** La ruta en la que está la página ahora (lectura de la URL). */
export const pathCheck = (page: Page, path: string): Check => check(pathOf(page) === path, `está en ${path}`, `está en ${pathOf(page)}`);

/** Título, introducción (hermano siguiente del título) y línea de actualización (el segundo hermano). */
export const introChecks = async (page: Page, title: string, introCell: string): Promise<readonly Check[]> => {
  const heading = titleHeadingNamed(page, title);
  const intro = await soleText(heading.locator('xpath=following-sibling::*[1]'));
  const updated = await soleText(heading.locator('xpath=following-sibling::*[2]'));
  return [await titleCheck(page, title), bodyCheck('la introducción', introCell, intro), textCheck('la línea', UPDATED_LINE, updated)];
};

/**
 * Sección: el orden de las secciones de la página, la presencia de la sección pedida y su texto. `excludeFromOrder` quita una sección
 * (la de decisión pendiente) del orden: esa sección se comprueba aparte, en su propia fila.
 */
export const sectionChecks = async (page: Page, route: string, section: string, bodyCell: string, excludeFromOrder?: string): Promise<readonly Check[]> => {
  const order = strict('ruta', SECTIONS, route).filter((title) => title !== excludeFromOrder);
  const titles = (await sectionTitles(page)).filter((title) => title !== excludeFromOrder);
  const found = await safe(() => sectionHeading(page, section).count(), -1);
  const body = await soleText(sectionHeading(page, section).locator('xpath=following-sibling::*[1]'));
  const omitted = excludeFromOrder === undefined ? '' : ` (sin «${excludeFromOrder}», que se comprueba aparte)`;
  return [
    check(sameList(titles, order), `las secciones de la página, en orden: ${order.join(' · ')}${omitted}`, `las secciones: ${listOf(titles)}`),
    check(found === 1, `aparece la sección «${section}»`, found < 0 ? 'encabezados de nivel 2: no legible' : `encabezados de nivel 2 «${section}»: ${found}`),
    bodyCheck('el texto', bodyCell, body),
  ];
};

/** El pie: visible, con el texto «© 2026 SIGPRO» y los tres enlaces, en ese orden y como enlaces. */
export const footerCheck = async (page: Page): Promise<Check> => {
  const footer = footerOf(page);
  const visible = await isVisible(footer);
  const texts = visible ? await safe<readonly string[] | undefined>(() => footer.evaluate(leafTexts, undefined, { timeout: 2_000 }), undefined) : undefined;
  const names = visible ? await safe<readonly string[] | undefined>(() => footer.getByRole('link').evaluateAll(linkNames), undefined) : undefined;
  const ok = texts !== undefined && names !== undefined && sameList(texts, [FOOTER_TEXT, ...FOOTER_LINKS]) && sameList(names, FOOTER_LINKS);
  const observed = !visible ? 'el pie no está visible' : texts === undefined || names === undefined ? 'el pie no es legible' : `el pie muestra ${texts.map((text) => `«${text}»`).join(' ')}; enlaces: ${listOf(names)}`;
  return check(ok, `el pie muestra «${FOOTER_TEXT}» seguido de los enlaces «Privacidad», «Condiciones» y «Ayuda», en ese orden`, observed);
};

/** Destino de cada enlace del pie (web: la dirección de cada enlace). Regla de las historias 002 y 004. */
export const footerHrefCheck = async (page: Page): Promise<Check> => {
  const hrefs = await Promise.all(FOOTER_LINKS.map((name) => attrOf(footerLink(page, name), 'href')));
  const observed = FOOTER_LINKS.map((name, index) => `${name} → ${hrefs[index] ?? '(sin dirección)'}`);
  const ok = FOOTER_LINKS.every((name, index) => hrefs[index] === FOOTER_HREFS.get(name));
  return check(ok, 'Privacidad → /legal/privacy · Condiciones → /legal/terms · Ayuda → /help', observed.join(' · '));
};

/** Que la página no se va: la ruta sigue siendo `route` durante la ventana de observación. */
export const stayCheck = async (page: Page, route: string): Promise<Check> => {
  const stays = await holdsFor(async () => pathOf(page) === route, HOLD_MS);
  return check(stays.held, `sigue en ${route}, sin llegar a /login ni a /programs`, `ruta ${pathOf(page)}${stays.held ? '' : ` (cambió a los ${stays.brokeAtMs ?? '?'} ms)`}`);
};

/** ¿Algún enlace de la página lleva al laboratorio, por nombre o por dirección? */
const namesWithLab = (names: readonly string[]): boolean => names.some((name) => name.includes('/lab') || LAB_NAMES.some((lab) => lab.toLowerCase() === name.toLowerCase()));

/** Enlace a /lab: aparece (uno, visible) o no aparece (ningún enlace de la página lleva al laboratorio durante la ventana). */
export const labLinkCheck = async (page: Page, appears: boolean): Promise<Check> => {
  if (appears) {
    const shown = await waitUntil(() => isVisible(labLink(page)));
    const count = await safe(() => labLink(page).count(), -1);
    const names = await linkNamesOf(page);
    return check(shown.reached && count === 1, `aparece el enlace «${LAB_LINK}»`, `enlaces de la página: ${listOf(names)}`);
  }
  const held = await holdsFor(async () => !namesWithLab(await linkNamesOf(page)) && (await hrefToLab(page)) === 0, HOLD_MS);
  const names = await linkNamesOf(page);
  const verdict = held.held ? 'ningún enlace a /lab' : `aparece un enlace a /lab (a los ${held.brokeAtMs ?? '?'} ms)`;
  return check(held.held, `no aparece ningún enlace a /lab (ni «${LAB_LINK}» ni otro)`, `${verdict}; enlaces de la página: ${listOf(names)}`);
};

/** El enlace a /lab va DEBAJO de las secciones (web): su posición frente al final de la última sección. */
export const labBelowSectionsCheck = async (page: Page): Promise<Check> => {
  const lastBody = page.getByRole('heading', { level: 2 }).last().locator('xpath=following-sibling::*[1]');
  const body = await safe(() => lastBody.boundingBox({ timeout: 2_000 }), null);
  const link = await safe(() => labLink(page).boundingBox({ timeout: 2_000 }), null);
  if (body === null || link === null) return check(false, `el enlace «${LAB_LINK}» va debajo de la última sección`, 'no se puede medir la posición del enlace o de la última sección');
  const bottom = body.y + body.height;
  return check(link.y >= bottom, `el enlace «${LAB_LINK}» va debajo de la última sección`, `el enlace está en y=${Math.round(link.y)} y la última sección termina en y=${Math.round(bottom)}`);
};

/** Enlace de retorno visible con el rótulo de la persona («Volver al acceso» o «Volver»); lo observado lista cuáles se ven. */
export const backLabelCheck = async (page: Page, label: string): Promise<Check> => {
  const shown = await waitUntil(() => isVisible(backLink(page, label)));
  const candidates = [BACK_ACCESS, BACK_PROGRAMS];
  const visibility = await Promise.all(candidates.map((candidate) => isVisible(backLink(page, candidate))));
  const seen = candidates.filter((_, index) => visibility[index] === true);
  return check(shown.reached, `el enlace de retorno dice «${label}»`, `enlaces de retorno visibles: ${listOf(seen)}`);
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

/** El tenant guardado por la app (la clave que usa la app para el tenant activo). `undefined` si no se puede leer. */
export const storedTenant = (page: Page): Promise<string | undefined> =>
  safe<string | undefined>(
    () =>
      page.evaluate(() => {
        try {
          return window.localStorage.getItem('sigpro.tenant') ?? undefined;
        } catch {
          return undefined;
        }
      }),
    undefined,
  );

/** Con sesión iniciada, el tenant de la sesión debe ser alumno01 (la historia lo da por hecho en cada fila con sesión). */
export const tenantBlocked = async (page: Page): Promise<Blocked | undefined> => {
  const stored = await storedTenant(page);
  return stored === TENANT_A ? undefined : { kind: 'estado', message: `el tenant guardado es ${stored ?? '(ninguno)'}, no ${TENANT_A}`, note: 'La sesión de la fila debe iniciarse en alumno01.' };
};

/** Con sesión: entra por el formulario de /login?tenant=alumno01, espera a /programs y comprueba que el tenant es alumno01. */
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
  if (!arrived.reached) return { kind: 'estado', message: `no llega a /programs tras «Entrar» (ruta ${pathOf(page)})`, note: 'El inicio de sesión de la preparación no llega a Programas.' };
  return tenantBlocked(page);
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

/**
 * Sigue la ruta tras el clic: registra cada ruta distinta, empezando después de la de partida, hasta que la página lleva un rato
 * en el destino (así también se ve una redirección posterior). Lee la URL en vez de depender de eventos de navegación, que no cubren
 * todos los cambios de historial de una SPA.
 */
const followPath = async (page: Page, start: string, destination: string): Promise<readonly string[]> => {
  const trail: string[] = [];
  let last = start;
  let reachedAt: number | undefined;
  const began = Date.now();
  while (Date.now() - began < CEILING_MS + 2_000) {
    const current = pathOf(page);
    if (current !== last) {
      trail.push(current);
      last = current;
    }
    if (current === destination) {
      reachedAt ??= Date.now();
      if (Date.now() - reachedAt >= SETTLE_MS) break;
    } else {
      reachedAt = undefined;
    }
    await sleep(50);
  }
  return trail;
};

export interface BackOptions {
  /** Web: el enlace es un `<a href>` y su destino se lee antes de pulsar. La app móvil no expone dirección: solo cuenta la ruta. */
  readonly webLink: boolean;
  /** Decisión pendiente de la historia: la fila se anota sin juzgarla si todo se cumple. */
  readonly decision?: string;
}

/**
 * Pulsa el enlace de retorno y comprueba a dónde lleva: (web) su dirección antes de pulsar debe ser el destino de la fila, y (ambas)
 * la primera ruta distinta tras el clic debe ser el destino, sin salto intermedio. El observado nombra la ruta de partida y la de llegada.
 */
export const backLinkOutcome = async (page: Page, expected: string, label: string, destination: string, options: BackOptions): Promise<Outcome> => {
  const start = pathOf(page);
  const link = backLink(page, label);
  await waitUntil(() => isVisible(link));
  const href = options.webLink ? await attrOf(link, 'href') : undefined;
  const blocked = await interact(link, `el enlace «${label}»`, titleHeading(page), (element) => element.click(ACTION));
  if (blocked) return actionFailed(expected, blocked);
  const trail = await followPath(page, start, destination);
  const direct = trail.length > 0 && trail[0] === destination && trail[trail.length - 1] === destination;
  const checks: Check[] = [];
  if (options.webLink) checks.push(check(href === destination, `el enlace «${label}» apunta a ${destination}`, `el enlace apunta a ${href ?? '(sin dirección)'}`));
  checks.push(check(direct, `desde ${start} llega a ${destination} sin pasar por otra ruta`, `desde ${start} pasa por ${trail.length === 0 ? '(ninguna ruta)' : trail.join(' → ')}`));
  const result = conclude(checks);
  return decided(result, options.decision);
};
