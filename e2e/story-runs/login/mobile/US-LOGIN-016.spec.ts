import { TENANT_A } from '../../support/prepare';
import { defineBrowserRows, notExecutable, type BrowserRowHandler } from '../../support/rows';
import { cell } from './common';

// US-LOGIN-016 — [Android] El botón atrás tras cerrar sesión no vuelve a una pantalla privada. Verificación pendiente-nativo:
// requiere Android (emulador o dispositivo) y esta máquina no puede mantenerlo junto con la pila. No se ejecuta: cada fila tiene
// su manejador y su resultado, pero ninguna abre nada.

const notTested: BrowserRowHandler = async (row) =>
  notExecutable(
    `${cell(row, 'correo')} ha recorrido ${cell(row, 'recorrido')}, cierra sesión desde «Perfil» y pulsa el botón atrás del sistema ${cell(row, 'veces')}: no ve ninguna pantalla privada y, al volver a abrir la app, ve el título «Iniciar sesión»`,
    'pendiente-nativo: requiere Android (emulador o dispositivo); no se ejecutó en esta ronda',
  );

defineBrowserRows({
  story: 'US-LOGIN-016',
  surface: 'expo-web',
  tenants: [TENANT_A],
  handlers: new Map<number, BrowserRowHandler>([[1, notTested]]),
});
