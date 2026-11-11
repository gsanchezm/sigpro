// Reglas puras de la conexión en tiempo real del panel (sin React ni socket.io): qué estado muestra el indicador y cuándo
// renovar el token. El hook `use-mission-socket.ts` aplica estas reglas a la conexión real.

export type MissionConnection = 'connected' | 'connecting' | 'disconnected';

/** Fases del socket que cambian el indicador (mapa de despacho, sin `switch`). */
export type SocketPhase = 'connect' | 'disconnect' | 'connect_error' | 'reconnect_attempt' | 'manual_retry';

export const CONNECTION_AFTER: Readonly<Record<SocketPhase, MissionConnection>> = {
  connect: 'connected',
  disconnect: 'disconnected',
  connect_error: 'disconnected',
  reconnect_attempt: 'connecting',
  manual_retry: 'connecting',
};

/** Cuántas veces se renueva el token seguido antes de rendirse hasta que el usuario pulse «Reintentar». */
export const MAX_TOKEN_RETRIES = 3;
/** Espera antes de reconectar tras renovar el token (ms). */
export const TOKEN_RETRY_MS = 1500;

/**
 * El servidor rechaza el handshake con `invalid_token` cuando el access token caducó. Socket.IO no reintenta solo en ese
 * caso: hay que renovar la sesión (una petición autenticada refresca el token) y conectar de nuevo a mano.
 */
export const shouldRenewToken = (errorMessage: string, retriesSoFar: number): boolean => errorMessage === 'invalid_token' && retriesSoFar < MAX_TOKEN_RETRIES;
