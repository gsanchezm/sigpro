import type { Page } from '@playwright/test';
import { defineBrowserRows, type BrowserRowHandler, type ManifestRow, type Outcome } from '../../core/framework';
import { safe, waitUntil } from '../../support/browser';
import { cell, check, preparationFailedWeb, sleep, strict, type Check } from '../../support/checks';
import { CUENTA, TENANT_A, finish, thenOf, visibleFor, RESTRICTED } from '../api/common';
import {
  COBERTURA_MOVIL,
  DIRECT_APPROXIMATION,
  TRACE_NOTE,
  attrValue,
  backLink,
  badgeIn,
  boxOf,
  buttonCheck,
  buttonStateOf,
  cardOf,
  countOfLocator,
  detailBadge,
  detailBox,
  detailTitle,
  downloadButton,
  forbiddenBox,
  gotoApp,
  hiddenNote,
  onExpoWeb,
  openDocumentsFromMore,
  publishButton,
  publishDialog,
  publishReason,
  recountOf,
  seenCheck,
  settledList,
  shownCodes,
  signIn,
  textCheck,
  textOfLocator,
  versionChip,
  versionGroup,
  visibleOf,
  waitVisible,
  absenceAfterHold,
  actionFailed,
} from './common';

// US-DOC-RESTRINGIDOS-007 — Lista y ficha de un restringido en la app móvil (Expo web, 390 × 844; NO es nativo). Preparación de cada
// fila: `signIn` reinicia alumno01 (POST /api/admin/reset, 2xx comprobado) y entra con la cuenta de la fila (admin con el segundo
// factor). La primera tabla abre «Documentos» desde la pestaña «Más»; la segunda abre la ruta /documents/<documento> con carga completa
// (aproximación declarada). Cada elemento cuenta solo si se VE. La línea técnica bajo el aviso va a la evidencia y a la nota.

const FORBIDDEN_TITLE = 'No tienes permiso para ver este documento';
const FORBIDDEN_BODY = 'Los documentos restringidos solo los ven admin, gestores de programa y auditores.';
const BACK = 'Volver a Documentos';
const REASON = 'Solo admin y gestor pueden publicar versiones';
const TITLE_RESTRICTED = 'Plan de verificación PRG-002';
const TITLE_PUBLIC = 'Especificación técnica PRG-002';

/** Recuento de la celda «recuento» (el texto va entre «…»). */
const RECUENTO: ReadonlyMap<string, string> = new Map<string, string>([
  ['«12 documentos»', '12 documentos'],
  ['«8 documentos»', '8 documentos'],
]);

/** Aviso de la celda «aviso»: ausente, o presente con su texto exacto. */
interface Aviso {
  readonly presente: boolean;
  readonly texto?: string;
}

const AVISO: ReadonlyMap<string, Aviso> = new Map<string, Aviso>([
  ['no aparece', { presente: false }],
  ['aparece con el texto «4 documentos restringidos no son visibles para tu rol.»', { presente: true, texto: '4 documentos restringidos no son visibles para tu rol.' }],
]);

/** Documento de la celda «documento» de la segunda tabla. */
const DOCUMENTO: ReadonlyMap<string, string> = new Map<string, string>([
  ['DOC-003', 'DOC-003'],
  ['DOC-004', 'DOC-004'],
]);

/** Tipo de comprobación de la ficha (cada texto de la celda «resultado» nombra lo que debe verse). */
type Vista = 'denegada' | 'publica' | 'admin' | 'auditor';

const RESULTADO: ReadonlyMap<string, Vista> = new Map<string, Vista>([
  ['el título «No tienes permiso para ver este documento», el texto «Los documentos restringidos solo los ven admin, gestores de programa y auditores.» y el enlace «Volver a Documentos», y no ve el título del documento', 'denegada'],
  ['el título «Especificación técnica PRG-002» con la insignia «Público»', 'publica'],
  ['el título «Plan de verificación PRG-002», la insignia «Restringido», el botón «Descargar PDF» y el botón «Publicar nueva versión» habilitado', 'admin'],
  ['el título «Plan de verificación PRG-002», la insignia «Restringido», el botón «Descargar PDF» habilitado y «Publicar nueva versión» deshabilitado con el texto «Solo admin y gestor pueden publicar versiones»', 'auditor'],
]);

/** Insignia que la historia da a cada documento visible de la lista: «Restringido» para los restringidos, «Público» para el resto. */
const badgeOf = (code: string): string => (RESTRICTED.includes(code) ? 'Restringido' : 'Público');

