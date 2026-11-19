import { defineApiRows, type ApiRowHandler } from '../../core/framework';
import { resetTenants } from '../../../story-runs/support/prepare';
import { cell, check, preparationFailed, strict, type Check } from '../../support/checks';
import { ACCOUNT_OF, TENANT_A, TENANT_B, auditOf, bearer, caseOf, executedEventsFor, expectChecks, field, loginAs, runCountOf, runIdsOf, runsById, sendRun, verdict, type Expect, type RunFields } from './common';

// US-VER-EJECUCION-002 — Registro de una ejecución por la API: resultado, notas, efecto en el caso y auditoría. Preparación de cada
// fila: reinicio de alumno01 con su administrador y la cuenta alumno01 en x-tenant alumno01. Las lecturas del efecto (último resultado,
// número de ejecuciones, notas guardadas, auditoría) se hacen después de la respuesta, por la API.

const RESULTADO: ReadonlyMap<string, string> = new Map<string, string>([
  ['pass', 'pass'],
  ['blocked', 'blocked'],
]);

/** E1: una ejecución válida con las notas «Prueba de humo» devuelve la ejecución RUN-051 con sus datos y sin evidencias. */
const valida: ApiRowHandler = async (row) => {
  await resetTenants([TENANT_A]);
  const result = strict('resultado', RESULTADO, cell(row, 'resultado'));
  const session = await loginAs(strict('cuenta', ACCOUNT_OF, 'alumno01@sigpro.lab'));
  if (session.token === undefined) return preparationFailed('alumno01 inicia sesión en alumno01', 'alumno01 no obtiene accessToken en alumno01', session.last);
  const answer = await sendRun({ tenant: TENANT_A, code: 'TC-001', fields: { result, notes: 'Prueba de humo' }, headers: bearer(session.token) });
  const expect: Expect = {
    status: 201,
    runId: 'RUN-051',
    caso: 'TC-001',
    fields: { result, notes: 'Prueba de humo', executedByName: 'Alumno 01' },
    evidencias: [],
  };
  // Regla 002:25: la cabecera x-tenant no cambia el tenant de una petición con token. Con x-tenant de alumno02 la ejecución queda
  // en alumno01 (el tenant del token), y se comprueba por el historial de alumno01.
  const crossed = await sendRun({ tenant: TENANT_B, code: 'TC-001', fields: { result, notes: 'Prueba de humo' }, headers: bearer(session.token) });
  const crossedId = String(field(crossed.body, 'id'));
  const own = await caseOf(session.token);
  const crossCheck = check(crossed.status === 201 && runIdsOf(own).includes(crossedId), 'con x-tenant alumno02 la ejecución queda en alumno01 (el tenant del token)', `con x-tenant alumno02: respuesta ${crossed.status}, ${crossed.status === 201 ? `ejecución ${crossedId} ${runIdsOf(own).includes(crossedId) ? 'en el historial de alumno01' : 'fuera del historial de alumno01'}` : 'sin ejecución creada'}`);
  return verdict([...expectChecks(expect, answer), crossCheck]);
};

/** Texto de notas de una fila: lo que se envía, lo que queda guardado y si la API lo rechaza. */
interface NotasPlan {
  readonly send: string | undefined;
  readonly stored: string;
  readonly rejected: boolean;
}

/** Tamaños de las notas: el texto de 1.000 caracteres con espacios a los lados se recorta antes de contar. */
const LETRAS = (count: number): string => 'a'.repeat(count);

/** Respuesta de cada texto de notas (columna «respuesta» de la E2): creada (201) o rechazada (422 por notesLong). */
const RESPUESTA_NOTAS: ReadonlyMap<string, 'creada' | 'rechazada'> = new Map<string, 'creada' | 'rechazada'>([
  ['201', 'creada'], // strict: 002/E2/respuesta
  ['422 validation_failed con el motivo notesLong en notes', 'rechazada'],
]);

/** Efecto de cada fila de la E2 (columna «efecto»): la frase que la comprobación afirma. */
const EFECTO: ReadonlyMap<string, string> = new Map<string, string>([
  ['la ejecución tiene las notas vacías', 'RUN-051 guarda las notas vacías'], // strict: 002/E2/efecto
  ['la ejecución tiene las notas con 999 letras a', 'RUN-051 guarda 999 letras a'],
  ['la ejecución tiene las notas con 1000 letras a', 'RUN-051 guarda 1000 letras a'],
  ['la ejecución tiene las notas con 1000 letras a, sin los espacios', 'RUN-051 guarda 1000 letras a, sin los espacios'],
  ['no se crea ninguna ejecución', 'no se crea ninguna ejecución (el caso TC-001 sigue con 2)'],
]);

