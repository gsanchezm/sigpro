import { DEMO } from '../../../story-runs/support/prepare';
import { defineApiRows, type ApiRowHandler, type ManifestRow } from '../../core/framework';
import { cell, check, preparationFailed, strict, type Check } from '../../support/checks';
import { ACCOUNT_CELLS, NC003_DESCRIPTION, NC003_SEED, TENANT_A, actorOf, answerChecks, detailNc, fieldCheck, fieldsOf, patchNc, resetTenants, sameFields, showValue, verdict, type Expect, type NcFields } from './common';

// US-NC-GESTION-003 — Edición de la severidad, la descripción o la asignación por la API (PATCH /api/nc/:code). Preparación de cada fila:
// reinicio de alumno01 con el token de su administrador; después la cuenta de la fila inicia sesión en alumno01. Las lecturas de «sin
// cambios» se hacen con gestor@sigpro.test (el GET no exige permiso). NC-003 del seed: critical, descripción del seed, u4 (Andrés Molina).

const GESTOR = DEMO.gestor;

/** Campos del cuerpo que la celda «cuerpo» envía (la celda es el JSON literal de la historia). `undefined` = cuerpo vacío (sin cuerpo). */
const BODY_CELLS: ReadonlyMap<string, Readonly<Record<string, unknown>> | undefined> = new Map<string, Readonly<Record<string, unknown>> | undefined>([
  ['{"severity": "minor"}', { severity: 'minor' }],
  ['{"assigneeId": "u3"}', { assigneeId: 'u3' }],
  ['{"assigneeId": null}', { assigneeId: null }],
  ['{"severity": "critical"}', { severity: 'critical' }],
  ['(vacío)', undefined],
]);

/** Lo que la historia espera en la respuesta de cada celda; `severity`, `assigneeId` y `assigneeName` solo si la historia los nombra. */
interface PatchExpect extends Expect {
  readonly severity?: string;
  readonly assigneeId?: string | null;
  readonly assigneeName?: string | null;
}

const PATCH_RESPONSE_CELLS: ReadonlyMap<string, PatchExpect> = new Map<string, PatchExpect>([
  ['200 con severity minor y el resto de datos sin cambios', { status: 200, severity: 'minor' }],
  ['200 con assigneeId u3 y assigneeName Lucía Fernández', { status: 200, assigneeId: 'u3', assigneeName: 'Lucía Fernández' }],
  ['200 con assigneeId null y assigneeName null', { status: 200, assigneeId: null, assigneeName: null }],
  ['200 con severity critical, igual que antes', { status: 200, severity: 'critical' }],
]);

/** Campos que cada clave del cuerpo cambia (los demás deben quedar como estaban). */
const CHANGED_BY_KEY: Readonly<Record<string, readonly (keyof NcFields)[]>> = {
  severity: ['severity'],
  assigneeId: ['assigneeId', 'assigneeName'],
  description: ['description'],
};

const ROLE_CODE_CELLS: ReadonlyMap<string, string> = new Map<string, string>([
  ['NC-003', 'NC-003'],
  ['NC-999', 'NC-999'],
]);

const FORBIDDEN_OR_MISSING: ReadonlyMap<string, Expect> = new Map<string, Expect>([
  ['403 forbidden', { status: 403, code: 'forbidden' }],
  ['404 nc_not_found', { status: 404, code: 'nc_not_found' }],
]);

const FIELD_CELLS: ReadonlyMap<string, string> = new Map<string, string>([
  ['severity', 'severity'],
  ['description', 'description'],
  ['assigneeId', 'assigneeId'],
]);

const VALUE_CELLS: ReadonlyMap<string, string> = new Map<string, string>([
  ['enorme', 'enorme'],
  ['(9 letras a)', 'a'.repeat(9)],
  ['(10 letras a)', 'a'.repeat(10)],
  ['(11 letras a)', 'a'.repeat(11)],
  ['u99', 'u99'],
]);

const VALUE_RESPONSE_CELLS: ReadonlyMap<string, Expect & { readonly description?: string }> = new Map<string, Expect & { readonly description?: string }>([
  ['422 validation_failed con el motivo severityRequired en severity', { status: 422, code: 'validation_failed', errorField: 'severity', errorKey: 'severityRequired' }],
  ['422 validation_failed con el motivo descShort en description', { status: 422, code: 'validation_failed', errorField: 'description', errorKey: 'descShort' }],
  ['200 con la descripción (10 letras a) como texto', { status: 200, description: 'a'.repeat(10) }],
  ['200 con la descripción (11 letras a) como texto', { status: 200, description: 'a'.repeat(11) }],
  ['422 validation_failed con el motivo badAssignee en assigneeId', { status: 422, code: 'validation_failed', errorField: 'assigneeId', errorKey: 'badAssignee' }],
]);