/** Resultado de una verificación de pantalla: comprobaciones, la línea técnica (solo evidencia y nota) y la nota propia. */
interface Verification {
  readonly checks: readonly Check[];
  readonly trace?: string;
  readonly note?: string;
}

/** Resultado de la fila: lo que difiere, la línea técnica, la nota propia y la cobertura que la historia no prueba. */
const concluded = (verification: Verification, cuenta: string, ruta: string | undefined): Outcome => {
  const differences = verification.checks.filter((entry) => !entry.ok).map((entry) => `«${entry.expected}» no se cumple (${entry.observed})`);
  const notes = [
    differences.length > 0 ? `Difiere en: ${differences.join('; ')}` : undefined,
    verification.trace === undefined ? undefined : TRACE_NOTE,
    verification.note,
    COBERTURA_MOVIL,
  ].filter((text): text is string => text !== undefined);
  return finish(verification.checks, {
    note: notes.join(' · '),
    evidence: { cuenta, ...(ruta === undefined ? {} : { ruta }), traza: verification.trace ?? '(sin línea técnica)' },
  });
};

// --- Esquema 1: la lista de la app muestra solo los documentos que el rol puede ver ----------------------------------------------

const listByRole: BrowserRowHandler = async (row: ManifestRow, { page }) => {
  const expected = thenOf(row);
  const account = strict('cuenta', CUENTA, cell(row, 'cuenta'));
  const recuento = strict('recuento', RECUENTO, cell(row, 'recuento'));
  const aviso = strict('aviso', AVISO, cell(row, 'aviso'));
  const signed = await signIn(page, account);
  if (signed !== undefined) return preparationFailedWeb(expected, `${cell(row, 'cuenta')} no inicia sesión: ${signed}`);
  const opened = await openDocumentsFromMore(page);
  if (opened !== undefined) return actionFailed(expected, opened);
  const settled = await settledList(page);
  const count = await textOfLocator(recountOf(page));
  const countSeen = await visibleOf(recountOf(page));
  const codes = await shownCodes(page);
  const visible = visibleFor(account);
  const badges: { readonly code: string; readonly seen: string | undefined; readonly shown: boolean | undefined }[] = [];
  for (const code of codes ?? []) {
    badges.push({ code, seen: await textOfLocator(badgeIn(cardOf(page, code))), shown: await visibleOf(cardOf(page, code)) });
  }
  const wrongBadges = badges.filter((entry) => entry.seen !== badgeOf(entry.code));
  const hidden = badges.filter((entry) => entry.shown !== true);
  const sameRows = codes !== undefined && codes.length === visible.length && visible.every((code, index) => codes[index] === code);
  const checks: Check[] = [
    check(settled, 'la lista se asienta con su recuento', `la lista ${settled ? 'se asienta' : 'no se asienta'} (recuento «${count ?? '(sin leer)'}»)`),
    check(count === recuento && countSeen === true, `el recuento se ve y dice «${recuento}»`, `el recuento ${countSeen === true ? 'se ve' : 'no se ve o no se lee'} y dice «${count ?? '(sin leer)'}»`),
    check(
      sameRows,
      `la lista muestra ${visible.length} documentos (${visible.join(', ')})`,
      `la lista muestra ${codes === undefined ? '(sin leer)' : `${codes.length} documentos (${codes.join(', ') || '(ninguno)'})`}`,
    ),
    check(hidden.length === 0, 'todas las tarjetas se ven', hidden.length === 0 ? `las ${badges.length} tarjetas se ven` : `tarjetas que no se ven: ${hidden.map((entry) => entry.code).join(', ')}`),
    check(
      badges.length > 0 && wrongBadges.length === 0,
      'cada restringido lleva la insignia «Restringido» y cada público la insignia «Público»',
      wrongBadges.length === 0 ? `las ${badges.length} insignias son las que dice la historia` : `insignias que no coinciden: ${wrongBadges.map((entry) => `${entry.code} «${entry.seen ?? '(sin leer)'}»`).join(', ')}`,
    ),
  ];
  if (aviso.presente) {
    await waitUntil(async () => (await countOfLocator(hiddenNote(page))) === 1);
    const text = await textOfLocator(hiddenNote(page));
    const noteSeen = await visibleOf(hiddenNote(page));
    checks.push(textCheck(text, aviso.texto ?? '', 'el aviso de ocultos dice'));
    checks.push(seenCheck(noteSeen, 'el aviso de ocultos se ve', 'el aviso de ocultos'));
  } else {
    const absence = await absenceAfterHold(hiddenNote(page));
    checks.push(check(absence === 'ausente', 'no aparece ningún aviso de ocultos', `el aviso de ocultos está ${absence}`));
  }
  return concluded({ checks }, cell(row, 'cuenta'), undefined);
};

