import {
  MISSION_SOCKET_EVENT,
  MISSION_SOCKET_PATH,
  NOTIFICATIONS_MAX_ITEMS,
  isNotifiable,
  prependEvent,
  type MissionEventDto,
} from '@sigpro/shared';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { io, type Socket } from 'socket.io-client';
import { API_URL } from '../lib/env';
import { socketOrigin } from '../lib/socket-origin';
import { STORAGE_KEYS, readStorage, writeStorage } from '../lib/storage';
import { useAuth } from './auth';
import { useConfig } from './config';

// Tiempo real (Socket.IO): una sola conexión por sesión, compartida por la campana, la insignia del menú y el panel de
// misión. Los eventos llegan al room del tenant; el JWT viaja en el handshake y se relee en cada reconexión.

export type LiveConnection = 'connecting' | 'live' | 'offline';

/** Lo que cambia poco: el shell (menú lateral) solo se vuelve a pintar cuando varía la conexión o las NC abiertas. */
interface LiveCoreValue {
  readonly connection: LiveConnection;
  /** Preferencia del Perfil: contar los avisos en la campana. */
  readonly liveEnabled: boolean;
  readonly setLiveEnabled: (enabled: boolean) => void;
  /** NC abiertas: valor inicial de la API y, después, el que llega en cada evento `nc_*`. */
  readonly ncOpen: number | null;
}

/** Lo que cambia con cada evento (cada pocos segundos): feed, campana y gráfica de NC. */
interface LiveFeedValue {
  /** Eventos recibidos en esta sesión, el más reciente primero (máx. 50). */
  readonly events: readonly MissionEventDto[];
  /** Avisos (`warn`/`danger`) recibidos en esta sesión, el más reciente primero (máx. 20). */
  readonly notifications: readonly MissionEventDto[];
  readonly unread: number;
  readonly markAllRead: () => void;
  /** NC abiertas por severidad según el último evento `nc_*` (null hasta que llega uno). */
  readonly ncBySeverity: NonNullable<MissionEventDto['ncBySeverity']> | null;
}

type LiveValue = LiveCoreValue & LiveFeedValue;

const LiveCoreContext = createContext<LiveCoreValue | null>(null);
const LiveFeedContext = createContext<LiveFeedValue | null>(null);

const INVALID_TOKEN_RETRY_MS = 1500;
const MAX_TOKEN_RETRIES = 3;

export const LiveProvider = ({ children }: { children: ReactNode }) => {
  const { status, api, getToken } = useAuth();
  const { plantedBugs } = useConfig();
  const [connection, setConnection] = useState<LiveConnection>('connecting');
  const [events, setEvents] = useState<readonly MissionEventDto[]>([]);
  const [notifications, setNotifications] = useState<readonly MissionEventDto[]>([]);
  const [readSeq, setReadSeq] = useState(0);
  const [ncOpen, setNcOpen] = useState<number | null>(null);
  const [ncBySeverity, setNcBySeverity] = useState<LiveValue['ncBySeverity']>(null);
  const [liveEnabled, setLiveEnabledState] = useState(() => readStorage(STORAGE_KEYS.live) !== 'off');
  const liveEnabledRef = useRef(liveEnabled);
  liveEnabledRef.current = liveEnabled;

  const setLiveEnabled = useCallback((enabled: boolean) => {
    setLiveEnabledState(enabled);
    writeStorage(STORAGE_KEYS.live, enabled ? 'on' : 'off');
  }, []);

  const onEvent = useCallback((event: MissionEventDto) => {
    setEvents((current) => prependEvent(current, event));
    if (isNotifiable(event) && liveEnabledRef.current) setNotifications((current) => prependEvent(current, event, NOTIFICATIONS_MAX_ITEMS));
    if (event.ncOpen !== undefined) setNcOpen(event.ncOpen);
    if (event.ncBySeverity) setNcBySeverity(event.ncBySeverity);
  }, []);

  // NC abiertas iniciales (insignia del menú) en cuanto hay sesión
  useEffect(() => {
    if (status !== 'authenticated') {
      setNcOpen(null);
      return;
    }
    let alive = true;
    api.mission.summary().then(
      (summary) => alive && setNcOpen((current) => current ?? summary.kpis.ncOpen),
      () => undefined,
    );
    return () => {
      alive = false;
    };
  }, [status, api]);

  // Conexión: se abre al iniciar sesión y se cierra al salir
  useEffect(() => {
    if (status !== 'authenticated') {
      setConnection('connecting');
      setEvents([]);
      setNotifications([]);
      setReadSeq(0);
      return;
    }
    let retries = 0;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    const socket: Socket = io(socketOrigin(API_URL, window.location.href), {
      path: MISSION_SOCKET_PATH,
      transports: ['websocket'],
      // función: se evalúa en cada (re)conexión, así usa siempre el access token vigente
      auth: (provide) => provide({ token: getToken() }),
    });
    socket.on('connect', () => {
      retries = 0;
      setConnection('live');
    });
    socket.on('disconnect', () => setConnection('offline'));
    socket.io.on('reconnect_attempt', () => setConnection('connecting'));
    socket.on('connect_error', (error) => {
      setConnection('offline');
      // Token caducado: una petición autenticada lo renueva (refresh) y se reintenta; el resto lo reintenta Socket.IO
      if (error.message !== 'invalid_token' || retries >= MAX_TOKEN_RETRIES) return;
      retries += 1;
      void api.auth.me().then(
        () => (retryTimer = setTimeout(() => socket.connect(), INVALID_TOKEN_RETRY_MS)),
        () => undefined,
      );
    });
    socket.on(MISSION_SOCKET_EVENT, onEvent);
    return () => {
      if (retryTimer) clearTimeout(retryTimer);
      socket.close();
    };
  }, [status, api, getToken, onEvent]);

  const unread = useMemo(() => notifications.filter((event) => event.seq > readSeq).length, [notifications, readSeq]);

  const markAllRead = useCallback(() => {
    const latest = notifications[0]?.seq ?? readSeq;
    // Defecto plantado (PLANTED_BUGS): «Marcar leídas» deja sin leer el último aviso (off-by-one)
    setReadSeq(plantedBugs ? Math.max(readSeq, latest - 1) : latest);
  }, [notifications, readSeq, plantedBugs]);

  const core = useMemo<LiveCoreValue>(() => ({ connection, liveEnabled, setLiveEnabled, ncOpen }), [connection, liveEnabled, setLiveEnabled, ncOpen]);
  const feed = useMemo<LiveFeedValue>(() => ({ events, notifications, unread, markAllRead, ncBySeverity }), [events, notifications, unread, markAllRead, ncBySeverity]);
  return (
    <LiveCoreContext.Provider value={core}>
      <LiveFeedContext.Provider value={feed}>{children}</LiveFeedContext.Provider>
    </LiveCoreContext.Provider>
  );
};

/** Conexión, preferencia y NC abiertas (cambia poco): lo usa el shell. */
export const useLiveCore = (): LiveCoreValue => {
  const value = useContext(LiveCoreContext);
  if (!value) throw new Error('useLiveCore debe usarse dentro de LiveProvider');
  return value;
};

/** Feed y notificaciones (cambia con cada evento): lo usan la campana y el panel de misión. */
export const useLiveFeed = (): LiveFeedValue => {
  const value = useContext(LiveFeedContext);
  if (!value) throw new Error('useLiveFeed debe usarse dentro de LiveProvider');
  return value;
};

/** Todo junto (se repinta con cada evento). */
export const useLive = (): LiveValue => ({ ...useLiveCore(), ...useLiveFeed() });
