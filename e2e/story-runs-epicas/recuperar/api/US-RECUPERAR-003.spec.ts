import { cell } from '../../support/checks';
import { defineApiRows, notExecutable, type ApiRowHandler } from '../../core/framework';
import { TENANT_A } from './common';

// US-RECUPERAR-003 — Restablecer la contraseña con el enlace de un solo uso (transversal, capacidad futura: `no-implementada`). Hoy no
// hay pantalla, ruta ni endpoint para usar el enlace, así que estas filas no se prueban contra la app; cada una devuelve `notExecutable`
// con lo que la historia dice que debe pasar. Sus filas van en la superficie `api` porque la historia es transversal.

const NOT_EXECUTABLE_REASON = 'capacidad futura, no se prueba contra la app';

const withinTerm: ApiRowHandler = async (row) =>
  notExecutable(`${cell(row, 'resultado')} (enlace usado a los ${cell(row, 'minutos')} minutos del envío)`, NOT_EXECUTABLE_REASON);

const oneUseOnly: ApiRowHandler = async (row) => notExecutable(`el enlace no permite establecer otra contraseña (${cell(row, 'contraseña_nueva')})`, NOT_EXECUTABLE_REASON);

defineApiRows({
  story: 'US-RECUPERAR-003',
  surface: 'api',
  tenants: [TENANT_A],
  handlers: new Map<number, ApiRowHandler>([
    [1, withinTerm],
    [2, oneUseOnly],
  ]),
});
