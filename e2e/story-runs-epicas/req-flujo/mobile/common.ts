import type { Locator, Page } from '@playwright/test';
import { MOVIL_REQUIREMENTS_DYNAMIC_TESTIDS, REQUISITOS_DYNAMIC_TESTIDS, REQUISITOS_TESTIDS } from '../../../../packages/shared/src/testids';
import { TENANT_A, resetTenants, type Credentials } from '../../../story-runs/support/prepare';
import { ACTION, CEILING_MS, isVisible, runSteps, safe, waitUntil, type Step } from '../../support/browser';
import { sleep, type Check } from '../../support/checks';
import type { Outcome } from '../../core/framework';
import { verdictOf } from '../api/common';
import { attrOf, buttonsOf, norm, press, QUIET_MS, recordToasts, STATE_LABEL, TARGET_OF_BUTTON, textOf, TOAST_KEY } from '../web/common';

// Piezas comunes de las filas de la app móvil de EP-REQ-FLUJO. La app se ejecuta como web de Expo a 390 × 844: NO es iOS ni Android nativo.
// Los localizadores son de rol (botones con nombre accesible, diálogos por su id de prueba) y, donde la app no tiene nombre accesible, de su id.
// La deshabilitación se lee del atributo `aria-disabled` (el botón de Expo web no lleva la propiedad `disabled`); el motivo, del texto visible
// debajo del botón. Toda acción va en `press`/`runSteps` y toda lectura tiene plazo corto.

/** Salvedad de plataforma: el veredicto de una fila móvil vale para Expo web, no para iOS ni Android nativo. */
export const EXPO_NOTE =
  'El veredicto vale para Expo web (390 × 844): no se ha comprobado en iOS ni en Android nativo. La prueba fija la preferencia de cookies y abre la app con carga completa (aproximación de la app móvil, como en el piloto).';

const fixCookies = (): void => {
  try {
    localStorage.setItem('sigpro.cookies', 'accepted');
  } catch {
    // sin almacenamiento: no hay preferencia que fijar
  }
};

/** Veredicto de una fila móvil: el de las comprobaciones y la salvedad de plataforma en la nota. */
export const verdictMobile = (checks: readonly Check[]): Outcome => verdictOf(checks, EXPO_NOTE);

/** Una fila no ejecutable de la app móvil: el motivo y la salvedad de plataforma. */
export const notRunMobile = (expected: string, reason: string): Outcome => ({ verdict: 'no-ejecutable', expected, observed: '(no se ejecutó)', note: `${reason}. ${EXPO_NOTE}` });

// --- Sesión y apertura ----------------------------------------------------------------------------------------------------------------

export const TENANT_TEXT = 'Tenant de trabajo';

/** Reinicio de alumno01 (con su administrador), app en /login sin sesión, alumno01 en «Tenant de trabajo», la cuenta y «Entrar». Termina en Programas. */
export const prepareMobile = async (page: Page, credentials: Credentials): Promise<string | undefined> => {
  await resetTenants([TENANT_A]);
  const steps: Step[] = [
    ['instalar el registro de avisos', () => page.context().addInitScript(recordToasts, TOAST_KEY)],
    ['fijar la preferencia de cookies', () => page.context().addInitScript(fixCookies)],
    ['fijar el ancho de la ventana (390 px)', () => page.setViewportSize({ width: 390, height: 844 })],
    ['abrir /login', () => page.goto('/login', { timeout: CEILING_MS })],
    ['ver el título «Iniciar sesión»', () => page.getByRole('heading', { name: 'Iniciar sesión', level: 1, exact: true }).waitFor({ timeout: CEILING_MS })],
    [`escribir ${TENANT_A} en «${TENANT_TEXT}»`, () => page.getByRole('textbox', { name: TENANT_TEXT, exact: true }).fill(TENANT_A, ACTION)],
    ['escribir el correo', () => page.getByRole('textbox', { name: 'Correo electrónico', exact: true }).fill(credentials.email, ACTION)],
    ['escribir la contraseña', () => page.getByRole('textbox', { name: 'Contraseña', exact: true }).fill(credentials.password, ACTION)],
    ['pulsar «Entrar»', () => page.getByRole('button', { name: 'Entrar', exact: true }).click(ACTION)],
    ['llegar a Programas', () => page.getByRole('heading', { name: 'Programas', level: 1, exact: true }).waitFor({ timeout: CEILING_MS })],
  ];
  return runSteps(steps);
};

