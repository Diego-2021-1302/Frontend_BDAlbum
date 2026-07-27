import { Redis } from '@upstash/redis';
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store, max-age=0');

  if (req.method === 'OPTIONS') return res.status(200).end();

  // ESCANEO DINÁMICO DE VARIABLES (Para saltar prefijos de Vercel)
  const allEnvKeys = Object.keys(process.env);

  // Buscamos cualquier variable que termine en _URL y contenga REST o REDIS o KV
  const urlKey = allEnvKeys.find(k => (k.includes('URL') || k.includes('REST_API')) && (k.includes('KV') || k.includes('REDIS') || k.includes('STORAGE')));
  const tokenKey = allEnvKeys.find(k => k.includes('TOKEN') && (k.includes('KV') || k.includes('REDIS') || k.includes('STORAGE')));

  const url = urlKey ? process.env[urlKey] : null;
  const token = tokenKey ? process.env[tokenKey] : null;

  if (!url || !token) {
    return res.status(500).json({
      error: 'No se encontraron variables de Redis',
      keys_escaneadas: allEnvKeys.filter(k => k.includes('URL') || k.includes('TOKEN'))
    });
  }

  try {
    const redisUrl = url.startsWith('redis://') ? url.replace('redis://', 'https://') : url;
    const redis = new Redis({ url: redisUrl, token });
    const KEY = 'backend_url';

    if (req.method === 'GET') {
      const saved = await redis.get(KEY);
      return res.status(200).json({ baseUrl: saved || "" });
    }

    if (req.method === 'POST') {
      const { baseUrl } = req.body;
      if (!baseUrl) return res.status(400).json({ error: 'URL requerida' });
      const cleanUrl = baseUrl.trim().replace(/\/$/, '');
      await redis.set(KEY, cleanUrl);
      return res.status(200).json({ success: true, baseUrl: cleanUrl });
    }
  } catch (err: any) {
    return res.status(500).json({ error: 'Error de conexión Redis', message: err.message });
  }
}
