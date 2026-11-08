import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// WEB_PORT permite levantar una segunda pila (p. ej. 5174) sin pisar la que ya esté en marcha
const WEB_PORT = Number(process.env.WEB_PORT ?? 5173);
const API_TARGET = process.env.API_PROXY_TARGET ?? 'http://localhost:3000';
// Socket.IO (panel de misión) comparte origen con la API en desarrollo: `/socket.io` con soporte de WebSocket
const proxy = { '/api': { target: API_TARGET, changeOrigin: true }, '/socket.io': { target: API_TARGET, changeOrigin: true, ws: true } };

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'SIGPRO',
        short_name: 'SIGPRO',
        description: 'Sistema integral de gestión de programas',
        lang: 'es',
        theme_color: '#0d1117',
        background_color: '#0d1117',
        display: 'standalone',
        start_url: '/',
        icons: [{ src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
      },
      // La API y su documentación no deben servirse desde el fallback del service worker
      workbox: { navigateFallbackDenylist: [/^\/api/] },
    }),
  ],
  server: { port: WEB_PORT, strictPort: true, proxy },
  preview: { port: WEB_PORT, strictPort: true, proxy },
});
