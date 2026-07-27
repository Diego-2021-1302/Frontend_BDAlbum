import axios, { AxiosProgressEvent, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { MediaItem, AuthResponse, User } from '../types';
import { useAuthStore } from '../store/authStore';

const getBaseUrl = () => {
  return useAuthStore.getState().baseUrl;
};

const api = axios.create();

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

  uploadMedia: async (
    formData: FormData,
    onUploadProgress?: (progressEvent: AxiosProgressEvent) => void
  ): Promise<MediaItem> => {
    const response = await api.post<MediaItem, AxiosResponse<MediaItem>>('/api/media', formData, {
      onUploadProgress,
    });
    return response.data;
  },

  updateMedia: async (id: number, data: Partial<MediaItem>): Promise<MediaItem> => {
    const response = await api.put<MediaItem>(`/api/media/${id}`, data);
    return response.data;
  },

  deleteMedia: async (id: number): Promise<void> => {
    await api.delete(`/api/media/${id}`);
  },

  /**
   * Solicita al servidor que regenere miniaturas faltantes y procese HLS pendientes.
   */
  regenerateAllMedia: async (): Promise<{ success: boolean; message: string }> => {
    const response = await api.post('/api/media/regenerate-all');
    return response.data;
  },

  // Consulta el estado del procesamiento HLS de un video
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
   * Construye una URL válida para un recurso multimedia.
   */
  buildFileUrl: (path: string | undefined | null): string => {
    if (!path) return '';
    
    const baseUrl = getBaseUrl().replace(/\/$/, '');
    let p = path.trim();

    if (p.startsWith('http') || p.startsWith('blob:')) {
      return p;
    }

    if (p.startsWith('/')) {
      p = p.slice(1);
    }

    if (p.startsWith('api/')) {
      return `${baseUrl}/${p}`;
    }

    const cleanPath = p.replace(/^(storage\/|public\/|media\/)/, '');
    
    return `${baseUrl}/api/media-file/${cleanPath}`;
  },
};

export default api;