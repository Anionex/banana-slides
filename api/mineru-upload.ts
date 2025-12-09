/**
 * Vercel Serverless Function - MinerU 文件上传代理
 * 用于处理文件上传到 MinerU 的预签名 URL
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

export const config = {
  api: {
    bodyParser: false, // 禁用默认的 body parser，以便处理文件上传
  },
};

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
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  // 处理 OPTIONS 请求
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { uploadUrl } = req.query;

    if (!uploadUrl || typeof uploadUrl !== 'string') {
      return res.status(400).json({ error: 'Missing uploadUrl parameter' });
    }

    // 读取请求体（文件数据）
    const chunks: Buffer[] = [];
    for await (const chunk of req) {
      chunks.push(chunk);
    }
    const fileBuffer = Buffer.concat(chunks);

    // 上传到 MinerU 的预签名 URL
    const response = await fetch(uploadUrl, {
      method: 'PUT',
      body: fileBuffer,
    });

    if (!response.ok) {
      return res.status(response.status).json({ 
        error: 'Upload failed',
        status: response.status 
      });
    }

    res.status(200).json({ success: true });
  } catch (error: any) {
    console.error('Upload proxy error:', error);
    res.status(500).json({ 
      error: 'Upload failed',
      message: error.message 
    });
  }
}
