import Redis from 'ioredis';
import type { VercelRequest, VercelResponse } from '@vercel/node';

// Usamos una variable global para reutilizar la conexión en Vercel (evita agotar conexiones)
let redis: Redis | null = null;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store, max-age=0');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const redisUrl = process.env.REDIS_URL || process.env.KV_URL;

  if (!redisUrl) {
    return res.status(500).json({
      error: 'No se encontró REDIS_URL',
      debug: Object.keys(process.env).filter(k => k.includes('URL') || k.includes('REDIS'))
    });
  }

  // Inicializar cliente si no existe
  if (!redis) {
    redis = new Redis(redisUrl, {
      connectTimeout: 10000,
      maxRetriesPerRequest: 1
    });
  }

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
    console.error('Error Redis:', err.message);
    return res.status(500).json({ error: 'Error de conexión Redis', details: err.message });
  }
}
