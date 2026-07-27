export const API_BASE_URL_KEY = 'api_base_url';
export const DEFAULT_API_BASE_URL = 'https://plot-thread-would-dining.trycloudflare.com';

export function getPersistedBaseUrl(): string {
  const stored = localStorage.getItem(API_BASE_URL_KEY);
  return stored ? stored.trim().replace(/\/$/, '') : DEFAULT_API_BASE_URL;
}

export async function fetchGlobalBaseUrl(): Promise<string | null> {
  try {
    // Añadimos un timestamp para romper la caché del navegador y de Vercel Edge
    const response = await fetch(`/api/config-url?t=${Date.now()}`, {
      cache: 'no-store',
      headers: { 'Pragma': 'no-cache', 'Cache-Control': 'no-cache' }
    });
    if (!response.ok) return null;
    const data = await response.json();
    if (!data?.baseUrl) return null;
    return data.baseUrl.trim().replace(/\/$/, '') || DEFAULT_API_BASE_URL;
  } catch (error) {
    console.log('No se pudo leer config-url:', error);
    return null;
  }
}

export async function updateGlobalBaseUrl(url: string): Promise<boolean> {
  try {
    const cleanUrl = url.trim().replace(/\/$/, '') || DEFAULT_API_BASE_URL;
    const response = await fetch('/api/config-url', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ baseUrl: cleanUrl })
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
