import { TENANT_A, resetTenants } from '../../../story-runs/support/prepare';
import { quoted, safe } from '../../support/browser';
import { cell, preparationFailedWeb, strict } from '../../support/checks';
import { defineBrowserRows, type BrowserRowHandler } from '../../core/framework';
import {
  conclude,
  ACCESS,
  MOBILE_NOTE,
  MOBILE_URL,
  absentAll,
  absentText,
  browserOf,
  oneVisibleCheck,
  reachable,
  runStepsLogged,
  titleCheck,
  unreachableMobile,
  withNote,
} from './common';
import { PLATFORMS, enterAccessFor, openContext, pickLangFor, type Platform } from './transversal';

// US-I18N-001 — Idioma por defecto español y textos completos en inglés (TRANSVERSAL: filas web a 1440 px y de la app móvil servida
// como web de Expo a 390 px; NO nativa). Preparación de cada fila: reinicio de alumno01 y una pantalla de Acceso en un contexto nuevo,
// sin sesión y sin elección de idioma guardada. El idioma del sistema de la fila (Esquema 1) va en el contexto, no se finge.

interface SystemLanguage {
  readonly locale: string;
  readonly prefix: string;
}

const SYSTEM_LANGUAGE: ReadonlyMap<string, SystemLanguage> = new Map<string, SystemLanguage>([
  ['inglés', { locale: 'en-US', prefix: 'en' }],
  ['francés', { locale: 'fr-FR', prefix: 'fr' }],
]);

/** Los textos en español de Acceso que citan las historias de la épica (la lista no es todo el catálogo). */
const SPANISH_ACCESS: readonly string[] = ['Iniciar sesión', 'Entrar', '¿Olvidaste la contraseña?', 'Mantener la sesión en este equipo', '¿Sin cuenta?', 'Correo electrónico', 'Contraseña'];

const LIST_NOTE = 'La lista de textos en español son los que citan las historias de Acceso de esta épica; no es todo el catálogo.';

const EXPECTED_ACCESS = 've el título «Iniciar sesión» y el botón «Entrar»';

// --- Esquema 1: sin elección guardada la pantalla de acceso se ve en español, aunque el sistema esté en otro idioma -----------

const systemLanguage: BrowserRowHandler = async (row, { context }) => {
  const system = strict('idioma_sistema', SYSTEM_LANGUAGE, cell(row, 'idioma_sistema'));
  const platform: Platform = strict('plataforma', PLATFORMS, cell(row, 'plataforma'));
  if (platform === 'movil' && !(await reachable(`${MOBILE_URL}/login`))) return unreachableMobile(EXPECTED_ACCESS);
  await resetTenants([TENANT_A]);
  const own = await openContext(browserOf(context), platform, system.locale, false);
  try {
    const page = await own.newPage();
    const prepared = await runStepsLogged(enterAccessFor(platform, page));
    if (prepared) return preparationFailedWeb(EXPECTED_ACCESS, prepared);
    // La precondición de la historia es el idioma del navegador o del dispositivo: se lee, no se supone
    const navigatorLanguage = await safe(() => page.evaluate(() => window.navigator.language), '(no legible)');
    if (!navigatorLanguage.startsWith(system.prefix)) return preparationFailedWeb(EXPECTED_ACCESS, `el navegador dice «${navigatorLanguage}», no «${system.prefix}»`);
    const result = conclude(
      [await titleCheck(page, 'Iniciar sesión'), await oneVisibleCheck(page.getByRole('button', { name: 'Entrar', exact: true }), 'botón «Entrar»')],
      { evidence: { idiomaNavegador: navigatorLanguage } },
    );
    return platform === 'movil' ? withNote(result, MOBILE_NOTE) : result;
  } finally {
    await own.close();
  }
};

// --- Esquema 2: con el inglés elegido no queda ningún texto en español en la pantalla de acceso --------------------------

const noSpanish: BrowserRowHandler = async (row, { context }) => {
  const platform: Platform = strict('plataforma', PLATFORMS, cell(row, 'plataforma'));
  const texto = quoted(cell(row, 'texto_en_espanol'));
  const expected = `no ve el texto «${texto}» y ningún texto en español de la lista de Acceso`;
  if (platform === 'movil' && !(await reachable(`${MOBILE_URL}/login`))) return unreachableMobile(expected);
  await resetTenants([TENANT_A]);
  const own = await openContext(browserOf(context), platform, 'es-ES', false);
  try {
    const page = await own.newPage();
    const prepared = await runStepsLogged(enterAccessFor(platform, page));
    if (prepared) return preparationFailedWeb(expected, prepared);
    const chosen = await runStepsLogged(pickLangFor(platform, page, ACCESS.es.language, 'en'));
    if (chosen) return preparationFailedWeb(expected, chosen);
    // El título en inglés es el ancla: sin él las ausencias serían ciertas por una pantalla sin cargar
    const result = conclude([await titleCheck(page, ACCESS.en.title), await absentText(page, texto), await absentAll(page, SPANISH_ACCESS, 'Acceso')]);
    const withList = withNote(result, LIST_NOTE);
    return platform === 'movil' ? withNote(withList, MOBILE_NOTE) : withList;
  } finally {
    await own.close();
  }
};

defineBrowserRows({
  story: 'US-I18N-001',
  surface: 'web',
  tenants: [TENANT_A],
  handlers: new Map<number, BrowserRowHandler>([
    [1, systemLanguage],
    [2, noSpanish],
  ]),
});
