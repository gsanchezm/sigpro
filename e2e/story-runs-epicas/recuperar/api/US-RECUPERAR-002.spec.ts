import { cell } from '../../support/checks';
import { defineApiRows, notExecutable, type ApiRowHandler } from '../../core/framework';
import { TENANT_A } from './common';

// US-RECUPERAR-002 — Enviar a la cuenta un correo con un enlace de un solo uso válido durante 30 minutos. Capacidad futura
// (`no-implementada`): hoy la API no envía ningún correo, así que estas filas no se prueban contra la app; cada una devuelve
// `notExecutable` con lo que la historia dice que debe pasar.

const NOT_EXECUTABLE_REASON = 'capacidad futura, no se prueba contra la app';

const linkArrives: ApiRowHandler = async (row) =>
  notExecutable(`llega a la dirección de la cuenta ${cell(row, 'correo')} un correo con un enlace de un solo uso válido durante 30 minutos`, NOT_EXECUTABLE_REASON);

const noLink: ApiRowHandler = async (row) => notExecutable(`no llega a ${cell(row, 'correo')} ningún enlace de recuperación`, NOT_EXECUTABLE_REASON);

defineApiRows({
  story: 'US-RECUPERAR-002',
  surface: 'api',
  tenants: [TENANT_A],
  handlers: new Map<number, ApiRowHandler>([
    [1, linkArrives],
    [2, noLink],
  ]),
});
