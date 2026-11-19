import { defineBrowserRows, type BrowserRowHandler } from '../../core/framework';
import { resetTenants, TENANT_A } from '../../../story-runs/support/prepare';
import { cell, check, preparationFailedWeb, strict, type Check } from '../../support/checks';
import { ACTION, CEILING_MS, isVisible, waitUntil } from '../../support/browser';
import { ACCOUNT_OF, bearer, getRaw, loginAs, sendRun } from '../api/common';
import { upload } from '../api/files';
import { interact } from '../web/common';
import { MOVIL_VERIFICATION_TESTIDS, VERIFICACION_DYNAMIC_TESTIDS } from '../../../../packages/shared/src/testids';
import { actionFailedMobile, mobileVerdict, onExpoWeb, prepareMobileRow, runCard, settledCard, zoomImageLoaded, type CardRead } from './common';

// US-VER-EJECUCION-010 — Historial en la app móvil: tarjetas, ampliar una imagen, PDF sin miniatura y descarga (Expo web: la descarga
// abre el contenido en una pestaña nueva). Preparación de cada fila: reinicio de alumno01; la app en /login con alumno01 en «Tenant de
// trabajo»; consultor@sigpro.test con el caso abierto (registro de avisos armado). Las tarjetas se leen en una sola evaluación.

/** Resultado de la celda: el mismo texto que el selector. */
const RESULTADO: ReadonlyMap<string, string> = new Map<string, string>([
  ['«Bloqueado»', 'Bloqueado'], // strict: 010/E1/resultado
  ['«Superado»', 'Superado'],
]);

/** Notas de la ejecución (texto exacto del seed). */
const NOTAS: ReadonlyMap<string, string> = new Map<string, string>([
  ['Ejecución bloqueada: el entorno de pruebas no estaba disponible.', 'Ejecución bloqueada: el entorno de pruebas no estaba disponible.'], // strict: 010/E1/notas
  ['Resultado conforme con el criterio de aceptación.', 'Resultado conforme con el criterio de aceptación.'],
]);

/** Evidencias de la tarjeta: ninguna («Sin evidencias»), o la captura del seed (nombre del archivo). */
const EVIDENCIAS: ReadonlyMap<string, string | undefined> = new Map<string, string | undefined>([
  ['«Sin evidencias»', undefined], // strict: 010/E1/evidencias
  ['la captura TC-001-001.png', 'TC-001-001.png'],
]);

/** Identificador de la tarjeta. */
const EJECUCION: ReadonlyMap<string, string> = new Map<string, string>([
  ['RUN-002', 'RUN-002'], // strict: 010/E1/ejecucion
  ['RUN-001', 'RUN-001'], // strict: 010/E4/ejecucion
]);

/** Nombre de la evidencia de imagen (E2). */
const CAPTURA: ReadonlyMap<string, string> = new Map<string, string>([['TC-001-001.png', 'TC-001-001.png']]); // strict: 010/E2/evidencia

/** Nombre de la evidencia PDF (E3). */
const PDF: ReadonlyMap<string, string> = new Map<string, string>([['informe.pdf', 'informe.pdf']]); // strict: 010/E3/evidencia

/** Descarga de la E4: la captura de RUN-001 (nombre del archivo). */
const DESCARGA: ReadonlyMap<string, string> = new Map<string, string>([['TC-001-001.png', 'TC-001-001.png']]); // strict: 010/E4/nombre

const REGISTRO = 'Lucía Fernández';

// --- E1: cada tarjeta muestra el resultado, las notas, las evidencias y quién la registró ---------------------------------------

