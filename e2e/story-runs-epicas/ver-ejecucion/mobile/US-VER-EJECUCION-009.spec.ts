import type { Page } from '@playwright/test';
import { defineBrowserRows, type BrowserRowHandler } from '../../core/framework';
import { resetTenants, TENANT_A } from '../../../story-runs/support/prepare';
import { cell, check, preparationFailedWeb, strict, type Check } from '../../support/checks';
import { ACTION, waitUntil } from '../../support/browser';
import { upload, type Upload } from '../api/files';
import { interact, watchRunPosts } from '../web/common';
import {
  actionFailedMobile,
  filesList,
  mobileVerdict,
  onExpoWeb,
  pickManyButton,
  pickOneButton,
  pickPdfButton,
  pickWith,
  prepareMobileRow,
  readMobilePanel,
  type MobilePanel,
} from './common';

// US-VER-EJECUCION-009 — Elegir evidencias con los botones de imagen y de PDF, en la app móvil (Expo web). Cada botón abre el selector
// del navegador (Playwright lo atiende con «filechooser», armado antes del clic). Preparación de cada fila: reinicio de alumno01; la app
// en /login con alumno01 en «Tenant de trabajo»; consultor@sigpro.test con el caso abierto (registro de avisos armado) y sin archivos.
// Lo que se muestra se lee en UNA sola evaluación sobre el bloque de evidencias (archivos y avisos a la vez).

/** Tipo que declara la imagen de la E1 (columna «tipo»). */
const TIPO: ReadonlyMap<string, string> = new Map<string, string>([['image/png', 'image/png']]); // strict: 009/E1/tipo

/** Tamaño de la celda en bytes (los puntos de miles de la celda). */
const TAMANO: ReadonlyMap<string, number> = new Map<string, number>([
  ['1.024', 1024], // strict: 009/E1/tamano, 009/E3/tamano
  ['2.097.153', 2097153],
]);

/** Lo que muestra la fila: la lista (con tamaño, vista previa o distintivo) o el rechazo con su aviso. */
type Lo009 =
  | { readonly kind: 'lista'; readonly size: string; readonly preview: boolean; readonly badge: boolean }
  | { readonly kind: 'rechazo'; readonly aviso: string };

const RESULTADO_E1: ReadonlyMap<string, Lo009> = new Map<string, Lo009>([
  ['aparece en «Archivos seleccionados» con el tamaño 1.0 KB y una vista previa de la imagen', { kind: 'lista', size: '1.0 KB', preview: true, badge: false }], // strict: 009/E1/resultado
  ['no aparece en «Archivos seleccionados» y aparece el aviso «grande.png: supera los 2 MB»', { kind: 'rechazo', aviso: 'grande.png: supera los 2 MB' }],
  ['aparece en «Archivos seleccionados» con el distintivo «PDF» y el tamaño 1.0 KB', { kind: 'lista', size: '1.0 KB', preview: false, badge: true }], // strict: 009/E3/resultado
  ['no aparece en «Archivos seleccionados» y aparece el aviso «informe-grande.pdf: supera los 2 MB»', { kind: 'rechazo', aviso: 'informe-grande.pdf: supera los 2 MB' }],
]);

/** Número de imágenes que ya están elegidas (E2) y de imágenes que se eligen ahora (E2). */
const YA_ELEGIDAS: ReadonlyMap<string, number> = new Map<string, number>([
  ['4', 4], // strict: 009/E2/ya_elegidos
  ['5', 5],
]);
const NUEVAS: ReadonlyMap<string, number> = new Map<string, number>([
  ['2', 2], // strict: 009/E2/nuevos
  ['1', 1],
]);

/** Resultado de la E2: cuántas de las nuevas entran y el aviso de cinco. */
interface Lo009b {
  readonly added: number;
  readonly aviso: string;
}
const RESULTADO_E2: ReadonlyMap<string, Lo009b> = new Map<string, Lo009b>([
  ['se añade solo una y aparece el aviso «Máximo 5 archivos por ejecución»', { added: 1, aviso: 'Máximo 5 archivos por ejecución' }], // strict: 009/E2/resultado
  ['no se añade ninguna y aparece el aviso «Máximo 5 archivos por ejecución»', { added: 0, aviso: 'Máximo 5 archivos por ejecución' }],
]);

/** Nombre de la celda de la E4 (el archivo que se quita). */
const NOMBRE_E4: ReadonlyMap<string, string> = new Map<string, string>([['captura.png', 'captura.png']]); // strict: 009/E4/nombre

/** PNG de 1.024 bytes con su nombre y el tipo que declara la fila. */
const png = (name: string, type = 'image/png'): Upload => upload(name, type, 'png', 1024);

