import type { Locator, Page } from '@playwright/test';
import { NC_TESTIDS, PROGRAMAS_DYNAMIC_TESTIDS } from '../../../../packages/shared/src/testids';
import { resetTenants, TENANT_A } from '../../../story-runs/support/prepare';
import { ACTION, CEILING_MS, runSteps, safe, waitUntil, type Step } from '../../support/browser';
import { preparationFailedWeb } from '../../support/checks';
import type { BrowserRowHandler, Outcome } from '../../core/framework';
import { ACCOUNT_BY_EMAIL, TOAST_KEY, armToasts, interact, recordToasts, type Blocked } from '../web/common';

// Piezas comunes de las filas MÓVILES de EP-NC-GESTION: la app móvil servida como web de Expo a 390 × 844. NO es iOS ni Android nativo.
// Las lecturas van en UNA evaluación con sus propios auxiliares (lo que se pasa al navegador no ve las funciones de este módulo). El texto
// de un motivo se lee como TEXTO VISIBLE acotado a su elemento; `data-reason` y `aria-disabled` son evidencia.

export const EXPO_NOTE = 'El veredicto vale para Expo web (390 × 844): no se ha comprobado en iOS ni en Android nativo.';
export const MOBILE_VIEWPORT = { width: 390, height: 844 } as const;
export const LOGIN_PATH = '/login';
export const TENANT_TEXT = 'Tenant de trabajo';
const TAB_KEY = 'nc';

/** Añade la salvedad de plataforma (Expo web no es nativo) al resultado de cada fila móvil. */
export const onMobile =
  (handler: BrowserRowHandler): BrowserRowHandler =>
  async (row, fixtures) => {
    const result = await handler(row, fixtures);
    return { ...result, note: result.note === undefined ? EXPO_NOTE : `${result.note} ${EXPO_NOTE}` };
  };

/** Inicio de sesión en la app móvil: alumno01 en «Tenant de trabajo», la cuenta con su contraseña y «Entrar». Termina en /programas. */
export const signInMobile = (page: Page, email: string): Promise<string | undefined> => {
  const credentials = ACCOUNT_BY_EMAIL.get(email);
  const steps: Step[] = [
    ['instalar el registro de avisos', () => page.context().addInitScript(recordToasts, TOAST_KEY)],
    ['fijar el ancho de la ventana', () => page.setViewportSize(MOBILE_VIEWPORT)],
    ['abrir /login', () => page.goto(LOGIN_PATH, { timeout: CEILING_MS })],
    ['ver el título «Iniciar sesión»', () => page.getByRole('heading', { name: 'Iniciar sesión', level: 1, exact: true }).waitFor({ timeout: CEILING_MS })],
    [`escribir ${TENANT_A} en «${TENANT_TEXT}»`, () => page.getByRole('textbox', { name: TENANT_TEXT, exact: true }).fill(TENANT_A, ACTION)],
    ['escribir el correo', () => page.getByRole('textbox', { name: 'Correo electrónico', exact: true }).fill(credentials?.email ?? email, ACTION)],
    ['escribir la contraseña', () => page.getByRole('textbox', { name: 'Contraseña', exact: true }).fill(credentials?.password ?? '', ACTION)],
    ['pulsar «Entrar»', () => page.getByRole('button', { name: 'Entrar', exact: true }).click(ACTION)],
    ['llegar a /programas', () => page.getByRole('heading', { name: 'Programas', level: 1, exact: true }).waitFor({ timeout: CEILING_MS })],
  ];
  return runSteps(steps);
};

/** Pulsa la pestaña «No conformidades» de la barra inferior (por su testid de la barra). */
export const openNcTab = (page: Page): Promise<Blocked | undefined> =>
  interact(page.getByTestId(PROGRAMAS_DYNAMIC_TESTIDS.MOBILE_TAB(TAB_KEY)), 'pulsar la pestaña «No conformidades»', (element) => element.click(ACTION));

/**
 * Preparación de una fila móvil: reinicio de alumno01 con su administrador, inicio de sesión de la cuenta y apertura de «No conformidades».
 * Devuelve el resultado de preparación si algo falla; si todo va bien, espera a que el recuento del tablero asiente.
 */