/** Abre la lista de requisitos del programa y espera a que el recuento real (o un estado de error o de no encontrado) se asiente. */
export const openRequirements = async (page: Page, programCode: string): Promise<string | undefined> =>
  runSteps([
    [`abrir /programs/${programCode}/requirements`, () => page.goto(`/programs/${programCode}/requirements`, { timeout: CEILING_MS })],
    [
      'ver la lista de requisitos asentada',
      async () => {
        const settled = await waitUntil(async () => {
          const count = norm(await textOf(page.getByTestId(REQUISITOS_TESTIDS.REQUIREMENTS_COUNT)));
          return /^\d+ de \d+ requisitos$/.test(count ?? '') || (await isVisible(page.getByTestId(REQUISITOS_TESTIDS.REQUIREMENTS_ERROR))) || (await isVisible(page.getByTestId(REQUISITOS_TESTIDS.REQUIREMENTS_NOT_FOUND)));
        });
        if (!settled.reached) throw new Error('la lista de requisitos no se asienta');
      },
    ],
  ]);

/** Hoja del requisito (diálogo de detalle: su id de prueba). */
export const sheetOf = (page: Page): Locator => page.getByTestId(REQUISITOS_TESTIDS.REQUIREMENT_DETAIL);

/** Abre la hoja del requisito desde su fila («Abrir detalle de REQ-017»). Devuelve el motivo si no se abre. */
export const openSheet = async (page: Page, code: string): Promise<string | undefined> => {
  const failure = await press(page.getByRole('button', { name: `Abrir detalle de ${code}`, exact: true }), `abrir la hoja de ${code}`);
  if (failure !== undefined) return failure;
  return (await waitUntil(() => isVisible(sheetOf(page)))).reached ? undefined : `la hoja de ${code} no aparece tras abrirla`;
};

// --- Lecturas (localizadores de la pantalla móvil) ----------------------------------------------------------------------------------------

/** Nombres de los cuatro pasos tal como los muestra la app (texto propio de cada paso). */
export const FLOW_NAMES: readonly string[] = ['Redacción', 'Aprobación', 'Verificación', 'Validación'];

/** Paso del flujo de la hoja: nombre (texto propio exacto), línea de estado (`data-status`) y botones de transición (todos y visibles). */
export interface MobileStep {
  readonly state: string;
  readonly name: string | undefined;
  readonly status: string | undefined;
  readonly buttons: readonly string[] | undefined;
  readonly visibleButtons: readonly string[] | undefined;
}

/** Textos propios de los elementos de un ámbito (solo los nodos de texto directos de cada elemento). */
const ownTextsIn = async (scope: Locator): Promise<readonly string[] | undefined> => {
  try {
    return await scope.locator('*').evaluateAll((elements) =>
      elements
        .map((element) =>
          Array.from(element.childNodes)
            .filter((node) => node.nodeType === Node.TEXT_NODE)
            .map((node) => node.textContent ?? '')
            .join('')
            .trim(),
        )
        .filter((text) => text !== ''),
    );
  } catch {
    return undefined;
  }
};

/** Los cuatro pasos del flujo dentro de la hoja. El nombre es el texto propio del paso que coincide con uno de los cuatro nombres. */
export const readFlowMobile = (page: Page): Promise<readonly MobileStep[]> =>
  Promise.all(
    ['draft', 'approved', 'verified', 'validated'].map(async (state): Promise<MobileStep> => {
      const step = page.getByTestId(REQUISITOS_DYNAMIC_TESTIDS.REQUIREMENT_FLOW_STEP(state));
      const texts = await ownTextsIn(step);
      const buttons = await buttonsOf(step, '[role="button"]');
      return {
        state,
        name: texts?.find((text) => FLOW_NAMES.includes(text)),
        status: (await attrOf(step, 'data-status')) ?? undefined,
        buttons: buttons?.all,
        visibleButtons: buttons?.visible,
      };
    }),
  );

/** Número de transiciones del flujo en la hoja (el contenedor de botones solo existe en el paso actual; -1 si no se puede leer). */
export const transitionContainers = (page: Page): Promise<number> => safe(() => page.getByTestId(REQUISITOS_TESTIDS.REQUIREMENT_TRANSITIONS).count(), -1);

/** Botón de transición del paso actual por su nombre exacto. */
export const transitionButtonM = (page: Page, name: string): Locator => page.getByTestId(REQUISITOS_TESTIDS.REQUIREMENT_FLOW).getByRole('button', { name, exact: true });

/** Un botón deshabilitado: propiedad `disabled` o `aria-disabled="true"`. Lectura sin plazo cumplido = `undefined`. */
export const disabledMobile = (target: Locator): Promise<boolean | undefined> =>
  safe(
    () =>
      target.first().evaluate(
        (element) => (element as HTMLButtonElement).disabled === true || element.getAttribute('aria-disabled') === 'true',
        undefined,
        { timeout: 2000 },
      ),
    undefined,
  );

/**
 * Motivo debajo de un botón de transición, con todos sus casos: `ninguno` (no hay elemento), `visible` (texto que se ve), `oculto` (el
 * elemento existe pero no se ve), `varios` (ambiguo) y `no-legible` (la lectura falló).
 */
