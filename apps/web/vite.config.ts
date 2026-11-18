import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv, type Plugin } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// WEB_PORT permite levantar una segunda pila (p. ej. 5174) sin pisar la que ya esté en marcha
const WEB_PORT = Number(process.env.WEB_PORT ?? 5173);
const API_TARGET = process.env.API_PROXY_TARGET ?? 'http://localhost:3000';
// Socket.IO (panel de misión) comparte origen con la API en desarrollo: `/socket.io` con soporte de WebSocket
const proxy = { '/api': { target: API_TARGET, changeOrigin: true }, '/socket.io': { target: API_TARGET, changeOrigin: true, ws: true } };

/** `User-agent: *` + `Disallow: /`: prohíbe el rastreo completo. */
const ROBOTS_TXT = 'User-agent: *\nDisallow: /\n';
const NOINDEX_META = '<meta name="robots" content="noindex, nofollow" />';

/**
 * `VITE_NOINDEX=true` (variable de COMPILACIÓN): genera `robots.txt` con Disallow total y añade `<meta name="robots" content="noindex">`
 * al HTML. Sin la variable no cambia nada. El `robots.txt` es un archivo real de `dist/`, así que Render lo sirve antes que la regla
 * de reescritura `/* → /index.html`; la cabecera `X-Robots-Tag` del sitio estático se declara en `render.yaml`.
 */
const noindex = (enabled: boolean): Plugin => ({
  name: 'sigpro-noindex',
  transformIndexHtml: { order: 'post', handler: (html) => (enabled ? html.replace('<head>', `<head>\n    ${NOINDEX_META}`) : html) },
  generateBundle() {
    if (enabled) this.emitFile({ type: 'asset', fileName: 'robots.txt', source: ROBOTS_TXT });
  },
});

export default defineConfig(({ mode }) => {
  // Variables de COMPILACIÓN (`VITE_*`): del entorno de la build (Render) o de un `.env`. Cambiarlas obliga a reconstruir la web.
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  // `VITE_LAB_PUBLIC=false`: laboratorio cerrado. Vite sustituye `__SIGPRO_LAB_PUBLIC__` en todo el código (también en
  // @sigpro/shared) y los textos con credenciales de demo desaparecen del JavaScript publicado; ver packages/shared/src/lab-public.ts
  const labPublic = env.VITE_LAB_PUBLIC !== 'false';

  return {
    define: { __SIGPRO_LAB_PUBLIC__: JSON.stringify(labPublic) },
    plugins: [
      react(),
      tailwindcss(),
      noindex(env.VITE_NOINDEX === 'true'),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['icon.svg'],
        manifest: {
          name: 'SIGPRO',
          short_name: 'SIGPRO',
          description: 'Sistema integral de gestión de programas',
          lang: 'es',
          theme_color: '#141017',
          background_color: '#141017',
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
  };
});
