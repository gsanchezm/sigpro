import { field } from '../../../story-runs/support/api';
import { defineApiRows, type ApiRowHandler, type Outcome } from '../../core/framework';
import { cell, check, preparationFailed, strict, type Check } from '../../support/checks';
import { ACCOUNT_OF, TENANT_A, act, codeCell, expectChecks, itemsOf, loginAs, resetTenants, snapshotOf, unchangedCheck, verdict, type Expect } from './common';

// US-REQ-EDICION-005 — Reordenar un requisito entre sus hermanos (API). Preparación de cada fila: reinicio de alumno01 y token de
// gestor@sigpro.test. Las posiciones que da la historia se comprueban sobre la lista del programa que devuelve la API.

/** Hermanos de un padre (`null` = raíces) leídos de una lista de requisitos, ordenados por posición: [código, posición]. */
const siblingsOf = (items: readonly Record<string, unknown>[], parent: string | null): readonly (readonly [string, number])[] =>
  items
    .filter((item) => (field(item, 'parentCode') ?? null) === parent)
    .map((item): readonly [string, number] => [String(field(item, 'code')), Number(field(item, 'position'))])
    .sort((a, b) => a[1] - b[1]);

/** Orden esperado de la celda: padre del grupo y código con su posición, en orden. */
interface ExpectedOrder {
  readonly parent: string | null;
  readonly order: readonly (readonly [code: string, position: number])[];
}

const ORDEN_OF: ReadonlyMap<string, ExpectedOrder> = new Map<string, ExpectedOrder>([
  ['las raíces quedan REQ-006 (position 0), REQ-011 (position 1) y REQ-001 (position 2)', { parent: null, order: [['REQ-006', 0], ['REQ-011', 1], ['REQ-001', 2]] }],
  ['las raíces quedan REQ-011 (position 0), REQ-001 (position 1) y REQ-006 (position 2)', { parent: null, order: [['REQ-011', 0], ['REQ-001', 1], ['REQ-006', 2]] }],
  ['las raíces quedan REQ-006 (position 0), REQ-001 (position 1) y REQ-011 (position 2)', { parent: null, order: [['REQ-006', 0], ['REQ-001', 1], ['REQ-011', 2]] }],
  ['los hijos de REQ-001 quedan REQ-002 (position 0), REQ-005 (position 1) y REQ-003 (position 2)', { parent: 'REQ-001', order: [['REQ-002', 0], ['REQ-005', 1], ['REQ-003', 2]] }],
  ['los hijos de REQ-001 quedan REQ-003 (position 0), REQ-005 (position 1) y REQ-002 (position 2)', { parent: 'REQ-001', order: [['REQ-003', 0], ['REQ-005', 1], ['REQ-002', 2]] }],
]);

/** Colocación de la celda: «before» y «after» se envían; «(sin el campo)» no se envía; «middle» se envía y la API lo rechaza. */
const PLACEMENT_OF: ReadonlyMap<string, string | undefined> = new Map<string, string | undefined>([
  ['before', 'before'],
  ['after', 'after'],
  ['(sin el campo)', undefined],
  ['middle', 'middle'],
]);

/** Destino de la celda: `undefined` si no se envía; si se envía, debe ser un código. */
const targetOf = (text: string): string | undefined => (text === '(sin el campo)' ? undefined : codeCell(text));

/** Nota de las filas con «required»: la historia pide la clave del catálogo; el esquema devuelve el mensaje por defecto de Zod. */
const REQUIRED_NOTE = 'la historia pide la clave «required»; la API devuelve el mensaje por defecto de Zod para un campo ausente (packages/shared/src/schemas.ts: targetCode)';

/** Token de gestor en alumno01 tras reiniciarlo. Devuelve el token, o la preparación fallida. */
const gestorToken = async (expected: string): Promise<string | Outcome> => {
  await resetTenants([TENANT_A]);
  const session = await loginAs(strict('cuenta', ACCOUNT_OF, 'gestor@sigpro.test'));
  return session.token ?? preparationFailed(expected, 'gestor@sigpro.test inicia sesión en alumno01 y recibe accessToken', session.last);
};

// --- Esquema 1: reordenar deja a los hermanos en el orden pedido --------------------------------------------------------------

