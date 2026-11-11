import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from '../src/state/auth';
import { I18nProvider } from '../src/state/i18n';
import { ThemeProvider, useTheme } from '../src/state/theme';
import { ToastProvider } from '../src/state/toast';

const Navigation = () => {
  const { scheme, colors } = useTheme();
  return (
    <>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }} />
    </>
  );
};

/** Raíz: proveedores (tema → idioma → avisos → sesión) y pila de navegación. Las rutas son las mismas que las de la web. */
export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <I18nProvider>
          <ToastProvider>
            <AuthProvider>
              <Navigation />
            </AuthProvider>
          </ToastProvider>
        </I18nProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
