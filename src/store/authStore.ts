import { create } from 'zustand';
import { User } from '../types';
import {
    DEFAULT_API_BASE_URL,
    getPersistedBaseUrl,
    setPersistedBaseUrl,
    fetchGlobalBaseUrl,
    updateGlobalBaseUrl,
    getPersistedMediaUrl,
    setPersistedMediaUrl,
    fetchLocalNodosConfig
} from '../config/apiConfig';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  lastUser: string;
  baseUrl: string;
  mediaUrl: string;
  uploadUrl: string;
  videoUrl: string;
  isUpdatingGlobal: boolean;
  setBaseUrl: (url: string) => void;
  saveGlobalConfig: (config: {api: string, media: string, upload: string, video: string}) => Promise<boolean>;
  login: (userData: User, token: string, url?: string) => Promise<void>;
  logout: () => void;
  fetchGlobalConfig: () => Promise<void>;
  fetchLocalConfig: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => {
  const token = localStorage.getItem('auth_token');
  const lastUser = localStorage.getItem('last_user') || '';

  return {
    user: token ? { id: 0, username: lastUser } : null,
    isAuthenticated: !!token,
    lastUser: lastUser,
    baseUrl: getPersistedBaseUrl(),
    mediaUrl: getPersistedMediaUrl(),
    uploadUrl: localStorage.getItem('upload_url') || '',
    videoUrl: localStorage.getItem('video_url') || '',
    isUpdatingGlobal: false,

    setBaseUrl: (url) => {
      const cleanUrl = setPersistedBaseUrl(url);
      set({ baseUrl: cleanUrl });
    },

    saveGlobalConfig: async (config) => {
      const cleanApi = setPersistedBaseUrl(config.api);
      localStorage.setItem('media_url', config.media);
      localStorage.setItem('upload_url', config.upload);
      localStorage.setItem('video_url', config.video);

      set({
          baseUrl: cleanApi,
          mediaUrl: config.media,
          uploadUrl: config.upload,
          videoUrl: config.video,
          isUpdatingGlobal: true
      });

      const success = await updateGlobalBaseUrl(config);
      setTimeout(() => set({ isUpdatingGlobal: false }), 5000);
      return success;
    },

    fetchLocalConfig: async () => {
      try {
        const data = await fetchLocalNodosConfig();
        if (data) {
          const { baseUrl, mediaUrl, uploadUrl, videoUrl } = data;
          if (baseUrl) setPersistedBaseUrl(baseUrl);
          if (mediaUrl) localStorage.setItem('media_url', mediaUrl);
          if (uploadUrl) localStorage.setItem('upload_url', uploadUrl);
          if (videoUrl) localStorage.setItem('video_url', videoUrl);

          // PRE-CONEXIÓN INMEDIATA: Preparar los túneles en cuanto se conocen
          [baseUrl, mediaUrl, videoUrl].forEach(url => {
            if (url) {
                const link = document.createElement('link');
                link.rel = 'preconnect';
                link.href = url;
                link.crossOrigin = 'anonymous';
                document.head.appendChild(link);
            }
          });

          set({ baseUrl, mediaUrl, uploadUrl, videoUrl });
          console.log('✅ Red distribuida lista y pre-conectada');
        }
      } catch (e) {
        console.error('No se pudo autocompletar localmente');
      }
    },

    fetchGlobalConfig: async () => {
      if (get().isUpdatingGlobal) return;

      try {
        const data = await fetchGlobalBaseUrl();
        if (!data) return;

        const { baseUrl, mediaUrl, uploadUrl, videoUrl } = data;

        if (baseUrl && baseUrl !== get().baseUrl) {
          setPersistedBaseUrl(baseUrl);
          set({ baseUrl });
        }
        if (mediaUrl && mediaUrl !== get().mediaUrl) {
          setPersistedMediaUrl(mediaUrl);
          set({ mediaUrl });
        }
        if (uploadUrl && uploadUrl !== get().uploadUrl) {
          localStorage.setItem('upload_url', uploadUrl);
          set({ uploadUrl });
        }
        if (videoUrl && videoUrl !== get().videoUrl) {
          localStorage.setItem('video_url', videoUrl);
          set({ videoUrl });
        }

        // Reforzar pre-conexión tras sincronización global
        [baseUrl, mediaUrl, videoUrl].forEach(url => {
          if (url && !document.querySelector(`link[href="${url}"]`)) {
            const link = document.createElement('link');
            link.rel = 'preconnect';
            link.href = url;
            link.crossOrigin = 'anonymous';
            document.head.appendChild(link);
          }
        });
      } catch (e) {
        console.error('Error sincronizando configuración:', e);
      }
    },
    
    login: async (userData, token, url) => {
      const currentUrl = (url || get().baseUrl).trim().replace(/\/$/, '');
      localStorage.setItem('auth_token', token);
      localStorage.setItem('last_user', userData.username);

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