/** Espera (con techo) a que el bloque de evidencias cumpla `done`; devuelve la última lectura atómica. */
const settled = async (page: Page, done: (panel: MobilePanel) => boolean): Promise<MobilePanel | undefined> => {
  await waitUntil(async () => {
    const panel = await readMobilePanel(page);
    return panel !== undefined && done(panel);
  });
  return readMobilePanel(page);
};

/** Texto observable de la lista (una línea por archivo, sus partes separadas por « / »). */
const describe = (panel: MobilePanel | undefined): string => {
  if (panel === undefined) return '(sin leer)';
  if (panel.items.length === 0) return 'Ningún archivo seleccionado';
  return panel.items.map((item) => item.lines.join(' / ')).join(' | ');
};

/** Texto de los avisos visibles (o «ninguno»). */
const describeErrors = (panel: MobilePanel | undefined): string => (panel === undefined ? '(sin leer)' : panel.errors.length === 0 ? 'ninguno' : panel.errors.map((text) => `«${text}»`).join(', '));

// --- E1: una imagen elegida con el botón de un archivo se acepta o se rechaza -------------------------------------------------------

const unaImagen: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const name = cell(row, 'nombre');
  const expected = `${name}: ${cell(row, 'resultado')}`;
  const prepared = await prepareMobileRow(page, 'consultor', expected);
  if (prepared !== undefined) return prepared;
  const posts = watchRunPosts(page);
  const declared = strict('tipo', TIPO, cell(row, 'tipo'));
  const size = strict('tamano', TAMANO, cell(row, 'tamano'));
  const want = strict('resultado', RESULTADO_E1, cell(row, 'resultado'));
  const picked = await pickWith(page, pickOneButton(page), 'pulsar «Adjuntar un archivo»', [upload(name, declared, 'png', size)]);
  if (picked !== undefined) return actionFailedMobile(expected, picked);
  const panel = await settled(page, (current) => current.items.length > 0 || current.errors.length > 0);
  const item = panel?.items.find((entry) => entry.lines.includes(name));
  const checks: Check[] = [];
  if (want.kind === 'lista') {
    checks.push(check(item !== undefined, `${name} aparece en «Archivos seleccionados»`, `«Archivos seleccionados»: ${describe(panel)}`));
    checks.push(check(item?.lines.includes(want.size) === true, `con el tamaño ${want.size}`, `tamaño visible ${item?.lines.find((line) => /KB|MB|B$/.test(line)) ?? '(sin tamaño)'}`));
    checks.push(check(item?.preview === true, 'con una vista previa de la imagen', item?.preview === true ? 'con vista previa' : 'sin vista previa'));
  } else {
    checks.push(check(item === undefined, `${name} no aparece en «Archivos seleccionados»`, item === undefined ? `${name} no aparece` : `${name} aparece en la lista`));
    checks.push(check(panel?.errors.includes(want.aviso) === true, `aparece el aviso «${want.aviso}»`, `avisos: ${describeErrors(panel)}`));
  }
  checks.push(check(posts() === 0, 'elegir un archivo no envía nada al servidor', `peticiones de ejecución enviadas: ${posts()}`));
  return mobileVerdict(checks);
};

// --- E2: un máximo de cinco imágenes con el botón de varios archivos -------------------------------------------------------------

const cincoImagenes: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const expected = `elegir ${cell(row, 'nuevos')} con ${cell(row, 'ya_elegidos')} ya elegidas: ${cell(row, 'resultado')}`;
  const prepared = await prepareMobileRow(page, 'consultor', expected);
  if (prepared !== undefined) return prepared;
  const already = strict('ya_elegidos', YA_ELEGIDAS, cell(row, 'ya_elegidos'));
  const incoming = strict('nuevos', NUEVAS, cell(row, 'nuevos'));
  const want = strict('resultado', RESULTADO_E2, cell(row, 'resultado'));
  const preset = await pickWith(page, pickManyButton(page), `elegir ${already} imágenes previas`, Array.from({ length: already }, (_, index) => png(`foto-${index + 1}.png`)));
  if (preset !== undefined) return preparationFailedWeb(expected, preset.message);
  const ready = await settled(page, (current) => current.items.length === already);
  if (ready?.items.length !== already) return preparationFailedWeb(expected, `hay ${ready?.items.length ?? 0} imágenes previas, no ${already}`);
  const names = Array.from({ length: incoming }, (_, index) => `nueva-${index + 1}.png`);
  const picked = await pickWith(page, pickManyButton(page), `elegir ${incoming} imágenes nuevas`, names.map((name) => png(name)));
  if (picked !== undefined) return actionFailedMobile(expected, picked);
  const panel = await settled(page, (current) => current.items.length === already + want.added || current.errors.length > 0);
  const entered = names.slice(0, want.added);
  const shown = (name: string): boolean => panel?.items.some((item) => item.lines.includes(name)) === true;
  return mobileVerdict([
    check(panel?.items.length === already + want.added, `«Archivos seleccionados» con ${already + want.added} imágenes`, `«Archivos seleccionados» con ${panel?.items.length ?? '(sin leer)'} imágenes`),
    check(entered.every(shown), `entra(n) ${entered.join(', ') || 'ninguna'}`, `nuevas en la lista: ${names.filter(shown).join(', ') || 'ninguna'}`),
    check(panel?.errors.includes(want.aviso) === true, `aparece el aviso «${want.aviso}»`, `avisos: ${describeErrors(panel)}`),
  ]);
};

