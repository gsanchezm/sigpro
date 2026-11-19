import type { Locator, Page } from '@playwright/test';
import { DEMO, resetTenants, TENANT_A, type Credentials } from '../../../story-runs/support/prepare';
import { ACTION, pathOf, waitUntil } from '../../support/browser';
import { check, cell, conclude, strict, type Check } from '../../support/checks';
import { defineBrowserRows, type BrowserRowHandler } from '../../core/framework';
import { actionMissing, attrOne, enabledOne, notSeenCheck, prepFailed, runSteps, seenCheck, valueCheck } from '../web/common';
import {
  articleOf,
  budgetOf,
  datesOf,
  DIRECT_APPROXIMATION,
  descriptionOf,
  editButton,
  editReasonOf,
  milestonesOptionPanel,
  milestonesPanel,
  onExpoWeb,
  openDetail,
  optionChecked,
  optionOf,
  ownerOf,
  progressBarOf,
  requirementsButton,
  screenTitle,
  signIn,
  stateBadgeOf,
  summaryPanel,
  suppliersOptionPanel,
  suppliersPanel,
} from './common';

// US-PROG-DETALLE-005 — Ver la ficha de un programa en la app móvil (web de Expo a 390 px). Preparación de cada fila: reinicio de alumno01 con
// el token de su administrador; después la app se deja en /login sin sesión guardada, con alumno01 en «Tenant de trabajo», y la cuenta de la
// fila inicia sesión. La ficha se abre por su dirección (carga completa, con la sesión guardada). El veredicto vale para Expo web.

const DETAIL = '/programs/PRG-001';

/** Lectura de un dato de la ficha móvil frente al valor de la celda. */
type Reader = (page: Page, valor: string) => Promise<readonly Check[]>;

/** La etiqueta que la historia nombra se ve en la ficha (el texto exacto de la etiqueta, una sola vez). */
const labelCheck = (page: Page, label: string): Promise<Check> =>
  seenCheck(articleOf(page).getByText(label, { exact: true }), `ve la etiqueta «${label}»`, `la etiqueta «${label}»`);

/** Campo con etiqueta: se comprueba la etiqueta y el valor. */
const labeledField =
  (label: string, locate: (page: Page) => Locator): Reader =>
  async (page, valor) => [await labelCheck(page, label), await valueCheck(locate(page), valor, `el campo «${label}»`)];

const FIELD_READERS: ReadonlyMap<string, Reader> = new Map<string, Reader>([
  ['el título', async (page, valor) => [await valueCheck(screenTitle(page), valor, 'el título')]],
  ['el código', async (page, valor) => [await seenCheck(articleOf(page).getByText(valor, { exact: true }), `ve el código ${valor}`, 'el código')]],
  ['el estado', async (page, valor) => [await valueCheck(stateBadgeOf(page), valor, 'el estado')]],
  ['el campo «Responsable»', labeledField('Responsable', ownerOf)],
  ['el campo «Fechas»', labeledField('Fechas', datesOf)],
  ['el campo «Presupuesto»', labeledField('Presupuesto', budgetOf)],
  [
    'la barra «Progreso»',
    async (page, valor) => {
      // El texto «11 %» va junto a la barra (la barra no tiene texto propio); el valor de la barra es aria-valuenow
      const percent = valor.replace(/\s*%$/, '');
      const label = await labelCheck(page, 'Progreso');
      const text = await valueCheck(progressBarOf(page).locator('xpath=../..'), valor, 'la barra «Progreso» muestra');
      const now = await attrOne(progressBarOf(page), 'aria-valuenow');
      return [label, text, check(now === percent, `la barra «Progreso» vale ${percent}`, `la barra «Progreso» vale ${now ?? '(sin leer)'}`)];
    },
  ],
  ['la descripción', async (page, valor) => [await valueCheck(descriptionOf(page), valor, 'la descripción')]],
]);

// --- Esquema 1: la ficha de PRG-001 muestra sus datos del seed ------------------------------------------------------------------------------

