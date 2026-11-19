import type { Page } from '@playwright/test';
import { defineBrowserRows, type BrowserRowHandler } from '../../core/framework';
import { resetTenants, TENANT_A } from '../../../story-runs/support/prepare';
import { cell, check, preparationFailedWeb, sleep, strict, type Check } from '../../support/checks';
import { ACTION, waitUntil } from '../../support/browser';
import { upload, type FileKind, type Upload } from '../api/files';
import { verdict } from '../api/common';
import {
  actionFailed,
  chooseFiles,
  dropFile,
  dropzone,
  evidenceMultipleInput,
  evidenceSimpleInput,
  interact,
  noToast,
  onWeb,
  prepareRow,
  quietCheck,
  readFilesPanel,
  removeFileButton,
  watchRunPosts,
  type Blocked,
  type FilesPanel,
} from './common';

// US-VER-EJECUCION-006 — Elegir evidencias antes de enviar, en la web: tipo, tamaño, cantidad, repetidos, quitar y arrastrar. Todo es
// local: ninguna fila envía la ejecución al servidor (Regla 006:28), y cada fila lo comprueba con el recuento de peticiones. Preparación
// de cada fila: reinicio de alumno01 y consultor@sigpro.test con el caso abierto (registro de avisos armado) y sin archivos. La lectura de
// «Archivos seleccionados» y de sus avisos se hace en una sola evaluación.

/** Lo que muestra la lista de archivos tras una elección: el archivo entra (lista) o se rechaza con su aviso. */
type Expect006 =
  | { readonly kind: 'lista'; readonly size: string; readonly preview: boolean; readonly badge: boolean }
  | { readonly kind: 'rechazo'; readonly aviso: string };

/** Tipo que declara el archivo de la E1, con el contenido que lo representa. */
const TIPO: ReadonlyMap<string, { readonly type: string; readonly kind: FileKind }> = new Map<string, { readonly type: string; readonly kind: FileKind }>([
  ['image/png', { type: 'image/png', kind: 'png' }], // strict: 006/E1/tipo
  ['application/pdf', { type: 'application/pdf', kind: 'pdf' }],
  ['text/plain', { type: 'text/plain', kind: 'texto' }],
]);

/** Tamaño de la E1 en bytes (los puntos de miles de la celda). */
const TAMANO: ReadonlyMap<string, number> = new Map<string, number>([
  ['1.024', 1024], // strict: 006/E1/tamano
  ['2.097.153', 2097153],
]);

/** Resultado de la E1: la lista o el aviso del rechazo (texto exacto de la historia). */
const RESULTADO_E1: ReadonlyMap<string, Expect006> = new Map<string, Expect006>([
  ['aparece en «Archivos seleccionados» con el tamaño 1.0 KB y una vista previa de la imagen', { kind: 'lista', size: '1.0 KB', preview: true, badge: false }], // strict: 006/E1/resultado
  ['aparece en «Archivos seleccionados» con el distintivo «PDF»', { kind: 'lista', size: '1.0 KB', preview: false, badge: true }],
  ['no aparece en «Archivos seleccionados» y aparece el aviso «texto.txt: solo se admiten PNG, JPEG o PDF»', { kind: 'rechazo', aviso: 'texto.txt: solo se admiten PNG, JPEG o PDF' }],
  ['no aparece en «Archivos seleccionados» y aparece el aviso «grande.png: supera los 2 MB»', { kind: 'rechazo', aviso: 'grande.png: supera los 2 MB' }],
]);

/** Número de archivos que ya están elegidos antes de la elección (E2) y que se eligen (E2). */
const YA_ELEGIDOS: ReadonlyMap<string, number> = new Map<string, number>([
  ['0', 0], // strict: 006/E2/ya_elegidos
  ['4', 4],
  ['5', 5],
]);
const NUEVOS: ReadonlyMap<string, number> = new Map<string, number>([
  ['5', 5], // strict: 006/E2/nuevos
  ['2', 2],
  ['1', 1],
]);

