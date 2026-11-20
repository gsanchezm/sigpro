import type { Locator, Page } from '@playwright/test';
import { PROGRAMAS_TESTIDS } from '../../../../packages/shared/src/testids';
import { DEMO, TENANT_A } from '../../../story-runs/support/prepare';
import { ACTION, safe, waitUntil, type Step } from '../../support/browser';
import { check, conclude, type Check } from '../../support/checks';
import { outcome, type Outcome } from '../../core/framework';

// Piezas comunes de las filas web de EP-TEMA (escritorio a 1440 px y diseño responsive a 390 px). Los localizadores son de rol y de
// nombre accesible; el id de prueba solo donde la pantalla no ofrece otro rastro (el campo de búsqueda de la cabecera, la fila de un
// programa y el botón «Nuevo programa», cuyo nombre accesible lleva el «+» y la tecla «N»). Las lecturas no lanzan: una lectura
// ambigua o fallida es «no legible» y nunca cuenta como cumplida. El tema se lee del propio control (aria-pressed) y del elemento raíz
// (data-theme); el fondo, del primer ancestro con fondo opaco, porque casi todos los elementos son transparentes.

export const LOGIN_URL = `/login?tenant=${TENANT_A}`;
export const PROGRAMS_URL = '/programs';
/** Tolerancia de la prueba para que una reacción local (cambio de tema) se asiente: la historia no fija plazos. */
export const SETTLE_MS = 2_000;
/** Contraste mínimo de texto normal (WCAG AA), el de US-TEMA-006. */
export const MIN_CONTRAST = 4.5;
/** Clave de preferencia de tema que usa la propia web (lib/storage.ts). Solo se lee como dato; ningún paso la escribe. */
export const THEME_STORAGE_KEY = 'sigpro.theme';
/** Nota de alcance de las historias transversales de la web: la regla de la historia para la app móvil NO se mide aquí. */
export const WEB_ONLY_NOTE = 'Transversal, solo web (escritorio 1440 px): la regla de la historia para la app móvil no se mide en esta fila (ni la preferencia guardada en el dispositivo móvil, ni que los colores sean los mismos en web y en móvil).';

export type Tema = 'claro' | 'oscuro';

/** Colores de las historias en el `rgb(...)` que devuelve el navegador. Una celda con un color que no está aquí lanza (strict). */
export const RGB: ReadonlyMap<string, string> = new Map<string, string>([
  ['#faf8fb', 'rgb(250, 248, 251)'],
  ['#141017', 'rgb(20, 16, 23)'],
  ['#ffffff', 'rgb(255, 255, 255)'],
  ['#f4f0f6', 'rgb(244, 240, 246)'],
  ['#f3e3f0', 'rgb(243, 227, 240)'],
  ['#7a2e6e', 'rgb(122, 46, 110)'],
  ['#632259', 'rgb(99, 34, 89)'],
  ['#b93232', 'rgb(185, 50, 50)'],
  ['#1d1424', 'rgb(29, 20, 36)'],
  ['#5b4f66', 'rgb(91, 79, 102)'],
  ['#6f627a', 'rgb(111, 98, 122)'],
  ['#1c1721', 'rgb(28, 23, 33)'],
  ['#261f2c', 'rgb(38, 31, 44)'],
  ['#3a2137', 'rgb(58, 33, 55)'],
  ['#f0eaf3', 'rgb(240, 234, 243)'],
  ['#b3a7bd', 'rgb(179, 167, 189)'],
  ['#968c9f', 'rgb(150, 140, 159)'],
  ['#d68ac9', 'rgb(214, 138, 201)'],
  ['#e3a5d8', 'rgb(227, 165, 216)'],
  ['#f0716b', 'rgb(240, 113, 107)'],
]);

// --- Color -----------------------------------------------------------------------------------------------------------------------

