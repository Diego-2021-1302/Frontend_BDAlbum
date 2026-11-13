export const API_BASE_URL_KEY = 'api_base_url';
export const MEDIA_URL_KEY = 'media_url';
export const UPLOAD_URL_KEY = 'upload_url';
export const VIDEO_URL_KEY = 'video_url';
export const DEFAULT_API_BASE_URL = '';

const CONFIG_TTL_MS = 15000;
let globalConfigCache: { value: {baseUrl: string; mediaUrl: string; uploadUrl: string; videoUrl: string}; expiresAt: number } | null = null;

export function clearGlobalConfigCache(): void {
  globalConfigCache = null;
}

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

export async function fetchGlobalBaseUrl(currentBaseUrl?: string, force = false): Promise<{baseUrl: string, mediaUrl: string, uploadUrl: string, videoUrl: string} | null> {
  try {
    const now = Date.now();
    if (!force && !currentBaseUrl && globalConfigCache && now < globalConfigCache.expiresAt) {
      return globalConfigCache.value;
    }

    // Endpoints de descubrimiento en orden de prioridad (consultan Redis)
    const discoveryEndpoints = [
      `${window.location.origin}/api/config-url?t=${now}`,
      `https://frontend-bd-album-nine.vercel.app/api/config-url?t=${now}`
    ];

    for (const endpoint of discoveryEndpoints) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4000);
        const resp = await fetch(endpoint, {
          cache: 'no-store',
          headers: { 'Pragma': 'no-cache', 'Cache-Control': 'no-cache' },
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (resp.ok) {
          const vercelData = normalizeConfig(await resp.json());
          if (vercelData.baseUrl) {
            globalConfigCache = { value: vercelData, expiresAt: Date.now() + CONFIG_TTL_MS };
            return vercelData;
          }
        }
      } catch (e) {
        // Siguiente candidato de descubrimiento
      }
    }

    const host = currentBaseUrl || getPersistedBaseUrl();
    if (host) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4000);
        const response = await fetch(`${host}/api/config-url?t=${now}`, {
          cache: 'no-store',
          headers: { 'Pragma': 'no-cache', 'Cache-Control': 'no-cache' },
          signal: controller.signal
        });
        clearTimeout(timeoutId);
        if (response.ok) {
          const data = normalizeConfig(await response.json());
          if (data.baseUrl) {
            globalConfigCache = { value: data, expiresAt: Date.now() + CONFIG_TTL_MS };
            return data;
          }
        }
      } catch (e) {
        // Ignorar
      }
    }

    return null;
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
