import { useFonts } from 'expo-font';
import { useEffect, useState, type ReactNode } from 'react';
import { FONT_ASSETS } from '../theme/fonts';

/** Tiempo máximo que se espera a las fuentes: pasado, la app arranca con la fuente del sistema en vez de quedarse en blanco. */
const FONT_TIMEOUT_MS = 2500;

/**
 * No pinta la app hasta que Geist está cargada, para que no haya un salto de fuente al arrancar. Si la carga falla o tarda
 * más de `FONT_TIMEOUT_MS`, deja pasar igualmente: una fuente que no llega nunca debe tumbar la pantalla de acceso.
 */
export const FontGate = ({ children }: { readonly children: ReactNode }) => {
  const [loaded, error] = useFonts(FONT_ASSETS);
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setTimedOut(true), FONT_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, []);

  if (!loaded && error === null && !timedOut) return null;
  return <>{children}</>;
};
