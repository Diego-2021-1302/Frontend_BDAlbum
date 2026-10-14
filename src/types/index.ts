export interface MediaItem {
  id?: number;
  file_path: string;
  taken_at: string;
  tag: string;
  description?: string;
  type: 'image' | 'video';
  local_path?: string;
  is_downloaded?: boolean;
  sync_status?: number;
  hls_path?: string | null;
  hls_status?: 'pending' | 'processing' | 'ready' | 'failed' | null;
  thumbnail_path?: string | null;
  // URLs absolutas generadas por el backend (via $appends)
  hls_url?: string | null;
  thumbnail_url?: string | null;
  file_url?: string | null;
  private_access_token?: string;
}

export interface User {
  id: number;
  username: string;
  name?: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}