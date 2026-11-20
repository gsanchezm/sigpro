import { HOLD_MS, holdsFor, quoted, safe } from '../../support/browser';
import { cell, check, preparationFailedWeb, strict, type Check } from '../../support/checks';
import { defineBrowserRows, type BrowserRowHandler, type Outcome } from '../../core/framework';
import { TENANT_A, resetTenants } from '../../../story-runs/support/prepare';
import {
  ACCESS,
  MOBILE_NOTE,
  MOBILE_URL,
  absentAll,
  absentText,
  browserOf,
  conclude,
  heading1,
  codesVisible,
  messageCodesCheck,
  oneVisibleCheck,
  reachable,
  runStepsLogged,
  spanishShownCheck,
  titleCheck,
  unreachableMobile,
  visibleCount,
  withNote,
} from './common';
import { PLATFORMS, TRANSVERSAL_NOTE, enterAccessFor, openContext, pickLangFor, type Platform } from './transversal';

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

/** Solo la web muestra «Mantener la sesión en este equipo»: en la app móvil su ausencia es trivial. */
const WEB_ONLY_SPANISH = 'Mantener la sesión en este equipo';

/** Códigos de MENSAJE (motivos de error y de validación del catálogo): son los únicos que deciden el veredicto de la Regla de 001 (ejemplo: `required`). */
const MESSAGE_CODES: readonly string[] = ['required', 'badEmail', 'eMfa', 'e401', 'e403', 'e423', 'e409', 'pwShort', 'pwMismatch', 'termsReq', 'invalid_credentials', 'account_locked', 'pending_approval', 'invalid_mfa'];

/** Códigos de ROL: se miden aparte, fuera del veredicto (la historia no los nombra). */
const ROLE_CODES: readonly string[] = ['program_manager', 'consultant', 'admin', 'auditor'];

const LIST_NOTE = 'La lista de textos en español son los que citan las historias de Acceso de esta épica; no es todo el catálogo.';

const CODES_NOTE = 'El veredicto de la Regla de códigos (ejemplo «required») solo mira los códigos de mensaje del catálogo de Acceso (acceso.ts).';

const ROLE_NOTE = 'observación fuera del veredicto: la pantalla muestra los códigos de rol como texto en las insignias de usuarios de prueba (web TestUsers.tsx:37 y chip móvil login.tsx:184); la historia no los nombra.';

const FRENCH_NOTE = 'La fila no distingue: el catálogo no tiene francés, así que una app que ignorara el idioma del navegador mostraría igual el español; la fila solo prueba que el español es el idioma por defecto.';

const EXPECTED_ACCESS = 've el título «Iniciar sesión» y el botón «Entrar»';

/** Notas de la fila móvil de una historia transversal (superficie web, filas de Expo). */
const movilNotes: readonly string[] = [MOBILE_NOTE, TRANSVERSAL_NOTE];

const withNotes = (result: Outcome, notes: readonly string[]): Outcome => notes.reduce((acc, note) => withNote(acc, note), result);

// --- Esquema 1: sin elección guardada la pantalla de acceso se ve en español, aunque el sistema esté en otro idioma -----------

const systemLanguage: BrowserRowHandler = async (row, { context }) => {
  const systemText = cell(row, 'idioma_sistema');
  const system = strict('idioma_sistema', SYSTEM_LANGUAGE, systemText);
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
    const title = await titleCheck(page, ACCESS.es.title);
    const button = await oneVisibleCheck(page.getByRole('button', { name: 'Entrar', exact: true }), 'botón «Entrar»');
    // Ventana de observación: la pantalla no cambia a otro idioma después de cargar (la preferencia de la app móvil se lee de forma asíncrona)
    const stays = await holdsFor(async () => (await visibleCount(heading1(page, ACCESS.es.title))) === 1);
    const steady = check(stays.held, `sigue en «${ACCESS.es.title}» durante ${HOLD_MS / 1000} s`, stays.held ? `sigue en «${ACCESS.es.title}»` : `cambia a otro título a los ${stays.brokeAtMs ?? 0} ms`);
    const notes = [...(platform === 'movil' ? movilNotes : []), ...(system.prefix === 'fr' ? [FRENCH_NOTE] : [])];
    return withNotes(conclude([title, button, steady], { evidence: { idiomaNavegador: navigatorLanguage } }), notes);
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
    // Control positivo: antes de elegir EN, los textos de la lista que esta plataforma muestra se ven en español
    const shownList = platform === 'web' ? SPANISH_ACCESS : SPANISH_ACCESS.filter((text) => text !== WEB_ONLY_SPANISH);
    const control = await spanishShownCheck(page, shownList);
    const chosen = await runStepsLogged(pickLangFor(platform, page, ACCESS.es.language, 'en'));
    if (chosen) return preparationFailedWeb(expected, chosen);
    // El título en inglés es el ancla: sin él las ausencias serían ciertas por una pantalla sin cargar
    const checks: Check[] = [
      control,
      await titleCheck(page, ACCESS.en.title),
      await absentText(page, texto),
      await absentAll(page, SPANISH_ACCESS),
      await messageCodesCheck(page, MESSAGE_CODES),
    ];
    // Códigos de rol visibles: se miden aparte, fuera del veredicto, después de la ventana de observación (el panel de usuarios carga aparte)
    const roleVisible = await codesVisible(page, ROLE_CODES);
    const movilOnly = platform === 'movil' ? [...movilNotes, `En la app móvil «${WEB_ONLY_SPANISH}» no existe: su ausencia es trivial y el control positivo usa los otros ${shownList.length} textos.`] : [];
    const roleNotes = roleVisible !== undefined && roleVisible.length > 0 ? [ROLE_NOTE] : [];
    const notes = [LIST_NOTE, CODES_NOTE, ...roleNotes, ...movilOnly];
    return withNotes(conclude(checks, { evidence: { codigosDeRolVisibles: roleVisible ?? '(lectura fallida)' } }), notes);
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
