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
  login: (userData: User, token: string) => Promise<void>;
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
      const success = await updateGlobalBaseUrl(cleanUrl);
      if (success) {
        set({ baseUrl: cleanUrl });
      }
      return success;
    },

    fetchGlobalConfig: async () => {
      const configUrl = await fetchGlobalBaseUrl();
      if (!configUrl) return;

      setPersistedBaseUrl(configUrl);
      set({ baseUrl: configUrl });
    },
    
    login: async (userData, token) => {
      const currentUrl = get().baseUrl.trim().replace(/\/$/, '');

      localStorage.setItem('auth_token', token);
      localStorage.setItem('last_user', userData.username);
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
