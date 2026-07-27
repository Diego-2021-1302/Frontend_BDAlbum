import { Redis } from '@upstash/redis';
import type { VercelRequest, VercelResponse } from '@vercel/node';

// Forzamos la creación del cliente dentro del handler para asegurar que las variables de entorno estén frescas
export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store, max-age=0');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const url = process.env.KV_REST_API_URL || process.env.REDIS_URL?.replace('redis://', 'https://');
  const token = process.env.KV_REST_API_TOKEN || process.env.REDIS_TOKEN;

  if (!url || !token) {
    return res.status(500).json({ error: 'Faltan credenciales de Redis en Vercel' });
  }

  const redis = new Redis({ url, token });
  const KEY = 'backend_url';

  try {
    if (req.method === 'GET') {
      const saved = await redis.get(KEY);
      return res.status(200).json({ baseUrl: saved || "" });
    }

    if (req.method === 'POST') {
      const { baseUrl } = req.body;
      if (!baseUrl) return res.status(400).json({ error: 'URL requerida' });

      const cleanUrl = baseUrl.trim().replace(/\/$/, '');
      await redis.set(KEY, cleanUrl);
      console.log('✅ Redis actualizado:', cleanUrl);
      return res.status(200).json({ success: true, baseUrl: cleanUrl });
    }
  } catch (err: any) {
    return res.status(500).json({ error: 'Error de Redis', message: err.message });
  }
}
