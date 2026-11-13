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
import { clearFileUrlCache } from '../api/api';

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
  fetchGlobalConfig: (force?: boolean) => Promise<void>;
  fetchLocalConfig: () => Promise<void>;
}

function optimizeNetworkConnections(urls: (string | undefined)[]) {
  urls.forEach(url => {
    if (!url || !url.startsWith('http')) return;
    try {
      const origin = new URL(url).origin;

      if (!document.querySelector(`link[rel="dns-prefetch"][href="${origin}"]`)) {
        const dnsLink = document.createElement('link');
        dnsLink.rel = 'dns-prefetch';
        dnsLink.href = origin;
        document.head.appendChild(dnsLink);
      }

      if (!document.querySelector(`link[rel="preconnect"][href="${origin}"]`)) {
        const connLink = document.createElement('link');
        connLink.rel = 'preconnect';
        connLink.href = origin;
        connLink.crossOrigin = 'anonymous';
        document.head.appendChild(connLink);
      }
    } catch (e) {
      // Ignorar errores de sintaxis en URL
    }
  });
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
      clearFileUrlCache();
      optimizeNetworkConnections([cleanUrl]);
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
      clearFileUrlCache();
      optimizeNetworkConnections([config.api, config.media, config.upload, config.video]);

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

          optimizeNetworkConnections([baseUrl, mediaUrl, uploadUrl, videoUrl]);

          set({ baseUrl, mediaUrl, uploadUrl, videoUrl });
          clearFileUrlCache();
        }
      } catch (e) {
        // Ignorar si no existe archivo local
      }
    },

    fetchGlobalConfig: async (force = false) => {
      if (get().isUpdatingGlobal && !force) return;

      try {
        const data = await fetchGlobalBaseUrl(undefined, force);
        if (!data || !data.baseUrl) return;

        const { baseUrl, mediaUrl, uploadUrl, videoUrl } = data;
        let changed = false;

        if (baseUrl && baseUrl !== get().baseUrl) {
           console.log('⚡ URL de API sincronizada desde Redis:', baseUrl);
           setPersistedBaseUrl(baseUrl);
           set({ baseUrl });
           changed = true;
        }

        if (mediaUrl && mediaUrl !== get().mediaUrl) {
          setPersistedMediaUrl(mediaUrl);
          set({ mediaUrl });
          changed = true;
        }
        if (uploadUrl && uploadUrl !== get().uploadUrl) {
          localStorage.setItem('upload_url', uploadUrl);
          set({ uploadUrl });
          changed = true;
        }
        if (videoUrl && videoUrl !== get().videoUrl) {
          localStorage.setItem('video_url', videoUrl);
          set({ videoUrl });
          changed = true;
        }

        if (changed) {
          clearFileUrlCache();
        }

        optimizeNetworkConnections([baseUrl, mediaUrl, uploadUrl, videoUrl]);
      } catch (e) {
        // Ignorar
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
