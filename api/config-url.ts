import { kv } from '@vercel/kv';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const DEFAULT_URL = 'https://plot-thread-would-dining.trycloudflare.com';
const KV_KEY = 'backend_url';

export default async function handler(request: VercelRequest, response: VercelResponse) {
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  response.setHeader('Cache-Control', 'no-s-cache, no-store, must-revalidate');

  if (request.method === 'OPTIONS') return response.status(200).end();

  try {
    if (request.method === 'GET') {
      const savedUrl = await kv.get(KV_KEY);
      return response.status(200).json({
        baseUrl: (savedUrl as string) || DEFAULT_URL,
        isDefault: !savedUrl
      });
    }

    if (request.method === 'POST') {
      // Forzar el parseo si llega como string
      const body = typeof request.body === 'string' ? JSON.parse(request.body) : request.body;
      const { baseUrl } = body;

      if (baseUrl && baseUrl.startsWith('http')) {
        const cleanUrl = baseUrl.trim().replace(/\/$/, '');
        await kv.set(KV_KEY, cleanUrl);
        console.log('URL actualizada en Redis:', cleanUrl);
        return response.status(200).json({ success: true, baseUrl: cleanUrl });
      }
      return response.status(400).json({ error: 'URL inválida' });
    }
  } catch (error) {
    console.error('Error en API:', error);
    return response.status(500).json({ error: 'Error de servidor', details: String(error) });
  }
}