const reorders: ApiRowHandler = async (row) => {
  const code = codeCell(cell(row, 'codigo'));
  const expected = `POST ${code}/move responde 200 con PRG-001; los hermanos quedan en el orden de la celda`;
  const token = await gestorToken(expected);
  if (typeof token !== 'string') return token;
  const expectedOrder = strict('orden', ORDEN_OF, cell(row, 'orden'));
  const beforeItems = itemsOf(await act('GET', '/programs/PRG-001/requirements', token));
  const parentBefore = beforeItems?.find((item) => field(item, 'code') === code);
  const result = await act('POST', `/requirements/${code}/move`, token, { targetCode: targetOf(cell(row, 'destino')), placement: strict('colocacion', PLACEMENT_OF, cell(row, 'colocacion')) });
  const items = itemsOf(result);
  const checks: Check[] = expectChecks({ status: 200 }, result);
  const program = field(result.body, 'program');
  checks.push(check(field(program, 'code') === 'PRG-001', 'program PRG-001', `program ${String(field(program, 'code') ?? '(sin leer)')}`));
  if (items === undefined || parentBefore === undefined || beforeItems === undefined) return verdict([...checks, check(false, 'lista legible antes y después', 'lista no legible')]);
  const group = siblingsOf(items, expectedOrder.parent);
  const expectedText = expectedOrder.order.map(([entry, position]) => `${entry} (${position})`).join(', ');
  const observedText = group.map(([entry, position]) => `${entry} (${position})`).join(', ');
  checks.push(check(JSON.stringify(group) === JSON.stringify(expectedOrder.order), `hermanos ${expectedText}`, `hermanos ${observedText}`));
  // El requisito conserva su padre
  const parentAfter = items.find((item) => field(item, 'code') === code);
  const parentWas = field(parentBefore, 'parentCode') ?? null;
  const parentNow = field(parentAfter ?? {}, 'parentCode') ?? null;
  checks.push(check(parentAfter !== undefined && parentNow === parentWas, `${code} conserva su padre (${String(parentWas)})`, `${code} tiene padre ${String(parentNow)}`));
  // Solo cambian las posiciones de los hermanos: el resto del programa conserva la suya
  const siblingCodes = new Set(group.map(([entry]) => entry));
  const others = beforeItems.filter((item) => !siblingCodes.has(String(field(item, 'code'))));
  const othersMoved = others.filter((item) => {
    const now = items.find((candidate) => field(candidate, 'code') === field(item, 'code'));
    return now === undefined || field(now, 'position') !== field(item, 'position');
  });
  checks.push(check(othersMoved.length === 0, 'el resto del programa no cambia de posición', othersMoved.length === 0 ? 'el resto del programa no cambia de posición' : `cambian: ${othersMoved.map((item) => String(field(item, 'code'))).join(', ')}`));
  return verdict(checks);
};

// --- Esquema 2: un destino que no es hermano del requisito se rechaza sin cambiar el orden -------------------------------

interface Rationale {
  readonly code: string;
  readonly field: 'parentCode' | 'programCode';
  readonly value: string | null;
}

/** Expectativa de un rechazo; `rationale` es el porqué que cita la celda y se comprueba contra la API; `required` marca la clave que pide la historia. */
interface RejectExpect extends Expect {
  readonly rationale?: Rationale;
  readonly required?: true;
}

const RESPUESTA_E2: ReadonlyMap<string, RejectExpect> = new Map<string, RejectExpect>([
  ['422 validation_failed con errors.targetCode igual a badTarget', { status: 422, code: 'validation_failed', errors: { targetCode: 'badTarget' } }],
  [
    '422 validation_failed con errors.targetCode igual a badTarget, porque REQ-002 es hijo de REQ-001',
    { status: 422, code: 'validation_failed', errors: { targetCode: 'badTarget' }, rationale: { code: 'REQ-002', field: 'parentCode', value: 'REQ-001' } },
  ],
  [
    '422 validation_failed con errors.targetCode igual a badTarget, porque REQ-006 es una raíz',
    { status: 422, code: 'validation_failed', errors: { targetCode: 'badTarget' }, rationale: { code: 'REQ-006', field: 'parentCode', value: null } },
  ],
  [
    '422 validation_failed con errors.targetCode igual a badTarget, porque REQ-015 es de PRG-002',
    { status: 422, code: 'validation_failed', errors: { targetCode: 'badTarget' }, rationale: { code: 'REQ-015', field: 'programCode', value: 'PRG-002' } },
  ],
  ['404 requirement_not_found', { status: 404, code: 'requirement_not_found' }],
  ['422 validation_failed con errors.targetCode igual a required', { status: 422, code: 'validation_failed', errors: { targetCode: 'required' }, required: true }],
  ['422 validation_failed con un motivo para placement', { status: 422, code: 'validation_failed', motiveFor: 'placement' }],
]);

const rejectsWithoutMoving: ApiRowHandler = async (row) => {
  const code = codeCell(cell(row, 'codigo'));
  const expected = `respuesta ${cell(row, 'respuesta')}; el orden de PRG-001 no cambia`;
  const token = await gestorToken(expected);
  if (typeof token !== 'string') return token;
  const expect = strict('respuesta', RESPUESTA_E2, cell(row, 'respuesta'));
  const before = await snapshotOf(token, 'PRG-001');
  const result = await act('POST', `/requirements/${code}/move`, token, { targetCode: targetOf(cell(row, 'destino')), placement: strict('colocacion', PLACEMENT_OF, cell(row, 'colocacion')) });
  const checks: Check[] = expectChecks(expect, result);
  if (expect.rationale !== undefined) {
    const read = await act('GET', `/requirements/${expect.rationale.code}`, token);
    const observed = field(read.body, expect.rationale.field) ?? null;
    const wanted = expect.rationale.value;
    const text = expect.rationale.field === 'programCode' ? `${expect.rationale.code} es de ${String(wanted)}` : `${expect.rationale.code} tiene padre ${String(wanted)}`;
    checks.push(check(observed === wanted, text, `${expect.rationale.code} ${expect.rationale.field} ${String(observed)}`));
  }
  const after = await snapshotOf(token, 'PRG-001');
  checks.push(unchangedCheck(before, after, 'la lista de PRG-001'));
  const note = expect.required === true && checks.some((entry) => !entry.ok) ? REQUIRED_NOTE : undefined;
  return verdict(checks, note);
};

defineApiRows({
  story: 'US-REQ-EDICION-005',
  surface: 'api',
  tenants: [TENANT_A],
  handlers: new Map<number, ApiRowHandler>([
    [1, reorders],
    [2, rejectsWithoutMoving],
  ]),
});
