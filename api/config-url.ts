import { createClient } from '@vercel/kv';
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store, max-age=0');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const url = process.env.KV_REST_API_URL || (process.env.REDIS_URL ? process.env.REDIS_URL.replace('redis://', 'https://') : '');
  const token = process.env.KV_REST_API_TOKEN || '';

  const client = createClient({
    url: url,
    token: token,
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
    console.error('Error Redis:', err.message);
    return res.status(500).json({ error: 'Redis Connection Error', message: err.message });
  }
}
