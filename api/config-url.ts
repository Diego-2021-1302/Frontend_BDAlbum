import { createClient } from '@vercel/kv';
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  // Intentamos conectar usando las variables que Vercel te asignó (REDIS_URL o KV)
  const client = createClient({
    url: process.env.KV_REST_API_URL || process.env.REDIS_URL?.replace('redis://', 'https://'),
    token: process.env.KV_REST_API_TOKEN || '',
  });

  const KEY = 'backend_url';

  try {
    if (req.method === 'GET') {
      const saved = await client.get(KEY);
      return res.status(200).json({ baseUrl: saved || "" });
    }

    if (req.method === 'POST') {
      const { baseUrl } = req.body;
      if (!baseUrl) return res.status(400).json({ error: 'Falta baseUrl' });
      const cleanUrl = baseUrl.trim().replace(/\/$/, '');
      await client.set(KEY, cleanUrl);
      return res.status(200).json({ success: true, baseUrl: cleanUrl });
    }
  } catch (err: any) {
    console.error('Error de conexión Redis:', err.message);
    // Si falla la DB, devolvemos 500 para que lo veamos en consola, pero con info
    return res.status(500).json({ error: 'Redis Connection Error', message: err.message });
  }
}
