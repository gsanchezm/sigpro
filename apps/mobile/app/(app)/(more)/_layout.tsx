import { Stack } from 'expo-router';

/** Pila de la pestaña «Más»: el menú (`/more`) y los módulos que no caben en la barra (`/documents`, `/audit`, `/admin`, `/profile`, `/search`). */
export default function MoreLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
