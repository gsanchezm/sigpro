import { call, field } from '../../../story-runs/support/api';
import { TENANT_A, TENANT_B } from '../../../story-runs/support/prepare';
import { cell, check, errorsOf, preparationFailed, strict } from '../../support/checks';
import { defineApiRows, type ApiRowHandler } from '../../core/framework';
import { adminAccess, chaosIs, expectCheck, newestAuditAction, prepareTenant, rowOutcome, shown, withRestore, withToken } from './common';

// US-CAOS-RESET-006 — Leer y fijar el modo caos del tenant (API). Cada fila reinicia alumno01 antes de actuar; alumno02 solo aparece
// en la cabecera de un ejemplo. Al terminar, `withRestore` reinicia los tenants que usa y les apaga el caos.

/** Cabecera `x-tenant` de la lectura: alumno01 o alumno02 (Esquemas 1, 2 y 6). */
const HEADERS: ReadonlyMap<string, string> = new Map<string, string>([
  ['alumno01', TENANT_A],
  ['alumno02', TENANT_B],
]);

/** Cuerpos de `PATCH /api/admin/chaos` de la tabla (JSON tal como lo escribe la historia). */
const BODIES: ReadonlyMap<string, unknown> = new Map<string, unknown>([
  ['{ "errorRate": 0.25 }', { errorRate: 0.25 }],
  ['{ "flakyLabels": false }', { flakyLabels: false }],
  ['{}', {}],
  ['{ "latencyMs": -1 }', { latencyMs: -1 }],
  ['{ "latencyMs": 5001 }', { latencyMs: 5001 }],
  ['{ "latencyMs": 400.5 }', { latencyMs: 400.5 }],
  ['{ "errorRate": -0.01 }', { errorRate: -0.01 }],
  ['{ "errorRate": 1.01 }', { errorRate: 1.01 }],
  ['{ "flakyLabels": "true" }', { flakyLabels: 'true' }],
  ['{ "latencyMs": 0 }', { latencyMs: 0 }],
  ['{ "latencyMs": 1 }', { latencyMs: 1 }],
  ['{ "latencyMs": 4999 }', { latencyMs: 4999 }],
  ['{ "latencyMs": 5000 }', { latencyMs: 5000 }],
  ['{ "errorRate": 0 }', { errorRate: 0 }],
  ['{ "errorRate": 1 }', { errorRate: 1 }],
  ['{ "flakyLabels": true }', { flakyLabels: true }],
]);

/** Valores fijados por la historia en el cambio parcial (Esquema 3). */
const RATES: ReadonlyMap<string, number> = new Map<string, number>([
  ['0.25', 0.25],
  ['0', 0],
]);
const FLAKY: ReadonlyMap<string, boolean> = new Map<string, boolean>([
  ['true', true],
  ['false', false],
]);

/** Campo del caos que la historia valida o fija (Esquemas 4 y 5). */
const CHAOS_FIELDS: ReadonlyMap<string, 'latencyMs' | 'errorRate' | 'flakyLabels'> = new Map<string, 'latencyMs' | 'errorRate' | 'flakyLabels'>([
  ['latencyMs', 'latencyMs'],
  ['errorRate', 'errorRate'],
  ['flakyLabels', 'flakyLabels'],
]);

/** Valor en el límite que la historia fija (Esquema 5). */
const BOUNDARY_VALUES: ReadonlyMap<string, number | boolean> = new Map<string, number | boolean>([
  ['0', 0],
  ['1', 1],
  ['4999', 4999],
  ['5000', 5000],
  ['true', true],
]);

const ZERO_CHAOS = { latencyMs: 0, errorRate: 0, flakyLabels: false } as const;
const SET_CHAOS = { latencyMs: 400, errorRate: 0.5, flakyLabels: true } as const;

// --- Esquema 1: leer el modo caos devuelve los valores de reposo ---------------------------------------------------------------