// --- E3: un PDF elegido con el botón de PDF se acepta o se rechaza ------------------------------------------------------------------

const unPdf: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const name = cell(row, 'nombre');
  const expected = `${name}: ${cell(row, 'resultado')}`;
  const prepared = await prepareMobileRow(page, 'consultor', expected);
  if (prepared !== undefined) return prepared;
  const size = strict('tamano', TAMANO, cell(row, 'tamano'));
  const want = strict('resultado', RESULTADO_E1, cell(row, 'resultado'));
  const picked = await pickWith(page, pickPdfButton(page), 'pulsar «Adjuntar PDF»', [upload(name, 'application/pdf', 'pdf', size)]);
  if (picked !== undefined) return actionFailedMobile(expected, picked);
  const panel = await settled(page, (current) => current.items.length > 0 || current.errors.length > 0);
  const item = panel?.items.find((entry) => entry.lines.includes(name));
  const checks: Check[] = [];
  if (want.kind === 'lista') {
    checks.push(check(item !== undefined, `${name} aparece en «Archivos seleccionados»`, `«Archivos seleccionados»: ${describe(panel)}`));
    checks.push(check(item?.lines.includes('PDF') === true, 'con el distintivo «PDF»', `distintivo ${item?.lines.includes('PDF') === true ? 'PDF' : '(sin distintivo)'}`));
    checks.push(check(item?.lines.includes(want.size) === true, `con el tamaño ${want.size}`, `tamaño visible ${item?.lines.find((line) => /KB|MB|B$/.test(line)) ?? '(sin tamaño)'}`));
  } else {
    checks.push(check(item === undefined, `${name} no aparece en «Archivos seleccionados»`, item === undefined ? `${name} no aparece` : `${name} aparece en la lista`));
    checks.push(check(panel?.errors.includes(want.aviso) === true, `aparece el aviso «${want.aviso}»`, `avisos: ${describeErrors(panel)}`));
  }
  return mobileVerdict(checks);
};

// --- E4: un archivo elegido se quita de la lista ------------------------------------------------------------------------------------

const quitaUno: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const name = strict('nombre', NOMBRE_E4, cell(row, 'nombre'));
  const expected = `${name} deja de aparecer en «Archivos seleccionados»`;
  const prepared = await prepareMobileRow(page, 'consultor', expected);
  if (prepared !== undefined) return prepared;
  const posts = watchRunPosts(page);
  const picked = await pickWith(page, pickOneButton(page), 'pulsar «Adjuntar un archivo»', [png(name)]);
  if (picked !== undefined) return preparationFailedWeb(expected, picked.message);
  await settled(page, (current) => current.items.length === 1);
  const removed = await interact(filesList(page).getByRole('button', { name: `Quitar ${name}`, exact: true }), `pulsar «Quitar ${name}»`, (element) => element.click(ACTION));
  if (removed !== undefined) return actionFailedMobile(expected, removed);
  const after = await settled(page, (current) => !current.items.some((item) => item.lines.includes(name)));
  return mobileVerdict([
    check(after?.items.some((item) => item.lines.includes(name)) === false, `${name} deja de aparecer en «Archivos seleccionados»`, `«Archivos seleccionados»: ${describe(after)}`),
    check(posts() === 0, 'quitar un archivo no envía nada al servidor', `peticiones de ejecución enviadas: ${posts()}`),
  ]);
};

defineBrowserRows({
  story: 'US-VER-EJECUCION-009',
  surface: 'expo-web',
  tenants: [TENANT_A],
  handlers: new Map<number, BrowserRowHandler>([
    [1, onExpoWeb(unaImagen)],
    [2, onExpoWeb(cincoImagenes)],
    [3, onExpoWeb(unPdf)],
    [4, onExpoWeb(quitaUno)],
  ]),
});
