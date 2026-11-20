import { TENANT_A } from '../../../story-runs/support/prepare';
import { cell, check, strict } from '../../support/checks';
import { defineApiRows, type ApiRowHandler } from '../../core/framework';
import { bodyOf, prepareAlumno, raw, show, statusCheck, judge } from './common';

// US-API-PLATAFORMA-001 — Comprobar que el servicio responde sin autenticación. Preparación de cada fila: alumno01 reiniciado y con el
// caos apagado (common.ts). El esperado sale de la historia; la respuesta, de la API.

// --- Esquema 1: el servicio responde 200 con cualquier cabecera o sin ninguna --------------------------------------------------

const HEADERS: ReadonlyMap<string, Readonly<Record<string, string>>> = new Map<string, Readonly<Record<string, string>>>([
  ['(sin cabeceras)', {}],
  ['Authorization Bearer token-inventado', { authorization: 'Bearer token-inventado' }],
  ['x-tenant noexiste', { 'x-tenant': 'noexiste' }],
]);

const healthWithHeader: ApiRowHandler = async (row) => {
  const headers = strict('cabecera', HEADERS, cell(row, 'cabecera'));
  await prepareAlumno();
  const first = await raw('GET', '/api/health', { headers });
  const second = await raw('GET', '/api/health', { headers });
  const body = bodyOf(first);
  const uptime = body.uptime;
  const uptimeAfter = bodyOf(second).uptime;
  return judge([
    statusCheck(first, 200),
    check(body.status === 'ok', 'status «ok»', `status ${show(body.status)}`),
    check(typeof uptime === 'number' && Number.isInteger(uptime) && uptime >= 0, 'uptime entero no negativo', `uptime ${show(uptime)}`),
    // Regla de la historia: el uptime no baja entre dos peticiones seguidas (no la da por hecha ningún Esquema, pero es una regla de la ruta)
    check(
      typeof uptime === 'number' && typeof uptimeAfter === 'number' && uptimeAfter >= uptime,
      'el uptime no baja entre dos peticiones seguidas',
      `uptime ${show(uptime)} y después ${show(uptimeAfter)}`,
    ),
  ]);
};

// --- Esquema 2: sin el prefijo /api la ruta no existe ----------------------------------------------------------------------------

const ROUTES_WITHOUT_PREFIX: ReadonlyMap<string, string> = new Map<string, string>([
  ['/health', '/health'],
  ['/api/salud', '/api/salud'],
]);

const withoutPrefix: ApiRowHandler = async (row) => {
  const route = strict('ruta', ROUTES_WITHOUT_PREFIX, cell(row, 'ruta'));
  await prepareAlumno();
  const res = await raw('GET', route);
  return judge([statusCheck(res, 404), check(bodyOf(res).error === 'Not Found', 'error «Not Found»', `error ${show(bodyOf(res).error)}`)]);
};

defineApiRows({
  story: 'US-API-PLATAFORMA-001',
  surface: 'api',
  tenants: [TENANT_A],
  handlers: new Map<number, ApiRowHandler>([
    [1, healthWithHeader],
    [2, withoutPrefix],
  ]),
});