// --- Esquema 2: la ficha de un restringido se abre solo a quien tiene el permiso --------------------------------------------

/** Ficha denegada (consultor en /documents/DOC-003): aviso visible, título, texto, enlace visible y ausencias por separado. */
const deniedDetail = async (page: Page): Promise<Verification> => {
  const seen = await waitVisible(forbiddenBox(page));
  const titleAtNotice = forbiddenBox(page).getByText(FORBIDDEN_TITLE, { exact: true });
  const bodyAtNotice = forbiddenBox(page).getByText(FORBIDDEN_BODY, { exact: true });
  const titleSeen = await visibleOf(titleAtNotice);
  const bodySeen = await visibleOf(bodyAtNotice);
  const back = await textOfLocator(backLink(page));
  const backSeen = await visibleOf(backLink(page));
  const trace = await textOfLocator(forbiddenBox(page).getByText(/→/));
  const titleNodes = await countOfLocator(page.getByText(TITLE_RESTRICTED, { exact: false }));
  const selector = await countOfLocator(versionGroup(page));
  const chip1 = await countOfLocator(versionChip(page, 1));
  const chip2 = await countOfLocator(versionChip(page, 2));
  const download = await countOfLocator(downloadButton(page));
  const publish = await countOfLocator(publishButton(page));
  const absences: readonly (readonly [string, number])[] = [
    ['el título del documento', titleNodes],
    ['el selector de versiones', selector],
    ['la versión 1 del selector', chip1],
    ['la versión 2 del selector', chip2],
    ['el botón «Descargar PDF»', download],
    ['el botón «Publicar nueva versión»', publish],
  ];
  return {
    checks: [
      seenCheck(seen, `el aviso «${FORBIDDEN_TITLE}» se ve`, 'el aviso'),
      seenCheck(titleSeen, `el título «${FORBIDDEN_TITLE}» se ve`, 'el título del aviso'),
      seenCheck(bodySeen, `el texto «${FORBIDDEN_BODY}» se ve`, 'el texto del aviso'),
      textCheck(back, BACK, 'el enlace dice'),
      seenCheck(backSeen, `el enlace «${BACK}» se ve`, 'el enlace de vuelta'),
      ...absences.map(([label, count]) => check(count === 0, `no ve ${label}`, count === 0 ? `no ve ${label}` : count === -1 ? `${label} (sin leer)` : `ve ${label}`)),
    ],
    trace,
  };
};

/** Ficha pública (consultor en /documents/DOC-004): título y insignia «Público» visibles. */
const publicDetail = async (page: Page): Promise<Verification> => {
  const seen = await waitVisible(detailBox(page));
  const title = await textOfLocator(detailTitle(page));
  const badge = await textOfLocator(detailBadge(page));
  return {
    checks: [seenCheck(seen, 'la ficha del documento se ve', 'la ficha'), textCheck(title, TITLE_PUBLIC, 'el título es'), textCheck(badge, 'Público', 'la insignia es')],
  };
};

/** Ficha del restringido para admin: título, insignia, selector visible y descarga y publicar habilitados (visibles y recibiendo el clic). */
const adminDetail = async (page: Page): Promise<Verification> => {
  const seen = await waitVisible(detailBox(page));
  const title = await textOfLocator(detailTitle(page));
  const badge = await textOfLocator(detailBadge(page));
  const selector = await visibleOf(versionGroup(page));
  const download = await buttonStateOf(downloadButton(page));
  const publish = await buttonStateOf(publishButton(page));
  return {
    checks: [
      seenCheck(seen, 'la ficha del documento se ve', 'la ficha'),
      textCheck(title, TITLE_RESTRICTED, 'el título es'),
      textCheck(badge, 'Restringido', 'la insignia es'),
      seenCheck(selector, 'el selector de versión se ve', 'el selector de versión'),
      buttonCheck(download, 'habilitado', 'Descargar PDF'),
      buttonCheck(publish, 'habilitado', 'Publicar nueva versión'),
    ],
  };
};

/**
 * Ficha del restringido para el auditor: descarga habilitada y publicar deshabilitado; el motivo visible va bajo el botón, con su
 * atributo data-reason, y un clic sobre el botón no abre el diálogo de publicar.
 */
