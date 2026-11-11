import { defineConfig } from 'vitest/config';

// Solo lógica pura (sin importar react-native): vistas de datos, reglas de filtros y de tablero
export default defineConfig({
  test: { include: ['src/**/*.test.ts'], environment: 'node' },
});