/** E2: cada texto de notas, su respuesta y lo que queda guardado (las notas se recortan; más de 1000 caracteres no se crean). */
const NOTAS: ReadonlyMap<string, NotasPlan> = new Map<string, NotasPlan>([
  ['(sin el campo notes)', { send: undefined, stored: '', rejected: false }],
  ['(999 letras a)', { send: LETRAS(999), stored: LETRAS(999), rejected: false }],
  ['(1000 letras a)', { send: LETRAS(1000), stored: LETRAS(1000), rejected: false }],
  ['(1000 letras a con espacios delante y detrás)', { send: `  ${LETRAS(1000)}  `, stored: LETRAS(1000), rejected: false }],
  ['(1001 letras a)', { send: LETRAS(1001), stored: '', rejected: true }],
]);

/** E2: cada texto de notas. Un rechazo no crea la ejecución; un registro guarda las notas tal como indica la fila. */
const notas: ApiRowHandler = async (row) => {
  await resetTenants([TENANT_A]);
  const plan = strict('notas', NOTAS, cell(row, 'notas'));
  const session = await loginAs(strict('cuenta', ACCOUNT_OF, 'alumno01@sigpro.lab'));
  if (session.token === undefined) return preparationFailed('alumno01 inicia sesión en alumno01', 'alumno01 no obtiene accessToken en alumno01', session.last);
  const fields: RunFields = plan.send === undefined ? { result: 'pass' } : { result: 'pass', notes: plan.send };
  const answer = await sendRun({ tenant: TENANT_A, code: 'TC-001', fields, headers: bearer(session.token) });
  // La respuesta esperada sale de la columna «respuesta» por su mapa estricto; el plan de notas solo dice qué se envía y qué queda
  const kind = strict('respuesta', RESPUESTA_NOTAS, cell(row, 'respuesta'));
  const expect: Expect = kind === 'rechazada'
    ? { status: 422, code: 'validation_failed', errors: { notes: 'notesLong' } }
    : { status: 201, runId: 'RUN-051', caso: 'TC-001', fields: { notes: plan.stored } };
  const after = await caseOf(session.token);
  const saved = runsById(after).get('RUN-051');
  // El efecto de la fila (columna «efecto») se lee por su mapa estricto y es la frase que la comprobación afirma
  const efecto = strict('efecto', EFECTO, cell(row, 'efecto'));
  const persisted: Check = plan.rejected
    ? check(runCountOf(after) === 2, efecto, `el caso TC-001 con ${String(runCountOf(after))} ejecuciones`)
    : check(saved !== undefined && saved.notes === plan.stored, efecto, saved === undefined ? 'RUN-051 no está en el historial' : `RUN-051 guarda notas de ${String(saved.notes).length} caracteres`);
  return verdict([...expectChecks(expect, answer), persisted]);
};

/** E3: un resultado ausente, vacío o que no es pass, blocked ni fail responde 422 y no crea ninguna ejecución. */
const RESULTADO_NO_VALIDO: ReadonlyMap<string, Readonly<RunFields>> = new Map<string, Readonly<RunFields>>([
  ['(sin el campo result)', {}],
  ['el campo result (vacío)', { result: '' }],
  ['el campo result Superado', { result: 'Superado' }],
]);

const noValido: ApiRowHandler = async (row) => {
  await resetTenants([TENANT_A]);
  const fields = strict('cuerpo', RESULTADO_NO_VALIDO, cell(row, 'cuerpo'));
  const session = await loginAs(strict('cuenta', ACCOUNT_OF, 'alumno01@sigpro.lab'));
  if (session.token === undefined) return preparationFailed('alumno01 inicia sesión en alumno01', 'alumno01 no obtiene accessToken en alumno01', session.last);
  const answer = await sendRun({ tenant: TENANT_A, code: 'TC-001', fields, headers: bearer(session.token) });
  const expect: Expect = { status: 422, code: 'validation_failed', errors: { result: 'resultRequired' } };
  const after = await caseOf(session.token);
  const kept = check(runCountOf(after) === 2, 'el caso TC-001 sigue con 2 ejecuciones', `el caso TC-001 con ${String(runCountOf(after))} ejecuciones`);
  return verdict([...expectChecks(expect, answer), kept]);
};

