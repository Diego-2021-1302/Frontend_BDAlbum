import axios, { AxiosProgressEvent, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { MediaItem, AuthResponse, User } from '../types';
import { useAuthStore } from '../store/authStore';

const getBaseUrl = () => {
  return useAuthStore.getState().baseUrl;
};

const api = axios.create({
  maxBodyLength: Infinity,
  maxContentLength: Infinity,
});

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = localStorage.getItem('auth_token');
  config.baseURL = getBaseUrl();
  config.headers.Accept = 'application/json';
  config.headers['X-Requested-With'] = 'XMLHttpRequest';
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const apiService = {
  login: async (username: string, password: string, customUrl?: string): Promise<AuthResponse> => {
    const url = (customUrl || getBaseUrl()).replace(/\/$/, '');
    const response = await axios.post<AuthResponse>(
      `${url}/api/login`,
      { username, password },
      { headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' } }
    );
    return response.data;
  },

  fetchMedia: async (): Promise<MediaItem[]> => {
    const response = await api.get<MediaItem[]>('/api/media');
    return response.data;
  },

  fetchMediaById: async (id: number): Promise<MediaItem> => {
    const media = await apiService.fetchMedia();
    const item = media.find((entry) => entry.id === id);
    if (!item) {
      throw new Error('No se encontró el recuerdo solicitado');
    }
    return item;
  },

  uploadMedia: async (
    formData: FormData,
    onUploadProgress?: (progressEvent: AxiosProgressEvent) => void
  ): Promise<MediaItem> => {
    const { uploadUrl, baseUrl } = useAuthStore.getState();
    const effectiveUploadUrl = uploadUrl || baseUrl;
    const url = `${effectiveUploadUrl.replace(/\/$/, '')}/api/media`;

    const maxAttempts = 5; // Más reintentos para archivos grandes
    let attempt = 0;

    while (true) {
      try {
        const response = await api.post<MediaItem, AxiosResponse<MediaItem>>(url, formData, {
          onUploadProgress,
          timeout: 0, // Sin límite de tiempo para videos pesados
          maxBodyLength: Infinity,
          maxContentLength: Infinity,
          headers: {
            'Content-Type': 'multipart/form-data',
          }
        });
        return response.data;
      } catch (err: any) {
        attempt += 1;

        // Errores de red, timeouts o errores de servidor 5xx son candidatos a reintento
        const isNetworkError = !err.response || err.code === 'ECONNABORTED' || err.message?.toLowerCase()?.includes('network error');
        const isServerError = err.response && err.response.status >= 500;

        if (attempt >= maxAttempts || !(isNetworkError || isServerError)) {
          throw err;
        }

        // Delay exponencial
        const delay = Math.min(30000, Math.pow(2, attempt) * 1000);
        await new Promise((res) => setTimeout(res, delay));
      }
    }
  },

  uploadChunk: async (
    chunkData: FormData,
    onUploadProgress?: (progressEvent: AxiosProgressEvent) => void,
    signal?: AbortSignal
  ): Promise<any> => {
    const { uploadUrl, baseUrl } = useAuthStore.getState();
    const effectiveUploadUrl = uploadUrl || baseUrl;
    const url = `${effectiveUploadUrl.replace(/\/$/, '')}/api/media/upload-chunk`;

    const maxAttempts = 6;
    let attempt = 0;

    while (true) {
      try {
        const response = await api.post(url, chunkData, {
          onUploadProgress,
          timeout: 0,
          maxBodyLength: Infinity,
          maxContentLength: Infinity,
          signal,
        });
        return response.data;
      } catch (err: any) {
        attempt += 1;
        const isRetryable = !err.response || err.response.status >= 500 || err.response.status === 408 || err.code === 'ECONNABORTED' || err.message?.toLowerCase()?.includes('network error');

        if (attempt >= maxAttempts || !isRetryable) {
          throw err;
        }

        const delay = Math.min(15000, 1000 * attempt * 2 + Math.floor(Math.random() * 1000));
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  },

  updateMedia: async (id: number, data: Partial<MediaItem>): Promise<MediaItem> => {
    const response = await api.put<MediaItem>(`/api/media/${id}`, data);
    return response.data;
  },

  deleteMedia: async (id: number): Promise<void> => {
    await api.delete(`/api/media/${id}`);
  },

  regenerateAllMedia: async (): Promise<{ success: boolean; message: string }> => {
    const response = await api.post('/api/media/regenerate-all');
    return response.data;
  },

  fetchHlsStatus: async (id: number): Promise<{
    id: number;
    hls_status: 'pending' | 'processing' | 'ready' | 'failed' | null;
    hls_url: string | null;
    thumbnail_url: string | null;
  }> => {
    const response = await api.get(`/api/media/${id}/status`);
    return response.data;
  },

  fetchUsers: async (): Promise<User[]> => {
    const response = await api.get<User[]>('/api/users');
    return response.data;
  },

  deleteUser: async (id: number): Promise<boolean> => {
    const response = await api.delete(`/api/users/${id}`);
    return response.data.success;
  },

  register: async (userData: { username: string; password?: string }): Promise<User> => {
    const response = await api.post<User>('/api/users', {
      username: userData.username,
      password: userData.password,
    });
    return response.data;
  },

  updateUser: async (id: number, username: string, password?: string | null): Promise<User> => {
    const response = await api.put<User>(`/api/users/${id}`, {
      username,
      ...(password ? { password } : {}),
    });
    return response.data;
  },

  /**
   * Construye una URL válida para un recurso multimedia usando CARGA DISTRIBUIDA REAL.
   * Balancea la carga basándose en la CARPETA del recurso.
   * - /videos/ y /hls/ -> Nodo 8004
   * - /images/ -> Nodo 8002
   */
  buildFileUrl: (path: string | undefined | null, type?: 'image' | 'video'): string => {
    if (!path) return '';
    
    const { baseUrl, mediaUrl, videoUrl } = useAuthStore.getState();

    let p = path.trim();
    if (p.startsWith('http') || p.startsWith('blob:')) return p;
    if (p.startsWith('/')) p = p.slice(1);

    // ANALISIS POR RUTA (Estructura de Carpetas)
    const isVideoAsset = p.includes('videos/') ||
                         p.includes('hls/') ||
                         p.includes('thumbnails/video/') ||
                         type === 'video';

    // Node 8004: Todo lo que esté en videos/ o hls/
    // Node 8002: Todo lo que esté en images/ o thumbnails/image/
    const effectiveBase = isVideoAsset ? (videoUrl || baseUrl) : (mediaUrl || baseUrl);
    const cleanPath = p.replace(/^(storage\/|public\/|media\/|api\/media-file\/)/g, '');
    
    return `${effectiveBase.replace(/\/$/, '')}/api/media-file/${cleanPath}`;
  },
};

export default api;
