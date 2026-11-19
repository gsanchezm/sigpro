import { defineApiRows, notExecutable, type ApiRowHandler } from '../../support/framework';
import { TENANT_A } from './common';

// US-REGISTRO-007 — Enviar el correo de verificación con un enlace al pedir acceso y al reenviarlo. Capacidad futura
// (`no-implementada`): hoy la API no envía ningún correo, así que estas filas no se prueban contra la app; cada una devuelve
// `notExecutable` con lo que la historia dice que debe pasar.

const EXPECTED = 'llega a la dirección de la solicitud un mensaje con un enlace de verificación';
const NOT_EXECUTABLE_REASON = 'capacidad futura, no se prueba contra la app';

const futureMail: ApiRowHandler = async () => notExecutable(EXPECTED, NOT_EXECUTABLE_REASON);

defineApiRows({
  story: 'US-REGISTRO-007',
  surface: 'api',
  tenants: [TENANT_A],
  handlers: new Map<number, ApiRowHandler>([[1, futureMail]]),
});