export const prepareMobile = async (page: Page, email: string, expected: string): Promise<Outcome | undefined> => {
  await resetTenants([TENANT_A]);
  const signedIn = await signInMobile(page, email);
  if (signedIn !== undefined) return preparationFailedWeb(expected, `iniciar sesión como ${email}: ${signedIn}`);
  const opened = await openNcTab(page);
  if (opened !== undefined) return preparationFailedWeb(expected, `abrir la pestaña «No conformidades»: ${opened.message}`);
  const settled = await waitUntil(async () => {
    const text = await countText(page);
    return text !== undefined && !text.includes('…');
  });
  if (!settled.reached) return preparationFailedWeb(expected, 'el tablero de no conformidades no asienta su recuento');
  if (!(await armToasts(page))) throw new Error('registro de avisos no instalado en la página móvil: fallo del arnés');
  return undefined;
};

/** Recuento visible del tablero (`nc-count`), normalizado; `undefined` si no se lee. */
export const countText = (page: Page): Promise<string | undefined> =>
  safe(
    async () => {
      const text = await page.getByTestId(NC_TESTIDS.NC_COUNT).first().innerText({ timeout: 2_000 });
      return text.replace(/\s+/g, ' ').trim();
    },
    undefined,
  );

/** Tarjeta por su código: abre el detalle tocando su botón «Abrir NC-…» (la columna puede estar fuera de la ventana: Playwright la lleva a la vista). */
export const openCard = (page: Page, code: string): Promise<Blocked | undefined> =>
  interact(page.getByRole('button', { name: `Abrir ${code}`, exact: true }), `abrir la tarjeta ${code}`, (element) => element.click(ACTION));

/** Hoja de detalle abierta con el código dado (su título accesible). */
export const sheetOf = (page: Page, code: string): Locator => page.getByRole('dialog', { name: `Detalle de ${code}`, exact: true });

/** Espera a que la hoja de detalle muestre su estado (la carga no ha terminado). */
export const waitSheetReady = async (page: Page, code: string): Promise<boolean> => {
  const ready = await waitUntil(async () => (await safe(() => sheetOf(page, code).getByTestId(NC_TESTIDS.NC_STATE_BADGE).count(), 0)) > 0);
  return ready.reached;
};

// --- Lecturas de una evaluación (auxiliares dentro del propio navegador) ---------------------------------------------------------

export interface MobileCommentView {
  readonly author: string | undefined;
  readonly kind: string | undefined;
  readonly body: string | undefined;
}

export interface MobileTransitionView {
  readonly testid: string;
  readonly label: string | undefined;
  readonly disabled: boolean | undefined;
  readonly reason: string | undefined;
}

export interface MobileDetailView {
  readonly open: boolean;
  readonly code: string | undefined;
  readonly stateText: string | undefined;
  readonly severityText: string | undefined;
  readonly programText: string | undefined;
  readonly description: string | undefined;
  readonly assignee: string | undefined;
  readonly editOpen: boolean;
  readonly editDisabled: boolean | undefined;
  readonly editReason: string | undefined;
  readonly deniedVisible: string | undefined;
  readonly transitions: readonly MobileTransitionView[];
  readonly reasonVisible: string | undefined;
  readonly closeFormOpen: boolean;
  readonly closeCounter: string | undefined;
  readonly closeError: string | undefined;
  readonly commentsHeading: string | undefined;
  readonly comments: readonly MobileCommentView[];
  readonly commentError: string | undefined;
  readonly commentValue: string | undefined;
  readonly serverError: string | undefined;
  readonly notFound: string | undefined;
}

