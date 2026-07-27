import { kv } from '@vercel/kv';
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Cabeceras básicas de CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store, max-age=0');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const DEFAULT_URL = 'https://plot-thread-would-dining.trycloudflare.com';
  const KEY = 'backend_url';

  try {
    if (req.method === 'GET') {
      // Intentar obtener de KV, si falla o no existe, usar el DEFAULT
      let savedUrl = null;
      try {
        savedUrl = await kv.get(KEY);
      } catch (e) {
        console.error('Redis Get Error:', e);
      }
      return res.status(200).json({ baseUrl: savedUrl || DEFAULT_URL });
    }

    if (req.method === 'POST') {
      const { baseUrl } = req.body;
      if (!baseUrl) return res.status(400).json({ error: 'Missing baseUrl' });

      const cleanUrl = baseUrl.trim().replace(/\/$/, '');
      await kv.set(KEY, cleanUrl);
      return res.status(200).json({ success: true, baseUrl: cleanUrl });
    }
  } catch (err: any) {
    console.error('Global API Error:', err);
    return res.status(200).json({ baseUrl: DEFAULT_URL, error: err.message });
  }
}
