import React, { useEffect, Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from './store/authStore';
import Login from './pages/Login';
import InstallPWA from './components/InstallPWA';

// Lazy loading para reducir el bundle inicial
const Gallery = lazy(() => import('./pages/Gallery'));
const Upload = lazy(() => import('./pages/Upload'));
const Admin = lazy(() => import('./pages/Admin'));
const ReelsViewer = lazy(() => import('./pages/ReelsViewer'));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 1000 * 60 * 5, // 5 minutos por defecto
    },
  },
});

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" />;
};

const PageLoader = () => (
  <div className="min-h-screen bg-dark flex items-center justify-center">
    <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
  </div>
);

const App: React.FC = () => {
  const fetchGlobalConfig = useAuthStore((state) => state.fetchGlobalConfig);
  const fetchLocalConfig = useAuthStore((state) => state.fetchLocalConfig);

  useEffect(() => {
    const load = async () => {
      try {
        // Primero intentar autocompletar desde el archivo local generado por el orquestador
        await fetchLocalConfig();
        // Luego sincronizar con la configuración global (backend)
        await fetchGlobalConfig();
      } catch (error) {
        console.error('Error cargando configuración de nodos o global:', error);
      }
    };
    load();
  }, [fetchGlobalConfig, fetchLocalConfig]);

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <InstallPWA />
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={
              <ProtectedRoute>
                <Gallery />
              </ProtectedRoute>
            } />
            <Route path="/upload" element={
              <ProtectedRoute>
                <Upload />
              </ProtectedRoute>
            } />
            <Route path="/admin" element={
              <ProtectedRoute>
                <Admin />
              </ProtectedRoute>
            } />
            <Route path="/reels" element={
              <ProtectedRoute>
                <ReelsViewer />
              </ProtectedRoute>
            } />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </QueryClientProvider>
  );
};

export default App;