export type ReasonReading =
  | { readonly kind: 'ninguno' }
  | { readonly kind: 'visible'; readonly text: string }
  | { readonly kind: 'oculto' }
  | { readonly kind: 'varios' }
  | { readonly kind: 'no-legible' };

export const reasonOfButton = async (page: Page, to: string): Promise<ReasonReading> => {
  const target = page.getByTestId(MOVIL_REQUIREMENTS_DYNAMIC_TESTIDS.TRANSITION_REASON(to));
  const found = await safe(() => target.count(), -1);
  if (found === 0) return { kind: 'ninguno' };
  if (found !== 1) return found > 1 ? { kind: 'varios' } : { kind: 'no-legible' };
  const visible = await isVisible(target);
  const text = norm(await textOf(target));
  if (!visible) return { kind: 'oculto' };
  return text === undefined ? { kind: 'no-legible' } : { kind: 'visible', text };
};

/** Rótulo de cada caso de la lectura del motivo, para lo observado (mapa de despacho, sin ramas en cadena). */
const REASON_LABEL: ReadonlyMap<ReasonReading['kind'], string> = new Map<ReasonReading['kind'], string>([
  ['ninguno', '(ninguno)'],
  ['oculto', '(motivo presente pero oculto)'],
  ['varios', '(varios motivos)'],
  ['no-legible', '(no legible)'],
]);

/** Descripción de la lectura del motivo, para lo observado. */
export const describeReason = (reading: ReasonReading): string => (reading.kind === 'visible' ? `«${reading.text}»` : (REASON_LABEL.get(reading.kind) ?? '(no legible)'));

/** Badge de estado dentro de la hoja: texto visible y `data-state`. */
export const sheetState = async (page: Page): Promise<{ readonly label: string | undefined; readonly state: string | undefined }> => ({
  label: norm(await textOf(sheetOf(page).getByTestId(REQUISITOS_TESTIDS.REQUIREMENT_STATE_BADGE))),
  state: (await attrOf(sheetOf(page).getByTestId(REQUISITOS_TESTIDS.REQUIREMENT_STATE_BADGE), 'data-state')) ?? undefined,
});

// --- Confirmación (la misma en la hoja: `role="dialog"` con el id de la confirmación) ----------------------------------------------------

export const confirmOf = (page: Page): Locator => page.getByTestId(REQUISITOS_TESTIDS.REQUIREMENT_TRANSITION_DIALOG);
/** El error de la confirmación, acotado a la propia confirmación (no a un error de otra parte de la pantalla). */
export const confirmErrorOf = (page: Page): Locator => confirmOf(page).getByTestId(`${REQUISITOS_TESTIDS.REQUIREMENT_TRANSITION_DIALOG}-error`);

/** Título y texto de la confirmación, contados dentro de ella (exactos). */
export const confirmShows = async (page: Page, requirementCode: string, from: string, to: string): Promise<{ readonly title: number; readonly body: number }> => ({
  title: await confirmOf(page).getByText(`Cambiar el estado de ${requirementCode}`, { exact: true }).count(),
  body: await confirmOf(page).getByText(`${requirementCode} pasará de ${from} a ${to}.`, { exact: true }).count(),
});

/** Botones «Cancelar» y «Confirmar» que hay dentro de la confirmación (recuento; -1 si no se puede leer). */
export const confirmActions = async (page: Page): Promise<{ readonly cancel: number; readonly confirm: number }> => ({
  cancel: await safe(() => confirmOf(page).getByRole('button', { name: 'Cancelar', exact: true }).count(), -1),
  confirm: await safe(() => confirmOf(page).getByRole('button', { name: 'Confirmar', exact: true }).count(), -1),
});

/** Estado al que lleva un botón (su texto en la interfaz). */
export const targetLabelOfButton = (buttonName: string): string => STATE_LABEL.get(TARGET_OF_BUTTON.get(buttonName) ?? '') ?? '(desconocido)';

/** Pulsa un botón de la confirmación (dentro de ella), con diagnóstico si el clic no se completa. */
export const pressConfirm = (page: Page, name: 'Confirmar' | 'Cancelar'): Promise<string | undefined> =>
  press(confirmOf(page).getByRole('button', { name, exact: true }), `pulsar «${name}» en la confirmación`);

/** Abre la confirmación pulsando el botón del paso actual de la hoja. */
export const openConfirm = async (page: Page, buttonName: string): Promise<{ readonly failure?: string; readonly shown: boolean }> => {
  const failure = await press(transitionButtonM(page, buttonName), `pulsar ${buttonName} en el paso actual`);
  if (failure !== undefined) return { failure, shown: false };
  return { shown: (await waitUntil(() => isVisible(confirmOf(page)))).reached };
};

/** Pausa de la ventana de observación (mayor que la vida del aviso) antes de afirmar que NO aparece. */
export const quietMobile = (): Promise<void> => sleep(QUIET_MS);