const EMPTY_RESPONSE: Expect = { status: 422, code: 'validation_failed', errorField: '', errorKey: 'nothingToUpdate' };

/** Estado de NC-003 leído con gestor@sigpro.test (campos de la no conformidad), o `undefined` si la lectura no llega. */
const readNc003 = async (token: string | undefined): Promise<NcFields | undefined> => (token === undefined ? undefined : fieldsOf(await detailNc(token, 'NC-003')));

// --- Esquema 1: un rol con permiso de edición cambia los campos enviados -----------------------------------------------------

const editSentFields: ApiRowHandler = async (row: ManifestRow) => {
  const account = strict('correo', ACCOUNT_CELLS, cell(row, 'correo'));
  const body = strict('cuerpo', BODY_CELLS, cell(row, 'cuerpo'));
  const expect = strict('respuesta', PATCH_RESPONSE_CELLS, cell(row, 'respuesta'));
  const expected = `PATCH /api/nc/NC-003 de ${cell(row, 'correo')} con ${cell(row, 'cuerpo')} → ${cell(row, 'respuesta')}; los demás campos no cambian`;
  await resetTenants([TENANT_A]);
  const actor = await actorOf(account);
  if (actor.token === undefined) return preparationFailed(expected, `${cell(row, 'correo')} inicia sesión con POST /api/auth/login`, actor.last);
  const gestor = await actorOf(GESTOR);
  const before = await readNc003(gestor.token);

  const result = await patchNc(actor.token, 'NC-003', body);
  const after = await readNc003(gestor.token);
  const sent = Object.keys(body ?? {});
  const untouched: (keyof NcFields)[] = (['severity', 'description', 'assigneeId', 'assigneeName', 'programCode', 'state', 'commentCount'] as const).filter(
    (key) => !sent.some((changed) => (CHANGED_BY_KEY[changed] ?? []).includes(key)),
  );
  const fields = fieldsOf(result);
  const checks: Check[] = [
    check(result.status === expect.status, `respuesta ${expect.status}`, `respuesta ${result.status}`),
    ...(expect.severity === undefined ? [] : [fieldCheck('severity', fields?.severity, expect.severity)]),
    ...(expect.assigneeId === undefined ? [] : [fieldCheck('assigneeId', fields?.assigneeId, expect.assigneeId)]),
    ...(expect.assigneeName === undefined ? [] : [fieldCheck('assigneeName', fields?.assigneeName, expect.assigneeName)]),
    check(sameFields(before, fields, untouched), `sin cambios en ${untouched.join(', ')} respecto a antes del PATCH`, (sameFields(before, fields, untouched) ? 'sin cambios en la respuesta respecto a antes del PATCH' : 'campos distintos respecto a antes del PATCH en la respuesta')),
    check(sameFields(before, after, untouched), `sin cambios en ${untouched.join(', ')} en GET /api/nc/NC-003 después`, `GET /api/nc/NC-003 después: ${showValue(after?.severity)} / ${showValue(after?.assigneeName)}`),
    check(after?.description === NC003_DESCRIPTION || sent.includes('description'), `descripción del seed en GET después`, `descripción en GET después: ${showValue(after?.description)}`),
  ];
  // Los campos que la fila no envía deben seguir con los valores del SEED que dice la historia (no solo con los de antes del PATCH)
  checks.push(
    check(
      untouched.every((key) => fields !== undefined && fields[key] !== undefined && String(fields[key]) === String(NC003_SEED[key as keyof typeof NC003_SEED])),
      `los campos no enviados (${untouched.join(', ')}) siguen con los valores del seed (severity critical, ${NC003_SEED.assigneeName}, ${NC003_SEED.state})`,
      untouched.map((key) => `${key} ${showValue(fields?.[key])}`).join('; '),
    ),
  );
  const persisted = sent.includes('severity') ? 'severity' : sent.includes('assigneeId') ? 'assigneeId' : undefined;
  if (persisted !== undefined && after !== undefined) checks.push(fieldCheck(`${persisted} persistido`, after[persisted], fields?.[persisted]));
  return verdict(checks);
};

// --- Esquema 2: el rol auditor no puede editar y una no conformidad inexistente no responde -----------------------------------

