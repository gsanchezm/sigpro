import { resetTenants, TENANT_A } from '../../../story-runs/support/prepare';
import { ACTION, attrOf, isVisible, runSteps, waitUntil } from '../../support/browser';
import { cell, check, conclude, preparationFailedWeb, strict } from '../../support/checks';
import { defineBrowserRows, type BrowserRowHandler } from '../../core/framework';
import {
  actionMissing,
  codesOf,
  type Layout,
  countCheck,
  delayPrograms,
  emptyBlock,
  failPrograms,
  LAYOUTS,
  listCheck,
  listedCodes,
  recountText,
  signIn,
  skeletonRows,
  typeSearch,
  visibleCheck,
  waitForList,
} from './common';

// US-PROG-LISTA-007 — Estados de carga, vacío y error de la lista de programas (web). Preparación de cada fila: reinicio de alumno01
// con el token de su administrador; gestor@sigpro.test entra desde /login?tenant=alumno01 y llega a /programs. La demora y los errores
// de GET /api/programs los provoca la prueba DESPUÉS de entrar y ANTES de abrir la lista (así el propio inicio de sesión no consume
// la primera petición). Solo se toca la petición GET de /api/programs.

const PROGRAMS_FIRST_TEN = ['PRG-001', 'PRG-002', 'PRG-003', 'PRG-004', 'PRG-005', 'PRG-006', 'PRG-007', 'PRG-008', 'PRG-009', 'PRG-010'];
const DELAY_MS = 3_000;

/** Los Esquemas 1, 3 y 4 solo existen en escritorio: la celda se traduce con un mapa de un solo diseño (cualquier otro texto lanza). */
const DESKTOP_ONLY: ReadonlyMap<string, Layout> = new Map<string, Layout>([['escritorio', 'escritorio']]);

// --- Esquema 1: mientras llega la respuesta se ven filas de carga y después los programas --------------------------------

const loadingRows: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const layout = strict('diseño', DESKTOP_ONLY, cell(row, 'diseno'));
  const expected = 've filas de carga y la tabla marcada como ocupada mientras espera y, al llegar la respuesta, los programas PRG-001 a PRG-010';
  const opened = await signIn(page, layout);
  if (opened) return preparationFailedWeb(expected, opened);
  await delayPrograms(page, DELAY_MS);
  // Abre /programs con la respuesta retrasada: mientras espera, deben verse las filas de carga
  await page.goto('/programs', { timeout: 10_000 });
  // Se mira durante la espera (con el techo por defecto): si se ven las filas de carga, se anota el aria-busy de la tabla en ese
  // mismo momento. Si los datos llegaron antes de verlas, la comprobación no se cumple.
  const seen: { skeleton: boolean; busy?: string } = { skeleton: false };
  await waitUntil(async () => {
    if (await isVisible(skeletonRows(page))) {
      seen.skeleton = true;
      seen.busy ??= await attrOf(page.getByRole('table'), 'aria-busy');
    }
    return seen.skeleton || (await listedCodes(page, layout)).length > 0;
  });
  const shown = await waitForList(page, layout, PROGRAMS_FIRST_TEN);
  return conclude([
    check(seen.skeleton, 've filas de carga mientras espera', seen.skeleton ? 've filas de carga mientras espera' : 'no ve filas de carga mientras espera'),
    check(seen.busy === 'true', 'la tabla marcada como ocupada', `la tabla tiene aria-busy ${seen.busy ?? '(sin leer)'}`),
    listCheck(shown.codes, PROGRAMS_FIRST_TEN),
  ]);
};

// --- Esquema 2: un filtro sin coincidencias muestra el bloque vacío con la opción de limpiar ----------------------------

