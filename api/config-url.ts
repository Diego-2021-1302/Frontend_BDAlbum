import { kv } from '@vercel/kv';
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Configuración de CORS estricta
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store, max-age=0');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const KEY = 'backend_url';

  try {
    if (req.method === 'GET') {
      // Obtenemos directamente de Redis
      const savedUrl = await kv.get<string>(KEY);

      // Si no hay nada en Redis, devolvemos null o vacío.
      // El frontend manejará este vacío.
      return res.status(200).json({
        baseUrl: savedUrl || "",
        status: savedUrl ? 'found' : 'empty_redis'
      });
    }

    if (req.method === 'POST') {
      const { baseUrl } = req.body;

      if (!baseUrl || !baseUrl.startsWith('http')) {
        return res.status(400).json({ error: 'URL inválida o vacía' });
      }

      const cleanUrl = baseUrl.trim().replace(/\/$/, '');

      // Guardado forzoso en Redis
      await kv.set(KEY, cleanUrl);

      return res.status(200).json({
        success: true,
        baseUrl: cleanUrl,
        message: 'URL actualizada globalmente en Redis'
      });
    }
  } catch (err: any) {
    // Si hay un error de conexión con Redis, devolvemos 500 para que sepas que algo va mal con la DB
    console.error('REDIS ERROR:', err);
    return res.status(500).json({
      error: 'Error de conexión con la base de datos Redis',
      details: err.message
    });
  }
}
