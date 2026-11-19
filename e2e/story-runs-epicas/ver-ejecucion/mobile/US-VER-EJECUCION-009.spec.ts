import type { Page } from '@playwright/test';
import { defineBrowserRows, type BrowserRowHandler } from '../../core/framework';
import { resetTenants, TENANT_A } from '../../../story-runs/support/prepare';
import { cell, check, preparationFailedWeb, strict, type Check } from '../../support/checks';
import { ACTION, waitUntil } from '../../support/browser';
import { upload, type Upload } from '../api/files';
import {
  actionFailedMobile,
  filesList,
  mobileVerdict,
  onExpoWeb,
  openCaseMobile,
  pickManyButton,
  pickOneButton,
  pickPdfButton,
  pickWith,
  readFileErrors,
  readMobileFiles,
  signIn,
  type MobileFiles,
} from './common';
import { interact } from '../web/common';

// US-VER-EJECUCION-009 — Elegir evidencias con los botones de imagen y de PDF, en la app móvil (Expo web). Cada botón abre el selector
// del navegador (Playwright lo atiende con «filechooser», armado antes del clic). Preparación de cada fila: reinicio de alumno01; la app
// en /login con alumno01 en «Tenant de trabajo»; consultor@sigpro.test con el caso abierto y sin archivos elegidos. Lo que se muestra
// se lee en una sola evaluación de la lista de archivos y de sus avisos.

/** Tamaño de la celda en bytes (los puntos de miles de la celda). */
const TAMANO: ReadonlyMap<string, number> = new Map<string, number>([
  ['1.024', 1024], // strict: 009/E1/tamano
  ['2.097.153', 2097153],
]);

/** Lo que muestra la E1: la imagen entra con su tamaño y su vista previa, o se rechaza con su aviso. */
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

/** Resultado de la E2: cuántas de las nuevas entran y si aparece el aviso de cinco. */
interface Lo009b {
  readonly added: number;
  readonly aviso: string;
}
const RESULTADO_E2: ReadonlyMap<string, Lo009b> = new Map<string, Lo009b>([
  ['se añade solo una y aparece el aviso «Máximo 5 archivos por ejecución»', { added: 1, aviso: 'Máximo 5 archivos por ejecución' }], // strict: 009/E2/resultado
  ['no se añade ninguna y aparece el aviso «Máximo 5 archivos por ejecución»', { added: 0, aviso: 'Máximo 5 archivos por ejecución' }],
]);

/** PNG de 1.024 bytes con su nombre. */
const png = (name: string): Upload => upload(name, 'image/png', 'png', 1024);

/** Espera (con techo) a que la lista de archivos o sus avisos cumplan `done`; devuelve la última lectura. */
const settled = async (page: Page, done: (files: MobileFiles, errors: readonly string[]) => boolean): Promise<{ readonly files: MobileFiles | undefined; readonly errors: readonly string[] }> => {
  await waitUntil(async () => {
    const files = await readMobileFiles(page);
    const errors = await readFileErrors(page);
    return files !== undefined && done(files, errors);
  });
  return { files: await readMobileFiles(page), errors: await readFileErrors(page) };
};

/** Texto observable de la lista (archivo por archivo, sus líneas). */
const describe = (files: MobileFiles | undefined): string => {
  if (files === undefined) return '(sin leer)';
  if (files.items.length === 0) return 'Ningún archivo seleccionado';
  return files.items.map((item) => item.lines.join(' / ')).join(' | ');
};

// --- E1: una imagen elegida con el botón de un archivo se acepta o se rechaza -------------------------------------------------------

const unaImagen: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const name = cell(row, 'nombre');
  const expected = `${name}: ${cell(row, 'resultado')}`;
  const prepared = await signIn(page, 'consultor');
  const opened = prepared ?? (await openCaseMobile(page));
  if (opened !== undefined) return preparationFailedWeb(expected, opened);
  const size = strict('tamano', TAMANO, cell(row, 'tamano'));
  const want = strict('resultado', RESULTADO_E1, cell(row, 'resultado'));
  const picked = await pickWith(page, pickOneButton(page), 'pulsar «Adjuntar un archivo»', [upload(name, 'image/png', 'png', size)]);
  if (picked !== undefined) return actionFailedMobile(expected, picked);
  const panel = await settled(page, (files, errors) => files.items.length > 0 || errors.length > 0);
  const item = panel.files?.items.find((entry) => entry.lines.includes(name));
  const checks: Check[] = [];
  if (want.kind === 'lista') {
    checks.push(check(item !== undefined, `${name} aparece en «Archivos seleccionados»`, `«Archivos seleccionados»: ${describe(panel.files)}`));
    checks.push(check(item?.lines.includes(want.size) === true, `con el tamaño ${want.size}`, `tamaño visible ${item?.lines.find((line) => /KB|MB|B$/.test(line)) ?? '(sin tamaño)'}`));
    checks.push(check(item?.preview === true, 'con una vista previa de la imagen', item?.preview === true ? 'con vista previa' : 'sin vista previa'));
  } else {
    checks.push(check(item === undefined, `${name} no aparece en «Archivos seleccionados»`, item === undefined ? `${name} no aparece` : `${name} aparece en la lista`));
    checks.push(check(panel.errors.includes(want.aviso), `aparece el aviso «${want.aviso}»`, `avisos: ${panel.errors.length === 0 ? 'ninguno' : panel.errors.map((text) => `«${text}»`).join(', ')}`));
  }
  return mobileVerdict(checks);
};

// --- E2: un máximo de cinco imágenes con el botón de varios archivos -------------------------------------------------------------