const seedFacts: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const reader = strict('dato', FIELD_READERS, cell(row, 'dato'));
  const valor = cell(row, 'valor');
  const expected = `ve ${cell(row, 'dato')} con el valor ${valor}`;
  const signed = await signIn(page, DEMO.gestor);
  if (signed) return prepFailed(expected, signed);
  const opened = await openDetail(page, DETAIL);
  if (opened) return actionMissing(expected, opened);
  return conclude(await reader(page, valor), { note: DIRECT_APPROXIMATION });
};

// --- Esquema 2: el botón Editar programa depende del rol en la app móvil --------------------------------------------------------------------

const ACCOUNTS: ReadonlyMap<string, Credentials> = new Map<string, Credentials>([
  ['gestor@sigpro.test', DEMO.gestor],
  ['alumno01@sigpro.lab', { email: 'alumno01@sigpro.lab', password: 'Alumno1234!' }],
  ['consultor@sigpro.test', DEMO.consultor],
  ['auditor@sigpro.test', DEMO.auditor],
]);
const REASON = 'Tu rol no permite modificar programas';
const EDIT_STATE: ReadonlyMap<string, 'habilitado' | 'deshabilitado'> = new Map<string, 'habilitado' | 'deshabilitado'>([
  ['habilitado', 'habilitado'],
  ['deshabilitado, y debajo se lee «Tu rol no permite modificar programas»', 'deshabilitado'],
]);
const ON_CLICK: ReadonlyMap<string, 'llega' | 'no-pulsa'> = new Map<string, 'llega' | 'no-pulsa'>([
  ['al pulsarlo se abre la ruta /programs/PRG-001/edit', 'llega'],
  ['no se puede pulsar', 'no-pulsa'],
]);

const editByRole: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const credentials = strict('cuenta', ACCOUNTS, cell(row, 'cuenta'));
  const state = strict('estado_boton', EDIT_STATE, cell(row, 'estado_boton'));
  const onClick = strict('al_pulsarlo', ON_CLICK, cell(row, 'al_pulsarlo'));
  const expected = `el botón «Editar programa» está ${cell(row, 'estado_boton')}; ${cell(row, 'al_pulsarlo')}`;
  const signed = await signIn(page, credentials);
  if (signed) return prepFailed(expected, signed);
  const opened = await openDetail(page, DETAIL);
  if (opened) return actionMissing(expected, opened);

  const button = editButton(page);
  const enabled = await enabledOne(button);
  const shown = enabled === undefined ? '(sin leer)' : enabled ? 'habilitado' : 'deshabilitado';
  const checks: Check[] = [];
  if (state === 'habilitado') {
    checks.push(check(enabled === true, 'el botón «Editar programa» está habilitado', `el botón «Editar programa» está ${shown}`));
  } else {
    checks.push(check(enabled === false, 'el botón «Editar programa» está deshabilitado', `el botón «Editar programa» está ${shown}`));
    checks.push(await valueCheck(editReasonOf(page), REASON, 'el motivo debajo del botón'));
  }

  if (onClick === 'llega') {
    const clicked = await runSteps([['pulsar «Editar programa»', () => button.click(ACTION)]]);
    if (clicked) return actionMissing(expected, clicked);
    const arrived = await waitUntil(async () => pathOf(page) === '/programs/PRG-001/edit');
    checks.push(check(arrived.reached, 'al pulsarlo se abre la ruta /programs/PRG-001/edit', `al pulsarlo se abre ${pathOf(page)}`));
    return conclude(checks, { note: DIRECT_APPROXIMATION });
  }
  // «No se puede pulsar»: el clic debe fallar (el botón está deshabilitado) y la app debe seguir en la ficha
  const refused = await runSteps([['pulsar «Editar programa»', () => button.click({ timeout: 1_000 })]]);
  checks.push(
    check(
      refused !== undefined && pathOf(page) === DETAIL,
      'no se puede pulsar: la app sigue en /programs/PRG-001',
      refused === undefined ? `se pudo pulsar y la app va a ${pathOf(page)}` : `no se pudo pulsar; sigue en ${pathOf(page)}`,
    ),
  );
  return conclude(checks, refused === undefined ? { note: DIRECT_APPROXIMATION } : { note: DIRECT_APPROXIMATION, evidence: { callLog: refused.callLog } });
};

// --- Esquema 3: cada opción de la ficha muestra su contenido en la app móvil ---------------------------------------------------------------

