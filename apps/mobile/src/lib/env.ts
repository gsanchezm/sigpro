import { Platform } from 'react-native';

// Configuración de la app. `EXPO_PUBLIC_*` se incrusta en el bundle al compilar (ver scripts/expo.mjs).
//  - Web y simulador de iOS: `http://localhost:3000/api` funciona tal cual.
//  - Emulador de Android: `http://10.0.2.2:3000/api`. Dispositivo físico: la IP de tu máquina en la red local.

export const API_URL: string = (process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000/api').replace(/\/+$/, '');

/** Tenant por defecto (como `VITE_TENANT` en la web). */
export const DEFAULT_TENANT: string = process.env.EXPO_PUBLIC_TENANT ?? 'demo';

/** Tenant de la URL (`/login?tenant=alumno01`): solo existe en la versión web. */
export const tenantFromUrl = (): string | null => {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
  return new URLSearchParams(window.location.search).get('tenant')?.trim() || null;
};

/** Origen de Socket.IO: el de la API sin `/api` (el prefijo no aplica a los sockets). */
export const socketOrigin = (apiUrl: string = API_URL): string => new URL(apiUrl).origin;
