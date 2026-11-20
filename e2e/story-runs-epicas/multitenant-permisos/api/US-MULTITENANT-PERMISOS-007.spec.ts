import { call, field, type ApiResult } from '../../../story-runs/support/api';
import { TENANT_A, resetTenants } from '../../../story-runs/support/prepare';
import { cell, check, parseResponse, preparationFailed, responseCheck, strict, type Check } from '../../support/checks';
import { defineApiRows, type ApiRowHandler } from '../../core/framework';
import { ROLE_ACCOUNTS, accessOf, adminOf, conclude, isFailed, runMultipart } from './common';

// US-MULTITENANT-PERMISOS-007: la API decide el permiso. Esta superficie es la API: la parte «desde la interfaz» de cada Esquema NO se
// ejecuta aquí (la cubren 008 y 009 en la web y en la app móvil), y la fila lo declara en su evidencia. Preparación de cada fila: alumno01
// se reinicia con el token de su administrador y la cuenta del rol inicia sesión. Antes de la petición se leen con el administrador el
// recurso de la acción y el total del registro de auditoría; después se vuelven a leer: la llamada no debe cambiar nada ni añadir eventos.

interface Probe {
  readonly status: number;
  readonly body: unknown;
}

type Send = (token: string | undefined) => Promise<ApiResult>;

interface Action {
  readonly send: Send;
  /** Ruta del recurso que la acción tocaría, leída con el token de administrador antes y después. */
  readonly probe: string;
}

const ACTIONS: ReadonlyMap<string, Action> = new Map<string, Action>([
  ['eliminar un programa', { send: (token) => call('DELETE', '/programs/PRG-024', { tenant: TENANT_A, ...(token === undefined ? {} : { token }) }), probe: '/programs/PRG-024' }],
  [
    'aprobar un requisito',
    { send: (token) => call('POST', '/requirements/REQ-017/transition', { tenant: TENANT_A, ...(token === undefined ? {} : { token }), body: { to: 'approved' } }), probe: '/requirements/REQ-017' },
  ],
  [
    'validar un requisito',
    { send: (token) => call('POST', '/requirements/REQ-002/transition', { tenant: TENANT_A, ...(token === undefined ? {} : { token }), body: { to: 'validated' } }), probe: '/requirements/REQ-002' },
  ],
  ['ejecutar un caso de prueba', { send: (token) => runMultipart(TENANT_A, token, 'TC-001'), probe: '/test-cases/TC-001' }],
  [
    'cerrar una no conformidad',
    {
      send: (token) =>
        call('POST', '/nc/NC-003/transition', { tenant: TENANT_A, ...(token === undefined ? {} : { token }), body: { to: 'closed', comment: 'Cierre de prueba de permisos' } }),
      probe: '/nc/NC-003',
    },
  ],
  ['consultar el registro de auditoría', { send: (token) => call('GET', '/audit', { tenant: TENANT_A, ...(token === undefined ? {} : { token }) }), probe: '/audit' }],
  ['listar los usuarios', { send: (token) => call('GET', '/admin/users', { tenant: TENANT_A, ...(token === undefined ? {} : { token }) }), probe: '/admin/users' }],
]);

/** Cabecera Authorization de las filas sin sesión válida: ninguna, o un texto que no es un JWT. */
const CREDENTIALS: ReadonlyMap<string, string | undefined> = new Map<string, string | undefined>([
  ['(sin cabecera)', undefined],
  ['Bearer texto-sin-formato-JWT', 'texto-sin-formato-JWT'],
]);

const NOT_IN_THIS_SURFACE = 'solo por API: la parte «desde la interfaz» de este Esquema no se ejecuta aquí (la cubren 008 y 009)';

const probeRead = async (token: string, path: string): Promise<Probe> => {
  const result = await call('GET', path, { tenant: TENANT_A, token });
  return { status: result.status, body: result.body };
};

const auditTotal = async (token: string): Promise<number> => {
  const result = await call('GET', '/audit', { tenant: TENANT_A, token });
  return Number(field(result.body, 'total'));
};