/** Canales de un `rgb(r, g, b)` o `rgba(r, g, b, a)`; `undefined` si el valor no es un color legible. */
export const parseRgb = (value: string | undefined): readonly [number, number, number] | undefined => {
  const match = /^rgba?\((\d+), (\d+), (\d+)/.exec(value ?? '');
  if (!match) return undefined;
  return [Number(match[1]), Number(match[2]), Number(match[3])];
};

/** `#rrggbb` de un `rgb(...)` leído, para que el observado se lea en hexadecimal como el de la historia. */
export const hexOf = (value: string | undefined): string => {
  const rgb = parseRgb(value);
  if (!rgb) return value ?? '(no legible)';
  return `#${rgb.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`;
};

const channelLuminance = (value: number): number => {
  const c = value / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};

/** Luminancia relativa WCAG de un `rgb(...)`. */
const luminance = (rgb: readonly [number, number, number]): number => 0.2126 * channelLuminance(rgb[0]) + 0.7152 * channelLuminance(rgb[1]) + 0.0722 * channelLuminance(rgb[2]);

/** Contraste WCAG entre el texto y el fondo leídos; `undefined` si alguno no es legible. */
export const contrastOf = (text: string | undefined, background: string | undefined): number | undefined => {
  const fg = parseRgb(text);
  const bg = parseRgb(background);
  if (!fg || !bg) return undefined;
  const a = luminance(fg);
  const b = luminance(bg);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
};

/** Un número con coma decimal, como lo escribe la historia (4,5:1). */
export const ratioText = (ratio: number | undefined): string => (ratio === undefined ? '(no legible)' : `${ratio.toFixed(2).replace('.', ',')}:1`);

// --- Localizadores ---------------------------------------------------------------------------------------------------------------

/** Control «Cambiar tema»: nombre accesible «Cambiar tema» en la cabecera de la app, de Acceso y de las páginas legales. */
export const themeToggle = (page: Page): Locator => page.getByRole('button', { name: 'Cambiar tema', exact: true });
export const loginHeading = (page: Page): Locator => page.getByRole('heading', { name: 'Iniciar sesión', exact: true });
export const emailField = (page: Page): Locator => page.getByLabel('Correo electrónico', { exact: true });
export const passwordField = (page: Page): Locator => page.getByLabel('Contraseña', { exact: true });
export const enterButton = (page: Page): Locator => page.getByRole('button', { name: 'Entrar', exact: true });
/** Menú de usuario de la cabecera de escritorio y su entrada «Perfil». */
export const userMenuButton = (page: Page): Locator => page.getByRole('button', { name: 'Menú de usuario', exact: true });
export const profileItem = (page: Page): Locator => page.getByRole('menuitem', { name: 'Perfil', exact: true });
export const logoutButton = (page: Page): Locator => page.getByRole('button', { name: 'Cerrar sesión', exact: true });
/** Título de la página de programas (solo en escritorio; en responsive no se muestra). */
export const programsTitle = (page: Page): Locator => page.getByRole('heading', { name: 'Programas', level: 1, exact: true });
/** Campo de búsqueda global de la cabecera (su nombre accesible es el de la búsqueda; el id es el rastro estable). */
export const headerSearch = (page: Page): Locator => page.getByTestId(PROGRAMAS_TESTIDS.LAYOUT_SEARCH);
/** Botón «+ Nuevo programa»: su nombre accesible lleva la tecla «N» en una marca, así que se usa su id. */
export const newProgramButton = (page: Page): Locator => page.getByTestId(PROGRAMAS_TESTIDS.PROGRAMS_NEW);
/** Ancestro de cada página de la app: en la pantalla de acceso, la columna que contiene el formulario. */
export const formMain = (page: Page): Locator => page.getByRole('main');
/** Panel de marca de Acceso: decorativo (aria-hidden), así que no tiene rol; es el único `aside` de la pantalla. */
export const brandPanel = (page: Page): Locator => page.locator('aside[aria-hidden="true"]');
/** Filtro «Responsable» de /programs: combobox con nombre accesible del catálogo `programas.owner`, dentro de un chip de la barra de filtros. */
export const ownerFilter = (page: Page): Locator => page.getByRole('combobox', { name: 'Responsable', exact: true });

// --- Lecturas que no mienten -----------------------------------------------------------------------------------------------------

/** El localizador si resuelve exactamente a un elemento; si no, `undefined` (ausente o ambiguo). */
export const onlyOne = async (target: Locator): Promise<Locator | undefined> => ((await safe(() => target.count(), 0)) === 1 ? target : undefined);

/** Valor de un atributo de un elemento único; `undefined` si no es legible. */
export const attrOne = async (target: Locator, name: string): Promise<string | undefined> => {
  const only = await onlyOne(target);
  if (!only) return undefined;
  return safe(async () => (await only.getAttribute(name, { timeout: 2000 })) ?? undefined, undefined);
};

/** Tema que declara el control: `aria-pressed` verdadero es oscuro (aria-pressed de AuthLayout, LegalPage y ThemeToggle). */
export const temaOf = async (page: Page): Promise<Tema | undefined> => {
  const pressed = await attrOne(themeToggle(page), 'aria-pressed');
  if (pressed === 'true') return 'oscuro';
  if (pressed === 'false') return 'claro';
  return undefined;
};

/** Valor de `data-theme` del elemento raíz del documento. */
export const rootValueOf = (page: Page): Promise<string | undefined> =>
  safe(async () => (await page.locator('html').getAttribute('data-theme', { timeout: 2000 })) ?? undefined, undefined);

/** Fondo efectivo: el `background-color` del primer elemento, subiendo desde el dado, que no es transparente. */
export const backgroundOf = async (target: Locator): Promise<string | undefined> => {
  const only = await onlyOne(target);
  if (!only) return undefined;
  return safe(
    () =>
      only.evaluate(
        (element) => {
          let node: Element | null = element;
          while (node !== null) {
            const value = getComputedStyle(node).backgroundColor;
            if (value !== 'rgba(0, 0, 0, 0)' && value !== 'transparent') return value;
            node = node.parentElement;
          }
          return undefined;
        },
        undefined,
        { timeout: 2000 },
      ),
    undefined,
  );
};

/** Color de texto computado de un elemento único. */
export const colorOf = async (target: Locator): Promise<string | undefined> => {
  const only = await onlyOne(target);
  if (!only) return undefined;
  return safe(() => only.evaluate((element) => getComputedStyle(element).color, undefined, { timeout: 2000 }), undefined);
};

/** Color del texto de marcador (`::placeholder`) de un campo único. */
export const placeholderColorOf = async (target: Locator): Promise<string | undefined> => {
  const only = await onlyOne(target);
  if (!only) return undefined;
  return safe(() => only.evaluate((element) => getComputedStyle(element, '::placeholder').color, undefined, { timeout: 2000 }), undefined);
};

/** Icono del control de tema: la luna no tiene círculo; el sol sí (SunIcon/MoonIcon de ui/icons.tsx). `undefined` si no legible. */
export const iconOf = async (target: Locator): Promise<'luna' | 'sol' | 'ninguno' | undefined> => {
  const only = await onlyOne(target);
  if (!only) return undefined;
  const kind = await safe(
    () =>
      only.evaluate(
        (element) => {
          if (element.querySelector('circle') !== null) return 'sol';
          if (element.querySelector('svg') !== null) return 'luna';
          return 'ninguno';
        },
        undefined,
        { timeout: 2000 },
      ),
    undefined,
  );
  return kind === 'sol' || kind === 'luna' || kind === 'ninguno' ? kind : undefined;
};

/** Texto del control (sin iconos): vacío si el control solo muestra un icono (los iconos de tema son SVG sin texto). */
export const visibleTextOf = async (target: Locator): Promise<string | undefined> => {
  const only = await onlyOne(target);
  if (!only) return undefined;
  return safe(() => only.evaluate((element) => (element.textContent ?? '').trim(), undefined, { timeout: 2000 }), undefined);
};

/** Marca de la página que sobrevive a un clic sin recarga (la historia dice «sin recargarla»). */
export const markPage = (page: Page): Promise<void> =>
  page.locator('html').evaluate(
    () => {
      Object.assign(window, { sigproPrueba: 'marca' });
    },
    undefined,
    { timeout: 2000 },
  );

export const markSurvives = (page: Page): Promise<boolean> =>
  safe(
    () =>
      page.locator('html').evaluate(
        () => (window as unknown as Record<string, unknown>).sigproPrueba === 'marca',
        undefined,
        { timeout: 2000 },
      ),
    false,
  );

/** Valor de la clave de tema en el almacenamiento del navegador (solo lectura: la historia dice «queda guardado en el navegador»). */
export const storedThemeOf = (page: Page): Promise<string | null | undefined> =>
  safe(
    () =>
      page.locator('html').evaluate(
        (_element, key) => {
          try {
            return window.localStorage.getItem(key);
          } catch {
            return undefined;
          }
        },
        THEME_STORAGE_KEY,
        { timeout: 2000 },
      ),
    undefined,
  );

// --- Comprobaciones del tema ------------------------------------------------------------------------------------------------------

export interface ThemeExpectation {
  readonly tema: Tema;
  /** Valor de `data-theme` que la historia da por hecho (`light` o `dark`), si la fila lo fija. */
  readonly valor?: 'light' | 'dark';
  /** Fondo que la historia fija para la zona medida, en hexadecimal y en `rgb(...)`. */
  readonly fondo?: { readonly hex: string; readonly rgb: string };
  /** Icono del control que la historia fija (luna con tema claro, sol con tema oscuro). */
  readonly icono?: 'luna' | 'sol';
}

/**
 * Comprobaciones de «el tema es», «el elemento raíz declara» y «el fondo es» (cada una con su paso de la historia). Espera a que el
 * control se asiente antes de juzgar. `background` es la zona cuyo fondo efectivo se mide.
 */
export const themeChecks = async (page: Page, expected: ThemeExpectation, background: Locator): Promise<readonly Check[]> => {
  await waitUntil(async () => (await temaOf(page)) === expected.tema, SETTLE_MS);
  const checks: Check[] = [];
  const tema = await temaOf(page);
  checks.push(check(tema === expected.tema, `el tema es ${expected.tema}`, `el tema es ${tema ?? '(no legible)'}`));
  if (expected.valor !== undefined) {
    const valor = await rootValueOf(page);
    checks.push(check(valor === expected.valor, `el elemento raíz declara el tema ${expected.valor}`, `el elemento raíz declara ${valor ?? '(no legible)'}`));
  }
  if (expected.fondo !== undefined) {
    const fondo = await backgroundOf(background);
    checks.push(check(fondo === expected.fondo.rgb, `el fondo es ${expected.fondo.hex}`, `el fondo es ${hexOf(fondo)}`));
  }
  if (expected.icono !== undefined) {
    const icono = await iconOf(themeToggle(page));
    checks.push(check(icono === expected.icono, `el control muestra el icono de ${expected.icono}`, `el control muestra ${icono === 'ninguno' ? 'ningún icono' : icono === undefined ? '(no legible)' : `el icono de ${icono}`}`));
  }
  return checks;
};

/** Mismas comprobaciones con su paso precedido de `prefix` (p. ej. «tras recargar: »), para no confundir dos momentos de la misma fila. */
export const prefixed = (prefix: string, checks: readonly Check[]): Check[] =>
  checks.map((entry) => ({ ok: entry.ok, expected: `${prefix}${entry.expected}`, observed: `${prefix}${entry.observed}` }));

/** Ruta sin la query de la fila (`/login?tenant=alumno01` → `/login`): la URL final debe ser la de la fila, no una redirección. */
export const pathFromRoute = (route: string): string => route.split('?')[0] ?? route;

/** Preferencia del sistema que el navegador declara con `matchMedia` (lo fija `emulateMedia` antes de cargar). */
export const systemSchemeIs = (page: Page, scheme: 'light' | 'dark'): Promise<boolean> =>
  safe(
    () =>
      page.locator('html').evaluate(
        (_element, name) => window.matchMedia(`(prefers-color-scheme: ${name})`).matches,
        scheme,
        { timeout: 2000 },
      ),
    false,
  );

/**
 * Estado de partida de la preferencia: sin valor guardado. Devuelve el motivo si hay un valor o si la lectura falla (una lectura
 * fallida no cuenta como «vacío»); `undefined` solo si la clave existe vacía (`null`).
 */
export const noStoredPreference = async (page: Page): Promise<string | undefined> => {
  const stored = await storedThemeOf(page);
  if (stored === null) return undefined;
  if (stored === undefined) return 'no se pudo leer la preferencia guardada';
  return `hay una preferencia guardada (${stored})`;
};

/** Espera (con tolerancia de la prueba) a que el valor guardado sea `expected` y devuelve la última lectura. */
export const settledStoredTheme = async (page: Page, expected: string): Promise<string | null | undefined> => {
  await waitUntil(async () => (await storedThemeOf(page)) === expected, SETTLE_MS);
  return storedThemeOf(page);
};

/**
 * Pulsa «Cambiar tema» `times` veces desde el tema claro y comprueba el estado TRAS CADA pulsación: la impar deja el tema oscuro y
 * la raíz `dark`; la par, el claro y la raíz `light`. Así un control muerto no pasa como «claro» final. Si una pulsación no se puede
 * hacer, devuelve el motivo en `failure`.
 */
export const pressAndWatch = async (page: Page, times: number): Promise<{ readonly failure?: string; readonly checks: Check[] }> => {
  const checks: Check[] = [];
  for (let index = 1; index <= times; index += 1) {
    const expectedTema: Tema = index % 2 === 1 ? 'oscuro' : 'claro';
    const expectedValor = expectedTema === 'oscuro' ? 'dark' : 'light';
    const failure = await runStepsLogged([[`pulsar «Cambiar tema» (vez ${index})`, () => themeToggle(page).click(ACTION)]]);
    if (failure) return { failure, checks };
    await waitUntil(async () => (await temaOf(page)) === expectedTema, SETTLE_MS);
    const observed = await temaOf(page);
    const root = await rootValueOf(page);
    checks.push(check(observed === expectedTema, `tras la pulsación ${index} el tema es ${expectedTema}`, `tras la pulsación ${index} el tema es ${observed ?? '(no legible)'}`));
    checks.push(check(root === expectedValor, `tras la pulsación ${index} el elemento raíz declara ${expectedValor}`, `tras la pulsación ${index} el elemento raíz declara ${root ?? '(no legible)'}`));
  }
  return { checks };
};

// --- Pasos de navegación y de preparación ------------------------------------------------------------------------------------------

/** Abrir /login?tenant=alumno01 y esperar su título. */
export const openLoginSteps = (page: Page): Step[] => [
  ['abrir /login?tenant=alumno01', () => page.goto(LOGIN_URL, ACTION)],
  ['ver el título «Iniciar sesión»', () => loginHeading(page).waitFor(ACTION)],
];

/** Escribir el correo y la contraseña como una persona, pulsar «Entrar» y esperar la llegada a /programs. */
export const signInSteps = (page: Page, credentials: { readonly email: string; readonly password: string }): Step[] => [
  ['escribir «Correo electrónico»', () => emailField(page).fill(credentials.email, ACTION)],
  ['escribir «Contraseña»', () => passwordField(page).fill(credentials.password, ACTION)],
  ['pulsar «Entrar»', () => enterButton(page).click(ACTION)],
  ['llegar a /programs', () => page.waitForURL(/\/programs/, ACTION)],
];

/** Pulsar «Cambiar tema» `times` veces, cada una con su paso (si una falla, el paso lo dice). */
export const pressSteps = (page: Page, times: number): Step[] =>
  Array.from({ length: times }, (_unused, index): Step => [`pulsar «Cambiar tema» (vez ${index + 1})`, () => themeToggle(page).click(ACTION)]);

/** Cuenta de gestor que citan las historias (seed: apps/api/src/seed/data.ts, program_manager, sin segundo factor). */
export const GESTOR = DEMO.gestor;

// --- Resultados -------------------------------------------------------------------------------------------------------------------

/**
 * Veredicto de una fila a partir de sus comprobaciones. Si alguna no se cumple, la nota dice en qué difiere (lo que la historia
 * espera y lo que se observó), además de la nota propia de la fila; si todas se cumplen, solo queda la nota propia.
 */
export const concluded = (checks: readonly Check[], extra: { readonly note?: string; readonly evidence?: Readonly<Record<string, unknown>> } = {}): Outcome => {
  const differences = checks.filter((entry) => !entry.ok).map((entry) => `${entry.expected} (observado: ${entry.observed})`);
  const note = differences.length === 0 ? extra.note : [extra.note, `En qué difiere: ${differences.join('; ')}.`].filter((part) => part !== undefined).join(' ');
  return conclude(checks, { ...(note === undefined ? {} : { note }), ...(extra.evidence === undefined ? {} : { evidence: extra.evidence }) });
};

/** Ejecuta los pasos en orden y se detiene en el primero que falla; conserva las tres primeras líneas del error de Playwright en la nota. */
export const runStepsLogged = async (steps: readonly Step[]): Promise<string | undefined> => {
  for (const [what, action] of steps) {
    try {
      await action();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const lines = message
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line !== '')
        .slice(0, 3)
        .join(' | ');
      return `no se pudo ${what}: ${lines}`;
    }
  }
  return undefined;
};

/** La acción de la fila no se pudo hacer: la pantalla no ofrece lo que la historia nombra (la llamada de Playwright va en la nota). */
export const actionMissing = (expected: string, failure: string): Outcome => outcome(false, expected, failure, { note: `La historia nombra un elemento que la pantalla no ofrece. Llamada de Playwright: ${failure}` });

