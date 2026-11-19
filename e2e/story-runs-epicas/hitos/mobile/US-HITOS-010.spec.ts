import { DEMO, TENANT_A, resetTenants, type Credentials } from '../../../story-runs/support/prepare';
import { ACTION, waitUntil } from '../../support/browser';
import { cell, check, conclude, strict, type Check } from '../../support/checks';
import { defineBrowserRows, outcome, type BrowserRowHandler } from '../../core/framework';
import {
  ACTION_REASON,
  PROGRESS_REASON,
  attrOne,
  buttonNamed,
  cardCount,
  countLine,
  decOf,
  deleteAllMilestones,
  deleteItem,
  delayMilestones,
  emptyLine,
  enterAndOpen,
  errorBlock,
  failingMilestones,
  gestorToken,
  incOf,
  loadingBlock,
  loadingMoment,
  menuOf,
  newButton,
  onExpoWeb,
  openHitos,
  reasonOf,
  renameItem,
  settledCards,
  signIn,
  sliderOf,
  statusInCard,
  visibleText,
} from './common';
import { actionMissing, enabledOne, prepFailed, literal, runSteps, textOne } from '../web/common';

// US-HITOS-010 — Ver los hitos en tarjetas: estado, avance, permisos y estados de carga, vacío y error (app móvil, Expo web a 390 px).
// Preparación de cada fila: reinicio de alumno01 con el token de su administrador; después, inicio de sesión de la cuenta de la fila con
// «alumno01» en «Tenant de trabajo», la ficha del programa y la opción «Hitos». La fila de vacío borra los hitos de PRG-003 por HTTP; la de
// carga retrasa la lista 3 s y la de error la hace fallar con 500 antes de abrir la pestaña (la petición sale al abrirla).

const DATOS: ReadonlyMap<string, 'estado' | 'avance'> = new Map<string, 'estado' | 'avance'>([
  ['el estado', 'estado'],
  ['el avance', 'avance'],
]);

const PROGRAMAS: ReadonlyMap<string, string> = new Map<string, string>([
  ['PRG-001', 'PRG-001'],
  ['PRG-004', 'PRG-004'],
]);

const PROGRAMAS_ESTADO: ReadonlyMap<string, string> = new Map<string, string>([
  ['PRG-001', 'PRG-001'],
  ['PRG-003', 'PRG-003'],
]);

const CUENTAS: ReadonlyMap<string, Credentials> = new Map<string, Credentials>([
  ['gestor@sigpro.test', DEMO.gestor],
  ['consultor@sigpro.test', DEMO.consultor],
  ['auditor@sigpro.test', DEMO.auditor],
]);

/** Id del hito SRR de PRG-001 (la app enlaza el motivo del avance con el id del hito). */
const SRR_ID = 'PRG-001-M01';

/** Lo que cada fila de rol dice que puede hacer, leído de la celda «resultado» (texto exacto de la historia). */
const RESULTADO_ROL: ReadonlyMap<string, 'edita' | 'solo lectura'> = new Map<string, 'edita' | 'solo lectura'>([
  ['«Nuevo hito» habilitado, los botones «−» y «+» del control de avance de «SRR» habilitados donde el avance lo permite, y «Renombrar» y «Eliminar» habilitados', 'edita'],
  [
    'el texto «Tu rol no permite crear hitos» bajo «Nuevo hito», el texto «Tu rol no permite modificar hitos» bajo el control de avance de la tarjeta, los botones «−» y «+» sin poder pulsarse, y «Renombrar» y «Eliminar» deshabilitados con sus motivos',
    'solo lectura',
  ],
]);

type Situacion = 'retraso' | 'vacio' | 'error';

const SITUACION: ReadonlyMap<string, Situacion> = new Map<string, Situacion>([
  ['la prueba retrasa 3 segundos la respuesta de GET /api/programs/PRG-001/milestones', 'retraso'],
  ['se han borrado, uno a uno y con su id, todos los hitos de PRG-003 mediante DELETE hasta que su lista está vacía', 'vacio'],
  ['la prueba responde 500 a GET /api/programs/PRG-001/milestones', 'error'],
]);

// --- Esquema 1: cada tarjeta muestra su estado y su avance -----------------------------------------------------------------