const cincoImagenes: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const expected = `elegir ${cell(row, 'nuevos')} con ${cell(row, 'ya_elegidos')} ya elegidas: ${cell(row, 'resultado')}`;
  const prepared = await signIn(page, 'consultor');
  const opened = prepared ?? (await openCaseMobile(page));
  if (opened !== undefined) return preparationFailedWeb(expected, opened);
  const already = strict('ya_elegidos', YA_ELEGIDAS, cell(row, 'ya_elegidos'));
  const incoming = strict('nuevos', NUEVAS, cell(row, 'nuevos'));
  const want = strict('resultado', RESULTADO_E2, cell(row, 'resultado'));
  const preset = await pickWith(page, pickManyButton(page), `elegir ${already} imágenes previas`, Array.from({ length: already }, (_, index) => png(`foto-${index + 1}.png`)));
  if (preset !== undefined) return preparationFailedWeb(expected, preset.message);
  const ready = await settled(page, (files) => files.items.length === already);
  if (ready.files?.items.length !== already) return preparationFailedWeb(expected, `hay ${ready.files?.items.length ?? 0} imágenes previas, no ${already}`);
  const names = Array.from({ length: incoming }, (_, index) => `nueva-${index + 1}.png`);
  const picked = await pickWith(page, pickManyButton(page), `elegir ${incoming} imágenes nuevas`, names.map(png));
  if (picked !== undefined) return actionFailedMobile(expected, picked);
  const panel = await settled(page, (files, errors) => files.items.length === already + want.added || errors.length > 0);
  const entered = names.slice(0, want.added);
  const shown = (name: string): boolean => panel.files?.items.some((item) => item.lines.includes(name)) === true;
  return mobileVerdict([
    check(panel.files?.items.length === already + want.added, `«Archivos seleccionados» con ${already + want.added} imágenes`, `«Archivos seleccionados» con ${panel.files?.items.length ?? '(sin leer)'} imágenes`),
    check(entered.every(shown), `entra(n) ${entered.join(', ') || 'ninguna'}`, `nuevas en la lista: ${names.filter(shown).join(', ') || 'ninguna'}`),
    check(panel.errors.includes(want.aviso), `aparece el aviso «${want.aviso}»`, `avisos: ${panel.errors.length === 0 ? 'ninguno' : panel.errors.map((text) => `«${text}»`).join(', ')}`),
  ]);
};

// --- E3: un PDF elegido con el botón de PDF se acepta o se rechaza ------------------------------------------------------------------

const unPdf: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const name = cell(row, 'nombre');
  const expected = `${name}: ${cell(row, 'resultado')}`;
  const prepared = await signIn(page, 'consultor');
  const opened = prepared ?? (await openCaseMobile(page));
  if (opened !== undefined) return preparationFailedWeb(expected, opened);
  const size = strict('tamano', TAMANO, cell(row, 'tamano'));
  const want = strict('resultado', RESULTADO_E1, cell(row, 'resultado'));
  const picked = await pickWith(page, pickPdfButton(page), 'pulsar «Adjuntar PDF»', [upload(name, 'application/pdf', 'pdf', size)]);
  if (picked !== undefined) return actionFailedMobile(expected, picked);
  const panel = await settled(page, (files, errors) => files.items.length > 0 || errors.length > 0);
  const item = panel.files?.items.find((entry) => entry.lines.includes(name));
  const checks: Check[] = [];
  if (want.kind === 'lista') {
    checks.push(check(item !== undefined, `${name} aparece en «Archivos seleccionados»`, `«Archivos seleccionados»: ${describe(panel.files)}`));
    checks.push(check(item?.lines.includes('PDF') === true, 'con el distintivo «PDF»', `distintivo ${item?.lines.includes('PDF') === true ? 'PDF' : '(sin distintivo)'}`));
    checks.push(check(item?.lines.includes(want.size) === true, `con el tamaño ${want.size}`, `tamaño visible ${item?.lines.find((line) => /KB|MB|B$/.test(line)) ?? '(sin tamaño)'}`));
  } else {
    checks.push(check(item === undefined, `${name} no aparece en «Archivos seleccionados»`, item === undefined ? `${name} no aparece` : `${name} aparece en la lista`));
    checks.push(check(panel.errors.includes(want.aviso), `aparece el aviso «${want.aviso}»`, `avisos: ${panel.errors.length === 0 ? 'ninguno' : panel.errors.map((text) => `«${text}»`).join(', ')}`));
  }
  return mobileVerdict(checks);
};

// --- E4: un archivo elegido se quita de la lista ------------------------------------------------------------------------------------

const quitaUno: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const name = cell(row, 'nombre');
  const expected = `${name} deja de aparecer en «Archivos seleccionados»`;
  const prepared = await signIn(page, 'consultor');
  const opened = prepared ?? (await openCaseMobile(page));
  if (opened !== undefined) return preparationFailedWeb(expected, opened);
  const picked = await pickWith(page, pickOneButton(page), 'pulsar «Adjuntar un archivo»', [png(name)]);
  if (picked !== undefined) return preparationFailedWeb(expected, picked.message);
  await settled(page, (files) => files.items.length === 1);
  const removed = await interact(filesList(page).getByRole('button', { name: `Quitar ${name}`, exact: true }), `pulsar «Quitar ${name}»`, (element) => element.click(ACTION));
  if (removed !== undefined) return actionFailedMobile(expected, removed);
  const after = await settled(page, (files) => !files.items.some((item) => item.lines.includes(name)));
  return mobileVerdict([check(after.files?.items.some((item) => item.lines.includes(name)) === false, `${name} deja de aparecer en «Archivos seleccionados»`, `«Archivos seleccionados»: ${describe(after.files)}`)]);
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