/** Lo que muestra la E2: cuántos de los nuevos entran y si aparece el aviso de cinco. */
interface Resultado2 {
  readonly added: number;
  readonly aviso: string | undefined;
}
const RESULTADO_E2: ReadonlyMap<string, Resultado2> = new Map<string, Resultado2>([
  ['se añaden los cinco y no aparece ningún aviso', { added: 5, aviso: undefined }], // strict: 006/E2/resultado
  ['se añade solo uno y aparece el aviso «Máximo 5 archivos por ejecución»', { added: 1, aviso: 'Máximo 5 archivos por ejecución' }],
  ['no se añade ninguno y aparece el aviso «Máximo 5 archivos por ejecución»', { added: 0, aviso: 'Máximo 5 archivos por ejecución' }],
]);

/** Archivo PNG de 1.024 bytes con su nombre. */
const png = (name: string): Upload => upload(name, 'image/png', 'png', 1024);

/** Espera (con techo) a que la lista de archivos cumpla `done`; devuelve la última lectura. */
const settled = async (page: Page, done: (panel: FilesPanel) => boolean): Promise<FilesPanel | undefined> => {
  await waitUntil(async () => {
    const panel = await readFilesPanel(page);
    return panel !== undefined && done(panel);
  });
  return readFilesPanel(page);
};

/** Texto observable de la lista (una línea por archivo, sus partes separadas por « / »). */
const describeItems = (panel: FilesPanel | undefined): string => {
  if (panel === undefined) return '(sin leer)';
  if (panel.items.length === 0) return panel.noneText ? 'ningún archivo seleccionado' : '(lista vacía)';
  return panel.items.map((item) => item.lines.join(' / ')).join(' | ');
};

/** Texto de los avisos visibles (o «ninguno»). */
const describeErrors = (panel: FilesPanel | undefined): string => (panel === undefined ? '(sin leer)' : panel.errors.length === 0 ? 'ninguno' : panel.errors.map((text) => `«${text}»`).join(', '));

/** Comprobación de que la elección no envía nada al servidor (Regla 006:28). */
const noPost = (posts: () => number): Check => check(posts() === 0, 'elegir o quitar archivos no envía nada al servidor', `peticiones de ejecución enviadas: ${posts()}`);

// --- E1: cada archivo se acepta o se rechaza al elegirlo -----------------------------------------------------------------------------

const elige: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const expected = `${cell(row, 'nombre')} se acepta o se rechaza al elegirlo`;
  const prepared = await prepareRow(page, 'consultor', expected);
  if (prepared !== undefined) return prepared;
  const posts = watchRunPosts(page);
  const name = cell(row, 'nombre');
  const media = strict('tipo', TIPO, cell(row, 'tipo'));
  const size = strict('tamano', TAMANO, cell(row, 'tamano'));
  const want = strict('resultado', RESULTADO_E1, cell(row, 'resultado'));
  const file = upload(name, media.type, media.kind, size);
  const picked = await chooseFiles(evidenceSimpleInput(page), 'elegir con «Adjuntar un archivo»', [file]);
  if (picked !== undefined) return actionFailed(expected, picked);
  const panel = await settled(page, (current) => current.items.length > 0 || current.errors.length > 0);
  const item = panel?.items.find((entry) => entry.lines.includes(name));
  const checks: Check[] = [];
  if (want.kind === 'lista') {
    checks.push(check(item !== undefined, `${name} aparece en «Archivos seleccionados»`, `«Archivos seleccionados»: ${describeItems(panel)}`));
    checks.push(check(item?.lines.includes(want.size) === true, `con el tamaño ${want.size}`, `tamaño visible ${item?.lines.find((line) => /KB|MB|B$/.test(line)) ?? '(sin tamaño)'}`));
    if (want.preview) checks.push(check(item?.alt === `Vista previa de ${name}`, `vista previa de ${name}`, `vista previa ${item?.alt ?? '(sin imagen)'}`));
    if (want.badge) checks.push(check(item?.lines.includes('PDF') === true, 'distintivo «PDF»', `distintivo ${item?.lines.includes('PDF') === true ? 'PDF' : '(sin distintivo)'}`));
  } else {
    checks.push(check(item === undefined, `${name} no aparece en «Archivos seleccionados»`, item === undefined ? `${name} no aparece` : `${name} aparece en la lista`));
    checks.push(check(panel?.errors.includes(want.aviso) === true, `aparece el aviso «${want.aviso}»`, `avisos: ${describeErrors(panel)}`));
  }
  checks.push(noPost(posts));
  return verdict(checks);
};

// --- E2: un máximo de cinco archivos por ejecución ----------------------------------------------------------------------------------

