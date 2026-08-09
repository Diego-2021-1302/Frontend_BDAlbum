export const API_BASE_URL_KEY = 'api_base_url';
export const MEDIA_URL_KEY = 'media_url';
export const UPLOAD_URL_KEY = 'upload_url';
export const VIDEO_URL_KEY = 'video_url';
export const DEFAULT_API_BASE_URL = '';

export function getPersistedBaseUrl(): string {
  const stored = localStorage.getItem(API_BASE_URL_KEY);
  return stored ? stored.trim().replace(/\/$/, '') : DEFAULT_API_BASE_URL;
}

export function getPersistedMediaUrl(): string {
  const stored = localStorage.getItem(MEDIA_URL_KEY);
  return stored ? stored.trim().replace(/\/$/, '') : '';
}

export function setPersistedMediaUrl(url: string): string {
  const cleanUrl = url.trim().replace(/\/$/, '');
  localStorage.setItem(MEDIA_URL_KEY, cleanUrl);
  return cleanUrl;
}

export async function fetchLocalNodosConfig(): Promise<{baseUrl: string, mediaUrl: string, uploadUrl: string, videoUrl: string} | null> {
  try {
    // Intentamos leer el archivo generado por el orquestador en la carpeta public del frontend
    const response = await fetch(`/nodos-config.json?t=${Date.now()}`, {
      cache: 'no-store',
      headers: { 'Pragma': 'no-cache', 'Cache-Control': 'no-cache' }
    });
    if (!response.ok) return null;
    const data = await response.json();
    return {
        baseUrl: (data?.baseUrl || '').trim().replace(/\/$/, ''),
        mediaUrl: (data?.mediaUrl || '').trim().replace(/\/$/, ''),
        uploadUrl: (data?.uploadUrl || '').trim().replace(/\/$/, ''),
        videoUrl: (data?.videoUrl || '').trim().replace(/\/$/, '')
    };
  } catch (error) {
    return null;
  }
}

export async function fetchGlobalBaseUrl(currentBaseUrl?: string): Promise<{baseUrl: string, mediaUrl: string, uploadUrl: string, videoUrl: string} | null> {
  try {
    const host = currentBaseUrl || getPersistedBaseUrl() || window.location.origin;
    const response = await fetch(`${host}/api/config-url?t=${Date.now()}`, {
      cache: 'no-store',
      headers: { 'Pragma': 'no-cache', 'Cache-Control': 'no-cache' }
    });
    if (!response.ok) return null;
    const data = await response.json();
    return {
        baseUrl: (data?.baseUrl || '').trim().replace(/\/$/, ''),
        mediaUrl: (data?.mediaUrl || '').trim().replace(/\/$/, ''),
        uploadUrl: (data?.uploadUrl || '').trim().replace(/\/$/, ''),
        videoUrl: (data?.videoUrl || '').trim().replace(/\/$/, '')
    };
  } catch (error) {
    console.log('No se pudo leer config-url:', error);
    return null;
  }
}

export async function updateGlobalBaseUrl(config: {api: string, media: string, upload: string, video: string}): Promise<boolean> {
  try {
    const host = config.api || getPersistedBaseUrl() || window.location.origin;
    const response = await fetch(`${host}/api/config-url`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
          baseUrl: config.api,
          mediaUrl: config.media,
          uploadUrl: config.upload,
          videoUrl: config.video
      })
    });
    return response.ok;
  } catch (error) {
    console.log('No se pudo actualizar config-url:', error);
    return false;
  }
}

export function setPersistedBaseUrl(url: string): string {
  const cleanUrl = url.trim().replace(/\/$/, '') || DEFAULT_API_BASE_URL;
  localStorage.setItem(API_BASE_URL_KEY, cleanUrl);
  return cleanUrl;
}