const tarjeta: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const expected = `la tarjeta de ${cell(row, 'ejecucion')} muestra el resultado, las notas y las evidencias`;
  const prepared = await prepareMobileRow(page, 'consultor', expected);
  if (prepared !== undefined) return prepared;
  const id = strict('ejecucion', EJECUCION, cell(row, 'ejecucion'));
  const result = strict('resultado', RESULTADO, cell(row, 'resultado'));
  const notes = strict('notas', NOTAS, cell(row, 'notas'));
  const evidence = strict('evidencias', EVIDENCIAS, cell(row, 'evidencias'));
  const card: CardRead | undefined = await settledCard(runCard(page, id));
  const checks: Check[] = [
    check(card?.lines.includes(result) === true, `resultado «${result}»`, `resultado visible: ${card?.lines.find((line) => ['Superado', 'Fallido', 'Bloqueado'].includes(line)) ?? '(ninguno)'}`),
    check(card?.lines.includes(notes) === true, `notas «${notes}»`, `notas visibles: ${card?.lines.find((line) => line === notes) === undefined ? 'no aparecen' : 'aparecen'}`),
    check(card?.lines.includes(`Ejecutado por: ${REGISTRO}`) === true, `«Ejecutado por: ${REGISTRO}»`, `línea «Ejecutado por»: ${card?.lines.find((line) => line.startsWith('Ejecutado por')) ?? '(ausente)'}`),
  ];
  if (evidence === undefined) {
    checks.push(check(card?.lines.includes('Sin evidencias') === true, 'en sus evidencias «Sin evidencias»', card?.lines.includes('Sin evidencias') === true ? '«Sin evidencias»' : 'sin el texto «Sin evidencias»'));
  } else {
    const thumb = card?.thumbs.find((entry) => entry.label === 'Ampliar · Evidencia TC-001' || entry.label === 'Evidencia TC-001');
    checks.push(check(card?.lines.includes(evidence) === true, `la captura ${evidence} en sus evidencias`, `líneas de evidencia: ${card?.lines.filter((line) => line.endsWith('.png')).join(', ') || 'ninguna'}`));
    checks.push(check(thumb?.state === 'ready', 'la miniatura de la captura cargada', `miniatura ${thumb === undefined ? 'no aparece' : `con estado ${thumb.state ?? '(sin estado)'}`}`));
  }
  return mobileVerdict(checks);
};

// --- E2: al tocar la miniatura de una imagen se abre la hoja con la imagen ampliada -----------------------------------------------

const ampliar: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const name = strict('evidencia', CAPTURA, cell(row, 'evidencia'));
  const expected = `tocar la miniatura de ${name} abre una hoja titulada «${name}»`;
  const prepared = await prepareMobileRow(page, 'consultor', expected);
  if (prepared !== undefined) return prepared;
  await settledCard(runCard(page, 'RUN-001'));
  const thumb = page.getByTestId(VERIFICACION_DYNAMIC_TESTIDS.EVIDENCE_THUMB('EV-001'));
  const tapped = await interact(thumb, 'tocar la miniatura de TC-001-001.png', (element) => element.click(ACTION));
  if (tapped !== undefined) return actionFailedMobile(expected, tapped);
  await waitUntil(() => isVisible(page.getByRole('dialog', { name, exact: true })));
  const sheet = await isVisible(page.getByRole('dialog', { name, exact: true }));
  // La imagen ampliada debe cargar (no basta con que exista el nodo): se espera a que termine la carga, con techo
  await waitUntil(() => zoomImageLoaded(page));
  const zoomed = await zoomImageLoaded(page);
  const zoomShown = await isVisible(page.getByTestId(MOVIL_VERIFICATION_TESTIDS.EVIDENCE_ZOOM_IMAGE));
  return mobileVerdict(
    [
      check(sheet, `se abre una hoja titulada «${name}»`, sheet ? `hoja titulada «${name}» visible` : 'ninguna hoja con ese título'),
      check(zoomShown && zoomed, 'la hoja muestra la imagen ampliada cargada', `imagen ampliada ${zoomShown ? 'visible' : 'no visible'}, ${zoomed ? 'cargada' : 'sin cargar'}`),
    ],
    { note: 'La carga se lee en el <img> interno que react-native-web añade a Image (src data: URI, sin petición de red); depende de esa estructura de la librería.' },
  );
};

// --- E3: una evidencia PDF se muestra con su distintivo y sin miniatura de imagen --------------------------------------------------

const pdfSinMiniatura: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const name = strict('evidencia', PDF, cell(row, 'evidencia'));
  const expected = `la evidencia ${name} de RUN-051 muestra el distintivo «PDF» y no tiene miniatura de imagen`;
  const session = await loginAs(strict('cuenta', ACCOUNT_OF, 'alumno01@sigpro.lab'));
  if (session.token === undefined) return preparationFailedWeb(expected, 'alumno01 no obtiene accessToken en alumno01');
  const sent = await sendRun({ tenant: TENANT_A, code: 'TC-001', fields: { result: 'fail', notes: 'Adjunto informe' }, files: [upload(name, 'application/pdf', 'pdf', 1024)], headers: bearer(session.token) });
  if (sent.status !== 201) return preparationFailedWeb(expected, `la ejecución RUN-051 con ${name} responde ${sent.status} (no 201)`);
  const prepared = await prepareMobileRow(page, 'consultor', expected);
  if (prepared !== undefined) return prepared;
  const card = await settledCard(runCard(page, 'RUN-051'));
  const pdfThumb = card?.thumbs.find((entry) => entry.label === `Documento PDF ${name}`);
  const pdfBadge = card?.lines.includes('PDF') === true;
  const imageThumbs = card?.thumbs.filter((entry) => entry.label !== null && entry.label.startsWith('Evidencia')).length ?? -1;
  return mobileVerdict([
    check(card?.lines.includes(name) === true && pdfBadge, `distintivo «PDF» con el nombre ${name}`, `líneas de la evidencia: ${card?.lines.filter((line) => line === 'PDF' || line === name).join(' / ') || 'ninguna'}`),
    check(card?.lines.includes('1.0 KB') === true, 'con el tamaño 1.0 KB', `tamaño visible: ${card?.lines.find((line) => /KB|MB|B$/.test(line)) ?? '(sin tamaño)'}`),
    check(pdfThumb !== undefined && (card?.enlargeButtons ?? -1) === 0 && imageThumbs === 0, 'no ve una miniatura de imagen para esa evidencia', `miniaturas: ${card?.thumbs.map((entry) => entry.label ?? '(sin texto)').join(', ') || 'ninguna'}; botones de ampliar: ${String(card?.enlargeButtons ?? '(sin leer)')}`),
  ]);
};