const readsRestValues: ApiRowHandler = async (row) => {
  const header = strict('cabecera', HEADERS, cell(row, 'cabecera'));
  return withRestore([TENANT_A], async () => {
    await prepareTenant(TENANT_A);
    const token = await adminAccess(TENANT_A);
    const read = await withToken('GET', '/admin/chaos', header, token);
    return rowOutcome([
      expectCheck(read, 'la respuesta es 200', { status: 200 }),
      chaosIs(read.body, ZERO_CHAOS, 'la respuesta trae'),
    ]);
  });
};

// --- Esquema 2: la cabecera x-tenant no cambia la configuración que se lee -----------------------------------------------------

const headerDoesNotChangeReading: ApiRowHandler = async (row) => {
  const header = strict('cabecera', HEADERS, cell(row, 'cabecera'));
  return withRestore([TENANT_A, TENANT_B], async () => {
    await prepareTenant(TENANT_A);
    await prepareTenant(TENANT_B);
    const adminB = await adminAccess(TENANT_B);
    const fixed = await withToken('PATCH', '/admin/chaos', TENANT_B, adminB, SET_CHAOS);
    if (fixed.status !== 200) return preparationFailed('la respuesta es 200 y alumno02 tiene el caos fijado', 'alumno02@sigpro.lab fija con PATCH latencyMs 400, errorRate 0.5 y flakyLabels true', fixed);
    const adminA = await adminAccess(TENANT_A);
    const read = await withToken('GET', '/admin/chaos', header, adminA);
    const config = await call('GET', '/config', { tenant: header });
    return rowOutcome([
      expectCheck(read, 'la respuesta es 200', { status: 200 }),
      chaosIs(read.body, ZERO_CHAOS, 'la respuesta trae'),
      expectCheck(config, 'GET /api/config con la cabecera x-tenant alumno02 responde 200', { status: 200 }),
      chaosIs(field(config.body, 'chaos'), SET_CHAOS, 'GET /api/config con la cabecera x-tenant alumno02 devuelve el campo chaos con'),
    ]);
  });
};

// --- Esquema 3: un cambio parcial conserva los demás campos --------------------------------------------------------------------

const partialChangeKeepsOthers: ApiRowHandler = async (row) => {
  const body = strict('cuerpo', BODIES, cell(row, 'cuerpo'));
  const rate = strict('tasa', RATES, cell(row, 'tasa'));
  const flaky = strict('textos', FLAKY, cell(row, 'textos'));
  const expected = `la respuesta es 200 con latencyMs 400, errorRate ${rate} y flakyLabels ${String(flaky)}`;
  return withRestore([TENANT_A], async () => {
    await prepareTenant(TENANT_A);
    const token = await adminAccess(TENANT_A);
    const preset = await withToken('PATCH', '/admin/chaos', TENANT_A, token, { latencyMs: 400, flakyLabels: true });
    if (preset.status !== 200) return preparationFailed(expected, 'alumno01@sigpro.lab fija con PATCH latencyMs 400 y flakyLabels true', preset);
    const patched = await withToken('PATCH', '/admin/chaos', TENANT_A, token, body);
    const read = await withToken('GET', '/admin/chaos', TENANT_A, token);
    const expectedValues = { latencyMs: 400, errorRate: rate, flakyLabels: flaky };
    // Regla: cada cambio aplicado queda en la auditoría del tenant con la acción chaos.updated (un cuerpo vacío no cambia nada)
    const changes = Object.keys(body as object).length > 0;
    const audit = changes ? await newestAuditAction(TENANT_A, token) : undefined;
    const auditChecks = changes
      ? [check(audit === 'chaos.updated', 'el cambio queda en la auditoría del tenant con la acción chaos.updated', `la entrada más reciente de la auditoría tiene la acción ${shown(audit)}`)]
      : [];
    return rowOutcome([
      expectCheck(patched, 'la respuesta es 200', { status: 200 }),
      chaosIs(patched.body, expectedValues, 'la respuesta trae'),
      expectCheck(read, 'GET /api/admin/chaos responde 200', { status: 200 }),
      chaosIs(read.body, expectedValues, 'GET /api/admin/chaos devuelve'),
      ...auditChecks,
    ]);
  });
};

// --- Esquema 4: un valor fuera de rango o de otro tipo no se guarda -----------------------------------------------------------