const OPTIONS: ReadonlyMap<string, string> = new Map<string, string>([
  ['«Resumen»', 'Resumen'],
  ['«Hitos»', 'Hitos'],
  ['«Proveedores»', 'Proveedores'],
]);
const CONTENT: ReadonlyMap<string, 'resumen' | 'hitos' | 'proveedores'> = new Map<string, 'resumen' | 'hitos' | 'proveedores'>([
  ['los datos del programa y el botón «Ver requisitos»', 'resumen'],
  ['el panel de hitos del programa', 'hitos'],
  ['el panel de proveedores del programa', 'proveedores'],
]);

const optionContent: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const option = strict('opción', OPTIONS, cell(row, 'opcion'));
  const kind = strict('contenido', CONTENT, cell(row, 'contenido'));
  const expected = `ve ${cell(row, 'contenido')}; la opción seleccionada es ${option}`;
  const signed = await signIn(page, DEMO.gestor);
  if (signed) return prepFailed(expected, signed);
  const opened = await openDetail(page, DETAIL);
  if (opened) return actionMissing(expected, opened);
  const picked = await runSteps([[`elegir «${option}»`, () => optionOf(page, option).click(ACTION)]]);
  if (picked) return actionMissing(expected, picked);
  // La opción elegida se marca al re-pintar: se espera a que quede marcada antes de leer su contenido
  await waitUntil(async () => (await attrOne(optionOf(page, option), 'aria-checked')) === 'true');

  const checks: Check[] = [];
  if (kind === 'resumen') {
    checks.push(
      await seenCheck(summaryPanel(page), 've los datos del programa', 'los datos del programa'),
      await valueCheck(ownerOf(page), 'Marta Ruiz', 'el responsable'),
      await seenCheck(requirementsButton(page), 've el botón «Ver requisitos»', 'el botón «Ver requisitos»'),
    );
  } else if (kind === 'hitos') {
    checks.push(
      await seenCheck(milestonesOptionPanel(page), 've el panel de hitos del programa', 'el panel de hitos'),
      await seenCheck(milestonesPanel(page), 've el panel de hitos del programa', 'el panel de hitos'),
      await notSeenCheck(summaryPanel(page), 'no ve los datos del programa', 'los datos del programa'),
    );
  } else {
    checks.push(
      await seenCheck(suppliersOptionPanel(page), 've el panel de proveedores del programa', 'el panel de proveedores'),
      await seenCheck(suppliersPanel(page), 've el panel de proveedores del programa', 'el panel de proveedores'),
      await notSeenCheck(summaryPanel(page), 'no ve los datos del programa', 'los datos del programa'),
    );
  }
  checks.push(await optionChecked(page, option));
  return conclude(checks, { note: DIRECT_APPROXIMATION });
};

// --- Esquema 4: ver requisitos lleva al árbol del programa en la app móvil ----------------------------------------------------------------

const PROGRAM_CODE: ReadonlyMap<string, string> = new Map<string, string>([['PRG-001', 'PRG-001']]);

const requirementsTree: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const code = strict('codigo', PROGRAM_CODE, cell(row, 'codigo'));
  const expected = `llega a /programs/${code}/requirements`;
  const signed = await signIn(page, DEMO.gestor);
  if (signed) return prepFailed(expected, signed);
  const opened = await openDetail(page, `/programs/${code}`);
  if (opened) return actionMissing(expected, opened);
  const clicked = await runSteps([['pulsar «Ver requisitos»', () => requirementsButton(page).click(ACTION)]]);
  if (clicked) return actionMissing(expected, clicked);
  const arrived = await waitUntil(async () => pathOf(page) === `/programs/${code}/requirements`);
  return conclude([check(arrived.reached, expected, `llega a ${pathOf(page)}`)], { note: DIRECT_APPROXIMATION });
};

defineBrowserRows({
  story: 'US-PROG-DETALLE-005',
  surface: 'expo-web',
  tenants: [TENANT_A],
  handlers: new Map<number, BrowserRowHandler>([
    [1, onExpoWeb(seedFacts)],
    [2, onExpoWeb(editByRole)],
    [3, onExpoWeb(optionContent)],
    [4, onExpoWeb(requirementsTree)],
  ]),
});
