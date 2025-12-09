/**
 * Vercel Serverless Function - MinerU API 代理
 * 用于绕过浏览器 CORS 限制
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

const MINERU_API_BASE = 'https://mineru.net/api/v4';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // 设置 CORS 头
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  // 处理 OPTIONS 请求
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    const { path, method = 'GET', body, token } = req.body;

    if (!path) {
      return res.status(400).json({ error: 'Missing path parameter' });
    }

    if (!token) {
      return res.status(400).json({ error: 'Missing MinerU token' });
    }

    const url = `${MINERU_API_BASE}${path}`;
    
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${token}`,
    };

    // 如果有 body，添加 Content-Type
    if (body && method !== 'GET') {
      headers['Content-Type'] = 'application/json';
    }

    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    const data = await response.json();
    
    res.status(response.status).json(data);
  } catch (error: any) {
    console.error('MinerU proxy error:', error);
    res.status(500).json({ 
      error: 'Proxy request failed',
      message: error.message 
    });
  }
}