const emptyFilter: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const layout = strict('diseño', LAYOUTS, cell(row, 'diseno'));
  const expected = 've el título «Sin programas», el mensaje «Ningún programa coincide con los filtros aplicados.» y el botón «Limpiar filtros»';
  const opened = await signIn(page, layout);
  if (opened) return preparationFailedWeb(expected, opened);
  const typed = await runSteps([['escribir zzzz-no-existe en el buscador de la lista', () => typeSearch(page, layout, 'zzzz-no-existe')]]);
  if (typed) return actionMissing(expected, typed);
  await waitUntil(() => isVisible(emptyBlock(page)));
  const block = emptyBlock(page);
  return conclude([
    await visibleCheck(block.getByText('Sin programas', { exact: true }), 'el título «Sin programas»'),
    await visibleCheck(block.getByText('Ningún programa coincide con los filtros aplicados.', { exact: true }), 'el mensaje «Ningún programa coincide con los filtros aplicados.»'),
    await visibleCheck(block.getByRole('button', { name: 'Limpiar filtros', exact: true }), 'el botón «Limpiar filtros»'),
  ]);
};

// --- Esquema 3: un fallo de la petición muestra el aviso de error con reintento -----------------------------------------

const failedList: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const layout = strict('diseño', DESKTOP_ONLY, cell(row, 'diseno'));
  const expected = 've el aviso «No se pudieron cargar los programas» con el botón «Reintentar» y ningún programa';
  const opened = await signIn(page, layout);
  if (opened) return preparationFailedWeb(expected, opened);
  await failPrograms(page, 'always');
  await page.goto('/programs', { timeout: 10_000 });
  const alert = page.getByRole('alert').filter({ hasText: 'No se pudieron cargar los programas' });
  await waitUntil(() => isVisible(alert));
  const shown = await listedCodes(page, 'escritorio');
  return conclude([
    await visibleCheck(alert, 'el aviso «No se pudieron cargar los programas»'),
    await visibleCheck(alert.getByRole('button', { name: 'Reintentar', exact: true }), 'el botón «Reintentar»'),
    listCheck(shown, []),
  ]);
};

// --- Esquema 4: «Reintentar» recupera la lista cuando la petición vuelve a funcionar -----------------------------------

const retryRecovers: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const layout = strict('diseño', DESKTOP_ONLY, cell(row, 'diseno'));
  const expected = 've el aviso «Datos recargados» y los programas PRG-001 a PRG-010 con el recuento «1–10 de 24»';
  const opened = await signIn(page, layout);
  if (opened) return preparationFailedWeb(expected, opened);
  // La primera petición falla; las siguientes responden bien
  await failPrograms(page, 1);
  await page.goto('/programs', { timeout: 10_000 });
  const alert = page.getByRole('alert').filter({ hasText: 'No se pudieron cargar los programas' });
  await waitUntil(() => isVisible(alert));
  const retry = alert.getByRole('button', { name: 'Reintentar', exact: true });
  const pressed = await runSteps([['pulsar «Reintentar»', () => retry.click(ACTION)]]);
  if (pressed) return actionMissing(expected, pressed);
  // El aviso «Datos recargados» dura 3 s: se mira en cuanto se pulsa, antes de esperar a la respuesta
  const toast = await waitUntil(() => isVisible(page.getByText('Datos recargados', { exact: true })), 2_000);
  const shown = await waitForList(page, 'escritorio', PROGRAMS_FIRST_TEN, '1–10 de 24');
  return conclude([
    check(toast.reached, 've el aviso «Datos recargados»', toast.reached ? 've el aviso «Datos recargados»' : 'no ve el aviso «Datos recargados»'),
    listCheck(shown.codes, codesOf('PRG-001 a PRG-010')),
    countCheck(shown.count ?? (await recountText(page)), '1–10 de 24'),
  ]);
};

defineBrowserRows({
  story: 'US-PROG-LISTA-007',
  surface: 'web',
  tenants: [TENANT_A],
  handlers: new Map<number, BrowserRowHandler>([
    [1, loadingRows],
    [2, emptyFilter],
    [3, failedList],
    [4, retryRecovers],
  ]),
});
