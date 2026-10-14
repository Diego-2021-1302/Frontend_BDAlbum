export const API_BASE_URL_KEY = 'api_base_url';
export const MEDIA_URL_KEY = 'media_url';
export const UPLOAD_URL_KEY = 'upload_url';
export const VIDEO_URL_KEY = 'video_url';
export const DEFAULT_API_BASE_URL = '';

const CONFIG_TTL_MS = 30000;
let globalConfigCache: { value: {baseUrl: string; mediaUrl: string; uploadUrl: string; videoUrl: string}; expiresAt: number } | null = null;

const normalizeConfig = (data: any) => ({
  baseUrl: (data?.baseUrl || '').trim().replace(/\/$/, ''),
  mediaUrl: (data?.mediaUrl || '').trim().replace(/\/$/, ''),
  uploadUrl: (data?.uploadUrl || '').trim().replace(/\/$/, ''),
  videoUrl: (data?.videoUrl || '').trim().replace(/\/$/, '')
});

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
    const now = Date.now();
    if (!currentBaseUrl && globalConfigCache && now < globalConfigCache.expiresAt) {
      return globalConfigCache.value;
    }

    // Si estamos en Vercel, primero intentamos consultar nuestro propio endpoint de descubrimiento (Redis)
    const isVercel = window.location.hostname.includes('vercel.app');
    let host = currentBaseUrl || getPersistedBaseUrl();

    if (isVercel && !currentBaseUrl) {
      const vercelResp = await fetch(`${window.location.origin}/api/config-url?t=${Date.now()}`, {
        cache: 'no-store',
        headers: { 'Pragma': 'no-cache', 'Cache-Control': 'no-cache' }
      });
      if (vercelResp.ok) {
        const vercelData = normalizeConfig(await vercelResp.json());
        if (vercelData.baseUrl) {
          if (!currentBaseUrl) {
            globalConfigCache = { value: vercelData, expiresAt: Date.now() + CONFIG_TTL_MS };
          }
          return vercelData;
        }
      }
    }

    host = host || window.location.origin;
    const response = await fetch(`${host}/api/config-url?t=${Date.now()}`, {
      cache: 'no-store',
      headers: { 'Pragma': 'no-cache', 'Cache-Control': 'no-cache' }
    });
    if (!response.ok) return null;
    const data = normalizeConfig(await response.json());
    if (!currentBaseUrl) {
      globalConfigCache = { value: data, expiresAt: Date.now() + CONFIG_TTL_MS };
    }
    return data;
  } catch (error) {
    console.log('No se pudo leer config-url:', error);
    return null;
  }
}

export async function updateGlobalBaseUrl(config: {api: string, media: string, upload: string, video: string}): Promise<boolean> {
  try {
    const host = config.api || getPersistedBaseUrl() || window.location.origin;

    // 1. Actualizar el Backend (Túnel actual)
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

    // 2. Si estamos en Vercel, sincronizar también el descubrimiento (Redis)
    if (window.location.hostname.includes('vercel.app')) {
      await fetch(`${window.location.origin}/api/config-url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            baseUrl: config.api,
            mediaUrl: config.media,
            uploadUrl: config.upload,
            videoUrl: config.video
        })
      }).catch(e => console.warn('No se pudo sincronizar Redis de Vercel:', e));
    }

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