const cardValue: BrowserRowHandler = async (row, { page }) => {
  const hito = literal(cell(row, 'hito'));
  const dato = strict('dato', DATOS, cell(row, 'dato'));
  const valor = literal(cell(row, 'valor'));
  const expected = `la tarjeta de ${hito} muestra ${cell(row, 'dato')} como ${valor}`;
  await resetTenants([TENANT_A]);
  const failure = await enterAndOpen(page, DEMO.gestor, 'PRG-001');
  if (failure) return prepFailed(expected, failure);
  await settledCards(page);
  if (dato === 'estado') {
    const estado = await statusInCard(page, hito);
    return conclude([check(estado === valor, `la tarjeta de ${hito} muestra el estado ${valor}`, `el estado es ${estado ?? '(sin leer)'}`)]);
  }
  const avance = await attrOne(sliderOf(page, hito), 'aria-valuetext');
  return conclude([check(avance === valor, `la tarjeta de ${hito} muestra el avance ${valor}`, `el avance es ${avance ?? '(sin leer)'}`)]);
};

// --- Esquema 2: el recuento cambia con los hitos cumplidos del programa --------------------------------------------------

const recount: BrowserRowHandler = async (row, { page }) => {
  const programa = strict('programa', PROGRAMAS, cell(row, 'programa'));
  const recuento = literal(cell(row, 'recuento'));
  const expected = `el recuento dice ${recuento}`;
  await resetTenants([TENANT_A]);
  const failure = await enterAndOpen(page, DEMO.gestor, programa);
  if (failure) return prepFailed(expected, failure);
  await settledCards(page);
  const texto = await textOne(countLine(page));
  return conclude([check(texto === recuento, `el recuento dice ${recuento}`, `el recuento dice ${texto ?? '(sin leer)'}`)]);
};

// --- Esquema 3: cada rol ve los controles de hitos según su permiso ---------------------------------------------------------

const roleControls: BrowserRowHandler = async (row, { page }) => {
  const cuenta = cell(row, 'cuenta');
  const credenciales = strict('cuenta', CUENTAS, cuenta);
  const expected = `${cuenta} ve ${cell(row, 'resultado')}`;
  await resetTenants([TENANT_A]);
  const failure = await enterAndOpen(page, credenciales, 'PRG-001');
  if (failure) return prepFailed(expected, failure);
  await settledCards(page);
  const modo = strict('resultado', RESULTADO_ROL, cell(row, 'resultado'));
  const puede = modo === 'edita';
  const nuevo = await enabledOne(newButton(page));
  const dec = await enabledOne(decOf(page, 'SRR'));
  const inc = await enabledOne(incOf(page, 'SRR'));
  const checks: Check[] = [check(nuevo === puede, `«Nuevo hito» ${puede ? 'habilitado' : 'deshabilitado'}`, `«Nuevo hito» ${String(nuevo)}`)];
  if (puede) {
    // SRR tiene el 100 %: «−» se puede pulsar y «+» no
    checks.push(check(dec === true && inc === false, '«−» habilitado y «+» deshabilitado (SRR al 100 %)', `«−» ${String(dec)} y «+» ${String(inc)}`));
  } else {
    checks.push(check(dec === false && inc === false, '«−» y «+» sin poder pulsarse', `«−» ${String(dec)} y «+» ${String(inc)}`));
    checks.push(await visibleText(page.getByText('Tu rol no permite crear hitos', { exact: true }), 'Tu rol no permite crear hitos', 'el motivo bajo «Nuevo hito» es'));
    const motivoAvance = await reasonOf(page, PROGRESS_REASON(SRR_ID));
    checks.push(check(motivoAvance === 'Tu rol no permite modificar hitos', 'bajo el control de avance: «Tu rol no permite modificar hitos»', `bajo el control: «${motivoAvance ?? '(sin texto)'}»`));
  }
  // Menú ⋯ de SRR: se abre la hoja y se espera a que muestre «Renombrar» antes de leer sus opciones
  const menu = await runSteps([['abrir el menú de SRR', () => menuOf(page, 'SRR').click(ACTION)]]);
  if (menu) return actionMissing(expected, menu);
  const hoja = await waitUntil(() => renameItem(page).isVisible({ timeout: 500 }).catch(() => false));
  if (!hoja.reached) return conclude([check(false, 'la hoja de acciones de SRR muestra «Renombrar»', 'la hoja de acciones no se muestra')]);
  const renombrar = await enabledOne(renameItem(page));
  const eliminar = await enabledOne(deleteItem(page));
  if (puede) {
    checks.push(check(renombrar === true && eliminar === true, '«Renombrar» y «Eliminar» habilitados', `«Renombrar» ${String(renombrar)} y «Eliminar» ${String(eliminar)}`));
  } else {
    checks.push(check(renombrar === false && eliminar === false, '«Renombrar» y «Eliminar» deshabilitados', `«Renombrar» ${String(renombrar)} y «Eliminar» ${String(eliminar)}`));
    const motivoRenombrar = await reasonOf(page, ACTION_REASON('milestone-rename'));
    const motivoEliminar = await reasonOf(page, ACTION_REASON('milestone-delete'));
    checks.push(check(motivoRenombrar === 'Tu rol no permite modificar hitos', 'motivo de «Renombrar»: «Tu rol no permite modificar hitos»', `motivo «${motivoRenombrar ?? '(sin texto)'}»`));
    checks.push(check(motivoEliminar === 'Tu rol no permite eliminar hitos', 'motivo de «Eliminar»: «Tu rol no permite eliminar hitos»', `motivo «${motivoEliminar ?? '(sin texto)'}»`));
  }
  return conclude(checks);
};

