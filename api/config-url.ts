import Redis from 'ioredis';
import type { VercelRequest, VercelResponse } from '@vercel/node';

let redis: Redis | null = null;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store, max-age=0');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const redisUrl = process.env.REDIS_URL || process.env.KV_URL;

  if (!redisUrl) {
    return res.status(500).json({ error: 'No se encontró REDIS_URL' });
  }

  if (!redis) {
    redis = new Redis(redisUrl, { connectTimeout: 10000, maxRetriesPerRequest: 1 });
  }

  const KEY = 'full_config';

  try {
    if (req.method === 'GET') {
      const saved = await redis.get(KEY);
      if (saved) {
        return res.status(200).json(JSON.parse(saved));
      }
      return res.status(200).json({ baseUrl: "", mediaUrl: "", uploadUrl: "", videoUrl: "" });
    }

    if (req.method === 'POST') {
      const { baseUrl, mediaUrl, uploadUrl, videoUrl } = req.body;
      if (!baseUrl) return res.status(400).json({ error: 'Falta baseUrl' });

      const config = {
        baseUrl: baseUrl.trim().replace(/\/$/, ''),
        mediaUrl: (mediaUrl || '').trim().replace(/\/$/, ''),
        uploadUrl: (uploadUrl || '').trim().replace(/\/$/, ''),
        videoUrl: (videoUrl || '').trim().replace(/\/$/, '')
      };

      await redis.set(KEY, JSON.stringify(config));
      return res.status(200).json({ success: true, config });
    }
  } catch (err: any) {
    return res.status(500).json({ error: 'Error Redis', details: err.message });
  }
}
