// Metro con la configuración por defecto de Expo: reconoce el monorepo pnpm (symlinks y `exports` de @sigpro/shared).
const { getDefaultConfig } = require('expo/metro-config');

module.exports = getDefaultConfig(__dirname);
