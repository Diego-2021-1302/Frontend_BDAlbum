import { kv } from '@vercel/kv';
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store, max-age=0');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const KEY = 'backend_url';

  // LOG DE DIAGNÓSTICO (Esto aparecerá en el panel de Vercel)
  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) {
    console.error('CRÍTICO: Faltan variables de entorno KV. Verifica el Storage en Vercel.');
    return res.status(500).json({
      error: 'Base de datos no vinculada',
      details: 'Debes conectar el Storage Redis/KV en el panel de Vercel.'
    });
  }

  try {
    if (req.method === 'GET') {
      const savedUrl = await kv.get(KEY);
      return res.status(200).json({
        baseUrl: savedUrl || "",
        status: savedUrl ? 'found' : 'empty_redis'
      });
    }

    if (req.method === 'POST') {
      const { baseUrl } = req.body;
      if (!baseUrl) return res.status(400).json({ error: 'Falta baseUrl' });

      const cleanUrl = baseUrl.trim().replace(/\/$/, '');
      await kv.set(KEY, cleanUrl);

      return res.status(200).json({ success: true, baseUrl: cleanUrl });
    }
  } catch (err: any) {
    console.error('Error de Redis:', err.message);
    return res.status(500).json({ error: 'Error de conexión con Redis', details: err.message });
  }
}
