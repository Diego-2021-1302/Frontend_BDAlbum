import { Redis } from '@upstash/redis';
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store, max-age=0');

  if (req.method === 'OPTIONS') return res.status(200).end();

  // INTENTO DE AUTODETECCIÓN DE VARIABLES
  // Upstash necesita una URL que empiece por https://
  const rawUrl = process.env.KV_REST_API_URL || process.env.REDIS_URL || '';
  const token = process.env.KV_REST_API_TOKEN || process.env.REDIS_TOKEN || '';

  // Limpiar la URL para asegurar que Upstash la acepte
  let cleanUrl = rawUrl.trim();
  if (cleanUrl.startsWith('redis://')) {
    // Si Vercel nos dio una URL de redis clásica, intentamos convertirla a la REST de Upstash
    // Nota: Esto es un fallback, lo ideal es que KV_REST_API_URL esté presente.
    cleanUrl = cleanUrl.replace('redis://', 'https://').split('@')[1] || cleanUrl;
    if (!cleanUrl.startsWith('https://')) cleanUrl = 'https://' + cleanUrl;
  }

  const KEY = 'backend_url';
  const DEFAULT = 'https://plot-thread-would-dining.trycloudflare.com';

  try {
    if (!cleanUrl || !token) {
      throw new Error('Faltan credenciales de base de datos (URL o Token)');
    }

    const redis = new Redis({
      url: cleanUrl,
      token: token,
    });

    if (req.method === 'GET') {
      const saved = await redis.get(KEY);
      return res.status(200).json({ baseUrl: saved || DEFAULT });
    }

    if (req.method === 'POST') {
      const { baseUrl } = req.body;
      if (!baseUrl) return res.status(400).json({ error: 'Falta baseUrl' });
      const newUrl = baseUrl.trim().replace(/\/$/, '');
      await redis.set(KEY, newUrl);
      return res.status(200).json({ success: true, baseUrl: newUrl });
    }
  } catch (err: any) {
    console.error('Error Crítico Redis:', err.message);
    // IMPORTANTE: Si la DB falla, devolvemos el DEFAULT para que tu APP no se quede en blanco
    // Pero incluimos el error para que puedas verlo en la consola
    return res.status(200).json({
      baseUrl: DEFAULT,
      error: 'Database connection failed',
      details: err.message
    });
  }
}