const invalidValueRejected: ApiRowHandler = async (row) => {
  const body = strict('cuerpo', BODIES, cell(row, 'cuerpo'));
  const campo = strict('campo', CHAOS_FIELDS, cell(row, 'campo'));
  return withRestore([TENANT_A], async () => {
    await prepareTenant(TENANT_A);
    const token = await adminAccess(TENANT_A);
    const rejected = await withToken('PATCH', '/admin/chaos', TENANT_A, token, body);
    const reason = errorsOf(rejected)[campo];
    const read = await withToken('GET', '/admin/chaos', TENANT_A, token);
    return rowOutcome([
      expectCheck(rejected, `la respuesta es 422 validation_failed con un motivo para ${campo}`, { status: 422, code: 'validation_failed' }),
      check(typeof reason === 'string' && reason !== '', `un motivo para ${campo} en errors`, `motivo para ${campo}: ${typeof reason === 'string' ? 'sí' : 'no'} (errors: ${Object.keys(errorsOf(rejected)).join(', ') || '(vacío)'})`),
      expectCheck(read, 'GET /api/admin/chaos responde 200', { status: 200 }),
      chaosIs(read.body, ZERO_CHAOS, 'GET /api/admin/chaos devuelve'),
    ]);
  });
};

// --- Esquema 5: un valor en el límite se guarda --------------------------------------------------------------------------------

const boundaryValueSaved: ApiRowHandler = async (row) => {
  const body = strict('cuerpo', BODIES, cell(row, 'cuerpo'));
  const campo = strict('campo', CHAOS_FIELDS, cell(row, 'campo'));
  const valor = strict('valor', BOUNDARY_VALUES, cell(row, 'valor'));
  const expected = `la respuesta es 200 con ${campo} igual a ${String(valor)}`;
  return withRestore([TENANT_A], async () => {
    await prepareTenant(TENANT_A);
    const token = await adminAccess(TENANT_A);
    const saved = await withToken('PATCH', '/admin/chaos', TENANT_A, token, body);
    const observed = field(saved.body, campo);
    // Regla: el cambio guardado queda en la auditoría del tenant con la acción chaos.updated
    const audit = saved.status === 200 ? await newestAuditAction(TENANT_A, token) : undefined;
    return rowOutcome([
      expectCheck(saved, 'la respuesta es 200', { status: 200 }),
      check(observed === valor, expected, `la respuesta trae ${campo} igual a ${shown(observed)}`),
      check(audit === 'chaos.updated', 'el cambio queda en la auditoría del tenant con la acción chaos.updated', `la entrada más reciente de la auditoría tiene la acción ${shown(audit)}`),
    ]);
  });
};

// --- Esquema 6: la configuración guardada aparece en la configuración pública del tenant --------------------------------------

const savedShownInConfig: ApiRowHandler = async (row) => {
  const header = strict('cabecera', HEADERS, cell(row, 'cabecera'));
  return withRestore([TENANT_A], async () => {
    await prepareTenant(TENANT_A);
    const token = await adminAccess(TENANT_A);
    const preset = await withToken('PATCH', '/admin/chaos', TENANT_A, token, SET_CHAOS);
    if (preset.status !== 200) return preparationFailed('el campo chaos tiene latencyMs 400, errorRate 0.5 y flakyLabels true', 'alumno01@sigpro.lab fija con PATCH latencyMs 400, errorRate 0.5 y flakyLabels true', preset);
    const config = await call('GET', '/config', { tenant: header });
    return rowOutcome([
      expectCheck(config, 'GET /api/config responde 200', { status: 200 }),
      chaosIs(field(config.body, 'chaos'), SET_CHAOS, 'el campo chaos de la respuesta tiene'),
    ]);
  });
};

defineApiRows({
  story: 'US-CAOS-RESET-006',
  surface: 'api',
  tenants: [TENANT_A, TENANT_B],
  handlers: new Map<number, ApiRowHandler>([
    [1, readsRestValues],
    [2, headerDoesNotChangeReading],
    [3, partialChangeKeepsOthers],
    [4, invalidValueRejected],
    [5, boundaryValueSaved],
    [6, savedShownInConfig],
  ]),
});
