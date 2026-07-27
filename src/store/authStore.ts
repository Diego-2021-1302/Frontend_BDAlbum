import { create } from 'zustand';
import { User } from '../types';
import { DEFAULT_API_BASE_URL, getPersistedBaseUrl, setPersistedBaseUrl, fetchGlobalBaseUrl, updateGlobalBaseUrl } from '../config/apiConfig';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  lastUser: string;
  baseUrl: string;
  setBaseUrl: (url: string) => void;
  saveGlobalConfig: (url: string) => Promise<boolean>;
  login: (userData: User, token: string, url?: string) => Promise<void>;
  logout: () => void;
  fetchGlobalConfig: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => {
  const token = localStorage.getItem('auth_token');
  const lastUser = localStorage.getItem('last_user') || '';

  return {
    // Reconstruimos el objeto user si ya estamos autenticados para que no se pierda al recargar
    user: token ? { id: 0, username: lastUser } : null,
    isAuthenticated: !!token,
    lastUser: lastUser,
    baseUrl: getPersistedBaseUrl(),

    setBaseUrl: (url) => {
      const cleanUrl = setPersistedBaseUrl(url);
      set({ baseUrl: cleanUrl });
    },

    saveGlobalConfig: async (url) => {
      const cleanUrl = setPersistedBaseUrl(url);
      // Actualizamos el estado local inmediatamente para que persista en esta sesión
      set({ baseUrl: cleanUrl });

      // Intentamos persistir globalmente (esto fallará en Vercel si no hay backend, pero no importa para el local)
      const success = await updateGlobalBaseUrl(cleanUrl);
      return success;
    },

    fetchGlobalConfig: async () => {
      try {
        const configUrl = await fetchGlobalBaseUrl();
        // Si Redis devuelve una URL (no vacía), la usamos como única fuente de verdad
        if (configUrl && configUrl.trim() !== "") {
          console.log('Sincronizando con fuente de verdad (Redis):', configUrl);
          setPersistedBaseUrl(configUrl);
          set({ baseUrl: configUrl });
        } else {
          console.log('Redis está vacío, esperando configuración inicial...');
        }
      } catch (e) {
        console.error('Error al consultar fuente de verdad:', e);
      }
    },
    
    login: async (userData, token, url) => {
      const currentUrl = (url || get().baseUrl).trim().replace(/\/$/, '');

      localStorage.setItem('auth_token', token);
      localStorage.setItem('last_user', userData.username);

      const cleanUrl = setPersistedBaseUrl(currentUrl);
      set({
        user: userData,
        isAuthenticated: true,
        lastUser: userData.username,
        baseUrl: cleanUrl
      });

      // PERSISTENCIA GLOBAL: Intentamos guardar en la fuente de verdad (Redis)
      updateGlobalBaseUrl(cleanUrl)
        .then(success => {
          if (success) {
            console.log('✅ Fuente de verdad actualizada (Redis):', cleanUrl);
          }
        })
        .catch(e => {
          console.error('❌ Error al intentar actualizar la fuente de verdad:', e);
        });
    },

    logout: () => {
      localStorage.removeItem('auth_token');
      set({ user: null, isAuthenticated: false });
    },
  };
});

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key === 'api_base_url' && event.newValue) {
      const cleanUrl = event.newValue.trim().replace(/\/$/, '') || DEFAULT_API_BASE_URL;
      useAuthStore.setState({ baseUrl: cleanUrl });
    }
  });
}
