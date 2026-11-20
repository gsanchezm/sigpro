import type { Locator, Page } from '@playwright/test';
import { PROGRAMAS_DYNAMIC_TESTIDS } from '../../../../packages/shared/src/testids';
import { TENANT_A } from '../../../story-runs/support/prepare';
import { ACTION, CEILING_MS, isVisible, runSteps, waitUntil, type Step } from '../../support/browser';
import { check, type Check } from '../../support/checks';
import { goTo, inOrder, menuOf, NARROW, recordToasts, TOAST_KEY, type Act, type Box, type Viewport } from '../web/common';

// Piezas comunes de las filas MÓVILES de EP-TOASTS: la app móvil servida como web de Expo a 390 × 844. NO es iOS ni Android nativo: el
// veredicto vale para Expo web. El registro de avisos es el mismo que el de la web (los avisos de la app son `data-testid="toast-<tono>"`).
// La posición se mide frente a la ventana: la historia fija 12 px del borde superior y de cada lado.

export const EXPO_NOTE = 'El veredicto vale para Expo web (390 × 844): no se ha comprobado en iOS ni en Android nativo.';
/** Salvedad de la franja: el color del tono en la app móvil sale de tokens de React Native, no de variables CSS que la prueba pueda leer. */
export const FRANJA_NOTE = 'La franja del color del tono no se compara en la app móvil: sus colores son tokens de React Native, no variables CSS.';

const heading1 = (page: Page, name: string): Locator => page.getByRole('heading', { name, level: 1, exact: true });
const textbox = (page: Page, name: string): Locator => page.getByRole('textbox', { name, exact: true });
const buttonNamed = (page: Page, name: string): Locator => page.getByRole('button', { name, exact: true });

/** Inicio de sesión en la app móvil: «Tenant de trabajo», correo, contraseña y «Entrar»; termina en «Programas» con la lista cargada. */
export const signInMobile = (page: Page, email: string, password: string): Promise<string | undefined> => {
  const steps: Step[] = [
    ['instalar el registro de avisos', () => page.context().addInitScript(recordToasts, TOAST_KEY)],
    ['fijar el tamaño de la ventana del móvil', () => page.setViewportSize(NARROW)],
    ['abrir /login', () => page.goto('/login', { timeout: CEILING_MS })],
    ['ver el título «Iniciar sesión»', () => heading1(page, 'Iniciar sesión').waitFor({ timeout: CEILING_MS })],
    [`escribir ${TENANT_A} en «Tenant de trabajo»`, () => textbox(page, 'Tenant de trabajo').fill(TENANT_A, ACTION)],
    ['escribir el correo', () => textbox(page, 'Correo electrónico').fill(email, ACTION)],
    ['escribir la contraseña', () => textbox(page, 'Contraseña').fill(password, ACTION)],
    ['pulsar «Entrar»', () => buttonNamed(page, 'Entrar').click(ACTION)],
    ['llegar a «Programas»', () => heading1(page, 'Programas').waitFor({ timeout: CEILING_MS })],
    ['ver la lista de programas', () => menuOf(page, 'PRG-001').waitFor({ state: 'visible', timeout: CEILING_MS })],
  ];
  return runSteps(steps);
};

/** Pestaña «Más» de la barra inferior: por su id de prueba (`tabBarButtonTestID`), que es el único elemento inequívoco de la pestaña. */
const moreTab = (page: Page): Locator => page.getByTestId(PROGRAMAS_DYNAMIC_TESTIDS.MOBILE_TAB('more'));

/** Espera (con techo) a que la lista de documentos muestre la fila de ese documento. */
const listShown = (code: string): Act => async (page) => {
  const shown = await waitUntil(() => isVisible(menuOf(page, code)));
  return shown.reached ? undefined : { kind: 'harness', message: `no se ve la lista de documentos (falta «Acciones para ${code}»)` };
};

/** Llega a /documents como lo haría una persona: pestaña «Más» y luego «Documentos». */
export const openMobileDocuments: Act = inOrder(
  goTo(moreTab, 'abrir la pestaña «Más»', '/more'),
  goTo((page) => page.getByRole('link', { name: 'Documentos', exact: true }), 'pulsar «Documentos» en «Más»', '/documents'),
  listShown('DOC-001'),
);

const nearly = (value: number | undefined, target: number): boolean => value !== undefined && Math.abs(value - target) <= 1;
const fmt = (value: number | undefined): string => (value === undefined ? '(sin medir)' : `${Math.round(value * 10) / 10}`);

/** Arriba de la pantalla, a 12 px del borde superior y de cada lado (la historia lo fija como regla de posición). */
export const topPlacement = (box: Box | undefined, viewport: Viewport | undefined): Check => {
  const right = box !== undefined && viewport !== undefined ? viewport.width - (box.x + box.width) : undefined;
  const top = box?.y;
  const upper = box !== undefined && viewport !== undefined && box.y < viewport.height / 2;
  const ok = upper && nearly(top, 12) && nearly(box?.x, 12) && nearly(right, 12);
  return check(ok, 'arriba de la pantalla, a 12 px del borde superior y de cada lado', `arriba de la pantalla, a ${fmt(top)} px del borde superior, ${fmt(box?.x)} px a la izquierda y ${fmt(right)} px a la derecha`);
};
