/**
 * Origen de Socket.IO: el de la API sin `/api` (la web es un sitio estático en Render y la API vive en otro dominio).
 * Con la API relativa de desarrollo (`/api`, proxy de Vite) es el de la propia página, y Vite reenvía `/socket.io`.
 */
export const socketOrigin = (apiUrl: string, pageHref: string): string => new URL(apiUrl, pageHref).origin;
