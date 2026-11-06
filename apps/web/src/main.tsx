import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import { App } from './App';
import { adoptTenantFromUrl } from './lib/env';
import './styles/index.css';

// ?tenant=alumno01 en cualquier URL fija el tenant de trabajo
adoptTenantFromUrl(window.location.search);

// PWA: el service worker solo se registra en el build de producción
if (import.meta.env.PROD) registerSW({ immediate: true });

const container = document.getElementById('root');
if (!container) throw new Error('No se encontró el contenedor #root');

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
