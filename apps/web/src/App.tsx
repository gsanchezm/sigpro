import type { ReactNode } from 'react';
import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { AccessPage } from './pages/access/AccessPage';
import { ProgramsPage } from './pages/programs/ProgramsPage';
import { AuthProvider, useAuth } from './state/auth';
import { I18nProvider, useI18n } from './state/i18n';
import { ThemeProvider } from './state/theme';
import { ToastProvider } from './state/toast';

const Splash = () => {
  const { t } = useI18n();
  return (
    <div role="status" aria-busy="true" className="grid min-h-screen place-items-center bg-bg">
      <span className="flex items-center gap-3 text-[12.5px] text-fg-2">
        <span aria-hidden="true" className="spinner spinner-lg" />
        {t('common', 'loading')}
      </span>
    </div>
  );
};

/** Rutas privadas: sin sesión se vuelve a Acceso. */
const RequireAuth = () => {
  const { status } = useAuth();
  if (status === 'loading') return <Splash />;
  return status === 'authenticated' ? <Outlet /> : <Navigate to="/login" replace />;
};

/** Rutas de Acceso: con sesión se entra directamente en Programas. */
const PublicOnly = ({ children }: { children: ReactNode }) => {
  const { status } = useAuth();
  if (status === 'loading') return <Splash />;
  return status === 'authenticated' ? <Navigate to="/programs" replace /> : <>{children}</>;
};

export const App = () => (
  <ThemeProvider>
    <I18nProvider>
      <ToastProvider>
        <AuthProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Navigate to="/programs" replace />} />
              <Route
                path="/login"
                element={
                  <PublicOnly>
                    <AccessPage routeView="login" />
                  </PublicOnly>
                }
              />
              <Route
                path="/register"
                element={
                  <PublicOnly>
                    <AccessPage routeView="register" />
                  </PublicOnly>
                }
              />
              <Route
                path="/forgot"
                element={
                  <PublicOnly>
                    <AccessPage routeView="forgot" />
                  </PublicOnly>
                }
              />
              <Route element={<RequireAuth />}>
                <Route path="/programs" element={<ProgramsPage />} />
              </Route>
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </ToastProvider>
    </I18nProvider>
  </ThemeProvider>
);