const limita: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const expected = `elegir ${cell(row, 'nuevos')} con ${cell(row, 'ya_elegidos')} ya elegidos: ${cell(row, 'resultado')}`;
  const prepared = await prepareRow(page, 'consultor', expected);
  if (prepared !== undefined) return prepared;
  const posts = watchRunPosts(page);
  const already = strict('ya_elegidos', YA_ELEGIDOS, cell(row, 'ya_elegidos'));
  const incoming = strict('nuevos', NUEVOS, cell(row, 'nuevos'));
  const want = strict('resultado', RESULTADO_E2, cell(row, 'resultado'));
  if (already > 0) {
    const preset = await chooseFiles(evidenceMultipleInput(page), `elegir ${already} archivos previos`, Array.from({ length: already }, (_, index) => png(`foto-${index + 1}.png`)));
    if (preset !== undefined) return preparationFailedWeb(expected, preset.message);
    const ready = await settled(page, (current) => current.items.length === already);
    if (ready?.items.length !== already) return preparationFailedWeb(expected, `hay ${ready?.items.length ?? 0} archivos previos, no ${already}`);
  }
  const names = Array.from({ length: incoming }, (_, index) => `nueva-${index + 1}.png`);
  const picked = await chooseFiles(evidenceMultipleInput(page), `elegir ${incoming} archivos nuevos`, names.map(png));
  if (picked !== undefined) return actionFailed(expected, picked);
  const panel = await settled(page, (current) => current.items.length === already + want.added || current.errors.length > 0);
  const added = panel?.items.filter((item) => names.some((name) => item.lines.includes(name))) ?? [];
  const expectedNames = names.slice(0, want.added);
  const checks: Check[] = [
    check(panel?.items.length === already + want.added, `«Archivos seleccionados» con ${already + want.added} archivo(s)`, `«Archivos seleccionados» con ${panel?.items.length ?? '(sin leer)'} archivo(s)`),
    check(expectedNames.every((name) => added.some((item) => item.lines.includes(name))), `entran ${want.added} de los nuevos (${expectedNames.join(', ') || 'ninguno'})`, `nuevos en la lista: ${added.map((item) => item.lines[0] ?? '').join(', ') || 'ninguno'}`),
    check(want.aviso === undefined ? panel?.errors.length === 0 : panel?.errors.includes(want.aviso) === true, want.aviso === undefined ? 'ningún aviso' : `aviso «${want.aviso}»`, `avisos: ${describeErrors(panel)}`),
    noPost(posts),
  ];
  // «Ningún aviso» (fila de 0 + 5) incluye los avisos emergentes: se observa una ventana de 4 s con el registro armado
  if (want.aviso === undefined) {
    const quiet = await noToast(page);
    checks.push(quietCheck(quiet, 'ningún aviso emergente'));
  }
  return verdict(checks);
};

// --- E3: un archivo repetido no se añade otra vez -----------------------------------------------------------------------------------

const repetido: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const name = cell(row, 'nombre');
  const expected = `«Archivos seleccionados» sigue con un único ${name} y sin aviso`;
  const prepared = await prepareRow(page, 'consultor', expected);
  if (prepared !== undefined) return prepared;
  const posts = watchRunPosts(page);
  const first = await chooseFiles(evidenceSimpleInput(page), `elegir ${name}`, [png(name)]);
  if (first !== undefined) return actionFailed(expected, first);
  await settled(page, (current) => current.items.length === 1);
  const again = await chooseFiles(evidenceSimpleInput(page), `elegir otra vez ${name}`, [png(name)]);
  if (again !== undefined) return actionFailed(expected, again);
  await sleep(1_000);
  const panel = await readFilesPanel(page);
  const count = panel?.items.filter((item) => item.lines.includes(name)).length ?? -1;
  const quiet = await noToast(page);
  return verdict([
    check(count === 1 && panel?.items.length === 1, `«Archivos seleccionados» con un único ${name}`, `«Archivos seleccionados»: ${describeItems(panel)}`),
    check(panel?.errors.length === 0, 'ningún aviso', `avisos: ${describeErrors(panel)}`),
    quietCheck(quiet, 'ningún aviso emergente'),
    noPost(posts),
  ]);
};

// --- E4: un archivo seleccionado se quita de la lista ------------------------------------------------------------------------------

