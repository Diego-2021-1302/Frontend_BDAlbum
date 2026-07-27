import { kv } from '@vercel/kv';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const DEFAULT_URL = 'https://plot-thread-would-dining.trycloudflare.com';
const KV_KEY = 'backend_url';

export default async function handler(
  request: VercelRequest,
  response: VercelResponse
) {
  // Configuración de CORS
  response.setHeader('Access-Control-Allow-Credentials', 'true');
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  response.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (request.method === 'OPTIONS') {
    return response.status(200).end();
  }

  try {
    if (request.method === 'GET') {
      const savedUrl = await kv.get(KV_KEY);
      return response.status(200).json({ baseUrl: savedUrl || DEFAULT_URL });
    }

    if (request.method === 'POST') {
      const { baseUrl } = request.body;
      if (baseUrl) {
        const cleanUrl = baseUrl.trim().replace(/\/$/, '');
        await kv.set(KV_KEY, cleanUrl);
        return response.status(200).json({ success: true, baseUrl: cleanUrl });
      }
    }
  } catch (error) {
    console.error('KV Error:', error);
    return response.status(200).json({ baseUrl: DEFAULT_URL, error: 'DB Connection error' });
  }

  return response.status(405).json({ error: 'Method not allowed' });
}
