import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Redis as UpstashRedis } from '@upstash/redis';
import IORedis from 'ioredis';

const KEY = 'album_bd:full_config';

let redisClient: any = null;

function getRedisClient() {
  if (redisClient) return redisClient;

  const restUrl = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const restToken = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

  // 1. Si existen credenciales REST de Upstash / Vercel KV
  if (restUrl && restToken) {
    redisClient = new UpstashRedis({ url: restUrl, token: restToken });
    return redisClient;
  }

  // 2. Fallback a REDIS_URL o KV_URL (redis://, rediss:// o https://)
  const redisUrl = process.env.REDIS_URL || process.env.KV_URL;
  if (!redisUrl) return null;

  if (redisUrl.startsWith('https://')) {
    const token = process.env.REDIS_TOKEN || process.env.KV_REST_API_TOKEN || '';
    redisClient = new UpstashRedis({ url: redisUrl, token });
    return redisClient;
  }

  // Conexión TCP nativa usando ioredis
  const IORedisConstructor: any = (IORedis as any).default || IORedis;
  redisClient = new IORedisConstructor(redisUrl, {
    connectTimeout: 8000,
    maxRetriesPerRequest: 1,
    lazyConnect: true,
  });
  return redisClient;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store, max-age=0');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const client = getRedisClient();

  if (!client) {
    return res.status(500).json({ error: 'No se configuró REDIS_URL ni credenciales de Redis en Vercel' });
  }

  try {
    if (req.method === 'GET') {
      const saved = await client.get(KEY);
      if (saved) {
        const parsed = typeof saved === 'string' ? JSON.parse(saved) : saved;
        return res.status(200).json(parsed);
      }
      return res.status(200).json({ baseUrl: '', mediaUrl: '', uploadUrl: '', videoUrl: '' });
    }

    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
      const { baseUrl, mediaUrl, uploadUrl, videoUrl } = body;
      if (!baseUrl) return res.status(400).json({ error: 'Falta baseUrl' });

      const config = {
        baseUrl: baseUrl.trim().replace(/\/$/, ''),
        mediaUrl: (mediaUrl || '').trim().replace(/\/$/, ''),
        uploadUrl: (uploadUrl || '').trim().replace(/\/$/, ''),
        videoUrl: (videoUrl || '').trim().replace(/\/$/, ''),
        updated_at: new Date().toISOString()
      };

      const payload = JSON.stringify(config);
      await client.set(KEY, payload);
      return res.status(200).json({ success: true, config });
    }
  } catch (err: any) {
    console.error('Error Redis en Vercel Function:', err);
    return res.status(500).json({ error: 'Error Redis', details: err.message });
  }
}