/** E4: TC-001 tiene 2 ejecuciones y la última es blocked (RUN-002); una ejecución aceptada pasa a ser la última del caso. */
const ultima: ApiRowHandler = async (row) => {
  await resetTenants([TENANT_A]);
  const result = strict('resultado', RESULTADO, cell(row, 'resultado'));
  const ultimo = strict('ultimo', RESULTADO, cell(row, 'ultimo'));
  const session = await loginAs(strict('cuenta', ACCOUNT_OF, 'alumno01@sigpro.lab'));
  if (session.token === undefined) return preparationFailed('alumno01 inicia sesión en alumno01', 'alumno01 no obtiene accessToken en alumno01', session.last);
  const before = await caseOf(session.token);
  if (runCountOf(before) !== 2 || runIdsOf(before)[0] !== 'RUN-002' || field(before.body, 'lastResult') !== 'blocked') {
    return preparationFailed('TC-001 tiene 2 ejecuciones y su última es blocked (RUN-002)', `TC-001: ${String(runCountOf(before))} ejecuciones, primera ${runIdsOf(before)[0] ?? '(ninguna)'}, último ${String(field(before.body, 'lastResult'))}`, before);
  }
  const answer = await sendRun({ tenant: TENANT_A, code: 'TC-001', fields: { result }, headers: bearer(session.token) });
  const after = await caseOf(session.token);
  const checks = [
    ...expectChecks({ status: 201, runId: 'RUN-051' }, answer),
    check(field(after.body, 'lastResult') === ultimo, `último resultado ${ultimo}`, `último resultado ${String(field(after.body, 'lastResult'))}`),
    check(runCountOf(after) === 3, 'número de ejecuciones 3', `número de ejecuciones ${String(runCountOf(after))}`),
    check(runIdsOf(after)[0] === 'RUN-051', 'RUN-051 como la primera del historial', `primera del historial ${runIdsOf(after)[0] ?? '(ninguna)'}`),
  ];
  // Con un resultado igual al último del seed (blocked), la cabecera no distingue: se confirma con runCount y con RUN-051 como primera
  const note = result === ultimo ? 'La fila no distingue por lastResult: el último resultado del seed ya es «blocked»; se confirma con runCount 3 y RUN-051 como primera del historial.' : undefined;
  return verdict(checks, note);
};

/** Respuesta de la E5 (201 con RUN-051, o el 422 de un resultado ausente). */
const RESPUESTA_E5: ReadonlyMap<string, Expect> = new Map<string, Expect>([
  ['201', { status: 201, runId: 'RUN-051' }],
  ['422 validation_failed con el motivo resultRequired en result', { status: 422, code: 'validation_failed', errors: { result: 'resultRequired' } }],
]);

const AUDITORIA: ReadonlyMap<string, 'evento' | 'ninguno'> = new Map<string, 'evento' | 'ninguno'>([
  ['tiene un evento testrun.executed sobre RUN-051', 'evento'],
  ['no recibe ningún evento nuevo', 'ninguno'],
]);

const CUERPO_E5: ReadonlyMap<string, Readonly<RunFields>> = new Map<string, Readonly<RunFields>>([
  ['el campo result pass', { result: 'pass' }],
  ['(sin el campo result)', {}],
]);

/** E5: una ejecución aceptada deja un evento testrun.executed sobre RUN-051; un rechazo no deja ninguno. Se compara la auditoría antes y después. */
const auditoria: ApiRowHandler = async (row) => {
  await resetTenants([TENANT_A]);
  const expect = strict('respuesta', RESPUESTA_E5, cell(row, 'respuesta'));
  const want = strict('auditoria', AUDITORIA, cell(row, 'auditoria'));
  const fields = strict('cuerpo', CUERPO_E5, cell(row, 'cuerpo'));
  const session = await loginAs(strict('cuenta', ACCOUNT_OF, 'alumno01@sigpro.lab'));
  if (session.token === undefined) return preparationFailed('alumno01 inicia sesión en alumno01', 'alumno01 no obtiene accessToken en alumno01', session.last);
  const before = await auditOf(session.token, 'entity=testrun&limit=100');
  if (before === undefined) return preparationFailed('la auditoría de ejecuciones es legible con el administrador', 'GET /api/audit no responde 200', session.last);
  const answer = await sendRun({ tenant: TENANT_A, code: 'TC-001', fields, headers: bearer(session.token) });
  const after = await auditOf(session.token, 'entity=testrun&limit=100');
  const delta = after === undefined ? undefined : after.total - before.total;
  const events = after === undefined ? undefined : executedEventsFor(after, 'RUN-051');
  const audit: Check =
    want === 'evento'
      ? check(delta === 1 && events === 1, 'la auditoría crece en 1 con un evento testrun.executed sobre RUN-051', `auditoría ${delta === undefined ? '(no legible)' : `crece en ${delta}`}, eventos testrun.executed sobre RUN-051: ${events ?? '(no legible)'}`)
      : check(delta === 0, 'ningún evento nuevo en la auditoría de ejecuciones', `auditoría ${delta === undefined ? '(no legible)' : `crece en ${delta}`}`);
  return verdict([...expectChecks(expect, answer), audit]);
};

defineApiRows({
  story: 'US-VER-EJECUCION-002',
  surface: 'api',
  tenants: [TENANT_A],
  handlers: new Map<number, ApiRowHandler>([
    [1, valida],
    [2, notas],
    [3, noValido],
    [4, ultima],
    [5, auditoria],
  ]),
});