/** Se ejecuta en el navegador: la hoja de detalle entera en una lectura. Todo auxiliar va DENTRO de la función. */
const detailReader = (code: string): MobileDetailView => {
  const sheet = Array.from(document.querySelectorAll('[role="dialog"]')).find((node) => node.getAttribute('aria-label') === `Detalle de ${code}`) ?? null;
  const inside = (testid: string): Element | null => (sheet === null ? null : sheet.querySelector(`[data-testid="${testid}"]`));
  const rawText = (node: Element | null): string | undefined => (node === null ? undefined : (node.textContent ?? '').replace(/\s+/g, ' ').trim());
  const shownText = (node: Element | null): string | undefined => {
    if (node === null) return undefined;
    const box = node.getBoundingClientRect();
    if (box.width === 0 || box.height === 0) return undefined;
    return ((node as HTMLElement).innerText ?? '').replace(/\s+/g, ' ').trim();
  };
  const attr = (node: Element | null, name: string): string | undefined => (node === null ? undefined : (node.getAttribute(name) ?? undefined));
  const flag = (node: Element | null): boolean | undefined => (node === null ? undefined : node.getAttribute('aria-disabled') === 'true');
  const transitionNodes = sheet === null ? [] : Array.from(sheet.querySelectorAll('[data-testid="nc-transitions"] [role="button"]'));
  const edit = inside('nc-edit');
  const commentNodes = sheet === null ? [] : Array.from(sheet.querySelectorAll('[data-testid="nc-comments"] [role="listitem"]'));
  const headingNode = sheet === null ? null : Array.from(sheet.querySelectorAll('*')).find((node) => node.children.length === 0 && /^Comentarios \(\d+\)$/.test((node.textContent ?? '').trim())) ?? null;
  return {
    open: sheet !== null,
    code: rawText(inside('nc-detail-code')),
    stateText: rawText(inside('nc-state-badge')),
    severityText: rawText(inside('nc-severity-badge')),
    programText: rawText(inside('nc-detail-program')),
    description: shownText(inside('nc-description')),
    assignee: shownText(inside('nc-assignee')),
    editOpen: inside('nc-edit-form') !== null,
    editDisabled: flag(edit),
    editReason: attr(edit, 'data-reason'),
    deniedVisible: shownText(inside('nc-detail-denied')),
    transitions: transitionNodes.map((node) => ({
      testid: node.getAttribute('data-testid') ?? '',
      label: rawText(node),
      disabled: node.getAttribute('aria-disabled') === 'true',
      reason: node.getAttribute('data-reason') ?? undefined,
    })),
    reasonVisible: shownText(inside('nc-transition-reason')),
    closeFormOpen: inside('nc-close-dialog') !== null,
    closeCounter: shownText(inside('nc-close-counter')),
    closeError: shownText(inside('nc-close-error')),
    commentsHeading: headingNode === null ? undefined : rawText(headingNode),
    comments: commentNodes.map((item) => {
      const head = item.children[0] ?? null;
      const body = item.children[item.children.length - 1] ?? null;
      const headParts = head === null ? [] : Array.from(head.children).map((child) => rawText(child));
      return { author: headParts[0], kind: headParts.length > 2 ? headParts[headParts.length - 1] : undefined, body: rawText(body) };
    }),
    commentError: shownText(inside('nc-comment-error')),
    commentValue: (inside('nc-comment-input') as HTMLTextAreaElement | null)?.value ?? undefined,
    serverError: shownText(inside('nc-server-error')),
    notFound: shownText(inside('nc-detail-not-found')),
  };
};

export const readDetail = (page: Page, code: string): Promise<MobileDetailView | undefined> => safe<MobileDetailView | undefined>(() => page.evaluate(detailReader, code), undefined);

/** Espera (con techo) a que la hoja cumpla `ok`; devuelve la última lectura. */
export const waitDetail = async (page: Page, code: string, ok: (view: MobileDetailView) => boolean): Promise<MobileDetailView | undefined> => {
  let last: MobileDetailView | undefined;
  await waitUntil(async () => {
    last = await readDetail(page, code);
    return last !== undefined && ok(last);
  });
  return last;
};

// --- Formulario de edición dentro de la hoja --------------------------------------------------------------------------------------

export interface MobileEditView {
  readonly open: boolean;
  /** Severidad marcada (`aria-checked`) en el selector de la edición. */
  readonly checked: string | undefined;
  readonly description: string | undefined;
  readonly assignee: string | undefined;
  readonly clearVisible: boolean;
  readonly save: { readonly disabled: boolean | undefined; readonly reason: string | undefined };
  readonly saveClose: { readonly disabled: boolean | undefined; readonly reason: string | undefined };
  readonly noChangesVisible: string | undefined;
  readonly descriptionError: string | undefined;
  readonly serverError: string | undefined;
}