// --- Esquema 4: estados de carga, vacío y error de la lista ----------------------------------------------------------------

const states: BrowserRowHandler = async (row, { page }) => {
  const situacion = strict('situacion', SITUACION, cell(row, 'situacion'));
  const programa = strict('programa', PROGRAMAS_ESTADO, cell(row, 'programa'));
  const expected = cell(row, 'resultado');
  await resetTenants([TENANT_A]);

  if (situacion === 'vacio') {
    const token = await gestorToken();
    if (token === undefined) return outcome(false, expected, 'la preparación no se cumplió: gestor@sigpro.test no inicia sesión por HTTP', { note: 'Preparación por HTTP fallida.' });
    const borrado = await deleteAllMilestones(token, programa);
    if (borrado !== undefined) return outcome(false, expected, `la preparación no se cumplió: DELETE de los hitos de ${programa} responde ${borrado.status}`, { note: 'Preparación por HTTP fallida.' });
  }
  const signed = await signIn(page, DEMO.gestor);
  if (signed) return prepFailed(expected, signed);
  if (situacion === 'retraso') await delayMilestones(page, 'PRG-001', 3_000);
  const switchOn = situacion === 'error' ? await failingMilestones(page, 'PRG-001') : undefined;
  const opened = await openHitos(page, programa);
  if (opened) return prepFailed(expected, opened);

  if (situacion === 'retraso') {
    const cargando = await waitUntil(() => loadingBlock(page).isVisible({ timeout: 500 }).catch(() => false));
    const momento = await loadingMoment(page);
    const llego = await settledCards(page);
    const tarjetas = await cardCount(page);
    return conclude([
      check(cargando.reached, 'un indicador de carga', cargando.reached ? 'indicador de carga visible' : 'sin indicador de carga'),
      check(momento.cards === 0, 'ninguna tarjeta mientras carga', `${momento.cards} tarjetas mientras carga`),
      check(llego && tarjetas === 9, 'al llegar la respuesta, los 9 hitos del programa', `${tarjetas} tarjetas al llegar`),
    ]);
  }
  if (situacion === 'vacio') {
    await settledCards(page);
    const recuento = await textOne(countLine(page));
    return conclude([
      await visibleText(emptyLine(page), 'Este programa todavía no tiene hitos.', 'el aviso'),
      check(recuento === '0 de 0 hitos cumplidos', 'el recuento «0 de 0 hitos cumplidos»', `el recuento dice ${recuento ?? '(sin leer)'}`),
    ]);
  }
  // Situación «error»: el aviso con «Reintentar»; al reintentar sin el 500, los 9 hitos
  const aviso = await waitUntil(() => errorBlock(page).isVisible({ timeout: 500 }).catch(() => false));
  const titulo = await visibleText(errorBlock(page).getByText('No se pudieron cargar los hitos', { exact: true }), 'No se pudieron cargar los hitos', 'el aviso');
  const sinTarjetas = (await cardCount(page)) === 0;
  if (switchOn) switchOn.on = false;
  const reintento = await runSteps([['pulsar «Reintentar»', () => buttonNamed(page, 'Reintentar').click(ACTION)]]);
  if (reintento) return actionMissing(expected, reintento);
  const vuelve = await settledCards(page);
  const tarjetas = await cardCount(page);
  return conclude([
    check(aviso.reached, 'el aviso «No se pudieron cargar los hitos» con «Reintentar»', aviso.reached ? 'aviso de error visible' : 'sin aviso de error'),
    titulo,
    check(sinTarjetas, 'ninguna tarjeta mientras falla la carga', sinTarjetas ? 'ninguna tarjeta' : 'hay tarjetas'),
    check(vuelve && tarjetas === 9, 'al reintentar sin el 500, los 9 hitos', `${tarjetas} tarjetas tras reintentar`),
  ]);
};

defineBrowserRows({
  story: 'US-HITOS-010',
  surface: 'expo-web',
  tenants: [TENANT_A],
  handlers: new Map<number, BrowserRowHandler>([
    [1, onExpoWeb(cardValue)],
    [2, onExpoWeb(recount)],
    [3, onExpoWeb(roleControls)],
    [4, onExpoWeb(states)],
  ]),
});