const auditorDetail = async (page: Page): Promise<Verification> => {
  const seen = await waitVisible(detailBox(page));
  const title = await textOfLocator(detailTitle(page));
  const badge = await textOfLocator(detailBadge(page));
  const download = await buttonStateOf(downloadButton(page));
  const publish = await buttonStateOf(publishButton(page));
  const dataReason = await attrValue(publishButton(page), 'data-reason');
  const reason = await textOfLocator(publishReason(page));
  const reasonSeen = await visibleOf(publishReason(page));
  const reasonBox = await boxOf(publishReason(page));
  const buttonBox = await boxOf(publishButton(page));
  const below = reasonBox !== undefined && buttonBox !== undefined && reasonBox.y >= buttonBox.y + buttonBox.height;
  // Un clic sobre el botón deshabilitado no debe abrir el diálogo de publicar (Playwright lo rechaza o no dispara nada)
  await safe(() => publishButton(page).click({ timeout: 1_500 }), undefined);
  await sleep(1_000);
  const dialogOpened = await countOfLocator(publishDialog(page));
  return {
    checks: [
      seenCheck(seen, 'la ficha del documento se ve', 'la ficha'),
      textCheck(title, TITLE_RESTRICTED, 'el título es'),
      textCheck(badge, 'Restringido', 'la insignia es'),
      buttonCheck(download, 'habilitado', 'Descargar PDF'),
      buttonCheck(publish, 'deshabilitado', 'Publicar nueva versión'),
      check(dataReason === REASON, `el motivo en data-reason dice «${REASON}»`, `el motivo en data-reason dice «${dataReason ?? '(sin leer)'}»`),
      textCheck(reason, REASON, 'el texto visible bajo el botón es'),
      seenCheck(reasonSeen, 'el motivo visible se ve', 'el motivo visible'),
      check(below, 'el texto está debajo del botón «Publicar nueva versión»', reasonBox === undefined || buttonBox === undefined ? 'las cajas del texto o del botón no se pudieron medir' : `el texto empieza en y=${String(Math.round(reasonBox.y))} y el botón acaba en y=${String(Math.round(buttonBox.y + buttonBox.height))}`),
      check(dialogOpened === 0, 'un clic sobre el botón no abre el diálogo de publicar', dialogOpened === 0 ? 'un clic sobre el botón no abre el diálogo de publicar' : dialogOpened === -1 ? 'diálogo de publicar (sin leer)' : `el clic abre el diálogo de publicar (${dialogOpened})`),
    ],
    note: 'El motivo del botón deshabilitado se comprueba en su texto visible (debajo del botón), en data-reason y en su estado efectivo; la app móvil es Expo web, no nativo.',
  };
};

const VERIFY: ReadonlyMap<Vista, (page: Page) => Promise<Verification>> = new Map<Vista, (page: Page) => Promise<Verification>>([
  ['denegada', deniedDetail],
  ['publica', publicDetail],
  ['admin', adminDetail],
  ['auditor', auditorDetail],
]);

const detailByAddress: BrowserRowHandler = async (row: ManifestRow, { page }) => {
  const expected = thenOf(row);
  const account = strict('cuenta', CUENTA, cell(row, 'cuenta'));
  const documento = strict('documento', DOCUMENTO, cell(row, 'documento'));
  const vista = strict('resultado', RESULTADO, cell(row, 'resultado'));
  const signed = await signIn(page, account);
  if (signed !== undefined) return preparationFailedWeb(expected, `${cell(row, 'cuenta')} no inicia sesión: ${signed}`);
  const ruta = `/documents/${documento}`;
  const navigated = await gotoApp(page, ruta);
  if (navigated !== undefined) return actionFailed(expected, navigated);
  const verify = VERIFY.get(vista);
  if (verify === undefined) throw new Error(`celda sin interpretación: vista «${vista}»`);
  const verification = await verify(page);
  return concluded({ ...verification, note: [verification.note, DIRECT_APPROXIMATION].filter((text): text is string => text !== undefined).join(' · ') }, cell(row, 'cuenta'), ruta);
};

defineBrowserRows({
  story: 'US-DOC-RESTRINGIDOS-007',
  surface: 'expo-web',
  tenants: [TENANT_A],
  handlers: new Map<number, BrowserRowHandler>([
    [1, onExpoWeb(listByRole)],
    [2, onExpoWeb(detailByAddress)],
  ]),
});
