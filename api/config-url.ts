import { Redis } from '@upstash/redis';
import type { VercelRequest, VercelResponse } from '@vercel/node';

// Configuración del cliente de Upstash Redis
// Estas variables las inyecta Vercel automáticamente al conectar el Storage
const redis = new Redis({
  url: process.env.KV_REST_API_URL || '',
  token: process.env.KV_REST_API_TOKEN || '',
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store, max-age=0');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const KEY = 'backend_url';

  try {
    if (req.method === 'GET') {
      const saved = await redis.get(KEY);
      return res.status(200).json({ baseUrl: saved || "" });
    }

    if (req.method === 'POST') {
      const { baseUrl } = req.body;
      if (!baseUrl) return res.status(400).json({ error: 'Falta baseUrl' });
      const cleanUrl = baseUrl.trim().replace(/\/$/, '');
      await redis.set(KEY, cleanUrl);
      return res.status(200).json({ success: true, baseUrl: cleanUrl });
    }
  } catch (err: any) {
    console.error('Error Upstash Redis:', err.message);
    return res.status(500).json({ error: 'Database Connection Error', message: err.message });
  }
}
