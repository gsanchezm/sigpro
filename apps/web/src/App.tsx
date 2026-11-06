import type { ReactNode } from 'react';
import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { AppShell } from './layout/AppShell';
import { ComingSoon } from './pages/ComingSoon';
import { AccessPage } from './pages/access/AccessPage';
import { LabPage } from './pages/lab/LabPage';
import { LegalPage } from './pages/legal/LegalPage';
import { PublicLab } from './pages/lab/PublicLab';
import { ProgramDetailPage } from './pages/programs/ProgramDetailPage';
import { ProgramEditPage } from './pages/programs/ProgramEditPage';
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

/** /lab es pública: con sesión se ve dentro del shell; sin sesión, con una cabecera mínima. */
const LabRoute = () => {
  const { status } = useAuth();
  if (status === 'loading') return <Splash />;
  return status === 'authenticated' ? (
    <AppShell>
      <LabPage />
    </AppShell>
  ) : (
    <PublicLab />
  );
};

const Soon = ({ label }: { label: 'nav_mission' | 'nav_requirements' | 'nav_verification' | 'nav_nc' | 'nav_documents' | 'nav_audit' | 'nav_admin' }) => {
  const { t } = useI18n();
  return <ComingSoon title={t('programas', label)} />;
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
              <Route path="/lab" element={<LabRoute />} />
              <Route path="/legal/terms" element={<LegalPage kind="terms" />} />
              <Route path="/legal/privacy" element={<LegalPage kind="privacy" />} />
              <Route path="/help" element={<LegalPage kind="help" />} />
              <Route element={<RequireAuth />}>
                <Route element={<AppShell />}>
                  <Route path="/programs" element={<ProgramsPage />} />
                  <Route path="/programs/:code" element={<ProgramDetailPage />} />
                  <Route path="/programs/:code/edit" element={<ProgramEditPage />} />
                  <Route path="/programs/:code/requirements" element={<Soon label="nav_requirements" />} />
                  <Route path="/mission" element={<Soon label="nav_mission" />} />
                  <Route path="/verification" element={<Soon label="nav_verification" />} />
                  <Route path="/nc" element={<Soon label="nav_nc" />} />
                  <Route path="/documents" element={<Soon label="nav_documents" />} />
                  <Route path="/audit" element={<Soon label="nav_audit" />} />
                  <Route path="/admin" element={<Soon label="nav_admin" />} />
                </Route>
              </Route>
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </ToastProvider>
    </I18nProvider>
  </ThemeProvider>
);
