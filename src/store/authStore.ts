import { create } from 'zustand';
import { User } from '../types';
import { DEFAULT_API_BASE_URL, getPersistedBaseUrl, setPersistedBaseUrl, fetchGlobalBaseUrl, updateGlobalBaseUrl } from '../config/apiConfig';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  lastUser: string;
  baseUrl: string;
  isUpdatingGlobal: boolean; // Bandera para evitar rebotes de URL vieja
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
    user: token ? { id: 0, username: lastUser } : null,
    isAuthenticated: !!token,
    lastUser: lastUser,
    baseUrl: getPersistedBaseUrl(),
    isUpdatingGlobal: false,

    setBaseUrl: (url) => {
      const cleanUrl = setPersistedBaseUrl(url);
      set({ baseUrl: cleanUrl });
    },

    saveGlobalConfig: async (url) => {
      const cleanUrl = setPersistedBaseUrl(url);
      set({ baseUrl: cleanUrl, isUpdatingGlobal: true });

      console.log('🚀 Enviando nueva URL a la fuente de verdad (Redis):', cleanUrl);
      const success = await updateGlobalBaseUrl(cleanUrl);

      // Esperamos un poco antes de permitir que fetchGlobalConfig vuelva a actuar
      setTimeout(() => set({ isUpdatingGlobal: false }), 5000);
      return success;
    },

    fetchGlobalConfig: async () => {
      // Si estamos en medio de una actualización local, no dejamos que la nube nos pise
      if (get().isUpdatingGlobal) return;

      try {
        const data = await fetchGlobalBaseUrl();
        if (!data) return;

        const configUrl = typeof data === 'string' ? data : (data as any).baseUrl;

        if (configUrl && configUrl.trim() !== "") {
          const currentLocal = getPersistedBaseUrl();
          if (configUrl !== currentLocal) {
            console.log('🔄 Sincronizando: La nube tiene una URL más nueva:', configUrl);
            setPersistedBaseUrl(configUrl);
            set({ baseUrl: configUrl });
          }
        }
      } catch (e) {
        console.error('Error sincronizando configuración:', e);
      }
    },
    
    login: async (userData, token, url) => {
      const currentUrl = (url || get().baseUrl).trim().replace(/\/$/, '');
      localStorage.setItem('auth_token', token);
      localStorage.setItem('last_user', userData.username);

      // Al loguearnos, nos aseguramos de que esta URL sea la global
      await get().saveGlobalConfig(currentUrl);

      set({
        user: userData,
        isAuthenticated: true,
        lastUser: userData.username,
        baseUrl: currentUrl
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
