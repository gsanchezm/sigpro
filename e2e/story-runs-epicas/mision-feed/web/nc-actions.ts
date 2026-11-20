import { waitUntil } from '../../support/browser';
import { check, parseResponse, responseCheck, type Check } from '../../support/checks';
import type { ApiResult } from '../../../story-runs/support/api';
import { commentNc, createNc, patchNcSeverity, transitionNc, TENANT_A } from '../api/common';
import { settle, SHOW_CEILING_MS, type RealtimeLink } from './common';

// Cambios de no conformidades que las historias de cifras en vivo nombran (web y móvil). Cada uno con la llamada exacta, el evento
// que emite (si emite alguno) y el estado HTTP que responde (la operación rechazada). Lo esperado sale de la historia.

export const DESCRIPCION_PRUEBA = 'Desviación de prueba en la ejecución';

/** Un cambio de NC de la historia. */
export interface NcAct {
  readonly run: (token: string) => Promise<ApiResult>;
  /** Tipo del evento que la historia dice que llega; `undefined` si la operación no emite ninguno. */
  readonly eventType?: string;
  /** Estado HTTP que la historia dice que responde la operación (la rechazada, 409). */
  readonly status?: number;
}

const TENANT = TENANT_A;

export const ACCION_NC: ReadonlyMap<string, NcAct> = new Map<string, NcAct>([
  [
    `alumno01@sigpro.lab crea con POST /api/nc una no conformidad en PRG-002 con severidad minor y la descripción \`${DESCRIPCION_PRUEBA}\``,
    { run: (token) => createNc(token, TENANT, 'minor', DESCRIPCION_PRUEBA), eventType: 'nc_created' },
  ],
  [
    `alumno01@sigpro.lab crea con POST /api/nc una no conformidad en PRG-002 con severidad major y la descripción \`${DESCRIPCION_PRUEBA}\``,
    { run: (token) => createNc(token, TENANT, 'major', DESCRIPCION_PRUEBA), eventType: 'nc_created' },
  ],
  [
    `alumno01@sigpro.lab crea con POST /api/nc una no conformidad en PRG-002 con severidad critical y la descripción \`${DESCRIPCION_PRUEBA}\``,
    { run: (token) => createNc(token, TENANT, 'critical', DESCRIPCION_PRUEBA), eventType: 'nc_created' },
  ],
  ['alumno01@sigpro.lab pasa NC-001 a in_analysis con POST /api/nc/NC-001/transition', { run: (token) => transitionNc(token, TENANT, 'NC-001', 'in_analysis'), eventType: 'nc_moved' }],
  ['alumno01@sigpro.lab pasa NC-002 a rejected con POST /api/nc/NC-002/transition', { run: (token) => transitionNc(token, TENANT, 'NC-002', 'rejected'), eventType: 'nc_moved' }],
  [
    'alumno01@sigpro.lab cierra NC-003 con POST /api/nc/NC-003/transition, to closed y el comentario `Acción correctiva verificada por calidad`',
    { run: (token) => transitionNc(token, TENANT, 'NC-003', 'closed', 'Acción correctiva verificada por calidad'), eventType: 'nc_closed' },
  ],
  [
    'alumno01@sigpro.lab pide pasar NC-001 a rejected desde open con POST /api/nc/NC-001/transition, que la API rechaza',
    { run: (token) => transitionNc(token, TENANT, 'NC-001', 'rejected'), status: 409 },
  ],
  ['alumno01@sigpro.lab cambia la gravedad de NC-001 a critical con PATCH /api/nc/NC-001', { run: (token) => patchNcSeverity(token, TENANT, 'NC-001', 'critical'), eventType: 'nc_updated' }],
  ['alumno01@sigpro.lab añade a NC-006 el comentario `Seguimiento de prueba` con POST /api/nc/NC-006/comments', { run: (token) => commentNc(token, TENANT, 'NC-006', 'Seguimiento de prueba'), eventType: 'nc_commented' }],
]);

/** La acción de la historia por el texto de su celda. Lanza si la celda no tiene acción: nunca devuelve `undefined` (no es un «no hacer nada»). */
export const accionNc = (texto: string): NcAct => {
  const act = ACCION_NC.get(texto);
  if (act === undefined) throw new Error(`celda sin interpretación: acción de NC «${texto}»`);
  return act;
};

/** Ejecuta el cambio: espera (con techo) el evento que la historia dice que llega, o asienta la pantalla si no debe llegar ninguno. */
export const performNc = async (link: RealtimeLink, act: NcAct, token: string): Promise<{ readonly result: ApiResult; readonly arrived: boolean }> => {
  const before = link.eventTypes().length;
  const result = await act.run(token);
  if (act.eventType === undefined) {
    await settle();
    return { result, arrived: false };
  }
  const wanted = act.eventType;
  const arrived = await waitUntil(async () => link.eventTypes().slice(before).includes(wanted), SHOW_CEILING_MS);
  return { result, arrived: arrived.reached };
};

/** Respuesta del cambio que la historia da por hecha: 2xx, o el estado de la operación rechazada. */
export const actionCheck = (result: ApiResult, act: NcAct, nombre: string): Check =>
  act.status === undefined
    ? check(result.status >= 200 && result.status < 300, `${nombre} se acepta (2xx)`, `${nombre} responde ${result.status}`)
    : responseCheck(result, parseResponse(`${act.status} invalid_transition`));