const quita: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const name = cell(row, 'nombre');
  const expected = `${name} deja de aparecer en «Archivos seleccionados» y el aviso de texto.txt desaparece`;
  const prepared = await prepareRow(page, 'consultor', expected);
  if (prepared !== undefined) return prepared;
  const posts = watchRunPosts(page);
  const pair = await chooseFiles(evidenceMultipleInput(page), 'elegir captura.png e informe.pdf', [png('captura.png'), upload('informe.pdf', 'application/pdf', 'pdf', 1024)]);
  if (pair !== undefined) return preparationFailedWeb(expected, pair.message);
  await settled(page, (current) => current.items.length === 2);
  const text = await chooseFiles(evidenceSimpleInput(page), 'elegir texto.txt', [upload('texto.txt', 'text/plain', 'texto', 1024)]);
  if (text !== undefined) return preparationFailedWeb(expected, text.message);
  const before = await settled(page, (current) => current.errors.includes('texto.txt: solo se admiten PNG, JPEG o PDF'));
  if (before?.errors.includes('texto.txt: solo se admiten PNG, JPEG o PDF') !== true) return preparationFailedWeb(expected, 'el aviso de texto.txt no aparece antes de quitar');
  const removed = await interactRemove(page, name);
  if (removed !== undefined) return actionFailed(expected, removed);
  const after = await settled(page, (current) => !current.items.some((item) => item.lines.includes(name)));
  const other = name === 'captura.png' ? 'informe.pdf' : 'captura.png';
  return verdict([
    check(after?.items.some((item) => item.lines.includes(name)) === false, `${name} deja de aparecer en «Archivos seleccionados»`, `«Archivos seleccionados»: ${describeItems(after)}`),
    check(after?.errors.includes('texto.txt: solo se admiten PNG, JPEG o PDF') === false, 'el aviso «texto.txt: solo se admiten PNG, JPEG o PDF» desaparece', `avisos: ${describeErrors(after)}`),
    check(after?.items.some((item) => item.lines.includes(other)) === true, `${other} sigue en la lista (no se quitó por error)`, `«Archivos seleccionados»: ${describeItems(after)}`),
    noPost(posts),
  ]);
};

/** Pulsa «Quitar <nombre>» del archivo indicado (con su diagnóstico si falla). */
const interactRemove = (page: Page, name: string): Promise<Blocked | undefined> => interact(removeFileButton(page, name), `pulsar «Quitar ${name}»`, (element) => element.click(ACTION));


// --- E5: un archivo arrastrado a la zona se añade igual que uno elegido -------------------------------------------------------------

const arrastra: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const name = cell(row, 'nombre');
  const expected = `${name} aparece en «Archivos seleccionados» con el tamaño 1.0 KB`;
  const prepared = await prepareRow(page, 'consultor', expected);
  if (prepared !== undefined) return prepared;
  const posts = watchRunPosts(page);
  const dropped = await dropFile(dropzone(page), png(name));
  if (dropped.blocked !== undefined) return actionFailed(expected, dropped.blocked);
  const panel = await settled(page, (current) => current.items.length > 0 || current.errors.length > 0);
  const item = panel?.items.find((entry) => entry.lines.includes(name));
  return verdict(
    [
      check(item !== undefined, `${name} aparece en «Archivos seleccionados»`, `«Archivos seleccionados»: ${describeItems(panel)}`),
      check(item?.lines.includes('1.0 KB') === true, 'con el tamaño 1.0 KB', `tamaño visible ${item?.lines.find((line) => /KB|MB|B$/.test(line)) ?? '(sin tamaño)'}`),
      noPost(posts),
    ],
    `Arrastre simulado: se despachan dragenter, dragover y drop con un DataTransfer construido en la página (Playwright no arrastra archivos del escritorio). Durante el arrastre la zona queda con data-over=${dropped.overWhileDragging ?? '(sin leer)'}; esa lectura es evidencia, no un paso de la historia.`,
  );
};

defineBrowserRows({
  story: 'US-VER-EJECUCION-006',
  surface: 'web',
  tenants: [TENANT_A],
  handlers: new Map<number, BrowserRowHandler>([
    [1, onWeb(elige)],
    [2, onWeb(limita)],
    [3, onWeb(repetido)],
    [4, onWeb(quita)],
    [5, onWeb(arrastra)],
  ]),
});