const editReader = (): MobileEditView => {
  const form = document.querySelector('[data-testid="nc-edit-form"]');
  const inside = (testid: string): Element | null => (form === null ? null : form.querySelector(`[data-testid="${testid}"]`));
  const shownText = (node: Element | null): string | undefined => {
    if (node === null) return undefined;
    const box = node.getBoundingClientRect();
    if (box.width === 0 || box.height === 0) return undefined;
    return ((node as HTMLElement).innerText ?? '').replace(/\s+/g, ' ').trim();
  };
  const rawText = (node: Element | null): string | undefined => (node === null ? undefined : (node.textContent ?? '').replace(/\s+/g, ' ').trim());
  const checkedNode = form === null ? null : Array.from(form.querySelectorAll('[role="radio"]')).find((node) => node.getAttribute('aria-checked') === 'true') ?? null;
  const description = inside('nc-description') as HTMLTextAreaElement | HTMLInputElement | null;
  const save = inside('nc-save');
  const saveClose = inside('nc-save-close');
  const notice = form === null ? null : Array.from(form.querySelectorAll('*')).find((node) => node.children.length === 0 && (node.textContent ?? '').trim() === 'No hay cambios que guardar') ?? null;
  return {
    open: form !== null,
    checked: checkedNode === null ? undefined : (rawText(checkedNode) ?? undefined),
    description: description === null ? undefined : (description.value ?? undefined),
    assignee: rawText(inside('nc-assignee')),
    clearVisible: inside('nc-assignee-clear') !== null,
    save: { disabled: save === null ? undefined : save.getAttribute('aria-disabled') === 'true', reason: save === null ? undefined : (save.getAttribute('data-reason') ?? undefined) },
    saveClose: { disabled: saveClose === null ? undefined : saveClose.getAttribute('aria-disabled') === 'true', reason: saveClose === null ? undefined : (saveClose.getAttribute('data-reason') ?? undefined) },
    noChangesVisible: shownText(notice),
    descriptionError: shownText(inside('nc-description-error')),
    serverError: shownText(inside('nc-server-error')),
  };
};

export const readEdit = (page: Page): Promise<MobileEditView | undefined> => safe<MobileEditView | undefined>(() => page.evaluate(editReader), undefined);

/** Espera (con techo) a que el formulario de edición cumpla `ok`; devuelve la última lectura. */
export const waitEdit = async (page: Page, ok: (view: MobileEditView) => boolean): Promise<MobileEditView | undefined> => {
  let last: MobileEditView | undefined;
  await waitUntil(async () => {
    last = await readEdit(page);
    return last !== undefined && ok(last);
  });
  return last;
};

// --- Alta: diálogo «Nueva no conformidad» -----------------------------------------------------------------------------------------

export interface MobileNewView {
  readonly open: boolean;
  readonly programError: string | undefined;
  readonly severityError: string | undefined;
  readonly descriptionError: string | undefined;
  readonly serverError: string | undefined;
  readonly programEnabled: boolean | undefined;
}

const newReader = (): MobileNewView => {
  const dialog = document.querySelector('[data-testid="nc-new-dialog"]');
  const inside = (testid: string): Element | null => (dialog === null ? null : dialog.querySelector(`[data-testid="${testid}"]`));
  const shownText = (node: Element | null): string | undefined => {
    if (node === null) return undefined;
    const box = node.getBoundingClientRect();
    if (box.width === 0 || box.height === 0) return undefined;
    return ((node as HTMLElement).innerText ?? '').replace(/\s+/g, ' ').trim();
  };
  const program = inside('nc-new-program');
  return {
    open: dialog !== null,
    programError: shownText(inside('nc-new-program-error')),
    severityError: shownText(inside('nc-new-severity-error')),
    descriptionError: shownText(inside('nc-new-description-error')),
    serverError: shownText(inside('nc-new-server-error')),
    programEnabled: program === null ? undefined : program.getAttribute('aria-disabled') !== 'true',
  };
};

export const readNew = (page: Page): Promise<MobileNewView | undefined> => safe<MobileNewView | undefined>(() => page.evaluate(newReader), undefined);

/** Espera (con techo) a que el diálogo de alta cumpla `ok`; devuelve la última lectura. */
export const waitNew = async (page: Page, ok: (view: MobileNewView) => boolean): Promise<MobileNewView | undefined> => {
  let last: MobileNewView | undefined;
  await waitUntil(async () => {
    last = await readNew(page);
    return last !== undefined && ok(last);
  });
  return last;
};