const auditorOrMissing: ApiRowHandler = async (row: ManifestRow) => {
  const code = strict('codigo', ROLE_CODE_CELLS, cell(row, 'codigo'));
  const account = strict('correo', ACCOUNT_CELLS, cell(row, 'correo'));
  const expect = strict('respuesta', FORBIDDEN_OR_MISSING, cell(row, 'respuesta'));
  const expected = `PATCH /api/nc/${code} de ${cell(row, 'correo')} con {"severity": "minor"} → ${cell(row, 'respuesta')}; NC-003 sigue con severity critical`;
  await resetTenants([TENANT_A]);
  const actor = await actorOf(account);
  if (actor.token === undefined) return preparationFailed(expected, `${cell(row, 'correo')} inicia sesión con POST /api/auth/login`, actor.last);
  const gestor = await actorOf(GESTOR);
  const result = await patchNc(actor.token, code, { severity: 'minor' });
  const stillCritical = await readNc003(gestor.token);
  return verdict([...answerChecks(expect, result), fieldCheck('severity de NC-003 después', stillCritical?.severity, 'critical')]);
};

// --- Esquema 3: cada campo editado se valida con el mismo motivo que en el alta ----------------------------------------------

const fieldValidation: ApiRowHandler = async (row: ManifestRow) => {
  const field = strict('campo', FIELD_CELLS, cell(row, 'campo'));
  const value = strict('valor', VALUE_CELLS, cell(row, 'valor'));
  const expect = strict('respuesta', VALUE_RESPONSE_CELLS, cell(row, 'respuesta'));
  const expected = `PATCH /api/nc/NC-003 con ${field} = ${cell(row, 'valor')} → ${cell(row, 'respuesta')}`;
  await resetTenants([TENANT_A]);
  const gestor = await actorOf(GESTOR);
  if (gestor.token === undefined) return preparationFailed(expected, `${GESTOR.email} inicia sesión con POST /api/auth/login`, gestor.last);

  const result = await patchNc(gestor.token, 'NC-003', { [field]: value });
  const checks = answerChecks(expect, result);
  if (expect.description !== undefined) checks.push(fieldCheck('description', fieldsOf(result)?.description, expect.description));
  return verdict(checks);
};

// --- Esquema 4: un cuerpo sin campos no cambia la no conformidad ---------------------------------------------------------------

const emptyBody: ApiRowHandler = async (row: ManifestRow) => {
  strict('cuerpo', BODY_CELLS, cell(row, 'cuerpo'));
  const expected = `PATCH /api/nc/NC-003 sin cuerpo → 422 validation_failed con el motivo nothingToUpdate (sin nombre de campo); NC-003 sigue con su severidad, su descripción y su persona responsable`;
  await resetTenants([TENANT_A]);
  const gestor = await actorOf(GESTOR);
  if (gestor.token === undefined) return preparationFailed(expected, `${GESTOR.email} inicia sesión con POST /api/auth/login`, gestor.last);
  const before = await readNc003(gestor.token);

  // Se envía SIN cuerpo (no `{}`): la celda «(vacío)» es un cuerpo vacío
  const result = await patchNc(gestor.token, 'NC-003');
  const after = await readNc003(gestor.token);
  return verdict([
    ...answerChecks(EMPTY_RESPONSE, result),
    check(before !== undefined && after !== undefined && after.severity === 'critical' && after.description === NC003_DESCRIPTION && after.assigneeName === 'Andrés Molina', 'NC-003 con severity critical, la descripción del seed y Andrés Molina después', `NC-003 después: severity ${showValue(after?.severity)}, asignada a ${showValue(after?.assigneeName)}`),
    check(sameFields(before, after, ['severity', 'description', 'assigneeId', 'assigneeName']), 'sin cambios respecto a antes del PATCH', (sameFields(before, after, ['severity', 'description', 'assigneeId', 'assigneeName']) ? 'sin cambios respecto a antes del PATCH' : (sameFields(before, after, ['severity', 'description', 'assigneeId', 'assigneeName']) ? 'sin cambios respecto a antes del PATCH' : (sameFields(before, after, ['severity', 'description', 'assigneeId', 'assigneeName']) ? 'sin cambios respecto a antes del PATCH' : 'con cambios respecto a antes del PATCH')))),
  ], 'La celda «(vacío)» se envía sin cuerpo; el motivo nothingToUpdate va bajo la clave vacía de «errors» (la historia dice que no lleva nombre de campo).');
};

defineApiRows({
  story: 'US-NC-GESTION-003',
  surface: 'api',
  tenants: [TENANT_A],
  handlers: new Map<number, ApiRowHandler>([
    [1, editSentFields],
    [2, auditorOrMissing],
    [3, fieldValidation],
    [4, emptyBody],
  ]),
});