// --- E4: descargar en la versión web de la app abre su contenido en una pestaña nueva ---------------------------------------------

/** Bytes de la evidencia EV-001 que guarda la API, con la cuenta de alumno01 (`undefined` si no se leen). */
const apiBytesEv001 = async (): Promise<Buffer | undefined> => {
  const session = await loginAs(strict('cuenta', ACCOUNT_OF, 'alumno01@sigpro.lab'));
  if (session.token === undefined) return undefined;
  const fetched = await getRaw('/evidence/EV-001', TENANT_A, bearer(session.token));
  return fetched.status === 200 ? fetched.bytes : undefined;
};

const descargaWeb: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const name = strict('nombre', DESCARGA, cell(row, 'nombre'));
  const expected = `pulsar «Descargar» en RUN-001 abre una pestaña nueva con el contenido de ${name}`;
  const prepared = await prepareMobileRow(page, 'consultor', expected);
  if (prepared !== undefined) return prepared;
  const id = strict('ejecucion', EJECUCION, cell(row, 'ejecucion'));
  const original = await apiBytesEv001();
  await settledCard(runCard(page, id));
  const button = runCard(page, id).getByRole('button', { name: `Descargar ${name}`, exact: true });
  const popupPending = page.context().waitForEvent('page', { timeout: CEILING_MS });
  popupPending.catch(() => undefined);
  const clicked = await interact(button, `pulsar «Descargar ${name}» en ${id}`, (element) => element.click(ACTION));
  if (clicked !== undefined) return actionFailedMobile(expected, clicked);
  const popup = await popupPending.catch(() => undefined);
  if (popup === undefined) return mobileVerdict([check(false, 'se abre una pestaña nueva', 'no se abrió ninguna pestaña nueva')]);
  await popup.waitForURL(/^blob:/, { timeout: CEILING_MS }).catch(() => undefined);
  // Los bytes que entrega la pestaña se comparan con los que guarda la API (la misma evidencia), en una sola lectura de la página.
  const expectedBytes: number[] = original === undefined ? [] : Array.from(original);
  const delivered = await popup
    .evaluate(
      async (wanted: number[]) => {
        const response = await fetch(location.href);
        const bytes = new Uint8Array(await response.arrayBuffer());
        return { type: document.contentType, length: bytes.length, same: bytes.length === wanted.length && wanted.every((value, index) => bytes[index] === value), png: bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 };
      },
      expectedBytes,
    )
    .catch(() => undefined);
  return mobileVerdict([
    check(popup.url().startsWith('blob:'), 'se abre una pestaña nueva con el archivo', `pestaña nueva en ${popup.url().startsWith('blob:') ? 'un enlace blob' : popup.url() || '(sin dirección)'}`),
    check(delivered?.type === 'image/png' && delivered.png, `el contenido de ${name} es un PNG`, `contenido ${delivered === undefined ? '(sin leer)' : `tipo ${delivered.type}${delivered.png ? ' con firma PNG' : ' sin firma PNG'}`}`),
    check(delivered?.same === true, `el contenido es el de ${name} guardado por la API (mismos bytes)`, delivered === undefined ? 'contenido sin leer' : delivered.same ? 'mismos bytes que la API' : `bytes distintos (${delivered.length} entregados; ${expectedBytes.length} en la API)`),
  ]);
};

defineBrowserRows({
  story: 'US-VER-EJECUCION-010',
  surface: 'expo-web',
  tenants: [TENANT_A],
  handlers: new Map<number, BrowserRowHandler>([
    [1, onExpoWeb(tarjeta)],
    [2, onExpoWeb(ampliar)],
    [3, onExpoWeb(pdfSinMiniatura)],
    [4, onExpoWeb(descargaWeb)],
  ]),
});
