import { kv } from '@vercel/kv';
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const KEY = 'backend_url';
  const DEFAULT = 'https://plot-thread-would-dining.trycloudflare.com';

  try {
    if (req.method === 'GET') {
      const saved = await kv.get(KEY);
      console.log('Consulta Redis:', saved || 'VACÍO (usando default)');
      return res.status(200).json({
        baseUrl: saved || DEFAULT,
        source: saved ? 'database' : 'default_fallback',
        timestamp: new Date().toISOString()
      });
    }

    if (req.method === 'POST') {
      const { baseUrl } = req.body;
      if (!baseUrl) {
        console.error('Error: Intento de guardar baseUrl vacía');
        return res.status(400).json({ error: 'baseUrl is required' });
      }

      const cleanUrl = baseUrl.trim().replace(/\/$/, '');
      await kv.set(KEY, cleanUrl);

      console.log('ÉXITO: URL guardada en Redis:', cleanUrl);
      return res.status(200).json({ success: true, savedUrl: cleanUrl });
    }
  } catch (e: any) {
    console.error('ERROR CRÍTICO REDIS:', e.message);
    return res.status(500).json({
      error: 'Redis connection failed',
      message: e.message,
      fallbackUrl: DEFAULT
    });
  }

  return res.status(405).end();
}