const sameProbe = (before: Probe, after: Probe): boolean => JSON.stringify(before) === JSON.stringify(after);

/** Lo que no debe cambiar: el recurso de la acción y el total del registro de auditoría. */
const noChange = (path: string, before: Probe, after: Probe, auditBefore: number, auditAfter: number): Check[] => {
  const same = sameProbe(before, after);
  return [
    check(same, `${path} sin cambios`, same ? `${path} sin cambios` : `${path} cambió (estado ${before.status} → ${after.status})`),
    check(auditBefore === auditAfter, 'ningún evento nuevo en el registro de auditoría', `total de auditoría ${auditBefore} → ${auditAfter}`),
  ];
};

const adminToken = async (): Promise<string | { readonly failed: ApiResult }> => {
  const admin = await accessOf(TENANT_A, adminOf(TENANT_A));
  return isFailed(admin) ? { failed: admin.failed } : admin.token;
};

// --- Esquema 1: una acción que el rol no puede hacer no se completa y la API la niega --------------------------------------

const deniedDirectCall: ApiRowHandler = async (row) => {
  const expected = parseResponse(cell(row, 'respuesta'));
  const action = strict('accion', ACTIONS, cell(row, 'accion'));
  const credentials = strict('rol', ROLE_ACCOUNTS, cell(row, 'rol'));
  await resetTenants([TENANT_A]);
  // Todos los tokens se obtienen antes de la primera instantánea: ninguna lectura de inicio de sesión cambia lo que se mide
  const admin = await adminToken();
  if (typeof admin !== 'string') return preparationFailed(cell(row, 'respuesta'), 'administrador de alumno01 inicia sesión', admin.failed);
  const access = await accessOf(TENANT_A, credentials);
  if (isFailed(access)) return preparationFailed(cell(row, 'respuesta'), `el rol ${cell(row, 'rol')} inicia sesión con x-tenant alumno01`, access.failed);
  const before = await probeRead(admin, action.probe);
  const auditBefore = await auditTotal(admin);
  const result = await action.send(access.token);
  const after = await probeRead(admin, action.probe);
  const auditAfter = await auditTotal(admin);
  return conclude([responseCheck(result, expected), ...noChange(action.probe, before, after, auditBefore, auditAfter)], {
    note: NOT_IN_THIS_SURFACE,
    evidence: { rol: cell(row, 'rol'), accion: cell(row, 'accion') },
  });
};

// --- Esquema 2: sin una sesión válida, la llamada directa responde 401 y no 403 -----------------------------------------------

const noSessionCall: ApiRowHandler = async (row) => {
  const expected = parseResponse(cell(row, 'respuesta'));
  const action = strict('accion', ACTIONS, cell(row, 'accion'));
  const token = strict('credencial', CREDENTIALS, cell(row, 'credencial'));
  await resetTenants([TENANT_A]);
  const admin = await adminToken();
  if (typeof admin !== 'string') return preparationFailed(cell(row, 'respuesta'), 'administrador de alumno01 inicia sesión', admin.failed);
  // «El recurso de la acción existe con los datos del seed»: se comprueba con el administrador antes de la llamada sin sesión
  const before = await probeRead(admin, action.probe);
  if (before.status !== 200) return preparationFailed(cell(row, 'respuesta'), `el recurso ${action.probe} existe`, { status: before.status, body: before.body, ms: 0 });
  const auditBefore = await auditTotal(admin);
  const result = await action.send(token);
  const after = await probeRead(admin, action.probe);
  const auditAfter = await auditTotal(admin);
  return conclude([responseCheck(result, expected), ...noChange(action.probe, before, after, auditBefore, auditAfter)], {
    note: NOT_IN_THIS_SURFACE,
    evidence: { credencial: cell(row, 'credencial'), accion: cell(row, 'accion') },
  });
};

defineApiRows({
  story: 'US-MULTITENANT-PERMISOS-007',
  surface: 'api',
  tenants: [TENANT_A],
  handlers: new Map<number, ApiRowHandler>([
    [1, deniedDirectCall],
    [2, noSessionCall],
  ]),
});
