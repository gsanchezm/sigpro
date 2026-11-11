import { MISSION_SOCKET_EVENT, MISSION_SOCKET_PATH, type MissionEventDto } from '@sigpro/shared';
import { useCallback, useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { socketOrigin } from '../../lib/env';
import { useAuth } from '../../state/auth';
import { CONNECTION_AFTER, TOKEN_RETRY_MS, type MissionConnection, shouldRenewToken } from './mission-socket';

export interface MissionLink {
  readonly connection: MissionConnection;
  /** Abre de nuevo la conexión (botón «Reintentar»). */
  readonly reconnect: () => void;
}

/**
 * Conexión en tiempo real del panel de misión: un socket mientras la pantalla está montada, con el access token vigente en
 * el handshake (se relee en cada conexión). Ante `invalid_token` renueva la sesión y reconecta a mano, como la web.
 * `onReconnected` se llama al volver a conectar tras una caída: los eventos perdidos mientras tanto no llegan después.
 */
export const useMissionSocket = (onEvent: (event: MissionEventDto) => void, onReconnected: () => void): MissionLink => {
  const { status, api, getToken } = useAuth();
  const [connection, setConnection] = useState<MissionConnection>('connecting');
  const [generation, setGeneration] = useState(0);
  // Los manejadores más recientes sin volver a abrir el socket cuando cambia su identidad
  const listener = useRef(onEvent);
  const resync = useRef(onReconnected);
  const connectedBefore = useRef(false);
  useEffect(() => {
    listener.current = onEvent;
    resync.current = onReconnected;
  }, [onEvent, onReconnected]);

  useEffect(() => {
    if (status !== 'authenticated') return;
    let alive = true;
    let retries = 0;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    const socket: Socket = io(socketOrigin(), {
      path: MISSION_SOCKET_PATH,
      transports: ['websocket'],
      // función: se evalúa en cada (re)conexión, así usa siempre el access token vigente
      auth: (provide) => provide({ token: getToken() }),
    });
    const show = (next: MissionConnection) => {
      if (alive) setConnection(next);
    };

    socket.on('connect', () => {
      retries = 0;
      show(CONNECTION_AFTER.connect);
      if (connectedBefore.current && alive) resync.current();
      connectedBefore.current = true;
    });
    socket.on('disconnect', () => show(CONNECTION_AFTER.disconnect));
    socket.io.on('reconnect_attempt', () => show(CONNECTION_AFTER.reconnect_attempt));
    socket.on('connect_error', (error: Error) => {
      show(CONNECTION_AFTER.connect_error);
      if (!shouldRenewToken(error.message, retries)) return;
      retries += 1;
      // Una petición autenticada renueva el access token (con refresh si hace falta); luego se conecta de nuevo
      void api.auth.me().then(
        () => {
          if (alive) retryTimer = setTimeout(() => socket.connect(), TOKEN_RETRY_MS);
        },
        () => undefined,
      );
    });
    socket.on(MISSION_SOCKET_EVENT, (event: MissionEventDto) => {
      if (alive) listener.current(event);
    });

    return () => {
      alive = false;
      clearTimeout(retryTimer);
      socket.close();
    };
  }, [status, api, getToken, generation]);

  const reconnect = useCallback(() => {
    setConnection(CONNECTION_AFTER.manual_retry);
    setGeneration((current) => current + 1);
  }, []);

  return { connection, reconnect };
};
